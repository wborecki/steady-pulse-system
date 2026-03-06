import { useState, useCallback } from 'react';
import { useServices } from '@/hooks/useServices';
import { useCredentials, type Credential } from '@/hooks/useCredentials';
import { RemoteTerminal, CommandHistoryPanel } from '@/components/monitoring/RemoteTerminal';
import { SnippetManager } from '@/components/monitoring/SnippetManager';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Terminal as TerminalIcon, Code2, Clock, Server, KeyRound, AlertTriangle } from 'lucide-react';

// Only services with an agent connection support remote exec
const AGENT_CHECK_TYPES = ['server', 'systemctl', 'container'];

// Selection can be a service (svc:id) or a credential (cred:id)
type Selection = { type: 'service'; id: string; name: string } | { type: 'credential'; id: string; name: string };

export default function TerminalPage() {
  const { data: services = [], isLoading: loadingSvc } = useServices();
  const { data: agentCreds = [], isLoading: loadingCreds } = useCredentials('agent');
  const [selectedKey, setSelectedKey] = useState<string>('');
  const [pendingSnippet, setPendingSnippet] = useState('');

  const isLoading = loadingSvc || loadingCreds;

  // Filter to only services that have an agent
  const agentServices = services.filter(s =>
    AGENT_CHECK_TYPES.includes(s.check_type) && s.enabled
  );

  // Parse selection key
  const selection: Selection | null = (() => {
    if (!selectedKey) return null;
    if (selectedKey.startsWith('svc:')) {
      const id = selectedKey.slice(4);
      const svc = agentServices.find(s => s.id === id);
      return svc ? { type: 'service', id, name: svc.name } : null;
    }
    if (selectedKey.startsWith('cred:')) {
      const id = selectedKey.slice(5);
      const cred = agentCreds.find((c: Credential) => c.id === id);
      return cred ? { type: 'credential', id, name: cred.name } : null;
    }
    return null;
  })();

  const handleRunSnippet = useCallback((command: string) => {
    setPendingSnippet(command);
    setTimeout(() => setPendingSnippet(''), 100);
  }, []);

  const hasOptions = agentServices.length > 0 || agentCreds.length > 0;

  return (
    <div className="p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 grid-bg min-h-screen">
      {/* Header */}
      <div>
        <h1 className="text-xl md:text-2xl font-heading font-bold flex items-center gap-2">
          <TerminalIcon className="h-5 w-5 md:h-6 md:w-6 text-primary" />
          Terminal Remoto
        </h1>
        <p className="text-xs md:text-sm text-muted-foreground mt-1">
          Execute comandos de diagnóstico nos servidores via agente.
        </p>
      </div>

      {/* Server / Credential Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="w-full sm:max-w-md">
          <Select value={selectedKey} onValueChange={setSelectedKey}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um servidor ou conexão..." />
            </SelectTrigger>
            <SelectContent>
              {isLoading ? (
                <SelectItem value="_loading" disabled>Carregando...</SelectItem>
              ) : !hasOptions ? (
                <SelectItem value="_empty" disabled>Nenhum agente encontrado</SelectItem>
              ) : (
                <>
                  {agentServices.length > 0 && (
                    <>
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Serviços
                      </div>
                      {agentServices.map(svc => (
                        <SelectItem key={`svc:${svc.id}`} value={`svc:${svc.id}`}>
                          <div className="flex items-center gap-2">
                            <Server className="h-3.5 w-3.5" />
                            <span>{svc.name}</span>
                            <Badge variant="secondary" className="text-[9px] ml-1">
                              {svc.check_type}
                            </Badge>
                            <Badge
                              variant={svc.status === 'online' ? 'default' : svc.status === 'warning' ? 'secondary' : 'destructive'}
                              className="text-[9px]"
                            >
                              {svc.status}
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </>
                  )}
                  {agentCreds.length > 0 && (
                    <>
                      {agentServices.length > 0 && <Separator className="my-1" />}
                      <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                        Conexões diretas
                      </div>
                      {agentCreds.map((cred: Credential) => {
                        const url = (cred.config as Record<string, unknown>).agent_url as string || '';
                        return (
                          <SelectItem key={`cred:${cred.id}`} value={`cred:${cred.id}`}>
                            <div className="flex items-center gap-2">
                              <KeyRound className="h-3.5 w-3.5" />
                              <span>{cred.name}</span>
                              {url && (
                                <Badge variant="outline" className="text-[9px] font-mono ml-1">
                                  {url.replace(/^https?:\/\//, '').slice(0, 25)}
                                </Badge>
                              )}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </>
                  )}
                </>
              )}
            </SelectContent>
          </Select>
        </div>

        {!hasOptions && !isLoading && (
          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
            <AlertTriangle className="h-4 w-4 text-warning flex-shrink-0" />
            <span>Crie uma conexão do tipo Agente em Conexões, ou adicione um serviço com agente.</span>
          </div>
        )}
      </div>

      {/* Main Content */}
      {selection ? (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 lg:gap-6">
          <div className="lg:col-span-3">
            <RemoteTerminal
              key={selectedKey}
              serviceId={selection.type === 'service' ? selection.id : undefined}
              credentialId={selection.type === 'credential' ? selection.id : undefined}
              serviceName={selection.name}
              pendingSnippet={pendingSnippet}
            />
          </div>
          <div className="lg:col-span-2 min-w-0">
            <Tabs defaultValue="snippets">
              <TabsList className="w-full">
                <TabsTrigger value="snippets" className="flex-1 text-xs">
                  <Code2 className="h-3 w-3 mr-1" /> Snippets
                </TabsTrigger>
                <TabsTrigger value="history" className="flex-1 text-xs">
                  <Clock className="h-3 w-3 mr-1" /> Histórico
                </TabsTrigger>
              </TabsList>
              <TabsContent value="snippets" className="mt-3">
                <SnippetManager onRunSnippet={handleRunSnippet} />
              </TabsContent>
              <TabsContent value="history" className="mt-3">
                <CommandHistoryPanel serviceId={selection.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      ) : (
        !isLoading && hasOptions && (
          <div className="flex flex-col items-center justify-center py-16 md:py-20 text-muted-foreground">
            <TerminalIcon className="h-12 w-12 md:h-16 md:w-16 mb-4 opacity-20" />
            <p className="text-base md:text-lg font-heading">Selecione um servidor ou conexão</p>
            <p className="text-xs md:text-sm">Escolha um servidor ou conexão direta para abrir o terminal remoto.</p>
          </div>
        )
      )}
    </div>
  );
}
