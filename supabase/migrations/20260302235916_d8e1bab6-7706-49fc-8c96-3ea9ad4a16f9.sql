
-- Table for configurable alert thresholds per service
CREATE TABLE public.alert_thresholds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  metric text NOT NULL, -- 'cpu', 'memory', 'disk', 'response_time', 'error_rate'
  operator text NOT NULL DEFAULT 'gt', -- 'gt', 'lt', 'gte', 'lte'
  threshold numeric NOT NULL,
  severity text NOT NULL DEFAULT 'warning', -- 'warning', 'critical'
  enabled boolean NOT NULL DEFAULT true,
  cooldown_minutes integer NOT NULL DEFAULT 15,
  last_triggered_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(service_id, metric, operator)
);

ALTER TABLE public.alert_thresholds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access to alert_thresholds"
  ON public.alert_thresholds FOR ALL
  USING (true) WITH CHECK (true);
