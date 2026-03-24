# Monitor Hub — Project Instructions

## Visão Geral

Sistema de monitoramento de infraestrutura e serviços em tempo real. Frontend React SPA + backend Supabase (Edge Functions + PostgreSQL) + agente Python para coleta de métricas em servidores remotos. App Android via Capacitor.

**Nome do produto:** Monitor Hub  
**Idioma da UI e mensagens:** Português (pt-BR)  
**Supabase Project ID:** `zzkwldfssxopclqsxtku`  
**Supabase URL:** `https://zzkwldfssxopclqsxtku.supabase.co`

## Stack Técnica

### Frontend
- **Framework:** React 18 + TypeScript + Vite (SWC)
- **UI:** shadcn/ui (Radix primitives) + Tailwind CSS + CSS variables para theming
- **State:** TanStack React Query (staleTime: 15s, gcTime: 5min)
- **Routing:** React Router DOM v6 — lazy loading de páginas via `lazyWithRetry()`
- **Forms:** React Hook Form + Zod validation
- **Charts:** Recharts
- **Icons:** Lucide React
- **Tema:** Dark mode default (next-themes), fontes Space Grotesk + JetBrains Mono
- **Mobile:** Capacitor (Android)
- **Deploy:** Vercel (auto-deploy on git push to main)
- **Path alias:** `@/` → `src/`

### Backend (Supabase)
- **Database:** PostgreSQL com RLS, pg_cron, pg_net
- **Edge Functions:** Deno (TypeScript), 20 funções
- **Auth:** Supabase Auth (email/password), service role key para edge functions
- **Realtime:** Supabase Realtime (services, alerts, health_checks, credentials)

### Agente de Monitoramento
- **Linguagem:** Python 3 (sem dependências externas exceto pymssql para SQL Server)
- **Arquivo:** `docs/monitoring-agent.py`
- **Instalação:** `docs/install-agent.sh` (systemd service)
- **Deploy remoto:** `docs/deploy-agent.sh` (via SSH)

## Estrutura do Projeto

```
src/
  App.tsx              # Router principal com lazy loading
  main.tsx             # Entry point + Capacitor init
  components/
    ui/                # shadcn/ui components (NÃO editar manualmente)
    monitoring/        # Componentes de domínio (AddServiceForm, AppSidebar, etc.)
  hooks/               # Custom hooks (useServices, useAuth, useHealthChecks, etc.)
  integrations/
    supabase/
      client.ts        # Supabase client (auto-generated, NÃO editar)
      types.ts         # Database types (auto-generated, NÃO editar)
  pages/               # Páginas da aplicação
  lib/utils.ts         # cn() helper para Tailwind

supabase/
  config.toml          # Configuração do projeto Supabase
  migrations/          # SQL migrations (ordem cronológica)
  functions/           # Edge Functions (Deno)
    health-check/      # Orquestrador principal (cron + manual)
    azure-sql-metrics/ # SQL Server Azure + on-prem
    postgresql-metrics/ # PostgreSQL metrics
    mongodb-metrics/   # MongoDB metrics
    server-metrics/    # Métricas de servidor (via agente)
    container-metrics/ # Docker containers (via agente)
    systemctl-metrics/ # Systemd services (via agente)
    aws-metrics/       # CloudWatch EC2/RDS
    cloudwatch-alarms/ # CloudWatch Alarms
    ecs-metrics/       # ECS services
    lambda-metrics/    # Lambda functions
    airflow-metrics/   # Apache Airflow
    supabase-monitor/  # Monitoramento de projetos Supabase
    remote-exec/       # Execução remota de comandos
    test-credential/   # Validação de credenciais
    discover-services/ # Descoberta de serviços
    send-notification/ # Slack/email/webhook
    cleanup-old-checks/ # Limpeza de dados antigos
    seed-admin/        # Criação do admin inicial
    ping/              # Health check da runtime

docs/
  monitoring-agent.py   # Agente Python v2.5
  install-agent.sh      # Script de instalação local
  deploy-agent.sh       # Script de deploy remoto (SSH)
  deploy-frontend.sh    # Deploy Nginx (legado, agora usa Vercel)
```

## Database Schema

### Tabelas Principais

| Tabela | Propósito |
|--------|-----------|
| `services` | Registro de serviços monitorados (config, status, métricas) |
| `health_checks` | Histórico de verificações (FK → services, cascade delete) |
| `alerts` | Histórico de alertas (critical/warning/info) |
| `alert_thresholds` | Regras de alerta configuráveis por serviço/métrica |
| `credentials` | Credenciais reutilizáveis (AWS, PostgreSQL, MSSQL, etc.) |
| `check_type_status_rules` | Regras padrão de warning/offline por check_type |
| `notification_settings` | Configuração de notificação por usuário |
| `command_snippets` | Snippets de comandos para terminal remoto |
| `command_history` | Histórico de execuções remotas |

### Enums

```sql
check_type: http, tcp, process, sql_query, sql_server, custom, postgresql, mongodb,
            cloudwatch, s3, airflow, lambda, ecs, cloudwatch_alarms, systemctl, container
service_category: aws, database, airflow, server, process, api, container
service_status: online, offline, warning, maintenance
alert_type: critical, warning, info
```

### Dados Enriquecidos

Métricas detalhadas são armazenadas em `services.check_config._detail_cache` (JSONB), não em tabelas separadas. Cada check_type produz estrutura diferente de métricas.

## Arquitetura de Health Checks

### Fluxo Principal
1. `pg_cron` dispara `health-check` periodicamente
2. Filtra serviços habilitados por `check_interval_seconds`
3. Processa em lotes de 5 em paralelo
4. Cada check_type é roteado para handler inline ou edge function delegada
5. Resultado: insere `health_checks`, atualiza `services`, cria `alerts` se necessário

### Roteamento por check_type

| Check Type | Handler | Observações |
|-----------|---------|-------------|
| `http` | Inline (`checkHttp()`) | SSL expiry check incluso |
| `tcp` | Inline (`checkTcp()`) | HTTP HEAD fallback |
| `postgresql` | `postgresql-metrics` ou agent relay | npm:pg@8, conexão direta |
| `sql_query` | `azure-sql-metrics` | Azure SQL (sys.dm_db_resource_stats) |
| `sql_server` | `azure-sql-metrics` | On-prem (ring_buffers, sys.dm_os_sys_memory) |
| `mongodb` | `mongodb-metrics` | npm:mongodb@6 |
| `cloudwatch` / `s3` | `aws-metrics` | AWS Signature V4 manual |
| `lambda` | `lambda-metrics` | AWS Signature V4 |
| `ecs` | `ecs-metrics` | AWS Signature V4 |
| `cloudwatch_alarms` | `cloudwatch-alarms` | AWS Signature V4 |
| `systemctl` | `systemctl-metrics` | Via agente |
| `container` | `container-metrics` | Via agente |
| `server` | `server-metrics` | Via agente |
| `airflow` | `airflow-metrics` | REST API + JWT/Basic |

### Padrões Importantes

- **Credential Resolution:** `check_config.credential_id` → busca na tabela `credentials` → merge com config inline
- **Agent Relay:** Se `agent_url` está no config, edge function delega para agente Python em vez de conectar direto
- **Status Rules:** Tabela `check_type_status_rules` define limiares de warning/offline por tipo
- **_detail_cache:** Métricas enriquecidas armazenadas em `check_config._detail_cache` para exibição no frontend

## Comandos de Build e Deploy

### Frontend
```bash
npm run dev          # Dev server (porta 8080)
npm run build        # Build produção
npm run lint         # ESLint
npm run test         # Vitest (run once)
npm run test:watch   # Vitest (watch mode)
```

### Supabase
```bash
# Push migrations para produção
SUPABASE_DB_PASSWORD="..." npx supabase db push --project-ref zzkwldfssxopclqsxtku

# Deploy de edge function específica
npx supabase functions deploy FUNCTION_NAME --project-ref zzkwldfssxopclqsxtku --no-verify-jwt

# Gerar types atualizados (quando schema mudar)
npx supabase gen types --lang=typescript --project-id zzkwldfssxopclqsxtku > src/integrations/supabase/types.ts
```

### Android
```bash
npm run cap:sync        # Build + sync com Capacitor
npm run cap:build       # Build APK debug
npm run cap:build:release  # Build APK release
```

### Agente
```bash
# Deploy remoto
./docs/deploy-agent.sh --host IP --user root --token TOKEN --port 9100

# Instalação local
sudo bash docs/install-agent.sh --token TOKEN --port 9100

# Status
sudo systemctl status monitoring-agent
sudo journalctl -u monitoring-agent -f
```

## Convenções de Código

### Frontend
- **Componentes UI:** Usar shadcn/ui. Adicionar via `npx shadcn-ui@latest add COMPONENT`. Nunca editar arquivos em `src/components/ui/` manualmente.
- **Hooks:** Um hook por arquivo em `src/hooks/`. Prefixo `use`. Usar TanStack React Query para data fetching.
- **Pages:** Um arquivo por página em `src/pages/`. Lazy-loaded via `lazyWithRetry()` em App.tsx.
- **Estilo:** Tailwind CSS utility classes. CSS variables para cores do tema. Usar `cn()` de `@/lib/utils` para merge de classes.
- **Formulários:** React Hook Form + Zod schema. Não usar state manual para forms complexos.
- **Toasts:** `sonner` para notificações (`toast.success()`, `toast.error()`).
- **Types auto-gerados:** `src/integrations/supabase/types.ts` é auto-gerado. Após alterar schema, rodar `npx supabase gen types`.

### Edge Functions (Deno)
- **Runtime:** Deno (não Node.js). Imports via URL ou `npm:` specifier.
- **Padrão de resposta:** `new Response(JSON.stringify(data), { headers: corsHeaders })`.
- **CORS headers:** Incluir em todas as respostas. OPTIONS request retorna 204.
- **Supabase client:** Criar com `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` do env.
- **Error handling:** Sempre retornar JSON com `error` field, nunca lançar exceções não tratadas.
- **deploy:** `--no-verify-jwt` para funções chamadas internamente (health-check, server-metrics, etc.).

### Agente Python
- **Sem dependências:** Usar apenas stdlib do Python 3 + pymssql (para SQL Server).
- **Thread safety:** Métricas coletadas em threads separadas.
- **Segurança:** Allowlist de comandos para `/exec`. Token Bearer obrigatório.
- **Self-update:** Endpoint `/update` que baixa versão mais recente do GitHub.

### Migrations
- **Naming:** `YYYYMMDDHHMMSS_description.sql`
- **Idempotência:** Usar `IF NOT EXISTS`, `CREATE OR REPLACE`, `DO $$ ... END $$` para ser seguro em re-execução.
- **RLS:** Sempre habilitar RLS em novas tabelas + criar policies para `authenticated`.
- **Enums:** Alterar com `ALTER TYPE ... ADD VALUE IF NOT EXISTS`.
- **Cuidado:** `types.ts` precisa ser regenerado após alterar enums/tabelas.

## Padrões de Adição de Novo Serviço (check_type)

Ao adicionar um novo tipo de monitoramento, seguir esta checklist:

1. **Migration:** Adicionar valor ao enum `check_type` + opcional `service_category`
2. **Migration:** Adicionar regras em `check_type_status_rules` (warning + offline)
3. **Migration:** Adicionar tipo de credencial em `credentials` se necessário
4. **Edge Function:** Criar função em `supabase/functions/NOME/index.ts` ou adicionar case no `health-check`
5. **health-check:** Adicionar roteamento no switch/case de `checkType`
6. **test-credential:** Adicionar validação de conexão se usar credencial
7. **AddServiceForm.tsx:** Adicionar formulário de configuração (campos específicos do tipo)
8. **ServiceDetail.tsx:** Adicionar painel de detalhes para exibir métricas enriquecidas
9. **ThresholdConfigPanel.tsx:** Adicionar métricas disponíveis para alertas
10. **types.ts:** Regenerar com `npx supabase gen types`
11. **Deploy:** Push migration + deploy edge functions + git push (Vercel)

## Infraestrutura

- **Servidor de monitoramento:** `62.146.228.188` (agente Python rodando na porta 9100)
- **SQL Server:** Mesmo servidor, porta 1433 (MSSQL 16.x, user sa)
- **Frontend:** Vercel (auto-deploy via git push to main)
- **Backend:** Supabase Cloud (projeto zzkwldfssxopclqsxtku)
- **CI:** GitHub Actions para build APK Android
- **DNS/Hosting legado:** Nginx em `212.47.72.193` (script deploy-frontend.sh)

## Segurança

- Edge Functions usam `SUPABASE_SERVICE_ROLE_KEY` — nunca expor no frontend
- Frontend usa apenas `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` (anon key)
- Agente Python: token Bearer + IP allowlist + UFW firewall
- Remote exec: allowlist de comandos, output truncado a 64KB
- RLS habilitado em todas as tabelas
- `notification_settings`: RLS por `user_id`
- Credenciais armazenadas como JSONB em `credentials.config`

## Troubleshooting Comum

- **Edge function timeout:** Supabase edge functions têm limite de 25s. Conexões a bancos remotos podem demorar se o servidor estiver lento.
- **`sys.dm_db_resource_stats` error:** Essa DMV só existe no Azure SQL. Para SQL Server on-prem (`check_type: sql_server`), usar ring_buffers e `sys.dm_os_sys_memory`.
- **types.ts desatualizado:** Após alterar schema, sempre rodar `npx supabase gen types`. O arquivo `src/integrations/supabase/types.ts` é auto-gerado.
- **Chunk load failure:** `lazyWithRetry()` em App.tsx faz reload automático quando chunks ficam stale após deploy.
- **CORS em edge functions:** Toda resposta deve incluir `corsHeaders`. OPTIONS retorna 204.
- **npm:mssql no Deno:** `catch {}` vazio não captura todos os erros do driver mssql no Deno. Preferir não executar queries que podem falhar em vez de depender de try/catch.
