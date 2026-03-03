#!/usr/bin/env bash
###############################################################################
# deploy-frontend.sh — Build & deploy Monitor Hub to the Contabo server
#
# Usage:
#   chmod +x docs/deploy-frontend.sh
#   ./docs/deploy-frontend.sh
#
# What it does:
#   1. Builds the Vite React app locally (npm run build)
#   2. Uploads the dist/ folder to the server via rsync/scp
#   3. Installs Nginx on the server (if not installed)
#   4. Configures Nginx to serve the SPA on port 80
#   5. Opens port 80 on UFW
#   6. Validates the deployment
###############################################################################
set -euo pipefail

# ── Config ───────────────────────────────────────────────────────────────────
SERVER_IP="212.47.72.193"
SERVER_USER="root"
SERVER_PASS="Legaltrade1!"
DEPLOY_DIR="/var/www/monitorhub"
NGINX_CONF="/etc/nginx/sites-available/monitorhub"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log()  { echo -e "${CYAN}[DEPLOY]${NC} $*"; }
ok()   { echo -e "${GREEN}[  OK  ]${NC} $*"; }
warn() { echo -e "${YELLOW}[ WARN ]${NC} $*"; }
fail() { echo -e "${RED}[FALHA ]${NC} $*"; exit 1; }

# ── Helpers ──────────────────────────────────────────────────────────────────
ssh_cmd() {
  sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no "$SERVER_USER@$SERVER_IP" "$@"
}

rsync_upload() {
  sshpass -p "$SERVER_PASS" rsync -avz --delete \
    -e "ssh -o StrictHostKeyChecking=no" \
    "$1" "$SERVER_USER@$SERVER_IP:$2"
}

# ── Check dependencies ──────────────────────────────────────────────────────
log "Verificando dependências locais..."
for cmd in node npm sshpass rsync; do
  if ! command -v "$cmd" &>/dev/null; then
    if [[ "$cmd" == "sshpass" ]]; then
      log "Instalando sshpass..."
      sudo apt-get install -y sshpass || fail "Não foi possível instalar sshpass"
    elif [[ "$cmd" == "rsync" ]]; then
      log "Instalando rsync..."
      sudo apt-get install -y rsync || fail "Não foi possível instalar rsync"
    else
      fail "Comando '$cmd' não encontrado. Instale antes de continuar."
    fi
  fi
done
ok "Dependências locais OK"

# ── Step 1: Build ────────────────────────────────────────────────────────────
log "═══════════════════════════════════════════════════════"
log "  STEP 1/5 — Build do projeto"
log "═══════════════════════════════════════════════════════"

cd "$PROJECT_DIR"

# Ensure .env exists
if [[ ! -f .env ]]; then
  fail ".env não encontrado. Crie o arquivo com VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY"
fi

log "Instalando dependências..."
npm install --legacy-peer-deps 2>&1 | tail -3

log "Executando build de produção..."
npm run build 2>&1 | tail -5

if [[ ! -d dist ]]; then
  fail "Build falhou — pasta dist/ não encontrada"
fi

BUILD_SIZE=$(du -sh dist | cut -f1)
ok "Build concluído: $BUILD_SIZE"

# ── Step 2: Upload ───────────────────────────────────────────────────────────
log "═══════════════════════════════════════════════════════"
log "  STEP 2/5 — Upload para o servidor"
log "═══════════════════════════════════════════════════════"

log "Criando diretório no servidor..."
ssh_cmd "mkdir -p $DEPLOY_DIR"

log "Enviando arquivos via rsync..."
rsync_upload "dist/" "$DEPLOY_DIR/"

ok "Upload concluído para $SERVER_IP:$DEPLOY_DIR"

# ── Step 3: Instalar Nginx ───────────────────────────────────────────────────
log "═══════════════════════════════════════════════════════"
log "  STEP 3/5 — Configurar Nginx"
log "═══════════════════════════════════════════════════════"

ssh_cmd bash <<'REMOTE_SCRIPT'
set -e

# Install Nginx if not present
if ! command -v nginx &>/dev/null; then
  echo "[REMOTE] Instalando Nginx..."
  apt-get update -qq
  apt-get install -y -qq nginx
fi

echo "[REMOTE] Nginx $(nginx -v 2>&1 | grep -oP '[\d.]+')"

# Create Nginx config for SPA
cat > /etc/nginx/sites-available/monitorhub <<'NGINX_CONF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /var/www/monitorhub;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/javascript
        application/javascript
        application/json
        application/xml
        image/svg+xml;

    # Cache static assets aggressively (Vite hashed filenames)
    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Cache other static files
    location ~* \.(ico|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)$ {
        expires 30d;
        add_header Cache-Control "public";
        try_files $uri =404;
    }

    # SPA fallback — all routes go to index.html
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Deny access to hidden files
    location ~ /\. {
        deny all;
        return 404;
    }
}
NGINX_CONF

# Enable site
ln -sf /etc/nginx/sites-available/monitorhub /etc/nginx/sites-enabled/monitorhub

# Remove default site if it conflicts
if [[ -f /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
  echo "[REMOTE] Removido site default do Nginx"
fi

# Test config
nginx -t 2>&1

# Reload Nginx
systemctl enable nginx
systemctl restart nginx

echo "[REMOTE] Nginx configurado e reiniciado"
REMOTE_SCRIPT

ok "Nginx configurado"

# ── Step 4: Firewall ─────────────────────────────────────────────────────────
log "═══════════════════════════════════════════════════════"
log "  STEP 4/5 — Firewall (UFW)"
log "═══════════════════════════════════════════════════════"

ssh_cmd bash <<'REMOTE_FW'
set -e
if command -v ufw &>/dev/null; then
  ufw allow 80/tcp comment "HTTP - Monitor Hub" 2>/dev/null || true
  ufw allow 443/tcp comment "HTTPS - Monitor Hub" 2>/dev/null || true
  echo "[REMOTE] Portas 80 e 443 abertas no UFW"
  ufw status | grep -E '80|443'
else
  echo "[REMOTE] UFW não encontrado, pulando firewall"
fi
REMOTE_FW

ok "Firewall configurado"

# ── Step 5: Validação ────────────────────────────────────────────────────────
log "═══════════════════════════════════════════════════════"
log "  STEP 5/5 — Validação"
log "═══════════════════════════════════════════════════════"

sleep 2

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$SERVER_IP/" --max-time 10 || echo "000")

if [[ "$HTTP_CODE" == "200" ]]; then
  ok "Monitor Hub acessível!"
else
  warn "HTTP $HTTP_CODE — pode levar alguns segundos para ficar disponível"
fi

# Check that it returns HTML with our app
BODY=$(curl -s "http://$SERVER_IP/" --max-time 10 || echo "")
if echo "$BODY" | grep -q "Monitor Hub"; then
  ok "Conteúdo HTML validado — 'Monitor Hub' encontrado"
else
  warn "Corpo da resposta não contém 'Monitor Hub'"
fi

echo ""
log "═══════════════════════════════════════════════════════"
ok "  DEPLOY CONCLUÍDO!"
log "═══════════════════════════════════════════════════════"
echo ""
echo -e "  ${GREEN}➜${NC}  Acesse: ${CYAN}http://$SERVER_IP${NC}"
echo -e "  ${GREEN}➜${NC}  Login:  ${CYAN}admin@monitorhub.com${NC} / ${CYAN}Admin123!${NC}"
echo ""
echo -e "  ${YELLOW}Comandos úteis no servidor:${NC}"
echo -e "    Logs Nginx:    journalctl -u nginx -f"
echo -e "    Status:        systemctl status nginx"
echo -e "    Re-deploy:     ./docs/deploy-frontend.sh"
echo ""
