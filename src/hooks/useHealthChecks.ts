import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbHealthCheck {
  id: string;
  service_id: string;
  status: string;
  response_time: number;
  cpu: number;
  memory: number;
  disk: number;
  status_code: number | null;
  error_message: string | null;
  checked_at: string;
}

export function useHealthCheckHistory(serviceId: string | undefined, limit = 50) {
  return useQuery({
    queryKey: ['health_checks', serviceId, limit],
    queryFn: async () => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from('health_checks')
        .select('*')
        .eq('service_id', serviceId)
        .order('checked_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data as DbHealthCheck[];
    },
    enabled: !!serviceId,
    refetchInterval: 30000,
  });
}

export function useFilteredHealthChecks(
  serviceId: string | undefined,
  options: {
    statusFilter?: string;
    periodHours?: number;
    page?: number;
    perPage?: number;
  } = {}
) {
  const { statusFilter, periodHours = 24, page = 0, perPage = 50 } = options;
  return useQuery({
    queryKey: ['health_checks_filtered', serviceId, statusFilter, periodHours, page, perPage],
    queryFn: async () => {
      if (!serviceId) return { data: [] as DbHealthCheck[], count: 0 };
      let query = supabase
        .from('health_checks')
        .select('*', { count: 'exact' })
        .eq('service_id', serviceId)
        .gte('checked_at', new Date(Date.now() - periodHours * 60 * 60 * 1000).toISOString())
        .order('checked_at', { ascending: false })
        .range(page * perPage, (page + 1) * perPage - 1);

      if (statusFilter && statusFilter !== 'all') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        query = query.eq('status', statusFilter as any);
      }

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data as DbHealthCheck[], count: count ?? 0 };
    },
    enabled: !!serviceId,
    refetchInterval: 30000,
  });
}

export function useAllRecentHealthChecks() {
  return useQuery({
    queryKey: ['health_checks_recent'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_checks')
        .select('*')
        .order('checked_at', { ascending: true })
        .gte('checked_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1000);
      if (error) throw error;
      return data as DbHealthCheck[];
    },
    refetchInterval: 30000,
  });
}

export function useHealthChecksForPeriod(periodDays: number = 7) {
  return useQuery({
    queryKey: ['health_checks_period', periodDays],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('health_checks')
        .select('*')
        .order('checked_at', { ascending: true })
        .gte('checked_at', new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString())
        .limit(1000);
      if (error) throw error;
      return data as DbHealthCheck[];
    },
    refetchInterval: 60000,
  });
}

export function useTriggerHealthCheck() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (serviceId?: string) => {
      const url = serviceId
        ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-check?service_id=${serviceId}`
        : `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/health-check`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (_, serviceId) => {
      qc.invalidateQueries({ queryKey: ['services'] });
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['health_checks'] });
      qc.invalidateQueries({ queryKey: ['health_checks_recent'] });
      qc.invalidateQueries({ queryKey: ['health_checks_filtered'] });
      qc.invalidateQueries({ queryKey: ['health_checks_period'] });
      if (serviceId) {
        qc.invalidateQueries({ queryKey: ['service', serviceId] });
      }
    },
  });
}
