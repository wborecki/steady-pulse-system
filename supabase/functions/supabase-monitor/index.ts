import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SubCheck {
  name: string;
  status: "online" | "warning" | "offline";
  response_time: number;
  error?: string;
  details?: Record<string, unknown>;
}

async function timedFetch(url: string, opts: RequestInit = {}, timeoutMs = 10000): Promise<{ response: Response | null; elapsed: number; error?: string }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timeout);
    return { response: res, elapsed: Date.now() - start };
  } catch (err) {
    return { response: null, elapsed: Date.now() - start, error: err.message };
  }
}

// ─── Sub-checks ────────────────────────────────────────────────────────

async function checkRestApi(projectUrl: string, anonKey: string, serviceRoleKey: string): Promise<SubCheck> {
  // Test REST API connectivity by querying a simple endpoint
  const url = `${projectUrl}/rest/v1/services?select=id&limit=1`;
  const { response, elapsed, error } = await timedFetch(url, {
    headers: {
      "apikey": serviceRoleKey,
      "Authorization": `Bearer ${serviceRoleKey}`,
    },
  });
  if (error || !response) return { name: "REST API", status: "offline", response_time: elapsed, error: error || "No response" };
  if (response.status === 200) return { name: "REST API", status: "online", response_time: elapsed };
  return { name: "REST API", status: response.status < 500 ? "warning" : "offline", response_time: elapsed, error: `HTTP ${response.status}` };
}

async function checkAuth(projectUrl: string, anonKey: string, serviceRoleKey: string): Promise<SubCheck> {
  const url = `${projectUrl}/auth/v1/health`;
  const { response, elapsed, error } = await timedFetch(url, {
    headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
  });
  if (error || !response) return { name: "Auth", status: "offline", response_time: elapsed, error: error || "No response" };
  if (response.ok) {
    try {
      const data = await response.json();
      return { name: "Auth", status: "online", response_time: elapsed, details: data };
    } catch {
      return { name: "Auth", status: "online", response_time: elapsed };
    }
  }
  return { name: "Auth", status: "offline", response_time: elapsed, error: `HTTP ${response.status}` };
}

async function checkRealtime(projectUrl: string, anonKey: string, serviceRoleKey: string): Promise<SubCheck> {
  // Realtime uses WebSocket - test the HTTP endpoint; any response (even 4xx) means the service is running
  const url = `${projectUrl}/realtime/v1/api/health?apikey=${serviceRoleKey}`;
  const { response, elapsed, error } = await timedFetch(url, {
    headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
  });
  if (error || !response) return { name: "Realtime", status: "offline", response_time: elapsed, error: error || "No response" };
  // Realtime service doesn't have a proper HTTP health endpoint; any HTTP response means it's running
  return { name: "Realtime", status: "online", response_time: elapsed };
}

async function checkStorage(projectUrl: string, anonKey: string, serviceRoleKey: string): Promise<SubCheck> {
  const url = `${projectUrl}/storage/v1/health`;
  const { response, elapsed, error } = await timedFetch(url, {
    headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
  });
  if (error || !response) {
    // Some Supabase instances don't have /storage/v1/health, try listing buckets
    const fallbackUrl = `${projectUrl}/storage/v1/bucket`;
    const fb = await timedFetch(fallbackUrl, {
      headers: { "apikey": serviceRoleKey, "Authorization": `Bearer ${serviceRoleKey}` },
    });
    if (fb.response && fb.response.ok) return { name: "Storage", status: "online", response_time: fb.elapsed };
    return { name: "Storage", status: "offline", response_time: elapsed, error: error || "No response" };
  }
  if (response.ok) return { name: "Storage", status: "online", response_time: elapsed };
  return { name: "Storage", status: response.status < 500 ? "warning" : "offline", response_time: elapsed, error: `HTTP ${response.status}` };
}

async function checkEdgeFunctions(projectUrl: string, serviceRoleKey: string, functionName?: string): Promise<SubCheck> {
  // If a specific function is provided, test it. Otherwise test the health-check function.
  const fnName = functionName || "health-check";
  const url = `${projectUrl}/functions/v1/${fnName}`;
  const { response, elapsed, error } = await timedFetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
  }, 15000);
  if (error || !response) return { name: "Edge Functions", status: "offline", response_time: elapsed, error: error || "No response" };
  // Even 4xx from a function means the runtime is working
  if (response.status < 500) return { name: "Edge Functions", status: "online", response_time: elapsed };
  return { name: "Edge Functions", status: "offline", response_time: elapsed, error: `HTTP ${response.status}` };
}

async function checkDatabase(projectUrl: string, serviceRoleKey: string): Promise<SubCheck> {
  const supabase = createClient(projectUrl, serviceRoleKey);
  const start = Date.now();
  try {
    // Test basic connectivity first
    const { error: pingErr } = await supabase.from("services").select("id").limit(1);
    if (pingErr) {
      return { name: "Database", status: "offline", response_time: Date.now() - start, error: pingErr.message };
    }

    // Try to get detailed stats via RPCs (these are optional — installed by migration)
    let version = "N/A";
    let dbSize = "N/A";
    let totalConns = 0, activeConns = 0, idleConns = 0, maxConns = 100;
    let cacheRatio = 100;
    let tableCount = 0;
    let activeQueries: unknown[] = [];

    // Version
    try {
      const { data } = await supabase.rpc("get_pg_version").maybeSingle();
      if (data?.version) version = data.version;
    } catch { /* RPC not installed */ }

    // DB size
    try {
      const { data } = await supabase.rpc("get_db_size").maybeSingle();
      if (data?.db_size) dbSize = data.db_size;
    } catch { /* RPC not installed */ }

    // Connections
    try {
      const { data } = await supabase.rpc("get_db_connections").maybeSingle();
      if (data) {
        totalConns = data.total || 0;
        activeConns = data.active || 0;
        idleConns = data.idle || 0;
        maxConns = data.max_connections || 100;
      }
    } catch { /* RPC not installed */ }

    // Cache hit ratio
    try {
      const { data } = await supabase.rpc("get_cache_hit_ratio").maybeSingle();
      if (data?.ratio != null) cacheRatio = data.ratio;
    } catch { /* RPC not installed */ }

    // Table count
    try {
      const { data } = await supabase.rpc("get_table_count").maybeSingle();
      if (data?.count != null) tableCount = data.count;
    } catch { /* RPC not installed */ }

    // Active queries
    try {
      const { data } = await supabase.rpc("get_active_queries");
      if (data) activeQueries = data;
    } catch { /* RPC not installed */ }

    const elapsed = Date.now() - start;
    const connPercent = maxConns > 0 ? Math.round((totalConns / maxConns) * 100) : 0;

    let status: "online" | "warning" | "offline" = "online";
    if (connPercent > 90 || cacheRatio < 70) status = "warning";
    if (connPercent > 95) status = "offline";

    return {
      name: "Database",
      status,
      response_time: elapsed,
      details: {
        version,
        db_size: dbSize,
        connections: { total: totalConns, active: activeConns, idle: idleConns, max: maxConns, percent: connPercent },
        cache_hit_ratio: cacheRatio,
        table_count: tableCount,
        active_queries: (activeQueries as unknown[]).slice(0, 10),
      },
    };
  } catch (err) {
    return { name: "Database", status: "offline", response_time: Date.now() - start, error: err.message };
  }
}

// ─── Main handler ──────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("service_id");
    
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let config: Record<string, unknown> = {};
    if (serviceId) {
      const { data: svc } = await supabase.from("services").select("check_config").eq("id", serviceId).single();
      config = (svc?.check_config as Record<string, unknown>) || {};
    }

    // Get project URL and keys from config or env
    const projectUrl = (config.project_url as string || Deno.env.get("SUPABASE_URL"))!;
    const anonKey = (config.anon_key as string || Deno.env.get("SUPABASE_ANON_KEY") || "");
    const serviceRoleKey = (config.service_role_key as string || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"))!;
    const testFunction = config.test_function as string || "";

    // Run all checks in parallel
    const startAll = Date.now();
    const [restApi, auth, realtime, storage, edgeFns, database] = await Promise.all([
      checkRestApi(projectUrl, anonKey, serviceRoleKey),
      checkAuth(projectUrl, anonKey, serviceRoleKey),
      checkRealtime(projectUrl, anonKey, serviceRoleKey),
      checkStorage(projectUrl, anonKey, serviceRoleKey),
      checkEdgeFunctions(projectUrl, serviceRoleKey, testFunction),
      checkDatabase(projectUrl, serviceRoleKey),
    ]);
    const totalTime = Date.now() - startAll;

    const checks: SubCheck[] = [restApi, auth, realtime, storage, edgeFns, database];
    
    // Overall status: worst of all checks
    const hasOffline = checks.some(c => c.status === "offline");
    const hasWarning = checks.some(c => c.status === "warning");
    const overallStatus = hasOffline ? "offline" : hasWarning ? "warning" : "online";
    
    // Metrics: count by status
    const onlineCount = checks.filter(c => c.status === "online").length;
    const warningCount = checks.filter(c => c.status === "warning").length;
    const offlineCount = checks.filter(c => c.status === "offline").length;
    const avgLatency = Math.round(checks.reduce((sum, c) => sum + c.response_time, 0) / checks.length);

    // CPU = % of services healthy (inverted: 0% is good)
    // Memory = cache hit ratio from DB
    // Disk = connection % from DB
    const cacheHit = (database.details?.cache_hit_ratio as number) ?? 100;
    const connPercent = (database.details?.connections as Record<string, number>)?.percent ?? 0;

    const details = {
      project_url: projectUrl,
      checks,
      summary: {
        total: checks.length,
        online: onlineCount,
        warning: warningCount,
        offline: offlineCount,
      },
      database: database.details || {},
      avg_latency: avgLatency,
    };

    if (serviceId) {
      // Persist results
      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status: overallStatus,
        response_time: totalTime,
        cpu: Math.round((onlineCount / checks.length) * 100), // "health score"
        memory: Math.round(cacheHit * 100) / 100,
        disk: connPercent,
        error_message: hasOffline ? checks.filter(c => c.status === "offline").map(c => `${c.name}: ${c.error}`).join("; ") : null,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      // Save details in check_config
      const existingConfig = { ...config };
      existingConfig._supabase_details = details;

      await supabase.from("services").update({
        status: overallStatus,
        response_time: totalTime,
        cpu: Math.round((onlineCount / checks.length) * 100),
        memory: Math.round(cacheHit * 100) / 100,
        disk: connPercent,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: existingConfig,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({
      success: true,
      metrics: {
        status: overallStatus,
        response_time: totalTime,
        cpu: Math.round((onlineCount / checks.length) * 100),
        memory: Math.round(cacheHit * 100) / 100,
        disk: connPercent,
        error_message: hasOffline ? checks.filter(c => c.status === "offline").map(c => `${c.name}: ${c.error}`).join("; ") : null,
        details,
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("Supabase monitor error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
