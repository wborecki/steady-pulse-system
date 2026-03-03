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
  auth_type?: "jwt" | "basic";
  // Cached token fields (managed automatically)
  _cached_token?: string;
  _token_expires_at?: string; // ISO timestamp
}

async function getJwtToken(baseUrl: string, username: string, password: string): Promise<{ token: string; expiresAt: string }> {
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
  // Cache for 25 minutes (Airflow default token expiry is 30min)
  const expiresAt = new Date(Date.now() + 25 * 60 * 1000).toISOString();
  return { token: data.access_token, expiresAt };
}

function isTokenValid(config: AirflowConfig): boolean {
  if (!config._cached_token || !config._token_expires_at) return false;
  return new Date(config._token_expires_at) > new Date();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
async function getAuthHeader(config: AirflowConfig, supabase: any, serviceId: string | null): Promise<string> {
  const baseUrl = config.base_url.replace(/\/$/, "");

  if (config.auth_type === "basic") {
    return `Basic ${btoa(`${config.username}:${config.password}`)}`;
  }

  // JWT flow - check cache first
  if (isTokenValid(config)) {
    console.log("Using cached Airflow JWT token");
    return `Bearer ${config._cached_token}`;
  }

  // Token expired or not cached - get new one
  console.log("Obtaining new Airflow JWT token...");
  const { token, expiresAt } = await getJwtToken(baseUrl, config.username, config.password);

  // Persist cached token in check_config
  if (serviceId && supabase) {
    const { data: svc } = await supabase.from("services").select("check_config").eq("id", serviceId).single();
    const existingConfig = (svc?.check_config as Record<string, unknown>) || {};
    await supabase.from("services").update({
      check_config: { ...existingConfig, _cached_token: token, _token_expires_at: expiresAt },
    }).eq("id", serviceId);
  }

  return `Bearer ${token}`;
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

async function collectAirflowMetrics(config: AirflowConfig, authHeader: string) {
  const start = Date.now();
  const baseUrl = config.base_url.replace(/\/$/, "");

  // Detect API version: try v2 first (Airflow 3.x), fall back to v1 (Airflow 2.x)
  let apiPrefix = "/api/v2";
  try {
    await airflowFetch(baseUrl, `${apiPrefix}/dags?limit=1`, authHeader);
  } catch {
    apiPrefix = "/api/v1";
  }

  // 1. Health check
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

  // 3. Recent DAG Runs (last 50 for quick stats)
  let runs: any[] = [];
  try {
    const runsData = await airflowFetch(baseUrl, `${apiPrefix}/dags/~/dagRuns?limit=50&order_by=-start_date`, authHeader);
    runs = runsData.dag_runs || [];
  } catch { /* optional */ }
  const successRuns = runs.filter((r: any) => r.state === "success").length;
  const failedRuns = runs.filter((r: any) => r.state === "failed").length;
  const runningRuns = runs.filter((r: any) => r.state === "running").length;
  const successRate = runs.length > 0 ? Math.round((successRuns / runs.length) * 100) : 100;

  // 3b. Extended DAG Runs (last 7 days, up to 500) for daily stats chart
  let dailyStats: { date: string; success: number; failed: number; running: number }[] = [];
  let allRuns: any[] = [];
  try {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const extRunsData = await airflowFetch(baseUrl, `${apiPrefix}/dags/~/dagRuns?limit=500&order_by=-start_date&start_date_gte=${encodeURIComponent(sevenDaysAgo)}`, authHeader);
    allRuns = extRunsData.dag_runs || [];

    // Group by date
    const byDate: Record<string, { success: number; failed: number; running: number }> = {};
    for (const r of allRuns) {
      const date = (r.start_date || r.execution_date || "").substring(0, 10);
      if (!date) continue;
      if (!byDate[date]) byDate[date] = { success: 0, failed: 0, running: 0 };
      if (r.state === "success") byDate[date].success++;
      else if (r.state === "failed") byDate[date].failed++;
      else if (r.state === "running") byDate[date].running++;
    }
    dailyStats = Object.entries(byDate)
      .map(([date, counts]) => ({ date, ...counts }))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch { /* optional */ }

  // 3c. DAG details — individual DAG info + last run duration
  let dagsDetail: any[] = [];
  try {
    dagsDetail = dags.map((d: any) => ({
      dag_id: d.dag_id,
      is_paused: d.is_paused,
      owners: d.owners || [],
      schedule_interval: d.schedule_interval || d.timetable_description || null,
      next_dagrun: d.next_dagrun || null,
      file_token: d.file_token || null,
      tags: (d.tags || []).map((t: any) => t.name || t),
    }));
  } catch { /* optional */ }

  // 3d. DAG durations (from extended runs)
  let dagDurations: { dag_id: string; runs: { date: string; duration_seconds: number }[] }[] = [];
  try {
    const durationByDag: Record<string, { date: string; duration_seconds: number }[]> = {};
    for (const r of allRuns) {
      if (r.state !== "success" && r.state !== "failed") continue;
      const dagId = r.dag_id;
      const date = (r.start_date || r.execution_date || "").substring(0, 10);
      if (!date || !dagId) continue;

      let duration = 0;
      if (r.duration != null) {
        duration = Math.round(r.duration);
      } else if (r.start_date && r.end_date) {
        duration = Math.round((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 1000);
      }
      if (duration <= 0) continue;

      if (!durationByDag[dagId]) durationByDag[dagId] = [];
      durationByDag[dagId].push({ date, duration_seconds: duration });
    }
    dagDurations = Object.entries(durationByDag).map(([dag_id, runs]) => ({
      dag_id,
      runs: runs.sort((a, b) => a.date.localeCompare(b.date)).slice(-20), // last 20 runs per DAG
    }));
  } catch { /* optional */ }

  // 3e. Enrich dagsDetail with last run info
  try {
    const lastRunByDag: Record<string, any> = {};
    for (const r of allRuns) {
      if (!lastRunByDag[r.dag_id]) lastRunByDag[r.dag_id] = r;
    }
    dagsDetail = dagsDetail.map((d: any) => {
      const lastRun = lastRunByDag[d.dag_id];
      if (!lastRun) return d;
      let duration = 0;
      if (lastRun.duration != null) duration = Math.round(lastRun.duration);
      else if (lastRun.start_date && lastRun.end_date) duration = Math.round((new Date(lastRun.end_date).getTime() - new Date(lastRun.start_date).getTime()) / 1000);
      return {
        ...d,
        last_run_state: lastRun.state,
        last_run_date: lastRun.start_date || lastRun.execution_date,
        last_run_duration_seconds: duration,
      };
    });
  } catch { /* optional */ }

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

  // Determine status using configurable rules
  let status: "online" | "warning" | "offline" = "online";
  
  // Fetch rules from DB
  const supabaseForRules = (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ruleRow } = await supabaseForRules.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "airflow").single();
  const wr = (ruleRow?.warning_rules ?? {}) as Record<string, number>;
  const or = (ruleRow?.offline_rules ?? {}) as Record<string, unknown>;

  // Offline rules
  if ((or.scheduler_down && !schedulerOk) || (or.metadatabase_down && !metadatabaseOk)) status = "offline";
  // Warning rules (defaults: import_errors_gt=0, success_rate_lt=50, failed_runs_gt=10, failed_runs_success_rate_lt=70)
  else if (
    (wr.import_errors_gt !== undefined && importErrors > wr.import_errors_gt) ||
    (wr.success_rate_lt !== undefined && successRate < wr.success_rate_lt)
  ) status = "warning";
  else if (
    wr.failed_runs_gt !== undefined && wr.failed_runs_success_rate_lt !== undefined &&
    failedRuns > wr.failed_runs_gt && successRate < wr.failed_runs_success_rate_lt
  ) status = "warning";

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
      daily_stats: dailyStats,
      dags_detail: dagsDetail,
      dag_durations: dagDurations,
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
      _cached_token: config._cached_token as string | undefined,
      _token_expires_at: config._token_expires_at as string | undefined,
    };

    if (!airflowConfig.base_url || !airflowConfig.username || !airflowConfig.password) {
      throw new Error("Airflow config missing: base_url, username, or password");
    }

    // Get auth header (uses cache if available)
    const authHeader = await getAuthHeader(airflowConfig, supabase, serviceId);

    const metrics = await collectAirflowMetrics(airflowConfig, authHeader);

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

      // Persist airflow details in check_config for UI display
      const { data: svcCurrent } = await supabase.from("services").select("check_config").eq("id", serviceId).single();
      const existingConfig = (svcCurrent?.check_config as Record<string, unknown>) || {};

      await supabase.from("services").update({
        status: metrics.status,
        response_time: metrics.response_time,
        cpu: metrics.cpu,
        memory: metrics.memory,
        disk: metrics.disk,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: {
          ...existingConfig,
          _airflow_details: metrics.details,
          _last_metrics_at: new Date().toISOString(),
        },
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
