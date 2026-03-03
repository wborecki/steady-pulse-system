import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CheckTypeStatusRule {
  id: string;
  check_type: string;
  warning_rules: Record<string, unknown>;
  offline_rules: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export function useCheckTypeRules() {
  return useQuery({
    queryKey: ['check-type-status-rules'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('check_type_status_rules' as any)
        .select('*')
        .order('check_type');
      if (error) throw error;
      return data as unknown as CheckTypeStatusRule[];
    },
  });
}

export function useUpdateCheckTypeRule() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, warning_rules, offline_rules }: { id: string; warning_rules: Record<string, unknown>; offline_rules: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('check_type_status_rules' as any)
        .update({ warning_rules, offline_rules } as any)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['check-type-status-rules'] }),
  });
}
