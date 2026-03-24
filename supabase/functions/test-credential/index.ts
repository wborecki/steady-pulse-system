import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function ok(message: string, ms?: number) {
  return json({ success: true, message, response_time: ms });
}
function fail(message: string) {
  return json({ success: false, message });
}
function json(body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Test an agent (server/systemctl/container) credential by hitting /health */
async function testAgent(config: Record<string, unknown>): Promise<Response> {
  const url = (config.agent_url as string || "").replace(/\/$/, "");
  if (!url) return fail("agent_url não configurada");

  const headers: Record<string, string> = {};
  const token = config.token as string;
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  const start = Date.now();
  try {
    const res = await fetch(`${url}/health`, {
      headers,
      signal: controller.signal,
    });
    const ms = Date.now() - start;
    clearTimeout(timer);
    if (res.ok) {
      return ok(`Agente respondeu em ${ms}ms`, ms);
    }
    return fail(`Agente retornou status ${res.status}`);
  } catch (err) {
    clearTimeout(timer);
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("abort")) return fail("Timeout: agente não respondeu em 10s");
    return fail(`Erro de conexão: ${msg}`);
  }
}

/** Test a PostgreSQL credential via agent relay */
async function testPostgresqlViaAgent(
  agentUrl: string,
  agentToken: string,
  config: Record<string, unknown>,
): Promise<Response> {
  const url = agentUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (agentToken) headers["Authorization"] = `Bearer ${agentToken}`;

  const payload: Record<string, unknown> = {};
  if (config.connection_string) payload.connection_string = config.connection_string;
  if (config.host) payload.host = config.host;
  if (config.port) payload.port = config.port;
  if (config.database) payload.database = config.database;
  if (config.username) payload.username = config.username;
  if (config.password) payload.password = config.password;
  if (config.sslmode) payload.sslmode = config.sslmode;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const start = Date.now();
  try {
    const res = await fetch(`${url}/postgresql`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ms = Date.now() - start;
    const data = await res.json();
    if (data.success) return ok(`PostgreSQL via agente — conectado em ${ms}ms`, ms);
    return fail(`PostgreSQL via agente: ${data.error || data.message || "falha desconhecida"}`);
  } catch (err) {
    clearTimeout(timer);
    const msg = (err as Error).message || String(err);
    if (msg.includes("abort")) return fail("Timeout: agente não respondeu em 15s");
    return fail(`PostgreSQL via agente: ${msg}`);
  }
}

/** Test a PostgreSQL credential by connecting and running SELECT 1 */
async function testPostgresql(config: Record<string, unknown>, agentUrl?: string, agentToken?: string): Promise<Response> {
  // Prefer agent relay when available
  if (agentUrl) return testPostgresqlViaAgent(agentUrl, agentToken || "", config);

  const connStr = config.connection_string as string
    || buildPgConnStr(config);
  if (!connStr) return fail("connection_string ou host não configurado");

  const { default: pg } = await import("npm:pg@8");
  const client = new pg.Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000,
  });
  const start = Date.now();
  try {
    await client.connect();
    await client.query("SELECT 1");
    const ms = Date.now() - start;
    return ok(`PostgreSQL conectado em ${ms}ms`, ms);
  } catch (err) {
    const msg = (err as Error).message || "erro de conexão desconhecido";
    return fail(`PostgreSQL: ${msg}`);
  } finally {
    try { await client.end(); } catch { /* ignore */ }
  }
}

function buildPgConnStr(c: Record<string, unknown>): string {
  const host = c.host as string;
  if (!host) return "";
  const port = c.port || "5432";
  const db = c.database || "postgres";
  const user = c.username || "postgres";
  const pass = c.password ? `:${encodeURIComponent(c.password as string)}` : "";
  const ssl = c.ssl_mode || "prefer";
  return `postgresql://${user}${pass}@${host}:${port}/${db}?sslmode=${ssl}`;
}

/** Test a MongoDB credential by connecting and pinging */
async function testMongodb(config: Record<string, unknown>): Promise<Response> {
  const uri = config.connection_string as string;
  if (!uri) return fail("connection_string não configurada");

  const { MongoClient } = await import("npm:mongodb@6");
  const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
  });
  const start = Date.now();
  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });
    const ms = Date.now() - start;
    return ok(`MongoDB conectado em ${ms}ms`, ms);
  } catch (err) {
    return fail(`MongoDB: ${(err as Error).message}`);
  } finally {
    try { await client.close(); } catch { /* ignore */ }
  }
}

/** Test Azure SQL credential via agent relay */
async function testAzureSqlViaAgent(
  agentUrl: string,
  agentToken: string,
  config: Record<string, unknown>,
): Promise<Response> {
  const url = agentUrl.replace(/\/$/, "");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (agentToken) headers["Authorization"] = `Bearer ${agentToken}`;

  const payload: Record<string, unknown> = {
    host: ((config.host as string) || "").trim(),
    database: ((config.database as string) || "").trim(),
    username: ((config.username as string) || "").trim(),
    password: ((config.password as string) || "").trim(),
    port: config.port || 1433,
    encrypt: config.encrypt ?? true,
  };
  if (config.connection_string) payload.connection_string = config.connection_string;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  const start = Date.now();
  try {
    const res = await fetch(`${url}/mssql`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timer);
    const ms = Date.now() - start;
    const data = await res.json();
    if (data.success) return ok(`Azure SQL via agente — conectado em ${ms}ms`, ms);
    return fail(`Azure SQL via agente: ${data.error || data.message || "falha desconhecida"}`);
  } catch (err) {
    clearTimeout(timer);
    const msg = (err as Error).message || String(err);
    if (msg.includes("abort")) return fail("Timeout: agente não respondeu em 15s");
    return fail(`Azure SQL via agente: ${msg}`);
  }
}

/** Test Azure SQL credential */
async function testAzureSql(config: Record<string, unknown>, agentUrl?: string, agentToken?: string): Promise<Response> {
  // Prefer agent relay when available
  if (agentUrl) return testAzureSqlViaAgent(agentUrl, agentToken || "", config);

  const connStr = config.connection_string as string;
  if (!connStr && !config.host) return fail("connection_string ou host não configurado");

  // Use tedious via mssql
  const { default: mssql } = await import("npm:mssql@11");
  const start = Date.now();
  let pool: unknown = null;
  try {
    if (connStr) {
      pool = await mssql.connect(connStr);
    } else {
      pool = await mssql.connect({
        server: config.host as string,
        database: (config.database as string) || "master",
        user: config.username as string,
        password: config.password as string,
        options: { encrypt: true, trustServerCertificate: false },
        connectionTimeout: 10000,
      });
    }
    await (pool as { request: () => { query: (s: string) => Promise<unknown> } }).request().query("SELECT 1");
    const ms = Date.now() - start;
    return ok(`Azure SQL conectado em ${ms}ms`, ms);
  } catch (err) {
    const msg = (err as Error).message || "erro de conexão desconhecido";
    return fail(`Azure SQL: ${msg}`);
  } finally {
    try { if (pool) await (pool as { close: () => Promise<void> }).close(); } catch { /* ignore */ }
  }
}

/** Test AWS credentials by calling STS GetCallerIdentity */
async function testAws(config: Record<string, unknown>): Promise<Response> {
  const accessKey = config.access_key_id as string;
  const secretKey = config.secret_access_key as string;
  if (!accessKey || !secretKey) return fail("access_key_id e secret_access_key são obrigatórios");

  const region = (config.region as string) || "us-east-1";
  // Lightweight STS call
  const endpoint = `https://sts.${region}.amazonaws.com/`;
  const body = "Action=GetCallerIdentity&Version=2011-06-15";
  
  // AWS Signature V4 simplified — use fetch with unsigned request to check access
  // For a proper test, we use the AWS SDK
  try {
    const { STSClient, GetCallerIdentityCommand } = await import("npm:@aws-sdk/client-sts@3");
    const sts = new STSClient({
      region,
      credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    });
    const start = Date.now();
    const result = await sts.send(new GetCallerIdentityCommand({}));
    const ms = Date.now() - start;
    return ok(`AWS OK — Account: ${result.Account} (${ms}ms)`, ms);
  } catch (err) {
    return fail(`AWS: ${(err as Error).message}`);
  }
}

/** Test Airflow credentials by hitting the health endpoint */
async function testAirflow(config: Record<string, unknown>): Promise<Response> {
  const baseUrl = (config.base_url as string || "").replace(/\/$/, "");
  if (!baseUrl) return fail("base_url não configurada");

  const headers: Record<string, string> = {};
  const authType = config.auth_type as string || "basic";
  if (authType === "basic") {
    headers["Authorization"] = `Basic ${btoa(`${config.username}:${config.password}`)}`;
  } else {
    // Try JWT
    try {
      const tokenRes = await fetch(`${baseUrl}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: config.username, password: config.password }),
      });
      if (!tokenRes.ok) return fail(`Airflow auth falhou (${tokenRes.status})`);
      const tokenData = await tokenRes.json();
      headers["Authorization"] = `Bearer ${tokenData.access_token}`;
    } catch (err) {
      return fail(`Airflow auth: ${(err as Error).message}`);
    }
  }

  const start = Date.now();
  try {
    // Airflow 3.x removed /api/v1 — try v2 first, then fall back to v1
    const healthPaths = ["/api/v2/monitor/health", "/api/v1/health"];
    let lastStatus = 0;
    for (const path of healthPaths) {
      const res = await fetch(`${baseUrl}${path}`, { headers });
      if (res.ok) {
        const ms = Date.now() - start;
        return ok(`Airflow respondeu em ${ms}ms`, ms);
      }
      lastStatus = res.status;
      // If it's not 404/405/410, no point trying fallback
      if (![404, 405, 410].includes(res.status)) {
        return fail(`Airflow retornou status ${res.status}`);
      }
    }
    return fail(`Airflow retornou status ${lastStatus}`);
  } catch (err) {
    return fail(`Airflow: ${(err as Error).message}`);
  }
}

/** Test Supabase credential by hitting the REST API */
async function testSupabase(config: Record<string, unknown>): Promise<Response> {
  const url = (config.project_url as string || "").replace(/\/$/, "");
  const anonKey = config.anon_key as string;
  if (!url || !anonKey) return fail("project_url e anon_key são obrigatórios");

  const start = Date.now();
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    });
    const ms = Date.now() - start;
    if (res.ok || res.status === 200) return ok(`Supabase REST OK (${ms}ms)`, ms);
    return fail(`Supabase retornou status ${res.status}`);
  } catch (err) {
    return fail(`Supabase: ${(err as Error).message}`);
  }
}

/** Test HTTP Auth by fetching a URL or just validating the config */
async function testHttpAuth(config: Record<string, unknown>): Promise<Response> {
  // HTTP Auth credentials don't have a URL to test — just validate config
  const authType = config.auth_type as string;
  if (!authType) return fail("auth_type não configurado");
  if (authType === "basic" && !config.username) return fail("username é obrigatório para Basic auth");
  if (authType === "bearer" && !config.token) return fail("token é obrigatório para Bearer auth");
  return ok("Configuração HTTP Auth válida");
}

/** Test SSH by just validating fields (no actual SSH connection from Edge Function) */
async function testSsh(config: Record<string, unknown>): Promise<Response> {
  if (!config.host) return fail("host é obrigatório");
  if (!config.username) return fail("username é obrigatório");
  if (!config.password && !config.private_key) return fail("password ou private_key é obrigatório");
  return ok("Configuração SSH válida");
}

// ── Main handler ──────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return fail("Não autenticado");

    const body = await req.json();
    const credentialId = body.credential_id as string | undefined;
    const rawConfig = body.config as Record<string, unknown> | undefined;
    const credType = body.credential_type as string | undefined;

    let config: Record<string, unknown>;
    let type: string;
    const explicitAgentUrl = body.agent_url as string | undefined;
    const explicitAgentToken = body.agent_token as string | undefined;

    if (credentialId) {
      // Test a saved credential by ID
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: cred, error } = await adminClient
        .from("credentials")
        .select("credential_type, config, name")
        .eq("id", credentialId)
        .single();
      if (error || !cred) return fail("Credencial não encontrada");
      config = cred.config as Record<string, unknown>;
      type = cred.credential_type;
    } else if (rawConfig && credType) {
      // Test unsaved config inline (for create/edit dialog)
      config = rawConfig;
      type = credType;
    } else {
      return fail("credential_id ou (config + credential_type) são obrigatórios");
    }

    // For DB types, resolve agent for relay (explicit > auto-detect)
    let agentUrl = explicitAgentUrl || "";
    let agentToken = explicitAgentToken || "";
    if (!agentUrl && (type === "postgresql" || type === "azure_sql" || type === "sql_server")) {
      // Auto-detect: find an agent credential for the same user
      const adminClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const { data: agents } = await adminClient
        .from("credentials")
        .select("config")
        .eq("user_id", user.id)
        .eq("credential_type", "agent")
        .limit(1);
      if (agents && agents.length > 0) {
        const ac = agents[0].config as Record<string, string>;
        agentUrl = ac.agent_url || "";
        agentToken = ac.token || "";
      }
    }

    switch (type) {
      case "agent":      return testAgent(config);
      case "postgresql":  return testPostgresql(config, agentUrl || undefined, agentToken || undefined);
      case "mongodb":     return testMongodb(config);
      case "azure_sql":   return testAzureSql(config, agentUrl || undefined, agentToken || undefined);
      case "sql_server":  return testAzureSql(config, agentUrl || undefined, agentToken || undefined);
      case "aws":         return testAws(config);
      case "airflow":     return testAirflow(config);
      case "supabase":    return testSupabase(config);
      case "http_auth":   return testHttpAuth(config);
      case "ssh":         return testSsh(config);
      default:            return fail(`Tipo de credencial '${type}' não suportado para teste`);
    }
  } catch (err) {
    return fail(`Erro: ${(err as Error).message}`);
  }
});
