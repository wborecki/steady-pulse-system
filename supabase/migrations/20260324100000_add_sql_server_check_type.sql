-- Add sql_server check type (on-premises SQL Server, distinct from azure sql / sql_query)
ALTER TYPE public.check_type ADD VALUE IF NOT EXISTS 'sql_server';
