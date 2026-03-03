

## Status do MonitorHub — O que já está pronto e o que falta

### Já corrigido nesta sessão
- **ServiceRow labels contextuais** — Pool/DAG para Airflow, Conn/Cache para PostgreSQL, etc.
- **Reports alinhamento** — tabelas MTTR/MTBF e ranking corrigidas
- **Limpeza do banco** — só Airflow Solutions in BI permanece

### O que ainda falta (do plano original)

```text
#   ITEM                                    STATUS      ESFORÇO
────────────────────────────────────────────────────────────────
4   Label "Colapsar" na sidebar             ✅ FEITO     —
5   Empty state guiado em Services          PENDENTE    ~15 min
6   Confirmação ao deletar threshold        PENDENTE    ~10 min
8   Responsividade header ServiceDetail     PENDENTE    ~10 min
2   Email real (send-notification)          PENDENTE    ~30 min
3   URL placeholder no install-agent.sh     PENDENTE    ~5 min
7   Dark/Light mode toggle                  ✅ FEITO     —
```

Olhando o screenshot, os itens 4 (Colapsar) e 7 (Modo Claro) já estão implementados.

### Pendentes reais — 3 melhorias de UX

1. **Empty state na página Serviços** — quando não há serviços (ou todos filtrados), mostrar ícone + botão "Adicionar primeiro serviço" em vez de texto seco.

2. **Confirmação ao deletar threshold** — no `ThresholdConfigPanel.tsx`, envolver o botão de excluir com um `AlertDialog` pedindo confirmação antes de remover.

3. **Header responsivo no ServiceDetail** — os botões (Manutenção, Editar, Excluir, Verificar) empilham mal em mobile. Mudar para `flex-col` em telas pequenas.

### Pendentes opcionais (infra/backend)

4. **URL do install-agent.sh** — substituir placeholder `SEU_REPO` pela URL real do repositório publicado.

5. **Email real no send-notification** — atualmente só faz `console.log`. Precisa integrar um serviço de email (pode ser feito com o domínio de email do projeto).

### Resumo

O sistema está **funcional e entregável**. Os 3 itens pendentes de UX são melhorias de polish, não bloqueiam uso em produção. O email e o script do agente são melhorias de infraestrutura que podem ser feitas depois.

Se quiser, posso implementar os 3 itens de UX (empty state + confirmação threshold + header mobile) em um batch rápido.

