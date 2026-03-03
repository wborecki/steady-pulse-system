-- RPC: Compute dashboard health stats server-side instead of fetching 1000 rows
-- Returns aggregated stats for the last 24h: counts by status, avg response time, timeline data

CREATE OR REPLACE FUNCTION get_dashboard_health_stats(p_hours integer DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
  since_ts timestamptz;
BEGIN
  since_ts := now() - (p_hours || ' hours')::interval;

  SELECT jsonb_build_object(
    'total_checks', COALESCE(COUNT(*), 0),
    'online_checks', COALESCE(COUNT(*) FILTER (WHERE status IN ('online', 'warning')), 0),
    'offline_checks', COALESCE(COUNT(*) FILTER (WHERE status = 'offline'), 0),
    'warning_checks', COALESCE(COUNT(*) FILTER (WHERE status = 'warning'), 0),
    'avg_response_time', COALESCE(ROUND(AVG(response_time)::numeric, 0), 0),
    'sla_percentage', CASE
      WHEN COUNT(*) > 0 THEN ROUND(
        (COUNT(*) FILTER (WHERE status IN ('online', 'warning'))::numeric / COUNT(*)::numeric) * 100, 2
      )
      ELSE 0
    END,
    'timeline', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.bucket)
      FROM (
        SELECT
          to_char(date_trunc('hour', checked_at), 'HH24:MI') AS bucket,
          ROUND(AVG(response_time)::numeric, 0) AS avg_response_time,
          COUNT(*) AS total,
          COUNT(*) FILTER (WHERE status IN ('online', 'warning')) AS available,
          COUNT(*) FILTER (WHERE status NOT IN ('online')) AS incidents,
          ROUND(
            (COUNT(*) FILTER (WHERE status IN ('online', 'warning'))::numeric /
             NULLIF(COUNT(*)::numeric, 0)) * 100, 1
          ) AS availability_pct
        FROM health_checks
        WHERE checked_at >= since_ts
        GROUP BY date_trunc('hour', checked_at)
        ORDER BY date_trunc('hour', checked_at)
      ) t
    ), '[]'::jsonb),
    'incidents_by_category', COALESCE((
      SELECT jsonb_agg(row_to_json(c))
      FROM (
        SELECT
          s.category,
          COUNT(*) AS incident_count
        FROM health_checks hc
        JOIN services s ON s.id = hc.service_id
        WHERE hc.checked_at >= since_ts AND hc.status NOT IN ('online')
        GROUP BY s.category
        ORDER BY COUNT(*) DESC
      ) c
    ), '[]'::jsonb)
  ) INTO result
  FROM health_checks
  WHERE checked_at >= since_ts;

  RETURN result;
END;
$$;
