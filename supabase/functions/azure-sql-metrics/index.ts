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

async function resolveCredentials(config: Record<string, unknown>): Promise<Record<string, unknown>> {
  const credentialId = config.credential_id as string | undefined;
  if (!credentialId) return config;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: cred, error } = await supabase
    .from("credentials")
    .select("config")
    .eq("id", credentialId)
    .single();

  if (error || !cred?.config) {
    console.warn("Could not resolve credential_id, using inline config:", error?.message);
    return config;
  }

  // Merge credential config (lower priority) with inline config (higher priority)
  const credConfig = cred.config as Record<string, unknown>;
  return { ...credConfig, ...config };
}

async function collectMetrics(config: Record<string, unknown>, checkType = "sql_query"): Promise<MetricsResult> {
  // Resolve credentials from credentials table if credential_id is present
  const resolvedConfig = await resolveCredentials(config);
  const isOnPrem = checkType === "sql_server";

  // Read from check_config first, fall back to env vars for backward compatibility
  const host = ((resolvedConfig.host as string) || Deno.env.get("AZURE_SQL_HOST") || "").trim();
  const database = ((resolvedConfig.database as string) || Deno.env.get("AZURE_SQL_DATABASE") || "").trim();
  const user = ((resolvedConfig.username as string) || Deno.env.get("AZURE_SQL_USER") || "").trim();
  const password = ((resolvedConfig.password as string) || Deno.env.get("AZURE_SQL_PASSWORD") || "").trim();

  if (!host || !database || !user || !password) {
    throw new Error("SQL Server credentials not configured (check_config, credential_id or env vars)");
  }

  const sqlConfig: sql.config = {
    server: host,
    database,
    user,
    password,
    port: Number(resolvedConfig.port || 1433),
    options: {
      encrypt: (resolvedConfig.encrypt as boolean) ?? true,
      trustServerCertificate: (resolvedConfig.trust_server_certificate as boolean) ?? !(resolvedConfig.encrypt ?? true),
    },
    connectionTimeout: 15000,
    requestTimeout: 15000,
  };

  const pool = await sql.connect(sqlConfig);

  try {
    // --- Try Azure SQL DMV first, fall back to on-prem DMVs ---
    let cpuPercent = 0;
    let memoryPercent = 0;
    let dataIoPercent = 0;
    let logWritePercent = 0;
    let maxWorkerPercent = 0;
    let maxSessionPercent = 0;
    let isAzure = !isOnPrem;

    if (!isOnPrem) {
      try {
        const resourceStats = await pool.request().query(`
          SELECT TOP 1
            avg_cpu_percent, avg_data_io_percent, avg_log_write_percent,
            avg_memory_usage_percent, max_worker_percent, max_session_percent
          FROM sys.dm_db_resource_stats ORDER BY end_time DESC
        `);
        const r = resourceStats.recordset[0];
        if (r) {
          cpuPercent = r.avg_cpu_percent ?? 0;
          memoryPercent = r.avg_memory_usage_percent ?? 0;
          dataIoPercent = r.avg_data_io_percent ?? 0;
          logWritePercent = r.avg_log_write_percent ?? 0;
          maxWorkerPercent = r.max_worker_percent ?? 0;
          maxSessionPercent = r.max_session_percent ?? 0;
        }
      } catch (_e) {
        // DMV not available — treat as on-prem
        isAzure = false;
      }
    }

    // On-prem CPU fallback via ring buffers
    if (!isAzure) {
      try {
        const cpuRes = await pool.request().query(`
          SELECT TOP 1
            record.value('(./Record/SchedulerMonitorEvent/SystemHealth/ProcessUtilization)[1]', 'int') AS sql_cpu
          FROM (
            SELECT CAST(record AS XML) AS record
            FROM sys.dm_os_ring_buffers
            WHERE ring_buffer_type = N'RING_BUFFER_SCHEDULER_MONITOR'
              AND record LIKE N'%<SystemHealth>%'
          ) AS x
        `);
        cpuPercent = cpuRes.recordset[0]?.sql_cpu ?? 0;
      } catch { /* ring buffers may not be available */ }
    }

    // On-prem memory fallback
    let totalPhysMb = 0;
    let availablePhysMb = 0;
    let sqlMemoryMb = 0;
    if (!isAzure) {
      try {
        const memRes = await pool.request().query(`
          SELECT total_physical_memory_kb / 1024 AS total_phys_mb,
                 available_physical_memory_kb / 1024 AS available_phys_mb
          FROM sys.dm_os_sys_memory
        `);
        const m = memRes.recordset[0];
        if (m) {
          totalPhysMb = m.total_phys_mb ?? 0;
          availablePhysMb = m.available_phys_mb ?? 0;
          if (totalPhysMb > 0) memoryPercent = Math.round(((totalPhysMb - availablePhysMb) / totalPhysMb) * 10000) / 100;
        }
      } catch { /* */ }
      try {
        const sqlMemRes = await pool.request().query(`SELECT physical_memory_in_use_kb / 1024 AS sql_mem_mb FROM sys.dm_os_process_memory`);
        sqlMemoryMb = sqlMemRes.recordset[0]?.sql_mem_mb ?? 0;
      } catch { /* */ }
    }

    // Storage stats (works on all editions)
    let usedMb = 0;
    let allocatedMb = 0;
    try {
      const sizeStats = await pool.request().query(`
        SELECT SUM(CAST(FILEPROPERTY(name, 'SpaceUsed') AS BIGINT) * 8 / 1024) AS used_mb,
               SUM(size * 8 / 1024) AS allocated_mb
        FROM sys.database_files WHERE type_desc = 'ROWS'
      `);
      const s = sizeStats.recordset[0] || {};
      usedMb = s.used_mb ?? 0;
      allocatedMb = s.allocated_mb ?? 0;
    } catch { /* */ }
    const storagePercent = allocatedMb > 0 ? Math.round((usedMb / allocatedMb) * 10000) / 100 : 0;

    // Connection stats (works on all editions)
    let activeConnections = 0;
    let totalSessions = 0;
    try {
      const connRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM sys.dm_exec_sessions WHERE is_user_process = 1 AND status = 'running'`);
      activeConnections = connRes.recordset[0]?.cnt ?? 0;
      const sessRes = await pool.request().query(`SELECT COUNT(*) AS cnt FROM sys.dm_exec_sessions WHERE is_user_process = 1`);
      totalSessions = sessRes.recordset[0]?.cnt ?? 0;
    } catch { /* */ }

    // Top waits (works on all editions)
    let topWaits: Record<string, unknown>[] = [];
    try {
      const waitRes = await pool.request().query(`
        SELECT TOP 10 wait_type, waiting_tasks_count, wait_time_ms, signal_wait_time_ms
        FROM sys.dm_os_wait_stats
        WHERE waiting_tasks_count > 0
          AND wait_type NOT LIKE '%SLEEP%' AND wait_type NOT LIKE '%IDLE%'
          AND wait_type NOT LIKE '%QUEUE%' AND wait_type NOT LIKE 'BROKER%'
          AND wait_type NOT LIKE 'XE%' AND wait_type NOT LIKE 'WAITFOR'
        ORDER BY wait_time_ms DESC
      `);
      topWaits = waitRes.recordset || [];
    } catch { /* */ }

    // On-prem extras: databases, performance counters, tables
    let databases: Record<string, unknown>[] = [];
    let topTables: Record<string, unknown>[] = [];
    const perfCounters: Record<string, number> = {};
    let connectionsByDb: Record<string, unknown>[] = [];
    let connectionsByLogin: Record<string, unknown>[] = [];
    let serverVersion = "";
    let sqlUptimeHours = 0;

    if (!isAzure) {
      // Databases
      try {
        const dbRes = await pool.request().query(`
          SELECT d.name, d.state_desc, d.recovery_model_desc, d.compatibility_level,
            CAST(SUM(mf.size) * 8.0 / 1024 AS DECIMAL(18,2)) AS size_mb,
            CAST(SUM(CASE WHEN mf.type_desc = 'ROWS' THEN mf.size ELSE 0 END) * 8.0 / 1024 AS DECIMAL(18,2)) AS data_mb,
            CAST(SUM(CASE WHEN mf.type_desc = 'LOG' THEN mf.size ELSE 0 END) * 8.0 / 1024 AS DECIMAL(18,2)) AS log_mb
          FROM sys.databases d JOIN sys.master_files mf ON d.database_id = mf.database_id
          GROUP BY d.name, d.state_desc, d.recovery_model_desc, d.compatibility_level
          ORDER BY SUM(mf.size) DESC
        `);
        databases = dbRes.recordset || [];
      } catch { /* */ }

      // Top tables
      try {
        const tblRes = await pool.request().query(`
          SELECT TOP 15 s.name + '.' + t.name AS table_name, SUM(p.rows) AS row_count,
            CAST(SUM(a.total_pages) * 8.0 / 1024 AS DECIMAL(18,2)) AS total_mb,
            CAST(SUM(a.used_pages) * 8.0 / 1024 AS DECIMAL(18,2)) AS used_mb,
            CAST(SUM(a.data_pages) * 8.0 / 1024 AS DECIMAL(18,2)) AS data_mb,
            COUNT(DISTINCT i.index_id) AS index_count
          FROM sys.tables t JOIN sys.schemas s ON t.schema_id = s.schema_id
          JOIN sys.indexes i ON t.object_id = i.object_id
          JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
          JOIN sys.allocation_units a ON p.partition_id = a.container_id
          WHERE t.is_ms_shipped = 0
          GROUP BY s.name, t.name ORDER BY SUM(a.total_pages) DESC
        `);
        topTables = tblRes.recordset || [];
      } catch { /* */ }

      // Performance counters
      try {
        const pcRes = await pool.request().query(`
          SELECT counter_name, cntr_value FROM sys.dm_os_performance_counters
          WHERE object_name LIKE '%Buffer Manager%'
            AND counter_name IN ('Page life expectancy','Buffer cache hit ratio','Buffer cache hit ratio base','Page reads/sec','Page writes/sec')
        `);
        const raw: Record<string, number> = {};
        for (const r of pcRes.recordset) raw[r.counter_name.trim()] = r.cntr_value ?? 0;
        perfCounters.page_life_expectancy = raw["Page life expectancy"] ?? 0;
        const base = raw["Buffer cache hit ratio base"] || 1;
        perfCounters.buffer_cache_hit_ratio = base ? Math.round((raw["Buffer cache hit ratio"] ?? 0) / base * 10000) / 100 : 0;
        perfCounters.page_reads_sec = raw["Page reads/sec"] ?? 0;
        perfCounters.page_writes_sec = raw["Page writes/sec"] ?? 0;
      } catch { /* */ }
      try {
        const batchRes = await pool.request().query(`
          SELECT counter_name, cntr_value FROM sys.dm_os_performance_counters
          WHERE object_name LIKE '%SQL Statistics%' AND counter_name IN ('Batch Requests/sec','SQL Compilations/sec')
        `);
        for (const r of batchRes.recordset) {
          const key = r.counter_name.trim().toLowerCase().replace("/sec", "_sec").replace(/ /g, "_");
          perfCounters[key] = r.cntr_value ?? 0;
        }
      } catch { /* */ }

      // Connections by db/login
      try {
        const cdbRes = await pool.request().query(`SELECT DB_NAME(database_id) AS db_name, COUNT(*) AS cnt FROM sys.dm_exec_sessions WHERE is_user_process = 1 AND database_id > 0 GROUP BY database_id ORDER BY COUNT(*) DESC`);
        connectionsByDb = cdbRes.recordset || [];
      } catch { /* */ }
      try {
        const clRes = await pool.request().query(`SELECT TOP 10 login_name, COUNT(*) AS cnt, SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) AS active FROM sys.dm_exec_sessions WHERE is_user_process = 1 GROUP BY login_name ORDER BY COUNT(*) DESC`);
        connectionsByLogin = clRes.recordset || [];
      } catch { /* */ }

      // Version & uptime
      try {
        const verRes = await pool.request().query(`SELECT @@VERSION AS ver`);
        const ver = verRes.recordset[0]?.ver ?? "";
        serverVersion = ver.split("\n")[0].trim();
      } catch { /* */ }
      try {
        const upRes = await pool.request().query(`SELECT DATEDIFF(HOUR, sqlserver_start_time, GETDATE()) AS uptime_hours FROM sys.dm_os_sys_info`);
        sqlUptimeHours = upRes.recordset[0]?.uptime_hours ?? 0;
      } catch { /* */ }
    }

    // Fetch configurable rules
    const supabaseForRules = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const checkType = isAzure ? "sql_query" : "sql_server";
    const { data: ruleRow } = await supabaseForRules.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", checkType).single();
    const wr = (ruleRow?.warning_rules ?? { cpu_gt: 90, memory_gt: 90, storage_gt: 95 }) as Record<string, number>;

    let status: "online" | "offline" | "warning" = "online";
    if (cpuPercent > (wr.cpu_gt ?? 90) || memoryPercent > (wr.memory_gt ?? 90) || storagePercent > (wr.storage_gt ?? 95)) {
      status = "warning";
    }

    return {
      cpu_percent: Math.round(cpuPercent * 100) / 100,
      memory_percent: Math.round(memoryPercent * 100) / 100,
      storage_percent: storagePercent,
      active_connections: activeConnections,
      avg_response_time: 0,
      status,
      details: {
        avg_data_io_percent: dataIoPercent,
        avg_log_write_percent: logWritePercent,
        max_worker_percent: maxWorkerPercent,
        max_session_percent: maxSessionPercent,
        used_mb: usedMb,
        allocated_mb: allocatedMb,
        total_sessions: totalSessions,
        active_connections: activeConnections,
        top_waits: topWaits,
        databases,
        top_tables: topTables,
        connections_by_db: connectionsByDb,
        connections_by_login: connectionsByLogin,
        perf_counters: perfCounters,
        server_version: serverVersion,
        sql_uptime_hours: sqlUptimeHours,
        total_phys_mb: totalPhysMb,
        available_phys_mb: availablePhysMb,
        sql_memory_mb: sqlMemoryMb,
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

    let config: Record<string, unknown> = {};
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let checkType = "sql_query";
    if (serviceId) {
      const { data: svc } = await supabase.from("services").select("check_config, check_type").eq("id", serviceId).single();
      config = (svc?.check_config as Record<string, unknown>) || {};
      checkType = (svc?.check_type as string) || "sql_query";
    }

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.config) config = { ...config, ...body.config };
      } catch { /* no body */ }
    }

    // Resolve credentials before choosing path
    const resolvedConfig = await resolveCredentials(config);

    let metrics: MetricsResult;
    let responseTime: number;

    // If agent_url is configured, delegate to the monitoring agent (bypasses firewall issues)
    const agentUrl = (resolvedConfig.agent_url as string || config.agent_url as string || "").trim();
    const agentToken = (resolvedConfig.agent_token as string || config.agent_token as string || "").trim();

    if (agentUrl) {
      const start = Date.now();
      const agentPayload = {
        host: ((resolvedConfig.host as string) || "").trim(),
        database: ((resolvedConfig.database as string) || "").trim(),
        username: ((resolvedConfig.username as string) || "").trim(),
        password: ((resolvedConfig.password as string) || "").trim(),
        port: resolvedConfig.port || 1433,
        encrypt: resolvedConfig.encrypt ?? (checkType !== "sql_server"),
      };

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (agentToken) headers["Authorization"] = `Bearer ${agentToken}`;

      const agentRes = await fetch(`${agentUrl.replace(/\/$/, "")}/mssql`, {
        method: "POST",
        headers,
        body: JSON.stringify(agentPayload),
      });
      const agentData = await agentRes.json();
      responseTime = Date.now() - start;

      if (!agentData.success) {
        throw new Error(agentData.error || "Agent MSSQL check failed");
      }

      metrics = {
        cpu_percent: agentData.metrics.cpu_percent ?? 0,
        memory_percent: agentData.metrics.memory_percent ?? 0,
        storage_percent: agentData.metrics.storage_percent ?? 0,
        active_connections: agentData.metrics.active_connections ?? 0,
        avg_response_time: agentData.metrics.avg_response_time ?? responseTime,
        status: agentData.metrics.status ?? "online",
        details: agentData.metrics.details ?? {},
        error_message: agentData.metrics.error_message ?? null,
      };
    } else {
      // Direct connection (original path)
      const start = Date.now();
      metrics = await collectMetrics(config, checkType);
      responseTime = Date.now() - start;
    }

    metrics.avg_response_time = responseTime;

    if (serviceId) {
      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status: metrics.status,
        response_time: responseTime,
        cpu: metrics.cpu_percent,
        memory: metrics.memory_percent,
        disk: metrics.storage_percent,
        error_message: metrics.error_message,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", {
        p_service_id: serviceId,
      });

      // Persist _sql_details in check_config (like Airflow does)
      const updatedConfig = { ...config, _sql_details: metrics.details };

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
          check_config: updatedConfig,
        })
        .eq("id", serviceId);
    }

    return new Response(
      JSON.stringify({ success: true, response_time: responseTime, metrics }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Azure SQL metrics error:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
