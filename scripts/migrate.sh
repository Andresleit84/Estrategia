#!/bin/bash
# ================================================================
# migrate.sh — Aplicar migraciones SQL al servidor
# Uso: bash scripts/migrate.sh [apply|status]
#
# Las migraciones son archivos .sql en backend/src/database/migrations/
# Se aplican en orden alfabético. Se usa la tabla _sql_migrations para
# registrar cuáles ya fueron aplicados (idempotente).
# ================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODE="${1:-apply}"
MIGRATIONS_DIR="$PROJECT_DIR/backend/src/database/migrations"

# Cargar variables de entorno
if [[ -f "$PROJECT_DIR/.env" ]]; then
  set -a; source "$PROJECT_DIR/.env"; set +a
fi

PG_OPTS="-h ${DB_HOST:-localhost} -p ${DB_PORT:-5432} -U ${DB_USER} -d ${DB_NAME}"

psql_run() {
  PGPASSWORD="$DB_PASSWORD" psql $PG_OPTS "$@"
}

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"; }

case "$MODE" in
  apply)
    log "Verificando tabla de registro de migraciones..."
    psql_run -c "
      CREATE TABLE IF NOT EXISTS _sql_migrations (
        id          SERIAL PRIMARY KEY,
        filename    VARCHAR(255) NOT NULL UNIQUE,
        applied_at  TIMESTAMPTZ  DEFAULT NOW()
      );
    " -q

    log "Buscando migraciones en $MIGRATIONS_DIR ..."
    APPLIED=0
    SKIPPED=0

    for migration_file in $(ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort); do
      filename=$(basename "$migration_file")
      already_applied=$(psql_run -t -c "SELECT COUNT(*) FROM _sql_migrations WHERE filename = '$filename';" | tr -d ' ')

      if [[ "$already_applied" == "0" ]]; then
        log "Aplicando: $filename"
        psql_run -f "$migration_file" -q
        psql_run -c "INSERT INTO _sql_migrations (filename) VALUES ('$filename') ON CONFLICT (filename) DO NOTHING;" -q
        log "OK: $filename"
        APPLIED=$((APPLIED + 1))
      else
        SKIPPED=$((SKIPPED + 1))
      fi
    done

    log "Completado: $APPLIED aplicadas, $SKIPPED ya existían."
    ;;

  status)
    psql_run -c "
      SELECT filename, applied_at
        FROM _sql_migrations
       ORDER BY applied_at;
    " 2>/dev/null || echo "La tabla _sql_migrations no existe todavía."

    echo ""
    echo "Archivos en $MIGRATIONS_DIR:"
    ls "$MIGRATIONS_DIR"/*.sql 2>/dev/null | sort | while read -r f; do
      echo "  $(basename "$f")"
    done
    ;;

  *)
    echo "Uso: bash scripts/migrate.sh [apply|status]"
    exit 1
    ;;
esac
