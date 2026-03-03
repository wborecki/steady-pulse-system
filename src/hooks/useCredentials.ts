import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export type CredentialType = 'aws' | 'agent' | 'airflow' | 'postgresql' | 'mongodb' | 'azure_sql' | 'ssh' | 'http_auth';

export interface Credential {
  id: string;
  name: string;
  credential_type: CredentialType;
  config: Record<string, unknown>;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCredentialInput {
  name: string;
  credential_type: CredentialType;
  config: Json;
  description: string | null;
}

export const credentialTypeLabels: Record<CredentialType, string> = {
  aws: 'AWS',
  agent: 'Agente (Servidor)',
  airflow: 'Apache Airflow',
  postgresql: 'PostgreSQL',
  mongodb: 'MongoDB',
  azure_sql: 'Azure SQL',
  ssh: 'SSH',
  http_auth: 'HTTP Auth',
};

/** Which credential types can be used with which check types */
export const credentialCheckTypeMap: Record<CredentialType, string[]> = {
  aws: ['cloudwatch', 's3', 'lambda', 'ecs', 'cloudwatch_alarms'],
  agent: ['systemctl', 'container', 'server'],
  airflow: ['airflow'],
  postgresql: ['postgresql'],
  mongodb: ['mongodb'],
  azure_sql: ['sql_query'],
  ssh: ['tcp', 'process'],
  http_auth: ['http'],
};

/** Config field definitions per credential type */
export const credentialFields: Record<CredentialType, { key: string; label: string; type?: string; placeholder?: string; required?: boolean }[]> = {
  aws: [
    { key: 'access_key_id', label: 'Access Key ID', placeholder: 'AKIAIOSFODNN7EXAMPLE', required: true },
    { key: 'secret_access_key', label: 'Secret Access Key', type: 'password', placeholder: 'wJalrXUtn...', required: true },
    { key: 'region', label: 'Região Padrão', placeholder: 'us-east-1' },
  ],
  agent: [
    { key: 'agent_url', label: 'URL do Agente', placeholder: 'http://192.168.1.100:9100', required: true },
    { key: 'token', label: 'Token de Autenticação', type: 'password', placeholder: 'Token Bearer' },
  ],
  airflow: [
    { key: 'base_url', label: 'URL do Airflow', placeholder: 'http://localhost:8080', required: true },
    { key: 'username', label: 'Usuário', placeholder: 'admin', required: true },
    { key: 'password', label: 'Senha', type: 'password', required: true },
    { key: 'auth_type', label: 'Tipo de Auth', placeholder: 'jwt' },
  ],
  postgresql: [
    { key: 'connection_string', label: 'Connection String', placeholder: 'postgresql://user:pass@host:5432/db' },
    { key: 'host', label: 'Host', placeholder: 'localhost' },
    { key: 'port', label: 'Porta', placeholder: '5432' },
    { key: 'database', label: 'Database', placeholder: 'mydb' },
    { key: 'username', label: 'Usuário', placeholder: 'postgres' },
    { key: 'password', label: 'Senha', type: 'password' },
    { key: 'ssl_mode', label: 'SSL Mode', placeholder: 'prefer' },
  ],
  mongodb: [
    { key: 'connection_string', label: 'Connection String', placeholder: 'mongodb+srv://user:pass@cluster/db' },
    { key: 'host', label: 'Host', placeholder: 'localhost' },
    { key: 'port', label: 'Porta', placeholder: '27017' },
    { key: 'database', label: 'Database', placeholder: 'mydb' },
    { key: 'username', label: 'Usuário' },
    { key: 'password', label: 'Senha', type: 'password' },
    { key: 'auth_source', label: 'Auth Source', placeholder: 'admin' },
  ],
  azure_sql: [
    { key: 'connection_string', label: 'Connection String', placeholder: 'Server=...;Database=...' },
    { key: 'host', label: 'Servidor', placeholder: 'server.database.windows.net' },
    { key: 'database', label: 'Database' },
    { key: 'username', label: 'Usuário' },
    { key: 'password', label: 'Senha', type: 'password' },
  ],
  ssh: [
    { key: 'host', label: 'Host SSH', placeholder: '192.168.1.100', required: true },
    { key: 'port', label: 'Porta', placeholder: '22' },
    { key: 'username', label: 'Usuário', placeholder: 'root', required: true },
    { key: 'password', label: 'Senha', type: 'password' },
    { key: 'private_key', label: 'Chave Privada (PEM)' },
  ],
  http_auth: [
    { key: 'auth_type', label: 'Tipo', placeholder: 'basic ou bearer', required: true },
    { key: 'username', label: 'Usuário (Basic)' },
    { key: 'password', label: 'Senha (Basic)', type: 'password' },
    { key: 'token', label: 'Token (Bearer)', type: 'password' },
  ],
};

export function useCredentials(type?: CredentialType) {
  return useQuery({
    queryKey: ['credentials', type],
    queryFn: async () => {
      let query = supabase.from('credentials').select('*').order('name');
      if (type) query = query.eq('credential_type', type);
      const { data, error } = await query;
      if (error) throw error;
      return data as Credential[];
    },
  });
}

export function useCredentialsByCheckType(checkType: string) {
  // Find which credential types are compatible with this check type
  const compatibleTypes = Object.entries(credentialCheckTypeMap)
    .filter(([, checkTypes]) => checkTypes.includes(checkType))
    .map(([credType]) => credType);

  return useQuery({
    queryKey: ['credentials', 'byCheckType', checkType],
    queryFn: async () => {
      if (compatibleTypes.length === 0) return [];
      const { data, error } = await supabase
        .from('credentials')
        .select('*')
        .in('credential_type', compatibleTypes)
        .order('name');
      if (error) throw error;
      return data as Credential[];
    },
    enabled: compatibleTypes.length > 0,
  });
}

export function useCreateCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateCredentialInput) => {
      const { data, error } = await supabase
        .from('credentials')
        .insert({
          name: input.name,
          credential_type: input.credential_type,
          config: input.config,
          description: input.description,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Credential;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
  });
}

export interface UpdateCredentialInput {
  id: string;
  name?: string;
  credential_type?: string;
  config?: Json;
  description?: string | null;
}

export function useUpdateCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateCredentialInput) => {
      const { data, error } = await supabase
        .from('credentials')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Credential;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
  });
}

export function useDeleteCredential() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('credentials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credentials'] });
    },
  });
}
