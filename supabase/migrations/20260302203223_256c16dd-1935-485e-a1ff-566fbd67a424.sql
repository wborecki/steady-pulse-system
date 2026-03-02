
-- Enum for service categories
CREATE TYPE public.service_category AS ENUM ('aws', 'database', 'airflow', 'server', 'process', 'api');

-- Enum for service status
CREATE TYPE public.service_status AS ENUM ('online', 'offline', 'warning', 'maintenance');

-- Enum for check types
CREATE TYPE public.check_type AS ENUM ('http', 'tcp', 'process', 'sql_query', 'custom');

-- Enum for alert severity
CREATE TYPE public.alert_type AS ENUM ('critical', 'warning', 'info');

-- Services table
CREATE TABLE public.services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  category service_category NOT NULL DEFAULT 'server',
  status service_status NOT NULL DEFAULT 'offline',
  uptime NUMERIC(6,3) NOT NULL DEFAULT 0,
  cpu NUMERIC(5,2) NOT NULL DEFAULT 0,
  memory NUMERIC(5,2) NOT NULL DEFAULT 0,
  disk NUMERIC(5,2) NOT NULL DEFAULT 0,
  response_time INTEGER NOT NULL DEFAULT 0,
  last_check TIMESTAMP WITH TIME ZONE,
  url TEXT,
  description TEXT NOT NULL DEFAULT '',
  region TEXT,
  check_type check_type NOT NULL DEFAULT 'http',
  check_config JSONB DEFAULT '{}',
  check_interval_seconds INTEGER NOT NULL DEFAULT 60,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Health checks history
CREATE TABLE public.health_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  status service_status NOT NULL,
  response_time INTEGER DEFAULT 0,
  cpu NUMERIC(5,2) DEFAULT 0,
  memory NUMERIC(5,2) DEFAULT 0,
  disk NUMERIC(5,2) DEFAULT 0,
  status_code INTEGER,
  error_message TEXT,
  checked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Alerts table
CREATE TABLE public.alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  type alert_type NOT NULL DEFAULT 'info',
  message TEXT NOT NULL,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Public read/write for now (no auth required for monitoring system)
CREATE POLICY "Allow full access to services" ON public.services FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to health_checks" ON public.health_checks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow full access to alerts" ON public.alerts FOR ALL USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX idx_health_checks_service_id ON public.health_checks(service_id);
CREATE INDEX idx_health_checks_checked_at ON public.health_checks(checked_at DESC);
CREATE INDEX idx_alerts_service_id ON public.alerts(service_id);
CREATE INDEX idx_alerts_created_at ON public.alerts(created_at DESC);
CREATE INDEX idx_services_status ON public.services(status);
CREATE INDEX idx_services_enabled ON public.services(enabled);

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON public.services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
