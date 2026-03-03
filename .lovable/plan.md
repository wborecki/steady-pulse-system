

## Tela de Configuração de Thresholds de Status por Tipo de Serviço

### Problema

Os limites que determinam quando um serviço fica "online", "warning" ou "offline" estão hardcoded em 10 edge functions diferentes. Exemplo do Airflow: `successRate < 50` → warning. Do servidor: `cpu > 95` → offline. Esses valores precisam ser configuráveis pela UI.

### Solução

Criar uma tabela de regras de status por `check_type` e uma tela de configuração na página de Settings.

---

### 1. Nova tabela `check_type_status_rules`

| Coluna | Tipo | Descrição |
|---|---|---|
| id | uuid | PK |
| check_type | text (unique) | Ex: airflow, server, postgresql |
| warning_rules | jsonb | Condições para status "warning" |
| offline_rules | jsonb | Condições para status "offline" |
| created_at | timestamp | |
| updated_at | timestamp | |

Exemplo de `warning_rules` para Airflow:
```json
{
  "import_errors_gt": 0,
  "success_rate_lt": 50,
  "failed_runs_gt": 10,
  "failed_runs_success_rate_lt": 70
}
```

Exemplo para Server:
```json
{
  "cpu_gt": 80,
  "memory_gt": 80,
  "disk_gt": 80
}
```

Seed com os valores atuais hardcoded para todos os 10 tipos.

### 2. UI — Nova aba em Settings

Adicionar uma aba/card "Regras de Status" na página de configurações com:
- Lista de todos os `check_type` existentes
- Para cada tipo, campos editáveis para os limites de warning e offline
- Campos dinâmicos conforme o tipo (Airflow mostra success_rate, failed_runs; Server mostra cpu, memory, disk)
- Botão salvar por tipo

### 3. Atualizar Edge Functions

Cada edge function (airflow-metrics, server-metrics, etc.) passa a ler a tabela `check_type_status_rules` antes de determinar o status, usando os valores do banco ao invés dos hardcoded. Se não houver regra configurada, usa os defaults atuais como fallback.

---

### Arquivos afetados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Criar tabela + seed com defaults atuais |
| `src/pages/SettingsPage.tsx` | Adicionar seção "Regras de Status" |
| `src/hooks/useCheckTypeRules.ts` | Novo hook CRUD |
| `supabase/functions/airflow-metrics/index.ts` | Ler regras do banco |
| `supabase/functions/server-metrics/index.ts` | Ler regras do banco |
| `supabase/functions/azure-sql-metrics/index.ts` | Ler regras do banco |
| `supabase/functions/container-metrics/index.ts` | Ler regras do banco |
| `supabase/functions/lambda-metrics/index.ts` | Ler regras do banco |
| `supabase/functions/ecs-metrics/index.ts` | Ler regras do banco |
| `supabase/functions/cloudwatch-alarms/index.ts` | Ler regras do banco |
| `supabase/functions/mongodb-metrics/index.ts` | Ler regras do banco |
| `supabase/functions/postgresql-metrics/index.ts` | Ler regras do banco |
| `supabase/functions/systemctl-metrics/index.ts` | Ler regras do banco |
| `supabase/functions/health-check/index.ts` | Ler regras do banco (HTTP) |

