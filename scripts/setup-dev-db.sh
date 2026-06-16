#!/bin/bash
# Crea la base de datos de desarrollo y aplica todas las migraciones.
# Uso: bash scripts/setup-dev-db.sh
#
# Requiere psql en PATH. En Windows con PostgreSQL instalado:
#   export PATH="$PATH:/c/Program Files/PostgreSQL/17/bin"

set -e

DB_USER="postgres"
DB_PASS="Andres"
DB_HOST="localhost"
DB_PORT="5432"
DB_NAME="Estrategia_dev"
MIGRATIONS_DIR="$(dirname "$0")/../backend/src/database/migrations"

export PGPASSWORD="$DB_PASS"

echo "==> Creando base de datos '$DB_NAME'..."
psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -c \
  "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null \
  && echo "    Base de datos creada." \
  || echo "    Ya existe, continuando."

echo "==> Aplicando migraciones en orden..."
for f in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  echo "    -> $(basename $f)"
  psql -U "$DB_USER" -h "$DB_HOST" -p "$DB_PORT" -d "$DB_NAME" -f "$f" -q
done

echo ""
echo "Dev DB lista: postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "Para iniciar el ambiente de desarrollo:"
echo "  pm2 start ecosystem.dev.config.js"
echo "  Backend dev: http://localhost:3021/api/v1"
echo "  Frontend dev: http://localhost:3001"
