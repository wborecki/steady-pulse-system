

## Diagnóstico Completo: O que falta para finalizar o MonitorHub

Após revisar todos os componentes, hooks, edge functions, agente e banco de dados, aqui está o estado atual organizado por categoria.

---

### O QUE JA ESTA FUNCIONANDO

```text
COMPONENTE                          STATUS
─────────────────────────────────────────────────
Dashboard (Index.tsx)               ✅ Completo — stats, gráficos, SLA, banner crítico
Serviços (Services.tsx)             ✅ Completo — busca, filtros, adicionar
Detalhe do Serviço (ServiceDetail)  ✅ Completo — métricas contextuais por check_type,
                                       editar, excluir, manutenção, SSL, thresholds
Alertas (Alerts.tsx)                ✅ Completo — filtros, paginação, reconhecer
Relatórios (Reports.tsx)            ✅ Completo — heatmap, MTTR/MTBF, ranking, CSV export
Configurações (SettingsPage.tsx)    ✅ Completo — persiste em notification_settings
Login (Login.tsx)                   ✅ Funcional — email/senha
Sidebar (AppSidebar.tsx)            ✅ Funcional — mobile hamburger, collapse
Realtime (useRealtimeSubscriptions) ✅ Ativo — services, alerts, health_checks
Thresholds (ThresholdConfigPanel)   ✅ Dinâmico — métricas por check_type + dados reais
Agente Linux (monitoring-agent.py)  ✅ Completo — systemctl, containers, metrics
Script instalador (install-agent.sh)✅ Completo — one-liner com systemd
Edge Functions (14 funções)         ✅ Deployadas — health-check, send-notification,
                                       server-metrics, aws, azure, postgresql, etc.
Cron job (pg_cron)                  ✅ Configurado (ver plan.md)
Limpeza de dados antigos            ✅ Função cleanup_old_health_checks existe
```

---

### O QUE PRECISA SER CORRIGIDO OU MELHORADO

#### 1. ServiceRow — Mostra barras CPU/MEM/DISK incorretamente para alguns tipos

**Problema:** A função `showsResourceMetrics()` na linha 74 do `ServiceRow.tsx` só retorna `true` para `tcp`, `process`, `cloudwatch` e quando `checkType` é undefined. Serviços com agente (systemctl, container) que TÊM métricas reais de CPU/MEM/DISK mostram apenas "Latência + Uptime" na lista.

**Correção:** Aplicar a mesma lógica dinâmica do ThresholdConfigPanel — mostrar barras se `service.cpu > 0 || service.memory > 0 || service.disk > 0`, independente do check_type.

#### 2. Email de notificação — Apenas placeholder (log)

**Problema:** No `send-notification/index.ts` linha 84-87, emails são apenas logados no console (`console.log`), nunca enviados de verdade. Slack e webhooks genéricos funcionam.

**Correção:** Integrar com um serviço de email real (Resend, ou usar o Lovable AI para um endpoint simples).

#### 3. Agente — URL hardcoded no install-agent.sh

**Problema:** Linhas 32 e 7-8 do `install-agent.sh` contêm `https://raw.githubusercontent.com/SEU_REPO/main/docs/...` — placeholder nunca atualizado. O script não funciona em produção.

**Correção:** Substituir por URL real do repositório ou hospedar o agente em storage.

#### 4. Sidebar — Label "Colapsar" ausente

**Problema:** O botão de colapsar (linhas 67-72 do AppSidebar.tsx) mostra apenas o ícone `ChevronLeft/ChevronRight`, sem texto quando a sidebar está expandida. Isso confunde usuários.

**Correção:** Adicionar `{!collapsed && <span className="text-xs">Colapsar</span>}` ao lado do ícone.

#### 5. Sem empty state guiado na página de Serviços

**Problema:** Quando não há serviços, mostra apenas "Nenhum serviço encontrado" (linha 101, Services.tsx). Não guia o usuário a criar o primeiro serviço.

**Correção:** Adicionar ilustração/ícone + botão "Adicionar primeiro serviço" que abre o Sheet.

#### 6. Sem confirmação de exclusão de threshold

**Problema:** No `ThresholdConfigPanel.tsx` linha 238, o botão de delete remove imediatamente sem confirmação.

**Correção:** Adicionar AlertDialog de confirmação antes de deletar.

#### 7. Dark/Light mode toggle ausente

**Problema:** O app é 100% dark. Não há toggle para light mode apesar de `next-themes` estar instalado.

**Correção:** Adicionar switch de tema na sidebar ou settings.

#### 8. Responsividade — Header do ServiceDetail quebra em mobile

**Problema:** Os botões do header (Manutenção, Editar, Excluir, Verificar) ficam em `flex-wrap` mas sem espaçamento adequado em telas pequenas, e o título trunca mal.

**Correção:** Stack vertical em mobile (`flex-col` em breakpoint sm).

#### 9. Métricas no ServiceRow para serviços com agente

**Problema:** Serviços do tipo `systemctl` e `container` que recebem métricas via agente (cpu, memory, disk) não mostram as barras de recursos na lista porque `showsResourceMetrics('systemctl')` retorna `false`.

**Correção:** Incluir `systemctl`, `container`, `sql_query`, `mongodb`, `ecs`, `airflow`, `cloudwatch` na lista de tipos com barras, ou usar a abordagem dinâmica baseada nos valores.

#### 10. Gráficos históricos de CPU/MEM/DISK não aparecem para HTTP com agente

**Problema:** No `ServiceDetail.tsx`, os gráficos de `cpuHistory`, `memHistory`, `diskHistory` são renderizados condicionalmente (verificar abaixo dos gráficos de latência), mas podem não estar visíveis para check_types como HTTP que recebem dados via agente externo.

**Observação:** Já funciona se health_checks tiver dados em `cpu/memory/disk` — mas confirmar que a renderização condicional está correta.

---

### RESUMO DE PRIORIDADES

```text
PRIORIDADE    ITEM                                    ESFORÇO
──────────────────────────────────────────────────────────────
Alta          #1 ServiceRow barras dinâmicas           ~15 min
Alta          #9 Mesmo issue — systemctl/container     Mesma fix
Média         #4 Label "Colapsar" na sidebar           ~5 min
Média         #5 Empty state guiado em Services        ~15 min
Média         #6 Confirmação ao deletar threshold      ~10 min
Média         #8 Responsividade ServiceDetail header   ~10 min
Baixa         #2 Email real (precisa serviço externo)  ~30 min
Baixa         #3 URL do agente no install-agent.sh     ~5 min
Baixa         #7 Dark/Light mode toggle                ~20 min
Baixa         #10 Verificar gráficos históricos        ~10 min
```

### PLANO DE IMPLEMENTACAO

**Batch 1 — Correções rápidas (ServiceRow + Sidebar + Empty State)**
- `ServiceRow.tsx`: Mudar `showsResourceMetrics()` para verificar `service.cpu > 0 || service.memory > 0 || service.disk > 0` em vez de checkar check_type
- `AppSidebar.tsx`: Adicionar label "Colapsar" quando expandido
- `Services.tsx`: Empty state com ícone Server + botão CTA "Adicionar primeiro serviço"

**Batch 2 — UX refinements (Threshold confirm + Mobile + Agente URL)**
- `ThresholdConfigPanel.tsx`: Wrap delete button com AlertDialog
- `ServiceDetail.tsx`: Header responsivo com `flex-col` em mobile
- `install-agent.sh`: Remover placeholder URL ou adicionar instrução para substituir

**Batch 3 — Opcional (Theme toggle + Email real)**
- Adicionar ThemeProvider com `next-themes` e toggle na sidebar
- Integrar email real no `send-notification` (Resend ou similar)

