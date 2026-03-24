---
description: "Use when editing the Python monitoring agent (docs/monitoring-agent.py), adding endpoints, fixing metrics collection, or modifying security."
applyTo: "docs/monitoring-agent.py"
---

# Monitoring Agent (Python)

## Restrições
- **Sem dependências externas** exceto pymssql (para SQL Server)
- Usar apenas Python 3 stdlib (http.server, json, subprocess, threading, os, socket, etc.)
- Manter compatível com Python 3.8+

## Endpoints Existentes
| Método | Endpoint | Propósito |
|--------|----------|-----------|
| GET | `/health` | Status + versão + endpoints disponíveis |
| GET | `/metrics` | CPU, memória, disco, rede, uptime, load avg |
| GET | `/version` | Versão atual vs latest do GitHub |
| GET | `/processes` | Top 10 processos por CPU/memory |
| GET | `/systemctl/list` | Lista serviços systemd |
| GET | `/containers` | Lista containers Docker |
| POST | `/systemctl` | Status de serviços systemd específicos |
| POST | `/postgresql` | Métricas PostgreSQL via psycopg2/pg8000 |
| POST | `/mssql` | Métricas SQL Server via pymssql |
| POST | `/exec` | Execução segura de comandos (allowlist) |
| POST | `/update` | Self-update do agente |

## Segurança
- Token Bearer obrigatório no header `Authorization`
- IP allowlist via `--allowed-ips` (CIDR ranges)
- `/exec`: Allowlist de comandos permitidos. NUNCA adicionar rm, chmod, chown, pip, etc.
- Output de `/exec` truncado a 64KB
- Shell operators bloqueados: `&&, ||, ;, |, >, >>, $(, ${`

## Padrão de Response
```python
self.send_json({"status": "ok", "data": {...}})
# ou em caso de erro:
self.send_json({"error": "description"}, status=500)
```

## Deploy
```bash
# Remoto via SSH
./docs/deploy-agent.sh --host IP --user root --token TOKEN --port 9100

# Local
sudo bash docs/install-agent.sh --token TOKEN --port 9100

# Verificar
sudo systemctl status monitoring-agent
sudo journalctl -u monitoring-agent -f
```
