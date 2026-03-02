import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AirflowConfig {
  base_url: string;
  username: string;
  password: string;
  auth_type?: "jwt" | "basic"; // default jwt for Airflow 3.x
}

async function getJwtToken(baseUrl: string, username: string, password: string): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, "")}/auth/token`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Failed to get Airflow JWT token (${res.status}): ${body}`);
  }
  const data = await res.json();
  return data.access_token;
}

async function airflowFetch(baseUrl: string, path: string, authHeader: string) {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  const res = await fetch(url, {
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    signal: controller.signal,
  });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`Airflow API ${path} returned ${res.status}`);
  return res.json();
}

async function collectAirflowMetrics(config: AirflowConfig) {
  const start = Date.now();
  const baseUrl = config.base_url.replace(/\/$/, "");
  const authType = config.auth_type || "jwt";

  // Get auth header
  let authHeader: string;
  if (authType === "basic") {
    authHeader = `Basic ${btoa(`${config.username}:${config.password}`)}`;
  } else {
    const token = await getJwtToken(baseUrl, config.username, config.password);
    authHeader = `Bearer ${token}`;
  }

  // Detect API version: try v2 first (Airflow 3.x), fall back to v1 (Airflow 2.x)
  let apiPrefix = "/api/v2";
  try {
    await airflowFetch(baseUrl, `${apiPrefix}/dags?limit=1`, authHeader);
  } catch {
    apiPrefix = "/api/v1";
  }

  // 1. Health check (no API prefix, works on both versions)
  let health: any = {};
  try {
    health = await airflowFetch(baseUrl, `${apiPrefix}/monitor/health`, authHeader);
  } catch {
    try {
      health = await airflowFetch(baseUrl, "/api/v1/health", authHeader);
    } catch {
      try {
        health = await airflowFetch(baseUrl, "/health", authHeader);
      } catch { /* health endpoint not available */ }
    }
  }
  const responseTime = Date.now() - start;

  const schedulerOk = health.scheduler?.status === "healthy";
  const metadatabaseOk = health.metadatabase?.status === "healthy";

  // 2. DAGs
  const dagsData = await airflowFetch(baseUrl, `${apiPrefix}/dags?limit=1000`, authHeader);
  const dags = dagsData.dags || [];
  const totalDags = dags.length;
  const activeDags = dags.filter((d: any) => !d.is_paused).length;
  const pausedDags = dags.filter((d: any) => d.is_paused).length;

  // 3. Recent DAG Runs
  let runs: any[] = [];
  try {
    const runsData = await airflowFetch(baseUrl, `${apiPrefix}/dags/~/dagRuns?limit=50&order_by=-start_date`, authHeader);
    runs = runsData.dag_runs || [];
  } catch {
    // Some versions may not support ~/dagRuns
  }
  const successRuns = runs.filter((r: any) => r.state === "success").length;
  const failedRuns = runs.filter((r: any) => r.state === "failed").length;
  const runningRuns = runs.filter((r: any) => r.state === "running").length;
  const successRate = runs.length > 0 ? Math.round((successRuns / runs.length) * 100) : 100;

  // 4. Import errors
  let importErrors = 0;
  try {
    const errData = await airflowFetch(baseUrl, `${apiPrefix}/importErrors`, authHeader);
    importErrors = errData.total_entries || 0;
  } catch { /* optional */ }

  // 5. Pools
  let poolUtilization = 0;
  try {
    const poolData = await airflowFetch(baseUrl, `${apiPrefix}/pools`, authHeader);
    const pools = poolData.pools || [];
    if (pools.length > 0) {
      const totalSlots = pools.reduce((a: number, p: any) => a + (p.slots || 0), 0);
      const usedSlots = pools.reduce((a: number, p: any) => a + (p.occupied_slots || 0), 0);
      poolUtilization = totalSlots > 0 ? Math.round((usedSlots / totalSlots) * 100) : 0;
    }
  } catch { /* optional */ }

  // Determine status
  let status: "online" | "warning" | "offline" = "online";
  if (!schedulerOk || !metadatabaseOk) status = "offline";
  else if (failedRuns > 5 || importErrors > 0 || successRate < 80) status = "warning";

  return {
    status,
    response_time: responseTime,
    cpu: poolUtilization,
    memory: successRate,
    disk: 0,
    details: {
      api_version: apiPrefix,
      scheduler: health.scheduler || null,
      metadatabase: health.metadatabase || null,
      triggerer: health.triggerer || null,
      dags: { total: totalDags, active: activeDags, paused: pausedDags },
      recent_runs: { total: runs.length, success: successRuns, failed: failedRuns, running: runningRuns, success_rate: successRate },
      import_errors: importErrors,
      pool_utilization: poolUtilization,
    },
    error_message: null,
  };
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

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.config) config = { ...config, ...body.config };
      } catch { /* no body */ }
    }

    const airflowConfig: AirflowConfig = {
      base_url: config.base_url as string,
      username: config.username as string,
      password: config.password as string,
      auth_type: (config.auth_type as "jwt" | "basic") || "jwt",
    };

    if (!airflowConfig.base_url || !airflowConfig.username || !airflowConfig.password) {
      throw new Error("Airflow config missing: base_url, username, or password");
    }

    const metrics = await collectAirflowMetrics(airflowConfig);

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

      await supabase.from("services").update({
        status: metrics.status,
        response_time: metrics.response_time,
        cpu: metrics.cpu,
        memory: metrics.memory,
        disk: metrics.disk,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({ success: true, metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Airflow metrics error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
