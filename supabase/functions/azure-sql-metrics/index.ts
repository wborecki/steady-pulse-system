import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import sql from "npm:mssql@11";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface MetricsResult {
  cpu_percent: number;
  memory_percent: number;
  storage_percent: number;
  active_connections: number;
  avg_response_time: number;
  status: "online" | "offline" | "warning";
  details: Record<string, unknown>;
  error_message: string | null;
}

async function collectMetrics(): Promise<MetricsResult> {
  const host = Deno.env.get("AZURE_SQL_HOST");
  const database = Deno.env.get("AZURE_SQL_DATABASE");
  const user = Deno.env.get("AZURE_SQL_USER");
  const password = Deno.env.get("AZURE_SQL_PASSWORD");

  if (!host || !database || !user || !password) {
    throw new Error("Azure SQL credentials not configured");
  }

  const config: sql.config = {
    server: host,
    database,
    user,
    password,
    options: {
      encrypt: true,
      trustServerCertificate: false,
    },
    connectionTimeout: 15000,
    requestTimeout: 15000,
  };

  const pool = await sql.connect(config);

  try {
    // 1. Resource stats (CPU, Memory, I/O) - last 1 minute
    const resourceStats = await pool.request().query(`
      SELECT TOP 1
        avg_cpu_percent,
        avg_data_io_percent,
        avg_log_write_percent,
        avg_memory_usage_percent,
        max_worker_percent,
        max_session_percent
      FROM sys.dm_db_resource_stats
      ORDER BY end_time DESC
    `);

    // 2. Database size / space usage
    const sizeStats = await pool.request().query(`
      SELECT
        SUM(CAST(FILEPROPERTY(name, 'SpaceUsed') AS BIGINT) * 8 / 1024) AS used_mb,
        SUM(size * 8 / 1024) AS allocated_mb
      FROM sys.database_files
      WHERE type_desc = 'ROWS'
    `);

    // 3. Active connections
    const connStats = await pool.request().query(`
      SELECT COUNT(*) AS active_connections
      FROM sys.dm_exec_sessions
      WHERE is_user_process = 1
        AND status = 'running'
    `);

    // 4. Total sessions
    const sessionStats = await pool.request().query(`
      SELECT COUNT(*) AS total_sessions
      FROM sys.dm_exec_sessions
      WHERE is_user_process = 1
    `);

    // 5. Top wait stats
    const waitStats = await pool.request().query(`
      SELECT TOP 5
        wait_type,
        waiting_tasks_count,
        wait_time_ms
      FROM sys.dm_os_wait_stats
      WHERE waiting_tasks_count > 0
        AND wait_type NOT LIKE '%SLEEP%'
        AND wait_type NOT LIKE '%IDLE%'
        AND wait_type NOT LIKE '%QUEUE%'
        AND wait_type NOT LIKE 'BROKER%'
        AND wait_type NOT LIKE 'XE%'
        AND wait_type NOT LIKE 'WAITFOR'
      ORDER BY wait_time_ms DESC
    `);

    const resource = resourceStats.recordset[0] || {};
    const size = sizeStats.recordset[0] || {};
    const conns = connStats.recordset[0] || {};
    const sessions = sessionStats.recordset[0] || {};

    const cpuPercent = resource.avg_cpu_percent ?? 0;
    const memoryPercent = resource.avg_memory_usage_percent ?? 0;
    const storagePercent =
      size.allocated_mb > 0
        ? Math.round((size.used_mb / size.allocated_mb) * 100 * 100) / 100
        : 0;

    // Determine status
    let status: "online" | "offline" | "warning" = "online";
    if (cpuPercent > 90 || memoryPercent > 90 || storagePercent > 95) {
      status = "warning";
    }

    return {
      cpu_percent: Math.round(cpuPercent * 100) / 100,
      memory_percent: Math.round(memoryPercent * 100) / 100,
      storage_percent: storagePercent,
      active_connections: conns.active_connections ?? 0,
      avg_response_time: 0, // will be calculated from connection time
      status,
      details: {
        avg_data_io_percent: resource.avg_data_io_percent ?? 0,
        avg_log_write_percent: resource.avg_log_write_percent ?? 0,
        max_worker_percent: resource.max_worker_percent ?? 0,
        max_session_percent: resource.max_session_percent ?? 0,
        used_mb: size.used_mb ?? 0,
        allocated_mb: size.allocated_mb ?? 0,
        total_sessions: sessions.total_sessions ?? 0,
        active_connections: conns.active_connections ?? 0,
        top_waits: waitStats.recordset || [],
      },
      error_message: null,
    };
  } finally {
    await pool.close();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const serviceId = url.searchParams.get("service_id");

    const start = Date.now();
    const metrics = await collectMetrics();
    const responseTime = Date.now() - start;
    metrics.avg_response_time = responseTime;

    // Save to Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (serviceId) {
      // Save health check with real metrics
      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status: metrics.status,
        response_time: responseTime,
        cpu: metrics.cpu_percent,
        memory: metrics.memory_percent,
        disk: metrics.storage_percent,
        error_message: metrics.error_message,
      });

      // Calculate uptime
      const { data: uptimeData } = await supabase.rpc("calculate_uptime", {
        p_service_id: serviceId,
      });

      // Update service
      await supabase
        .from("services")
        .update({
          status: metrics.status,
          response_time: responseTime,
          cpu: metrics.cpu_percent,
          memory: metrics.memory_percent,
          disk: metrics.storage_percent,
          last_check: new Date().toISOString(),
          uptime: uptimeData ?? 0,
        })
        .eq("id", serviceId);
    }

    return new Response(
      JSON.stringify({
        success: true,
        response_time: responseTime,
        metrics,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Azure SQL metrics error:", err);
    return new Response(
      JSON.stringify({
        success: false,
        error: err.message,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
