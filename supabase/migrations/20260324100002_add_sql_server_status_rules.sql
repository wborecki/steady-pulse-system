-- Add default status rules for sql_server check type (same thresholds as sql_query)
INSERT INTO public.check_type_status_rules (check_type, warning_rules, offline_rules)
VALUES ('sql_server', '{"cpu_gt": 90, "memory_gt": 90, "storage_gt": 95}', '{}')
ON CONFLICT (check_type) DO NOTHING;
