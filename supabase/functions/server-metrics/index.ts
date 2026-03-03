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

    const fetchWithRetry = async (url: string, opts: RequestInit, retries = 1): Promise<Response> => {
      for (let attempt = 0; attempt <= retries; attempt++) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15000);
          const res = await fetch(url, { ...opts, signal: controller.signal });
          clearTimeout(timeout);
          return res;
        } catch (err) {
          if (attempt === retries) throw err;
          console.warn(`[server-metrics] Attempt ${attempt + 1} failed, retrying...`);
          await new Promise(r => setTimeout(r, 2000));
        }
      }
      throw new Error("Unreachable");
    };

    const start = Date.now();
    const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;

    const res = await fetchWithRetry(`${agentUrl}/metrics`, { headers: fetchHeaders });

    if (!res.ok) throw new Error(`Agent returned ${res.status}`);
    const agentData = await res.json();
    const responseTime = Date.now() - start;

    // Expected: { cpu_percent, cpu_cores, memory: { total_mb, used_mb, available_mb, percent }, disks: [...], load_average: { load_1, load_5, load_15 }, hostname }
    const cpuPercent = agentData.cpu_percent || 0;
    const memPercent = agentData.memory?.percent || 0;

    // Disk: use the root mount or the one with highest usage
    const disks = agentData.disks || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rootDisk = disks.find((d: any) => d.mount === "/") || disks[0];
    const diskPercent = rootDisk?.percent || 0;

    // Fetch configurable rules
    const { data: ruleRow } = await supabase.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "server").single();
    const wr = (ruleRow?.warning_rules ?? { cpu_gt: 80, memory_gt: 80, disk_gt: 80 }) as Record<string, number>;
    const or = (ruleRow?.offline_rules ?? { cpu_gt: 95, memory_gt: 95, disk_gt: 95 }) as Record<string, number>;

    let status: "online" | "warning" | "offline" = "online";
    if (cpuPercent > (or.cpu_gt ?? 95) || memPercent > (or.memory_gt ?? 95) || diskPercent > (or.disk_gt ?? 95)) status = "offline";
    else if (cpuPercent > (wr.cpu_gt ?? 80) || memPercent > (wr.memory_gt ?? 80) || diskPercent > (wr.disk_gt ?? 80)) status = "warning";

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
