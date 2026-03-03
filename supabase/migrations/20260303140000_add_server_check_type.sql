-- Add 'server' to check_type enum
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'server';

-- Add status rules for the new 'server' check_type
INSERT INTO public.check_type_status_rules (check_type, warning_rules, offline_rules)
VALUES (
  'server',
  '{"cpu_gt": 80, "memory_gt": 80, "disk_gt": 80}'::jsonb,
  '{"cpu_gt": 95, "memory_gt": 95, "disk_gt": 95}'::jsonb
)
ON CONFLICT (check_type) DO NOTHING;
