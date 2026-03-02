

## Sprint Completo - MonitorHub Funcional

### Diagnóstico: O que falta

Analisei todo o codebase e identifiquei os seguintes problemas que impedem o sistema de funcionar de ponta a ponta:

1. **MetricsChart usa dados mock** - Importa `generateMetrics` de `mockData.ts` em vez de usar dados reais do `health_checks`
2. **Formulário de cadastro incompleto** - Falta campo para configuração TCP (host/port) quando o tipo de check é TCP
3. **Sem edição de serviço** - Não é possível editar um serviço depois de criado
4. **Sem exclusão de serviço** - O hook `useDeleteService` existe mas não é usado em nenhuma UI
5. **Uptime nunca é calculado** - O campo `uptime` na tabela `services` fica sempre 0 porque a edge function não calcula
6. **Foreign keys ausentes** - As tabelas `alerts` e `health_checks` não têm FK para `services`, o que pode causar dados órfãos
7. **Gráficos no ServiceDetail usam mock** - Mesma situação do dashboard
8. **Configurações (Settings) são demo** - Nenhuma configuração é salva
9. **RLS policies permissivas** - Qualquer pessoa pode ler/alterar tudo (sem autenticação)
10. **Cron job pode não estar configurado** - A migração do cron pode ter falhado se pg_cron/pg_net não estavam habilitados

### Sprint (em ordem de prioridade)

**1. Corrigir Foreign Keys no banco**
- Adicionar FK de `health_checks.service_id` e `alerts.service_id` para `services.id` com `ON DELETE CASCADE`

**2. Calcular uptime na edge function**
- Após salvar o health check, calcular o uptime como % de checks "online" das últimas 24h e atualizar o campo `uptime` no serviço

**3. Gráficos com dados reais**
- Refatorar `MetricsChart` para aceitar dados como prop (array de health_checks)
- No Dashboard, buscar os últimos health checks agregados e passar para o gráfico
- No ServiceDetail, usar o `useHealthCheckHistory` já existente para alimentar os gráficos

**4. Formulário de cadastro com campos dinâmicos**
- Quando tipo = TCP, mostrar campos host e port que são salvos em `check_config`
- Quando tipo = HTTP, mostrar campo URL (já existe)
- Adicionar campo de intervalo de verificação (check_interval_seconds)

**5. Editar e excluir serviço**
- Criar hook `useUpdateService`
- No ServiceDetail, adicionar botões de editar (abre dialog com form preenchido) e excluir (com confirmação)
- Usar o `useDeleteService` existente

**6. Invalidar queries após health check**
- Após `triggerCheck`, invalidar queries de `services`, `alerts` e `health_checks` para atualizar a UI imediatamente

**7. Remover dependências de mockData**
- Remover imports de `mockData.ts` do MetricsChart e qualquer outro componente
- O arquivo `mockData.ts` pode ser mantido apenas para tipos/referência

### Detalhes Técnicos

- **Migração SQL**: Uma migração para adicionar FKs e criar uma função `calculate_uptime` que conta checks online/total nas últimas 24h
- **Edge function**: Adicionar chamada a `calculate_uptime` via RPC ou calcular inline após inserir health_check
- **MetricsChart refactor**: Mudar de `generateMetrics()` para receber `data: {time, value}[]` como prop, removendo a dependência do mock
- **useUpdateService**: Mutation similar ao `useCreateService` mas com `.update().eq('id', id)`
- **Query invalidation**: No `useTriggerHealthCheck`, adicionar `onSuccess` que invalida `['services']`, `['alerts']`, `['health_checks']`

