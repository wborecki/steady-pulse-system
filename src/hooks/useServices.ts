import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useRefreshInterval } from './useRefreshInterval';

export interface DbService {
  id: string;
  name: string;
  category: string;
  status: string;
  uptime: number;
  cpu: number;
  memory: number;
  disk: number;
  response_time: number;
  last_check: string | null;
  url: string | null;
  description: string;
  region: string | null;
  check_type: string;
  check_config: Record<string, unknown>;
  check_interval_seconds: number;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useServices() {
  const refetchInterval = useRefreshInterval(30000);
  return useQuery({
    queryKey: ['services'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as DbService[];
    },
    refetchInterval,
  });
}

export function useService(id: string | undefined) {
  const refetchInterval = useRefreshInterval(15000);
  return useQuery({
    queryKey: ['service', id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .single();
      if (error) throw error;
      return data as DbService;
    },
    enabled: !!id,
    refetchInterval,
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (service: Partial<DbService>) => {
      const { data, error } = await supabase
        .from('services')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .insert(service as any)
        .select()
        .single();
      if (error) throw error;

      // Create default thresholds based on check type
      if (data?.id) {
        const ct = (service as Record<string, unknown>).check_type as string || 'http';
        const infraTypes = ['systemctl', 'container', 'cloudwatch', 'sql_query', 'mongodb'];
        const defaults: { service_id: string; metric: string; operator: string; threshold: number; severity: string }[] = [];

        // All types get response_time threshold
        defaults.push({ service_id: data.id, metric: 'response_time', operator: 'gt', threshold: 5000, severity: 'warning' });

        // Only infra/server types get CPU/memory/disk thresholds
        if (infraTypes.includes(ct)) {
          defaults.push(
            { service_id: data.id, metric: 'cpu', operator: 'gt', threshold: 90, severity: 'critical' },
            { service_id: data.id, metric: 'memory', operator: 'gt', threshold: 85, severity: 'warning' },
            { service_id: data.id, metric: 'disk', operator: 'gt', threshold: 90, severity: 'critical' },
          );
        } else if (['postgresql', 'ecs', 'airflow'].includes(ct)) {
          defaults.push(
            { service_id: data.id, metric: 'cpu', operator: 'gt', threshold: 90, severity: 'critical' },
            { service_id: data.id, metric: 'memory', operator: 'gt', threshold: 85, severity: 'warning' },
          );
        }

        if (defaults.length > 0) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await supabase.from('alert_thresholds').insert(defaults as any);
        }
      }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}

export function useUpdateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<DbService> & { id: string }) => {
      const { data, error } = await supabase
        .from('services')
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(updates as any)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['services'] });
      qc.invalidateQueries({ queryKey: ['service', vars.id] });
    },
  });
}

export function useDeleteService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('services').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
  });
}
