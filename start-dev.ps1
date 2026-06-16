# start-dev.ps1
# Levanta backend (puerto 3021, DB Estrategia_dev) y frontend (puerto 3001)
# Usa PM2 con ecosystem.dev.config.js (nest start --watch + hot-reload)

param()

$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

# Asegurar directorio de logs
New-Item -ItemType Directory -Force -Path "$ROOT\logs" | Out-Null

# Detener instancias dev previas (ignorar error si no existian)
Push-Location $ROOT
pm2 delete okr-backend-dev  2>&1 | Out-Null
pm2 delete okr-frontend-dev 2>&1 | Out-Null

# Iniciar con PM2
pm2 start ecosystem.dev.config.js
Pop-Location

# Esperar hasta que el backend responda (maximo 120s — nest --watch compila ~40s)
Write-Host 'Esperando arranque (nest --watch compila TypeScript, puede tardar ~40s)...'
$ready    = $false
$deadline = (Get-Date).AddSeconds(120)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Seconds 3
    $health = try {
        (Invoke-WebRequest -Uri 'http://localhost:3021/api/v1/health' `
            -UseBasicParsing -TimeoutSec 3).Content
    } catch { $null }
    if ($health) {
        Write-Host "Backend health: $health"
        $ready = $true
        break
    }
}

if (-not $ready) {
    Write-Host 'AVISO: backend aun no responde — puede seguir iniciando'
    Write-Host '  pm2 logs okr-backend-dev   (ver que pasa)'
} else {
    # Backend confirmado: correr smoke tests de estabilidad
    Write-Host ''
    & "$ROOT\scripts\smoke-test.ps1" -BaseUrl "http://localhost:3021"
    if ($LASTEXITCODE -ne 0) {
        Write-Host '  AVISO: hay tests fallando — revisar output arriba antes de presentar' -ForegroundColor Red
    }
}

Write-Host ''
Write-Host "Sistema dev en http://localhost:3001"
Write-Host '  pm2 logs              -- logs en vivo (Ctrl+C para salir de logs sin detener)'
Write-Host '  pm2 stop all          -- detener todo'
Write-Host '  pm2 restart all       -- reiniciar ambos'
Write-Host "  pm2 logs okr-backend-dev --lines 50  -- ultimas 50 lineas backend"
Write-Host '  .\scripts\smoke-test.ps1             -- re-correr tests manualmente'
