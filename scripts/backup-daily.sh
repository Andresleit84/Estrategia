#!/bin/bash
# Backup diario de OKR System Database — Lee configuración del .env

# Cargar variables desde .env
if [ -f /root/estrategia/backend/.env ]; then
    export $(grep -E '^BACKUP_' /root/estrategia/backend/.env | xargs)
else
    echo "ERROR: .env no encontrado"
    exit 1
fi

# Valores por defecto si no están en .env
RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-30}
BACKUP_DIR="/root/estrategia/backups"
DB_NAME="okr_db"
DB_USER="okr_user"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/okr_db_$TIMESTAMP.sql.gz"

echo "[$(date)] Iniciando backup de $DB_NAME..."
echo "[$(date)] Retención: $RETENTION_DAYS días"

# Crear directorio si no existe
mkdir -p "$BACKUP_DIR"

# Backup de la BD
sudo -u postgres pg_dump -d $DB_NAME -U $DB_USER 2>/dev/null | gzip > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date)] ✅ Backup completado: $BACKUP_FILE ($SIZE)"

    # Limpiar backups antiguos según RETENTION_DAYS
    echo "[$(date)] 🧹 Limpiando backups más antiguos de $RETENTION_DAYS días..."
    find "$BACKUP_DIR" -name "okr_db_*.sql.gz" -mtime +$RETENTION_DAYS -delete
    echo "[$(date)] ✅ Limpieza completada"
else
    echo "[$(date)] ❌ ERROR: No se pudo crear el backup"
    exit 1
fi
