import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CommandSnippet {
  id: string;
  name: string;
  description: string;
  command: string;
  category: string;
  is_builtin: boolean;
  created_at: string;
  updated_at: string;
}

export const BUILTIN_SNIPPETS: Omit<CommandSnippet, 'id' | 'created_at' | 'updated_at' | 'is_builtin'>[] = [
  { name: 'Uso de Disco', description: 'Exibir uso de disco de todas as partições', command: 'df -h', category: 'sistema' },
  { name: 'Memória Livre', description: 'Exibir uso de memória RAM e swap', command: 'free -h', category: 'sistema' },
  { name: 'Uptime', description: 'Tempo de atividade e load average', command: 'uptime', category: 'sistema' },
  { name: 'Top Processos (CPU)', description: 'Top 10 processos por uso de CPU', command: 'ps aux --sort=-%cpu', category: 'processos' },
  { name: 'Top Processos (Memória)', description: 'Top 10 processos por uso de memória', command: 'ps aux --sort=-%mem', category: 'processos' },
  { name: 'Conexões de Rede', description: 'Conexões TCP ativas', command: 'ss -tuln', category: 'rede' },
  { name: 'Interfaces de Rede', description: 'Listar interfaces e IPs', command: 'ip addr', category: 'rede' },
  { name: 'Serviços Systemd', description: 'Serviços systemd em execução', command: 'systemctl list-units --type=service --state=running', category: 'serviços' },
  { name: 'Serviços Falhos', description: 'Serviços systemd com falha', command: 'systemctl list-units --type=service --state=failed', category: 'serviços' },
  { name: 'Containers Docker', description: 'Listar todos os containers', command: 'docker ps -a', category: 'docker' },
  { name: 'Docker Stats', description: 'Stats de containers em execução', command: 'docker stats --no-stream', category: 'docker' },
  { name: 'Logs do Sistema', description: 'Últimas 50 linhas do journal', command: 'journalctl -n 50 --no-pager', category: 'logs' },
  { name: 'Logs de Kernel', description: 'Últimas mensagens do kernel', command: 'dmesg --time-format iso', category: 'logs' },
  { name: 'Info do SO', description: 'Informações do sistema operacional', command: 'uname -a', category: 'sistema' },
  { name: 'Espaço em Diretórios', description: 'Top diretórios por tamanho', command: 'du -sh /*', category: 'sistema' },
];

export function useSnippets() {
  return useQuery({
    queryKey: ['command-snippets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('command_snippets')
        .select('*')
        .order('category')
        .order('name');
      if (error) throw error;
      return data as CommandSnippet[];
    },
  });
}

export function useCreateSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (snippet: { name: string; description: string; command: string; category: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const { data, error } = await supabase
        .from('command_snippets')
        .insert({ ...snippet, user_id: user.id, is_builtin: false })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['command-snippets'] }),
  });
}

export function useUpdateSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; name?: string; description?: string; command?: string; category?: string }) => {
      const { data, error } = await supabase
        .from('command_snippets')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['command-snippets'] }),
  });
}

export function useDeleteSnippet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('command_snippets')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['command-snippets'] }),
  });
}
