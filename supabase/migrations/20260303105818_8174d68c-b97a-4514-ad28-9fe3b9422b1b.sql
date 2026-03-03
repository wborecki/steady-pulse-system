
-- Drop existing permissive policies
DROP POLICY IF EXISTS "Allow full access to services" ON public.services;
DROP POLICY IF EXISTS "Allow full access to alerts" ON public.alerts;
DROP POLICY IF EXISTS "Allow full access to health_checks" ON public.health_checks;
DROP POLICY IF EXISTS "Allow full access to alert_thresholds" ON public.alert_thresholds;

-- Services: all authenticated users can CRUD (shared team resource)
CREATE POLICY "Authenticated users can read services"
ON public.services FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert services"
ON public.services FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update services"
ON public.services FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete services"
ON public.services FOR DELETE TO authenticated USING (true);

-- Alert thresholds: all authenticated users can CRUD (shared team resource)
CREATE POLICY "Authenticated users can read alert_thresholds"
ON public.alert_thresholds FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert alert_thresholds"
ON public.alert_thresholds FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can update alert_thresholds"
ON public.alert_thresholds FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can delete alert_thresholds"
ON public.alert_thresholds FOR DELETE TO authenticated USING (true);

-- Alerts: authenticated can read and update (acknowledge), inserts via service role only
CREATE POLICY "Authenticated users can read alerts"
ON public.alerts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can update alerts"
ON public.alerts FOR UPDATE TO authenticated USING (true);

-- Health checks: read-only for authenticated, writes via service role (edge functions)
CREATE POLICY "Authenticated users can read health_checks"
ON public.health_checks FOR SELECT TO authenticated USING (true);
