import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ExecResult {
  success: boolean;
  exit_code: number;
  stdout: string;
  stderr: string;
  error?: string;
  truncated?: boolean;
}

interface ExecParams {
  serviceId?: string;
  credentialId?: string;
  command: string;
  timeout?: number;
}

export function useRemoteExec() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({ serviceId, credentialId, command, timeout = 30 }: ExecParams): Promise<ExecResult> => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Não autenticado');

      const res = await supabase.functions.invoke('remote-exec', {
        body: {
          ...(serviceId ? { service_id: serviceId } : {}),
          ...(credentialId ? { credential_id: credentialId } : {}),
          command,
          timeout,
        },
      });

      // supabase.functions.invoke returns error for non-2xx, but we now
      // always return 200 from the Edge Function. Handle both cases:
      const result = (res.data ?? res.error?.context ?? null) as ExecResult | null;

      if (!result) {
        throw new Error(res.error?.message || 'Erro ao conectar com a Edge Function');
      }

      // Save to command history (only for service mode — FK requires valid services.id)
      if (serviceId) {
        await supabase.from('command_history').insert({
          user_id: session.user.id,
          service_id: serviceId,
          command,
          exit_code: result.exit_code ?? -1,
          stdout: result.stdout?.slice(0, 10000) || '',
          stderr: result.stderr?.slice(0, 10000) || '',
          success: result.success ?? false,
        });

        qc.invalidateQueries({ queryKey: ['command-history', serviceId] });
      }

      return result;
    },
  });
}

export function useCommandHistory(serviceId: string | undefined, limit = 20) {
  return useQuery({
    queryKey: ['command-history', serviceId, limit],
    queryFn: async () => {
      if (!serviceId) return [];
      const { data, error } = await supabase
        .from('command_history')
        .select('*')
        .eq('service_id', serviceId)
        .order('executed_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data;
    },
    enabled: !!serviceId,
  });
}
