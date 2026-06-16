#!/bin/bash
# ================================================================
# logs.sh — Ver logs del sistema
# Uso: bash scripts/logs.sh [backend|frontend|nginx|all]
# ================================================================

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVICE="${1:-all}"

case "$SERVICE" in
  backend)
    pm2 logs okr-backend --lines 100
    ;;
  frontend)
    pm2 logs okr-frontend --lines 100
    ;;
  nginx)
    sudo tail -f /var/log/nginx/access.log /var/log/nginx/error.log
    ;;
  db)
    sudo journalctl -u postgresql -f
    ;;
  all)
    pm2 logs --lines 50
    ;;
  status)
    echo "=== PM2 STATUS ==="
    pm2 status
    echo ""
    echo "=== POSTGRES ==="
    sudo systemctl status postgresql --no-pager
    echo ""
    echo "=== REDIS ==="
    sudo systemctl status redis --no-pager
    echo ""
    echo "=== NGINX ==="
    sudo systemctl status nginx --no-pager
    ;;
  *)
    echo "Uso: bash scripts/logs.sh [backend|frontend|nginx|db|all|status]"
    ;;
esac
