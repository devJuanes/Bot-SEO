#!/usr/bin/env bash
# Deploy script para MatuByte Growth Factory.
# Uso: ./deploy.sh
#
# Requiere: bash, git, node >=18, npm. Opcional: pm2 (recomendado).
# El .env debe existir en el server antes del primer deploy.

set -euo pipefail

# ---------- Config ----------
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="matubyte-growth-factory"
LOG_DIR="${APP_DIR}/logs"
DEPLOY_LOG="${LOG_DIR}/deploy.log"

mkdir -p "${LOG_DIR}"

# ---------- Helpers ----------
log() {
  local msg="[$(date -u +'%Y-%m-%dT%H:%M:%SZ')] $*"
  echo "${msg}"
  echo "${msg}" >> "${DEPLOY_LOG}"
}

fail() {
  log "ERROR: $*"
  exit 1
}

# ---------- Pre-flight ----------
cd "${APP_DIR}"

[ -f package.json ] || fail "No se encontró package.json en ${APP_DIR}"

if [ ! -f .env ]; then
  fail ".env no existe. Cópialo antes de hacer deploy (cp .env.example .env && editar)."
fi

log "=== Deploy iniciado en ${APP_DIR} ==="

# ---------- Git pull ----------
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
log "Rama actual: ${CURRENT_BRANCH}"

if [ -n "$(git status --porcelain)" ] && [ "${ALLOW_DIRTY:-}" != "1" ]; then
  fail "Hay cambios sin commitear. Haz commit o stash antes de deployar (o ALLOW_DIRTY=1)."
fi

log "git pull origin ${CURRENT_BRANCH}"
git pull --ff-only origin "${CURRENT_BRANCH}" >> "${DEPLOY_LOG}" 2>&1 \
  || fail "git pull falló. Revisa conflictos o permisos."

NEW_COMMIT="$(git rev-parse --short HEAD)"
log "Commit desplegado: ${NEW_COMMIT}"

# ---------- Deps ----------
# tsc vive en devDependencies, así que necesitamos instalar todo para buildear.
# Después del build podamos las dev deps para no contaminar producción.
log "npm ci (full, incluye devDependencies para tsc)"
npm ci >> "${DEPLOY_LOG}" 2>&1 \
  || fail "npm ci falló. Revisa ${DEPLOY_LOG}."

# Safety net: si tsc sigue sin estar, instalamos typescript global.
if ! command -v npx >/dev/null 2>&1 || ! npx --no-install tsc --version >/dev/null 2>&1; then
  log "WARN: tsc no quedó en node_modules/.bin — instalando typescript global"
  npm install -g typescript >> "${DEPLOY_LOG}" 2>&1 \
    || log "WARN: no se pudo instalar typescript global (continúa)"
fi

# ---------- Build ----------
log "npm run build (tsc)"
npm run build >> "${DEPLOY_LOG}" 2>&1 \
  || fail "tsc falló. Revisa ${DEPLOY_LOG}."

log "npm run build:ui (vite)"
npm run build:ui >> "${DEPLOY_LOG}" 2>&1 \
  || fail "build:ui falló. Revisa ${DEPLOY_LOG}."

# Ahora sí podemos podar dev deps (ya tenemos dist/ y frontend/dist/)
log "npm prune --omit=dev"
npm prune --omit=dev >> "${DEPLOY_LOG}" 2>&1 || true

# ---------- Migrate ----------
if grep -q '"migrate"' package.json; then
  log "npm run migrate"
  npm run migrate >> "${DEPLOY_LOG}" 2>&1 \
    || log "WARN: migrate falló (continúa — puede ser no crítico)"
fi

# ---------- Restart ----------
restart_with_pm2() {
  if [ -f ecosystem.config.cjs ] || [ -f ecosystem.config.js ]; then
    log "pm2 reload ecosystem"
    pm2 reload ecosystem  >> "${DEPLOY_LOG}" 2>&1
  elif pm2 list | grep -q "${APP_NAME}"; then
    log "pm2 reload ${APP_NAME}"
    pm2 reload "${APP_NAME}" >> "${DEPLOY_LOG}" 2>&1
  else
    log "pm2 start ${APP_NAME}"
    pm2 start npm --name "${APP_NAME}" -- start >> "${DEPLOY_LOG}" 2>&1
  fi
  pm2 save >> "${DEPLOY_LOG}" 2>&1 || true
}

restart_with_nohup() {
  log "Reiniciando con nohup (pm2 no disponible)"
  pkill -f "node dist/index.js" || true
  sleep 2
  nohup node dist/index.js >> "${LOG_DIR}/app.log" 2>&1 &
  disown
}

if command -v pm2 >/dev/null 2>&1; then
  restart_with_pm2
  pm2 status "${APP_NAME}" || true
else
  restart_with_nohup
fi

# ---------- Health check ----------
sleep 3
PORT="$(grep -E '^PORT=' .env | cut -d'=' -f2 | tr -d '[:space:]')"
PORT="${PORT:-4100}"

if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
  log "OK · health check responde en :${PORT}/health"
else
  log "WARN: /health no responde todavía. Revisa ${LOG_DIR}/app.log"
fi

log "=== Deploy completado: ${NEW_COMMIT} ==="