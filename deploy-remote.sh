#!/usr/bin/env bash
# Sincroniza el proyecto al VPS y ejecuta deploy.sh remoto.
# Uso: ./deploy-remote.sh
#       DEPLOY_HOST=root@otro-servidor ./deploy-remote.sh
#
# Requiere: ssh, rsync, clave en ~/.ssh/botseo_vps (Git Bash en Windows)

set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REMOTE_DIR="${DEPLOY_REMOTE_DIR:-/root/apps/Bot-SEO}"
DEPLOY_HOST="${DEPLOY_HOST:-root@matubyte.com}"
SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/botseo_vps}"

SSH_OPTS=(-o StrictHostKeyChecking=accept-new)
if [ -f "${SSH_KEY}" ]; then
  SSH_OPTS+=(-i "${SSH_KEY}")
fi

echo "==> Sincronizando a ${DEPLOY_HOST}:${REMOTE_DIR}"
rsync -avz --delete \
  --exclude node_modules \
  --exclude .git \
  --exclude logs \
  --exclude frontend/dist \
  --exclude dist \
  --exclude .env \
  "${SSH_OPTS[@]}" \
  "${APP_DIR}/" "${DEPLOY_HOST}:${REMOTE_DIR}/"

echo "==> Ejecutando deploy en el servidor"
ssh "${SSH_OPTS[@]}" "${DEPLOY_HOST}" "cd '${REMOTE_DIR}' && SYNC_FROM_ORIGIN=1 bash deploy.sh"

echo "==> Listo. Prueba: https://growth.matubyte.com/health"
