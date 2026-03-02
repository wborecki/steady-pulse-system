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
}

async function checkHttp(url: string): Promise<{
  status: "online" | "offline" | "warning";
  response_time: number;
  status_code: number | null;
  error_message: string | null;
}> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const response_time = Date.now() - start;
    const status_code = res.status;
    await res.text();

    if (status_code >= 200 && status_code < 400) {
      return {
        status: response_time > 5000 ? "warning" : "online",
        response_time,
        status_code,
        error_message: null,
      };
    } else {
      return {
        status: status_code >= 500 ? "offline" : "warning",
        response_time,
        status_code,
        error_message: `HTTP ${status_code}`,
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
      .select("id, name, url, check_type, check_config, status")
      .eq("enabled", true);

    if (serviceId) {
      query = query.eq("id", serviceId);
    }

    const { data: services, error } = await query;
    if (error) throw error;

    const results = [];

    for (const service of (services as Service[]) || []) {
      let checkResult: {
        status: string;
        response_time: number;
        status_code?: number | null;
        error_message: string | null;
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
        case "http":
        default: {
          if (service.url) {
            checkResult = await checkHttp(service.url);
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

      // Update service status + uptime
      await supabase
        .from("services")
        .update({
          status: checkResult.status,
          response_time: checkResult.response_time,
          last_check: new Date().toISOString(),
          uptime,
        })
        .eq("id", service.id);

      // Create alert if status changed
      if (checkResult.status === "offline" && service.status !== "offline") {
        await supabase.from("alerts").insert({
          service_id: service.id,
          type: "critical",
          message: `${service.name} ficou offline: ${checkResult.error_message || "Sem resposta"}`,
        });
      } else if (
        checkResult.status === "warning" &&
        service.status !== "warning"
      ) {
        await supabase.from("alerts").insert({
          service_id: service.id,
          type: "warning",
          message: `${service.name}: ${checkResult.error_message || "Performance degradada"}`,
        });
      } else if (
        checkResult.status === "online" &&
        service.status === "offline"
      ) {
        await supabase.from("alerts").insert({
          service_id: service.id,
          type: "info",
          message: `${service.name} voltou ao ar`,
        });
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
