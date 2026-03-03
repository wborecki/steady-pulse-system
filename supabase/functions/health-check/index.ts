import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Service {
  id: string;
  name: string;
  url: string | null;
  check_type: string;
  check_config: Record<string, unknown>;
  status: string;
  check_interval_seconds: number;
  last_check: string | null;
}

async function checkSslExpiry(url: string): Promise<{ days_until_expiry: number | null; issuer: string | null; valid_from: string | null; valid_to: string | null; error: string | null }> {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return { days_until_expiry: null, issuer: null, valid_from: null, valid_to: null, error: "Not HTTPS" };
    
    const conn = await Deno.connectTls({ hostname: parsed.hostname, port: parseInt(parsed.port) || 443 });
    const cert = conn.peerCertificates?.[0];
    conn.close();
    
    if (!cert) return { days_until_expiry: null, issuer: null, valid_from: null, valid_to: null, error: "No certificate" };
    
    // Parse certificate dates - Deno TLS certs have notBefore/notAfter as Date-like
    const notAfter = cert.notAfter ? new Date(cert.notAfter) : null;
    const notBefore = cert.notBefore ? new Date(cert.notBefore) : null;
    const daysUntilExpiry = notAfter ? Math.floor((notAfter.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    
    // Extract issuer CN
    const issuerStr = cert.issuer || "";
    const cnMatch = typeof issuerStr === "string" ? issuerStr.match(/CN=([^,]+)/) : null;
    const issuer = cnMatch ? cnMatch[1] : (typeof issuerStr === "string" ? issuerStr : null);
    
    return {
      days_until_expiry: daysUntilExpiry,
      issuer,
      valid_from: notBefore?.toISOString() || null,
      valid_to: notAfter?.toISOString() || null,
      error: null,
    };
  } catch (err) {
    return { days_until_expiry: null, issuer: null, valid_from: null, valid_to: null, error: err.message };
  }
}

async function checkHttp(url: string, config: Record<string, unknown> = {}, httpRules?: { warning_rules: Record<string, number>; offline_rules: Record<string, number> }): Promise<{
  status: "online" | "offline" | "warning";
  response_time: number;
  status_code: number | null;
  error_message: string | null;
  ssl_info?: Record<string, unknown>;
}> {
  const wr = httpRules?.warning_rules ?? { response_time_gt: 5000 };
  const or = httpRules?.offline_rules ?? { status_code_gte: 500 };
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    
    const method = (config.method as string) || "GET";
    const fetchOpts: RequestInit = { signal: controller.signal, method };
    
    // Auth headers
    const headers: Record<string, string> = {};
    const auth = config.auth as Record<string, unknown> | undefined;
    if (auth) {
      if (auth.type === "basic") {
        headers["Authorization"] = `Basic ${btoa(`${auth.username}:${auth.password}`)}`;
      } else if (auth.type === "bearer") {
        headers["Authorization"] = `Bearer ${auth.token}`;
      }
    }
    
    // Custom headers
    const customHeaders = config.headers as Record<string, string> | undefined;
    if (customHeaders) Object.assign(headers, customHeaders);
    
    if (Object.keys(headers).length > 0) fetchOpts.headers = headers;
    
    const res = await fetch(url, fetchOpts);
    clearTimeout(timeout);
    const response_time = Date.now() - start;
    const status_code = res.status;
    await res.text();

    const expectedStatus = config.expected_status as number | undefined;
    
    // Check SSL certificate
    let ssl_info: Record<string, unknown> | undefined;
    try {
      const sslResult = await checkSslExpiry(url);
      if (sslResult.days_until_expiry !== null) {
        ssl_info = sslResult as unknown as Record<string, unknown>;
      }
    } catch { /* SSL check is best-effort */ }

    if (expectedStatus && status_code !== expectedStatus) {
      return { status: "warning", response_time, status_code, error_message: `Expected ${expectedStatus}, got ${status_code}`, ssl_info };
    }

    if (status_code >= 200 && status_code < 400) {
      const sslWarning = ssl_info && (ssl_info.days_until_expiry as number) <= 14;
      const slowWarning = wr.response_time_gt !== undefined && response_time > wr.response_time_gt;
      return {
        status: slowWarning ? "warning" : sslWarning ? "warning" : "online",
        response_time,
        status_code,
        error_message: sslWarning ? `SSL certificate expires in ${ssl_info!.days_until_expiry} days` : null,
        ssl_info,
      };
    } else {
      const isOffline = or.status_code_gte !== undefined ? status_code >= or.status_code_gte : status_code >= 500;
      return {
        status: isOffline ? "offline" : "warning",
        response_time,
        status_code,
        error_message: `HTTP ${status_code}`,
        ssl_info,
      };
    }
  } catch (err) {
    return {
      status: "offline",
      response_time: Date.now() - start,
      status_code: null,
      error_message: err.message,
    };
  }
}

async function checkTcp(
  host: string,
  port: number
): Promise<{
  status: "online" | "offline";
  response_time: number;
  error_message: string | null;
}> {
  const start = Date.now();
  try {
    const conn = await Deno.connect({ hostname: host, port });
    conn.close();
    return {
      status: "online",
      response_time: Date.now() - start,
      error_message: null,
    };
  } catch (err) {
    return {
      status: "offline",
      response_time: Date.now() - start,
      error_message: err.message,
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const serviceId = url.searchParams.get("service_id");

    let query = supabase
      .from("services")
      .select("id, name, url, check_type, check_config, status, check_interval_seconds, last_check")
      .eq("enabled", true)
      .neq("status", "maintenance");

    if (serviceId) {
      query = query.eq("id", serviceId);
    }

    const { data: services, error } = await query;
    if (error) throw error;

    // Filter services respecting their individual check_interval_seconds
    const now = Date.now();
    const eligibleServices = (services || []).filter((s: any) => {
      if (serviceId) return true;
      if (!s.last_check) return true;
      const lastCheckMs = new Date(s.last_check).getTime();
      const intervalMs = (s.check_interval_seconds || 60) * 1000;
      return (now - lastCheckMs) >= intervalMs;
    });
    if (error) throw error;

    // Pre-fetch HTTP rules for the loop
    const { data: httpRuleRow } = await supabase.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "http").single();
    const httpRules = httpRuleRow ? { warning_rules: httpRuleRow.warning_rules as Record<string, number>, offline_rules: httpRuleRow.offline_rules as Record<string, number> } : undefined;

    const results = [];

    for (const service of eligibleServices as Service[]) {
      let checkResult: {
        status: string;
        response_time: number;
        status_code?: number | null;
        error_message: string | null;
        ssl_info?: Record<string, unknown>;
      };

      // Helper to delegate to a sub-function
      const delegateToFunction = async (fnName: string) => {
        try {
          const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${fnName}?service_id=${service.id}`;
          const fnRes = await fetch(fnUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
          });
          const fnData = await fnRes.json();
          if (fnData.success) {
            results.push({
              service_id: service.id,
              name: service.name,
              uptime: 0,
              status: fnData.metrics.status,
              response_time: fnData.metrics.response_time || fnData.response_time,
              error_message: fnData.metrics.error_message,
              cpu: fnData.metrics.cpu_percent ?? fnData.metrics.cpu ?? 0,
              memory: fnData.metrics.memory_percent ?? fnData.metrics.memory ?? 0,
              disk: fnData.metrics.storage_percent ?? fnData.metrics.disk ?? 0,
            });
            return null; // signal to continue
          }
          return {
            status: "offline",
            response_time: 0,
            error_message: fnData.error || `${fnName} check failed`,
          };
        } catch (err) {
          return {
            status: "offline",
            response_time: 0,
            error_message: `${fnName} error: ${err.message}`,
          };
        }
      };

      switch (service.check_type) {
        case "tcp": {
          const config = service.check_config as { host?: string; port?: number };
          if (config.host && config.port) {
            checkResult = await checkTcp(config.host, config.port);
          } else {
            checkResult = {
              status: "warning",
              response_time: 0,
              error_message: "TCP config missing host/port",
            };
          }
          break;
        }
        case "sql_query": {
          const result = await delegateToFunction("azure-sql-metrics");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        case "postgresql": {
          const result = await delegateToFunction("postgresql-metrics");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        case "mongodb": {
          const result = await delegateToFunction("mongodb-metrics");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        case "airflow": {
          const result = await delegateToFunction("airflow-metrics");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        case "cloudwatch": {
          const result = await delegateToFunction("aws-metrics");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        case "s3": {
          const fnUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/aws-metrics?service_id=${service.id}&check_type=s3`;
          try {
            const fnRes = await fetch(fnUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                "Content-Type": "application/json",
              },
            });
            const fnData = await fnRes.json();
            if (fnData.success) {
              results.push({
                service_id: service.id,
                name: service.name,
                uptime: 0,
                status: fnData.metrics.status,
                response_time: fnData.metrics.response_time,
                error_message: fnData.metrics.error_message,
              });
              continue;
            }
            checkResult = { status: "offline", response_time: 0, error_message: fnData.error || "S3 check failed" };
          } catch (err) {
            checkResult = { status: "offline", response_time: 0, error_message: `S3 error: ${err.message}` };
          }
          break;
        }
        case "lambda": {
          const result = await delegateToFunction("lambda-metrics");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        case "ecs": {
          const result = await delegateToFunction("ecs-metrics");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        case "cloudwatch_alarms": {
          const result = await delegateToFunction("cloudwatch-alarms");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        case "systemctl": {
          const result = await delegateToFunction("systemctl-metrics");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        case "container": {
          const result = await delegateToFunction("container-metrics");
          if (result === null) continue;
          checkResult = result;
          break;
        }
        default: {
          if (service.url) {
            checkResult = await checkHttp(service.url, service.check_config || {}, httpRules);
          } else {
            checkResult = {
              status: "warning",
              response_time: 0,
              error_message: "No URL configured",
            };
          }
          break;
        }
      }

      // Save health check record
      await supabase.from("health_checks").insert({
        service_id: service.id,
        status: checkResult.status,
        response_time: checkResult.response_time,
        status_code: checkResult.status_code ?? null,
        error_message: checkResult.error_message,
      });

      // Calculate uptime (% of online checks in last 24h)
      const { data: uptimeData } = await supabase.rpc("calculate_uptime", {
        p_service_id: service.id,
      });
      const uptime = uptimeData ?? 0;

      // Persist SSL info and other details in check_config for HTTP
      const updateData: Record<string, unknown> = {
        status: checkResult.status,
        response_time: checkResult.response_time,
        last_check: new Date().toISOString(),
        uptime,
      };

      if (checkResult.ssl_info) {
        const { data: svcCurrent } = await supabase.from("services").select("check_config").eq("id", service.id).single();
        const existingConfig = (svcCurrent?.check_config as Record<string, unknown>) || {};
        updateData.check_config = { ...existingConfig, _ssl_info: checkResult.ssl_info };
      }

      // Update service status + uptime
      await supabase
        .from("services")
        .update(updateData)
        .eq("id", service.id);

      // Create alert if status changed + send notification
      const insertAndNotify = async (type: string, message: string) => {
        await supabase.from("alerts").insert({
          service_id: service.id,
          type,
          message,
        });
        // Fire-and-forget notification
        try {
          const notifUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-notification`;
          await fetch(notifUrl, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ service_name: service.name, type, message }),
          }).then(r => r.text());
        } catch { /* best effort */ }
      };

      if (checkResult.status === "offline" && service.status !== "offline") {
        await insertAndNotify("critical", `${service.name} ficou offline: ${checkResult.error_message || "Sem resposta"}`);
      } else if (checkResult.status === "warning" && service.status !== "warning") {
        await insertAndNotify("warning", `${service.name}: ${checkResult.error_message || "Performance degradada"}`);
      } else if (checkResult.status === "online" && service.status === "offline") {
        await insertAndNotify("info", `${service.name} voltou ao ar`);
      }

      // SSL expiry alert
      if (checkResult.ssl_info) {
        const daysLeft = checkResult.ssl_info.days_until_expiry as number;
        if (daysLeft !== null && daysLeft <= 7) {
          await supabase.from("alerts").insert({
            service_id: service.id,
            type: daysLeft <= 0 ? "critical" : "warning",
            message: daysLeft <= 0 
              ? `${service.name}: Certificado SSL EXPIRADO!` 
              : `${service.name}: Certificado SSL expira em ${daysLeft} dia(s)`,
          });
        }
      }

      // --- Threshold-based alerts ---
      try {
        const { data: thresholds } = await supabase
          .from("alert_thresholds")
          .select("*")
          .eq("service_id", service.id)
          .eq("enabled", true);

        if (thresholds && thresholds.length > 0) {
          // Get current service metrics for comparison
          const { data: svcNow } = await supabase.from("services").select("cpu, memory, disk, response_time").eq("id", service.id).single();
          const metricsMap: Record<string, number> = {
            cpu: Number(svcNow?.cpu ?? 0),
            memory: Number(svcNow?.memory ?? 0),
            disk: Number(svcNow?.disk ?? 0),
            response_time: checkResult.response_time ?? 0,
            error_rate: 0, // would come from specific check types
          };

          const now = Date.now();
          for (const t of thresholds) {
            const val = metricsMap[t.metric] ?? 0;
            let triggered = false;
            switch (t.operator) {
              case "gt": triggered = val > t.threshold; break;
              case "gte": triggered = val >= t.threshold; break;
              case "lt": triggered = val < t.threshold; break;
              case "lte": triggered = val <= t.threshold; break;
            }

            if (!triggered) continue;

            // Cooldown check
            if (t.last_triggered_at) {
              const lastMs = new Date(t.last_triggered_at).getTime();
              if (now - lastMs < t.cooldown_minutes * 60000) continue;
            }

            const opSymbol = { gt: ">", gte: "≥", lt: "<", lte: "≤" }[t.operator] || t.operator;
            const unit = t.metric === "response_time" ? "ms" : "%";
            await supabase.from("alerts").insert({
              service_id: service.id,
              type: t.severity === "critical" ? "critical" : "warning",
              message: `${service.name}: ${t.metric.toUpperCase()} ${opSymbol} ${t.threshold}${unit} (atual: ${val.toFixed(1)}${unit})`,
            });

            // Update last_triggered_at
            await supabase.from("alert_thresholds").update({ last_triggered_at: new Date().toISOString() }).eq("id", t.id);
          }
        }
      } catch (thErr) {
        console.error("Threshold check error:", thErr);
      }

      results.push({
        service_id: service.id,
        name: service.name,
        uptime,
        ...checkResult,
      });
    }

    return new Response(JSON.stringify({ checked: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
