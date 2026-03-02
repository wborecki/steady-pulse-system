

## Analise do estado atual e proximos passos

### O que ja existe
- **HTTP/TCP** — check basico de disponibilidade
- **Azure SQL** — metricas detalhadas (IO, waits, conexoes)
- **PostgreSQL** — metricas detalhadas (cache hit, top tables, transacoes)
- **MongoDB** — metricas detalhadas (opcounters, memoria, conexoes)
- **Airflow** — dashboard completo (DAGs, scheduler, pool, success rate)
- **AWS CloudWatch (EC2/RDS)** — metricas via CloudWatch API
- **AWS S3** — verificacao de bucket

### Novos servicos solicitados

#### 1. AWS Lambda
- **Edge function**: `lambda-metrics/index.ts`
- Usar CloudWatch API para coletar: Invocations, Errors, Duration (avg/p99), Throttles, ConcurrentExecutions
- Persistir `_lambda_details` no `check_config`
- **Dashboard**: cards de Invocations, Error Rate %, Duration P99, Throttles; grafico de invocacoes vs erros

#### 2. AWS ECS (Fargate/EC2)
- **Edge function**: `ecs-metrics/index.ts`
- Usar ECS API (DescribeServices, DescribeTasks) + CloudWatch (CPUUtilization, MemoryUtilization)
- Persistir `_ecs_details`: running/desired/pending tasks, deployments, CPU/MEM por service
- **Dashboard**: cards de Running Tasks vs Desired, CPU %, MEM %; tabela de tasks com status; deployment info

#### 3. CloudWatch Alarms
- **Edge function**: `cloudwatch-alarms/index.ts`
- Usar CloudWatch API (DescribeAlarms) para listar alarmes ativos
- Persistir `_cw_alarms_details`: lista de alarmes com state, metric, threshold
- **Dashboard**: tabela de alarmes com status (OK/ALARM/INSUFFICIENT_DATA), metrica, threshold

#### 4. Systemctl (Servicos Linux)
- **Edge function**: `systemctl-metrics/index.ts`
- Como Edge Functions nao acessam servidores diretamente, usar **agente HTTP**: o servidor expoe um endpoint (ex: `:9100/systemctl`) que retorna status dos servicos via `systemctl is-active`
- Config: `{ "agent_url": "http://server:9100", "services": ["nginx", "docker", "postgresql"] }`
- Persistir `_systemctl_details`: lista de units com active/inactive/failed, memory, uptime
- **Dashboard**: tabela de units com status badge, PID, memoria, uptime; card de resumo (X active, Y failed)

#### 5. Docker/Container
- **Edge function**: `container-metrics/index.ts`
- Similar ao systemctl: depende de agente HTTP no host que expoe Docker API stats
- Config: `{ "agent_url": "http://server:9100", "type": "docker" }`
- Coleta via Docker Engine API: containers running, CPU %, MEM %, network I/O
- Persistir `_container_details`: lista de containers com name, image, status, CPU, MEM, network
- **Dashboard**: tabela de containers com status, CPU/MEM bars; cards de total running/stopped/unhealthy

### Mudancas necessarias

#### Database migration
- Adicionar novos valores ao enum `check_type`: `lambda`, `ecs`, `cloudwatch_alarms`, `systemctl`, `container`
- Adicionar nova categoria `container` ao enum `service_category`

#### Arquivos novos
| Arquivo | Descricao |
|---|---|
| `supabase/functions/lambda-metrics/index.ts` | Metricas Lambda via CloudWatch |
| `supabase/functions/ecs-metrics/index.ts` | Metricas ECS via ECS + CloudWatch API |
| `supabase/functions/cloudwatch-alarms/index.ts` | Lista de alarmes CloudWatch |
| `supabase/functions/systemctl-metrics/index.ts` | Status de units via agente HTTP |
| `supabase/functions/container-metrics/index.ts` | Status de containers via agente HTTP |

#### Arquivos modificados
| Arquivo | Mudanca |
|---|---|
| `supabase/functions/health-check/index.ts` | Adicionar cases para lambda, ecs, cloudwatch_alarms, systemctl, container |
| `supabase/config.toml` | -- nao editar, auto-gerenciado |
| `src/components/monitoring/AddServiceForm.tsx` | Novos check types, categorias, e campos de config especificos |
| `src/pages/ServiceDetail.tsx` | Dashboards contextuais para cada novo tipo |

### Nota sobre systemctl e containers
Estes dependem de um **agente leve** rodando nos servidores monitorados, expondo metricas via HTTP. Isso e padrao de mercado (similar a Prometheus node_exporter). A edge function faz GET no agente e coleta os dados. O usuario precisa instalar o agente nos servidores. Posso fornecer um script de agente simples em Python/Bash como referencia.

### Ordem de implementacao sugerida
1. Lambda + ECS + CloudWatch Alarms (usam mesmas credenciais AWS ja configuradas)
2. Systemctl + Container (dependem de agente, implementacao similar entre si)
3. Dashboards contextuais para todos os 5 novos tipos

