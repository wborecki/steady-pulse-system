
-- Table for configurable status rules per check_type
CREATE TABLE public.check_type_status_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_type text UNIQUE NOT NULL,
  warning_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  offline_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.check_type_status_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read check_type_status_rules"
  ON public.check_type_status_rules FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update check_type_status_rules"
  ON public.check_type_status_rules FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert check_type_status_rules"
  ON public.check_type_status_rules FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can delete check_type_status_rules"
  ON public.check_type_status_rules FOR DELETE TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_check_type_status_rules_updated_at
  BEFORE UPDATE ON public.check_type_status_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed with current hardcoded defaults
INSERT INTO public.check_type_status_rules (check_type, warning_rules, offline_rules) VALUES
  ('http', '{"response_time_gt": 5000}', '{"status_code_gte": 500}'),
  ('airflow', '{"import_errors_gt": 0, "success_rate_lt": 50, "failed_runs_gt": 10, "failed_runs_success_rate_lt": 70}', '{"scheduler_down": true, "metadatabase_down": true}'),
  ('server', '{"cpu_gt": 80, "memory_gt": 80, "disk_gt": 80}', '{"cpu_gt": 95, "memory_gt": 95, "disk_gt": 95}'),
  ('sql_query', '{"cpu_gt": 90, "memory_gt": 90, "storage_gt": 95}', '{}'),
  ('postgresql', '{"cache_hit_lt": 80, "active_connections_gt": 50}', '{}'),
  ('mongodb', '{"connection_percent_gt": 80, "memory_percent_gt": 90}', '{}'),
  ('lambda', '{"error_rate_gt": 2, "throttles_gt": 0}', '{"error_rate_gt": 10, "throttles_gt": 5}'),
  ('ecs', '{"running_lt_desired": true}', '{"running_zero": true}'),
  ('cloudwatch_alarms', '{"insufficient_data_ratio_gt": 50}', '{"alarm_count_gt": 0}'),
  ('systemctl', '{"inactive_gt": 0}', '{"failed_gt": 0}'),
  ('container', '{"stopped_gt": 0}', '{"unhealthy_gt": 0, "running_zero": true}');
