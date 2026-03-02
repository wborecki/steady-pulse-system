import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbAlert {
  id: string;
  service_id: string;
  type: string;
  message: string;
  acknowledged: boolean;
  created_at: string;
  services?: { name: string };
}

export function useAlerts() {
  return useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*, services(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as DbAlert[];
    },
    refetchInterval: 15000,
  });
}

export function useAcknowledgeAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('alerts')
        .update({ acknowledged: true })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}

export function useAcknowledgeAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('alerts')
        .update({ acknowledged: true })
        .eq('acknowledged', false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['alerts'] }),
  });
}
