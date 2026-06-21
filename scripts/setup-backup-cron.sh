#!/bin/bash
# Configura el cron dinámicamente basado en .env

if [ -f /root/estrategia/backend/.env ]; then
    export $(grep -E '^BACKUP_' /root/estrategia/backend/.env | xargs)
fi

HOUR=${BACKUP_HOUR:-2}
MINUTE=${BACKUP_MINUTE:-0}
CRON_TIME="$MINUTE $HOUR * * *"

echo "Configurando cron para backup: $CRON_TIME"

# Remover cron anterior si existe
crontab -l 2>/dev/null | grep -v "backup-daily.sh" | crontab - 2>/dev/null

# Agregar nuevo cron
(crontab -l 2>/dev/null; echo "$CRON_TIME /root/estrategia/scripts/backup-daily.sh >> /root/estrategia/logs/backup.log 2>&1") | crontab -

echo "✅ Cron configurado"
crontab -l | grep backup-daily
