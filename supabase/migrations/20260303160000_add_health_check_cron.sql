-- Schedule health-check edge function every 1 minute via pg_net
-- The edge function itself respects each service's check_interval_seconds
-- so it will only actually check services that are due.

-- First remove if exists (idempotent)
SELECT cron.unschedule('health-check-cron')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'health-check-cron'
);

-- Schedule: every 1 minute, call the health-check edge function
-- The function was deployed with --no-verify-jwt so no auth header needed
SELECT cron.schedule(
  'health-check-cron',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://zzkwldfssxopclqsxtku.supabase.co/functions/v1/health-check',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
