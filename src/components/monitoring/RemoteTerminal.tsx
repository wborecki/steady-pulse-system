import { useState, useRef, useEffect, useCallback } from 'react';
import { useRemoteExec, useCommandHistory } from '@/hooks/useRemoteExec';
import { BUILTIN_SNIPPETS, type CommandSnippet } from '@/hooks/useSnippets';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Terminal as TerminalIcon, Send, Loader2, AlertTriangle, CheckCircle2, XCircle, Clock, ChevronUp, ChevronDown } from 'lucide-react';

interface TerminalLine {
  type: 'command' | 'stdout' | 'stderr' | 'error' | 'info';
  text: string;
  timestamp: Date;
  exitCode?: number;
}

interface RemoteTerminalProps {
  serviceId?: string;
  credentialId?: string;
  serviceName: string;
  pendingSnippet?: string;
}

export function RemoteTerminal({ serviceId, credentialId, serviceName, pendingSnippet }: RemoteTerminalProps) {
  const [command, setCommand] = useState('');
  const [lines, setLines] = useState<TerminalLine[]>([
    { type: 'info', text: `Conectado a: ${serviceName}`, timestamp: new Date() },
    { type: 'info', text: 'Apenas comandos de leitura/diagnóstico são permitidos. Use snippets para comandos comuns.', timestamp: new Date() },
  ]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandStack, setCommandStack] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const exec = useRemoteExec();

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [lines, scrollToBottom]);

  // Accept snippet from parent
  useEffect(() => {
    if (pendingSnippet) {
      setCommand(pendingSnippet);
      inputRef.current?.focus();
    }
  }, [pendingSnippet]);

  const runCommand = useCallback((cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    setCommandStack(prev => {
      const filtered = prev.filter(c => c !== trimmed);
      return [trimmed, ...filtered].slice(0, 50);
    });
    setHistoryIndex(-1);
    setCommand('');

    setLines(prev => [...prev, { type: 'command', text: trimmed, timestamp: new Date() }]);

    exec.mutate(
      { serviceId, credentialId, command: trimmed },
      {
        onSuccess: (result) => {
          const newLines: TerminalLine[] = [];
          if (result.stdout) {
            newLines.push({ type: 'stdout', text: result.stdout, timestamp: new Date(), exitCode: result.exit_code });
          }
          if (result.stderr) {
            newLines.push({ type: 'stderr', text: result.stderr, timestamp: new Date() });
          }
          if (result.error) {
            newLines.push({ type: 'error', text: result.error, timestamp: new Date() });
          }
          if (!result.stdout && !result.stderr && !result.error) {
            newLines.push({ type: 'info', text: `Comando executado com sucesso (exit code: ${result.exit_code})`, timestamp: new Date() });
          }
          if (result.truncated) {
            newLines.push({ type: 'info', text: '⚠ Output truncado (limite de 64KB)', timestamp: new Date() });
          }
          setLines(prev => [...prev, ...newLines]);
        },
        onError: (error) => {
          setLines(prev => [...prev, { type: 'error', text: error.message, timestamp: new Date() }]);
        },
      },
    );
  }, [exec, serviceId, credentialId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !exec.isPending) {
      runCommand(command);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandStack.length > 0) {
        const newIndex = Math.min(historyIndex + 1, commandStack.length - 1);
        setHistoryIndex(newIndex);
        setCommand(commandStack[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandStack[newIndex]);
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const insertSnippet = useCallback((cmd: string) => {
    setCommand(cmd);
    inputRef.current?.focus();
  }, []);

  const getLineColor = (type: TerminalLine['type']) => {
    switch (type) {
      case 'command': return 'text-emerald-400';
      case 'stdout': return 'text-gray-200';
      case 'stderr': return 'text-yellow-400';
      case 'error': return 'text-red-400';
      case 'info': return 'text-sky-400';
    }
  };

  return (
    <Card className="glass-card border-primary/20 overflow-hidden">
      <CardHeader className="pb-2 px-3 md:px-6">
        <CardTitle className="text-xs md:text-sm font-heading flex items-center gap-2">
          <TerminalIcon className="h-4 w-4 text-primary flex-shrink-0" />
          <span className="truncate">Terminal Remoto — {serviceName}</span>
          {exec.isPending && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground flex-shrink-0" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {/* Output area */}
        <div
          ref={scrollRef}
          className="h-[280px] md:h-[420px] overflow-y-auto bg-[#0d1117] rounded-md mx-3 md:mx-4 mb-2 p-3 font-mono text-[11px] md:text-xs leading-relaxed"
        >
          {lines.map((line, i) => (
            <div key={i} className={`${getLineColor(line.type)} whitespace-pre-wrap break-all`}>
              {line.type === 'command' && (
                <span className="text-emerald-500 select-none">$ </span>
              )}
              {line.text}
            </div>
          ))}
          {exec.isPending && (
            <div className="text-muted-foreground animate-pulse">Executando...</div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2 px-3 md:px-4 pb-3 md:pb-4">
          <div className="flex-1 flex items-center gap-2 bg-[#0d1117] border border-border rounded-md px-3 min-w-0">
            <span className="text-emerald-500 font-mono text-sm select-none">$</span>
            <Input
              ref={inputRef}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite um comando..."
              disabled={exec.isPending}
              className="border-0 bg-transparent font-mono text-sm text-gray-200 placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0 h-10 px-0"
            />
          </div>
          <Button
            onClick={() => runCommand(command)}
            disabled={exec.isPending || !command.trim()}
            size="icon"
            className="h-10 w-10 flex-shrink-0"
          >
            {exec.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>

        {/* Quick Snippets inline */}
        <div className="border-t border-border px-3 md:px-4 py-2.5">
          <div className="flex flex-wrap gap-1.5 md:gap-2">
            {BUILTIN_SNIPPETS.slice(0, 8).map((snippet, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-[10px] md:text-xs font-mono h-6 md:h-7 px-2 md:px-3"
                onClick={() => insertSnippet(snippet.command)}
                title={snippet.description}
              >
                {snippet.name}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── Command History Panel ─────────────────────────────────────────── */
export function CommandHistoryPanel({ serviceId }: { serviceId: string }) {
  const { data: history, isLoading } = useCommandHistory(serviceId);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (isLoading) return <div className="text-sm text-muted-foreground p-4">Carregando histórico...</div>;
  if (!history?.length) return (
    <div className="text-sm text-muted-foreground text-center py-8">
      <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" />
      Nenhum comando executado ainda.
    </div>
  );

  return (
    <Card className="glass-card overflow-hidden">
      <CardHeader className="pb-2 px-3 md:px-6">
        <CardTitle className="text-xs md:text-sm font-heading flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Histórico de Comandos
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 md:px-6 pb-3 md:pb-6">
        <ScrollArea className="h-[300px] md:h-[420px]">
          <div className="space-y-1.5 pr-1">
            {history.map((entry) => (
              <div key={entry.id} className="border border-border rounded-md overflow-hidden">
                <button
                  onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                  className="w-full flex items-center gap-2 px-2.5 md:px-3 py-2 text-left hover:bg-accent/50 transition-colors min-w-0"
                >
                  {entry.success ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" />
                  )}
                  <code className="text-[11px] md:text-xs font-mono flex-1 truncate min-w-0">{entry.command}</code>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0 hidden sm:inline">
                    {new Date(entry.executed_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </span>
                  {expanded === entry.id ? <ChevronUp className="h-3 w-3 flex-shrink-0" /> : <ChevronDown className="h-3 w-3 flex-shrink-0" />}
                </button>
                {expanded === entry.id && (
                  <div className="px-2.5 md:px-3 pb-2 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={entry.success ? 'default' : 'destructive'} className="text-[10px]">
                        exit: {entry.exit_code}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground sm:hidden">
                        {new Date(entry.executed_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                      </span>
                    </div>
                    {entry.stdout && (
                      <pre className="text-[10px] md:text-[11px] font-mono bg-[#0d1117] text-gray-300 p-2 rounded overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">{entry.stdout.slice(0, 3000)}</pre>
                    )}
                    {entry.stderr && (
                      <pre className="text-[10px] md:text-[11px] font-mono bg-[#0d1117] text-yellow-400 p-2 rounded overflow-x-auto max-h-20 overflow-y-auto whitespace-pre-wrap">{entry.stderr.slice(0, 1000)}</pre>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
