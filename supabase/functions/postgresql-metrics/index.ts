import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function buildPgConnStr(c: Record<string, unknown>): string {
  const host = c.host as string;
  if (!host) return "";
  const port = c.port || "5432";
  const db = c.database || "postgres";
  const user = c.username || "postgres";
  const pass = c.password ? `:${encodeURIComponent(c.password as string)}` : "";
  const ssl = c.sslmode || c.ssl_mode || "prefer";
  return `postgresql://${user}${pass}@${host}:${port}/${db}?sslmode=${ssl}`;
}

async function collectViaAgent(agentUrl: string, agentToken: string, config: Record<string, unknown>) {
  const url = agentUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (agentToken) headers["Authorization"] = `Bearer ${agentToken}`;

  const payload: Record<string, unknown> = {};
  if (config.connection_string) payload.connection_string = config.connection_string;
  if (config.host) payload.host = config.host;
  if (config.port) payload.port = config.port;
  if (config.database) payload.database = config.database;
  if (config.username) payload.username = config.username;
  if (config.password) payload.password = config.password;
  if (config.sslmode) payload.sslmode = config.sslmode;

  const start = Date.now();
  const res = await fetch(`${url}/postgresql`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const responseTime = Date.now() - start;
  const data = await res.json();
  if (!data.success) throw new Error(data.error || data.message || "Agent relay failed");
  return { ...data.metrics, response_time: responseTime };
}

async function collectPostgresMetrics(config: Record<string, unknown>) {
  const { default: pg } = await import("npm:pg@8");
  
  const connectionString = (config.connection_string as string) || buildPgConnStr(config);
  if (!connectionString) throw new Error("PostgreSQL connection_string ou host não configurado");

  const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
  const start = Date.now();
  await client.connect();
  const connectTime = Date.now() - start;

  try {
    // Database size
    const sizeRes = await client.query(`
      SELECT pg_database_size(current_database()) AS db_size,
             pg_size_pretty(pg_database_size(current_database())) AS db_size_pretty
    `);

    // Active connections
    const connRes = await client.query(`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE state = 'active') AS active,
             count(*) FILTER (WHERE state = 'idle') AS idle,
             count(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
      FROM pg_stat_activity
      WHERE backend_type = 'client backend'
    `);

    // Cache hit ratio
    const cacheRes = await client.query(`
      SELECT 
        ROUND(100.0 * sum(blks_hit) / NULLIF(sum(blks_hit) + sum(blks_read), 0), 2) AS cache_hit_ratio
      FROM pg_stat_database
      WHERE datname = current_database()
    `);

    // Table stats (top 5 by size)
    const tableRes = await client.query(`
      SELECT schemaname, relname,
             pg_size_pretty(pg_total_relation_size(relid)) AS total_size,
             n_live_tup AS row_count,
             n_dead_tup AS dead_tuples,
             CASE WHEN n_live_tup > 0 
               THEN ROUND(100.0 * n_dead_tup / n_live_tup, 2)
               ELSE 0 END AS bloat_percent
      FROM pg_stat_user_tables
      ORDER BY pg_total_relation_size(relid) DESC
      LIMIT 5
    `);

    // Replication lag (if applicable)
    const repRes = await client.query(`
      SELECT CASE WHEN pg_is_in_recovery() 
        THEN EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())
        ELSE 0 END AS replication_lag_seconds
    `);

    // Transaction stats
    const txRes = await client.query(`
      SELECT xact_commit, xact_rollback, deadlocks, conflicts,
             tup_returned, tup_fetched, tup_inserted, tup_updated, tup_deleted
      FROM pg_stat_database
      WHERE datname = current_database()
    `);

    const conn = connRes.rows[0];
    const size = sizeRes.rows[0];
    const cache = cacheRes.rows[0];
    const tx = txRes.rows[0];

    const cacheHit = parseFloat(cache.cache_hit_ratio) || 0;

    // Fetch configurable rules
    const supabaseForRules = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ruleRow } = await supabaseForRules.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "postgresql").single();
    const wr = (ruleRow?.warning_rules ?? { cache_hit_lt: 80, active_connections_gt: 50 }) as Record<string, number>;

    let status: "online" | "warning" | "offline" = "online";
    if (cacheHit < (wr.cache_hit_lt ?? 80) || parseInt(conn.active) > (wr.active_connections_gt ?? 50)) status = "warning";

    return {
      status,
      response_time: connectTime,
      cpu: Math.min(parseFloat(conn.active) / Math.max(parseFloat(conn.total), 1) * 100, 100),
      memory: cacheHit, // cache hit as "memory efficiency"
      disk: 0,
      details: {
        db_size: size.db_size_pretty,
        db_size_bytes: parseInt(size.db_size),
        connections: { total: parseInt(conn.total), active: parseInt(conn.active), idle: parseInt(conn.idle), waiting: parseInt(conn.waiting) },
        cache_hit_ratio: cacheHit,
        transactions: tx,
        top_tables: tableRes.rows,
        replication_lag_seconds: parseFloat(repRes.rows[0].replication_lag_seconds) || 0,
      },
      error_message: null,
    };
  } finally {
    await client.end();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("service_id");

    let config: Record<string, unknown> = {};
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (serviceId) {
      const { data: svc } = await supabase.from("services").select("check_config").eq("id", serviceId).single();
      config = (svc?.check_config as Record<string, unknown>) || {};
    }

    // Also accept config from request body
    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.config) config = { ...config, ...body.config };
      } catch { /* no body */ }
    }

    // Resolve credential_id if present
    if (config.credential_id) {
      const { data: cred } = await supabase
        .from("credentials")
        .select("config")
        .eq("id", config.credential_id)
        .single();
      if (cred?.config) {
        const credConfig = cred.config as Record<string, unknown>;
        // Merge credential config (connection details) under the service config
        config = { ...credConfig, ...config };
      }
    }

    // Agent relay support
    const agentUrl = ((config.agent_url as string) || "").trim();
    const agentToken = ((config.agent_token || config.token) as string || "").trim();

    let metrics;
    if (agentUrl) {
      const agentData = await collectViaAgent(agentUrl, agentToken, config);
      // Normalize agent response to match direct metrics format
      const conn = agentData.connections || {};
      const cacheHit = parseFloat(agentData.cache_hit_ratio) || 0;

      const supabaseForRules = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      const { data: ruleRow } = await supabaseForRules.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "postgresql").single();
      const wr = (ruleRow?.warning_rules ?? { cache_hit_lt: 80, active_connections_gt: 50 }) as Record<string, number>;

      let status: "online" | "warning" | "offline" = "online";
      if (cacheHit < (wr.cache_hit_lt ?? 80) || (conn.active || 0) > (wr.active_connections_gt ?? 50)) status = "warning";

      metrics = {
        status,
        response_time: agentData.response_time || 0,
        cpu: Math.min((conn.active || 0) / Math.max((conn.total || 1), 1) * 100, 100),
        memory: cacheHit,
        disk: 0,
        details: agentData,
        error_message: null,
      };
    } else {
      metrics = await collectPostgresMetrics(config);
    }

    if (serviceId) {
      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status: metrics.status,
        response_time: metrics.response_time,
        cpu: metrics.cpu,
        memory: metrics.memory,
        disk: metrics.disk,
        error_message: metrics.error_message,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      // Persist _pg_details in check_config (like Airflow does)
      const updatedConfig = { ...config, _pg_details: metrics.details };

      await supabase.from("services").update({
        status: metrics.status,
        response_time: metrics.response_time,
        cpu: metrics.cpu,
        memory: metrics.memory,
        disk: metrics.disk,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: updatedConfig,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({ success: true, metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("PostgreSQL metrics error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
