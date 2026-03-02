

## Plan: Dashboards contextuais por tipo de serviço

### Problema atual
Apenas o Airflow tem um dashboard detalhado com informacoes especificas. Os outros tipos (Azure SQL, PostgreSQL, MongoDB, AWS) coletam detalhes ricos no backend mas nao persistem nem exibem na UI.

### Mudancas necessarias

#### 1. Persistir detalhes no backend (3 edge functions)

Assim como o Airflow salva `_airflow_details` no `check_config`, fazer o mesmo para:

- **`azure-sql-metrics/index.ts`**: Salvar `_sql_details` com connections, top_waits, IO, sessions, storage no `check_config` do servico
- **`postgresql-metrics/index.ts`**: Salvar `_pg_details` com connections, cache_hit_ratio, top_tables, transactions, replication_lag
- **`mongodb-metrics/index.ts`**: Salvar `_mongo_details` com connections, memory, opcounters, network, db_stats, active_operations

#### 2. Dashboard contextual na UI (`ServiceDetail.tsx`)

Adicionar secoes especificas apos os MetricCards, similar ao bloco Airflow existente:

**Azure SQL**:
- 3 cards: IO Data %, Log Write %, Workers %
- Card de conexoes: ativas vs total sessoes
- Top 5 Waits (tabela com wait_type, count, time)
- Storage: usado vs alocado (MB)

**PostgreSQL**:
- 3 cards: Cache Hit Ratio, Replication Lag, Conexoes Ativas
- Tabela de Top Tables (nome, tamanho, rows, dead tuples, bloat %)
- Card de transacoes: commits, rollbacks, deadlocks
- Tuplas: returned, fetched, inserted, updated, deleted

**MongoDB**:
- 3 cards: Conexoes (current/available), Memoria (resident/virtual MB), Ops Ativas
- DB Stats: collections, objects, data size, storage size, indexes
- Opcounters: insert, query, update, delete, getmore, command
- Network: bytes in/out, requests

**HTTP** (ja tem status codes, adicionar):
- Percentis de latencia (p50/p95/p99) ja existem nos cards
- Manter como esta

**TCP/Infra**:
- Manter CPU/Memory/Disk como esta

#### 3. MetricCards contextuais

Ajustar os 4 cards principais para cada tipo:
- **SQL**: CPU %, Memory %, Storage %, Conexoes Ativas
- **PostgreSQL**: Conexoes %, Cache Hit %, Latencia, Uptime
- **MongoDB**: Conexoes %, Memoria %, Disco %, Ops Ativas

#### 4. Historico de checks contextual

Na tabela de historico, mostrar colunas relevantes por tipo (ex: para DB mostrar CPU/MEM, para HTTP mostrar status code).

### Arquivos modificados
- `supabase/functions/azure-sql-metrics/index.ts` — persistir `_sql_details`
- `supabase/functions/postgresql-metrics/index.ts` — persistir `_pg_details`  
- `supabase/functions/mongodb-metrics/index.ts` — persistir `_mongo_details`
- `src/pages/ServiceDetail.tsx` — secoes de dashboard por tipo

