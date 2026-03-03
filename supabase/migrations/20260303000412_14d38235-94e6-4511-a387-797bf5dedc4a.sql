
-- Enable pg_cron and pg_net extensions
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create notification_settings table
CREATE TABLE public.notification_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  alert_email text,
  slack_webhook_url text,
  generic_webhook_url text,
  notify_critical_only boolean NOT NULL DEFAULT false,
  sound_alerts boolean NOT NULL DEFAULT false,
  auto_refresh boolean NOT NULL DEFAULT true,
  check_interval_seconds integer NOT NULL DEFAULT 30,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own notification settings"
  ON public.notification_settings FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Unique constraint: one settings row per user
CREATE UNIQUE INDEX idx_notification_settings_user ON public.notification_settings(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Data retention: function to cleanup old health checks (> 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_health_checks()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.health_checks
  WHERE checked_at < now() - interval '30 days';
$$;

-- Schedule cleanup daily at 3 AM UTC
SELECT cron.schedule(
  'cleanup-old-health-checks',
  '0 3 * * *',
  $$SELECT public.cleanup_old_health_checks();$$
);
