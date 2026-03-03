import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { useCreateService, useUpdateService } from '@/hooks/useServices';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Minus, Plus, Search, Loader2 } from 'lucide-react';
import { CredentialSelector } from './CredentialSelector';
import type { Credential } from '@/hooks/useCredentials';

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
  container: 'Containers', infra: 'Infraestrutura',
};

const categoryCheckTypes: Record<string, string[]> = {
  aws: ['cloudwatch', 's3', 'lambda', 'ecs', 'cloudwatch_alarms'],
  database: ['sql_query', 'postgresql', 'mongodb', 'supabase'],
  airflow: ['airflow'],
  server: ['server', 'systemctl', 'tcp', 'process'],
  process: ['process'],
  api: ['http'],
  container: ['container'],
  infra: ['supabase_project'],
};

const checkTypeLabels: Record<string, string> = {
  http: 'HTTP / Site',
  tcp: 'TCP',
  sql_query: 'SQL Server (Azure)',
  postgresql: 'PostgreSQL',
  supabase: 'Supabase (PostgreSQL)',
  mongodb: 'MongoDB',
  cloudwatch: 'AWS CloudWatch',
  s3: 'AWS S3',
  process: 'Processo',
  airflow: 'Apache Airflow',
  lambda: 'AWS Lambda',
  ecs: 'AWS ECS',
  cloudwatch_alarms: 'CloudWatch Alarms',
  systemctl: 'Systemctl (Linux)',
  container: 'Docker / Container',
  server: 'Métricas do Servidor',
  supabase_project: 'Supabase (Projeto Completo)',
};

interface ServiceFormData {
  id?: string;
  name: string;
  category: string;
  check_type: string;
  url?: string | null;
  description?: string;
  check_config?: Record<string, unknown>;
  check_interval_seconds?: number;
}

interface Props {
  onSuccess: () => void;
  initialData?: ServiceFormData;
  mode?: 'create' | 'edit';
}

export function AddServiceForm({ onSuccess, initialData, mode = 'create' }: Props) {
  const createService = useCreateService();
  const updateService = useUpdateService();
  const [category, setCategory] = useState(initialData?.category || 'server');
  const [checkType, setCheckType] = useState(initialData?.check_type || 'tcp');
  const [httpAuthType, setHttpAuthType] = useState(() => {
    const auth = initialData?.check_config?.auth as Record<string, string> | undefined;
    return auth?.type || 'none';
  });
  const [sshEnabled, setSshEnabled] = useState(() => !!initialData?.check_config?.ssh);
  const [sshAuthMethod, setSshAuthMethod] = useState<'password' | 'key'>(() => {
    const ssh = initialData?.check_config?.ssh as Record<string, string> | undefined;
    return ssh?.private_key ? 'key' : 'password';
  });
  const [dbInputMode, setDbInputMode] = useState<'connection_string' | 'fields'>(() => {
    if (initialData?.check_config?.connection_string) return 'connection_string';
    if (initialData?.check_config?.host) return 'fields';
    return 'connection_string';
  });
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>(() => {
    const h = initialData?.check_config?.headers as Record<string, string> | undefined;
    if (h && typeof h === 'object') return Object.entries(h).map(([key, value]) => ({ key, value }));
    return [];
  });

  const allowedChecks = categoryCheckTypes[category] || [];

  const handleCategoryChange = (cat: string) => {
    setCategory(cat);
    const checks = categoryCheckTypes[cat] || [];
    setCheckType(checks[0] || 'http');
    setSshEnabled(false);
    setHttpAuthType('none');
    setDbInputMode('connection_string');
    setHeaders([]);
  };

  const addHeader = () => setHeaders(h => [...h, { key: '', value: '' }]);
  const removeHeader = (i: number) => setHeaders(h => h.filter((_, idx) => idx !== i));
  const updateHeader = (i: number, field: 'key' | 'value', val: string) =>
    setHeaders(h => h.map((item, idx) => idx === i ? { ...item, [field]: val } : item));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    let checkConfig: Record<string, unknown> = {};
    let url: string | null = null;

    switch (checkType) {
      case 'http': {
        url = (form.get('url') as string) || null;
        const method = form.get('http_method') as string || 'GET';
        const expectedStatus = form.get('expected_status') as string;
        const auth: Record<string, unknown> = { type: httpAuthType };
        if (httpAuthType === 'basic') {
          auth.username = form.get('http_username') as string;
          auth.password = form.get('http_password') as string;
        } else if (httpAuthType === 'bearer') {
          auth.token = form.get('http_token') as string;
        }
        const filteredHeaders = headers.filter(h => h.key.trim());
        checkConfig = {
          method,
          ...(expectedStatus ? { expected_status: Number(expectedStatus) } : {}),
          ...(httpAuthType !== 'none' ? { auth } : {}),
          ...(filteredHeaders.length > 0 ? { headers: Object.fromEntries(filteredHeaders.map(h => [h.key, h.value])) } : {}),
        };
        break;
      }
      case 'tcp': {
        checkConfig = { host: form.get('tcp_host') as string, port: Number(form.get('tcp_port')) };
        if (sshEnabled) {
          checkConfig.ssh = buildSshConfig(form);
        }
        break;
      }
      case 'process': {
        checkConfig = { process_name: form.get('process_name') as string };
        if (sshEnabled || category === 'process') {
          checkConfig.ssh = buildSshConfig(form);
        }
        break;
      }
      case 'sql_query': {
        if (dbInputMode === 'connection_string') {
          const connStr = form.get('mssql_connection_string') as string;
          // Parse connection string into fields
          checkConfig = { connection_string: connStr };
        } else {
          checkConfig = {
            host: form.get('db_host') as string,
            database: form.get('db_name') as string,
            username: form.get('db_username') as string,
            password: form.get('db_password') as string,
            trust_server_certificate: (form.get('db_trust_cert') as string) === 'on',
          };
        }
        // Agent relay (optional, for firewall bypass)
        const agentUrl = (form.get('agent_url') as string || '').trim();
        const agentToken = (form.get('agent_token') as string || '').trim();
        if (agentUrl) checkConfig.agent_url = agentUrl;
        if (agentToken) checkConfig.agent_token = agentToken;
        break;
      }
      case 'postgresql':
      case 'supabase': {
        if (dbInputMode === 'connection_string') {
          checkConfig = { connection_string: form.get('pg_connection_string') as string };
        } else {
          checkConfig = {
            host: form.get('db_host') as string,
            port: Number(form.get('db_port') || 5432),
            database: form.get('db_name') as string,
            username: form.get('db_username') as string,
            password: form.get('db_password') as string,
            sslmode: (form.get('db_ssl_mode') as string) || (checkType === 'supabase' ? 'require' : 'prefer'),
          };
        }
        // Agent relay (optional)
        const pgAgentUrl = (form.get('agent_url') as string || '').trim();
        const pgAgentToken = (form.get('agent_token') as string || '').trim();
        if (pgAgentUrl) checkConfig.agent_url = pgAgentUrl;
        if (pgAgentToken) checkConfig.agent_token = pgAgentToken;
        break;
      }
      case 'mongodb': {
        if (dbInputMode === 'connection_string') {
          checkConfig = {
            connection_string: form.get('mongo_connection_string') as string,
            database: (form.get('mongo_database') as string) || undefined,
          };
        } else {
          checkConfig = {
            host: form.get('db_host') as string,
            port: Number(form.get('db_port') || 27017),
            database: form.get('db_name') as string,
            username: form.get('db_username') as string,
            password: form.get('db_password') as string,
            auth_source: (form.get('db_auth_source') as string) || 'admin',
          };
        }
        break;
      }
      case 'cloudwatch':
        checkConfig = {
          metric_type: form.get('cw_metric_type') as string || 'EC2',
          instance_id: form.get('cw_instance_id') as string,
          region: (form.get('cw_region') as string) || undefined,
          credential_id: (form.get('credential_id') as string) || undefined,
        };
        break;
      case 's3':
        checkConfig = {
          bucket_name: form.get('s3_bucket') as string,
          region: (form.get('s3_region') as string) || undefined,
          prefix: (form.get('s3_prefix') as string) || undefined,
          credential_id: (form.get('credential_id') as string) || undefined,
        };
        break;
      case 'airflow':
        checkConfig = {
          base_url: form.get('airflow_url') as string,
          username: form.get('airflow_username') as string,
          password: form.get('airflow_password') as string,
          auth_type: (form.get('airflow_auth_type') as string) || 'jwt',
        };
        break;
      case 'lambda':
        checkConfig = {
          function_name: form.get('lambda_function_name') as string,
          region: (form.get('lambda_region') as string) || undefined,
          credential_id: (form.get('credential_id') as string) || undefined,
        };
        break;
      case 'ecs':
        checkConfig = {
          cluster: form.get('ecs_cluster') as string,
          service_name: form.get('ecs_service_name') as string,
          region: (form.get('ecs_region') as string) || undefined,
          credential_id: (form.get('credential_id') as string) || undefined,
        };
        break;
      case 'cloudwatch_alarms':
        checkConfig = {
          alarm_prefix: (form.get('cw_alarm_prefix') as string) || undefined,
          region: (form.get('cw_alarm_region') as string) || undefined,
          credential_id: (form.get('credential_id') as string) || undefined,
        };
        break;
      case 'systemctl':
        checkConfig = {
          agent_url: form.get('agent_url') as string,
          services: (form.get('systemctl_services') as string)?.split(',').map(s => s.trim()).filter(Boolean) || [],
          endpoint: (form.get('agent_endpoint') as string) || '/systemctl',
          token: (form.get('agent_token') as string) || undefined,
        };
        break;
      case 'container':
        checkConfig = {
          agent_url: form.get('agent_url') as string,
          endpoint: (form.get('agent_endpoint') as string) || '/containers',
          token: (form.get('agent_token') as string) || undefined,
        };
        break;
      case 'server':
        checkConfig = {
          agent_url: form.get('agent_url') as string,
          token: (form.get('agent_token') as string) || undefined,
        };
        break;
      case 'supabase_project':
        checkConfig = {
          project_url: (form.get('sb_project_url') as string || '').trim(),
          anon_key: (form.get('sb_anon_key') as string || '').trim(),
          service_role_key: (form.get('sb_service_role_key') as string || '').trim(),
          test_function: (form.get('sb_test_function') as string || '').trim() || undefined,
        };
        break;
    }

    const serviceData: Record<string, unknown> = {
      name: form.get('name') as string,
      category,
      url,
      description: (form.get('description') as string) || '',
      check_type: checkType,
      check_config: checkConfig,
    };

    // Only include interval on create; in edit mode it's managed via Settings
    if (mode !== 'edit') {
      serviceData.check_interval_seconds = Number(form.get('interval') || 60);
    }

    try {
      if (mode === 'edit' && initialData?.id) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await updateService.mutateAsync({ id: initialData.id, ...serviceData } as any);
        toast.success('Serviço atualizado!');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await createService.mutateAsync(serviceData as any);
        toast.success('Serviço adicionado!');
      }
      onSuccess();
    } catch {
      toast.error(mode === 'edit' ? 'Erro ao atualizar serviço' : 'Erro ao adicionar serviço');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 pr-1">
      {/* Nome */}
      <div className="space-y-2">
        <Label>Nome do Serviço</Label>
        <Input name="name" required defaultValue={initialData?.name || ''} placeholder="Ex: EC2 - Produção" className="bg-secondary border-border" />
      </div>

      {/* Categoria + Check Type */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Categoria</Label>
          <Select value={category} onValueChange={handleCategoryChange}>
            <SelectTrigger className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(categoryLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {allowedChecks.length > 1 && (
          <div className="space-y-2">
            <Label>Tipo de Check</Label>
            <Select value={checkType} onValueChange={setCheckType}>
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowedChecks.map(ct => (
                  <SelectItem key={ct} value={ct}>{checkTypeLabels[ct] || ct}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {allowedChecks.length === 1 && (
          <div className="space-y-2">
            <Label>Tipo de Check</Label>
            <Input disabled value={checkTypeLabels[allowedChecks[0]] || allowedChecks[0]} className="bg-secondary border-border" />
          </div>
        )}
      </div>

      {/* HTTP fields */}
      {checkType === 'http' && <HttpFields httpAuthType={httpAuthType} setHttpAuthType={setHttpAuthType} headers={headers} addHeader={addHeader} removeHeader={removeHeader} updateHeader={updateHeader} initialConfig={initialData?.check_config} initialUrl={initialData?.url} />}

      {/* TCP fields */}
      {checkType === 'tcp' && <TcpFields sshEnabled={sshEnabled} setSshEnabled={setSshEnabled} sshAuthMethod={sshAuthMethod} setSshAuthMethod={setSshAuthMethod} initialConfig={initialData?.check_config} />}

      {/* Process fields */}
      {checkType === 'process' && <ProcessFields category={category} sshEnabled={sshEnabled} setSshEnabled={setSshEnabled} sshAuthMethod={sshAuthMethod} setSshAuthMethod={setSshAuthMethod} initialConfig={initialData?.check_config} />}

      {/* SQL Server fields */}
      {checkType === 'sql_query' && <SqlServerFields dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} initialConfig={initialData?.check_config} />}

      {/* Airflow fields */}
      {checkType === 'airflow' && <AirflowFields initialConfig={initialData?.check_config} />}

      {/* PostgreSQL / Supabase fields */}
      {(checkType === 'postgresql' || checkType === 'supabase') && <PostgresFields dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} initialConfig={initialData?.check_config} />}

      {/* MongoDB fields */}
      {checkType === 'mongodb' && <MongoFields dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} initialConfig={initialData?.check_config} />}

      {/* CloudWatch fields */}
      {checkType === 'cloudwatch' && <CloudWatchFields initialConfig={initialData?.check_config} />}

      {/* S3 fields */}
      {checkType === 's3' && <S3Fields initialConfig={initialData?.check_config} />}

      {/* Lambda fields */}
      {checkType === 'lambda' && <LambdaFields initialConfig={initialData?.check_config} />}

      {/* ECS fields */}
      {checkType === 'ecs' && <EcsFields initialConfig={initialData?.check_config} />}

      {/* CloudWatch Alarms fields */}
      {checkType === 'cloudwatch_alarms' && <CloudWatchAlarmsFields initialConfig={initialData?.check_config} />}

      {/* Systemctl fields */}
      {checkType === 'systemctl' && <SystemctlFields initialConfig={initialData?.check_config} />}

      {/* Container fields */}
      {checkType === 'container' && <ContainerFields initialConfig={initialData?.check_config} />}
      {checkType === 'server' && <ServerFields initialConfig={initialData?.check_config} />}
      {checkType === 'supabase_project' && <SupabaseProjectFields initialConfig={initialData?.check_config} />}

      {/* Interval - only shown in create mode; in edit mode, interval is changed via Settings */}
      {mode !== 'edit' && (
      <div className="space-y-2">
        <Label>Intervalo de verificação</Label>
        <Select name="interval" defaultValue={String(initialData?.check_interval_seconds || 60)}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 segundos</SelectItem>
            <SelectItem value="60">1 minuto</SelectItem>
            <SelectItem value="300">5 minutos</SelectItem>
            <SelectItem value="600">10 minutos</SelectItem>
          </SelectContent>
        </Select>
      </div>
      )}

      {/* Description */}
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Input name="description" defaultValue={initialData?.description || ''} placeholder="Descrição do serviço" className="bg-secondary border-border" />
      </div>

      <Button type="submit" className="w-full" disabled={createService.isPending || updateService.isPending}>
        {(createService.isPending || updateService.isPending) ? (mode === 'edit' ? 'Salvando...' : 'Adicionando...') : (mode === 'edit' ? 'Salvar' : 'Adicionar')}
      </Button>
    </form>
  );
}

// --- Sub-components ---

function buildSshConfig(form: FormData) {
  const ssh: Record<string, unknown> = {
    host: form.get('ssh_host') as string,
    port: Number(form.get('ssh_port') || 22),
    username: form.get('ssh_username') as string,
  };
  const method = form.get('ssh_auth_method') as string;
  if (method === 'key') {
    ssh.private_key = form.get('ssh_private_key') as string;
  } else {
    ssh.password = form.get('ssh_password') as string;
  }
  return ssh;
}

function SshFields({ sshAuthMethod, setSshAuthMethod }: { sshAuthMethod: 'password' | 'key'; setSshAuthMethod: (v: 'password' | 'key') => void }) {
  return (
    <div className="space-y-3 rounded-md border border-border p-3 bg-secondary/30">
      <p className="text-sm font-medium text-foreground">🔑 Credenciais SSH</p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Host SSH</Label>
          <Input name="ssh_host" required placeholder="192.168.1.100" className="bg-secondary border-border" />
        </div>
        <div className="space-y-2">
          <Label>Porta SSH</Label>
          <Input name="ssh_port" type="number" defaultValue="22" className="bg-secondary border-border" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Usuário SSH</Label>
        <Input name="ssh_username" required placeholder="root" className="bg-secondary border-border" />
      </div>
      <div className="space-y-2">
        <Label>Método de Autenticação</Label>
        <Select value={sshAuthMethod} onValueChange={(v) => setSshAuthMethod(v as 'password' | 'key')}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="password">Senha</SelectItem>
            <SelectItem value="key">Chave Privada</SelectItem>
          </SelectContent>
        </Select>
        <input type="hidden" name="ssh_auth_method" value={sshAuthMethod} />
      </div>
      {sshAuthMethod === 'password' ? (
        <div className="space-y-2">
          <Label>Senha SSH</Label>
          <Input name="ssh_password" type="password" required placeholder="••••••••" className="bg-secondary border-border" />
        </div>
      ) : (
        <div className="space-y-2">
          <Label>Chave Privada (PEM)</Label>
          <Textarea name="ssh_private_key" required placeholder="-----BEGIN RSA PRIVATE KEY-----" className="bg-secondary border-border font-mono text-xs min-h-[80px]" />
        </div>
      )}
    </div>
  );
}

function HttpFields({ httpAuthType, setHttpAuthType, headers, addHeader, removeHeader, updateHeader, initialConfig, initialUrl }: {
  httpAuthType: string; setHttpAuthType: (v: string) => void;
  headers: { key: string; value: string }[];
  addHeader: () => void; removeHeader: (i: number) => void;
  updateHeader: (i: number, f: 'key' | 'value', v: string) => void;
  initialConfig?: Record<string, unknown>;
  initialUrl?: string | null;
}) {
  const auth = initialConfig?.auth as Record<string, string> | undefined;
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>URL / Endpoint</Label>
        <Input name="url" required placeholder="https://api.empresa.com" className="bg-secondary border-border" defaultValue={initialUrl || ''} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Método HTTP</Label>
          <Select name="http_method" defaultValue={(initialConfig?.method as string) || 'GET'}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="GET">GET</SelectItem>
              <SelectItem value="POST">POST</SelectItem>
              <SelectItem value="HEAD">HEAD</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Status Esperado</Label>
          <Input name="expected_status" type="number" placeholder="200" className="bg-secondary border-border" defaultValue={(initialConfig?.expected_status as string) || ''} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Autenticação</Label>
        <Select value={httpAuthType} onValueChange={setHttpAuthType}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Nenhuma</SelectItem>
            <SelectItem value="basic">Basic Auth</SelectItem>
            <SelectItem value="bearer">Bearer Token</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {httpAuthType === 'basic' && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Usuário</Label>
            <Input name="http_username" required className="bg-secondary border-border" defaultValue={auth?.username || ''} />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input name="http_password" type="password" required className="bg-secondary border-border" defaultValue={auth?.password || ''} />
          </div>
        </div>
      )}
      {httpAuthType === 'bearer' && (
        <div className="space-y-2">
          <Label>Token</Label>
          <Input name="http_token" required placeholder="eyJhbGciOi..." className="bg-secondary border-border font-mono text-xs" defaultValue={auth?.token || ''} />
        </div>
      )}
      {/* Custom Headers */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Headers Customizados</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addHeader} className="h-7 gap-1 text-xs">
            <Plus className="h-3 w-3" /> Adicionar
          </Button>
        </div>
        {headers.map((h, i) => (
          <div key={i} className="flex gap-2 items-center">
            <Input placeholder="Header" value={h.key} onChange={e => updateHeader(i, 'key', e.target.value)} className="bg-secondary border-border flex-1" />
            <Input placeholder="Valor" value={h.value} onChange={e => updateHeader(i, 'value', e.target.value)} className="bg-secondary border-border flex-1" />
            <Button type="button" variant="ghost" size="icon" onClick={() => removeHeader(i)} className="h-8 w-8 shrink-0">
              <Minus className="h-3 w-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function TcpFields({ sshEnabled, setSshEnabled, sshAuthMethod, setSshAuthMethod, initialConfig }: {
  sshEnabled: boolean; setSshEnabled: (v: boolean) => void;
  sshAuthMethod: 'password' | 'key'; setSshAuthMethod: (v: 'password' | 'key') => void;
  initialConfig?: Record<string, unknown>;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label>Host</Label>
          <Input name="tcp_host" required placeholder="db.empresa.com" className="bg-secondary border-border" defaultValue={(initialConfig?.host as string) || ''} />
        </div>
        <div className="space-y-2">
          <Label>Porta</Label>
          <Input name="tcp_port" type="number" required placeholder="5432" className="bg-secondary border-border" defaultValue={String(initialConfig?.port || '')} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={sshEnabled} onCheckedChange={setSshEnabled} />
        <Label>Usar SSH para conexão</Label>
      </div>
      {sshEnabled && <SshFields sshAuthMethod={sshAuthMethod} setSshAuthMethod={setSshAuthMethod} />}
    </div>
  );
}

function ProcessFields({ category, sshEnabled, setSshEnabled, sshAuthMethod, setSshAuthMethod, initialConfig }: {
  category: string; sshEnabled: boolean; setSshEnabled: (v: boolean) => void;
  sshAuthMethod: 'password' | 'key'; setSshAuthMethod: (v: 'password' | 'key') => void;
  initialConfig?: Record<string, unknown>;
}) {
  const alwaysSsh = category === 'process';
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Nome do Processo / Comando</Label>
        <Input name="process_name" required placeholder="nginx, java, python app.py" className="bg-secondary border-border" defaultValue={(initialConfig?.process_name as string) || ''} />
      </div>
      {!alwaysSsh && (
        <div className="flex items-center gap-2">
          <Switch checked={sshEnabled} onCheckedChange={setSshEnabled} />
          <Label>Usar SSH para verificação</Label>
        </div>
      )}
      {(alwaysSsh || sshEnabled) && <SshFields sshAuthMethod={sshAuthMethod} setSshAuthMethod={setSshAuthMethod} />}
    </div>
  );
}

function DbInputModeToggle({ dbInputMode, setDbInputMode }: { dbInputMode: string; setDbInputMode: (v: 'connection_string' | 'fields') => void }) {
  return (
    <div className="flex gap-2">
      <Button type="button" variant={dbInputMode === 'connection_string' ? 'default' : 'outline'} size="sm" onClick={() => setDbInputMode('connection_string')}>
        Connection String
      </Button>
      <Button type="button" variant={dbInputMode === 'fields' ? 'default' : 'outline'} size="sm" onClick={() => setDbInputMode('fields')}>
        Campos Individuais
      </Button>
    </div>
  );
}

function PostgresFields({ dbInputMode, setDbInputMode, initialConfig }: { dbInputMode: string; setDbInputMode: (v: 'connection_string' | 'fields') => void; initialConfig?: Record<string, unknown> }) {
  const [pgConnStr, setPgConnStr] = useState((initialConfig?.connection_string as string) || '');
  const [pgHost, setPgHost] = useState((initialConfig?.host as string) || '');
  const [pgPort, setPgPort] = useState(String(initialConfig?.port || '5432'));
  const [pgDb, setPgDb] = useState((initialConfig?.database as string) || '');
  const [pgUser, setPgUser] = useState((initialConfig?.username as string) || '');
  const [pgPass, setPgPass] = useState((initialConfig?.password as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      if (c.connection_string) {
        setDbInputMode('connection_string');
        setPgConnStr(c.connection_string);
      } else {
        setDbInputMode('fields');
        setPgHost(c.host || '');
        setPgPort(c.port || '5432');
        setPgDb(c.database || '');
        setPgUser(c.username || '');
        setPgPass(c.password || '');
      }
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="postgresql" onSelect={handleCredential} />
      <DbInputModeToggle dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} />
      {dbInputMode === 'connection_string' ? (
        <div className="space-y-2">
          <Label>Connection String</Label>
          <Input name="pg_connection_string" required placeholder="postgresql://user:pass@host:5432/dbname" className="bg-secondary border-border font-mono text-xs" value={pgConnStr} onChange={e => setPgConnStr(e.target.value)} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Host</Label>
              <Input name="db_host" required placeholder="db.empresa.com" className="bg-secondary border-border" value={pgHost} onChange={e => setPgHost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Porta</Label>
              <Input name="db_port" type="number" className="bg-secondary border-border" value={pgPort} onChange={e => setPgPort(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Database</Label>
            <Input name="db_name" required placeholder="meu_banco" className="bg-secondary border-border" value={pgDb} onChange={e => setPgDb(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input name="db_username" required className="bg-secondary border-border" value={pgUser} onChange={e => setPgUser(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input name="db_password" type="password" required className="bg-secondary border-border" value={pgPass} onChange={e => setPgPass(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>SSL Mode</Label>
            <Select name="db_ssl_mode" defaultValue="prefer">
              <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="disable">Disable</SelectItem>
                <SelectItem value="prefer">Prefer</SelectItem>
                <SelectItem value="require">Require</SelectItem>
                <SelectItem value="verify-full">Verify Full</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Coleta: conexões, cache hit ratio, tamanho do banco, replication lag.</p>
    </div>
  );
}

function MongoFields({ dbInputMode, setDbInputMode, initialConfig }: { dbInputMode: string; setDbInputMode: (v: 'connection_string' | 'fields') => void; initialConfig?: Record<string, unknown> }) {
  const [mongoConnStr, setMongoConnStr] = useState((initialConfig?.connection_string as string) || '');
  const [mongoHost, setMongoHost] = useState((initialConfig?.host as string) || '');
  const [mongoPort, setMongoPort] = useState(String(initialConfig?.port || '27017'));
  const [mongoDb, setMongoDb] = useState((initialConfig?.database as string) || '');
  const [mongoUser, setMongoUser] = useState((initialConfig?.username as string) || '');
  const [mongoPass, setMongoPass] = useState((initialConfig?.password as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      if (c.connection_string) {
        setDbInputMode('connection_string');
        setMongoConnStr(c.connection_string);
      } else {
        setDbInputMode('fields');
        setMongoHost(c.host || '');
        setMongoPort(c.port || '27017');
        setMongoDb(c.database || '');
        setMongoUser(c.username || '');
        setMongoPass(c.password || '');
      }
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="mongodb" onSelect={handleCredential} />
      <DbInputModeToggle dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} />
      {dbInputMode === 'connection_string' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Connection String</Label>
            <Input name="mongo_connection_string" required placeholder="mongodb+srv://user:pass@cluster.mongodb.net" className="bg-secondary border-border font-mono text-xs" value={mongoConnStr} onChange={e => setMongoConnStr(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Database (opcional)</Label>
            <Input name="mongo_database" placeholder="nome_do_banco" className="bg-secondary border-border" value={mongoDb} onChange={e => setMongoDb(e.target.value)} />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Host</Label>
              <Input name="db_host" required placeholder="cluster.mongodb.net" className="bg-secondary border-border" value={mongoHost} onChange={e => setMongoHost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Porta</Label>
              <Input name="db_port" type="number" className="bg-secondary border-border" value={mongoPort} onChange={e => setMongoPort(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Database</Label>
            <Input name="db_name" required placeholder="meu_banco" className="bg-secondary border-border" value={mongoDb} onChange={e => setMongoDb(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input name="db_username" required className="bg-secondary border-border" value={mongoUser} onChange={e => setMongoUser(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input name="db_password" type="password" required className="bg-secondary border-border" value={mongoPass} onChange={e => setMongoPass(e.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Auth Source</Label>
            <Input name="db_auth_source" defaultValue="admin" className="bg-secondary border-border" />
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Coleta: conexões, memória, opcounters, tamanho do banco.</p>
    </div>
  );
}

function CloudWatchFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [region, setRegion] = useState((initialConfig?.region as string) || '');
  const [credentialId, setCredentialId] = useState((initialConfig?.credential_id as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setCredentialId(cred.id);
      if (c.region) setRegion(c.region);
    } else {
      setCredentialId('');
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="cloudwatch" onSelect={handleCredential} />
      <input type="hidden" name="credential_id" value={credentialId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Tipo de Recurso</Label>
          <Select name="cw_metric_type" defaultValue={(initialConfig?.metric_type as string) || 'EC2'}>
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EC2">EC2</SelectItem>
              <SelectItem value="RDS">RDS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Região AWS</Label>
          <Input name="cw_region" placeholder="us-east-1" className="bg-secondary border-border" value={region} onChange={e => setRegion(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Instance ID / DB Identifier</Label>
        <Input name="cw_instance_id" required placeholder="i-0abc123def" className="bg-secondary border-border font-mono text-xs" defaultValue={(initialConfig?.instance_id as string) || ''} />
      </div>
      <p className="text-xs text-muted-foreground">{credentialId ? '🔑 Usando credencial salva.' : 'Sem credencial — usará variáveis de ambiente do backend.'} Coleta CPU, Network, StatusCheck (EC2) ou CPU, Memória, Conexões (RDS).</p>
    </div>
  );
}

function S3Fields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [region, setRegion] = useState((initialConfig?.region as string) || '');
  const [credentialId, setCredentialId] = useState((initialConfig?.credential_id as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setCredentialId(cred.id);
      if (c.region) setRegion(c.region);
    } else {
      setCredentialId('');
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="s3" onSelect={handleCredential} />
      <input type="hidden" name="credential_id" value={credentialId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Nome do Bucket</Label>
          <Input name="s3_bucket" required placeholder="meu-bucket-prod" className="bg-secondary border-border" defaultValue={(initialConfig?.bucket as string) || ''} />
        </div>
        <div className="space-y-2">
          <Label>Região AWS</Label>
          <Input name="s3_region" placeholder="us-east-1" className="bg-secondary border-border" value={region} onChange={e => setRegion(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Prefixo (opcional)</Label>
        <Input name="s3_prefix" placeholder="logs/2024/" className="bg-secondary border-border" defaultValue={(initialConfig?.prefix as string) || ''} />
      </div>
      <p className="text-xs text-muted-foreground">{credentialId ? '🔑 Usando credencial salva.' : 'Sem credencial — usará variáveis de ambiente do backend.'} Verifica acessibilidade do bucket.</p>
    </div>
  );
}

function SqlServerFields({ dbInputMode, setDbInputMode, initialConfig }: { dbInputMode: string; setDbInputMode: (v: 'connection_string' | 'fields') => void; initialConfig?: Record<string, unknown> }) {
  const [mssqlConnStr, setMssqlConnStr] = useState((initialConfig?.connection_string as string) || '');
  const [mssqlHost, setMssqlHost] = useState((initialConfig?.host as string) || '');
  const [mssqlDb, setMssqlDb] = useState((initialConfig?.database as string) || '');
  const [mssqlUser, setMssqlUser] = useState((initialConfig?.username as string) || '');
  const [mssqlPass, setMssqlPass] = useState((initialConfig?.password as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      if (c.connection_string) {
        setDbInputMode('connection_string');
        setMssqlConnStr(c.connection_string);
      } else {
        setDbInputMode('fields');
        setMssqlHost(c.host || '');
        setMssqlDb(c.database || '');
        setMssqlUser(c.username || '');
        setMssqlPass(c.password || '');
      }
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="sql_query" onSelect={handleCredential} />
      <DbInputModeToggle dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} />
      {dbInputMode === 'connection_string' ? (
        <div className="space-y-2">
          <Label>Connection String</Label>
          <Input name="mssql_connection_string" required placeholder="Server=host;Database=db;User Id=user;Password=pass;" className="bg-secondary border-border font-mono text-xs" value={mssqlConnStr} onChange={e => setMssqlConnStr(e.target.value)} />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Host / Server</Label>
              <Input name="db_host" required placeholder="server.database.windows.net" className="bg-secondary border-border" value={mssqlHost} onChange={e => setMssqlHost(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Database</Label>
              <Input name="db_name" required placeholder="meu_banco" className="bg-secondary border-border" value={mssqlDb} onChange={e => setMssqlDb(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input name="db_username" required className="bg-secondary border-border" value={mssqlUser} onChange={e => setMssqlUser(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input name="db_password" type="password" required className="bg-secondary border-border" value={mssqlPass} onChange={e => setMssqlPass(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="db_trust_cert" id="db_trust_cert" className="rounded border-border" defaultChecked={!!initialConfig?.trust_server_certificate} />
            <Label htmlFor="db_trust_cert" className="text-xs">Trust Server Certificate</Label>
          </div>
          <div className="space-y-2 pt-2 border-t border-border">
            <Label className="text-xs text-muted-foreground">Relay via Agente (opcional — necessário quando firewall bloqueia conexão direta)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Agent URL</Label>
                <Input name="agent_url" placeholder="http://212.47.72.193:9100" className="bg-secondary border-border text-xs" defaultValue={(initialConfig?.agent_url as string) || ''} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Agent Token</Label>
                <Input name="agent_token" type="password" placeholder="Token do agente" className="bg-secondary border-border text-xs" defaultValue={(initialConfig?.agent_token as string) || ''} />
              </div>
            </div>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Coleta: CPU, Memória, Conexões, Storage e Top Waits via DMVs.</p>
    </div>
  );
}

function AirflowFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [authType, setAuthType] = useState((initialConfig?.auth_type as string) || 'jwt');
  const [airflowUrl, setAirflowUrl] = useState((initialConfig?.base_url as string) || '');
  const [airflowUser, setAirflowUser] = useState((initialConfig?.username as string) || '');
  const [airflowPass, setAirflowPass] = useState((initialConfig?.password as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setAirflowUrl(c.base_url || '');
      setAirflowUser(c.username || '');
      setAirflowPass(c.password || '');
      if (c.auth_type) setAuthType(c.auth_type);
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="airflow" onSelect={handleCredential} />
      <div className="space-y-2">
        <Label>Versão / Autenticação</Label>
        <Select name="airflow_auth_type" defaultValue={authType} onValueChange={setAuthType}>
          <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="jwt">Airflow 3.x (JWT automático)</SelectItem>
            <SelectItem value="basic">Airflow 2.x (Basic Auth)</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>URL do Airflow</Label>
        <Input name="airflow_url" required value={airflowUrl} onChange={e => setAirflowUrl(e.target.value)} placeholder="http://seu-airflow:8080" className="bg-secondary border-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Usuário</Label>
          <Input name="airflow_username" required value={airflowUser} onChange={e => setAirflowUser(e.target.value)} placeholder="admin" className="bg-secondary border-border" />
        </div>
        <div className="space-y-2">
          <Label>Senha</Label>
          <Input name="airflow_password" type="password" required value={airflowPass} onChange={e => setAirflowPass(e.target.value)} placeholder="••••••••" className="bg-secondary border-border" />
        </div>
      </div>
      {authType === 'jwt' ? (
        <div className="rounded-md border border-border bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground">
            🔐 <strong>JWT automático:</strong> O sistema obtém o token via <code>POST /auth/token</code> usando suas credenciais e o armazena em cache por 25 minutos. Você não precisa gerenciar tokens manualmente.
          </p>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-secondary/30 p-3">
          <p className="text-xs text-muted-foreground">
            🔑 <strong>Basic Auth:</strong> Usuário e senha são enviados diretamente em cada chamada à API <code>/api/v1</code>. Compatível com Airflow 2.x.
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        Coleta: Health do Scheduler, DAGs, DAG Runs, Import Errors, Pool Utilization.
      </p>
    </div>
  );
}

function LambdaFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [region, setRegion] = useState((initialConfig?.region as string) || '');
  const [credentialId, setCredentialId] = useState((initialConfig?.credential_id as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setCredentialId(cred.id);
      if (c.region) setRegion(c.region);
    } else {
      setCredentialId('');
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="lambda" onSelect={handleCredential} />
      <input type="hidden" name="credential_id" value={credentialId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Nome da Função Lambda</Label>
          <Input name="lambda_function_name" required placeholder="my-function-prod" className="bg-secondary border-border font-mono text-xs" defaultValue={(initialConfig?.function_name as string) || ''} />
        </div>
        <div className="space-y-2">
          <Label>Região AWS</Label>
          <Input name="lambda_region" placeholder="us-east-1" className="bg-secondary border-border" value={region} onChange={e => setRegion(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{credentialId ? '🔑 Usando credencial salva.' : 'Sem credencial — usará variáveis de ambiente do backend.'} Coleta via CloudWatch: Invocations, Errors, Duration (avg/p99), Throttles, ConcurrentExecutions.</p>
    </div>
  );
}

function EcsFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [region, setRegion] = useState((initialConfig?.region as string) || '');
  const [credentialId, setCredentialId] = useState((initialConfig?.credential_id as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setCredentialId(cred.id);
      if (c.region) setRegion(c.region);
    } else {
      setCredentialId('');
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="ecs" onSelect={handleCredential} />
      <input type="hidden" name="credential_id" value={credentialId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Cluster ECS</Label>
          <Input name="ecs_cluster" required placeholder="my-cluster" className="bg-secondary border-border font-mono text-xs" defaultValue={(initialConfig?.cluster as string) || ''} />
        </div>
        <div className="space-y-2">
          <Label>Nome do Serviço</Label>
          <Input name="ecs_service_name" required placeholder="my-service" className="bg-secondary border-border font-mono text-xs" defaultValue={(initialConfig?.service_name as string) || ''} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Região AWS</Label>
        <Input name="ecs_region" placeholder="us-east-1" className="bg-secondary border-border" value={region} onChange={e => setRegion(e.target.value)} />
      </div>
      <p className="text-xs text-muted-foreground">{credentialId ? '🔑 Usando credencial salva.' : 'Sem credencial — usará variáveis de ambiente do backend.'} Coleta: Tasks (running/desired/pending), CPU/Memory via CloudWatch, deployments.</p>
    </div>
  );
}

function CloudWatchAlarmsFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [region, setRegion] = useState((initialConfig?.region as string) || '');
  const [credentialId, setCredentialId] = useState((initialConfig?.credential_id as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setCredentialId(cred.id);
      if (c.region) setRegion(c.region);
    } else {
      setCredentialId('');
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="cloudwatch_alarms" onSelect={handleCredential} />
      <input type="hidden" name="credential_id" value={credentialId} />
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Prefixo de Alarmes (opcional)</Label>
          <Input name="cw_alarm_prefix" placeholder="prod-" className="bg-secondary border-border" defaultValue={(initialConfig?.alarm_prefix as string) || ''} />
        </div>
        <div className="space-y-2">
          <Label>Região AWS</Label>
          <Input name="cw_alarm_region" placeholder="us-east-1" className="bg-secondary border-border" value={region} onChange={e => setRegion(e.target.value)} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{credentialId ? '🔑 Usando credencial salva.' : 'Sem credencial — usará variáveis de ambiente do backend.'} Lista todos os alarmes CloudWatch. Filtre por prefixo para monitorar apenas alarmes específicos.</p>
    </div>
  );
}

function AgentInstallInstructions({ token }: { token?: string }) {
  const installCmd = `curl -fsSL https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/install-agent.sh | sudo bash -s --${token ? ` --token ${token}` : ' --token SEU_TOKEN'}`;

  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2">
      <p className="text-xs font-medium text-foreground">📦 Instalação Rápida (one-liner)</p>
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">Execute no servidor:</p>
        <code className="block text-[10px] bg-background p-2 rounded border border-border font-mono break-all select-all cursor-pointer" onClick={() => { navigator.clipboard.writeText(installCmd); toast.success('Comando copiado!'); }}>
          {installCmd}
        </code>
      </div>
      <p className="text-xs text-muted-foreground">
        ✅ Um único agente monitora: <strong>serviços systemd</strong>, <strong>containers Docker</strong> e <strong>métricas do servidor</strong> (CPU, RAM, disco).
      </p>
    </div>
  );
}

function DiscoverButton({ agentUrl, token, type, onDiscovered }: {
  agentUrl: string;
  token: string;
  type: 'systemctl' | 'container';
  onDiscovered: (items: { name: string; description?: string }[]) => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDiscover = async () => {
    if (!agentUrl) {
      toast.error('Preencha a URL do agente primeiro');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('discover-services', {
        body: { agent_url: agentUrl, token: token || undefined },
      });
      if (error) throw error;

      if (type === 'systemctl') {
        const services = data?.systemctl_services || [];
        if (services.length === 0) {
          toast.info('Nenhum serviço systemd encontrado no agente');
        } else {
          toast.success(`${services.length} serviços encontrados!`);
          onDiscovered(services.map((s: Record<string, string>) => ({ name: s.name, description: s.description })));
        }
      } else {
        const containers = data?.containers || [];
        if (containers.length === 0) {
          toast.info('Nenhum container encontrado no agente');
        } else {
          toast.success(`${containers.length} containers encontrados!`);
          onDiscovered(containers.map((c: Record<string, string>) => ({ name: c.name, description: `${c.image} (${c.state})` })));
        }
      }
    } catch (err: unknown) {
      toast.error(`Erro ao descobrir serviços: ${err instanceof Error ? err.message : 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleDiscover} disabled={loading || !agentUrl} className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
      {loading ? 'Descobrindo...' : 'Descobrir Serviços'}
    </Button>
  );
}

function DiscoveredList({ items, selected, onToggle }: {
  items: { name: string; description?: string }[];
  selected: Set<string>;
  onToggle: (name: string) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-2 max-h-48 overflow-y-auto">
      <p className="text-xs font-medium text-foreground">Serviços encontrados ({items.length})</p>
      {items.map((item) => (
        <label key={item.name} className="flex items-center gap-2 cursor-pointer hover:bg-secondary/50 rounded p-1 -m-1">
          <Checkbox
            checked={selected.has(item.name)}
            onCheckedChange={() => onToggle(item.name)}
          />
          <span className="text-xs font-mono">{item.name}</span>
          {item.description && <span className="text-xs text-muted-foreground truncate">— {item.description}</span>}
        </label>
      ))}
    </div>
  );
}

function SystemctlFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [agentUrl, setAgentUrl] = useState((initialConfig?.agent_url as string) || '');
  const [agentToken, setAgentToken] = useState((initialConfig?.token as string) || '');
  const [discovered, setDiscovered] = useState<{ name: string; description?: string }[]>([]);
  const initServices = Array.isArray(initialConfig?.services) ? (initialConfig.services as string[]) : [];
  const [selected, setSelected] = useState<Set<string>>(new Set(initServices));

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setAgentUrl(c.agent_url || '');
      setAgentToken(c.token || '');
    }
  };

  const toggleItem = (name: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectedValue = Array.from(selected).join(', ');

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="systemctl" onSelect={handleCredential} />
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs text-foreground">
          🔗 <strong>Agente Unificado</strong> — A mesma URL monitora serviços systemd, containers Docker e métricas do servidor automaticamente.
        </p>
      </div>
      <div className="space-y-2">
        <Label>URL do Agente</Label>
        <Input name="agent_url" required placeholder="http://192.168.1.100:9100" className="bg-secondary border-border font-mono text-xs" value={agentUrl} onChange={e => setAgentUrl(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Token de Autenticação (opcional)</Label>
        <Input name="agent_token" type="password" placeholder="••••••••" className="bg-secondary border-border font-mono text-xs" value={agentToken} onChange={e => setAgentToken(e.target.value)} />
      </div>

      <DiscoverButton agentUrl={agentUrl} token={agentToken} type="systemctl" onDiscovered={(items) => {
        setDiscovered(items);
        setSelected(new Set(items.map(i => i.name)));
      }} />

      <DiscoveredList items={discovered} selected={selected} onToggle={toggleItem} />

      <div className="space-y-2">
        <Label>Serviços a Monitorar (separados por vírgula)</Label>
        <Input name="systemctl_services" required placeholder="nginx, docker, postgresql, redis" className="bg-secondary border-border" value={selectedValue} onChange={e => {
          setSelected(new Set(e.target.value.split(',').map(s => s.trim()).filter(Boolean)));
          setDiscovered([]);
        }} />
      </div>
      <input type="hidden" name="agent_endpoint" value="/systemctl" />
      <AgentInstallInstructions token={agentToken} />
    </div>
  );
}

function ContainerFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [agentUrl, setAgentUrl] = useState((initialConfig?.agent_url as string) || '');
  const [agentToken, setAgentToken] = useState((initialConfig?.token as string) || '');
  const [discovered, setDiscovered] = useState<{ name: string; description?: string }[]>([]);

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setAgentUrl(c.agent_url || '');
      setAgentToken(c.token || '');
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="container" onSelect={handleCredential} />
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs text-foreground">
          🔗 <strong>Agente Unificado</strong> — Containers são descobertos automaticamente.
        </p>
      </div>
      <div className="space-y-2">
        <Label>URL do Agente</Label>
        <Input name="agent_url" required placeholder="http://192.168.1.100:9100" className="bg-secondary border-border font-mono text-xs" value={agentUrl} onChange={e => setAgentUrl(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Token de Autenticação (opcional)</Label>
        <Input name="agent_token" type="password" placeholder="••••••••" className="bg-secondary border-border font-mono text-xs" value={agentToken} onChange={e => setAgentToken(e.target.value)} />
      </div>

      <DiscoverButton agentUrl={agentUrl} token={agentToken} type="container" onDiscovered={setDiscovered} />

      {discovered.length > 0 && (
        <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-1 max-h-48 overflow-y-auto">
          <p className="text-xs font-medium text-foreground">Containers encontrados ({discovered.length})</p>
          {discovered.map((c) => (
            <div key={c.name} className="flex items-center gap-2 p-1">
              <span className="text-xs font-mono">{c.name}</span>
              {c.description && <span className="text-xs text-muted-foreground">— {c.description}</span>}
            </div>
          ))}
        </div>
      )}

      <input type="hidden" name="agent_endpoint" value="/containers" />
      <AgentInstallInstructions token={agentToken} />
    </div>
  );
}

function ServerFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [agentUrl, setAgentUrl] = useState((initialConfig?.agent_url as string) || '');
  const [agentToken, setAgentToken] = useState((initialConfig?.token as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setAgentUrl(c.agent_url || '');
      setAgentToken(c.token || '');
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="server" onSelect={handleCredential} />
      <div className="rounded-md border border-primary/20 bg-primary/5 p-3">
        <p className="text-xs text-foreground">
          📊 <strong>Métricas do Servidor</strong> — Monitora CPU, RAM, Swap, Disco, Rede, Load Average e Top Processos automaticamente.
        </p>
      </div>
      <div className="space-y-2">
        <Label>URL do Agente</Label>
        <Input name="agent_url" required placeholder="http://192.168.1.100:9100" className="bg-secondary border-border font-mono text-xs" value={agentUrl} onChange={e => setAgentUrl(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Token de Autenticação (opcional)</Label>
        <Input name="agent_token" type="password" placeholder="••••••••" className="bg-secondary border-border font-mono text-xs" value={agentToken} onChange={e => setAgentToken(e.target.value)} />
      </div>
      <AgentInstallInstructions token={agentToken} />
    </div>
  );
}

function SupabaseProjectFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [projectUrl, setProjectUrl] = useState((initialConfig?.project_url as string) || '');
  const [anonKey, setAnonKey] = useState((initialConfig?.anon_key as string) || '');
  const [serviceRoleKey, setServiceRoleKey] = useState((initialConfig?.service_role_key as string) || '');

  const handleCredential = (cred: Credential | null) => {
    if (cred) {
      const c = cred.config as Record<string, string>;
      setProjectUrl(c.project_url || '');
      setAnonKey(c.anon_key || '');
      setServiceRoleKey(c.service_role_key || '');
    }
  };

  return (
    <div className="space-y-3">
      <CredentialSelector checkType="supabase_project" onSelect={handleCredential} />
      <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
        <p className="text-xs text-foreground">
          🟢 <strong>Monitoramento Supabase Completo</strong> — Verifica REST API, Auth, Realtime, Storage, Edge Functions e Database (conexões, cache hit, queries ativas, tamanho do banco).
        </p>
      </div>
      <div className="space-y-2">
        <Label>URL do Projeto</Label>
        <Input name="sb_project_url" required placeholder="https://xyzcompany.supabase.co" className="bg-secondary border-border font-mono text-xs" value={projectUrl} onChange={e => setProjectUrl(e.target.value)} />
        <p className="text-[10px] text-muted-foreground">Ex: https://seu-project-ref.supabase.co</p>
      </div>
      <div className="space-y-2">
        <Label>Anon Key (publishable)</Label>
        <Input name="sb_anon_key" required type="password" placeholder="eyJhbGciOi..." className="bg-secondary border-border font-mono text-xs" value={anonKey} onChange={e => setAnonKey(e.target.value)} />
        <p className="text-[10px] text-muted-foreground">Usada para verificar REST API, Realtime e Storage</p>
      </div>
      <div className="space-y-2">
        <Label>Service Role Key</Label>
        <Input name="sb_service_role_key" required type="password" placeholder="eyJhbGciOi..." className="bg-secondary border-border font-mono text-xs" value={serviceRoleKey} onChange={e => setServiceRoleKey(e.target.value)} />
        <p className="text-[10px] text-muted-foreground">Usada para verificar Database e Edge Functions (nunca exposta no client)</p>
      </div>
      <div className="space-y-2">
        <Label>Edge Function para Teste (opcional)</Label>
        <Input name="sb_test_function" placeholder="health-check" className="bg-secondary border-border font-mono text-xs" defaultValue={(initialConfig?.test_function as string) || ''} />
        <p className="text-[10px] text-muted-foreground">Nome de uma função para testar o runtime. Padrão: health-check</p>
      </div>
      <div className="rounded-md border border-border bg-secondary/30 p-3 space-y-1">
        <p className="text-xs font-medium">O que é monitorado:</p>
        <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc pl-4">
          <li><strong>REST API</strong> — Latência e disponibilidade do PostgREST</li>
          <li><strong>Auth (GoTrue)</strong> — Health check do serviço de autenticação</li>
          <li><strong>Realtime</strong> — WebSocket gateway health</li>
          <li><strong>Storage</strong> — Serviço de upload/download de arquivos</li>
          <li><strong>Edge Functions</strong> — Runtime Deno disponível</li>
          <li><strong>Database</strong> — Conexões, cache hit ratio, queries ativas, tamanho</li>
        </ul>
      </div>
    </div>
  );
}