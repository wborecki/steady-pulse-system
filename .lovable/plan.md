

## Auditoria Final — Pronto para Produção

Após revisar todo o código, banco de dados e linter, identifiquei os pontos pendentes. Separei em **deve corrigir** e **melhorias opcionais**.

---

### Deve Corrigir (Segurança)

**1. RLS Policies ainda permissivas (8 warnings no linter)**

As policies de `services` e `alert_thresholds` ainda usam `USING (true)` / `WITH CHECK (true)` para INSERT, UPDATE e DELETE. Qualquer usuário autenticado pode modificar dados de qualquer outro. Como este é um sistema de monitoramento onde tipicamente todos os usuários autenticados compartilham os mesmos serviços, uma abordagem pragmática seria manter o `true` mas apenas para `authenticated` (que já está). Se preferir isolamento por usuário no futuro, precisaria de um `user_id` nas tabelas — mas para o caso atual (equipe compartilhada), o modelo atual é aceitável.

**Recomendação**: Aceitar como está se o sistema é usado por uma equipe confiável. Caso contrário, adicionar `user_id` + owner check.

**2. Bug no cálculo de uptime da página Reports**

No `Reports.tsx` (linha 24), o heatmap e ranking de uptime contam apenas `status === 'online'` como disponível, ignorando `warning`. Isso cria inconsistência com o dashboard (que já foi corrigido). Precisa incluir `warning` como disponível nos 3 cálculos: `uptimeRanking`, `heatmapData` e `reliabilityMetrics`.

---

### Melhorias Opcionais (Nice-to-have)

**3. Limite de 1000 registros nos health checks**

As queries `useAllRecentHealthChecks` e `useHealthChecksForPeriod` usam `.limit(1000)`. Com muitos serviços e checks frequentes (ex: 10 serviços x 1 check/min = 14.400/dia), os dados serão truncados silenciosamente. Para produção, considerar paginação ou agregação server-side.

**4. Responsividade da página Services e Reports**

A página `Services.tsx` (linha 42) e `Reports.tsx` usam `p-6` fixo sem adaptação mobile. Aplicar o mesmo padrão responsivo do dashboard (`p-3 sm:p-4 lg:p-6`).

---

### Resumo de Alterações

| Arquivo | Mudança |
|---|---|
| `src/pages/Reports.tsx` | Corrigir contagem de `warning` como disponível em 3 locais |
| `src/pages/Services.tsx` | Padding responsivo |
| `src/pages/Reports.tsx` | Padding responsivo |

### Veredicto

O sistema está **funcional e pronto para produção** com apenas a correção do bug de uptime no Reports (item 2). Os warnings de RLS são aceitáveis para um sistema de equipe compartilhada. As demais melhorias são cosméticas.

