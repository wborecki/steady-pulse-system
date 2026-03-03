import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { agent_url, token } = await req.json();

    if (!agent_url) {
      return new Response(JSON.stringify({ error: "agent_url is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Fetch systemctl services and containers in parallel
    const [systemctlRes, containersRes] = await Promise.allSettled([
      fetch(`${agent_url}/systemctl/list`, { headers, signal: AbortSignal.timeout(15000) }),
      fetch(`${agent_url}/containers`, { headers, signal: AbortSignal.timeout(15000) }),
    ]);

    const systemctl_services =
      systemctlRes.status === "fulfilled" && systemctlRes.value.ok
        ? (await systemctlRes.value.json()).services || []
        : [];

    const containers =
      containersRes.status === "fulfilled" && containersRes.value.ok
        ? (await containersRes.value.json()).containers || []
        : [];

    return new Response(
      JSON.stringify({ systemctl_services, containers }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
