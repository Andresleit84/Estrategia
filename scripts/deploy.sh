#!/bin/bash
# ================================================================
# deploy.sh — Actualizar el sistema OKR en el servidor
# Uso: bash scripts/deploy.sh
# ================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_FILE="$PROJECT_DIR/logs/deploy.log"
mkdir -p "$PROJECT_DIR/logs"
DATE=$(date '+%Y-%m-%d %H:%M:%S')

log() { echo "[$DATE] $1" | tee -a "$LOG_FILE"; }

log "=== INICIANDO DEPLOY ==="
cd "$PROJECT_DIR"

# Cargar .env para disponer de variables
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

# 1. Verificar que no hay cambios locales sin guardar
if [[ -n $(git status --porcelain 2>/dev/null) ]]; then
  log "ADVERTENCIA: Hay cambios locales no commiteados."
fi

# 2. Backup de la base de datos antes de cualquier cambio
log "Haciendo backup de la base de datos..."
bash "$PROJECT_DIR/scripts/backup.sh"

# 3. Aplicar migraciones SQL pendientes
log "Aplicando migraciones de base de datos..."
bash "$PROJECT_DIR/scripts/migrate.sh" apply

# 4. Instalar dependencias y compilar backend
log "Instalando dependencias del backend..."
cd "$PROJECT_DIR/backend"
npm ci --omit=dev
npx prisma generate

log "Compilando backend..."
npm run build

# 5. Instalar dependencias y compilar frontend
log "Instalando dependencias del frontend..."
cd "$PROJECT_DIR/frontend"
npm ci

log "Compilando frontend..."
npm run build

# 6. Reiniciar procesos con PM2 (zero-downtime con cluster mode)
log "Reiniciando servicios con PM2..."
cd "$PROJECT_DIR"
pm2 reload ecosystem.config.js --env production

# 7. Verificar salud de los servicios
log "Verificando salud de los servicios..."
sleep 5

BACKEND_PORT="${PORT:-3020}"
if curl -sf "http://localhost:${BACKEND_PORT}/api/v1/health" > /dev/null; then
  log "Backend: OK"
else
  log "ERROR: Backend no responde. Revisar logs/backend-error.log"
  exit 1
fi

if curl -sf "http://localhost:3000" > /dev/null; then
  log "Frontend: OK"
else
  log "ERROR: Frontend no responde. Revisar logs/frontend-error.log"
  exit 1
fi

log "=== DEPLOY COMPLETADO ==="

# 8. Post-deploy check completo (siempre exit 0, notifica por Telegram)
log "Ejecutando post-deploy check..."
node "$PROJECT_DIR/scripts/post-deploy-check.js" || true
