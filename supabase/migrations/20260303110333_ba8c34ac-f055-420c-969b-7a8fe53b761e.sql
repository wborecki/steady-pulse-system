CREATE OR REPLACE FUNCTION public.calculate_uptime(p_service_id uuid)
 RETURNS numeric
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    ROUND(
      (COUNT(*) FILTER (WHERE status IN ('online', 'warning'))::numeric / NULLIF(COUNT(*)::numeric, 0)) * 100,
      2
    ),
    0
  )
  FROM public.health_checks
  WHERE service_id = p_service_id
    AND checked_at >= now() - interval '24 hours';
$$;