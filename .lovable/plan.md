

## Melhorias para Análise de Serviços de TI

Analisei todo o sistema e identifiquei as melhorias mais relevantes para um time de tecnologia analisar seus serviços. O foco é em **riqueza de informação** e **dados acionáveis**.

---

### 1. Dashboard Executivo com Métricas Reais

**Problema**: Dashboard mostra apenas contadores básicos (online/offline) e dois gráficos genéricos.

**Melhoria**:
- Adicionar cards de **SLA** (uptime 7d, 30d) além das 24h atuais
- **Serviços em estado crítico** no topo com tempo de indisponibilidade
- **Gráfico de incidentes por categoria** (quais áreas dão mais problema)
- **Top 5 serviços com maior latência** para ação rápida
- **Timeline de incidentes** mostrando quando cada serviço ficou offline/warning nas últimas 24h

### 2. ServiceDetail Contextual por Tipo de Serviço

**Problema**: A página de detalhe mostra CPU/MEM/DISK para todos os serviços, mesmo HTTP/APIs que não têm essas métricas. Falta informação específica.

**Melhoria**:
- **Para APIs/HTTP**: Distribuição de status codes (2xx, 4xx, 5xx), percentis de latência (p50, p95, p99), tempo médio de resposta por hora
- **Para Databases (PostgreSQL/MongoDB/SQL)**: Conexões ativas, cache hit ratio, tamanho do banco, replication lag -- dados que já vêm das edge functions mas não são exibidos
- **Para Servidores/TCP**: Tempo de resposta TCP, uptime contínuo, último restart
- **Para CloudWatch/S3**: Métricas específicas da AWS (CPU EC2, tamanho bucket)
- Exibir a **configuração do serviço** (URL, host, porta, tipo de check) em seção colapsável para referência rápida
- **Gráficos de CPU, Memória e Disco ao longo do tempo** (dados já coletados nos health_checks mas não plotados)

### 3. Tabela de Histórico de Checks Melhorada

**Problema**: Tabela limitada a 20 registros, sem filtros, sem paginação.

**Melhoria**:
- Paginação completa (50 por página)
- Filtro por status (online/offline/warning)
- Filtro por período (última hora, 6h, 24h, 7d)
- Coluna de **duração do estado** (quanto tempo ficou offline antes de voltar)
- Destaque visual para checks com erro (fundo vermelho sutil)

### 4. Página de Relatórios / Visão Analítica

**Nova página**: `/reports`
- **Uptime por serviço** nos últimos 7/30 dias em formato de heatmap (grid colorido por dia/hora)
- **MTTR** (tempo médio de recuperação) e **MTBF** (tempo médio entre falhas) por serviço
- **Ranking de disponibilidade** -- quais serviços são mais/menos confiáveis
- **Tendência de latência** -- serviços piorando ao longo do tempo

### 5. Melhoria na Listagem de Serviços

**Problema**: ServiceRow mostra CPU/MEM/DISK para todos, incluindo APIs que não têm esses dados.

**Melhoria**:
- Mostrar métricas relevantes por tipo: latência para HTTP, porta/status para TCP, bucket size para S3
- Indicador visual de **tendência** (seta up/down se latência piorou/melhorou vs check anterior)
- Badge com **tempo desde último check** colorido (verde < 2min, amarelo < 5min, vermelho > 5min)

---

### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/pages/Index.tsx` | Dashboard executivo com SLA, incidentes, top latência |
| `src/pages/ServiceDetail.tsx` | Métricas contextuais por tipo, gráficos CPU/MEM/DISK, config colapsável |
| `src/pages/Reports.tsx` | **Nova página** com heatmap de uptime, MTTR/MTBF, rankings |
| `src/components/monitoring/ServiceRow.tsx` | Métricas contextuais por tipo, badge de tendência |
| `src/components/monitoring/AppSidebar.tsx` | Adicionar link para Relatórios |
| `src/App.tsx` | Rota `/reports` |
| `src/hooks/useHealthChecks.ts` | Query para histórico com filtros e paginação |

Sem migrações de banco necessárias -- todos os dados já existem nas tabelas `health_checks` e `services`.

