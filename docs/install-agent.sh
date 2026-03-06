#!/usr/bin/env bash
# =============================================================================
# Monitoring Agent — Instalador Automático
# =============================================================================
#
# Uso (one-liner):
#   curl -fsSL https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/install-agent.sh | sudo bash -s -- --token SEU_TOKEN
#
# Opções:
#   --port PORT           Porta do agente (padrão: 9100)
#   --token TOKEN         Token de autenticação (recomendado)
#   --allowed-ips IPs     IPs/CIDRs permitidos (ex: 1.2.3.4,10.0.0.0/24)
#   --setup-ufw           Configura UFW para permitir apenas IPs listados
#   --no-docker           Não verificar Docker
#   --uninstall           Remove o agente completamente
#
# =============================================================================

set -euo pipefail

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

AGENT_PORT=9100
AGENT_TOKEN=""
AGENT_ALLOWED_IPS=""
SETUP_UFW=false
CHECK_DOCKER=true
UNINSTALL=false
INSTALL_DIR="/opt/monitoring-agent"
SERVICE_NAME="monitoring-agent"
AGENT_URL="${AGENT_URL:-https://raw.githubusercontent.com/Solutions-in-BI/steady-pulse-system/main/docs/monitoring-agent.py}"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }

# ---------------------------------------------------------------------------
# Parse args
# ---------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --port)        AGENT_PORT="$2"; shift 2 ;;
    --token)       AGENT_TOKEN="$2"; shift 2 ;;
    --allowed-ips) AGENT_ALLOWED_IPS="$2"; shift 2 ;;
    --setup-ufw)   SETUP_UFW=true; shift ;;
    --no-docker)   CHECK_DOCKER=false; shift ;;
    --uninstall)   UNINSTALL=true; shift ;;
    *) err "Opção desconhecida: $1"; exit 1 ;;
  esac
done

# ---------------------------------------------------------------------------
# Uninstall
# ---------------------------------------------------------------------------
if [ "$UNINSTALL" = true ]; then
  echo ""
  info "Removendo Monitoring Agent..."
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  systemctl disable "$SERVICE_NAME" 2>/dev/null || true
  rm -f "/etc/systemd/system/${SERVICE_NAME}.service"
  systemctl daemon-reload 2>/dev/null || true
  rm -rf "$INSTALL_DIR"
  log "Agente removido com sucesso!"
  exit 0
fi

# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------
echo ""
echo -e "${BLUE}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║       🚀 Monitoring Agent Installer          ║${NC}"
echo -e "${BLUE}╚══════════════════════════════════════════════╝${NC}"
echo ""

if [ "$(id -u)" -ne 0 ]; then
  err "Execute como root (sudo)"
  exit 1
fi

# Check Python 3
if ! command -v python3 &>/dev/null; then
  warn "Python 3 não encontrado. Instalando..."
  if command -v apt-get &>/dev/null; then
    apt-get update -qq && apt-get install -y -qq python3 >/dev/null 2>&1
  elif command -v yum &>/dev/null; then
    yum install -y python3 >/dev/null 2>&1
  elif command -v dnf &>/dev/null; then
    dnf install -y python3 >/dev/null 2>&1
  else
    err "Não foi possível instalar Python 3. Instale manualmente."
    exit 1
  fi
  log "Python 3 instalado"
else
  log "Python 3 encontrado: $(python3 --version)"
fi

# Check Docker (optional)
if [ "$CHECK_DOCKER" = true ]; then
  if command -v docker &>/dev/null; then
    log "Docker encontrado: $(docker --version | head -c 40)"
    if [ -S /var/run/docker.sock ]; then
      log "Docker socket disponível"
      # Check socket permissions
      if [ -r /var/run/docker.sock ]; then
        log "Docker socket é legível"
      else
        warn "Docker socket sem permissão de leitura. Corrigindo..."
        chmod 666 /var/run/docker.sock 2>/dev/null || warn "Não foi possível alterar permissões do Docker socket. Execute: sudo chmod 666 /var/run/docker.sock"
      fi
    else
      warn "Docker socket não encontrado em /var/run/docker.sock"
    fi
  else
    warn "Docker não encontrado — endpoint /containers não retornará dados"
  fi
fi

# ---------------------------------------------------------------------------
# Install
# ---------------------------------------------------------------------------
info "Instalando em ${INSTALL_DIR}..."
mkdir -p "$INSTALL_DIR"

# Download agent
info "Baixando agente..."
if command -v curl &>/dev/null; then
  curl -fsSL "$AGENT_URL" -o "${INSTALL_DIR}/monitoring-agent.py"
elif command -v wget &>/dev/null; then
  wget -q "$AGENT_URL" -O "${INSTALL_DIR}/monitoring-agent.py"
else
  err "curl ou wget necessário"
  exit 1
fi
chmod +x "${INSTALL_DIR}/monitoring-agent.py"
log "Agente baixado"

# ---------------------------------------------------------------------------
# Systemd service
# ---------------------------------------------------------------------------
info "Configurando serviço systemd..."

ENV_LINE=""
if [ -n "$AGENT_TOKEN" ]; then
  ENV_LINE="Environment=AGENT_TOKEN=${AGENT_TOKEN}"
fi

ENV_LINE_IPS=""
if [ -n "$AGENT_ALLOWED_IPS" ]; then
  ENV_LINE_IPS="Environment=AGENT_ALLOWED_IPS=${AGENT_ALLOWED_IPS}"
fi

cat > "/etc/systemd/system/${SERVICE_NAME}.service" << EOF
[Unit]
Description=Monitoring Agent (porta ${AGENT_PORT})
Documentation=https://github.com/Solutions-in-BI/steady-pulse-system
After=network-online.target docker.service
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 ${INSTALL_DIR}/monitoring-agent.py --port ${AGENT_PORT}
${ENV_LINE}
${ENV_LINE_IPS}
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
SyslogIdentifier=${SERVICE_NAME}

# Security hardening
NoNewPrivileges=true
ProtectSystem=strict
ReadWritePaths=${INSTALL_DIR}
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
systemctl restart "$SERVICE_NAME"

# Wait and check
sleep 2
if systemctl is-active --quiet "$SERVICE_NAME"; then
  log "Serviço iniciado com sucesso!"
else
  err "Falha ao iniciar o serviço. Verifique: journalctl -u ${SERVICE_NAME} -n 20"
  exit 1
fi

# ---------------------------------------------------------------------------
# Verify
# ---------------------------------------------------------------------------
info "Verificando agente..."
sleep 1

HEALTH_URL="http://127.0.0.1:${AGENT_PORT}/health"
CURL_OPTS=(-s --max-time 5)
if [ -n "$AGENT_TOKEN" ]; then
  CURL_OPTS+=(-H "Authorization: Bearer ${AGENT_TOKEN}")
fi

if HEALTH_RESPONSE=$(curl "${CURL_OPTS[@]}" "$HEALTH_URL" 2>/dev/null); then
  log "Health check OK: ${HEALTH_RESPONSE}"
else
  warn "Health check falhou — o agente pode precisar de mais tempo para iniciar"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Monitoring Agent instalado com sucesso!${NC}"
echo -e "${GREEN}══════════════════════════════════════════════${NC}"
echo ""
echo -e "  📍 Endereço:  ${BLUE}http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SEU_IP'):${AGENT_PORT}${NC}"
echo -e "  📁 Diretório: ${INSTALL_DIR}"
echo -e "  🔧 Serviço:   systemctl status ${SERVICE_NAME}"
echo -e "  📋 Logs:      journalctl -u ${SERVICE_NAME} -f"
if [ -n "$AGENT_TOKEN" ]; then
  echo -e "  🔒 Token:     configurado"
else
  echo -e "  ⚠️  Token:     ${YELLOW}não configurado (recomendado para produção)${NC}"
fi
if [ -n "$AGENT_ALLOWED_IPS" ]; then
  echo -e "  🛡️  IPs:       ${AGENT_ALLOWED_IPS}"
fi
echo ""

# ---------------------------------------------------------------------------
# UFW Firewall (optional)
# ---------------------------------------------------------------------------
if [ "$SETUP_UFW" = true ]; then
  if command -v ufw &>/dev/null; then
    info "Configurando UFW firewall..."
    # Allow SSH first to not lock ourselves out
    ufw allow ssh >/dev/null 2>&1 || true

    if [ -n "$AGENT_ALLOWED_IPS" ]; then
      # Allow each IP/CIDR to the agent port
      IFS=',' read -ra IP_ARRAY <<< "$AGENT_ALLOWED_IPS"
      for ip in "${IP_ARRAY[@]}"; do
        ip=$(echo "$ip" | xargs)  # trim
        ufw allow from "$ip" to any port "$AGENT_PORT" proto tcp >/dev/null 2>&1
        log "UFW: permitido ${ip} -> porta ${AGENT_PORT}"
      done
      # Also allow localhost
      ufw allow from 127.0.0.1 to any port "$AGENT_PORT" proto tcp >/dev/null 2>&1
      # Deny all other access to agent port
      ufw deny "$AGENT_PORT" >/dev/null 2>&1
      log "UFW: bloqueado acesso geral à porta ${AGENT_PORT}"
    else
      warn "--allowed-ips não definido. UFW não restringirá a porta ${AGENT_PORT}."
      warn "Uso: --allowed-ips 1.2.3.4,5.6.7.8 --setup-ufw"
    fi

    # Enable UFW if not already
    ufw --force enable >/dev/null 2>&1
    log "UFW ativado"
    ufw status | grep "$AGENT_PORT" || true
  else
    warn "UFW não encontrado. Instale com: apt install ufw"
  fi
fi

echo -e "  ${BLUE}Endpoints disponíveis:${NC}"
echo -e "    GET  /health      — Status do agente"
echo -e "    POST /systemctl   — Status de serviços systemd"
echo -e "    GET  /containers  — Status dos containers Docker"
echo -e "    GET  /metrics     — Métricas do servidor (CPU, RAM, disco)"
echo ""
echo -e "  ${BLUE}Na plataforma, configure:${NC}"
echo -e "    URL do Agente: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo 'SEU_IP'):${AGENT_PORT}"
echo ""
echo -e "  ${BLUE}Comandos úteis:${NC}"
echo -e "    sudo systemctl restart ${SERVICE_NAME}  — Reiniciar"
echo -e "    sudo systemctl stop ${SERVICE_NAME}     — Parar"
echo -e "    curl -fsSL ... | sudo bash -s -- --uninstall  — Remover"
echo ""
