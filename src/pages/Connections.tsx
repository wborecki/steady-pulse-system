import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { PageLoader } from '@/components/PageLoader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, KeyRound, Loader2, Database, Server, Cloud, Globe, Lock, Search, Filter, Clock, Wifi, CheckCircle2, XCircle, PlayCircle } from 'lucide-react';
import {
  useCredentials,
  useCreateCredential,
  useUpdateCredential,
  useDeleteCredential,
  credentialTypeLabels,
  credentialFields,
  type Credential,
  type CredentialType,
  type CreateCredentialInput,
} from '@/hooks/useCredentials';
import type { Json } from '@/integrations/supabase/types';
import { supabase } from '@/integrations/supabase/client';

const typeIcons: Record<CredentialType, React.ReactNode> = {
  aws: <Cloud className="h-4 w-4" />,
  agent: <Server className="h-4 w-4" />,
  airflow: <Globe className="h-4 w-4" />,
  postgresql: <Database className="h-4 w-4" />,
  mongodb: <Database className="h-4 w-4" />,
  azure_sql: <Database className="h-4 w-4" />,
  sql_server: <Database className="h-4 w-4" />,
  ssh: <Lock className="h-4 w-4" />,
  http_auth: <Globe className="h-4 w-4" />,
  supabase: <Database className="h-4 w-4" />,
};

const typeColors: Record<CredentialType, string> = {
  aws: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  agent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  airflow: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  postgresql: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  mongodb: 'bg-green-500/10 text-green-400 border-green-500/20',
  azure_sql: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  sql_server: 'bg-red-500/10 text-red-400 border-red-500/20',
  ssh: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  http_auth: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  supabase: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
};

/** Fields that should always be masked — auto-collected from definitions + connection strings */
const sensitiveKeys = new Set([
  ...Object.values(credentialFields).flatMap(fields =>
    fields.filter(f => f.type === 'password').map(f => f.key)
  ),
  'connection_string',
]);

function maskValue(key: string, value: string): string {
  if (sensitiveKeys.has(key)) return '••••••••';
  if (value.length > 24) return value.slice(0, 24) + '…';
  return value;
}

function getTimeSince(date: string): { text: string; color: string } {
  const diffMin = Math.round((Date.now() - new Date(date).getTime()) / 60000);
  if (diffMin < 60) return { text: `${diffMin}min`, color: 'text-success' };
  if (diffMin < 1440) return { text: `${Math.round(diffMin / 60)}h`, color: 'text-muted-foreground' };
  return { text: `${Math.round(diffMin / 1440)}d`, color: 'text-muted-foreground' };
}

/** Test a credential — by ID (saved) or by raw config (unsaved/editing) */
async function testCredentialApi(params: { credentialId?: string; config?: Record<string, unknown>; credentialType?: string }): Promise<{ success: boolean; message: string; response_time?: number }> {
  const body = params.credentialId
    ? { credential_id: params.credentialId }
    : { config: params.config, credential_type: params.credentialType };

  const res = await supabase.functions.invoke('test-credential', { body });
  const result = res.data as { success: boolean; message: string; response_time?: number } | null;
  if (!result) throw new Error(res.error?.message || 'Sem resposta');
  return result;
}

export default function Connections() {
  const { data: credentials, isLoading } = useCredentials();
  const createMutation = useCreateCredential();
  const updateMutation = useUpdateCredential();
  const deleteMutation = useDeleteCredential();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [bulkTestResults, setBulkTestResults] = useState<Record<string, { status: 'idle' | 'testing' | 'success' | 'error'; message?: string }>>({});
  const [bulkTesting, setBulkTesting] = useState(false);

  const handleTestAll = useCallback(async () => {
    if (!credentials?.length) return;
    setBulkTesting(true);
    const initial: Record<string, { status: 'idle' | 'testing' | 'success' | 'error'; message?: string }> = {};
    for (const c of credentials) initial[c.id] = { status: 'testing' };
    setBulkTestResults(initial);

    let ok = 0;
    let fail = 0;
    for (const cred of credentials) {
      try {
        const r = await testCredentialApi({ credentialId: cred.id });
        setBulkTestResults(prev => ({ ...prev, [cred.id]: { status: r.success ? 'success' : 'error', message: r.message } }));
        if (r.success) ok++; else fail++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'erro';
        setBulkTestResults(prev => ({ ...prev, [cred.id]: { status: 'error', message: msg } }));
        fail++;
      }
    }
    setBulkTesting(false);
    toast.success(`Teste concluído: ${ok} OK, ${fail} falha(s)`);
  }, [credentials]);

  const openCreate = () => {
    setEditingCredential(null);
    setDialogOpen(true);
  };

  const openEdit = (cred: Credential) => {
    setEditingCredential(cred);
    setDialogOpen(true);
  };

  const openDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeletingId(id);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success('Credencial excluída');
    } catch {
      toast.error('Erro ao excluir credencial');
    } finally {
      setDeleteDialogOpen(false);
      setDeletingId(null);
    }
  };

  const filtered = (credentials ?? [])
    .filter(c => filterType === 'all' || c.credential_type === filterType)
    .filter(c => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return c.name.toLowerCase().includes(q)
        || (c.description || '').toLowerCase().includes(q)
        || credentialTypeLabels[c.credential_type as CredentialType]?.toLowerCase().includes(q);
    });

  if (isLoading) {
    return <PageLoader />;
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 grid-bg min-h-screen">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-heading font-bold flex items-center gap-2">
            <KeyRound className="h-5 w-5 sm:h-6 sm:w-6 text-primary flex-shrink-0" />
            Conexões &amp; Credenciais
          </h1>
          <p className="text-sm text-muted-foreground font-mono hidden sm:block">
            Gerencie credenciais reutilizáveis para serviços
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {(credentials?.length ?? 0) > 0 && (
            <Button onClick={handleTestAll} disabled={bulkTesting} variant="outline" size="sm" className="gap-1.5">
              {bulkTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
              <span className="hidden sm:inline">Testar</span> Todas
            </Button>
          )}
          <Button onClick={openCreate} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" /> <span className="hidden sm:inline">Nova</span> Credencial
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 bg-secondary border-border h-9 text-sm" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[140px] sm:w-48 bg-secondary border-border h-9 text-xs sm:text-sm flex-shrink-0">
            <Filter className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" /><SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.entries(credentialTypeLabels) as [CredentialType, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-[10px] sm:text-xs text-muted-foreground flex-shrink-0 hidden sm:inline">{filtered.length} credencial(is)</span>
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <KeyRound className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-heading font-semibold mb-1">Nenhuma credencial encontrada</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {credentials?.length ? 'Ajuste os filtros ou busca.' : 'Crie credenciais para reutilizá-las ao adicionar serviços.'}
              </p>
              {!credentials?.length && (
                <Button onClick={openCreate} className="gap-2">
                  <Plus className="h-4 w-4" /> Criar Primeira Credencial
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          filtered.map(cred => (
            <CredentialRow
              key={cred.id}
              credential={cred}
              onEdit={() => openEdit(cred)}
              onDelete={(e) => openDelete(cred.id, e)}
              testResult={bulkTestResults[cred.id]}
            />
          ))
        )}
      </div>

      {/* Create / Edit Sheet */}
      <CredentialDialog
        key={editingCredential?.id ?? 'new'}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        credential={editingCredential}
        onSave={async (data) => {
          try {
            if (editingCredential) {
              await updateMutation.mutateAsync({ id: editingCredential.id, ...data });
              toast.success('Credencial atualizada!');
            } else {
              await createMutation.mutateAsync(data);
              toast.success('Credencial criada!');
            }
            setDialogOpen(false);
          } catch {
            toast.error('Erro ao salvar credencial');
          }
        }}
        isSaving={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir credencial?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é irreversível. Serviços que usam esta credencial continuarão funcionando com os dados já salvos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Row for a single credential — same pattern as ServiceRow */
function CredentialRow({ credential, onEdit, onDelete, testResult }: { credential: Credential; onEdit: () => void; onDelete: (e: React.MouseEvent) => void; testResult?: { status: 'idle' | 'testing' | 'success' | 'error'; message?: string } }) {
  const type = credential.credential_type as CredentialType;
  const fields = credentialFields[type] || [];
  const config = credential.config as Record<string, unknown>;
  const timeSince = getTimeSince(credential.updated_at);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Use bulk test result when available
  const isBulkTesting = testResult?.status === 'testing';
  const bulkDone = testResult?.status === 'success' || testResult?.status === 'error';

  const handleTest = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    setTesting(true);
    setResult(null);
    try {
      const r = await testCredentialApi({ credentialId: credential.id });
      setResult({ ok: r.success, msg: r.message });
      if (r.success) toast.success(`${credential.name}: ${r.message}`);
      else toast.error(`${credential.name}: ${r.message}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'desconhecido';
      setResult({ ok: false, msg });
      toast.error(`${credential.name}: ${msg}`);
    } finally {
      setTesting(false);
    }
  }, [credential.id, credential.name]);

  // Get first non-sensitive visible field for summary
  const summaryFields = fields.filter(f => {
    const v = config[f.key];
    return v !== '' && v !== null && v !== undefined;
  }).slice(0, 3);

  return (
    <Card
      className="glass-card p-3 sm:p-4 cursor-pointer hover:border-primary/40 transition-all group"
      onClick={onEdit}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Icon */}
        <div className={`p-2 rounded-lg ${typeColors[type]} border flex-shrink-0`}>
          {typeIcons[type]}
        </div>

        {/* Name & info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading font-semibold text-sm truncate">{credential.name}</h3>
            <Badge variant="outline" className={`${typeColors[type]} border px-1.5 py-0 text-[10px] font-medium`}>
              {credentialTypeLabels[type]}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono truncate mt-0.5">
            {credential.description || summaryFields.map(f => `${f.label}: ${maskValue(f.key, String(config[f.key] ?? ''))}`).join(' • ') || 'Sem descrição'}
          </p>
        </div>

        {/* Config badges — desktop */}
        <div className="hidden md:flex items-center gap-1.5 max-w-xs flex-wrap justify-end">
          {summaryFields.map(f => (
            <Badge key={f.key} variant="secondary" className="text-[10px] font-mono whitespace-nowrap">
              {f.label}: {maskValue(f.key, String(config[f.key] ?? ''))}
            </Badge>
          ))}
        </div>

        {/* Time since update */}
        <div className="text-right hidden sm:block flex-shrink-0">
          <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono ${timeSince.color} bg-secondary`}>
            <Clock className="h-2.5 w-2.5" />
            {timeSince.text}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-1 flex-shrink-0 items-center">
          {/* Test result indicator */}
          {(result || bulkDone) && !testing && !isBulkTesting && (
            (result?.ok || testResult?.status === 'success')
              ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
              : <span title={result?.msg || testResult?.message}><XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" /></span>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-400 hover:text-blue-300" onClick={handleTest} disabled={testing || isBulkTesting} title="Testar conexão">
            {(testing || isBulkTesting) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wifi className="h-3.5 w-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

/** Sheet for creating/editing a credential */
function CredentialDialog({ open, onOpenChange, credential, onSave, isSaving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  credential: Credential | null;
  onSave: (data: CreateCredentialInput) => Promise<void>;
  isSaving: boolean;
}) {
  const UNCHANGED_SENTINEL = '••••••••';

  const buildConfigState = (cred: Credential | null): Record<string, string> => {
    if (!cred?.config) return {};
    const obj: Record<string, string> = {};
    for (const [k, v] of Object.entries(cred.config as Record<string, unknown>)) {
      obj[k] = sensitiveKeys.has(k) ? UNCHANGED_SENTINEL : String(v ?? '');
    }
    return obj;
  };

  const [type, setType] = useState<CredentialType>(credential?.credential_type as CredentialType || 'agent');
  const [name, setName] = useState(credential?.name ?? '');
  const [description, setDescription] = useState(credential?.description ?? '');
  const [config, setConfig] = useState<Record<string, string>>(() => buildConfigState(credential));
  const [testingConn, setTestingConn] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Sync form state when the dialog reopens for an already-mounted instance
  useEffect(() => {
    if (!open) return;
    setType(credential?.credential_type as CredentialType || 'agent');
    setName(credential?.name ?? '');
    setDescription(credential?.description ?? '');
    setConfig(buildConfigState(credential));
    setTestResult(null);
    setTestingConn(false);
  }, [open, credential]);

  const isEditing = !!credential;

  const fields = credentialFields[type] || [];

  /** Build a clean config for testing — resolves sentinel values to originals */
  const buildCleanConfig = (): Record<string, string> => {
    const cleanConfig: Record<string, string> = {};
    const originalConfig = (credential?.config as Record<string, unknown>) ?? {};
    for (const [k, v] of Object.entries(config)) {
      const trimmed = v.trim();
      if (!trimmed) continue;
      if (trimmed === UNCHANGED_SENTINEL && isEditing) {
        const orig = originalConfig[k];
        if (orig) cleanConfig[k] = String(orig);
      } else {
        cleanConfig[k] = trimmed;
      }
    }
    return cleanConfig;
  };

  const handleTestConnection = async () => {
    setTestingConn(true);
    setTestResult(null);
    try {
      if (isEditing && credential) {
        // For an existing credential, test by ID if config hasn't been manually changed
        // This avoids leaking sentinel values
        const r = await testCredentialApi({ credentialId: credential.id });
        setTestResult({ ok: r.success, msg: r.message });
      } else {
        // For new credentials or when config was changed, send inline config
        const cleanConfig = buildCleanConfig();
        const r = await testCredentialApi({ config: cleanConfig, credentialType: type });
        setTestResult({ ok: r.success, msg: r.message });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      setTestResult({ ok: false, msg });
    } finally {
      setTestingConn(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    // Validate required fields (skip sentinel for editing)
    for (const f of fields) {
      const val = config[f.key]?.trim();
      if (f.required && !val) {
        toast.error(`Campo "${f.label}" é obrigatório`);
        return;
      }
    }
    // Build clean config — keep original values for unchanged sensitive fields
    const cleanConfig: Record<string, string> = {};
    const originalConfig = (credential?.config as Record<string, unknown>) ?? {};
    for (const [k, v] of Object.entries(config)) {
      const trimmed = v.trim();
      if (!trimmed) continue;
      // If user didn't change a sensitive field, keep original DB value
      if (trimmed === UNCHANGED_SENTINEL && isEditing) {
        const orig = originalConfig[k];
        if (orig) cleanConfig[k] = String(orig);
      } else {
        cleanConfig[k] = trimmed;
      }
    }
    await onSave({
      name: name.trim(),
      credential_type: type,
      config: cleanConfig as unknown as Json,
      description: description.trim() || null,
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card border-border w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-heading">
            {isEditing ? 'Editar Credencial' : 'Nova Credencial'}
          </SheetTitle>
          <SheetDescription>
            {isEditing ? 'Atualize os dados da credencial.' : 'Crie uma credencial reutilizável para seus serviços.'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Type */}
          <div className="space-y-2">
            <Label>Tipo de Credencial</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as CredentialType);
                setConfig({});
              }}
              disabled={isEditing}
            >
              <SelectTrigger className="bg-secondary border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(credentialTypeLabels) as [CredentialType, string][]).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    <span className="flex items-center gap-2">
                      {typeIcons[key]}
                      {label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              required
              placeholder="Ex: AWS Produção, Servidor Principal"
              className="bg-secondary border-border"
            />
          </div>

          {/* Dynamic config fields */}
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Configuração</Label>
            {fields.map(f => {
              const isSensitive = sensitiveKeys.has(f.key) || f.type === 'password';
              const value = config[f.key] || '';
              const isUnchanged = value === UNCHANGED_SENTINEL;
              return (
                <div key={f.key} className="space-y-1">
                  <Label className="text-xs">
                    {f.label} {f.required && <span className="text-destructive">*</span>}
                    {isEditing && isSensitive && isUnchanged && (
                      <span className="text-muted-foreground ml-1">(mantido)</span>
                    )}
                  </Label>
                  {f.key === 'private_key' ? (
                    <Textarea
                      value={isUnchanged ? '' : value}
                      onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={isUnchanged ? '••••••••  (clique para alterar)' : f.placeholder}
                      className="bg-secondary border-border font-mono text-xs min-h-[80px]"
                      required={f.required && !isUnchanged}
                      onFocus={() => {
                        if (isUnchanged) setConfig(prev => ({ ...prev, [f.key]: '' }));
                      }}
                    />
                  ) : (
                    <Input
                      type={isSensitive ? 'password' : (f.type || 'text')}
                      value={isUnchanged ? UNCHANGED_SENTINEL : value}
                      onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                      placeholder={f.placeholder}
                      className="bg-secondary border-border font-mono text-xs"
                      required={f.required && !isUnchanged}
                      onFocus={() => {
                        if (isUnchanged) setConfig(prev => ({ ...prev, [f.key]: '' }));
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Ex: Credenciais do ambiente de produção"
              className="bg-secondary border-border"
            />
          </div>

          {/* Test result */}
          {testResult && (
            <div className={`flex items-center gap-2 rounded-md border p-3 text-xs ${testResult.ok ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400' : 'border-red-500/30 bg-red-500/5 text-red-400'}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <XCircle className="h-4 w-4 flex-shrink-0" />}
              <span>{testResult.msg}</span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="gap-2" onClick={handleTestConnection} disabled={testingConn || isSaving}>
              {testingConn ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wifi className="h-4 w-4" />}
              Testar
            </Button>
            <div className="flex-1" />
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
