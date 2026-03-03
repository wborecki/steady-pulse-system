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

async function awsRequest(region: string, action: string, params: Record<string, string>, accessKey: string, secretKey: string) {
  const host = `monitoring.${region}.amazonaws.com`;
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "").slice(0, 15) + "Z";
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

function parseAlarms(xml: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const alarms: any[] = [];
  const members = xml.split("<member>").slice(1);
  for (const member of members) {
    const get = (tag: string) => {
      const m = member.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
      return m ? m[1] : null;
    };
    const name = get("AlarmName");
    if (!name) continue;
    alarms.push({
      name,
      state: get("StateValue") || "UNKNOWN",
      metric_name: get("MetricName"),
      namespace: get("Namespace"),
      threshold: get("Threshold") ? parseFloat(get("Threshold")!) : null,
      comparison: get("ComparisonOperator"),
      period: get("Period") ? parseInt(get("Period")!) : null,
      evaluation_periods: get("EvaluationPeriods") ? parseInt(get("EvaluationPeriods")!) : null,
      statistic: get("Statistic"),
      state_reason: get("StateReason"),
      updated_at: get("StateUpdatedTimestamp"),
    });
  }
  return alarms;
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
    const alarmPrefix = (config.alarm_prefix as string) || "";

    const start = Date.now();

    const params: Record<string, string> = {};
    if (alarmPrefix) params["AlarmNamePrefix"] = alarmPrefix;

    const xml = await awsRequest(region, "DescribeAlarms", params, accessKey, secretKey);
    const alarms = parseAlarms(xml);
    const responseTime = Date.now() - start;

    const alarmCount = alarms.filter(a => a.state === "ALARM").length;
    const okCount = alarms.filter(a => a.state === "OK").length;
    const insuffCount = alarms.filter(a => a.state === "INSUFFICIENT_DATA").length;

    // Fetch configurable rules
    const { data: ruleRow } = await supabase.from("check_type_status_rules").select("warning_rules, offline_rules").eq("check_type", "cloudwatch_alarms").single();
    const wr = (ruleRow?.warning_rules ?? { insufficient_data_ratio_gt: 50 }) as Record<string, number>;
    const or = (ruleRow?.offline_rules ?? { alarm_count_gt: 0 }) as Record<string, number>;

    const insuffRatio = alarms.length > 0 ? (insuffCount / alarms.length) * 100 : 0;

    let status: "online" | "warning" | "offline" = "online";
    if (alarmCount > (or.alarm_count_gt ?? 0)) status = "offline";
    else if (insuffRatio > (wr.insufficient_data_ratio_gt ?? 50)) status = "warning";

    const cwDetails = {
      alarms,
      summary: {
        total: alarms.length,
        alarm: alarmCount,
        ok: okCount,
        insufficient_data: insuffCount,
      },
      region,
      alarm_prefix: alarmPrefix || null,
    };

    if (serviceId) {
      const existingConfig = { ...config };
      existingConfig._cw_alarms_details = cwDetails;

      await supabase.from("health_checks").insert({
        service_id: serviceId,
        status,
        response_time: responseTime,
        cpu: alarmCount,
        memory: okCount,
        disk: insuffCount,
        error_message: alarmCount > 0 ? `${alarmCount} alarm(s) firing` : null,
      });

      const { data: uptimeData } = await supabase.rpc("calculate_uptime", { p_service_id: serviceId });

      await supabase.from("services").update({
        status,
        response_time: responseTime,
        cpu: alarmCount,
        memory: okCount,
        disk: insuffCount,
        last_check: new Date().toISOString(),
        uptime: uptimeData ?? 0,
        check_config: existingConfig,
      }).eq("id", serviceId);
    }

    return new Response(JSON.stringify({
      success: true,
      metrics: { status, response_time: responseTime, cpu: alarmCount, memory: okCount, disk: insuffCount, error_message: null, ...cwDetails },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("CloudWatch Alarms error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
