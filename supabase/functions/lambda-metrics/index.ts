import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function hmac(key: Uint8Array, data: string): Promise<ArrayBuffer> {
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then(k => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  const kDate = await hmac(new TextEncoder().encode("AWS4" + key), dateStamp);
  const kRegion = await hmac(new Uint8Array(kDate), region);
  const kService = await hmac(new Uint8Array(kRegion), service);
  const kSigning = await hmac(new Uint8Array(kService), "aws4_request");
  return new Uint8Array(kSigning);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function awsRequest(service: string, region: string, action: string, params: Record<string, string>, accessKey: string, secretKey: string) {
  const host = `${service}.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const queryParams = new URLSearchParams({ Action: action, Version: "2010-08-01", ...params });
  const canonicalQuerystring = [...queryParams].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-date";
  const payloadHash = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("")));
  const canonicalRequest = `GET\n/\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest)))}`;
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, service);
  const signature = toHex(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), new TextEncoder().encode(stringToSign)));
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(`https://${host}/?${canonicalQuerystring}`, {
    headers: { "x-amz-date": amzDate, "Authorization": authHeader },
  });
  return await res.text();
}

function extractMetricValue(xml: string, stat: string): number | null {
  const match = xml.match(new RegExp(`<${stat}>([^<]+)</${stat}>`));
  return match ? parseFloat(match[1]) : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const url = new URL(req.url);
    const serviceId = url.searchParams.get("service_id");

    let config: Record<string, unknown> = {};
    if (serviceId) {
      const { data: svc } = await supabase.from("services").select("check_config").eq("id", serviceId).single();
      config = (svc?.check_config as Record<string, unknown>) || {};
    }

    // Resolve credential_id → AWS keys from credentials table
    let accessKey = Deno.env.get("AWS_ACCESS_KEY_ID")!;
    let secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
    const credentialId = config.credential_id as string;
    if (credentialId) {
      const { data: cred } = await supabase.from("credentials").select("config").eq("id", credentialId).single();
      if (cred?.config) {
        const cc = cred.config as Record<string, string>;
        if (cc.access_key_id) accessKey = cc.access_key_id;
        if (cc.secret_access_key) secretKey = cc.secret_access_key;
        if (cc.region && !config.region) config.region = cc.region;
      }
    }
    if (!accessKey || !secretKey) throw new Error("AWS credentials not configured. Add env vars or link a credential.");

    const region = (config.region as string) || Deno.env.get("AWS_REGION") || "us-east-1";
    const functionName = config.function_name as string;
    if (!functionName) throw new Error("Lambda function_name not configured");

    const start = Date.now();
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);

    const metrics: Record<string, number> = {};
    const metricQueries = [
      { name: "Invocations", stat: "Sum" },
      { name: "Errors", stat: "Sum" },
      { name: "Duration", stat: "Average" },
      { name: "Throttles", stat: "Sum" },
      { name: "ConcurrentExecutions", stat: "Maximum" },
    ];

    // Also get p99 duration
    for (const mq of metricQueries) {
      try {
        const xml = await awsRequest("monitoring", region, "GetMetricStatistics", {
          Namespace: "AWS/Lambda",
          MetricName: mq.name,
          "Dimensions.member.1.Name": "FunctionName",
          "Dimensions.member.1.Value": functionName,
          StartTime: startTime.toISOString(),
          EndTime: endTime.toISOString(),
          Period: "300",
          "Statistics.member.1": mq.stat,
        }, accessKey, secretKey);
        const val = extractMetricValue(xml, mq.stat);
        if (val !== null) metrics[mq.name] = val;
      } catch (e) {
        console.error(`Lambda metric ${mq.name} error:`, e.message);
      }
    }

    // Get p99 Duration
    try {
      const xml = await awsRequest("monitoring", region, "GetMetricStatistics", {
        Namespace: "AWS/Lambda",
        MetricName: "Duration",
        "Dimensions.member.1.Name": "FunctionName",
        "Dimensions.member.1.Value": functionName,
        StartTime: startTime.toISOString(),
        EndTime: endTime.toISOString(),
        Period: "300",
        "ExtendedStatistics.member.1": "p99",
      }, accessKey, secretKey);
      const match = xml.match(/<Value>([^<]+)<\/Value>/);
      if (match) metrics["DurationP99"] = parseFloat(match[1]);
    } catch (e) {
      console.error("Lambda p99 error:", e.message);
    }

    const responseTime = Date.now() - start;
    const invocations = metrics.Invocations ?? 0;
    const errors = metrics.Errors ?? 0;
    const errorRate = invocations > 0 ? (errors / invocations) * 100 : 0;
    const throttles = metrics.Throttles ?? 0;

    // Fetch configurable rules
    const { data: ruleRow } = await supabase.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "lambda").single();
    const wr = (ruleRow?.warning_rules ?? { error_rate_gt: 2, throttles_gt: 0 }) as Record<string, number>;
    const or = (ruleRow?.offline_rules ?? { error_rate_gt: 10, throttles_gt: 5 }) as Record<string, number>;

    let status: "online" | "warning" | "offline" = "online";
    if (errorRate > (or.error_rate_gt ?? 10) || throttles > (or.throttles_gt ?? 5)) status = "offline";
    else if (errorRate > (wr.error_rate_gt ?? 2) || throttles > (wr.throttles_gt ?? 0)) status = "warning";

    const lambdaDetails = {
      function_name: functionName,
      invocations,
      errors,
      error_rate: Math.round(errorRate * 100) / 100,
      duration_avg: Math.round((metrics.Duration ?? 0) * 100) / 100,
      duration_p99: Math.round((metrics.DurationP99 ?? 0) * 100) / 100,
      throttles,
      concurrent_executions: metrics.ConcurrentExecutions ?? 0,
      region,
    };

    if (serviceId) {
      // Persist details in check_config
      const existingConfig = { ...config };
      existingConfig._lambda_details = lambdaDetails;

      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status,
        response_time: responseTime,
        cpu: errorRate,
        memory: metrics.Duration ?? 0,
        disk: throttles,
        error_message: status === "offline" ? `Error rate: ${errorRate.toFixed(1)}%, Throttles: ${throttles}` : null,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      await supabase.from("services").update({
        status,
        response_time: responseTime,
        cpu: errorRate,
        memory: metrics.Duration ?? 0,
        disk: throttles,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: existingConfig,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({
      success: true,
      metrics: { status, response_time: responseTime, cpu: errorRate, memory: metrics.Duration ?? 0, disk: throttles, error_message: null, ...lambdaDetails },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Lambda metrics error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
