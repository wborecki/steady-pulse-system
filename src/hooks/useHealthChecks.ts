import { useQuery, useMutation } from '@tanstack/react-query';
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

export function useTriggerHealthCheck() {
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
  });
}
