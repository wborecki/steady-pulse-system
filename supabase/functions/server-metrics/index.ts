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

    const token = config.token as string || "";

    const start = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;

    const res = await fetch(`${agentUrl}/metrics`, {
      signal: controller.signal,
      headers: fetchHeaders,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    const agentData = await res.json();
    const responseTime = Date.now() - start;

    // Expected: { cpu_percent, cpu_cores, memory: { total_mb, used_mb, available_mb, percent }, disks: [...], load_average: { load_1, load_5, load_15 }, hostname }
    const cpuPercent = agentData.cpu_percent || 0;
    const memPercent = agentData.memory?.percent || 0;

    // Disk: use the root mount or the one with highest usage
    const disks = agentData.disks || [];
    const rootDisk = disks.find((d: any) => d.mount === "/") || disks[0];
    const diskPercent = rootDisk?.percent || 0;

    let status: "online" | "warning" | "offline" = "online";
    if (cpuPercent > 95 || memPercent > 95 || diskPercent > 95) status = "offline";
    else if (cpuPercent > 80 || memPercent > 80 || diskPercent > 80) status = "warning";

    const serverDetails = {
      hostname: agentData.hostname,
      cpu_percent: cpuPercent,
      cpu_cores: agentData.cpu_cores,
      memory: agentData.memory,
      disks,
      load_average: agentData.load_average,
      agent_url: agentUrl,
    };

    if (serviceId) {
      const existingConfig = { ...config };
      existingConfig._server_details = serverDetails;

      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status,
        response_time: responseTime,
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: Math.round(memPercent * 100) / 100,
        disk: Math.round(diskPercent * 100) / 100,
        error_message: null,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      await supabase.from("services").update({
        status,
        response_time: responseTime,
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: Math.round(memPercent * 100) / 100,
        disk: Math.round(diskPercent * 100) / 100,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: existingConfig,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({
      success: true,
      metrics: { status, response_time: responseTime, ...serverDetails },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Server metrics error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
