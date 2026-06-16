# Guía de Recuperación tras Formatear C:
> **Para quién**: cualquier persona que necesite volver a dejar el sistema funcionando después de formatear la unidad C:
> **Tiempo estimado**: 30–45 minutos
> **Dificultad**: paso a paso, sin conocimientos previos necesarios

---

## Lo primero que debes saber

Tenemos DOS unidades de disco:

| Unidad | Qué contiene | ¿Se pierde al formatear C:? |
|--------|-------------|------------------------------|
| **C:** | Programas instalados (Node.js, PostgreSQL, Redis, Git) | ✅ Sí, pero se reinstalan |
| **D:** | El código (`D:\estrategia`) y **la base de datos** (`D:\Algory\Base`) | ❌ **No se pierde nada** |

**La base de datos está en D:. Todos los datos están seguros.**
Al formatear C: solo perdemos los programas, que se reinstalan en 30 minutos.

---

## Mapa de lo que hay que reinstalar

```
1. Git              → para clonar/gestionar el código
2. Node.js 22       → motor que corre el backend y frontend
3. PostgreSQL 16    → motor de base de datos (los datos ya están en D:\Algory\Base)
4. Redis            → caché (datos temporales, no críticos)
5. PM2              → gestor de procesos (se instala con npm)
6. Dependencias     → npm install en backend y frontend
```

---

## PASO 1 — Descargar los instaladores (hazlo ANTES de formatear)

Guarda estos archivos en `D:\instaladores\` para tenerlos disponibles después del formateo:

| Programa | Versión exacta | Dónde descargar |
|----------|---------------|-----------------|
| **Git** | 2.53 o superior | https://git-scm.com/download/win → "64-bit Git for Windows Setup" |
| **Node.js** | **22 LTS** (22.x.x) | https://nodejs.org → botón "LTS" → Windows Installer (.msi) |
| **PostgreSQL** | **16.x** (¡importante: versión 16, no 17 ni 18!) | https://www.enterprisedb.com/downloads/postgres-postgresql-downloads → Windows x86-64, versión 16 |
| **Redis** | 3.0.504 | https://github.com/MicrosoftArchive/redis/releases → Redis-x64-3.0.504.msi |

---

## PASO 2 — Instalar Git

1. Ejecutar `Git-2.xx-64-bit.exe`
2. Siguiente → Siguiente → Siguiente (opciones por defecto)
3. Al final, abrir **PowerShell** y verificar:
   ```powershell
   git --version
   # Debe mostrar: git version 2.x.x.windows.x
   ```

---

## PASO 3 — Instalar Node.js 22

1. Ejecutar el instalador `.msi` de Node.js
2. Siguiente → Siguiente → Siguiente (opciones por defecto)
3. **Importante**: cuando pregunte si instalar herramientas adicionales (Chocolatey/build tools), marcar esa casilla y aceptar
4. Verificar en PowerShell:
   ```powershell
   node --version    # Debe mostrar: v22.x.x
   npm --version     # Debe mostrar: 10.x.x o superior
   ```

---

## PASO 4 — Instalar PostgreSQL 16

Este es el paso más importante. Hay que instalar PostgreSQL 16 y luego apuntarlo a la base de datos existente en `D:\Algory\Base`.

### 4a. Ejecutar el instalador

1. Ejecutar `postgresql-16.x-windows-x64.exe`
2. Cuando pregunte el **directorio de datos** ("Data Directory"), escribir exactamente:
   ```
   C:\Program Files\PostgreSQL\16\data_temp
   ```
   *(ponemos una carpeta temporal porque vamos a cambiarlo después)*
3. Cuando pida contraseña para el usuario `postgres`, usar: `postgres` (o cualquiera que recuerdes — no la vamos a usar)
4. Puerto: `5432` (dejar el que viene por defecto)
5. Completar la instalación. Cuando ofrezca abrir Stack Builder al final, **desmarcar y cerrar**.

### 4b. Apuntar el servicio a la base de datos real

Ahora hay que decirle a PostgreSQL que use `D:\Algory\Base` en lugar de la carpeta temporal.

Abrir **PowerShell como Administrador** (clic derecho en el menú inicio → "Windows PowerShell (Administrador)"):

```powershell
# 1. Detener el servicio de PostgreSQL
Stop-Service -Name "postgresql-x64-16"

# 2. Cambiar el data directory en el servicio de Windows
sc.exe config "postgresql-x64-16" binpath= `"C:\Program Files\PostgreSQL\16\bin\pg_ctl.exe`" runservice -N `"postgresql-x64-16`" -D `"D:\Algory\Base`" -w`"

# 3. Iniciar el servicio
Start-Service -Name "postgresql-x64-16"

# 4. Verificar que arrancó correctamente
Get-Service -Name "postgresql-x64-16"
# Debe mostrar: Status = Running
```

### 4c. Verificar que la base de datos está accesible

```powershell
$env:PGPASSWORD = "4KS2N1sF7eMacfnYkoAQLpRV"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U okr_user -d Estrategia -c "\l"
# Debe mostrar la lista de bases de datos incluyendo Estrategia y Estrategia_dev
```

Si ves la lista de bases de datos: **¡los datos están intactos!** ✅

### 4d. Agregar PostgreSQL al PATH del sistema

Para poder usar `psql` y `pg_dump` desde cualquier terminal:

1. Abrir **Panel de control** → Sistema → Configuración avanzada del sistema → Variables de entorno
2. En "Variables del sistema" buscar `Path` → Editar
3. Agregar nueva línea: `C:\Program Files\PostgreSQL\16\bin`
4. Aceptar todo y cerrar PowerShell
5. Abrir PowerShell nuevo y verificar:
   ```powershell
   psql --version
   # Debe mostrar: psql (PostgreSQL) 16.x
   ```

---

## PASO 5 — Instalar Redis

1. Ejecutar `Redis-x64-3.0.504.msi`
2. Siguiente → Siguiente → en la pantalla de configuración del servicio, dejar el puerto `6379`
3. Completar instalación
4. Verificar en PowerShell:
   ```powershell
   Get-Service Redis
   # Debe mostrar: Status = Running
   ```

Redis no requiere contraseña — funciona directamente.

---

## PASO 6 — Instalar PM2 y herramientas globales

Abrir PowerShell y ejecutar:

```powershell
npm install -g pm2@6.0.14
```

Verificar:
```powershell
pm2 --version
# Debe mostrar: 6.0.14
```

---

## PASO 7 — Reinstalar dependencias del proyecto

El código ya está en `D:\estrategia`. Solo hay que instalar las dependencias de Node.js (que viven en `node_modules` dentro de C:... espera, en realidad están en D:\estrategia\backend\node_modules y D:\estrategia\frontend\node_modules — también están en D:, pero los reinstalamos por seguridad).

```powershell
# Backend
cd D:\estrategia\backend
npm install

# Frontend
cd D:\estrategia\frontend
npm install
```

Esto puede tardar 2–5 minutos cada uno. Es normal que aparezcan mensajes en pantalla.

---

## PASO 8 — Arrancar el sistema

```powershell
cd D:\estrategia
& ".\start-dev.ps1"
```

Esperar ~40 segundos. Al final debe mostrar:
```
Backend health: {"status":"ok","checks":{"database":"ok","redis":"ok"}}
Sistema dev en http://localhost:3001
```

Abrir el navegador en **http://localhost:3001** e iniciar sesión con:
- Email: `andres.enrique@sendoagil.com`
- Contraseña: `Dev2026#Ok`

---

## Verificación final — checklist

Marcar cada punto antes de considerar la recuperación completa:

- [ ] `node --version` muestra v22.x.x
- [ ] `psql --version` muestra PostgreSQL 16
- [ ] `Get-Service postgresql-x64-16` muestra Running
- [ ] `Get-Service Redis` muestra Running
- [ ] `pm2 --version` muestra 6.0.14
- [ ] El health check muestra `"database":"ok","redis":"ok"`
- [ ] Se puede iniciar sesión en http://localhost:3001
- [ ] Los ciclos OKR, objetivos y check-ins están visibles (confirma que los datos de D:\Algory\Base están intactos)

---

## Si algo sale mal

### PostgreSQL no arranca

```powershell
# Ver el log de errores
Get-Content "D:\Algory\Base\log\*.log" -Tail 30
```

El error más común es que la versión de PostgreSQL instalada no coincide con los datos. La solución es instalar exactamente **PostgreSQL 16** (no 15, no 17).

### "Password authentication failed" al conectar

Verificar que el archivo `D:\estrategia\.env` tiene la contraseña correcta:
```
DB_PASSWORD=4KS2N1sF7eMacfnYkoAQLpRV
```

### El frontend no carga

```powershell
pm2 logs okr-frontend-dev --lines 50
```

Generalmente se resuelve con `npm install` en `D:\estrategia\frontend`.

### La cuenta está bloqueada al iniciar sesión

```powershell
$env:PGPASSWORD = "4KS2N1sF7eMacfnYkoAQLpRV"
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U okr_user -d Estrategia_dev -c "DELETE FROM login_attempts WHERE email = 'andres.enrique@sendoagil.com';"
```

---

## Referencia rápida — credenciales y puertos

| Qué | Valor |
|-----|-------|
| URL dev | http://localhost:3001 |
| URL API dev | http://localhost:3021 |
| DB dev | Estrategia_dev |
| DB prod | Estrategia |
| Usuario DB | okr_user |
| Contraseña DB | `4KS2N1sF7eMacfnYkoAQLpRV` |
| Puerto PostgreSQL | 5432 |
| Puerto Redis | 6379 (sin contraseña) |
| Data dir PostgreSQL | `D:\Algory\Base` |
| Código | `D:\estrategia\` |

---

## Datos importantes para NO perder

Antes de formatear, revisar que estos archivos estén en D: (ya lo están, pero confirmar):

```powershell
Test-Path "D:\estrategia\.env"         # True
Test-Path "D:\estrategia\.env.dev"     # True
Test-Path "D:\Algory\Base\PG_VERSION"  # True → base de datos intacta
```

Si los tres son `True`, puedes formatear C: con total tranquilidad.
