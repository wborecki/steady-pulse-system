import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function collectMongoMetrics(config: Record<string, unknown>) {
  const { MongoClient } = await import("npm:mongodb@6");

  const uri = config.connection_string as string;
  if (!uri) throw new Error("MongoDB connection_string not configured");

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000, connectTimeoutMS: 10000 });
  const start = Date.now();
  await client.connect();
  const connectTime = Date.now() - start;

  try {
    const admin = client.db("admin");

    // Server status
    const serverStatus = await admin.command({ serverStatus: 1 });

    // DB stats
    const dbName = config.database as string || serverStatus.host?.split("/")[1] || "admin";
    const db = client.db(dbName);
    const dbStats = await db.command({ dbStats: 1 });

    // Current operations
    const currentOp = await admin.command({ currentOp: 1, active: true });

    const connections = serverStatus.connections || {};
    const mem = serverStatus.mem || {};
    const opcounters = serverStatus.opcounters || {};
    const network = serverStatus.network || {};

    const currentConns = connections.current || 0;
    const availConns = connections.available || 1;
    const connPercent = Math.round((currentConns / (currentConns + availConns)) * 100 * 100) / 100;

    const residentMem = mem.resident || 0; // MB
    const virtualMem = mem.virtual || 0;
    const memPercent = virtualMem > 0 ? Math.round((residentMem / virtualMem) * 100 * 100) / 100 : 0;

    const dataSize = dbStats.dataSize || 0;
    const storageSize = dbStats.storageSize || 1;
    const diskPercent = Math.round((dataSize / storageSize) * 100 * 100) / 100;

    // Fetch configurable rules
    const supabaseForRules = (await import("https://esm.sh/@supabase/supabase-js@2")).createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: ruleRow } = await supabaseForRules.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "mongodb").single();
    const wr = (ruleRow?.warning_rules ?? { connection_percent_gt: 80, memory_percent_gt: 90 }) as Record<string, number>;

    let status: "online" | "warning" | "offline" = "online";
    if (connPercent > (wr.connection_percent_gt ?? 80) || memPercent > (wr.memory_percent_gt ?? 90)) status = "warning";

    return {
      status,
      response_time: connectTime,
      cpu: connPercent,
      memory: memPercent,
      disk: diskPercent,
      details: {
        connections: { current: currentConns, available: availConns },
        memory: { resident_mb: residentMem, virtual_mb: virtualMem },
        opcounters,
        network: {
          bytes_in: network.bytesIn,
          bytes_out: network.bytesOut,
          num_requests: network.numRequests,
        },
        db_stats: {
          db: dbName,
          collections: dbStats.collections,
          objects: dbStats.objects,
          data_size_mb: Math.round(dataSize / 1024 / 1024),
          storage_size_mb: Math.round(storageSize / 1024 / 1024),
          indexes: dbStats.indexes,
        },
        active_operations: currentOp.inprog?.length || 0,
        uptime_seconds: serverStatus.uptime,
      },
      error_message: null,
    };
  } finally {
    await client.close();
  }
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

    const metrics = await collectMongoMetrics(config);

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

      // Persist _mongo_details in check_config (like Airflow does)
      const updatedConfig = { ...config, _mongo_details: metrics.details };

      await supabase.from("services").update({
        status: metrics.status,
        response_time: metrics.response_time,
        cpu: metrics.cpu,
        memory: metrics.memory,
        disk: metrics.disk,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: updatedConfig,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({ success: true, metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("MongoDB metrics error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
