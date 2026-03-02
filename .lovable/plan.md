

## Simplificar Dashboard — Remover Serviços, Top 5 Latência e Alertas Recentes

O dashboard vai ficar focado apenas em **métricas e análises**. A seção final com as 3 colunas (Top 5 Latência, Serviços, Alertas Recentes) será completamente removida.

### Alterações em `src/pages/Index.tsx`

1. **Remover a seção inteira do grid de 3 colunas** (linhas 229-341) — Top 5 Latência, lista de Serviços com filtros de categoria, e Alertas Recentes

2. **Remover código não utilizado** após a remoção:
   - `useMemo` de `topLatency`, `filteredServices`
   - Estado `selectedCategory` e array `categories`
   - Imports não usados: `AlertItem`, `ServiceRow`, `Zap`, `StatusIndicator` (se não usado em outro lugar), `acknowledgeAlert`, `useAcknowledgeAlert`

3. **Manter intacto**:
   - Header com botão "Verificar Agora"
   - Stats Cards (5 cards: Online, Alertas Ativos, Offline, SLA 24h, Uptime)
   - Banner de Serviços Críticos
   - 4 gráficos de métricas (Latência, Disponibilidade, Incidentes por Categoria, Timeline de Incidentes)

### Resultado
Dashboard limpo com foco em métricas e análise visual. Serviços e alertas ficam acessíveis pelas suas páginas dedicadas no menu lateral.

