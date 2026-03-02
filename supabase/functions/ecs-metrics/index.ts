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
  let kDate = await hmac(new TextEncoder().encode("AWS4" + key), dateStamp);
  let kRegion = await hmac(new Uint8Array(kDate), region);
  let kService = await hmac(new Uint8Array(kRegion), service);
  let kSigning = await hmac(new Uint8Array(kService), "aws4_request");
  return new Uint8Array(kSigning);
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ECS uses JSON API with POST + X-Amz-Target header
async function ecsRequest(region: string, target: string, payload: Record<string, unknown>, accessKey: string, secretKey: string) {
  const host = `ecs.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const body = JSON.stringify(payload);
  const payloadHash = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(body)));
  const canonicalHeaders = `content-type:application/x-amz-json-1.1\nhost:${host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
  const signedHeaders = "content-type;host;x-amz-date;x-amz-target";
  const canonicalRequest = `POST\n/\n\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${region}/ecs/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest)))}`;
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, "ecs");
  const signature = toHex(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), new TextEncoder().encode(stringToSign)));
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const res = await fetch(`https://${host}/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-amz-json-1.1",
      "x-amz-date": amzDate,
      "x-amz-target": target,
      "Authorization": authHeader,
    },
    body,
  });
  return await res.json();
}

async function cwRequest(region: string, action: string, params: Record<string, string>, accessKey: string, secretKey: string) {
  const host = `monitoring.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:\-]|\.\d{3}/g, "").slice(0, 15) + "Z";
  const dateStamp = amzDate.slice(0, 8);
  const queryParams = new URLSearchParams({ Action: action, Version: "2010-08-01", ...params });
  const canonicalQuerystring = [...queryParams].sort((a, b) => a[0].localeCompare(b[0])).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
  const canonicalHeaders = `host:${host}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = "host;x-amz-date";
  const payloadHash = toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("")));
  const canonicalRequest = `GET\n/\n${canonicalQuerystring}\n${canonicalHeaders}\n${signedHeaders}\n${payloadHash}`;
  const credentialScope = `${dateStamp}/${region}/monitoring/aws4_request`;
  const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${credentialScope}\n${toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonicalRequest)))}`;
  const signingKey = await getSignatureKey(secretKey, dateStamp, region, "monitoring");
  const signature = toHex(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", signingKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), new TextEncoder().encode(stringToSign)));
  const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  const res = await fetch(`https://${host}/?${canonicalQuerystring}`, {
    headers: { "x-amz-date": amzDate, "Authorization": authHeader },
  });
  return await res.text();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const accessKey = Deno.env.get("AWS_ACCESS_KEY_ID")!;
    const secretKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!;
    if (!accessKey || !secretKey) throw new Error("AWS credentials not configured");

    const url = new URL(req.url);
    const serviceId = url.searchParams.get("service_id");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let config: Record<string, unknown> = {};
    if (serviceId) {
      const { data: svc } = await supabase.from("services").select("check_config").eq("id", serviceId).single();
      config = (svc?.check_config as Record<string, unknown>) || {};
    }

    const region = (config.region as string) || Deno.env.get("AWS_REGION") || "us-east-1";
    const cluster = config.cluster as string;
    const serviceName = config.service_name as string;
    if (!cluster || !serviceName) throw new Error("ECS cluster and service_name required");

    const start = Date.now();

    // Describe ECS service
    const descResult = await ecsRequest(region, "AmazonEC2ContainerServiceV20141113.DescribeServices", {
      cluster,
      services: [serviceName],
    }, accessKey, secretKey);

    const svcInfo = descResult.services?.[0];
    if (!svcInfo) throw new Error(`ECS service ${serviceName} not found in cluster ${cluster}`);

    const runningCount = svcInfo.runningCount ?? 0;
    const desiredCount = svcInfo.desiredCount ?? 0;
    const pendingCount = svcInfo.pendingCount ?? 0;
    const deployments = (svcInfo.deployments || []).map((d: any) => ({
      id: d.id,
      status: d.status,
      running: d.runningCount,
      desired: d.desiredCount,
      pending: d.pendingCount,
      task_definition: d.taskDefinition?.split("/").pop(),
      created_at: d.createdAt,
    }));

    // Get CPU/Memory from CloudWatch
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 5 * 60 * 1000);
    let cpuPercent = 0, memPercent = 0;

    for (const metric of ["CPUUtilization", "MemoryUtilization"]) {
      try {
        const xml = await cwRequest(region, "GetMetricStatistics", {
          Namespace: "AWS/ECS",
          MetricName: metric,
          "Dimensions.member.1.Name": "ClusterName",
          "Dimensions.member.1.Value": cluster,
          "Dimensions.member.2.Name": "ServiceName",
          "Dimensions.member.2.Value": serviceName,
          StartTime: startTime.toISOString(),
          EndTime: endTime.toISOString(),
          Period: "300",
          "Statistics.member.1": "Average",
        }, accessKey, secretKey);
        const match = xml.match(/<Average>([^<]+)<\/Average>/);
        if (match) {
          if (metric === "CPUUtilization") cpuPercent = parseFloat(match[1]);
          else memPercent = parseFloat(match[1]);
        }
      } catch (e) {
        console.error(`ECS CW metric ${metric} error:`, e.message);
      }
    }

    const responseTime = Date.now() - start;
    let status: "online" | "warning" | "offline" = "online";
    if (runningCount === 0 && desiredCount > 0) status = "offline";
    else if (runningCount < desiredCount) status = "warning";

    const ecsDetails = {
      cluster,
      service_name: serviceName,
      running_count: runningCount,
      desired_count: desiredCount,
      pending_count: pendingCount,
      cpu_percent: Math.round(cpuPercent * 100) / 100,
      memory_percent: Math.round(memPercent * 100) / 100,
      deployments,
      launch_type: svcInfo.launchType || "UNKNOWN",
      status: svcInfo.status,
      region,
    };

    if (serviceId) {
      const existingConfig = { ...config };
      existingConfig._ecs_details = ecsDetails;

      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status,
        response_time: responseTime,
        cpu: cpuPercent,
        memory: memPercent,
        error_message: status !== "online" ? `Running: ${runningCount}/${desiredCount}` : null,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      await supabase.from("services").update({
        status,
        response_time: responseTime,
        cpu: Math.round(cpuPercent * 100) / 100,
        memory: Math.round(memPercent * 100) / 100,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: existingConfig,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({
      success: true,
      metrics: { status, response_time: responseTime, cpu: cpuPercent, memory: memPercent, error_message: null, ...ecsDetails },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("ECS metrics error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
