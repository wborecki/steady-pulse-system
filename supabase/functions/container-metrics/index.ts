import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAgentEndpoint(agentUrl: string, endpoint: string, token: string, retries = 1): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`${agentUrl}${endpoint}`, { signal: controller.signal, headers });
      clearTimeout(timeout);
      if (!res.ok) throw new Error(`Agent returned ${res.status} for ${endpoint}`);
      return res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`[container-metrics] Attempt ${attempt + 1} failed for ${endpoint}, retrying...`);
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

    const endpoint = config.endpoint as string || "/containers";
    const token = config.token as string || "";

    const start = Date.now();

    // Fetch container data and server metrics in parallel
    const [agentData, serverMetrics] = await Promise.all([
      fetchAgentEndpoint(agentUrl, endpoint, token),
      fetchAgentEndpoint(agentUrl, "/metrics", token).catch(() => null),
    ]);

    const responseTime = Date.now() - start;

    const containers = agentData.containers || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const running = containers.filter((c: any) => c.state === "running").length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stopped = containers.filter((c: any) => c.state === "exited" || c.state === "stopped").length;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unhealthy = containers.filter((c: any) => c.health === "unhealthy").length;

    const avgCpu = containers.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? containers.reduce((sum: number, c: any) => sum + (c.cpu_percent || 0), 0) / containers.length
      : 0;
    const avgMem = containers.length > 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? containers.reduce((sum: number, c: any) => sum + (c.memory_percent || 0), 0) / containers.length
      : 0;

    // Fetch configurable rules
    const { data: ruleRow } = await supabase.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "container").single();
    const wr = (ruleRow?.warning_rules ?? { stopped_gt: 0 }) as Record<string, number>;
    const or = (ruleRow?.offline_rules ?? {}) as Record<string, unknown>;

    let status: "online" | "warning" | "offline" = "online";
    if ((or.unhealthy_gt !== undefined && unhealthy > (or.unhealthy_gt as number)) || (or.running_zero && running === 0 && containers.length > 0)) status = "offline";
    else if (wr.stopped_gt !== undefined && stopped > wr.stopped_gt) status = "warning";

    const containerDetails: Record<string, unknown> = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      containers: containers.map((c: any) => ({
        name: c.name,
        image: c.image,
        status: c.status,
        state: c.state,
        health: c.health || null,
        cpu_percent: Math.round((c.cpu_percent || 0) * 100) / 100,
        memory_percent: Math.round((c.memory_percent || 0) * 100) / 100,
        memory_mb: c.memory_mb ?? null,
        network_in_mb: c.network_in_mb ?? null,
        network_out_mb: c.network_out_mb ?? null,
        restart_count: c.restart_count ?? 0,
        created: c.created ?? null,
      })),
      summary: { total: containers.length, running, stopped, unhealthy },
      avg_cpu: Math.round(avgCpu * 100) / 100,
      avg_memory: Math.round(avgMem * 100) / 100,
      agent_url: agentUrl,
    };

    // Attach server metrics if available
    if (serverMetrics) {
      containerDetails.server = {
        hostname: serverMetrics.hostname,
        cpu_percent: serverMetrics.cpu_percent,
        cpu_cores: serverMetrics.cpu_cores,
        memory: serverMetrics.memory,
        swap: serverMetrics.swap || null,
        disks: serverMetrics.disks,
        load_average: serverMetrics.load_average,
        network: serverMetrics.network || [],
        uptime_seconds: serverMetrics.uptime_seconds || 0,
      };
    }

    if (serviceId) {
      const existingConfig = { ...config };
      existingConfig._container_details = containerDetails;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const diskVal = serverMetrics?.disks?.find((d: any) => d.mount === "/")?.percent ?? serverMetrics?.disks?.[0]?.percent ?? 0;

      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status,
        response_time: responseTime,
        cpu: Math.round(avgCpu * 100) / 100,
        memory: Math.round(avgMem * 100) / 100,
        disk: Math.round(diskVal * 100) / 100,
        error_message: unhealthy > 0 ? `${unhealthy} unhealthy container(s)` : null,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      await supabase.from("services").update({
        status,
        response_time: responseTime,
        cpu: Math.round(avgCpu * 100) / 100,
        memory: Math.round(avgMem * 100) / 100,
        disk: Math.round(diskVal * 100) / 100,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: existingConfig,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({
      success: true,
      metrics: { status, response_time: responseTime, cpu: avgCpu, memory: avgMem, error_message: null, ...containerDetails },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Container metrics error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
