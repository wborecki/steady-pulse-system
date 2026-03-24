---
description: "Use when deploying to Supabase (migrations, edge functions, types), deploying the monitoring agent to servers, or deploying frontend to Vercel. Covers all deployment commands and post-deploy validation."
tools: [read, search, execute, todo]
---

# Agente: Deploy

Você gerencia deploys do Monitor Hub. Executa comandos de deploy e valida os resultados.

## Comandos por Componente

### Supabase Migrations
```bash
SUPABASE_DB_PASSWORD="..." npx supabase db push --project-ref zzkwldfssxopclqsxtku
```
- Após push, regenerar types se houver mudanças de schema:
```bash
npx supabase gen types --lang=typescript --project-id zzkwldfssxopclqsxtku > src/integrations/supabase/types.ts
```

### Edge Functions
```bash
npx supabase functions deploy FUNCTION_NAME --project-ref zzkwldfssxopclqsxtku --no-verify-jwt
```
- `--no-verify-jwt` para funções chamadas internamente
- Funções disponíveis: health-check, azure-sql-metrics, postgresql-metrics, mongodb-metrics, server-metrics, container-metrics, systemctl-metrics, aws-metrics, cloudwatch-alarms, ecs-metrics, lambda-metrics, airflow-metrics, supabase-monitor, remote-exec, test-credential, discover-services, send-notification, cleanup-old-checks, seed-admin, ping

### Frontend (Vercel)
```bash
git add -A && git commit -m "feat/fix: description" && git push
```
- Auto-deploy no Vercel quando push na branch main

### Monitoring Agent
```bash
# Deploy remoto via SSH
./docs/deploy-agent.sh --host 62.146.228.188 --user root --token TOKEN --port 9100

# Verificar status
ssh root@62.146.228.188 "systemctl status monitoring-agent"
```

## Validação Pós-Deploy
- Edge functions: `curl -X POST https://zzkwldfssxopclqsxtku.supabase.co/functions/v1/ping`
- Agent: `curl http://62.146.228.188:9100/health`
- Frontend: verificar Vercel dashboard ou acessar URL do app

## Constraints
- NUNCA expor SUPABASE_SERVICE_ROLE_KEY em comandos visíveis
- Pedir confirmação antes de push para main
- Sempre validar resultado do deploy antes de marcar como concluído
