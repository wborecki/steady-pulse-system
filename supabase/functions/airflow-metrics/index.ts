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
}

async function airflowFetch(config: AirflowConfig, path: string) {
  const url = `${config.base_url.replace(/\/$/, "")}/api/v1${path}`;
  const headers = {
    Authorization: `Basic ${btoa(`${config.username}:${config.password}`)}`,
    "Content-Type": "application/json",
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  const res = await fetch(url, { headers, signal: controller.signal });
  clearTimeout(timeout);
  if (!res.ok) throw new Error(`Airflow API ${path} returned ${res.status}`);
  return res.json();
}

async function collectAirflowMetrics(config: AirflowConfig) {
  const start = Date.now();

  // 1. Health check
  const health = await airflowFetch(config, "/health");
  const responseTime = Date.now() - start;

  const schedulerOk = health.scheduler?.status === "healthy";
  const metadatabaseOk = health.metadatabase?.status === "healthy";
  const triggererStatus = health.triggerer?.status;

  // 2. DAGs summary
  const dagsData = await airflowFetch(config, "/dags?limit=1000&only_active=false");
  const dags = dagsData.dags || [];
  const totalDags = dags.length;
  const activeDags = dags.filter((d: any) => !d.is_paused).length;
  const pausedDags = dags.filter((d: any) => d.is_paused).length;

  // 3. Recent DAG Runs (last 50)
  const runsData = await airflowFetch(config, "/dags/~/dagRuns?limit=50&order_by=-start_date");
  const runs = runsData.dag_runs || [];
  const successRuns = runs.filter((r: any) => r.state === "success").length;
  const failedRuns = runs.filter((r: any) => r.state === "failed").length;
  const runningRuns = runs.filter((r: any) => r.state === "running").length;
  const successRate = runs.length > 0 ? Math.round((successRuns / runs.length) * 100) : 100;

  // 4. Import errors
  let importErrors = 0;
  try {
    const errData = await airflowFetch(config, "/importErrors");
    importErrors = errData.total_entries || 0;
  } catch { /* optional endpoint */ }

  // 5. Pools
  let poolUtilization = 0;
  try {
    const poolData = await airflowFetch(config, "/pools");
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
    cpu: poolUtilization, // pool usage as CPU analog
    memory: successRate, // success rate as memory analog
    disk: 0,
    details: {
      scheduler: health.scheduler,
      metadatabase: health.metadatabase,
      triggerer: triggererStatus || null,
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
