import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Copy, Globe, Shield, ShieldCheck, Save, Loader2, RefreshCw, Plus, Info } from 'lucide-react';
import { toast } from 'sonner';
import { useCredentials, useUpdateCredential, type Credential } from '@/hooks/useCredentials';

const AgentSecurityPanel = () => {
  const { data: credentials } = useCredentials('agent');
  const updateCredential = useUpdateCredential();
  const [publicIP, setPublicIP] = useState<string | null>(null);
  const [loadingIP, setLoadingIP] = useState(false);
  const [editingIPs, setEditingIPs] = useState<Record<string, string>>({});

  const fetchPublicIP = useCallback(async () => {
    setLoadingIP(true);
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      if (!res.ok) throw new Error();
      const data = await res.json();
      setPublicIP(data.ip);
    } catch {
      try {
        const res = await fetch('https://checkip.amazonaws.com');
        if (!res.ok) throw new Error();
        setPublicIP((await res.text()).trim());
      } catch {
        setPublicIP(null);
      }
    } finally {
      setLoadingIP(false);
    }
  }, []);

  useEffect(() => { fetchPublicIP(); }, [fetchPublicIP]);

  const copyIP = () => {
    if (publicIP) {
      navigator.clipboard.writeText(publicIP);
      toast.success('IP copiado!');
    }
  };

  const handleSaveIPs = (credential: Credential) => {
    const newIPs = editingIPs[credential.id];
    if (newIPs === undefined) return;

    updateCredential.mutate(
      {
        id: credential.id,
        config: { ...credential.config, allowed_ips: newIPs },
      },
      {
        onSuccess: () => {
          toast.success(`IPs atualizados para ${credential.name}`);
          setEditingIPs((prev) => {
            const next = { ...prev };
            delete next[credential.id];
            return next;
          });
        },
        onError: () => toast.error('Erro ao salvar'),
      },
    );
  };

  const addMyIP = (cred: Credential, saveImmediately = false) => {
    if (!publicIP) return;
    const config = cred.config as Record<string, unknown>;
    const current = (editingIPs[cred.id] ?? (config.allowed_ips as string) ?? '').trim();
    const newVal = current ? `${current}, ${publicIP}` : publicIP;

    if (saveImmediately) {
      updateCredential.mutate(
        { id: cred.id, config: { ...cred.config, allowed_ips: newVal } },
        {
          onSuccess: () => {
            toast.success(`IP ${publicIP} adicionado para ${cred.name}`);
            setEditingIPs((prev) => { const n = { ...prev }; delete n[cred.id]; return n; });
          },
          onError: () => toast.error('Erro ao salvar'),
        },
      );
    } else {
      setEditingIPs((prev) => ({ ...prev, [cred.id]: newVal }));
    }
  };

  const agents = credentials || [];

  return (
    <Card className="glass-card">
      <CardHeader>
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Segurança de Agentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Current IP section */}
        <div className="rounded-lg bg-secondary/50 p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4 text-primary" />
            Seu IP Público Atual
          </div>
          <div className="flex items-center gap-2">
            {loadingIP ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : publicIP ? (
              <>
                <code className="text-lg font-mono bg-background px-3 py-1.5 rounded border select-all">
                  {publicIP}
                </code>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={copyIP} title="Copiar IP">
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchPublicIP} title="Atualizar">
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">Não foi possível detectar</span>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={fetchPublicIP}>
                  Tentar novamente
                </Button>
              </>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Seu IP é verificado automaticamente ao executar comandos remotos. Adicione-o na lista abaixo.
          </p>
        </div>

        {/* Agent list */}
        {agents.length === 0 ? (
          <div className="text-center py-6 space-y-2">
            <Shield className="h-8 w-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              Nenhuma credencial de agente cadastrada.
            </p>
            <p className="text-xs text-muted-foreground">
              Acesse <strong>Conexões</strong> para criar uma credencial do tipo Agente.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Configure os IPs permitidos por agente. Separe múltiplos IPs ou CIDRs por vírgula.
            </p>
            {agents.map((cred) => {
              const config = cred.config as Record<string, unknown>;
              const savedIPs = ((config.allowed_ips as string) || '').trim();
              const isEditing = editingIPs[cred.id] !== undefined;
              const editValue = isEditing ? editingIPs[cred.id] : savedIPs;
              const hasMyIP = editValue.includes(publicIP || '___none___');

              return (
                <div key={cred.id} className="rounded-lg border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-sm truncate">{cred.name}</span>
                      <Badge variant="outline" className="text-[10px] shrink-0 font-mono max-w-[200px] truncate">
                        {(config.agent_url as string) || 'sem URL'}
                      </Badge>
                    </div>
                    {savedIPs ? (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px] shrink-0 gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        IP restrito
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="text-[10px] shrink-0">
                        Sem restrição de IP
                      </Badge>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) =>
                        setEditingIPs((prev) => ({ ...prev, [cred.id]: e.target.value }))
                      }
                      placeholder="Ex: 203.0.113.5, 10.0.0.0/24"
                      className="text-sm bg-secondary border-border font-mono"
                    />
                    {isEditing && (
                      <Button
                        size="sm"
                        onClick={() => handleSaveIPs(cred)}
                        disabled={updateCredential.isPending}
                        className="shrink-0 gap-1"
                      >
                        {updateCredential.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Salvar</span>
                      </Button>
                    )}
                  </div>
                  {publicIP && !hasMyIP && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-xs h-7 gap-1"
                        onClick={() => addMyIP(cred, true)}
                        disabled={updateCredential.isPending}
                      >
                        {updateCredential.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Plus className="h-3 w-3" />
                        )}
                        Adicionar meu IP ({publicIP}) e salvar
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Info */}
        <div className="rounded-lg bg-muted/30 p-3 space-y-1">
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Info className="h-3.5 w-3.5" />
            Como funciona
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A validação de IP é feita automaticamente na nuvem. Basta salvar os IPs aqui — não precisa alterar nada no servidor.
            Se seu IP rotaciona, clique em <strong>"Adicionar meu IP"</strong> para atualizar.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default AgentSecurityPanel;
