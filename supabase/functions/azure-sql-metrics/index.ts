import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import sql from "npm:mssql@11";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MetricsResult {
  cpu_percent: number;
  memory_percent: number;
  storage_percent: number;
  active_connections: number;
  avg_response_time: number;
  status: "online" | "offline" | "warning";
  details: Record<string, unknown>;
  error_message: string | null;
}

async function resolveCredentials(config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const credentialId = config.credential_id as string | undefined;
  if (!credentialId) return config;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: cred, error } = await supabase
    .from("credentials")
    .select("config")
    .eq("id", credentialId)
    .single();

  if (error || !cred?.config) {
    console.warn("Could not resolve credential_id, using inline config:", error?.message);
    return config;
  }

  // Merge credential config (lower priority) with inline config (higher priority)
  const credConfig = cred.config as Record<string, unknown>;
  return { ...credConfig, ...config };
}

async function collectMetrics(config: Record<string, unknown>): Promise<MetricsResult> {
  // Resolve credentials from credentials table if credential_id is present
  const resolvedConfig = await resolveCredentials(config);

  // Read from check_config first, fall back to env vars for backward compatibility
  const host = ((resolvedConfig.host as string) || Deno.env.get("AZURE_SQL_HOST") || "").trim();
  const database = ((resolvedConfig.database as string) || Deno.env.get("AZURE_SQL_DATABASE") || "").trim();
  const user = ((resolvedConfig.username as string) || Deno.env.get("AZURE_SQL_USER") || "").trim();
  const password = ((resolvedConfig.password as string) || Deno.env.get("AZURE_SQL_PASSWORD") || "").trim();

  if (!host || !database || !user || !password) {
    throw new Error("Azure SQL credentials not configured (check_config, credential_id or env vars)");
  }

  const sqlConfig: sql.config = {
    server: host,
    database,
    user,
    password,
    options: {
      encrypt: true,
      trustServerCertificate: (config.trust_server_certificate as boolean) ?? false,
    },
    connectionTimeout: 15000,
    requestTimeout: 15000,
  };

  const pool = await sql.connect(sqlConfig);

  try {
    const resourceStats = await pool.request().query(`
      SELECT TOP 1
        avg_cpu_percent,
        avg_data_io_percent,
        avg_log_write_percent,
        avg_memory_usage_percent,
        max_worker_percent,
        max_session_percent
      FROM sys.dm_db_resource_stats
      ORDER BY end_time DESC
    `);

    const sizeStats = await pool.request().query(`
      SELECT
        SUM(CAST(FILEPROPERTY(name, 'SpaceUsed') AS BIGINT) * 8 / 1024) AS used_mb,
        SUM(size * 8 / 1024) AS allocated_mb
      FROM sys.database_files
      WHERE type_desc = 'ROWS'
    `);

    const connStats = await pool.request().query(`
      SELECT COUNT(*) AS active_connections
      FROM sys.dm_exec_sessions
      WHERE is_user_process = 1
        AND status = 'running'
    `);

    const sessionStats = await pool.request().query(`
      SELECT COUNT(*) AS total_sessions
      FROM sys.dm_exec_sessions
      WHERE is_user_process = 1
    `);

    const waitStats = await pool.request().query(`
      SELECT TOP 5
        wait_type,
        waiting_tasks_count,
        wait_time_ms
      FROM sys.dm_os_wait_stats
      WHERE waiting_tasks_count > 0
        AND wait_type NOT LIKE '%SLEEP%'
        AND wait_type NOT LIKE '%IDLE%'
        AND wait_type NOT LIKE '%QUEUE%'
        AND wait_type NOT LIKE 'BROKER%'
        AND wait_type NOT LIKE 'XE%'
        AND wait_type NOT LIKE 'WAITFOR'
      ORDER BY wait_time_ms DESC
    `);

    const resource = resourceStats.recordset[0] || {};
    const size = sizeStats.recordset[0] || {};
    const conns = connStats.recordset[0] || {};
    const sessions = sessionStats.recordset[0] || {};

    const cpuPercent = resource.avg_cpu_percent ?? 0;
    const memoryPercent = resource.avg_memory_usage_percent ?? 0;
    const storagePercent =
      size.allocated_mb > 0
        ? Math.round((size.used_mb / size.allocated_mb) * 100 * 100) / 100
        : 0;

    // Fetch configurable rules
    const supabaseForRules = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ruleRow } = await supabaseForRules.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "sql_query").single();
    const wr = (ruleRow?.warning_rules ?? { cpu_gt: 90, memory_gt: 90, storage_gt: 95 }) as Record<string, number>;

    let status: "online" | "offline" | "warning" = "online";
    if (cpuPercent > (wr.cpu_gt ?? 90) || memoryPercent > (wr.memory_gt ?? 90) || storagePercent > (wr.storage_gt ?? 95)) {
      status = "warning";
    }

    return {
      cpu_percent: Math.round(cpuPercent * 100) / 100,
      memory_percent: Math.round(memoryPercent * 100) / 100,
      storage_percent: storagePercent,
      active_connections: conns.active_connections ?? 0,
      avg_response_time: 0,
      status,
      details: {
        avg_data_io_percent: resource.avg_data_io_percent ?? 0,
        avg_log_write_percent: resource.avg_log_write_percent ?? 0,
        max_worker_percent: resource.max_worker_percent ?? 0,
        max_session_percent: resource.max_session_percent ?? 0,
        used_mb: size.used_mb ?? 0,
        allocated_mb: size.allocated_mb ?? 0,
        total_sessions: sessions.total_sessions ?? 0,
        active_connections: conns.active_connections ?? 0,
        top_waits: waitStats.recordset || [],
      },
      error_message: null,
    };
  } finally {
    await pool.close();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("service_id");

    let config: Record<string, unknown> = {};
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (serviceId) {
      const { data: svc } = await supabase.from("services").select("check_config").eq("id", serviceId).single();
      config = (svc?.check_config as Record<string, unknown>) || {};
    }

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.config) config = { ...config, ...body.config };
      } catch { /* no body */ }
    }

    // Resolve credentials before choosing path
    const resolvedConfig = await resolveCredentials(config);

    let metrics: MetricsResult;
    let responseTime: number;

    // If agent_url is configured, delegate to the monitoring agent (bypasses firewall issues)
    const agentUrl = (resolvedConfig.agent_url as string || config.agent_url as string || "").trim();
    const agentToken = (resolvedConfig.agent_token as string || config.agent_token as string || "").trim();

    if (agentUrl) {
      const start = Date.now();
      const agentPayload = {
        host: ((resolvedConfig.host as string) || "").trim(),
        database: ((resolvedConfig.database as string) || "").trim(),
        username: ((resolvedConfig.username as string) || "").trim(),
        password: ((resolvedConfig.password as string) || "").trim(),
        port: resolvedConfig.port || 1433,
        encrypt: resolvedConfig.encrypt ?? true,
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (agentToken) headers["Authorization"] = `Bearer ${agentToken}`;

      const agentRes = await fetch(`${agentUrl.replace(/\/$/, "")}/mssql`, {
        method: "POST",
        headers,
        body: JSON.stringify(agentPayload),
      });
      const agentData = await agentRes.json();
      responseTime = Date.now() - start;

      if (!agentData.success) {
        throw new Error(agentData.error || "Agent MSSQL check failed");
      }

      metrics = {
        cpu_percent: agentData.metrics.cpu_percent ?? 0,
        memory_percent: agentData.metrics.memory_percent ?? 0,
        storage_percent: agentData.metrics.storage_percent ?? 0,
        active_connections: agentData.metrics.active_connections ?? 0,
        avg_response_time: agentData.metrics.avg_response_time ?? responseTime,
        status: agentData.metrics.status ?? "online",
        details: agentData.metrics.details ?? {},
        error_message: agentData.metrics.error_message ?? null,
      };
    } else {
      // Direct connection (original path)
      const start = Date.now();
      metrics = await collectMetrics(config);
      responseTime = Date.now() - start;
    }

    metrics.avg_response_time = responseTime;

    if (serviceId) {
      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status: metrics.status,
        response_time: responseTime,
        cpu: metrics.cpu_percent,
        memory: metrics.memory_percent,
        disk: metrics.storage_percent,
        error_message: metrics.error_message,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", {
        p_service_id: serviceId,
      });

      // Persist _sql_details in check_config (like Airflow does)
      const updatedConfig = { ...config, _sql_details: metrics.details };

      await supabase
        .from("services")
        .update({
          status: metrics.status,
          response_time: responseTime,
          cpu: metrics.cpu_percent,
          memory: metrics.memory_percent,
          disk: metrics.storage_percent,
          last_check: new Date().toISOString(),
          uptime: uptimeData ?? 0,
          check_config: updatedConfig,
        })
        .eq("id", serviceId);
    }

    return new Response(
      JSON.stringify({ success: true, response_time: responseTime, metrics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Azure SQL metrics error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
