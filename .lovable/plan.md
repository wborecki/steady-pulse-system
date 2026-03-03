

## Melhorias Finais Antes da Produção

Após auditar todo o código, identifiquei melhorias práticas que mantêm o sistema simples e objetivo. Separei em **prioridade alta** (deve fazer) e **opcional** (nice-to-have).

### Prioridade Alta

**1. Corrigir RLS Policies (Segurança)**
O linter detectou 4 políticas com `USING (true)` / `WITH CHECK (true)` — qualquer pessoa autenticada pode inserir, atualizar e deletar dados de qualquer usuário. Precisa vincular as operações ao `auth.uid()` do usuário logado.

**2. Email real nas notificações**
O `send-notification` só faz `console.log` para email. Vou integrar com o sistema de email nativo do projeto para enviar alertas reais quando configurado.

**3. Limpeza automática de health_checks antigos**
Sem limpeza, a tabela `health_checks` cresce indefinidamente. Criar uma edge function `cleanup-old-checks` que roda periodicamente e remove registros com mais de 30 dias.

**4. Tratamento de erro no agente (retry)**
Quando o agente não responde, as edge functions falham silenciosamente. Adicionar retry simples (1 tentativa extra) nas funções `systemctl-metrics`, `container-metrics` e `server-metrics`.

### Prioridade Média

**5. Indicador de "última verificação" no dashboard**
No dashboard principal, mostrar há quanto tempo foi a última verificação global (ex: "Última verificação: 2min atrás").

**6. Validação de URL do agente no formulário**
No `AddServiceForm`, validar se a URL do agente é acessível antes de salvar (testar `/health` do agente via edge function).

### Resumo de arquivos alterados

| Arquivo | Mudança |
|---|---|
| Migration SQL | Corrigir 4 RLS policies permissivas |
| `supabase/functions/send-notification/index.ts` | Integrar envio de email real |
| `supabase/functions/cleanup-old-checks/index.ts` | Nova função de limpeza periódica |
| `supabase/functions/systemctl-metrics/index.ts` | Adicionar retry |
| `supabase/functions/container-metrics/index.ts` | Adicionar retry |
| `supabase/functions/server-metrics/index.ts` | Adicionar retry |
| `src/pages/Index.tsx` | Indicador "última verificação" |

