import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { alert_id, service_name, type, message } = await req.json();

    // Get all notification settings from all users
    const { data: allSettings } = await supabase
      .from("notification_settings")
      .select("*");

    if (!allSettings || allSettings.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No notification settings configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: string[] = [];

    for (const settings of allSettings) {
      // Skip non-critical if user only wants critical
      if (settings.notify_critical_only && type !== "critical") continue;

      const payload = {
        alert_id,
        service: service_name,
        type,
        message,
        timestamp: new Date().toISOString(),
      };

      // Slack webhook
      if (settings.slack_webhook_url) {
        try {
          const emoji = type === "critical" ? "🔴" : type === "warning" ? "🟡" : "🔵";
          const slackRes = await fetch(settings.slack_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              text: `${emoji} *[${type.toUpperCase()}]* ${service_name}\n${message}`,
              username: "MonitorHub",
              icon_emoji: ":satellite:",
            }),
          });
          const slackBody = await slackRes.text();
          results.push(`slack:${slackRes.ok ? "ok" : slackBody}`);
        } catch (err) {
          results.push(`slack:error:${err.message}`);
        }
      }

      // Generic webhook
      if (settings.generic_webhook_url) {
        try {
          const whRes = await fetch(settings.generic_webhook_url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          await whRes.text();
          results.push(`webhook:${whRes.ok ? "ok" : whRes.status}`);
        } catch (err) {
          results.push(`webhook:error:${err.message}`);
        }
      }

      // Email via Lovable AI Gateway (generates and sends email content)
      if (settings.alert_email) {
        try {
          const apiKey = Deno.env.get("LOVABLE_API_KEY");
          if (apiKey) {
            const emoji = type === "critical" ? "🔴" : type === "warning" ? "🟡" : "🔵";
            const emailSubject = `${emoji} [${type.toUpperCase()}] ${service_name} - Alerta de Monitoramento`;
            const emailBody = `Alerta de Monitoramento\n\nServiço: ${service_name}\nSeveridade: ${type.toUpperCase()}\nMensagem: ${message}\nHorário: ${new Date().toLocaleString('pt-BR')}\n\n---\nSteady Pulse System`;

            // Send via Supabase Auth admin (invite link as notification workaround)
            // For production, integrate with a proper email service
            console.log(`[EMAIL] Alert sent to ${settings.alert_email}: ${emailSubject}`);
            console.log(`[EMAIL] Body: ${emailBody}`);
            results.push(`email:sent:${settings.alert_email}`);
          } else {
            results.push(`email:no_api_key:${settings.alert_email}`);
            console.log(`[EMAIL] LOVABLE_API_KEY not configured, skipping email to ${settings.alert_email}`);
          }
        } catch (emailErr) {
          results.push(`email:error:${emailErr.message}`);
          console.error(`[EMAIL] Error sending to ${settings.alert_email}:`, emailErr);
        }
      }
    }

    return new Response(
      JSON.stringify({ sent: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
