# Guía de Instalación — OKR System

> Este archivo se actualiza con cada hito completado.
> Versión actual: **Hito 12** (sistema completo, listo para producción)

---

## Índice
1. [Requisitos del servidor](#1-requisitos-del-servidor)
2. [Preparación del servidor](#2-preparación-del-servidor)
3. [Instalar Node.js y herramientas](#3-instalar-nodejs-y-herramientas)
4. [Instalar y configurar PostgreSQL](#4-instalar-y-configurar-postgresql)
5. [Instalar y configurar Redis](#5-instalar-y-configurar-redis)
6. [Copiar el proyecto al servidor](#6-copiar-el-proyecto-al-servidor)
7. [Configurar variables de entorno](#7-configurar-variables-de-entorno)
8. [Instalar dependencias del proyecto](#8-instalar-dependencias-del-proyecto)
9. [Ejecutar migraciones de base de datos](#9-ejecutar-migraciones-de-base-de-datos)
10. [Compilar el proyecto](#10-compilar-el-proyecto)
11. [Instalar y configurar PM2](#11-instalar-y-configurar-pm2)
12. [Instalar y configurar Nginx](#12-instalar-y-configurar-nginx)
13. [Configurar SSL con Let's Encrypt](#13-configurar-ssl-con-lets-encrypt)
14. [Verificar la instalación](#14-verificar-la-instalación)
15. [Comandos de mantenimiento](#15-comandos-de-mantenimiento)
16. [Actualizaciones del sistema](#16-actualizaciones-del-sistema)
17. [Backup y restauración](#17-backup-y-restauración)
18. [Solución de problemas](#18-solución-de-problemas)

---

## 1. Requisitos del servidor

### Sistema operativo recomendado
**Ubuntu 22.04 LTS** (64-bit). También funciona en Ubuntu 20.04 y Debian 12.

### Especificaciones mínimas
| Recurso | Mínimo | Recomendado |
|---------|--------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 2 GB | 4 GB |
| Disco | 20 GB SSD | 50 GB SSD |
| Red | 100 Mbps | 1 Gbps |

### Puertos que deben estar abiertos
| Puerto | Protocolo | Uso |
|--------|-----------|-----|
| 22 | TCP | SSH |
| 80 | TCP | HTTP (redirige a HTTPS) |
| 443 | TCP | HTTPS |

> Los puertos 3000, 3001, 5432 y 6379 **NO** deben estar expuestos a internet — solo se usan internamente.

### Software previo necesario en tu máquina local
- Git (para clonar/sincronizar el proyecto)
- Un cliente SSH

---

## 2. Preparación del servidor

Conéctate al servidor via SSH:
```bash
ssh usuario@IP_DEL_SERVIDOR
```

### 2.1 Actualizar el sistema
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git build-essential unzip software-properties-common
```

### 2.2 Configurar el firewall
```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

### 2.3 Crear usuario de aplicación (opcional pero recomendado)
```bash
sudo adduser okr
sudo usermod -aG sudo okr
su - okr
```

---

## 3. Instalar Node.js y herramientas

### 3.1 Instalar Node.js 20 LTS via NVM
```bash
# Instalar NVM
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Recargar el shell
source ~/.bashrc

# Instalar Node.js 20 LTS
nvm install 20
nvm use 20
nvm alias default 20

# Verificar
node --version   # debe mostrar v20.x.x
npm --version
```

### 3.2 Instalar PM2 globalmente
```bash
npm install -g pm2
pm2 --version
```

### 3.3 Configurar PM2 para arrancar con el servidor
```bash
pm2 startup
# Ejecutar el comando que PM2 muestre en pantalla (empieza con sudo env PATH=...)
```

---

## 4. Instalar y configurar PostgreSQL

### 4.1 Instalar PostgreSQL 16
```bash
# Agregar repositorio oficial de PostgreSQL
sudo sh -c 'echo "deb https://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -
sudo apt update
sudo apt install -y postgresql-16 postgresql-client-16

# Verificar
psql --version
sudo systemctl status postgresql
```

### 4.2 Crear usuario y base de datos
```bash
sudo -u postgres psql
```

Dentro de la consola de PostgreSQL:
```sql
-- Crear usuario (cambiar 'TU_PASSWORD_SEGURO' por una contraseña real)
CREATE USER okr_user WITH PASSWORD 'TU_PASSWORD_SEGURO';

-- Crear base de datos
CREATE DATABASE okr_db OWNER okr_user;

-- Permisos
GRANT ALL PRIVILEGES ON DATABASE okr_db TO okr_user;

-- Conectar a la DB y dar permisos en el schema
\c okr_db
GRANT ALL ON SCHEMA public TO okr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO okr_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO okr_user;

-- Salir
\q
```

### 4.3 Instalar extensiones necesarias
```bash
sudo -u postgres psql -d okr_db -f /ruta/al/proyecto/scripts/init-db.sql
```

### 4.4 Configurar PostgreSQL para conexiones locales
```bash
# Ver la ubicación del archivo pg_hba.conf
sudo -u postgres psql -c "SHOW hba_file;"

# Editar el archivo
sudo nano /etc/postgresql/16/main/pg_hba.conf
```

Asegurarse de que esta línea exista (para conexiones locales con contraseña):
```
local   okr_db   okr_user   md5
host    okr_db   okr_user   127.0.0.1/32   md5
```

```bash
# Reiniciar PostgreSQL para aplicar cambios
sudo systemctl restart postgresql

# Verificar conexión
psql -h localhost -U okr_user -d okr_db -c "SELECT version();"
# Pedirá la contraseña que definiste arriba
```

### 4.5 Configurar backup automático diario con cron
```bash
crontab -e
```
Agregar esta línea (backup a las 2am todos los días):
```
0 2 * * * /ruta/al/proyecto/scripts/backup.sh >> /ruta/al/proyecto/logs/backup.log 2>&1
```

---

## 5. Instalar y configurar Redis

### 5.1 Instalar Redis 7
```bash
sudo apt install -y redis-server
redis-server --version
```

### 5.2 Configurar Redis (contraseña y persistencia)
```bash
sudo nano /etc/redis/redis.conf
```

Buscar y modificar estas líneas:
```
# Cambiar 'requirepass' (descomentar y poner contraseña)
requirepass TU_REDIS_PASSWORD

# Persistencia (RDB cada 5 min si hay cambios)
save 300 1
save 60 100

# Límite de memoria
maxmemory 256mb
maxmemory-policy allkeys-lru

# Solo escuchar en localhost (no exponer a internet)
bind 127.0.0.1 ::1
```

```bash
# Reiniciar Redis
sudo systemctl restart redis
sudo systemctl enable redis

# Verificar
redis-cli -a TU_REDIS_PASSWORD ping
# Debe responder: PONG
```

---

## 6. Copiar el proyecto al servidor

### Opción A: Git (recomendado si tienes repositorio)
```bash
cd /home/okr   # o la carpeta donde quieras el proyecto
git clone https://TU_REPOSITORIO/okr-system.git estrategia
cd estrategia
```

### Opción B: SCP desde tu máquina local
Desde tu máquina local (Windows — usar Git Bash o WSL):
```bash
# Copiar la carpeta completa al servidor
scp -r D:/estrategia usuario@IP_DEL_SERVIDOR:/home/okr/estrategia
```

### Opción C: rsync (para actualizaciones incrementales)
```bash
rsync -avz --exclude node_modules --exclude .env --exclude logs/ \
  D:/estrategia/ usuario@IP_DEL_SERVIDOR:/home/okr/estrategia/
```

> Nota: Nunca copiar el `.env` local al servidor via rsync/git. Configurarlo manualmente en el servidor (paso 7).

---

## 7. Configurar variables de entorno

En el servidor, crear los archivos de entorno desde los ejemplos:
```bash
cd /home/okr/estrategia
cp .env.example .env
cp frontend/.env.example frontend/.env.local
nano .env
nano frontend/.env.local
```

### Variables obligatorias del backend (`.env`)

```env
# App
NODE_ENV=production
PORT=3020
FRONTEND_URL=https://TU_DOMINIO.COM
API_URL=https://TU_DOMINIO.COM/api
COOKIE_SECRET=$(openssl rand -hex 32)

# Base de datos
DATABASE_URL=postgresql://okr_user:TU_PASSWORD@localhost:5432/okr_db
DB_HOST=localhost
DB_PORT=5432
DB_NAME=okr_db
DB_USER=okr_user
DB_PASSWORD=TU_PASSWORD

# JWT
JWT_SECRET=$(openssl rand -hex 32)
JWT_REFRESH_SECRET=$(openssl rand -hex 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Redis
REDIS_URL=redis://:TU_REDIS_PASSWORD@localhost:6379
REDIS_PASSWORD=TU_REDIS_PASSWORD

# Anthropic AI (https://console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-TU_KEY_REAL
AI_DEFAULT_MODEL=claude-sonnet-4-6
AI_HEAVY_MODEL=claude-opus-4-7
AI_FAST_MODEL=claude-haiku-4-5-20251001
AI_MAX_TOKENS=4096
AI_RATE_LIMIT_DAILY=100

# Email — requerido para password reset e invitaciones
# Recomendado: Resend (resend.com) o SendGrid
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=TU_API_KEY_RESEND
SMTP_FROM=no-reply@TU_DOMINIO.COM
```

### Variables de Stripe — requeridas para billing (`.env`)

```env
# Obtener en https://dashboard.stripe.com/apikeys
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...   # generado al crear el webhook en Stripe
STRIPE_PRICE_PRO_MONTHLY=price_... # ID del precio mensual en Stripe Products
STRIPE_PRICE_PRO_ANNUAL=price_...  # ID del precio anual en Stripe Products
```

> El webhook de Stripe debe apuntar a: `https://TU_DOMINIO.COM/api/v1/billing/stripe/webhook`
> Eventos a suscribir: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`

### Variables opcionales pero recomendadas (`.env`)

```env
# Sentry — error tracking (https://sentry.io)
SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=...  # solo si usas source maps en CI/CD

# Telegram — alertas de agentes IA
# Crear bot en https://t.me/BotFather → /newbot
TELEGRAM_BOT_TOKEN=123456:ABC-DEF...
TELEGRAM_CHAT_ID=tu_chat_id  # obtener con @userinfobot

# Super-agent (Telegram bot interno)
# Generar: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
SUPER_AGENT_TOKEN=token_largo_generado
BACKEND_URL=http://localhost:3020
# PRIMARY_ORG_ID se completa tras crear la primera org:
#   SELECT id FROM organizations LIMIT 1;
PRIMARY_ORG_ID=uuid-de-la-org

# MercadoPago — solo si operas en LATAM
MP_ACCESS_TOKEN=APP_USR-...
```

### Variables del frontend (`frontend/.env.local`)

```env
NEXT_PUBLIC_APP_URL=https://TU_DOMINIO.COM

# Sentry frontend (proyecto Next.js en sentry.io — diferente al del backend)
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

### Generar secrets seguros
```bash
# Ejecutar una vez por variable
openssl rand -hex 32
```

### Proteger los archivos de entorno
```bash
chmod 600 .env
chmod 600 frontend/.env.local
```

---

## 8. Instalar dependencias del proyecto

```bash
cd /home/okr/estrategia

# Backend
cd backend
npm ci --only=production
npx prisma generate
cd ..

# Frontend
cd frontend
npm ci
cd ..
```

---

## 9. Ejecutar migraciones de base de datos

> **Importante**: este paso se ejecuta solo cuando hay migraciones nuevas. En la primera instalación ejecutar una sola vez.

El sistema usa migraciones SQL nativas (no Prisma). El script aplica los archivos
en `backend/src/database/migrations/` en orden y registra cuáles ya fueron aplicados
en la tabla `_sql_migrations`. Es **idempotente** — correrlo de nuevo no hace daño.

```bash
cd /home/okr/estrategia

# Aplicar todas las migraciones pendientes
bash scripts/migrate.sh apply
```

Verificar qué migraciones están aplicadas:
```bash
bash scripts/migrate.sh status
```

---

## 10. Compilar el proyecto

### Backend (NestJS)
```bash
cd /home/okr/estrategia/backend
npm run build
# Genera la carpeta dist/
```

### Frontend (Next.js)
```bash
cd /home/okr/estrategia/frontend
npm run build
# Genera la carpeta .next/
```

---

## 11. Instalar y configurar PM2

### Iniciar los servicios
```bash
cd /home/okr/estrategia
pm2 start ecosystem.config.js --env production
```

### Verificar que están corriendo
```bash
pm2 status
# Debe mostrar okr-backend y okr-frontend en estado 'online'
```

### Guardar la configuración (para sobrevivir reinicios)
```bash
pm2 save
```

### Comandos útiles de PM2
```bash
pm2 status                          # estado de todos los procesos
pm2 logs                            # ver logs en tiempo real
pm2 logs okr-backend --lines 100    # logs del backend
pm2 restart okr-backend             # reiniciar el backend
pm2 reload ecosystem.config.js      # recargar sin downtime (cluster mode)
pm2 stop all                        # detener todos
pm2 delete all                      # eliminar todos los procesos PM2
```

---

## 12. Instalar y configurar Nginx

### 12.1 Instalar Nginx
```bash
sudo apt install -y nginx
sudo systemctl status nginx
```

### 12.2 Copiar la configuración
```bash
# Backup de la configuración por defecto
sudo mv /etc/nginx/nginx.conf /etc/nginx/nginx.conf.bak

# Copiar la configuración del proyecto
sudo cp /home/okr/estrategia/nginx/nginx.conf /etc/nginx/nginx.conf
sudo cp /home/okr/estrategia/nginx/conf.d/okr.conf /etc/nginx/conf.d/okr.conf

# Eliminar el site por defecto
sudo rm -f /etc/nginx/sites-enabled/default
```

### 12.3 Configurar el dominio
Editar el archivo de configuración y reemplazar `TU_DOMINIO.COM`:
```bash
sudo nano /etc/nginx/conf.d/okr.conf
# Reemplazar todas las ocurrencias de TU_DOMINIO.COM con tu dominio real
```

### 12.4 Verificar la configuración temporalmente sin SSL
Antes de activar SSL, usar una configuración HTTP temporal para verificar que Nginx funciona:
```bash
# Comentar el bloque HTTPS y activar uno HTTP temporal para pruebas
# (después de obtener el SSL, revertir al archivo original)
sudo nginx -t       # verifica la sintaxis
sudo systemctl reload nginx
```

---

## 13. Configurar SSL con Let's Encrypt

### 13.1 Instalar Certbot
```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 13.2 Obtener el certificado
```bash
sudo certbot --nginx -d TU_DOMINIO.COM -d www.TU_DOMINIO.COM
```

Certbot pedirá:
- Email para notificaciones de renovación
- Aceptar términos de servicio
- Si redirigir HTTP → HTTPS (decir **sí**)

### 13.3 Verificar la renovación automática
```bash
# Simular renovación para verificar que funciona
sudo certbot renew --dry-run
```

Certbot configura automáticamente un cron para renovar cada 12 horas.

### 13.4 Aplicar configuración completa de Nginx
Una vez que tienes el certificado, reemplazar la configuración de Nginx con la del proyecto (que ya tiene SSL hardening):
```bash
sudo cp /home/okr/estrategia/nginx/conf.d/okr.conf /etc/nginx/conf.d/okr.conf
# Editar para poner el dominio real y la ruta del certificado
sudo nano /etc/nginx/conf.d/okr.conf
sudo nginx -t && sudo systemctl reload nginx
```

---

## 14. Verificar la instalación

### 14.1 Verificar servicios
```bash
bash /home/okr/estrategia/scripts/logs.sh status
```

### 14.2 Verificar la API
```bash
# Health check del backend
curl https://TU_DOMINIO.COM/health

# Debe responder algo como:
# {"status":"ok","database":"connected","redis":"connected"}
```

### 14.3 Verificar la web
Abrir en el navegador: `https://TU_DOMINIO.COM`

### 14.4 Verificar SSL
```bash
# Verificar que el certificado es válido
curl -I https://TU_DOMINIO.COM
# Buscar: HTTP/2 200 y Strict-Transport-Security en los headers
```

---

## 15. Comandos de mantenimiento

```bash
# Ver estado de todos los servicios
bash scripts/logs.sh status

# Ver logs en tiempo real
bash scripts/logs.sh all
bash scripts/logs.sh backend
bash scripts/logs.sh frontend
bash scripts/logs.sh nginx

# Hacer backup manual
bash scripts/backup.sh

# Reiniciar el backend
pm2 restart okr-backend

# Reiniciar el frontend
pm2 restart okr-frontend

# Reiniciar Nginx
sudo systemctl reload nginx

# Ver uso de disco
df -h

# Ver uso de memoria
free -h

# Ver procesos más pesados
htop
```

---

## 16. Actualizaciones del sistema

Cuando haya cambios en el código, usar el script de deploy:

```bash
cd /home/okr/estrategia

# Si usas Git: traer los cambios primero
git pull origin main

# Si copias manualmente: sincronizar con rsync desde tu máquina local
# rsync -avz --exclude node_modules --exclude .env --exclude logs/ \
#   D:/estrategia/ usuario@IP:/home/okr/estrategia/

# Ejecutar el deploy (hace backup, build, migraciones y reinicia PM2)
bash scripts/deploy.sh
```

El script `deploy.sh` hace automáticamente:
1. Backup de la base de datos
2. `npm ci` en backend y frontend
3. Genera el cliente Prisma
4. Ejecuta migraciones pendientes
5. Compila backend y frontend
6. Recarga PM2 sin downtime (cluster mode)
7. Verifica que los servicios respondan

---

## 17. Backup y restauración

### Backup manual
```bash
bash scripts/backup.sh
# Genera: backups/okr_db_YYYYMMDD_HHMMSS.sql.gz
```

### Ver backups disponibles
```bash
ls -lh backups/
```

### Restaurar un backup
```bash
bash scripts/restore.sh backups/okr_db_20260422_020000.sql.gz
```

> El script detiene los servicios, restaura la DB y los reinicia.

### Backup automático
El cron configurado en el paso 4.5 hace el backup automático cada noche a las 2am.
Los backups de más de 30 días se eliminan automáticamente.

---

## 18. Solución de problemas

### El backend no arranca
```bash
# Ver logs de error
pm2 logs okr-backend --err --lines 50

# Causas comunes:
# - Variables de entorno incorrectas (.env mal configurado)
# - Puerto 3020 en uso: lsof -i :3020
# - Prisma no generado: cd backend && npx prisma generate
# - Error de conexión a PostgreSQL: verificar DATABASE_URL y que postgres esté corriendo
```

### El frontend no arranca
```bash
pm2 logs okr-frontend --err --lines 50

# Causas comunes:
# - Puerto 3000 en uso: lsof -i :3000
# - Falta el build: cd frontend && npm run build
# - NEXT_PUBLIC_API_URL mal configurado
```

### Nginx no carga
```bash
sudo nginx -t                    # verificar sintaxis
sudo cat /var/log/nginx/error.log | tail -20
sudo systemctl status nginx
```

### PostgreSQL no conecta
```bash
sudo systemctl status postgresql
psql -h localhost -U okr_user -d okr_db
# Si pide contraseña y falla: revisar .env DB_PASSWORD
```

### Redis no conecta
```bash
sudo systemctl status redis
redis-cli -a TU_REDIS_PASSWORD ping
# Debe responder PONG
```

### Certificado SSL vencido
```bash
sudo certbot renew
sudo systemctl reload nginx
```

### Espacio en disco lleno
```bash
df -h
# Limpiar logs viejos
find /home/okr/estrategia/logs -name "*.log" -mtime +7 -delete
# Limpiar backups viejos (son de retención 30 días, pero puedes limpiar manualmente)
ls -lh backups/ | head -20
```

---

## Historial de actualizaciones de esta guía

| Fecha | Hito | Cambios en la instalación |
|-------|------|--------------------------|
| 2026-04-22 | Hitos 0-3 | Creación inicial: Node/PM2/PostgreSQL/Redis/Nginx/SSL |
| 2026-04-23 | Hitos 4-8 | Sin cambios en la instalación (lógica en migraciones SQL) |
| 2026-04-24 | Hitos 9-11 | Sin cambios en la instalación |
| 2026-04-24 | Hito 12 | `migrate.sh` reescrito para migraciones SQL nativas; `deploy.sh` con URL de health check correcta; logs JSON en producción; `.env.example` completo; GitHub Actions CI/CD |

---

> Cada vez que completemos un hito que afecte la instalación, se actualizará este archivo con los pasos nuevos o modificados. Ver `docs/roadmap.md` para el estado actual del proyecto.
