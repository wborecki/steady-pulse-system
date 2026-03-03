import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
    refetchInterval: 30000,
  });
}

export function useService(id: string | undefined) {
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
    refetchInterval: 15000,
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (service: Partial<DbService>) => {
      const { data, error } = await supabase
        .from('services')
        .insert(service as any)
        .select()
        .single();
      if (error) throw error;

      // Create default thresholds for the new service
      if (data?.id) {
        const defaults = [
          { service_id: data.id, metric: 'cpu', operator: 'gt', threshold: 90, severity: 'critical' },
          { service_id: data.id, metric: 'memory', operator: 'gt', threshold: 85, severity: 'warning' },
          { service_id: data.id, metric: 'disk', operator: 'gt', threshold: 90, severity: 'critical' },
        ];
        await supabase.from('alert_thresholds').insert(defaults as any);
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
