-- Extend credentials.credential_type check constraint to include sql_server and supabase
ALTER TABLE public.credentials
  DROP CONSTRAINT IF EXISTS credentials_credential_type_check;

ALTER TABLE public.credentials
  ADD CONSTRAINT credentials_credential_type_check
  CHECK (credential_type IN (
    'aws', 'agent', 'airflow', 'postgresql', 'mongodb', 'azure_sql', 'ssh', 'http_auth', 'supabase', 'sql_server'
  ));
