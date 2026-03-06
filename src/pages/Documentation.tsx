import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Book, Server, Shield, Terminal, Database, Globe, Bell, Settings,
  ChevronRight, Copy, Check, Cpu, HardDrive, Network, Container,
  Workflow, Cloud, FileCode, Layers, AlertTriangle, Rocket, MonitorCheck,
  Users, Key, RefreshCw, Zap, KeyRound, PlayCircle, UserPlus, SlidersHorizontal,
  Link as LinkIcon
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

// ─── Copy-to-clipboard helper ────────────────────────────────────────────────
function CopyBlock({ code, lang = 'bash' }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="relative group">
      <pre className="bg-muted/60 border rounded-lg p-4 overflow-x-auto text-xs font-mono leading-relaxed">
        <code>{code}</code>
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
      >
        {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
    </div>
  );
}

// ─── Section component ───────────────────────────────────────────────────────
function Section({ id, icon: Icon, title, children }: { id: string; icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-xl font-heading font-bold">{title}</h2>
      </div>
      <div className="space-y-4 text-sm text-muted-foreground leading-relaxed">
        {children}
      </div>
    </section>
  );
}

// ─── Sidebar TOC ─────────────────────────────────────────────────────────────
const tocItems = [
  { id: 'visao-geral', label: 'Visão Geral', icon: Book },
  { id: 'primeiros-passos', label: 'Primeiros Passos', icon: PlayCircle },
  { id: 'como-usar', label: 'Como Usar o Sistema', icon: SlidersHorizontal },
  { id: 'arquitetura', label: 'Arquitetura', icon: Layers },
  { id: 'requisitos', label: 'Requisitos', icon: FileCode },
  { id: 'instalacao', label: 'Instalação Local', icon: Terminal },
  { id: 'variaveis', label: 'Variáveis de Ambiente', icon: Key },
  { id: 'supabase', label: 'Supabase (Backend)', icon: Database },
  { id: 'agente', label: 'Agente de Monitoramento', icon: Cpu },
  { id: 'token-agente', label: 'Token do Agente', icon: Shield },
  { id: 'deploy-agent', label: 'Deploy do Agente', icon: Rocket },
  { id: 'deploy-frontend', label: 'Deploy do Frontend', icon: Globe },
  { id: 'conexoes', label: 'Conexões & Credenciais', icon: KeyRound },
  { id: 'check-types', label: 'Tipos de Check', icon: MonitorCheck },
  { id: 'edge-functions', label: 'Edge Functions', icon: Zap },
  { id: 'cron', label: 'Cron Automático', icon: RefreshCw },
  { id: 'alertas', label: 'Alertas e Notificações', icon: Bell },
  { id: 'regras-status', label: 'Regras de Status', icon: SlidersHorizontal },
  { id: 'banco', label: 'Banco de Dados', icon: Database },
  { id: 'api-agente', label: 'API do Agente', icon: Network },
  { id: 'credenciais', label: 'Secrets (Backend)', icon: Key },
  { id: 'usuarios', label: 'Gerenciamento de Usuários', icon: UserPlus },
  { id: 'seguranca', label: 'Segurança', icon: Shield },
  { id: 'troubleshooting', label: 'Troubleshooting', icon: AlertTriangle },
];

// ─── Main Page ───────────────────────────────────────────────────────────────
const Documentation = () => {
  const [activeSection, setActiveSection] = useState('visao-geral');

  const scrollTo = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="flex h-full min-h-screen grid-bg">
      {/* Left TOC sidebar */}
      <aside className="hidden lg:block w-64 flex-shrink-0 border-r border-border">
        <ScrollArea className="h-[calc(100vh-4rem)]">
          <div className="p-4 space-y-1">
            <div className="flex items-center gap-2 mb-4 px-2">
              <Book className="h-4 w-4 text-primary" />
              <span className="font-heading font-bold text-sm">Documentação</span>
            </div>
            {tocItems.map(item => (
              <button
                key={item.id}
                onClick={() => scrollTo(item.id)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors ${
                  activeSection === item.id
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                <item.icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </ScrollArea>
      </aside>

      {/* Main content */}
      <ScrollArea className="flex-1 h-[calc(100vh-4rem)]">
        <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-12">
          {/* Hero header */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/10">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl font-heading font-bold">MonitorHub</h1>
                <p className="text-muted-foreground text-sm">Documentação Completa do Sistema de Monitoramento</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">React 18</Badge>
              <Badge variant="secondary">TypeScript</Badge>
              <Badge variant="secondary">Supabase</Badge>
              <Badge variant="secondary">Vite</Badge>
              <Badge variant="secondary">TailwindCSS</Badge>
              <Badge variant="secondary">shadcn/ui</Badge>
              <Badge variant="secondary">Python Agent</Badge>
            </div>
          </div>

          <Separator />

          {/* ── 1. VISÃO GERAL ────────────────────────────────────────── */}
          <Section id="visao-geral" icon={Book} title="Visão Geral">
            <p className="text-foreground">
              O <strong>MonitorHub</strong> é uma plataforma de monitoramento de infraestrutura e serviços.
              Ele permite acompanhar em tempo real o status de servidores, containers Docker, APIs, bancos de dados,
              serviços AWS, Apache Airflow e muito mais.
            </p>
            <Card>
              <CardContent className="p-4 space-y-2">
                <p><strong>Principais funcionalidades:</strong></p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Dashboard em tempo real com métricas de CPU, memória, disco e uptime</li>
                  <li>15 tipos de check suportados (HTTP, TCP, PostgreSQL, MongoDB, Airflow, AWS, etc.)</li>
                  <li>Agente de monitoramento leve em Python (13 MB RAM, 0.1% CPU)</li>
                  <li>Auto-discovery de serviços systemd e containers Docker</li>
                  <li>Alertas automáticos com thresholds configuráveis</li>
                  <li>Notificações via Slack, Email (Resend) e Webhooks</li>
                  <li>Gráficos e relatórios com histórico de métricas</li>
                  <li>Health checks automáticos via cron (pg_cron)</li>
                  <li>Tema claro/escuro</li>
                  <li>Responsivo — funciona em desktop e mobile</li>
                </ul>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 2. PRIMEIROS PASSOS ───────────────────────────────────── */}
          <Section id="primeiros-passos" icon={PlayCircle} title="Primeiros Passos (Quick Start)">
            <p className="text-foreground">
              Siga este guia para começar a monitorar seus servidores, APIs e serviços em poucos minutos.
            </p>

            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-6">
                  {/* Step 1 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">1</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Fazer Login</p>
                      <p className="text-xs text-muted-foreground">
                        Acesse o sistema e entre com suas credenciais. O usuário padrão é{' '}
                        <code className="bg-muted px-1 py-0.5 rounded">admin@monitorhub.com</code> / <code className="bg-muted px-1 py-0.5 rounded">Admin123!</code>.
                        <br /><strong>Altere a senha após o primeiro login</strong> em Configurações.
                      </p>
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">2</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Gerar Token de Autenticação</p>
                      <p className="text-xs text-muted-foreground">
                        Antes de instalar o agente, gere um token seguro que será compartilhado entre o agente e o MonitorHub:
                      </p>
                      <div className="mt-2">
                        <CopyBlock code={'python3 -c "import secrets; print(secrets.token_hex(32))"'} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        <strong>Guarde este token!</strong> Você vai usá-lo na instalação do agente e ao cadastrar o serviço.
                      </p>
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">3</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Instalar o Agente no Servidor</p>
                      <p className="text-xs text-muted-foreground">
                        No servidor que deseja monitorar, execute o one-liner:
                      </p>
                      <div className="mt-2">
                        <CopyBlock code={`curl -fsSL https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/install-agent.sh | sudo bash -s -- --token SEU_TOKEN_AQUI`} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        O agente será instalado como serviço systemd na porta 9100. Valide com:{' '}
                        <code className="bg-muted px-1 py-0.5 rounded">curl http://localhost:9100/health</code>
                      </p>
                    </div>
                  </div>

                  {/* Step 4 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">4</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">(Opcional) Salvar Credencial Reutilizável</p>
                      <p className="text-xs text-muted-foreground">
                        Vá em <Link to="/connections" className="text-primary underline font-medium">Conexões</Link> e salve o par URL + Token como uma credencial do tipo &quot;Agente&quot;.
                        Assim, ao criar múltiplos serviços no mesmo servidor, basta selecionar a credencial salva e os campos serão preenchidos automaticamente.
                      </p>
                    </div>
                  </div>

                  {/* Step 5 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">5</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Adicionar Serviço no MonitorHub</p>
                      <p className="text-xs text-muted-foreground">
                        Vá em <Link to="/services" className="text-primary underline font-medium">Serviços</Link> → clique em <strong>&quot;Adicionar Serviço&quot;</strong>:
                      </p>
                      <ul className="list-disc list-inside space-y-1 text-xs text-muted-foreground mt-1">
                        <li>Dê um <strong>nome</strong> ao serviço (ex: &quot;Servidor Produção&quot;)</li>
                        <li>Escolha a <strong>categoria</strong> (Servidores, AWS, Database, etc.)</li>
                        <li>Escolha o <strong>tipo de check</strong> (Server, Systemctl, Container, HTTP, etc.)</li>
                        <li>Se tiver uma credencial salva, selecione-a no dropdown — os campos serão preenchidos automaticamente</li>
                        <li>Caso contrário, preencha manualmente a <strong>URL do Agente</strong> e o <strong>Token</strong></li>
                        <li>Configure o <strong>intervalo de verificação</strong> (30s, 1min, 5min, 10min)</li>
                        <li>Clique em <strong>Adicionar</strong></li>
                      </ul>
                    </div>
                  </div>

                  {/* Step 6 */}
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-bold text-primary">6</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Monitorar!</p>
                      <p className="text-xs text-muted-foreground">
                        O health check automático começará a rodar no intervalo configurado. Acompanhe no{' '}
                        <Link to="/" className="text-primary underline font-medium">Dashboard</Link> em tempo real.
                        Configure alertas em <Link to="/settings" className="text-primary underline font-medium">Configurações</Link> para
                        ser notificado por Slack, Email ou Webhook quando algo falhar.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4">
                <p className="text-xs text-foreground">
                  💡 <strong>Dica:</strong> Um único agente monitora tudo no servidor — métricas (CPU, RAM, disco), serviços systemd e containers Docker.
                  Não precisa instalar nada a mais. Basta criar serviços diferentes no MonitorHub apontando para a mesma URL do agente.
                </p>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 3. COMO USAR O SISTEMA ────────────────────────────────── */}
          <Section id="como-usar" icon={SlidersHorizontal} title="Como Usar o Sistema">
            <p className="text-foreground">Guia completo de cada área do MonitorHub.</p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">📊 Dashboard</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p>A tela principal mostra:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Cards de resumo:</strong> Total de serviços, online, warning e offline</li>
                  <li><strong>Lista de serviços:</strong> Com status, uptime, CPU, memória, disco e response time</li>
                  <li><strong>Indicadores coloridos:</strong> Verde (online), amarelo (warning), vermelho (offline), cinza (manutenção)</li>
                  <li><strong>Barras de uso:</strong> Preenchimento visual de CPU/memória/disco com cores adaptativas</li>
                </ul>
                <p>Clique em qualquer serviço para ver os detalhes e gráficos históricos.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">🖥 Serviços — Adicionar e Gerenciar</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p><strong>Adicionar serviço:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Clique em <strong>&quot;Adicionar Serviço&quot;</strong></li>
                  <li>Escolha <strong>Categoria</strong> → o tipo de check é filtrado automaticamente</li>
                  <li>Se houver credenciais salvas compatíveis, um seletor aparece no topo — escolha para preencher campos automaticamente</li>
                  <li>Preencha os campos específicos (URL, token, host, porta, etc.)</li>
                  <li>Para tipos com agente (Server, Systemctl, Container): use o botão <strong>&quot;Descobrir Serviços&quot;</strong> para auto-discovery</li>
                  <li>Configure o <strong>intervalo</strong> e dê um <strong>nome</strong></li>
                </ol>

                <p><strong>Editar serviço:</strong></p>
                <p>Na lista de serviços, clique no ícone de edição (✏️). Os campos são preenchidos com os valores atuais.</p>

                <p><strong>Habilitar/Desabilitar:</strong></p>
                <p>Use o toggle na lista de serviços para habilitar ou desabilitar o monitoramento sem excluir o serviço.</p>

                <p><strong>Página de detalhe:</strong></p>
                <p>Clique no nome do serviço para ver gráficos de métricas (CPU, RAM, disco, response time) com histórico de 24h ou mais.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">🔗 Conexões — Credenciais Reutilizáveis</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p>
                  A página <Link to="/connections" className="text-primary underline font-medium">Conexões</Link> permite
                  salvar credenciais de acesso para reutilizá-las ao criar serviços:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Agente:</strong> URL + Token — para serviços Server, Systemctl e Container</li>
                  <li><strong>Airflow:</strong> URL + Usuário + Senha — para serviços Airflow</li>
                  <li><strong>PostgreSQL:</strong> Connection string ou Host/Porta/User/Senha</li>
                  <li><strong>MongoDB:</strong> Connection string ou Host/Porta/User/Senha</li>
                  <li><strong>Azure SQL:</strong> Connection string ou Host/DB/User/Senha</li>
                  <li><strong>AWS:</strong> Access Key + Secret Key + Região</li>
                  <li><strong>SSH:</strong> Host + Usuário + Senha/Chave — para checks TCP/Process</li>
                  <li><strong>HTTP Auth:</strong> Basic ou Bearer — para checks HTTP autenticados</li>
                </ul>

                <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                  <p className="font-semibold text-foreground mb-1">Como funciona:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Vá em <strong>Conexões → Nova Credencial</strong></li>
                    <li>Escolha o <strong>tipo</strong>, dê um <strong>nome</strong> (ex: &quot;Servidor Produção&quot;)</li>
                    <li>Preencha os campos (URL, token, etc.) e salve</li>
                    <li>Ao criar um serviço, o dropdown <strong>&quot;Usar credencial salva&quot;</strong> aparece automaticamente</li>
                    <li>Selecione a credencial → campos são preenchidos automaticamente</li>
                    <li>Você pode editar os campos preenchidos se precisar ajustar algo</li>
                  </ol>
                </div>

                <p className="text-muted-foreground">
                  <strong>A credencial é opcional</strong> — você sempre pode preencher os campos manualmente. Ela é apenas
                  um facilitador para evitar digitar os mesmos dados repetidamente.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">🔔 Alertas</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p>
                  A página <Link to="/alerts" className="text-primary underline font-medium">Alertas</Link> mostra todos os alertas
                  gerados automaticamente. Você pode:
                </p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Filtrar</strong> por tipo (critical, warning, info)</li>
                  <li><strong>Acknowledge</strong> alertas para marcá-los como vistos</li>
                  <li>Ver o <strong>serviço relacionado</strong> e a <strong>mensagem detalhada</strong></li>
                </ul>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">📈 Relatórios</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p>
                  A página <Link to="/reports" className="text-primary underline font-medium">Relatórios</Link> mostra
                  gráficos consolidados de saúde e performance dos seus serviços ao longo do tempo.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">⚙️ Configurações</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <p>Em <Link to="/settings" className="text-primary underline font-medium">Configurações</Link> você pode:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>Intervalo de refresh do dashboard</strong> (30s, 1min, 5min)</li>
                  <li><strong>Notificações:</strong> Slack webhook, Email via Resend, Webhook genérico</li>
                  <li><strong>Modo:</strong> Notificar apenas alertas críticos ou todos</li>
                  <li><strong>Regras de status</strong> por tipo de check: defina quando um serviço é warning ou offline</li>
                </ul>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 4. ARQUITETURA ─────────────────────────────────────────── */}
          <Section id="arquitetura" icon={Layers} title="Arquitetura">
            <p>O sistema tem 3 camadas principais:</p>
            <Card>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <Badge className="mt-0.5 bg-blue-500/10 text-blue-500 border-blue-500/30">Frontend</Badge>
                    <div>
                      <p className="text-foreground font-medium">React SPA (Vite + TypeScript)</p>
                      <p className="text-xs">Interface web servida via Nginx. Usa shadcn/ui, TailwindCSS, React Query e Recharts para gráficos.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge className="mt-0.5 bg-green-500/10 text-green-500 border-green-500/30">Backend</Badge>
                    <div>
                      <p className="text-foreground font-medium">Supabase (PostgreSQL + Edge Functions)</p>
                      <p className="text-xs">Banco PostgreSQL com RLS, 16 Edge Functions (Deno), Auth, Realtime subscriptions, pg_cron para agendamento.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Badge className="mt-0.5 bg-orange-500/10 text-orange-500 border-orange-500/30">Agente</Badge>
                    <div>
                      <p className="text-foreground font-medium">Python HTTP Server (v2.1.0)</p>
                      <p className="text-xs">Agente leve (13 MB) instalado nos servidores. Coleta métricas de CPU, RAM, swap, disco, rede, serviços systemd e containers Docker.</p>
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="bg-muted/40 rounded-lg p-4 font-mono text-xs space-y-1">
                  <p className="text-muted-foreground mb-2 font-sans text-xs font-medium">Fluxo de dados (Pull-Based):</p>
                  <p>┌──────────────┐    ┌───────────────────┐    ┌──────────────┐</p>
                  <p>│  <span className="text-blue-400">Frontend</span>     │◄──►│  <span className="text-green-400">Supabase</span>          │───►│  <span className="text-orange-400">Agente</span>       │</p>
                  <p>│  (React SPA) │    │  (Edge Functions)  │    │  (Python)    │</p>
                  <p>│  Nginx :80   │    │  pg_cron ─► health │    │  :9100       │</p>
                  <p>└──────────────┘    │  -check every 1min │    │  /metrics    │</p>
                  <p>                    │  PostgreSQL + RLS   │    │  /systemctl  │</p>
                  <p>                    │  Realtime WS        │    │  /containers │</p>
                  <p>                    └───────────────────┘    └──────────────┘</p>
                </div>

                <p className="text-xs">
                  <strong>Importante:</strong> A comunicação é <em>pull-based</em> — o Supabase (via pg_cron) chama a Edge Function
                  a cada 1 minuto, que por sua vez consulta os agentes. O agente <strong>nunca</strong> inicia conexões.
                </p>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 3. REQUISITOS ──────────────────────────────────────────── */}
          <Section id="requisitos" icon={FileCode} title="Requisitos">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Terminal className="h-4 w-4" /> Desenvolvimento Local</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>• Node.js ≥ 18</p>
                  <p>• npm ou bun</p>
                  <p>• Git</p>
                  <p>• Supabase CLI (opcional, para migrations)</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Server className="h-4 w-4" /> Servidor (Agente)</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>• Linux (Ubuntu/Debian/CentOS/RHEL)</p>
                  <p>• Python 3.6+</p>
                  <p>• Docker (opcional, para containers)</p>
                  <p>• Porta 9100 acessível (configurável)</p>
                  <p>• ~13 MB RAM, 0.1% CPU</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Globe className="h-4 w-4" /> Deploy Frontend</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>• Servidor com Nginx</p>
                  <p>• rsync + sshpass (para o script de deploy)</p>
                  <p>• Porta 80 acessível</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Supabase</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>• Projeto no Supabase (gratuito ou Pro)</p>
                  <p>• Extensões: pg_cron, pg_net</p>
                  <p>• Supabase CLI (para push de migrations)</p>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Separator />

          {/* ── 4. INSTALAÇÃO LOCAL ────────────────────────────────────── */}
          <Section id="instalacao" icon={Terminal} title="Instalação Local (Desenvolvimento)">
            <p>Para rodar o projeto localmente em modo de desenvolvimento:</p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">1. Clonar o repositório</CardTitle>
              </CardHeader>
              <CardContent>
                <CopyBlock code={`git clone https://github.com/Solutions-in-BI/steady-pulse-system.git
cd steady-pulse-system`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">2. Instalar dependências</CardTitle>
              </CardHeader>
              <CardContent>
                <CopyBlock code="npm install" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">3. Configurar variáveis de ambiente</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">Crie um arquivo <code className="bg-muted px-1 py-0.5 rounded">.env</code> na raiz:</p>
                <CopyBlock code={`VITE_SUPABASE_URL="https://SEU_PROJECT_ID.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sua_anon_key"
VITE_SUPABASE_PROJECT_ID="seu_project_id"`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">4. Iniciar em modo desenvolvimento</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <CopyBlock code="npm run dev" />
                <p className="text-xs text-muted-foreground">Acesse <code className="bg-muted px-1 py-0.5 rounded">http://localhost:8080</code></p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">5. Outros comandos</CardTitle>
              </CardHeader>
              <CardContent>
                <CopyBlock code={`npm run build       # Build de produção
npm run preview     # Preview do build
npm run lint        # Linting (ESLint)
npm run test        # Rodar testes (Vitest)
npm run test:watch  # Testes em modo watch`} />
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 5. VARIÁVEIS DE AMBIENTE ───────────────────────────────── */}
          <Section id="variaveis" icon={Key} title="Variáveis de Ambiente">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-semibold">Variável</th>
                        <th className="text-left p-3 font-semibold">Descrição</th>
                        <th className="text-left p-3 font-semibold">Exemplo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3 font-mono text-primary">VITE_SUPABASE_URL</td>
                        <td className="p-3">URL do projeto Supabase</td>
                        <td className="p-3 font-mono text-muted-foreground">https://xxx.supabase.co</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-primary">VITE_SUPABASE_PUBLISHABLE_KEY</td>
                        <td className="p-3">Chave anon (pública) do Supabase</td>
                        <td className="p-3 font-mono text-muted-foreground">sb_publishable_...</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-primary">VITE_SUPABASE_PROJECT_ID</td>
                        <td className="p-3">ID do projeto Supabase</td>
                        <td className="p-3 font-mono text-muted-foreground">zzkwldfssxopclqsxtku</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <p className="text-xs">
              <strong>Nota:</strong> Variáveis com prefixo <code className="bg-muted px-1 py-0.5 rounded">VITE_</code> são
              injetadas no build pelo Vite e ficam acessíveis via <code className="bg-muted px-1 py-0.5 rounded">import.meta.env</code>.
            </p>
          </Section>

          <Separator />

          {/* ── 6. SUPABASE ────────────────────────────────────────────── */}
          <Section id="supabase" icon={Database} title="Supabase (Backend)">
            <p>O Supabase fornece o banco de dados (PostgreSQL), autenticação, Edge Functions e Realtime.</p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Criar projeto Supabase</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Acesse <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-primary underline">supabase.com</a> e crie um novo projeto</li>
                  <li>Ative as extensões <strong>pg_cron</strong> e <strong>pg_net</strong> (em Database → Extensions)</li>
                  <li>Copie a URL e a Anon Key do projeto</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Aplicar migrations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyBlock code={`# Instalar Supabase CLI
npm install -g supabase

# Fazer login
npx supabase login

# Linkar ao projeto
npx supabase link --project-ref SEU_PROJECT_ID

# Aplicar todas as migrations
npx supabase db push`} />
                <p className="text-xs text-muted-foreground">
                  São 14 migrations que criam todas as tabelas, enums, funções, índices, RLS e o cron de health-check.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Deploy das Edge Functions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyBlock code={`# Deploy de todas as funções de uma vez
npx supabase functions deploy health-check --no-verify-jwt
npx supabase functions deploy server-metrics --no-verify-jwt
npx supabase functions deploy systemctl-metrics --no-verify-jwt
npx supabase functions deploy container-metrics --no-verify-jwt
npx supabase functions deploy airflow-metrics --no-verify-jwt
npx supabase functions deploy send-notification --no-verify-jwt
npx supabase functions deploy discover-services --no-verify-jwt
npx supabase functions deploy seed-admin --no-verify-jwt
npx supabase functions deploy cleanup-old-checks --no-verify-jwt
npx supabase functions deploy aws-metrics
npx supabase functions deploy azure-sql-metrics
npx supabase functions deploy cloudwatch-alarms
npx supabase functions deploy ecs-metrics
npx supabase functions deploy lambda-metrics
npx supabase functions deploy mongodb-metrics
npx supabase functions deploy postgresql-metrics`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Criar usuário admin</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyBlock code={`# Chamar a Edge Function seed-admin
curl -X POST "https://SEU_PROJECT.supabase.co/functions/v1/seed-admin" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json"`} />
                <p className="text-xs text-muted-foreground">
                  Isso cria o usuário <code className="bg-muted px-1 py-0.5 rounded">admin@monitorhub.com</code> com
                  senha <code className="bg-muted px-1 py-0.5 rounded">Admin123!</code>. Altere a senha após o primeiro login.
                </p>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 7. AGENTE ──────────────────────────────────────────────── */}
          <Section id="agente" icon={Cpu} title="Agente de Monitoramento">
            <p>
              O agente é um servidor HTTP em Python puro (sem dependências externas) que coleta métricas do sistema operacional.
              Ele roda como serviço systemd e consome apenas <strong>~13 MB de RAM</strong> e <strong>0.1% CPU</strong>.
            </p>

            <Card>
              <CardContent className="p-4">
                <div className="grid md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-foreground mb-2">Métricas coletadas:</p>
                    <ul className="space-y-1">
                      <li className="flex items-center gap-2"><Cpu className="h-3 w-3 text-primary" /> CPU (% uso por core)</li>
                      <li className="flex items-center gap-2"><HardDrive className="h-3 w-3 text-primary" /> Memória RAM + Swap</li>
                      <li className="flex items-center gap-2"><HardDrive className="h-3 w-3 text-primary" /> Disco (todos os mounts)</li>
                      <li className="flex items-center gap-2"><Network className="h-3 w-3 text-primary" /> Rede (bytes in/out por interface)</li>
                      <li className="flex items-center gap-2"><Server className="h-3 w-3 text-primary" /> Load Average (1/5/15 min)</li>
                      <li className="flex items-center gap-2"><RefreshCw className="h-3 w-3 text-primary" /> Uptime do servidor</li>
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-foreground mb-2">Funcionalidades:</p>
                    <ul className="space-y-1">
                      <li className="flex items-center gap-2"><Container className="h-3 w-3 text-primary" /> Status de containers Docker</li>
                      <li className="flex items-center gap-2"><Settings className="h-3 w-3 text-primary" /> Status de serviços systemd</li>
                      <li className="flex items-center gap-2"><Workflow className="h-3 w-3 text-primary" /> Auto-discovery de serviços</li>
                      <li className="flex items-center gap-2"><Users className="h-3 w-3 text-primary" /> Top processos (CPU/RAM)</li>
                      <li className="flex items-center gap-2"><RefreshCw className="h-3 w-3 text-primary" /> Self-update via GitHub</li>
                      <li className="flex items-center gap-2"><Shield className="h-3 w-3 text-primary" /> Autenticação via Bearer token</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── TOKEN DO AGENTE ────────────────────────────────────────── */}
          <Section id="token-agente" icon={Shield} title="Token do Agente — Implementação Completa">
            <p>
              O token é a <strong>chave de segurança</strong> que protege o agente contra acessos não autorizados.
              É uma string secreta (recomendado: 64 hex chars) que deve ser idêntica no agente e no MonitorHub.
            </p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">1. Gerar o Token</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p>Use um gerador criptográfico seguro:</p>
                <CopyBlock code={'# Python (recomendado)\npython3 -c "import secrets; print(secrets.token_hex(32))"\n\n# OpenSSL\nopenssl rand -hex 32\n\n# /dev/urandom\nhead -c 32 /dev/urandom | xxd -p -c 64'} />
                <p className="text-muted-foreground">
                  Exemplo de token gerado: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">a1b2c3d4e5f6...64 caracteres hex...9z8y7x</code>
                </p>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="font-semibold text-destructive mb-1">⚠ Importante</p>
                  <p>Use <strong>um token diferente por servidor</strong>. Não compartilhe o mesmo token entre servidores diferentes.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">2. Instalar o Agente com o Token</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p>O token é passado na instalação do agente:</p>
                <CopyBlock code={`curl -fsSL https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/install-agent.sh | sudo bash -s -- --token SEU_TOKEN_AQUI`} />
                <p>O instalador salva o token no serviço systemd:</p>
                <CopyBlock code={`# Arquivo: /etc/systemd/system/monitoring-agent.service
[Service]
ExecStart=/usr/bin/python3 /opt/monitoring-agent/monitoring-agent.py --port 9100 --token SEU_TOKEN_AQUI
Restart=always
RestartSec=5`} />
                <p className="text-muted-foreground">O token fica armazenado <strong>apenas localmente</strong> no arquivo de serviço do systemd.</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">3. Configurar o Token no MonitorHub</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p>Existem <strong>duas formas</strong> de informar o token ao criar um serviço:</p>

                <div className="space-y-4">
                  <div className="border border-border rounded-lg p-3 bg-secondary/20">
                    <p className="font-semibold text-foreground mb-2">Opção A: Preencher manualmente no formulário</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Vá em <strong>Serviços → Adicionar Serviço</strong></li>
                      <li>Escolha o tipo (Server, Systemctl ou Container)</li>
                      <li>Preencha o campo <strong>&quot;URL do Agente&quot;</strong> com <code className="bg-muted px-1 py-0.5 rounded">http://IP:9100</code></li>
                      <li>Cole o token no campo <strong>&quot;Token de Autenticação&quot;</strong></li>
                    </ol>
                  </div>

                  <div className="border border-primary/20 rounded-lg p-3 bg-primary/5">
                    <p className="font-semibold text-foreground mb-2">Opção B: Usar credencial salva (recomendado)</p>
                    <ol className="list-decimal list-inside space-y-1">
                      <li>Vá em <Link to="/connections" className="text-primary underline font-medium">Conexões</Link> → <strong>Nova Credencial</strong></li>
                      <li>Tipo: <strong>Agente (Servidor)</strong></li>
                      <li>Preencha a URL e o Token</li>
                      <li>Dê um nome (ex: &quot;Servidor Produção 192.168.1.100&quot;)</li>
                      <li>Salve</li>
                      <li>Agora, ao criar qualquer serviço do tipo Server/Systemctl/Container, selecione a credencial no dropdown</li>
                      <li>Os campos serão preenchidos automaticamente!</li>
                    </ol>
                    <p className="text-muted-foreground mt-2">
                      Isso é especialmente útil quando você tem <strong>múltiplos serviços</strong> no mesmo servidor
                      (ex: métricas do servidor + systemctl + containers).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">4. Como o Token é Usado nas Requisições</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p>Quando o health-check roda, a Edge Function faz requisição ao agente com o header:</p>
                <CopyBlock code={`GET /metrics HTTP/1.1
Host: 192.168.1.100:9100
Authorization: Bearer SEU_TOKEN_AQUI`} />
                <p>O agente valida o token e retorna os dados. Se o token estiver errado ou ausente, o agente retorna <code className="bg-muted px-1 py-0.5 rounded">401 Unauthorized</code>.</p>

                <p className="font-semibold text-foreground">Endpoints que requerem token:</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p>🔒 <code className="bg-muted px-1 py-0.5 rounded">/metrics</code></p>
                    <p>🔒 <code className="bg-muted px-1 py-0.5 rounded">/systemctl</code></p>
                    <p>🔒 <code className="bg-muted px-1 py-0.5 rounded">/systemctl/list</code></p>
                    <p>🔒 <code className="bg-muted px-1 py-0.5 rounded">/containers</code></p>
                  </div>
                  <div>
                    <p>🔒 <code className="bg-muted px-1 py-0.5 rounded">/processes</code></p>
                    <p>🔒 <code className="bg-muted px-1 py-0.5 rounded">/update</code></p>
                    <p>🔓 <code className="bg-muted px-1 py-0.5 rounded">/health</code> (público)</p>
                    <p>🔓 <code className="bg-muted px-1 py-0.5 rounded">/version</code> (público)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">5. Trocar ou Rotacionar o Token</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <p>Para trocar o token de um agente já instalado:</p>
                <CopyBlock code={`# 1. Gerar novo token
NEW_TOKEN=$(python3 -c "import secrets; print(secrets.token_hex(32))")
echo "Novo token: $NEW_TOKEN"

# 2. Atualizar no agente (no servidor)
sudo systemctl stop monitoring-agent
sudo sed -i "s/--token [a-f0-9]*/--token $NEW_TOKEN/" /etc/systemd/system/monitoring-agent.service
sudo systemctl daemon-reload
sudo systemctl start monitoring-agent

# 3. Verificar
curl -H "Authorization: Bearer $NEW_TOKEN" http://localhost:9100/metrics | head -5`} />
                <p>Depois, atualize o token no MonitorHub: edite o serviço ou atualize a credencial salva em{' '}
                  <Link to="/connections" className="text-primary underline font-medium">Conexões</Link>.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">6. Verificar se o Token está Correto</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-xs">
                <CopyBlock code={`# Teste com token CORRETO (deve retornar JSON com métricas)
curl -s -H "Authorization: Bearer SEU_TOKEN" http://SERVIDOR:9100/metrics | python3 -m json.tool | head -20

# Teste com token ERRADO (deve retornar 401)
curl -s -w "\\nHTTP %{http_code}" http://SERVIDOR:9100/metrics

# Teste sem token (deve retornar 401)
curl -s -w "\\nHTTP %{http_code}" http://SERVIDOR:9100/metrics

# Health (sempre funciona, não precisa de token)
curl http://SERVIDOR:9100/health`} />
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 8. DEPLOY DO AGENTE ────────────────────────────────────── */}
          <Section id="deploy-agent" icon={Rocket} title="Deploy do Agente">
            <p>Existem duas formas de instalar o agente em um servidor:</p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Opção 1: One-liner (direto no servidor)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Acesse o servidor via SSH e execute:</p>
                <CopyBlock code={`curl -fsSL https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/install-agent.sh | sudo bash -s -- --token SEU_TOKEN_AQUI`} />
                <p className="text-xs text-muted-foreground">
                  Opções disponíveis:
                </p>
                <CopyBlock code={`--token TOKEN     # Token de autenticação (obrigatório)
--port 9100       # Porta do agente (padrão: 9100)
--no-docker       # Pular verificação Docker`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Opção 2: Deploy remoto (via script)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-xs text-muted-foreground">Execute do seu computador local:</p>
                <CopyBlock code={`chmod +x docs/deploy-agent.sh

./docs/deploy-agent.sh \\
  --host 192.168.1.100 \\
  --user root \\
  --password "sua_senha" \\
  --token "token_para_o_agente" \\
  --port 9100`} />
                <p className="text-xs text-muted-foreground">
                  O script faz tudo automaticamente: copia os arquivos, instala, configura firewall e valida.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Gerar um token seguro</CardTitle>
              </CardHeader>
              <CardContent>
                <CopyBlock code={'python3 -c "import secrets; print(secrets.token_hex(32))"'} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Validar instalação</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyBlock code={`# Health check
curl http://SEU_SERVIDOR:9100/health

# Métricas do servidor
curl -H "Authorization: Bearer SEU_TOKEN" http://SEU_SERVIDOR:9100/metrics

# Serviços systemd
curl -H "Authorization: Bearer SEU_TOKEN" http://SEU_SERVIDOR:9100/systemctl/list

# Containers Docker
curl -H "Authorization: Bearer SEU_TOKEN" http://SEU_SERVIDOR:9100/containers

# Status do serviço
systemctl status monitoring-agent`} />
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 9. DEPLOY DO FRONTEND ──────────────────────────────────── */}
          <Section id="deploy-frontend" icon={Globe} title="Deploy do Frontend">
            <p>O frontend é uma SPA (Single Page Application) que é servida como arquivos estáticos via Nginx.</p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Deploy automático (script)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyBlock code={`chmod +x docs/deploy-frontend.sh
./docs/deploy-frontend.sh`} />
                <p className="text-xs text-muted-foreground">O script faz:</p>
                <ol className="list-decimal list-inside text-xs space-y-1">
                  <li>Build de produção (<code className="bg-muted px-1 py-0.5 rounded">npm run build</code>)</li>
                  <li>Upload via rsync para <code className="bg-muted px-1 py-0.5 rounded">/var/www/monitorhub</code></li>
                  <li>Instala e configura Nginx (SPA fallback, gzip, cache)</li>
                  <li>Abre as portas 80/443 no firewall</li>
                  <li>Valida com curl</li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Deploy manual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <CopyBlock code={`# 1. Build
npm run build

# 2. Copiar para o servidor
rsync -avz --delete dist/ root@SEU_SERVIDOR:/var/www/monitorhub/

# 3. Configurar Nginx - criar /etc/nginx/sites-available/monitorhub:
#    server {
#        listen 80 default_server;
#        server_name _;
#        root /var/www/monitorhub;
#        index index.html;
#
#        location /assets/ {
#            expires 1y;
#            add_header Cache-Control "public, immutable";
#        }
#
#        location / {
#            try_files $uri $uri/ /index.html;
#        }
#    }

# 4. Ativar e recarregar
ln -sf /etc/nginx/sites-available/monitorhub /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx`} />
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── CONEXÕES & CREDENCIAIS ─────────────────────────────────── */}
          <Section id="conexoes" icon={KeyRound} title="Conexões & Credenciais (Painel)">
            <p>
              O painel de <Link to="/connections" className="text-primary underline font-medium">Conexões</Link> permite
              armazenar perfis de conexão reutilizáveis para evitar redigitar credenciais ao criar serviços.
            </p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Tipos de credencial suportados</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-semibold">Tipo</th>
                        <th className="text-left p-3 font-semibold">Campos</th>
                        <th className="text-left p-3 font-semibold">Usado em</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { type: 'Agente (Servidor)', fields: 'URL do Agente, Token', used: 'Server, Systemctl, Container' },
                        { type: 'Apache Airflow', fields: 'URL, Usuário, Senha, Auth Type', used: 'Airflow' },
                        { type: 'PostgreSQL', fields: 'Connection String ou Host/Porta/DB/User/Senha/SSL', used: 'PostgreSQL' },
                        { type: 'MongoDB', fields: 'Connection String ou Host/Porta/DB/User/Senha/Auth Source', used: 'MongoDB' },
                        { type: 'Azure SQL', fields: 'Connection String ou Host/DB/User/Senha', used: 'SQL Query (Azure)' },
                        { type: 'AWS', fields: 'Access Key ID, Secret Key, Região', used: 'CloudWatch, S3, Lambda, ECS, Alarms' },
                        { type: 'SSH', fields: 'Host, Porta, Usuário, Senha/Chave', used: 'TCP, Process' },
                        { type: 'HTTP Auth', fields: 'Tipo (Basic/Bearer), User/Senha ou Token', used: 'HTTP' },
                      ].map(row => (
                        <tr key={row.type}>
                          <td className="p-3 font-medium text-foreground">{row.type}</td>
                          <td className="p-3 text-muted-foreground">{row.fields}</td>
                          <td className="p-3"><Badge variant="outline" className="text-[10px] font-mono">{row.used}</Badge></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Fluxo de uso — passo a passo</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <div className="bg-muted/40 rounded-lg p-4 space-y-2 font-mono text-xs">
                  <p className="text-muted-foreground font-sans font-medium mb-2">Exemplo: monitorar um servidor com agente</p>
                  <p>1. Vá em <span className="text-primary">/connections</span> → &quot;Nova Credencial&quot;</p>
                  <p>2. Tipo: <span className="text-primary">Agente (Servidor)</span></p>
                  <p>3. Nome: &quot;Servidor Produção 192.168.1.100&quot;</p>
                  <p>4. URL: <span className="text-primary">http://192.168.1.100:9100</span></p>
                  <p>5. Token: <span className="text-primary">seu_token_hex_aqui</span></p>
                  <p>6. Salve a credencial</p>
                  <p>─────────────────────────────────────────</p>
                  <p>7. Vá em <span className="text-primary">/services</span> → &quot;Adicionar Serviço&quot;</p>
                  <p>8. Categoria: <span className="text-primary">Servidores</span>, Tipo: <span className="text-primary">Server</span></p>
                  <p>9. No dropdown &quot;Usar credencial salva&quot; → selecione a de cima</p>
                  <p>10. Campos <span className="text-green-400">preenchidos automaticamente</span> ✓</p>
                  <p>11. Salve → monitoramento ativo!</p>
                  <p>─────────────────────────────────────────</p>
                  <p>12. Repita para Systemctl e Container no <strong>mesmo servidor</strong></p>
                  <p>    → selecione a <strong>mesma credencial</strong> → sem redigitar nada</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-amber-500/20 bg-amber-500/5">
              <CardContent className="p-4 text-xs space-y-2">
                <p className="font-semibold text-amber-500">⚠ Informações importantes</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Credenciais são <strong>opcionais</strong> — você pode sempre preencher manualmente</li>
                  <li>A credencial <strong>preenche o formulário</strong> mas <strong>não é vinculada</strong> ao serviço. Se você editar a credencial depois, serviços existentes não são afetados</li>
                  <li>Credenciais ficam na tabela <code className="bg-muted px-1 py-0.5 rounded">credentials</code> com RLS — apenas usuários autenticados têm acesso</li>
                  <li>Senhas e tokens ficam no campo <code className="bg-muted px-1 py-0.5 rounded">config</code> (JSONB) e são exibidos como <code className="bg-muted px-1 py-0.5 rounded">••••</code> nos cards</li>
                </ul>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 10. CHECK TYPES ────────────────────────────────────────── */}
          <Section id="check-types" icon={MonitorCheck} title="Tipos de Check Suportados">
            <p>O MonitorHub suporta 15 tipos diferentes de monitoramento:</p>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-semibold">Tipo</th>
                        <th className="text-left p-3 font-semibold">Categoria</th>
                        <th className="text-left p-3 font-semibold">Descrição</th>
                        <th className="text-left p-3 font-semibold">Configuração</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { type: 'http', cat: 'API', desc: 'Monitora endpoints HTTP/HTTPS', config: 'URL, método, auth, headers, expected_status' },
                        { type: 'tcp', cat: 'Servidor', desc: 'Verifica conectividade TCP', config: 'Host, porta' },
                        { type: 'server', cat: 'Servidor', desc: 'Métricas completas do servidor', config: 'Agent URL, token' },
                        { type: 'systemctl', cat: 'Servidor', desc: 'Status de serviços systemd', config: 'Agent URL, lista de serviços, token' },
                        { type: 'container', cat: 'Container', desc: 'Status de containers Docker', config: 'Agent URL, token' },
                        { type: 'airflow', cat: 'Airflow', desc: 'DAGs, tasks e métricas Airflow', config: 'Base URL, username, password' },
                        { type: 'postgresql', cat: 'Database', desc: 'Conexões, cache hit, tamanho', config: 'Connection string ou host/port/db' },
                        { type: 'mongodb', cat: 'Database', desc: 'Conexões, ops/s, storage', config: 'Connection string ou host/port/db' },
                        { type: 'sql_query', cat: 'Database', desc: 'Azure SQL Server', config: 'Connection string ou host/db/user/pass' },
                        { type: 'cloudwatch', cat: 'AWS', desc: 'Métricas EC2 via CloudWatch', config: 'Instance ID, região' },
                        { type: 'cloudwatch_alarms', cat: 'AWS', desc: 'Alarmes CloudWatch', config: 'Prefixo, região' },
                        { type: 's3', cat: 'AWS', desc: 'Status de buckets S3', config: 'Bucket, região, prefixo' },
                        { type: 'lambda', cat: 'AWS', desc: 'Métricas de funções Lambda', config: 'Function name, região' },
                        { type: 'ecs', cat: 'AWS', desc: 'Serviços ECS/Fargate', config: 'Cluster, service, região' },
                        { type: 'process', cat: 'Servidor', desc: 'Verifica processo rodando', config: 'Nome do processo, SSH' },
                      ].map(row => (
                        <tr key={row.type}>
                          <td className="p-3"><Badge variant="outline" className="font-mono text-[10px]">{row.type}</Badge></td>
                          <td className="p-3 text-muted-foreground">{row.cat}</td>
                          <td className="p-3 text-foreground">{row.desc}</td>
                          <td className="p-3 text-muted-foreground">{row.config}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 11. EDGE FUNCTIONS ──────────────────────────────────────── */}
          <Section id="edge-functions" icon={Zap} title="Edge Functions (Supabase)">
            <p>O sistema possui 16 Edge Functions em Deno que rodam no Supabase:</p>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-semibold">Função</th>
                        <th className="text-left p-3 font-semibold">JWT</th>
                        <th className="text-left p-3 font-semibold">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { fn: 'health-check', jwt: false, desc: 'Orquestrador principal — verifica todos os serviços elegíveis' },
                        { fn: 'server-metrics', jwt: false, desc: 'Coleta métricas do servidor via agente (/metrics + /processes)' },
                        { fn: 'systemctl-metrics', jwt: true, desc: 'Status de serviços systemd via agente (/systemctl)' },
                        { fn: 'container-metrics', jwt: true, desc: 'Status de containers Docker via agente (/containers)' },
                        { fn: 'airflow-metrics', jwt: true, desc: 'DAGs, daily stats, durações do Apache Airflow' },
                        { fn: 'send-notification', jwt: false, desc: 'Envia notificações (Slack, Email, Webhook)' },
                        { fn: 'discover-services', jwt: false, desc: 'Auto-discovery de systemctl + containers via agente' },
                        { fn: 'seed-admin', jwt: true, desc: 'Cria usuário admin padrão' },
                        { fn: 'cleanup-old-checks', jwt: true, desc: 'Remove health_checks com mais de 30 dias' },
                        { fn: 'aws-metrics', jwt: true, desc: 'Métricas AWS CloudWatch' },
                        { fn: 'azure-sql-metrics', jwt: true, desc: 'Métricas Azure SQL Server' },
                        { fn: 'cloudwatch-alarms', jwt: true, desc: 'Status de alarmes CloudWatch' },
                        { fn: 'ecs-metrics', jwt: true, desc: 'Métricas AWS ECS/Fargate' },
                        { fn: 'lambda-metrics', jwt: true, desc: 'Métricas AWS Lambda' },
                        { fn: 'mongodb-metrics', jwt: true, desc: 'Métricas MongoDB' },
                        { fn: 'postgresql-metrics', jwt: true, desc: 'Métricas PostgreSQL' },
                      ].map(row => (
                        <tr key={row.fn}>
                          <td className="p-3 font-mono text-primary text-[11px]">{row.fn}</td>
                          <td className="p-3">{row.jwt ? <Badge variant="outline" className="text-[10px]">Requer JWT</Badge> : <Badge variant="secondary" className="text-[10px]">Público</Badge>}</td>
                          <td className="p-3 text-foreground">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 12. CRON ───────────────────────────────────────────────── */}
          <Section id="cron" icon={RefreshCw} title="Cron Automático (Health Checks)">
            <p>Os health checks são executados automaticamente via <strong>pg_cron</strong> + <strong>pg_net</strong>.</p>
            <Card>
              <CardContent className="p-4 space-y-3">
                <div className="bg-muted/40 rounded-lg p-4 space-y-2 text-xs font-mono">
                  <p className="text-muted-foreground font-sans font-medium mb-2">Fluxo a cada 1 minuto:</p>
                  <p>1. <span className="text-primary">pg_cron</span> dispara job &apos;health-check-cron&apos;</p>
                  <p>2. <span className="text-primary">pg_net</span> faz HTTP POST → Edge Function &apos;health-check&apos;</p>
                  <p>3. Edge Function consulta serviços habilitados</p>
                  <p>4. Filtra serviços por <span className="text-primary">check_interval_seconds</span> (com tolerância de 10s)</p>
                  <p>5. Para HTTP/TCP → executa check inline</p>
                  <p>6. Para outros → delega para edge function específica</p>
                  <p>7. Salva resultado em <span className="text-primary">health_checks</span></p>
                  <p>8. Atualiza <span className="text-primary">services</span> (status, uptime, métricas)</p>
                  <p>9. Gera alertas se status mudou</p>
                  <p>10. Dispara notificações se configuradas</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cada serviço tem seu próprio <code className="bg-muted px-1 py-0.5 rounded">check_interval_seconds</code> configurável
                  (mínimo 60s). O cron roda a cada minuto, mas a Edge Function só executa checks para serviços cujo intervalo já expirou.
                </p>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 13. ALERTAS ────────────────────────────────────────────── */}
          <Section id="alertas" icon={Bell} title="Alertas e Notificações">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Alertas automáticos</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <p>Alertas são gerados automaticamente quando:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><Badge variant="destructive" className="text-[10px]">critical</Badge> Serviço muda para <strong>offline</strong></li>
                    <li><Badge className="text-[10px] bg-warning text-warning-foreground">warning</Badge> Serviço muda para <strong>warning</strong></li>
                    <li><Badge className="text-[10px] bg-success text-success-foreground">info</Badge> Serviço <strong>recupera</strong> (volta a online)</li>
                    <li><Badge className="text-[10px] bg-warning text-warning-foreground">warning</Badge> SSL expirando em ≤ 7 dias</li>
                  </ul>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Thresholds configuráveis</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <p>Você pode configurar limites por serviço em <strong>Configurações → Thresholds</strong>:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>CPU % (ex: alerta se &gt; 90%)</li>
                    <li>Memória % (ex: alerta se &gt; 85%)</li>
                    <li>Disco % (ex: alerta se &gt; 90%)</li>
                    <li>Response time ms (ex: alerta se &gt; 5000ms)</li>
                  </ul>
                  <p>Cada threshold tem <strong>cooldown</strong> configurável para evitar flood de alertas.</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Canais de notificação</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <p>Configure em <strong>Configurações → Notificações</strong>:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li><strong>Slack:</strong> Cole a URL do Webhook Incoming</li>
                    <li><strong>Email:</strong> Via Resend (configure RESEND_API_KEY nos secrets do Supabase)</li>
                    <li><strong>Webhook genérico:</strong> Recebe JSON POST com dados do alerta</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Separator />

          {/* ── REGRAS DE STATUS ───────────────────────────────────────── */}
          <Section id="regras-status" icon={SlidersHorizontal} title="Regras de Status por Tipo de Check">
            <p>
              As regras de status definem quando um serviço é considerado <Badge variant="secondary" className="text-[10px] bg-warning/20 text-warning">warning</Badge> ou{' '}
              <Badge variant="secondary" className="text-[10px] bg-destructive/20 text-destructive">offline</Badge> com base nas métricas coletadas.
            </p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Como configurar</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <ol className="list-decimal list-inside space-y-1">
                  <li>Vá em <Link to="/settings" className="text-primary underline font-medium">Configurações</Link></li>
                  <li>Role até a seção <strong>&quot;Regras de Status por Tipo de Check&quot;</strong></li>
                  <li>Selecione o tipo de check (http, server, postgresql, etc.)</li>
                  <li>Configure as condições para <strong>Warning</strong> e <strong>Offline</strong></li>
                </ol>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Exemplo de regras para tipo &quot;server&quot;</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <div className="border border-amber-500/20 rounded-lg p-3 bg-amber-500/5">
                    <p className="font-semibold text-amber-500 mb-2">Warning quando:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>CPU &gt; 80%</li>
                      <li>Memória &gt; 85%</li>
                      <li>Disco &gt; 80%</li>
                    </ul>
                  </div>
                  <div className="border border-destructive/20 rounded-lg p-3 bg-destructive/5">
                    <p className="font-semibold text-destructive mb-2">Offline quando:</p>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>CPU &gt; 95%</li>
                      <li>Memória &gt; 95%</li>
                      <li>Disco &gt; 95%</li>
                      <li>Agente não responde (timeout)</li>
                    </ul>
                  </div>
                </div>
                <p className="text-muted-foreground">
                  As regras são salvas na tabela <code className="bg-muted px-1 py-0.5 rounded">check_type_status_rules</code> como JSON.
                  Se nenhuma regra for configurada, o sistema usa os padrões internos da Edge Function.
                </p>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 14. BANCO DE DADOS ─────────────────────────────────────── */}
          <Section id="banco" icon={Database} title="Banco de Dados (PostgreSQL)">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-semibold">Tabela</th>
                        <th className="text-left p-3 font-semibold">Descrição</th>
                        <th className="text-left p-3 font-semibold">Colunas principais</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      <tr>
                        <td className="p-3 font-mono text-primary">services</td>
                        <td className="p-3 text-foreground">Serviços monitorados</td>
                        <td className="p-3 text-muted-foreground">id, name, category, status, uptime, cpu, memory, disk, response_time, url, check_type, check_config, check_interval_seconds, enabled</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-primary">health_checks</td>
                        <td className="p-3 text-foreground">Histórico de verificações</td>
                        <td className="p-3 text-muted-foreground">id, service_id, status, response_time, cpu, memory, disk, status_code, error_message, checked_at</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-primary">alerts</td>
                        <td className="p-3 text-foreground">Alertas gerados</td>
                        <td className="p-3 text-muted-foreground">id, service_id, type (critical/warning/info), message, acknowledged, created_at</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-primary">alert_thresholds</td>
                        <td className="p-3 text-foreground">Limites configuráveis</td>
                        <td className="p-3 text-muted-foreground">id, service_id, metric, operator, threshold, severity, enabled, cooldown_minutes</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-primary">notification_settings</td>
                        <td className="p-3 text-foreground">Config de notificações por usuário</td>
                        <td className="p-3 text-muted-foreground">id, user_id, alert_email, slack_webhook_url, generic_webhook_url, notify_critical_only</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-primary">check_type_status_rules</td>
                        <td className="p-3 text-foreground">Regras de status por tipo de check</td>
                        <td className="p-3 text-muted-foreground">id, check_type, warning_rules (JSONB), offline_rules (JSONB)</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-mono text-primary">credentials</td>
                        <td className="p-3 text-foreground">Credenciais reutilizáveis</td>
                        <td className="p-3 text-muted-foreground">id, name, credential_type (aws/agent/airflow/postgresql/mongodb/azure_sql/ssh/http_auth), config (JSONB), description</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
            <p className="text-xs">
              Todas as tabelas possuem <strong>Row Level Security (RLS)</strong> ativado. Apenas usuários autenticados conseguem acessar os dados.
              O cleanup automático remove health_checks com mais de 30 dias (via cron diário às 3 AM).
            </p>
          </Section>

          <Separator />

          {/* ── 15. API DO AGENTE ──────────────────────────────────────── */}
          <Section id="api-agente" icon={Network} title="API do Agente (Endpoints)">
            <p>O agente Python expõe os seguintes endpoints na porta configurada (padrão 9100):</p>
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-semibold">Método</th>
                        <th className="text-left p-3 font-semibold">Endpoint</th>
                        <th className="text-left p-3 font-semibold">Auth</th>
                        <th className="text-left p-3 font-semibold">Descrição</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { method: 'GET', endpoint: '/health', auth: false, desc: 'Verifica se o agente está rodando. Retorna {"status":"ok"}' },
                        { method: 'GET', endpoint: '/metrics', auth: true, desc: 'CPU, RAM, swap, disco, load, rede, uptime' },
                        { method: 'POST', endpoint: '/systemctl', auth: true, desc: 'Status de serviços systemd. Body: {"services":["nginx","docker"]}' },
                        { method: 'GET', endpoint: '/systemctl/list', auth: true, desc: 'Lista todos os serviços systemd ativos (auto-discovery)' },
                        { method: 'GET', endpoint: '/containers', auth: true, desc: 'Status e stats de containers Docker' },
                        { method: 'GET', endpoint: '/processes', auth: true, desc: 'Top 20 processos por CPU e memória' },
                        { method: 'GET', endpoint: '/version', auth: false, desc: 'Versão atual e disponibilidade de update' },
                        { method: 'POST', endpoint: '/update', auth: true, desc: 'Atualiza o agente para a versão mais recente (via GitHub)' },
                      ].map(row => (
                        <tr key={row.endpoint}>
                          <td className="p-3"><Badge variant={row.method === 'POST' ? 'default' : 'secondary'} className="text-[10px]">{row.method}</Badge></td>
                          <td className="p-3 font-mono text-primary">{row.endpoint}</td>
                          <td className="p-3">{row.auth ? '🔒 Token' : '🔓 Público'}</td>
                          <td className="p-3 text-foreground">{row.desc}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 16. CREDENCIAIS E SECRETS ─────────────────────────────── */}
          <Section id="credenciais" icon={Key} title="Credenciais e Secrets">
            <p>
              O MonitorHub usa <strong>Supabase Edge Function Secrets</strong> para armazenar credenciais sensíveis.
              Essas variáveis ficam no servidor Supabase e <strong>nunca são expostas</strong> no frontend.
            </p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Cloud className="h-4 w-4" /> AWS — Credenciais Globais</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p>
                  As credenciais AWS são <strong>globais</strong> — um único par de chaves compartilhado por todos os serviços AWS
                  (CloudWatch, S3, Lambda, ECS, CloudWatch Alarms). Elas são configuradas como secrets do Supabase.
                </p>

                <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3 text-xs">
                  <p className="font-semibold text-amber-500 mb-1">⚠ Importante</p>
                  <p>Não existe credencial AWS por serviço. Ao cadastrar um serviço AWS no formulário, você só informa
                  o <strong>identificador do recurso</strong> (Instance ID, Bucket, Function Name, etc.) e a <strong>região</strong>.
                  As chaves de acesso vêm do backend.</p>
                </div>

                <p className="font-semibold text-foreground">Variáveis necessárias:</p>
                <CopyBlock code={`AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_REGION=us-east-1   # opcional, padrão: us-east-1`} />

                <p className="font-semibold text-foreground">Como configurar no Supabase:</p>
                <CopyBlock code={`# Via Supabase CLI
npx supabase secrets set AWS_ACCESS_KEY_ID="SUA_ACCESS_KEY"
npx supabase secrets set AWS_SECRET_ACCESS_KEY="SUA_SECRET_KEY"
npx supabase secrets set AWS_REGION="sa-east-1"

# Verificar secrets configurados
npx supabase secrets list`} />

                <p className="font-semibold text-foreground">Como trocar as credenciais AWS (novo usuário):</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>No AWS Console, vá em <strong>IAM → Users → Create User</strong></li>
                  <li>Crie uma política com permissões de <strong>leitura</strong> (veja abaixo)</li>
                  <li>Gere um novo par <strong>Access Key / Secret Key</strong></li>
                  <li>Atualize os secrets no Supabase com os comandos acima</li>
                  <li>As Edge Functions já usarão as novas credenciais automaticamente (sem re-deploy)</li>
                </ol>

                <p className="font-semibold text-foreground">Passo a passo — Criar usuário IAM:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Acesse <a href="https://console.aws.amazon.com/iam" target="_blank" rel="noreferrer" className="text-primary underline">AWS IAM Console</a></li>
                  <li>Clique em <strong>Users → Create user</strong></li>
                  <li>Nome: <code className="bg-muted px-1 py-0.5 rounded">monitorhub-readonly</code></li>
                  <li>Em Permissions, escolha <strong>Attach policies directly</strong></li>
                  <li>Crie uma nova policy com o JSON abaixo</li>
                  <li>Após criar o usuário, vá em <strong>Security credentials → Create access key</strong></li>
                  <li>Escolha <strong>Third-party service</strong> e copie o Access Key + Secret Key</li>
                </ol>

                <p className="font-semibold text-foreground">Permissões IAM mínimas recomendadas:</p>
                <CopyBlock code={`{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:GetMetricData",
        "cloudwatch:DescribeAlarms",
        "cloudwatch:ListMetrics",
        "s3:ListBucket",
        "s3:GetBucketLocation",
        "s3:ListAllMyBuckets",
        "lambda:GetFunction",
        "lambda:ListFunctions",
        "lambda:GetFunctionConfiguration",
        "ecs:DescribeServices",
        "ecs:DescribeClusters",
        "ecs:ListServices",
        "ec2:DescribeInstances"
      ],
      "Resource": "*"
    }
  ]
}`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> Azure SQL — Credenciais</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p>
                  O Azure SQL suporta <strong>credenciais por serviço</strong> (preenchidas no formulário ao cadastrar)
                  OU variáveis de ambiente como fallback global.
                </p>
                <p className="font-semibold text-foreground">Opção 1 — No formulário (per-service):</p>
                <p>Ao adicionar um serviço Azure SQL, preencha host, database, username e password diretamente no formulário.</p>

                <p className="font-semibold text-foreground">Opção 2 — Variáveis de ambiente (global):</p>
                <CopyBlock code={`npx supabase secrets set AZURE_SQL_SERVER="seu-server.database.windows.net"
npx supabase secrets set AZURE_SQL_DATABASE="seu-database"
npx supabase secrets set AZURE_SQL_USER="admin"
npx supabase secrets set AZURE_SQL_PASSWORD="sua-senha"`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Database className="h-4 w-4" /> PostgreSQL e MongoDB</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p>
                  PostgreSQL e MongoDB usam <strong>credenciais por serviço</strong> exclusivamente.
                  Você informa a connection string ou host/porta/usuário/senha no formulário ao cadastrar cada serviço.
                </p>
                <p>Exemplos de connection string:</p>
                <CopyBlock code={`# PostgreSQL
postgresql://usuario:senha@host:5432/database?sslmode=require

# MongoDB
mongodb+srv://usuario:senha@cluster.mongodb.net/database`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Cpu className="h-4 w-4" /> Token do Agente — Fluxo Completo</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p>
                  O token do agente é uma string secreta compartilhada entre o agente (no servidor) e o MonitorHub
                  (no campo <code className="bg-muted px-1 py-0.5 rounded">token</code> do serviço).
                </p>

                <p className="font-semibold text-foreground">Onde o token fica armazenado:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><strong>No servidor:</strong> no unit systemd <code className="bg-muted px-1 py-0.5 rounded">/etc/systemd/system/monitoring-agent.service</code> como argumento <code className="bg-muted px-1 py-0.5 rounded">--token</code></li>
                  <li><strong>No MonitorHub:</strong> no campo &quot;Token do Agente&quot; ao cadastrar um serviço do tipo Server, Systemctl ou Container</li>
                </ul>

                <p className="font-semibold text-foreground">Fluxo completo (passo a passo):</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Gere um token seguro:</li>
                </ol>
                <CopyBlock code={'python3 -c "import secrets; print(secrets.token_hex(32))"'} />
                <ol className="list-decimal list-inside space-y-1" start={2}>
                  <li>Instale o agente no servidor passando o token:</li>
                </ol>
                <CopyBlock code={`curl -fsSL https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/install-agent.sh | sudo bash -s -- --token SEU_TOKEN`} />
                <ol className="list-decimal list-inside space-y-1" start={3}>
                  <li>No MonitorHub, vá em <strong>Serviços → Adicionar Serviço</strong></li>
                  <li>Escolha categoria <strong>Servidores</strong> e tipo <strong>Systemctl</strong>, <strong>Server</strong> ou <strong>Container</strong></li>
                  <li>Preencha o campo <strong>URL do Agente</strong> com <code className="bg-muted px-1 py-0.5 rounded">http://IP_SERVIDOR:9100</code></li>
                  <li>Cole o <strong>mesmo token</strong> no campo &quot;Token do Agente&quot;</li>
                  <li>Salve. O health-check automático vai começar a consultar o agente usando esse token</li>
                </ol>

                <p className="font-semibold text-foreground">Trocar o token de um agente:</p>
                <CopyBlock code={`# 1. No servidor — parar, editar e reiniciar
sudo systemctl stop monitoring-agent
sudo sed -i 's/--token TOKEN_ANTIGO/--token TOKEN_NOVO/' /etc/systemd/system/monitoring-agent.service
sudo systemctl daemon-reload
sudo systemctl start monitoring-agent

# 2. No MonitorHub — editar o serviço e atualizar o campo "Token do Agente"`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Bell className="h-4 w-4" /> Email (Resend)</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p>
                  Para enviar alertas por email, configure a API key do <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-primary underline">Resend</a>:
                </p>
                <CopyBlock code={`npx supabase secrets set RESEND_API_KEY="re_xxxxxxxxxxxxxxxxxxxx"`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Resumo — Todas as variáveis de ambiente (Secrets)</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left p-3 font-semibold">Variável</th>
                        <th className="text-left p-3 font-semibold">Obrigatória</th>
                        <th className="text-left p-3 font-semibold">Usada por</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {[
                        { v: 'AWS_ACCESS_KEY_ID', req: 'Se usar AWS', used: 'aws-metrics, cloudwatch-alarms, ecs-metrics, lambda-metrics' },
                        { v: 'AWS_SECRET_ACCESS_KEY', req: 'Se usar AWS', used: 'aws-metrics, cloudwatch-alarms, ecs-metrics, lambda-metrics' },
                        { v: 'AWS_REGION', req: 'Não (default: us-east-1)', used: 'Todas as AWS functions' },
                        { v: 'AZURE_SQL_SERVER', req: 'Se usar Azure (fallback)', used: 'azure-sql-metrics' },
                        { v: 'AZURE_SQL_DATABASE', req: 'Se usar Azure (fallback)', used: 'azure-sql-metrics' },
                        { v: 'AZURE_SQL_USER', req: 'Se usar Azure (fallback)', used: 'azure-sql-metrics' },
                        { v: 'AZURE_SQL_PASSWORD', req: 'Se usar Azure (fallback)', used: 'azure-sql-metrics' },
                        { v: 'RESEND_API_KEY', req: 'Se usar email', used: 'send-notification' },
                      ].map(row => (
                        <tr key={row.v}>
                          <td className="p-3 font-mono text-primary text-[11px]">{row.v}</td>
                          <td className="p-3">{row.req}</td>
                          <td className="p-3 text-muted-foreground">{row.used}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── GERENCIAMENTO DE USUÁRIOS ───────────────────────────────── */}
          <Section id="usuarios" icon={UserPlus} title="Gerenciamento de Usuários">
            <p>
              O MonitorHub usa <strong>Supabase Auth</strong> para autenticação. Usuários são gerenciados via Supabase Dashboard ou CLI.
            </p>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Usuário padrão (admin)</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p>Ao fazer o setup inicial, a Edge Function <code className="bg-muted px-1 py-0.5 rounded">seed-admin</code> cria:</p>
                <div className="bg-muted/40 rounded-lg p-3 font-mono text-xs">
                  <p>Email: <span className="text-primary">admin@monitorhub.com</span></p>
                  <p>Senha: <span className="text-primary">Admin123!</span></p>
                </div>
                <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                  <p className="font-semibold text-destructive mb-1">⚠ Segurança</p>
                  <p className="text-muted-foreground">Altere a senha imediatamente após o primeiro login. Acesse o Supabase Dashboard → Authentication → Users para alterar.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Adicionar novos usuários</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p><strong>Via Supabase Dashboard (mais fácil):</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Acesse <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer" className="text-primary underline">supabase.com/dashboard</a></li>
                  <li>Selecione seu projeto</li>
                  <li>Vá em <strong>Authentication → Users</strong></li>
                  <li>Clique em <strong>Add user → Create new user</strong></li>
                  <li>Preencha email e senha</li>
                  <li>O novo usuário já pode logar no MonitorHub</li>
                </ol>

                <p><strong>Via API (programático):</strong></p>
                <CopyBlock code={`curl -X POST "https://SEU_PROJETO.supabase.co/auth/v1/admin/users" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "novo@usuario.com",
    "password": "SenhaSegura123!",
    "email_confirm": true
  }'`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Alterar senha</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p><strong>Via Supabase Dashboard:</strong></p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Authentication → Users</li>
                  <li>Encontre o usuário</li>
                  <li>Clique nos 3 pontos → <strong>Send password recovery</strong></li>
                </ol>

                <p><strong>Via API (admin):</strong></p>
                <CopyBlock code={`curl -X PUT "https://SEU_PROJETO.supabase.co/auth/v1/admin/users/USER_ID" \\
  -H "apikey: SUA_SERVICE_ROLE_KEY" \\
  -H "Authorization: Bearer SUA_SERVICE_ROLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"password": "NovaSenha123!"}'`} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Remover usuário</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-3">
                <p>No Supabase Dashboard → Authentication → Users → clique nos 3 pontos → <strong>Delete user</strong></p>
                <p className="text-muted-foreground">
                  <strong>Nota:</strong> Como o sistema usa RLS baseado em <code className="bg-muted px-1 py-0.5 rounded">authenticated</code>,
                  todos os usuários autenticados têm acesso aos mesmos dados. Não há roles diferentes (admin vs viewer) — todos podem
                  criar, editar e excluir serviços.
                </p>
              </CardContent>
            </Card>
          </Section>

          <Separator />

          {/* ── 17. SEGURANÇA ──────────────────────────────────────────── */}
          <Section id="seguranca" icon={Shield} title="Segurança">
            <div className="grid md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Frontend</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>• Autenticação via Supabase Auth (email + senha)</p>
                  <p>• JWT tokens com auto-refresh</p>
                  <p>• Rotas protegidas (ProtectedRoute)</p>
                  <p>• Headers de segurança no Nginx (X-Frame-Options, CSP, etc.)</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Backend (Supabase)</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>• RLS (Row Level Security) em todas as tabelas</p>
                  <p>• Service Role Key apenas nas Edge Functions (server-side)</p>
                  <p>• Anon Key no frontend (acesso limitado pelo RLS)</p>
                  <p>• HTTPS em todos os endpoints Supabase</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Agente</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>• Bearer token obrigatório em endpoints sensíveis</p>
                  <p>• /health e /version são públicos (sem dados sensíveis)</p>
                  <p>• Porta configurável (não usa 80/443)</p>
                  <p>• Roda como serviço systemd (restart automático)</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Rede</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-1">
                  <p>• Firewall UFW com portas explícitas</p>
                  <p>• Agente aceita conexões apenas do Supabase (pull-based)</p>
                  <p>• Sem credenciais hardcoded no frontend</p>
                  <p>• Tokens do agente em variáveis/config do Supabase</p>
                </CardContent>
              </Card>
            </div>
          </Section>

          <Separator />

          {/* ── 17. TROUBLESHOOTING ────────────────────────────────────── */}
          <Section id="troubleshooting" icon={AlertTriangle} title="Troubleshooting">
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Serviço aparece como &quot;offline&quot; mas está rodando</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <p>Verifique:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>O URL do agente está correto na configuração do serviço?</li>
                    <li>O token de autenticação está correto?</li>
                    <li>A porta do agente está aberta no firewall? <code className="bg-muted px-1 py-0.5 rounded">ufw status</code></li>
                    <li>O agente está rodando? <code className="bg-muted px-1 py-0.5 rounded">systemctl status monitoring-agent</code></li>
                    <li>Teste manual: <code className="bg-muted px-1 py-0.5 rounded">curl http://SERVIDOR:9100/health</code></li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Health checks não atualizam automaticamente</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <p>Verifique:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>As extensões pg_cron e pg_net estão ativadas no Supabase?</li>
                    <li>A migration do cron foi aplicada? (<code className="bg-muted px-1 py-0.5 rounded">npx supabase db push</code>)</li>
                    <li>A Edge Function health-check foi deployada com <code className="bg-muted px-1 py-0.5 rounded">--no-verify-jwt</code>?</li>
                    <li>O serviço está com <code className="bg-muted px-1 py-0.5 rounded">enabled = true</code> e status ≠ maintenance?</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Frontend não carrega após deploy</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Nginx está rodando? <code className="bg-muted px-1 py-0.5 rounded">systemctl status nginx</code></li>
                    <li>Config válida? <code className="bg-muted px-1 py-0.5 rounded">nginx -t</code></li>
                    <li>Porta 80 aberta? <code className="bg-muted px-1 py-0.5 rounded">ufw allow 80/tcp</code></li>
                    <li>Arquivos existem? <code className="bg-muted px-1 py-0.5 rounded">ls /var/www/monitorhub/</code></li>
                    <li>Variáveis de ambiente corretas no .env antes do build?</li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Containers Docker não aparecem</CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Docker está instalado e rodando?</li>
                    <li>O socket Docker existe? <code className="bg-muted px-1 py-0.5 rounded">ls -la /var/run/docker.sock</code></li>
                    <li>O agente tem permissão? (roda como root ou no grupo docker)</li>
                    <li>Teste: <code className="bg-muted px-1 py-0.5 rounded">curl -H &quot;Authorization: Bearer TOKEN&quot; http://SERVIDOR:9100/containers</code></li>
                  </ol>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Comandos úteis</CardTitle>
                </CardHeader>
                <CardContent>
                  <CopyBlock code={`# Logs do agente
journalctl -u monitoring-agent -f --no-pager

# Logs do Nginx
journalctl -u nginx -f --no-pager

# Reiniciar agente
systemctl restart monitoring-agent

# Reiniciar Nginx
systemctl restart nginx

# Re-deploy do frontend
./docs/deploy-frontend.sh

# Verificar cron jobs no Supabase
# (via SQL Editor no Dashboard do Supabase)
SELECT * FROM cron.job;
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;`} />
                </CardContent>
              </Card>
            </div>
          </Section>

          {/* Footer */}
          <Separator />
          <div className="text-center text-xs text-muted-foreground pb-8 space-y-1">
            <p>MonitorHub v1.0 — Sistema de Monitoramento de Infraestrutura</p>
            <p>Desenvolvido por Solutions in BI</p>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default Documentation;
