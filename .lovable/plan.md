

## Plano: Criar agente de monitoramento para servidor

### Situacao atual
Toda a infraestrutura do lado da plataforma ja esta pronta: edge functions (`systemctl-metrics`, `container-metrics`), formularios de configuracao, e dashboards contextuais. Falta apenas o **agente HTTP** que roda no servidor do usuario.

### O que sera criado

Um unico arquivo Python (`monitoring-agent.py`) que sera adicionado ao repositorio como referencia/documentacao. O agente:

1. **Servidor HTTP leve** na porta 9100 (configuravel)
2. **Endpoint `/systemctl`** (POST) — recebe lista de servicos, retorna status via `systemctl show`
   - Coleta: `active_state`, `sub_state`, `MainPID`, `MemoryCurrent`, `ActiveEnterTimestamp`
   - Formato: `{ units: [{ name, active_state, sub_state, pid, memory_bytes, uptime_seconds }] }`
3. **Endpoint `/containers`** (GET) — consulta Docker via socket Unix (`/var/run/docker.sock`)
   - Coleta: `docker stats --no-stream` + `docker inspect` para cada container
   - Formato: `{ containers: [{ name, image, status, state, health, cpu_percent, memory_percent, memory_mb, network_in_mb, network_out_mb }] }`
4. **Endpoint `/health`** (GET) — health check do proprio agente
5. **Seguranca**: token de autenticacao opcional via header ou env var

### Arquivo
- `docs/monitoring-agent.py` — script Python standalone, sem dependencias externas (usa apenas stdlib + subprocess + docker socket)

### Mudancas na plataforma
- Atualizar `SystemctlFields` e `ContainerFields` no `AddServiceForm.tsx` com instrucoes mais detalhadas de como instalar o agente, incluindo o comando para baixar e rodar
- Atualizar edge functions para enviar token de autenticacao se configurado no `check_config`

