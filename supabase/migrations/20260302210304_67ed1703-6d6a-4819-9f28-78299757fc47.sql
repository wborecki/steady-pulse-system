-- Add new check_type values
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'postgresql';
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'mongodb';
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'cloudwatch';
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 's3';
