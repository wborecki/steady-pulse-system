#!/usr/bin/env bash
# =============================================================================
# Deploy Monitoring Agent — Instala o agente em qualquer servidor via SSH
# =============================================================================
#
# Uso:
#   ./deploy-agent.sh --host IP_OU_HOSTNAME --user root
#   ./deploy-agent.sh --host 10.0.0.5 --user ubuntu --port 9100 --token meutoken
#   ./deploy-agent.sh --host 10.0.0.5 --user root --uninstall
#
# O script:
#   1. Conecta via SSH no servidor
#   2. Copia o agente (monitoring-agent.py)
#   3. Roda o instalador (install-agent.sh)
#   4. Abre a porta no firewall (ufw/firewalld)
#   5. Valida a conexão externamente
#   6. Mostra as credenciais para configurar na plataforma
#
# Requisitos locais: ssh, scp (sshpass opcional para login com senha)
# Requisitos remoto: Python 3 (instalado automaticamente se ausente)
#
# =============================================================================

set -euo pipefail

# ── Cores ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# ── Defaults ─────────────────────────────────────────────────────────────────
REMOTE_HOST=""
REMOTE_USER="root"
REMOTE_PORT=22
AGENT_PORT=9100
AGENT_TOKEN=""
AUTO_TOKEN=true
OPEN_FIREWALL=true
NO_DOCKER=false
UNINSTALL=false
SSH_KEY=""
SSH_PASSWORD=""
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

log()   { echo -e "${GREEN}[✓]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
err()   { echo -e "${RED}[✗]${NC} $1"; }
info()  { echo -e "${BLUE}[i]${NC} $1"; }
header(){ echo -e "${CYAN}${BOLD}$1${NC}"; }

usage() {
  cat << 'EOF'
Uso: deploy-agent.sh [opções]

Opções obrigatórias:
  --host HOST          IP ou hostname do servidor

Opções de conexão:
  --user USER          Usuário SSH (padrão: root)
  --ssh-port PORT      Porta SSH (padrão: 22)
  --key FILE           Chave SSH privada
  --password PASS      Senha SSH (requer sshpass instalado)

Opções do agente:
  --port PORT          Porta do agente (padrão: 9100)
  --token TOKEN        Token de autenticação (auto-gerado se omitido)
  --no-docker          Não verificar Docker
  --no-firewall        Não abrir porta no firewall automaticamente

Ações:
  --uninstall          Remove o agente do servidor
  --help               Mostra esta ajuda

Exemplos:
  ./deploy-agent.sh --host 10.0.0.5 --user root
  ./deploy-agent.sh --host 10.0.0.5 --user ubuntu --key ~/.ssh/id_rsa
  ./deploy-agent.sh --host 10.0.0.5 --password 'minhasenha' --token abc123
  ./deploy-agent.sh --host 10.0.0.5 --uninstall
EOF
  exit 0
}

# ── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    --host)        REMOTE_HOST="$2"; shift 2 ;;
    --user)        REMOTE_USER="$2"; shift 2 ;;
    --ssh-port)    REMOTE_PORT="$2"; shift 2 ;;
    --key)         SSH_KEY="$2"; shift 2 ;;
    --password)    SSH_PASSWORD="$2"; shift 2 ;;
    --port)        AGENT_PORT="$2"; shift 2 ;;
    --token)       AGENT_TOKEN="$2"; AUTO_TOKEN=false; shift 2 ;;
    --no-docker)   NO_DOCKER=true; shift ;;
    --no-firewall) OPEN_FIREWALL=false; shift ;;
    --uninstall)   UNINSTALL=true; shift ;;
    --help|-h)     usage ;;
    *)             err "Opção desconhecida: $1"; echo "Use --help para ver opções."; exit 1 ;;
  esac
done

# ── Validação ────────────────────────────────────────────────────────────────
if [ -z "$REMOTE_HOST" ]; then
  err "Informe o servidor com --host IP_OU_HOSTNAME"
  echo "Use --help para ver todas as opções."
  exit 1
fi

# ── Gerar token se necessário ────────────────────────────────────────────────
if [ "$AUTO_TOKEN" = true ] && [ "$UNINSTALL" = false ]; then
  AGENT_TOKEN=$(openssl rand -hex 32 2>/dev/null || python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || head -c 64 /dev/urandom | od -An -tx1 | tr -d ' \n')
  info "Token gerado automaticamente"
fi

# ── Montar comando SSH ───────────────────────────────────────────────────────
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15 -o ServerAliveInterval=30 -p ${REMOTE_PORT}"
SCP_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=15 -P ${REMOTE_PORT}"

if [ -n "$SSH_KEY" ]; then
  SSH_OPTS+=" -i ${SSH_KEY}"
  SCP_OPTS+=" -i ${SSH_KEY}"
fi

ssh_cmd() {
  if [ -n "$SSH_PASSWORD" ]; then
    if ! command -v sshpass &>/dev/null; then
      err "sshpass não encontrado. Instale com: sudo apt install sshpass"
      err "Ou use --key para autenticação por chave SSH."
      exit 1
    fi
    sshpass -p "$SSH_PASSWORD" ssh $SSH_OPTS "${REMOTE_USER}@${REMOTE_HOST}" "$@"
  else
    ssh $SSH_OPTS "${REMOTE_USER}@${REMOTE_HOST}" "$@"
  fi
}

scp_cmd() {
  if [ -n "$SSH_PASSWORD" ]; then
    sshpass -p "$SSH_PASSWORD" scp $SCP_OPTS "$@"
  else
    scp $SCP_OPTS "$@"
  fi
}

# ── Banner ───────────────────────────────────────────────────────────────────
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════════╗${NC}"
if [ "$UNINSTALL" = true ]; then
  echo -e "${CYAN}║   🗑️  Monitoring Agent — Remoção Remota                ║${NC}"
else
  echo -e "${CYAN}║   🚀 Monitoring Agent — Deploy Remoto                 ║${NC}"
fi
echo -e "${CYAN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Servidor:  ${BOLD}${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}${NC}"
if [ "$UNINSTALL" = false ]; then
  echo -e "  Porta:     ${BOLD}${AGENT_PORT}${NC}"
  echo -e "  Token:     ${BOLD}$([ -n "$AGENT_TOKEN" ] && echo "configurado" || echo "sem token")${NC}"
fi
echo ""

# ── Testar conexão ───────────────────────────────────────────────────────────
header "1/$([ "$UNINSTALL" = true ] && echo 3 || echo 5) Testando conexão SSH..."
if ! ssh_cmd "echo OK" &>/dev/null; then
  err "Falha na conexão SSH com ${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_PORT}"
  err "Verifique IP, usuário, senha/chave e se a porta SSH está aberta."
  exit 1
fi
log "Conexão SSH OK"

SERVER_INFO=$(ssh_cmd "echo \$(hostname) - \$(uname -s) \$(uname -r) - Python \$(python3 --version 2>/dev/null | cut -d' ' -f2 || echo 'não instalado')" 2>/dev/null || echo "info indisponível")
info "Servidor: ${SERVER_INFO}"

# ── Desinstalar ──────────────────────────────────────────────────────────────
if [ "$UNINSTALL" = true ]; then
  header "2/3 Removendo agente..."
  ssh_cmd "
    systemctl stop monitoring-agent 2>/dev/null || true
    systemctl disable monitoring-agent 2>/dev/null || true
    rm -f /etc/systemd/system/monitoring-agent.service
    systemctl daemon-reload 2>/dev/null || true
    rm -rf /opt/monitoring-agent
  "
  log "Agente removido do servidor"

  header "3/3 Fechando porta no firewall..."
  ssh_cmd "
    if command -v ufw &>/dev/null && ufw status | grep -q 'active'; then
      ufw delete allow 9100/tcp 2>/dev/null || true
      echo 'UFW: regra removida'
    elif command -v firewall-cmd &>/dev/null; then
      firewall-cmd --permanent --remove-port=9100/tcp 2>/dev/null || true
      firewall-cmd --reload 2>/dev/null || true
      echo 'firewalld: regra removida'
    else
      echo 'Nenhum firewall detectado'
    fi
  " 2>/dev/null || true
  log "Firewall atualizado"

  echo ""
  echo -e "${GREEN}══════════════════════════════════════════════${NC}"
  echo -e "${GREEN}  ✅ Agente removido de ${REMOTE_HOST}${NC}"
  echo -e "${GREEN}══════════════════════════════════════════════${NC}"
  echo ""
  exit 0
fi

# ── Copiar arquivos ──────────────────────────────────────────────────────────
header "2/5 Enviando arquivos para o servidor..."

# Determinar caminhos dos arquivos
AGENT_PY="${SCRIPT_DIR}/monitoring-agent.py"
INSTALL_SH="${SCRIPT_DIR}/install-agent.sh"

if [ ! -f "$AGENT_PY" ]; then
  # Tentar caminho relativo
  AGENT_PY="$(pwd)/docs/monitoring-agent.py"
fi
if [ ! -f "$INSTALL_SH" ]; then
  INSTALL_SH="$(pwd)/docs/install-agent.sh"
fi

if [ ! -f "$AGENT_PY" ] || [ ! -f "$INSTALL_SH" ]; then
  err "Arquivos não encontrados. Execute a partir do diretório do projeto ou de docs/"
  err "  Esperado: monitoring-agent.py e install-agent.sh"
  exit 1
fi

scp_cmd "$AGENT_PY" "$INSTALL_SH" "${REMOTE_USER}@${REMOTE_HOST}:/tmp/"
log "Arquivos enviados"

# ── Instalar ─────────────────────────────────────────────────────────────────
header "3/5 Instalando agente..."

INSTALL_ARGS="--port ${AGENT_PORT}"
if [ -n "$AGENT_TOKEN" ]; then
  INSTALL_ARGS+=" --token ${AGENT_TOKEN}"
fi
if [ "$NO_DOCKER" = true ]; then
  INSTALL_ARGS+=" --no-docker"
fi

ssh_cmd "AGENT_URL=file:///tmp/monitoring-agent.py bash /tmp/install-agent.sh ${INSTALL_ARGS}"
log "Instalação concluída"

# ── Firewall ─────────────────────────────────────────────────────────────────
if [ "$OPEN_FIREWALL" = true ]; then
  header "4/5 Configurando firewall..."
  FIREWALL_RESULT=$(ssh_cmd "
    if command -v ufw &>/dev/null && ufw status | grep -q 'active'; then
      if ufw status | grep -q '${AGENT_PORT}/tcp.*ALLOW'; then
        echo 'ALREADY_OPEN'
      else
        ufw allow ${AGENT_PORT}/tcp >/dev/null 2>&1
        echo 'UFW_OPENED'
      fi
    elif command -v firewall-cmd &>/dev/null; then
      if firewall-cmd --query-port=${AGENT_PORT}/tcp 2>/dev/null; then
        echo 'ALREADY_OPEN'
      else
        firewall-cmd --permanent --add-port=${AGENT_PORT}/tcp >/dev/null 2>&1
        firewall-cmd --reload >/dev/null 2>&1
        echo 'FIREWALLD_OPENED'
      fi
    else
      echo 'NO_FIREWALL'
    fi
  " 2>/dev/null || echo "UNKNOWN")

  case "$FIREWALL_RESULT" in
    *ALREADY_OPEN*)  log "Porta ${AGENT_PORT} já estava aberta" ;;
    *UFW_OPENED*)    log "Porta ${AGENT_PORT} aberta no UFW" ;;
    *FIREWALLD_OPENED*) log "Porta ${AGENT_PORT} aberta no firewalld" ;;
    *NO_FIREWALL*)   warn "Nenhum firewall detectado — porta provavelmente já acessível" ;;
    *)               warn "Não foi possível verificar firewall — abra a porta ${AGENT_PORT}/tcp manualmente" ;;
  esac
else
  info "Firewall: skipped (--no-firewall)"
fi

# ── Validar conexão externa ──────────────────────────────────────────────────
header "5/5 Validando conexão externa..."
sleep 2

CURL_OPTS=(-s --max-time 10)
if [ -n "$AGENT_TOKEN" ]; then
  CURL_OPTS+=(-H "Authorization: Bearer ${AGENT_TOKEN}")
fi

EXTERNAL_URL="http://${REMOTE_HOST}:${AGENT_PORT}"
if HEALTH=$(curl "${CURL_OPTS[@]}" "${EXTERNAL_URL}/health" 2>/dev/null); then
  log "Agente acessível externamente!"
  info "Health: ${HEALTH}"
else
  warn "Agente não acessível externamente em ${EXTERNAL_URL}"
  warn "Possíveis causas:"
  warn "  - Firewall do provedor cloud (Security Group / NSG) bloqueando a porta"
  warn "  - NAT ou proxy intermediário"
  warn "  - O agente ainda está iniciando"
  warn ""
  warn "O agente está funcionando internamente no servidor."
  warn "Verifique o firewall do provedor e tente: curl ${EXTERNAL_URL}/health"
fi

# ── Resultado final ──────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}  ✅ Deploy concluído — ${REMOTE_HOST}${NC}"
echo -e "${GREEN}════════════════════════════════════════════════════════════${NC}"
echo ""
echo -e "  ${BOLD}Configuração para a plataforma Steady Pulse:${NC}"
echo ""
echo -e "    Agent URL:  ${CYAN}http://${REMOTE_HOST}:${AGENT_PORT}${NC}"
if [ -n "$AGENT_TOKEN" ]; then
  echo -e "    Token:      ${CYAN}${AGENT_TOKEN}${NC}"
fi
echo ""
echo -e "  ${BOLD}Comandos úteis (no servidor):${NC}"
echo ""
echo -e "    Status:     ssh ${REMOTE_USER}@${REMOTE_HOST} 'systemctl status monitoring-agent'"
echo -e "    Reiniciar:  ssh ${REMOTE_USER}@${REMOTE_HOST} 'systemctl restart monitoring-agent'"
echo -e "    Logs:       ssh ${REMOTE_USER}@${REMOTE_HOST} 'journalctl -u monitoring-agent -f'"
echo -e "    Remover:    ./deploy-agent.sh --host ${REMOTE_HOST} --uninstall"
echo ""
