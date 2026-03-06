import { useState } from 'react';
import { useSnippets, useCreateSnippet, useUpdateSnippet, useDeleteSnippet, BUILTIN_SNIPPETS, type CommandSnippet } from '@/hooks/useSnippets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Code2, Plus, Pencil, Trash2, Play, Copy, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

const CATEGORIES = [
  { value: 'sistema', label: 'Sistema' },
  { value: 'processos', label: 'Processos' },
  { value: 'rede', label: 'Rede' },
  { value: 'serviços', label: 'Serviços' },
  { value: 'docker', label: 'Docker' },
  { value: 'logs', label: 'Logs' },
  { value: 'banco', label: 'Banco de Dados' },
  { value: 'custom', label: 'Custom' },
];

interface SnippetManagerProps {
  onRunSnippet: (command: string) => void;
}

export function SnippetManager({ onRunSnippet }: SnippetManagerProps) {
  const { data: dbSnippets = [], isLoading } = useSnippets();
  const createSnippet = useCreateSnippet();
  const updateSnippet = useUpdateSnippet();
  const deleteSnippet = useDeleteSnippet();

  const [showDialog, setShowDialog] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<CommandSnippet | null>(null);
  const [form, setForm] = useState({ name: '', description: '', command: '', category: 'custom' });
  const [filter, setFilter] = useState('all');

  // Merge built-in (virtual, not from DB) + user snippets
  const allSnippets: (CommandSnippet | (typeof BUILTIN_SNIPPETS[number] & { id: string; is_builtin: true; created_at: string; updated_at: string }))[] = [
    ...BUILTIN_SNIPPETS.map((s, i) => ({
      ...s,
      id: `builtin-${i}`,
      is_builtin: true as const,
      created_at: '',
      updated_at: '',
    })),
    ...dbSnippets,
  ];

  const filtered = filter === 'all'
    ? allSnippets
    : filter === 'custom'
      ? allSnippets.filter(s => !s.is_builtin)
      : allSnippets.filter(s => s.category === filter);

  const openCreate = () => {
    setEditingSnippet(null);
    setForm({ name: '', description: '', command: '', category: 'custom' });
    setShowDialog(true);
  };

  const openEdit = (snippet: CommandSnippet) => {
    setEditingSnippet(snippet);
    setForm({ name: snippet.name, description: snippet.description, command: snippet.command, category: snippet.category });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.command.trim()) {
      toast.error('Nome e comando são obrigatórios');
      return;
    }
    if (editingSnippet) {
      await updateSnippet.mutateAsync({ id: editingSnippet.id, ...form });
      toast.success('Snippet atualizado');
    } else {
      await createSnippet.mutateAsync(form);
      toast.success('Snippet criado');
    }
    setShowDialog(false);
  };

  const handleDelete = async (id: string) => {
    await deleteSnippet.mutateAsync(id);
    toast.success('Snippet removido');
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    toast.success('Comando copiado');
  };

  const categoryColor = (cat: string) => {
    const map: Record<string, string> = {
      sistema: 'bg-blue-500/10 text-blue-400',
      processos: 'bg-purple-500/10 text-purple-400',
      rede: 'bg-cyan-500/10 text-cyan-400',
      'serviços': 'bg-green-500/10 text-green-400',
      docker: 'bg-sky-500/10 text-sky-400',
      logs: 'bg-amber-500/10 text-amber-400',
      banco: 'bg-orange-500/10 text-orange-400',
      custom: 'bg-gray-500/10 text-gray-400',
    };
    return map[cat] || map.custom;
  };

  return (
    <>
      <Card className="glass-card overflow-hidden">
        <CardHeader className="pb-2 px-3 md:px-6">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-xs md:text-sm font-heading flex items-center gap-2 min-w-0">
              <Code2 className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="truncate">Snippets de Comandos</span>
            </CardTitle>
            <Button size="sm" variant="outline" className="h-7 text-xs flex-shrink-0" onClick={openCreate}>
              <Plus className="h-3 w-3 mr-1" /> Novo Snippet
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-3 md:px-6">
          {/* Category filter */}
          <div className="flex flex-wrap gap-1 md:gap-1.5 mb-3">
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setFilter('all')}
            >
              Todos
            </Button>
            <Button
              variant={filter === 'custom' ? 'default' : 'outline'}
              size="sm"
              className="h-6 text-[10px] px-2"
              onClick={() => setFilter('custom')}
            >
              Meus Snippets
            </Button>
            {CATEGORIES.map(cat => (
              <Button
                key={cat.value}
                variant={filter === cat.value ? 'default' : 'outline'}
                size="sm"
                className="h-6 text-[10px] px-2"
                onClick={() => setFilter(cat.value)}
              >
                {cat.label}
              </Button>
            ))}
          </div>

          <ScrollArea className="h-[300px] md:h-[420px]">
            <div className="space-y-2 pr-1">
              {isLoading ? (
                <div className="text-sm text-muted-foreground">Carregando snippets...</div>
              ) : filtered.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  Nenhum snippet encontrado nesta categoria.
                </div>
              ) : (
                filtered.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="group border border-border rounded-lg p-2.5 md:p-3 hover:bg-accent/30 transition-colors overflow-hidden"
                  >
                    <div className="flex items-center gap-1.5 md:gap-2 mb-1 flex-wrap">
                      <span className="font-semibold text-xs md:text-sm">{snippet.name}</span>
                      <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 ${categoryColor(snippet.category)}`}>
                        {snippet.category}
                      </Badge>
                      {snippet.is_builtin && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0">built-in</Badge>
                      )}
                    </div>
                    {snippet.description && (
                      <p className="text-[11px] md:text-xs text-muted-foreground mb-1.5">{snippet.description}</p>
                    )}
                    <code className="text-[11px] md:text-xs font-mono bg-[#0d1117] text-emerald-400 px-2 py-1 rounded block truncate">
                      {snippet.command}
                    </code>
                    <div className="flex items-center gap-1 mt-2 justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={() => onRunSnippet(snippet.command)}
                      >
                        <Play className="h-3 w-3 text-emerald-500" /> Executar
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 px-2 text-[10px] gap-1"
                        onClick={() => copyCommand(snippet.command)}
                      >
                        <Copy className="h-3 w-3" /> Copiar
                      </Button>
                      {!snippet.is_builtin && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1"
                            onClick={() => openEdit(snippet as CommandSnippet)}
                          >
                            <Pencil className="h-3 w-3" /> Editar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1 text-red-400 hover:text-red-300"
                            onClick={() => handleDelete(snippet.id)}
                          >
                            <Trash2 className="h-3 w-3" /> Excluir
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSnippet ? 'Editar Snippet' : 'Novo Snippet'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nome</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Listar arquivos grandes" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="O que este comando faz..." />
            </div>
            <div>
              <Label>Comando</Label>
              <Textarea
                value={form.command}
                onChange={e => setForm(f => ({ ...f, command: e.target.value }))}
                placeholder="find / -size +100M -type f"
                className="font-mono text-sm"
                rows={3}
              />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowDialog(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createSnippet.isPending || updateSnippet.isPending}>
              {editingSnippet ? 'Salvar' : 'Criar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
