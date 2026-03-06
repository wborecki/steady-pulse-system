import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Authenticate the caller (must be logged in)
    const authHeader = req.headers.get("authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ success: false, error: "Não autenticado. Faça login novamente.", exit_code: -1, stdout: "", stderr: "" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const serviceId = body.service_id as string | undefined;
    const credentialId = body.credential_id as string | undefined;
    const command = (body.command as string || "").trim();
    const timeout = Math.min(Math.max(Number(body.timeout) || 30, 1), 60);

    if ((!serviceId && !credentialId) || !command) {
      return new Response(JSON.stringify({ success: false, error: "service_id ou credential_id + command são obrigatórios", exit_code: -1, stdout: "", stderr: "" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve agent credentials from service config or directly from credential
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let agentUrl = "";
    let token = "";
    let allowedIPs = "";
    let targetName = "";

    if (credentialId) {
      // Direct credential mode — no service needed
      const { data: cred, error: credError } = await adminClient
        .from("credentials")
        .select("name, config")
        .eq("id", credentialId)
        .single();
      if (credError || !cred) {
        return new Response(JSON.stringify({ success: false, error: "Credencial não encontrada", exit_code: -1, stdout: "", stderr: "" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const credConfig = cred.config as Record<string, unknown>;
      agentUrl = credConfig.agent_url as string || "";
      token = credConfig.token as string || "";
      allowedIPs = (credConfig.allowed_ips as string || "").trim();
      targetName = cred.name as string;
    } else {
      // Service mode — resolve from service + optional credential
      const { data: svc, error: svcError } = await adminClient
        .from("services")
        .select("check_config, check_type, name")
        .eq("id", serviceId as string)
        .single();

      if (svcError || !svc) {
        return new Response(JSON.stringify({ success: false, error: "Serviço não encontrado", exit_code: -1, stdout: "", stderr: "" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const config = (svc.check_config as Record<string, unknown>) || {};
      agentUrl = config.agent_url as string || "";
      token = config.token as string || "";
      targetName = svc.name as string;

      if (config.credential_id) {
        const { data: cred } = await adminClient
          .from("credentials")
          .select("config")
          .eq("id", config.credential_id as string)
          .single();
        if (cred) {
          const credConfig = cred.config as Record<string, unknown>;
          agentUrl = credConfig.agent_url as string || agentUrl;
          token = credConfig.token as string || token;
          allowedIPs = (credConfig.allowed_ips as string || "").trim();
        }
      }
    }

    if (!agentUrl) {
      return new Response(JSON.stringify({ success: false, error: "Este serviço não tem agente configurado. Acesse Serviços > Editar e configure um agente.", exit_code: -1, stdout: "", stderr: "" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Normalize URL — remove trailing slash
    agentUrl = agentUrl.replace(/\/+$/, "");

    // IP allowlist check — uses IPs configured in the credential panel
    if (allowedIPs) {
      const clientIP = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim()
        || req.headers.get("x-real-ip")
        || "";

      const allowed = allowedIPs.split(",").map((s: string) => s.trim()).filter(Boolean);

      const ipInList = allowed.some((entry: string) => {
        if (entry.includes("/")) {
          // CIDR match
          try {
            const [subnet, bits] = entry.split("/");
            const mask = ~(2 ** (32 - Number(bits)) - 1) >>> 0;
            const subnetNum = subnet.split(".").reduce((a: number, o: string) => (a << 8) + Number(o), 0) >>> 0;
            const ipNum = clientIP.split(".").reduce((a: number, o: string) => (a << 8) + Number(o), 0) >>> 0;
            return (subnetNum & mask) === (ipNum & mask);
          } catch { return false; }
        }
        return entry === clientIP;
      });

      if (!ipInList) {
        console.log(`[remote-exec] IP BLOCKED user=${user.email} ip=${clientIP} allowed=${allowedIPs}`);
        return new Response(JSON.stringify({
          success: false,
          error: `Seu IP (${clientIP || "desconhecido"}) não está na lista de IPs permitidos para este agente. Vá em Configurações > Segurança para adicionar seu IP.`,
          exit_code: -1, stdout: "", stderr: "",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Send exec request to agent
    const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (token) fetchHeaders["Authorization"] = `Bearer ${token}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), (timeout + 5) * 1000);

    const agentRes = await fetch(`${agentUrl}/exec`, {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify({ command, timeout }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    let result: Record<string, unknown>;
    try {
      result = await agentRes.json();
    } catch {
      result = { success: false, error: `Agente retornou status ${agentRes.status} sem JSON válido`, exit_code: -1, stdout: "", stderr: "" };
    }

    // Ensure result always has the required fields
    if (result.success === undefined) result.success = false;
    if (result.exit_code === undefined) result.exit_code = -1;
    if (result.stdout === undefined) result.stdout = "";
    if (result.stderr === undefined) result.stderr = "";

    if (!agentRes.ok) {
      if (agentRes.status === 404) {
        result.error = "Rota /exec não encontrada no agente. O agente pode estar desatualizado — atualize para a versão mais recente (v2.5.0+).";
      } else if (agentRes.status === 401) {
        result.error = "Agente rejeitou a autenticação (401 Unauthorized). Verifique se o token da credencial está correto.";
      } else if (!result.error) {
        result.error = `Agente retornou status ${agentRes.status}`;
      }
      result.success = false;
    }

    // Log the execution for audit
    console.log(`[remote-exec] user=${user.email} target=${targetName} command=${command} success=${result.success}`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    const isTimeout = message.includes("abort") || message.includes("timeout");
    return new Response(JSON.stringify({
      success: false,
      error: isTimeout ? "Timeout: agente não respondeu a tempo. Verifique se o agente está online." : `Erro de conexão com o agente: ${message}`,
      exit_code: -1,
      stdout: "",
      stderr: "",
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
