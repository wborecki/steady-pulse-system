import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AWS Signature V4 helpers
function hmac(key: Uint8Array, data: string): Promise<ArrayBuffer> {
  return crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
    .then(k => crypto.subtle.sign("HMAC", k, new TextEncoder().encode(data)));
}

async function getSignatureKey(key: string, dateStamp: string, region: string, service: string) {
  let kDate = await hmac(new TextEncoder().encode("AWS4" + key), dateStamp);
  let kRegion = await hmac(new Uint8Array(kDate), region);
  let kService = await hmac(new Uint8Array(kRegion), service);
  let kSigning = await hmac(new Uint8Array(kService), "aws4_request");
  return new Uint8Array(kSigning);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function awsRequest(service: string, region: string, action: string, params: Record<string, string>, accessKey: string, secretKey: string) {
  const host = `${service}.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);

  const queryParams = new URLSearchParams({ Action: action, Version: service === "monitoring" ? "2010-08-01" : "2006-03-01", ...params });
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

async function getCloudWatchMetrics(config: Record<string, unknown>) {
  const accessKey = Deno.env.get("AWS_ACCESS_KEY_ID")!;
  const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
  const region = (config.region as string) || Deno.env.get("AWS_REGION") || "us-east-1";

  const instanceId = config.instance_id as string;
  const metricType = config.metric_type as string || "EC2";

  const start = Date.now();
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 5 * 60 * 1000); // last 5 min

  const metrics: Record<string, number> = {};
  const metricQueries = metricType === "EC2" ? [
    { name: "CPUUtilization", namespace: "AWS/EC2", stat: "Average" },
    { name: "NetworkIn", namespace: "AWS/EC2", stat: "Sum" },
    { name: "NetworkOut", namespace: "AWS/EC2", stat: "Sum" },
    { name: "StatusCheckFailed", namespace: "AWS/EC2", stat: "Maximum" },
  ] : metricType === "RDS" ? [
    { name: "CPUUtilization", namespace: "AWS/RDS", stat: "Average" },
    { name: "FreeableMemory", namespace: "AWS/RDS", stat: "Average" },
    { name: "DatabaseConnections", namespace: "AWS/RDS", stat: "Average" },
    { name: "ReadLatency", namespace: "AWS/RDS", stat: "Average" },
  ] : [];

  for (const mq of metricQueries) {
    try {
      const dimName = metricType === "EC2" ? "InstanceId" : "DBInstanceIdentifier";
      const xml = await awsRequest("monitoring", region, "GetMetricStatistics", {
        Namespace: mq.namespace,
        MetricName: mq.name,
        "Dimensions.member.1.Name": dimName,
        "Dimensions.member.1.Value": instanceId || "",
        StartTime: startTime.toISOString(),
        EndTime: endTime.toISOString(),
        Period: "300",
        "Statistics.member.1": mq.stat,
      }, accessKey, secretKey);

      const match = xml.match(new RegExp(`<${mq.stat}>([^<]+)</${mq.stat}>`));
      if (match) metrics[mq.name] = parseFloat(match[1]);
    } catch (e) {
      console.error(`CloudWatch metric ${mq.name} error:`, e.message);
    }
  }

  const responseTime = Date.now() - start;
  const cpu = metrics.CPUUtilization ?? 0;
  const statusFailed = metrics.StatusCheckFailed ?? 0;

  let status: "online" | "warning" | "offline" = "online";
  if (statusFailed > 0) status = "offline";
  else if (cpu > 80) status = "warning";

  return {
    status,
    response_time: responseTime,
    cpu: Math.round(cpu * 100) / 100,
    memory: metricType === "RDS" ? Math.round((metrics.FreeableMemory || 0) / 1024 / 1024 / 1024 * 100) / 100 : 0,
    disk: 0,
    details: { ...metrics, metric_type: metricType, instance_id: instanceId, region },
    error_message: null,
  };
}

async function getS3Metrics(config: Record<string, unknown>) {
  const accessKey = Deno.env.get("AWS_ACCESS_KEY_ID")!;
  const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
  const region = (config.region as string) || Deno.env.get("AWS_REGION") || "us-east-1";
  const bucketName = config.bucket_name as string;

  if (!bucketName) throw new Error("S3 bucket_name not configured");

  const start = Date.now();

  // List buckets to verify access
  const xml = await awsRequest("s3", region, "ListBuckets", {}, accessKey, secretKey);
  const responseTime = Date.now() - start;

  const bucketExists = xml.includes(`<Name>${bucketName}</Name>`);

  return {
    status: bucketExists ? "online" as const : "warning" as const,
    response_time: responseTime,
    cpu: 0,
    memory: 0,
    disk: 0,
    details: {
      bucket_name: bucketName,
      bucket_found: bucketExists,
      region,
    },
    error_message: bucketExists ? null : `Bucket ${bucketName} not found`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!Deno.env.get("AWS_ACCESS_KEY_ID") || !Deno.env.get("AWS_SECRET_ACCESS_KEY")) {
      throw new Error("AWS credentials not configured");
    }

    const url = new URL(req.url);
    const serviceId = url.searchParams.get("service_id");
    const checkType = url.searchParams.get("check_type") || "cloudwatch";

    let config: Record<string, unknown> = {};
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (serviceId) {
      const { data: svc } = await supabase.from("services").select("check_config, check_type").eq("id", serviceId).single();
      config = (svc?.check_config as Record<string, unknown>) || {};
      if (svc?.check_type === "s3") config._type = "s3";
    }

    if (req.method === "POST") {
      try {
        const body = await req.json();
        if (body.config) config = { ...config, ...body.config };
      } catch { /* no body */ }
    }

    const isS3 = checkType === "s3" || config._type === "s3";
    const metrics = isS3 ? await getS3Metrics(config) : await getCloudWatchMetrics(config);

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

      await supabase.from("services").update({
        status: metrics.status,
        response_time: metrics.response_time,
        cpu: metrics.cpu,
        memory: metrics.memory,
        disk: metrics.disk,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({ success: true, metrics }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("AWS metrics error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
