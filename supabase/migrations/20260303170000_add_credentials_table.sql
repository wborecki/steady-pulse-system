-- Create the set_updated_at function if it doesn't exist
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create credentials table for reusable connection/credential profiles
CREATE TABLE IF NOT EXISTS public.credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  credential_type TEXT NOT NULL CHECK (credential_type IN (
    'aws', 'agent', 'airflow', 'postgresql', 'mongodb', 'azure_sql', 'ssh', 'http_auth'
  )),
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add updated_at trigger
CREATE TRIGGER set_credentials_updated_at
  BEFORE UPDATE ON public.credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view credentials"
  ON public.credentials FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert credentials"
  ON public.credentials FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update credentials"
  ON public.credentials FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete credentials"
  ON public.credentials FOR DELETE
  TO authenticated
  USING (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.credentials;

-- Index for fast lookups by type
CREATE INDEX idx_credentials_type ON public.credentials (credential_type);
