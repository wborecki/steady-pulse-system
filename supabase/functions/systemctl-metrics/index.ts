import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function fetchAgentEndpoint(agentUrl: string, endpoint: string, token: string, method = "GET", body?: string, retries = 1): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const opts: RequestInit = { signal: controller.signal, headers, method };
      if (body) opts.body = body;

      const res = await fetch(`${agentUrl}${endpoint}`, opts);
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Agent returned ${res.status} for ${endpoint}`);
      return res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[systemctl-metrics] Attempt ${attempt + 1} failed for ${endpoint}, retrying...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("service_id");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let config: Record<string, unknown> = {};
    if (serviceId) {
      const { data: svc } = await supabase.from("services").select("check_config").eq("id", serviceId).single();
      config = (svc?.check_config as Record<string, unknown>) || {};
    }

    const agentUrl = config.agent_url as string;
    if (!agentUrl) throw new Error("agent_url not configured. Deploy the monitoring agent on your server.");

    const services = (config.services as string[]) || [];
    const endpoint = config.endpoint as string || "/systemctl";
    const token = config.token as string || "";

    const start = Date.now();

    // Fetch systemctl data and server metrics in parallel
    const [agentData, serverMetrics] = await Promise.all([
      fetchAgentEndpoint(agentUrl, endpoint, token, "POST", JSON.stringify({ services })),
      fetchAgentEndpoint(agentUrl, "/metrics", token).catch(() => null),
    ]);

    const responseTime = Date.now() - start;

    const units = agentData.units || agentData.services || [];
    const activeCount = units.filter((u: any) => u.active_state === "active").length;
    const failedCount = units.filter((u: any) => u.active_state === "failed").length;
    const inactiveCount = units.filter((u: any) => u.active_state === "inactive").length;

    // Fetch configurable rules
    const { data: ruleRow } = await supabase.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "systemctl").single();
    const wr = (ruleRow?.warning_rules ?? { inactive_gt: 0 }) as Record<string, number>;
    const or = (ruleRow?.offline_rules ?? { failed_gt: 0 }) as Record<string, number>;

    let status: "online" | "warning" | "offline" = "online";
    if (failedCount > (or.failed_gt ?? 0)) status = "offline";
    else if (inactiveCount > (wr.inactive_gt ?? 0)) status = "warning";

    const systemctlDetails: Record<string, unknown> = {
      units: units.map((u: any) => ({
        name: u.name || u.unit,
        active_state: u.active_state,
        sub_state: u.sub_state,
        pid: u.pid || u.main_pid,
        memory_mb: u.memory_bytes ? Math.round(u.memory_bytes / 1024 / 1024) : (u.memory_mb ?? null),
        uptime_seconds: u.uptime_seconds ?? null,
      })),
      summary: { total: units.length, active: activeCount, failed: failedCount, inactive: inactiveCount },
      agent_url: agentUrl,
    };

    // Attach server metrics if available
    if (serverMetrics) {
      systemctlDetails.server = {
        hostname: serverMetrics.hostname,
        cpu_percent: serverMetrics.cpu_percent,
        cpu_cores: serverMetrics.cpu_cores,
        memory: serverMetrics.memory,
        disks: serverMetrics.disks,
        load_average: serverMetrics.load_average,
      };
    }

    if (serviceId) {
      const existingConfig = { ...config };
      existingConfig._systemctl_details = systemctlDetails;

      const cpuVal = serverMetrics?.cpu_percent ?? activeCount;
      const memVal = serverMetrics?.memory?.percent ?? failedCount;
      const diskVal = serverMetrics?.disks?.find((d: any) => d.mount === "/")?.percent ?? serverMetrics?.disks?.[0]?.percent ?? inactiveCount;

      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status,
        response_time: responseTime,
        cpu: Math.round(cpuVal * 100) / 100,
        memory: Math.round(memVal * 100) / 100,
        disk: Math.round(diskVal * 100) / 100,
        error_message: failedCount > 0 ? `${failedCount} service(s) failed` : null,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      await supabase.from("services").update({
        status,
        response_time: responseTime,
        cpu: Math.round(cpuVal * 100) / 100,
        memory: Math.round(memVal * 100) / 100,
        disk: Math.round(diskVal * 100) / 100,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: existingConfig,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({
      success: true,
      metrics: { status, response_time: responseTime, cpu: activeCount, memory: failedCount, error_message: null, ...systemctlDetails },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Systemctl metrics error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
