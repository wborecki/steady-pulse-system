import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Pencil, Trash2, KeyRound, Loader2, Database, Server, Cloud, Globe, Lock } from 'lucide-react';
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

const typeIcons: Record<CredentialType, React.ReactNode> = {
  aws: <Cloud className="h-4 w-4" />,
  agent: <Server className="h-4 w-4" />,
  airflow: <Globe className="h-4 w-4" />,
  postgresql: <Database className="h-4 w-4" />,
  mongodb: <Database className="h-4 w-4" />,
  azure_sql: <Database className="h-4 w-4" />,
  ssh: <Lock className="h-4 w-4" />,
  http_auth: <Globe className="h-4 w-4" />,
};

const typeColors: Record<CredentialType, string> = {
  aws: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  agent: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  airflow: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  postgresql: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
  mongodb: 'bg-green-500/10 text-green-400 border-green-500/20',
  azure_sql: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
  ssh: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  http_auth: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
};

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

  const openCreate = () => {
    setEditingCredential(null);
    setDialogOpen(true);
  };

  const openEdit = (cred: Credential) => {
    setEditingCredential(cred);
    setDialogOpen(true);
  };

  const openDelete = (id: string) => {
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

  const filtered = credentials?.filter(c => filterType === 'all' || c.credential_type === filterType) ?? [];

  // Group by type
  const grouped = filtered.reduce<Record<string, Credential[]>>((acc, c) => {
    const key = c.credential_type;
    if (!acc[key]) acc[key] = [];
    acc[key].push(c);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <div className="p-6 grid-bg min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 grid-bg min-h-screen">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-heading font-bold flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" />
            Conexões &amp; Credenciais
          </h1>
          <p className="text-sm text-muted-foreground font-mono">
            Gerencie credenciais reutilizáveis para serviços
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" /> Nova Credencial
        </Button>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Label className="text-xs text-muted-foreground">Filtrar:</Label>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48 bg-secondary border-border h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            {(Object.entries(credentialTypeLabels) as [CredentialType, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-2">{filtered.length} credencial(is)</span>
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <Card className="glass-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <KeyRound className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-heading font-semibold mb-1">Nenhuma credencial cadastrada</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Crie credenciais para reutilizá-las ao adicionar serviços.
            </p>
            <Button onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" /> Criar Primeira Credencial
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Grouped list */}
      {Object.entries(grouped).map(([type, creds]) => (
        <div key={type} className="space-y-3">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className={`${typeColors[type as CredentialType]} border px-2 py-0.5 text-xs font-medium`}>
              {typeIcons[type as CredentialType]}
              <span className="ml-1">{credentialTypeLabels[type as CredentialType]}</span>
            </Badge>
            <span className="text-xs text-muted-foreground">{creds.length}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {creds.map(cred => (
              <CredentialCard
                key={cred.id}
                credential={cred}
                onEdit={() => openEdit(cred)}
                onDelete={() => openDelete(cred.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Create / Edit Dialog */}
      <CredentialDialog
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

/** Card for a single credential */
function CredentialCard({ credential, onEdit, onDelete }: { credential: Credential; onEdit: () => void; onDelete: () => void }) {
  const type = credential.credential_type as CredentialType;
  const fields = credentialFields[type] || [];
  const configKeys = Object.keys(credential.config || {});
  const filledCount = configKeys.filter(k => {
    const v = (credential.config as Record<string, unknown>)[k];
    return v !== '' && v !== null && v !== undefined;
  }).length;

  return (
    <Card className="glass-card hover:border-primary/30 transition-all group">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${typeColors[type]} border`}>
              {typeIcons[type]}
            </div>
            <div>
              <CardTitle className="text-sm font-heading">{credential.name}</CardTitle>
              <p className="text-[10px] text-muted-foreground font-mono">{credentialTypeLabels[type]}</p>
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {credential.description && (
          <p className="text-xs text-muted-foreground mb-2">{credential.description}</p>
        )}
        <div className="flex flex-wrap gap-1.5">
          {fields.filter(f => {
            const v = (credential.config as Record<string, unknown>)[f.key];
            return v !== '' && v !== null && v !== undefined;
          }).map(f => (
            <Badge key={f.key} variant="secondary" className="text-[10px] font-mono">
              {f.label}: {f.type === 'password' ? '••••' : String((credential.config as Record<string, unknown>)[f.key] ?? '').slice(0, 20)}
            </Badge>
          ))}
          {filledCount === 0 && (
            <span className="text-[10px] text-muted-foreground italic">Sem campos preenchidos</span>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">
          Atualizado: {new Date(credential.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
        </p>
      </CardContent>
    </Card>
  );
}

/** Dialog for creating/editing a credential */
function CredentialDialog({ open, onOpenChange, credential, onSave, isSaving }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  credential: Credential | null;
  onSave: (data: CreateCredentialInput) => Promise<void>;
  isSaving: boolean;
}) {
  const [type, setType] = useState<CredentialType>(credential?.credential_type as CredentialType || 'agent');
  const [name, setName] = useState(credential?.name || '');
  const [description, setDescription] = useState(credential?.description || '');
  const [config, setConfig] = useState<Record<string, string>>(() => {
    if (credential?.config) {
      const obj: Record<string, string> = {};
      for (const [k, v] of Object.entries(credential.config as Record<string, unknown>)) {
        obj[k] = String(v ?? '');
      }
      return obj;
    }
    return {};
  });

  // Reset form when dialog opens with different credential
  const resetForm = (cred: Credential | null) => {
    setType(cred?.credential_type as CredentialType || 'agent');
    setName(cred?.name || '');
    setDescription(cred?.description || '');
    if (cred?.config) {
      const obj: Record<string, string> = {};
      for (const [k, v] of Object.entries(cred.config as Record<string, unknown>)) {
        obj[k] = String(v ?? '');
      }
      setConfig(obj);
    } else {
      setConfig({});
    }
  };

  // Reset when credential changes
  const isEditing = !!credential;

  const handleOpenChange = (v: boolean) => {
    if (v) {
      resetForm(credential);
    }
    onOpenChange(v);
  };

  const fields = credentialFields[type] || [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Nome é obrigatório');
      return;
    }
    // Validate required fields
    for (const f of fields) {
      if (f.required && !config[f.key]?.trim()) {
        toast.error(`Campo "${f.label}" é obrigatório`);
        return;
      }
    }
    // Clean empty values
    const cleanConfig: Record<string, string> = {};
    for (const [k, v] of Object.entries(config)) {
      if (v.trim()) cleanConfig[k] = v.trim();
    }
    await onSave({
      name: name.trim(),
      credential_type: type,
      config: cleanConfig as unknown as Json,
      description: description.trim() || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-heading">
            {isEditing ? 'Editar Credencial' : 'Nova Credencial'}
          </DialogTitle>
          <DialogDescription>
            {isEditing ? 'Atualize os dados da credencial.' : 'Crie uma credencial reutilizável para seus serviços.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            {fields.map(f => (
              <div key={f.key} className="space-y-1">
                <Label className="text-xs">
                  {f.label} {f.required && <span className="text-destructive">*</span>}
                </Label>
                {f.key === 'private_key' ? (
                  <Textarea
                    value={config[f.key] || ''}
                    onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="bg-secondary border-border font-mono text-xs min-h-[80px]"
                    required={f.required}
                  />
                ) : (
                  <Input
                    type={f.type || 'text'}
                    value={config[f.key] || ''}
                    onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    className="bg-secondary border-border font-mono text-xs"
                    required={f.required}
                  />
                )}
              </div>
            ))}
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

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isSaving} className="gap-2">
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
