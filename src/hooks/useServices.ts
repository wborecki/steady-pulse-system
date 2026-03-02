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
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['services'] }),
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
