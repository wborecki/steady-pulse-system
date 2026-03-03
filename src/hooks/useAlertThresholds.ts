import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface AlertThreshold {
  id: string;
  service_id: string;
  metric: string;
  operator: string;
  threshold: number;
  severity: string;
  enabled: boolean;
  cooldown_minutes: number;
  last_triggered_at: string | null;
  created_at: string;
}

export function useAlertThresholds(serviceId: string | undefined) {
  return useQuery({
    queryKey: ['alert_thresholds', serviceId],
    queryFn: async () => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from('alert_thresholds')
        .select('*')
        .eq('service_id', serviceId)
        .order('metric');
      if (error) throw error;
      return data as AlertThreshold[];
    },
    enabled: !!serviceId,
  });
}

export function useUpsertThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<AlertThreshold> & { service_id: string; metric: string; operator: string; threshold: number }) => {
      // Use upsert on unique constraint
      const { data, error } = await supabase
        .from('alert_thresholds')
        .upsert(t as any, { onConflict: 'service_id,metric,operator' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['alert_thresholds', vars.service_id] });
    },
  });
}

export function useDeleteThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, serviceId }: { id: string; serviceId: string }) => {
      const { error } = await supabase.from('alert_thresholds').delete().eq('id', id);
      if (error) throw error;
      return serviceId;
    },
    onSuccess: (serviceId) => {
      qc.invalidateQueries({ queryKey: ['alert_thresholds', serviceId] });
    },
  });
}

export function useToggleThreshold() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, enabled, serviceId }: { id: string; enabled: boolean; serviceId: string }) => {
      const { error } = await supabase.from('alert_thresholds').update({ enabled }).eq('id', id);
      if (error) throw error;
      return serviceId;
    },
    onSuccess: (serviceId) => {
      qc.invalidateQueries({ queryKey: ['alert_thresholds', serviceId] });
    },
  });
}
