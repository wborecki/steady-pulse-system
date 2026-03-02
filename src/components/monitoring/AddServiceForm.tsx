import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useCreateService, useUpdateService } from '@/hooks/useServices';
import { toast } from 'sonner';
import { Minus, Plus } from 'lucide-react';

const categoryLabels: Record<string, string> = {
  aws: 'AWS', database: 'Banco de Dados', airflow: 'Airflow',
  server: 'Servidores', process: 'Processos', api: 'APIs',
};

const categoryCheckTypes: Record<string, string[]> = {
  aws: ['cloudwatch', 's3'],
  database: ['sql_query', 'postgresql', 'mongodb'],
  airflow: ['airflow'],
  server: ['tcp', 'process'],
  process: ['process'],
  api: ['http'],
};

const checkTypeLabels: Record<string, string> = {
  http: 'HTTP / Site',
  tcp: 'TCP',
  sql_query: 'SQL Server (Azure)',
  postgresql: 'PostgreSQL',
  mongodb: 'MongoDB',
  cloudwatch: 'AWS CloudWatch',
  s3: 'AWS S3',
  process: 'Processo',
  airflow: 'Apache Airflow',
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
  const [httpAuthType, setHttpAuthType] = useState('none');
  const [sshEnabled, setSshEnabled] = useState(false);
  const [sshAuthMethod, setSshAuthMethod] = useState<'password' | 'key'>('password');
  const [dbInputMode, setDbInputMode] = useState<'connection_string' | 'fields'>('connection_string');
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);

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
        break;
      }
      case 'postgresql': {
        if (dbInputMode === 'connection_string') {
          checkConfig = { connection_string: form.get('pg_connection_string') as string };
        } else {
          checkConfig = {
            host: form.get('db_host') as string,
            port: Number(form.get('db_port') || 5432),
            database: form.get('db_name') as string,
            username: form.get('db_username') as string,
            password: form.get('db_password') as string,
            ssl_mode: (form.get('db_ssl_mode') as string) || 'prefer',
          };
        }
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
        };
        break;
      case 's3':
        checkConfig = {
          bucket_name: form.get('s3_bucket') as string,
          region: (form.get('s3_region') as string) || undefined,
          prefix: (form.get('s3_prefix') as string) || undefined,
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
    }

    const serviceData = {
      name: form.get('name') as string,
      category,
      url,
      description: (form.get('description') as string) || '',
      check_type: checkType,
      check_config: checkConfig,
      check_interval_seconds: Number(form.get('interval') || 60),
    };

    try {
      if (mode === 'edit' && initialData?.id) {
        await updateService.mutateAsync({ id: initialData.id, ...serviceData } as any);
        toast.success('Serviço atualizado!');
      } else {
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
      {checkType === 'http' && <HttpFields httpAuthType={httpAuthType} setHttpAuthType={setHttpAuthType} headers={headers} addHeader={addHeader} removeHeader={removeHeader} updateHeader={updateHeader} />}

      {/* TCP fields */}
      {checkType === 'tcp' && <TcpFields sshEnabled={sshEnabled} setSshEnabled={setSshEnabled} sshAuthMethod={sshAuthMethod} setSshAuthMethod={setSshAuthMethod} />}

      {/* Process fields */}
      {checkType === 'process' && <ProcessFields category={category} sshEnabled={sshEnabled} setSshEnabled={setSshEnabled} sshAuthMethod={sshAuthMethod} setSshAuthMethod={setSshAuthMethod} />}

      {/* SQL Server fields */}
      {checkType === 'sql_query' && <SqlServerFields dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} />}

      {/* Airflow fields */}
      {checkType === 'airflow' && <AirflowFields initialConfig={initialData?.check_config} />}

      {/* PostgreSQL fields */}
      {checkType === 'postgresql' && <PostgresFields dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} />}

      {/* MongoDB fields */}
      {checkType === 'mongodb' && <MongoFields dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} />}

      {/* CloudWatch fields */}
      {checkType === 'cloudwatch' && <CloudWatchFields />}

      {/* S3 fields */}
      {checkType === 's3' && <S3Fields />}

      {/* Interval */}
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

function HttpFields({ httpAuthType, setHttpAuthType, headers, addHeader, removeHeader, updateHeader }: {
  httpAuthType: string; setHttpAuthType: (v: string) => void;
  headers: { key: string; value: string }[];
  addHeader: () => void; removeHeader: (i: number) => void;
  updateHeader: (i: number, f: 'key' | 'value', v: string) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>URL / Endpoint</Label>
        <Input name="url" required placeholder="https://api.empresa.com" className="bg-secondary border-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Método HTTP</Label>
          <Select name="http_method" defaultValue="GET">
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
          <Input name="expected_status" type="number" placeholder="200" className="bg-secondary border-border" />
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
            <Input name="http_username" required className="bg-secondary border-border" />
          </div>
          <div className="space-y-2">
            <Label>Senha</Label>
            <Input name="http_password" type="password" required className="bg-secondary border-border" />
          </div>
        </div>
      )}
      {httpAuthType === 'bearer' && (
        <div className="space-y-2">
          <Label>Token</Label>
          <Input name="http_token" required placeholder="eyJhbGciOi..." className="bg-secondary border-border font-mono text-xs" />
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

function TcpFields({ sshEnabled, setSshEnabled, sshAuthMethod, setSshAuthMethod }: {
  sshEnabled: boolean; setSshEnabled: (v: boolean) => void;
  sshAuthMethod: 'password' | 'key'; setSshAuthMethod: (v: 'password' | 'key') => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-2">
          <Label>Host</Label>
          <Input name="tcp_host" required placeholder="db.empresa.com" className="bg-secondary border-border" />
        </div>
        <div className="space-y-2">
          <Label>Porta</Label>
          <Input name="tcp_port" type="number" required placeholder="5432" className="bg-secondary border-border" />
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

function ProcessFields({ category, sshEnabled, setSshEnabled, sshAuthMethod, setSshAuthMethod }: {
  category: string; sshEnabled: boolean; setSshEnabled: (v: boolean) => void;
  sshAuthMethod: 'password' | 'key'; setSshAuthMethod: (v: 'password' | 'key') => void;
}) {
  const alwaysSsh = category === 'process';
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Nome do Processo / Comando</Label>
        <Input name="process_name" required placeholder="nginx, java, python app.py" className="bg-secondary border-border" />
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

function PostgresFields({ dbInputMode, setDbInputMode }: { dbInputMode: string; setDbInputMode: (v: 'connection_string' | 'fields') => void }) {
  return (
    <div className="space-y-3">
      <DbInputModeToggle dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} />
      {dbInputMode === 'connection_string' ? (
        <div className="space-y-2">
          <Label>Connection String</Label>
          <Input name="pg_connection_string" required placeholder="postgresql://user:pass@host:5432/dbname" className="bg-secondary border-border font-mono text-xs" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Host</Label>
              <Input name="db_host" required placeholder="db.empresa.com" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Porta</Label>
              <Input name="db_port" type="number" defaultValue="5432" className="bg-secondary border-border" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Database</Label>
            <Input name="db_name" required placeholder="meu_banco" className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input name="db_username" required className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input name="db_password" type="password" required className="bg-secondary border-border" />
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

function MongoFields({ dbInputMode, setDbInputMode }: { dbInputMode: string; setDbInputMode: (v: 'connection_string' | 'fields') => void }) {
  return (
    <div className="space-y-3">
      <DbInputModeToggle dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} />
      {dbInputMode === 'connection_string' ? (
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Connection String</Label>
            <Input name="mongo_connection_string" required placeholder="mongodb+srv://user:pass@cluster.mongodb.net" className="bg-secondary border-border font-mono text-xs" />
          </div>
          <div className="space-y-2">
            <Label>Database (opcional)</Label>
            <Input name="mongo_database" placeholder="nome_do_banco" className="bg-secondary border-border" />
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-2">
              <Label>Host</Label>
              <Input name="db_host" required placeholder="cluster.mongodb.net" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Porta</Label>
              <Input name="db_port" type="number" defaultValue="27017" className="bg-secondary border-border" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Database</Label>
            <Input name="db_name" required placeholder="meu_banco" className="bg-secondary border-border" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input name="db_username" required className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input name="db_password" type="password" required className="bg-secondary border-border" />
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

function CloudWatchFields() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Tipo de Recurso</Label>
          <Select name="cw_metric_type" defaultValue="EC2">
            <SelectTrigger className="bg-secondary border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="EC2">EC2</SelectItem>
              <SelectItem value="RDS">RDS</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Região AWS</Label>
          <Input name="cw_region" placeholder="us-east-1" className="bg-secondary border-border" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Instance ID / DB Identifier</Label>
        <Input name="cw_instance_id" required placeholder="i-0abc123def" className="bg-secondary border-border font-mono text-xs" />
      </div>
      <p className="text-xs text-muted-foreground">Usa credenciais AWS do backend. Coleta CPU, Network, StatusCheck (EC2) ou CPU, Memória, Conexões (RDS).</p>
    </div>
  );
}

function S3Fields() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Nome do Bucket</Label>
          <Input name="s3_bucket" required placeholder="meu-bucket-prod" className="bg-secondary border-border" />
        </div>
        <div className="space-y-2">
          <Label>Região AWS</Label>
          <Input name="s3_region" placeholder="us-east-1" className="bg-secondary border-border" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Prefixo (opcional)</Label>
        <Input name="s3_prefix" placeholder="logs/2024/" className="bg-secondary border-border" />
      </div>
      <p className="text-xs text-muted-foreground">Usa credenciais AWS do backend. Verifica acessibilidade do bucket.</p>
    </div>
  );
}

function SqlServerFields({ dbInputMode, setDbInputMode }: { dbInputMode: string; setDbInputMode: (v: 'connection_string' | 'fields') => void }) {
  return (
    <div className="space-y-3">
      <DbInputModeToggle dbInputMode={dbInputMode} setDbInputMode={setDbInputMode} />
      {dbInputMode === 'connection_string' ? (
        <div className="space-y-2">
          <Label>Connection String</Label>
          <Input name="mssql_connection_string" required placeholder="Server=host;Database=db;User Id=user;Password=pass;" className="bg-secondary border-border font-mono text-xs" />
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Host / Server</Label>
              <Input name="db_host" required placeholder="server.database.windows.net" className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Database</Label>
              <Input name="db_name" required placeholder="meu_banco" className="bg-secondary border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Usuário</Label>
              <Input name="db_username" required className="bg-secondary border-border" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input name="db_password" type="password" required className="bg-secondary border-border" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" name="db_trust_cert" id="db_trust_cert" className="rounded border-border" />
            <Label htmlFor="db_trust_cert" className="text-xs">Trust Server Certificate</Label>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground">Coleta: CPU, Memória, Conexões, Storage e Top Waits via DMVs.</p>
    </div>
  );
}

function AirflowFields({ initialConfig }: { initialConfig?: Record<string, unknown> }) {
  const [authType, setAuthType] = useState((initialConfig?.auth_type as string) || 'jwt');
  return (
    <div className="space-y-3">
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
        <Input name="airflow_url" required defaultValue={(initialConfig?.base_url as string) || ''} placeholder="http://seu-airflow:8080" className="bg-secondary border-border" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>Usuário</Label>
          <Input name="airflow_username" required defaultValue={(initialConfig?.username as string) || ''} placeholder="admin" className="bg-secondary border-border" />
        </div>
        <div className="space-y-2">
          <Label>Senha</Label>
          <Input name="airflow_password" type="password" required defaultValue={(initialConfig?.password as string) || ''} placeholder="••••••••" className="bg-secondary border-border" />
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
