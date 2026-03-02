

## Plano: Agente Unificado — Uma Instalação, Tudo Funcionando

### O Problema
Node Exporter cobre systemctl, cAdvisor cobre containers — são dois processos separados. O usuário quer instalar **um único agente** e ter tudo.

### Solução: Manter o Agente Customizado como Solução Principal

O `monitoring-agent.py` que já criamos **já faz tudo em um único processo** — systemctl E containers. Ele é a solução mais simples. O que falta é torná-lo mais robusto e a plataforma mais inteligente.

### O que será feito

#### 1. Melhorar o Agente (`docs/monitoring-agent.py`)
- Adicionar endpoint **`/metrics`** com métricas do servidor (CPU, RAM, disco, load average)
- Melhorar coleta de containers com restart count e created time
- Adicionar **auto-discovery** de containers (não precisa listar manualmente)

#### 2. Unificar na Plataforma (`AddServiceForm.tsx`)
- Remover distinção entre "Systemctl" e "Container" no formulário quando usar o agente customizado
- Um único campo: **URL do Agente** + **Token** — a plataforma consulta `/systemctl`, `/containers` e `/metrics` automaticamente
- Manter opção de Node Exporter / cAdvisor como alternativa avançada

#### 3. Edge Functions Inteligentes
- `systemctl-metrics` e `container-metrics` consultam o **mesmo agente** na mesma URL, apenas endpoints diferentes
- Adicionar nova edge function **`server-metrics`** que consulta `/metrics` para CPU/RAM/disco do host

#### 4. Script de Instalação (`docs/install-agent.sh`)
- Já existe e instala tudo em um comando
- Atualizar para verificar permissões do Docker socket automaticamente
- Resultado: `curl ... | sudo bash -s -- --token MEU_TOKEN` → agente rodando com systemctl + containers + métricas do host

### Arquivos modificados
| Arquivo | Mudança |
|---|---|
| `docs/monitoring-agent.py` | Adicionar `/metrics` (CPU, RAM, disco, load) |
| `docs/install-agent.sh` | Verificar Docker socket permissions |
| `src/components/monitoring/AddServiceForm.tsx` | Simplificar UI — um agente, tudo incluso |
| `supabase/functions/server-metrics/index.ts` | Nova edge function para métricas do host |

### Resumo
O usuário instala **um script**, configura **uma URL** na plataforma, e tudo funciona: systemctl, containers e métricas do servidor.

