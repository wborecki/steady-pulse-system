-- RPCs for Supabase self-monitoring

-- 1. PostgreSQL version
CREATE OR REPLACE FUNCTION public.get_pg_version()
RETURNS TABLE(version text) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT version()::text AS version;
$$;

-- 2. Database size
CREATE OR REPLACE FUNCTION public.get_db_size()
RETURNS TABLE(db_size text, db_size_bytes bigint) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    pg_size_pretty(pg_database_size(current_database())) AS db_size,
    pg_database_size(current_database()) AS db_size_bytes;
$$;

-- 3. Connection stats
CREATE OR REPLACE FUNCTION public.get_db_connections()
RETURNS TABLE(total bigint, active bigint, idle bigint, idle_in_transaction bigint, max_connections int) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    count(*)::bigint AS total,
    count(*) FILTER (WHERE state = 'active')::bigint AS active,
    count(*) FILTER (WHERE state = 'idle')::bigint AS idle,
    count(*) FILTER (WHERE state = 'idle in transaction')::bigint AS idle_in_transaction,
    current_setting('max_connections')::int AS max_connections
  FROM pg_stat_activity
  WHERE datname = current_database();
$$;

-- 4. Cache hit ratio
CREATE OR REPLACE FUNCTION public.get_cache_hit_ratio()
RETURNS TABLE(ratio numeric) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    CASE
      WHEN (blks_hit + blks_read) = 0 THEN 100
      ELSE round(blks_hit::numeric / (blks_hit + blks_read) * 100, 2)
    END AS ratio
  FROM pg_stat_database
  WHERE datname = current_database();
$$;

-- 5. Table count (public schema)
CREATE OR REPLACE FUNCTION public.get_table_count()
RETURNS TABLE(count bigint) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT count(*)::bigint
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
$$;

-- 6. Active queries (excluding self)
CREATE OR REPLACE FUNCTION public.get_active_queries()
RETURNS TABLE(pid int, duration interval, state text, query text, wait_event text) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    pid::int,
    now() - query_start AS duration,
    state::text,
    left(query, 200)::text AS query,
    coalesce(wait_event_type || '/' || wait_event, '')::text AS wait_event
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid()
    AND state = 'active'
  ORDER BY query_start ASC
  LIMIT 10;
$$;

-- Grant access to anon and authenticated for RPC calls
GRANT EXECUTE ON FUNCTION public.get_pg_version() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_db_size() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_db_connections() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_cache_hit_ratio() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_table_count() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_active_queries() TO service_role;
