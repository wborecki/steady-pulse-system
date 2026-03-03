

## Auto-Discovery de Serviços no Agente

A sua ideia é excelente. O agente já faz auto-discovery de containers Docker (`/containers` lista tudo automaticamente), mas para systemctl ele precisa dos nomes. A solução é:

### Abordagem: Botão "Descobrir Serviços" no formulário

**1. Novo endpoint no agente Python (`/systemctl/list`)**
- Lista todos os serviços systemd habilitados/ativos automaticamente via `systemctl list-units --type=service --state=running`
- Retorna array com nomes dos serviços encontrados

**2. Nova edge function `discover-services`**
- Recebe `agent_url` + `token`, chama `/systemctl/list` e `/containers` no agente
- Retorna lista unificada de serviços systemctl e containers Docker encontrados

**3. UX no formulário `AddServiceForm`**
- Ao selecionar tipo Systemctl ou Container e preencher a URL do agente, aparece um botão **"Descobrir Serviços"**
- Ao clicar, chama a edge function que consulta o agente
- Exibe lista com checkboxes dos serviços encontrados (ex: `nginx.service`, `postgresql.service`, `docker.service`)
- O usuário marca quais quer monitorar — sem precisar digitar nada

### Sobre a arquitetura (servidor único vs separado)

A abordagem atual (separar) é a correta para produção. Motivos:
- Cada serviço tem seus próprios thresholds, alertas e histórico independente
- Ferramentas como Datadog, Zabbix e Grafana fazem exatamente assim
- Um "servidor" como entrada única misturaria métricas de coisas diferentes (nginx vs postgresql) num único gráfico

O que podemos fazer é adicionar um **atalho de cadastro em lote**: ao descobrir 5 serviços no agente, o usuário seleciona quais quer e cria todos de uma vez, cada um como entrada separada mas compartilhando a mesma `agent_url`.

### Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `docs/monitoring-agent.py` | Novo endpoint `GET /systemctl/list` |
| `supabase/functions/discover-services/index.ts` | Nova edge function para proxy de discovery |
| `src/components/monitoring/AddServiceForm.tsx` | Botão "Descobrir" + checkboxes de seleção |

