#!/bin/bash
# ================================================================
# backup.sh — Backup de PostgreSQL
# Uso: bash scripts/backup.sh
# Los backups se guardan en backups/ con timestamp
# Retención: últimos 30 días
# ================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$PROJECT_DIR/backups"
DATE=$(date '+%Y%m%d_%H%M%S')
BACKUP_FILE="$BACKUP_DIR/okr_db_$DATE.sql.gz"

# Cargar variables de entorno
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a
  source "$PROJECT_DIR/.env"
  set +a
fi

mkdir -p "$BACKUP_DIR"

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Iniciando backup → $BACKUP_FILE"

PGPASSWORD="$DB_PASSWORD" pg_dump \
  -h "${DB_HOST:-localhost}" \
  -p "${DB_PORT:-5432}" \
  -U "$DB_USER" \
  -d "$DB_NAME" \
  --no-owner \
  --no-acl \
  | gzip > "$BACKUP_FILE"

SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backup completado: $BACKUP_FILE ($SIZE)"

# Eliminar backups de más de 30 días
find "$BACKUP_DIR" -name "okr_db_*.sql.gz" -mtime +30 -delete
REMAINING=$(find "$BACKUP_DIR" -name "okr_db_*.sql.gz" | wc -l)
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Backups retenidos: $REMAINING"
