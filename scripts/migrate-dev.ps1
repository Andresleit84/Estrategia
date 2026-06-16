# migrate-dev.ps1 — Aplica migraciones pendientes a Estrategia_dev
# Requiere usuario postgres (superuser) para crear tablas y vistas.
# Uso: .\scripts\migrate-dev.ps1

param(
  [string]$PgPassword = ""
)

$ROOT      = Split-Path -Parent $MyInvocation.MyCommand.Path | Split-Path -Parent
$MIGRATIONS = "$ROOT\backend\src\database\migrations"
$DB        = "Estrategia_dev"
$PG_USER   = "postgres"
$PG_HOST   = "localhost"
$PG_PORT   = "5432"

if (-not $PgPassword) {
  $secure = Read-Host "Contraseña del usuario postgres" -AsSecureString
  $BSTR = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
  $PgPassword = [Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)
}

$env:PGPASSWORD = $PgPassword

function Run-Sql($sql) {
  $result = & psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $DB -c $sql 2>&1
  return $result
}

# Crear tabla de registro si no existe
Run-Sql @"
CREATE TABLE IF NOT EXISTS _sql_migrations (
  id         SERIAL PRIMARY KEY,
  filename   VARCHAR(255) NOT NULL UNIQUE,
  applied_at TIMESTAMPTZ  DEFAULT NOW()
);
"@ | Out-Null

Write-Host "`nAplicando migraciones a $DB ...`n"

$applied = 0
$skipped = 0

Get-ChildItem "$MIGRATIONS\*.sql" | Sort-Object Name | ForEach-Object {
  $file = $_.FullName
  $name = $_.Name

  $count = (& psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $DB -t -c "SELECT COUNT(*) FROM _sql_migrations WHERE filename = '$name';" 2>&1).Trim()

  if ($count -eq "0") {
    Write-Host "  Aplicando: $name" -NoNewline
    $out = & psql -h $PG_HOST -p $PG_PORT -U $PG_USER -d $DB -f $file 2>&1
    if ($LASTEXITCODE -eq 0) {
      Run-Sql "INSERT INTO _sql_migrations (filename) VALUES ('$name');" | Out-Null
      Write-Host " ✓" -ForegroundColor Green
      $applied++
    } else {
      Write-Host " ✗" -ForegroundColor Red
      Write-Host $out -ForegroundColor DarkRed
    }
  } else {
    $skipped++
  }
}

$env:PGPASSWORD = ""
Write-Host "`nCompletado: $applied aplicadas, $skipped ya existían.`n"
