import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${agentUrl}${endpoint}`, {
      signal: controller.signal,
      headers: fetchHeaders,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    const agentData = await res.json();
    const responseTime = Date.now() - start;

    // Expected: { containers: [{ name, image, status, state, cpu_percent, memory_percent, memory_mb, network_in_mb, network_out_mb, health }] }
    const containers = agentData.containers || [];
    const running = containers.filter((c: any) => c.state === "running").length;
    const stopped = containers.filter((c: any) => c.state === "exited" || c.state === "stopped").length;
    const unhealthy = containers.filter((c: any) => c.health === "unhealthy").length;

    const avgCpu = containers.length > 0
      ? containers.reduce((sum: number, c: any) => sum + (c.cpu_percent || 0), 0) / containers.length
      : 0;
    const avgMem = containers.length > 0
      ? containers.reduce((sum: number, c: any) => sum + (c.memory_percent || 0), 0) / containers.length
      : 0;

    let status: "online" | "warning" | "offline" = "online";
    if (unhealthy > 0 || (running === 0 && containers.length > 0)) status = "offline";
    else if (stopped > 0) status = "warning";

    const containerDetails = {
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
      })),
      summary: {
        total: containers.length,
        running,
        stopped,
        unhealthy,
      },
      avg_cpu: Math.round(avgCpu * 100) / 100,
      avg_memory: Math.round(avgMem * 100) / 100,
      agent_url: agentUrl,
    };

    if (serviceId) {
      const existingConfig = { ...config };
      existingConfig._container_details = containerDetails;

      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status,
        response_time: responseTime,
        cpu: Math.round(avgCpu * 100) / 100,
        memory: Math.round(avgMem * 100) / 100,
        error_message: unhealthy > 0 ? `${unhealthy} unhealthy container(s)` : null,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      await supabase.from("services").update({
        status,
        response_time: responseTime,
        cpu: Math.round(avgCpu * 100) / 100,
        memory: Math.round(avgMem * 100) / 100,
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
