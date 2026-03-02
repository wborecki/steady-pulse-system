
-- Create function to calculate uptime for a service (% of online checks in last 24h)
CREATE OR REPLACE FUNCTION public.calculate_uptime(p_service_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    ROUND(
      (COUNT(*) FILTER (WHERE status = 'online')::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
      2
    ),
    0
  )
  FROM public.health_checks
  WHERE service_id = p_service_id
    AND checked_at >= now() - interval '24 hours';
$$;
