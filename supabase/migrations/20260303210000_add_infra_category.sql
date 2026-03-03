-- Add 'infra' category and 'supabase_project' check_type for Supabase project monitoring
ALTER TYPE public.service_category ADD VALUE IF NOT EXISTS 'infra';
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'supabase_project';
