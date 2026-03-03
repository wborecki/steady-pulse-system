

## Análise: O que falta para o sistema estar 100% utilizável

Após revisar todas as páginas, hooks, edge functions e banco de dados, aqui está o diagnóstico completo dividido em **crítico** (impede uso real), **importante** (funcionalidade incompleta) e **polimento** (melhorias de UX).

---

### CRÍTICO — Sem isso, não funciona em produção

| # | Item | Estado Atual | O que fazer |
|---|------|-------------|-------------|
| 1 | **Cron job para health checks automáticos** | Não existe. Checks só rodam manualmente via botão "Verificar Agora" | Criar cron job via `pg_cron` + `pg_net` para chamar `health-check` a cada 1 minuto automaticamente |
| 2 | **Notificações externas (email/Slack/webhook)** | Página de Settings é 100% demo — botão "Salvar" não faz nada, campos não persistem | Criar tabela `notification_settings`, persistir configs, e disparar notificações reais quando alertas são criados (edge function `send-notification`) |
| 3 | **Edição e exclusão de serviços** | Formulário de edição existe (`mode='edit'`), mas não há botão na UI para acessar. Exclusão existe no hook mas sem botão na interface | Adicionar botões "Editar" e "Excluir" (com confirmação) na página `ServiceDetail` |
| 4 | **Limpeza de dados antigos** | Health checks acumulam infinitamente — sem retenção | Criar função SQL ou cron para deletar health_checks com mais de 30/90 dias |

### IMPORTANTE — Funcionalidade incompleta

| # | Item | Estado Atual | O que fazer |
|---|------|-------------|-------------|
| 5 | **Página de Settings funcional** | Campos visuais sem persistência (intervalo, auto-refresh, email, webhook) | Persistir em tabela `app_settings` ou `notification_settings` e aplicar os valores |
| 6 | **Filtro de alertas** | Lista todos os alertas sem filtro por tipo, serviço ou período | Adicionar filtros (tipo: critical/warning/info, serviço, período) e paginação |
| 7 | **Exportação de relatórios** | Heatmap, MTTR/MTBF existem mas sem opção de exportar | Adicionar botão para exportar CSV ou PDF |
| 8 | **Status "maintenance"** | Existe no enum do banco mas sem UI para colocar serviço em manutenção | Adicionar toggle/botão "Modo Manutenção" que pausa alertas para o serviço |
| 9 | **Gerenciamento de usuários** | Apenas login, sem signup, sem gestão de múltiplos usuários, sem perfil | Adicionar página de perfil e, opcionalmente, gestão de usuários admin |
| 10 | **Realtime updates** | Dashboard usa polling a cada 15-30s | Habilitar Supabase Realtime nas tabelas `services`, `alerts` e `health_checks` para updates instantâneos |

### POLIMENTO — Tornar profissional

| # | Item |
|---|------|
| 11 | Responsividade mobile — sidebar não é mobile-friendly |
| 12 | Empty states melhores — quando não há serviços cadastrados, guiar o usuário |
| 13 | Thresholds padrão ao criar serviço (CPU > 90%, Disco > 90%) |
| 14 | Confirmação de exclusão de threshold |
| 15 | Dark/light mode toggle na sidebar |

---

### Plano de Implementação (ordem sugerida)

**Fase 1 — Tornar funcional (prioridade máxima)**
1. Criar **cron job** automático para health checks (SQL insert via pg_cron)
2. Adicionar botões **Editar/Excluir serviço** no ServiceDetail
3. Tornar **Settings funcional** — persistir notificações em tabela

**Fase 2 — Completar funcionalidades**
4. Criar **edge function de notificações** (email via Resend ou webhook genérico + Slack)
5. Adicionar **filtros e paginação** na página de Alertas
6. Implementar **modo manutenção** para serviços
7. Criar **retenção automática** de dados antigos

**Fase 3 — Polimento**
8. Realtime updates via Supabase channels
9. Exportação de relatórios (CSV)
10. Responsividade mobile
11. Thresholds padrão automáticos

---

### Arquivos afetados por fase

```text
Fase 1:
  - SQL: cron job insert (pg_cron + pg_net)
  - SQL: migration para notification_settings
  - src/pages/ServiceDetail.tsx (botões editar/excluir)
  - src/pages/SettingsPage.tsx (persistência)

Fase 2:
  - supabase/functions/send-notification/index.ts (nova)
  - src/pages/Alerts.tsx (filtros)
  - src/hooks/useAlerts.ts (filtros)
  - supabase/functions/health-check/index.ts (modo manutenção)

Fase 3:
  - src/pages/Reports.tsx (export CSV)
  - src/components/monitoring/AppSidebar.tsx (mobile)
  - Realtime subscriptions nos hooks
```

Deseja que eu implemente por fases, ou quer priorizar itens específicos?

