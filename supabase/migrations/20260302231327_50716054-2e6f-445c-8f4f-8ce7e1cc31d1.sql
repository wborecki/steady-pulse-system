
-- Add new check_type enum values
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'lambda';
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'ecs';
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'cloudwatch_alarms';
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'systemctl';
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'container';

-- Add new service_category enum value
ALTER TYPE public.service_category ADD VALUE IF NOT EXISTS 'container';
