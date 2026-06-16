#!/bin/bash
# ================================================================
# restore.sh — Restaurar backup de PostgreSQL
# Uso: bash scripts/restore.sh backups/okr_db_20260422_020000.sql.gz
# ================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_FILE="${1:-}"

if [[ -z "$BACKUP_FILE" ]]; then
  echo "ERROR: Debes indicar el archivo de backup."
  echo "Uso: bash scripts/restore.sh backups/okr_db_YYYYMMDD_HHMMSS.sql.gz"
  echo ""
  echo "Backups disponibles:"
  ls -lh "$PROJECT_DIR/backups/"*.sql.gz 2>/dev/null || echo "  (ninguno)"
  exit 1
fi

# Cargar variables de entorno
set -a; source "$PROJECT_DIR/.env"; set +a

echo "ADVERTENCIA: Esto sobreescribirá la base de datos '$DB_NAME'."
read -r -p "¿Continuar? (escribe 'SI' para confirmar): " CONFIRM
[[ "$CONFIRM" != "SI" ]] && { echo "Cancelado."; exit 0; }

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deteniendo servicios..."
pm2 stop okr-backend okr-frontend 2>/dev/null || true

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restaurando desde $BACKUP_FILE..."
PGPASSWORD="$DB_PASSWORD" psql \
  -h "${DB_HOST:-localhost}" \
  -p "${DB_PORT:-5432}" \
  -U "$DB_USER" \
  -d postgres \
  -c "DROP DATABASE IF EXISTS ${DB_NAME}; CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"

gunzip -c "$BACKUP_FILE" | PGPASSWORD="$DB_PASSWORD" psql \
  -h "${DB_HOST:-localhost}" \
  -p "${DB_PORT:-5432}" \
  -U "$DB_USER" \
  -d "$DB_NAME"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauración completada."

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Reiniciando servicios..."
pm2 start ecosystem.config.js --env production

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Restauración exitosa."
