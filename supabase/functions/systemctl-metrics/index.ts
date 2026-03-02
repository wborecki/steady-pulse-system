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

    const services = (config.services as string[]) || [];
    const endpoint = config.endpoint as string || "/systemctl";

    const start = Date.now();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`${agentUrl}${endpoint}`, {
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      method: "POST",
      body: JSON.stringify({ services }),
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    const agentData = await res.json();
    const responseTime = Date.now() - start;

    // Expected agent response: { units: [{ name, active_state, sub_state, pid, memory_bytes, uptime_seconds }] }
    const units = agentData.units || agentData.services || [];
    const activeCount = units.filter((u: any) => u.active_state === "active").length;
    const failedCount = units.filter((u: any) => u.active_state === "failed").length;
    const inactiveCount = units.filter((u: any) => u.active_state === "inactive").length;

    let status: "online" | "warning" | "offline" = "online";
    if (failedCount > 0) status = "offline";
    else if (inactiveCount > 0) status = "warning";

    const systemctlDetails = {
      units: units.map((u: any) => ({
        name: u.name || u.unit,
        active_state: u.active_state,
        sub_state: u.sub_state,
        pid: u.pid || u.main_pid,
        memory_mb: u.memory_bytes ? Math.round(u.memory_bytes / 1024 / 1024) : (u.memory_mb ?? null),
        uptime_seconds: u.uptime_seconds ?? null,
      })),
      summary: {
        total: units.length,
        active: activeCount,
        failed: failedCount,
        inactive: inactiveCount,
      },
      agent_url: agentUrl,
    };

    if (serviceId) {
      const existingConfig = { ...config };
      existingConfig._systemctl_details = systemctlDetails;

      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status,
        response_time: responseTime,
        cpu: activeCount,
        memory: failedCount,
        error_message: failedCount > 0 ? `${failedCount} service(s) failed` : null,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      await supabase.from("services").update({
        status,
        response_time: responseTime,
        cpu: activeCount,
        memory: failedCount,
        disk: inactiveCount,
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
