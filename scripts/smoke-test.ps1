# =============================================================================
# smoke-test.ps1 -- OKR System: Smoke Test de Estabilidad
# Cubre todos los modulos y WOW moments (C1-C5, K1-K5)
# Se ejecuta automaticamente desde start-dev.ps1 tras cada arranque
#
# Uso standalone:
#   .\scripts\smoke-test.ps1
#   .\scripts\smoke-test.ps1 -BaseUrl http://localhost:3021
#   .\scripts\smoke-test.ps1 -Email mi@correo.com -Password "mipass"
# =============================================================================
param(
    [string]$BaseUrl  = "http://localhost:3021",
    [string]$Email    = "maria.gonzalez@demo.com",
    [string]$Password = "Demo2026#"
)

# IDs fijos del seed demo (Caja Morelia)
$ORG    = "a682b4f2-c4ba-4beb-af0a-caa8005f3de7"
$CYC_Q2 = "1b95fbef-9f8a-4247-8564-1577de49a5ee"
$CYC_Q1 = "138cec9f-7b40-4f0d-83be-315a3a2093e2"
$OBJ_CO = "b2000001-0000-4000-a000-000000000001"
$OBJ_Q1 = "b1000001-0000-4000-a000-000000000001"
$KR_AT  = "c2000002-0000-4000-a000-000000000001"
$KR_BH  = "c2000006-0000-4000-a000-000000000001"
$KR_Q1  = "c1000001-0000-4000-a000-000000000001"
$INI    = "a4000001-0000-4000-a000-000000000001"
$SPR    = "a6000001-0000-4000-a000-000000000001"
$EPK    = "a7000001-0000-4000-a000-000000000001"
$AGR    = "a8000001-0000-4000-a000-000000000001"
$GOV    = "a9000001-0000-4000-a000-000000000001"
$SIN    = "ac000001-0000-4000-a000-000000000001"
$OPR    = "ad000001-0000-4000-a000-000000000001"
$API    = "$BaseUrl/api/v1"

$pass     = 0
$fail     = 0
$skip     = 0
$failures = [System.Collections.Generic.List[string]]::new()
$session  = $null

# -- helpers ------------------------------------------------------------------
function Section { param([string]$t)
    Write-Host "`n  $t" -ForegroundColor Yellow }

function T {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Url,
        [string]$Body   = $null,
        [int[]]$Expect  = @(200, 201),
        [string]$Assert = $null
    )
    try {
        $p = @{
            Method         = $Method
            Uri            = $Url
            UseBasicParsing = $true
            ErrorAction    = "Stop"
        }
        if ($script:session) { $p.WebSession = $script:session }
        if ($Body) {
            $p.Body        = $Body
            $p.ContentType = "application/json"
        }
        $r = Invoke-WebRequest @p
        if ($Expect -contains [int]$r.StatusCode) {
            if ($Assert) {
                $json = $r.Content | ConvertFrom-Json
                $val  = $json
                foreach ($seg in $Assert.Split('.')) { $val = $val.$seg }
                if ($null -eq $val) {
                    Write-Host "  [FAIL] $Name -- campo '$Assert' ausente" -ForegroundColor Red
                    $script:fail++
                    $script:failures.Add($Name)
                    return
                }
            }
            Write-Host "  [PASS] $Name ($($r.StatusCode))" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "  [FAIL] $Name -- esperaba $($Expect -join '/'), obtuvo $($r.StatusCode)" -ForegroundColor Red
            $script:fail++
            $script:failures.Add($Name)
        }
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        if ($Expect -contains $sc) {
            Write-Host "  [PASS] $Name ($sc)" -ForegroundColor Green
            $script:pass++
        } else {
            $msg = $_.Exception.Message -replace "`n"," "
            $msg = $msg.Substring(0, [math]::Min(80, $msg.Length))
            Write-Host "  [FAIL] $Name -- HTTP $sc : $msg" -ForegroundColor Red
            $script:fail++
            $script:failures.Add($Name)
        }
        return $null
    }
}

# =============================================================================
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "  OKR SYSTEM -- SMOKE TEST   $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Cyan
Write-Host "  Base: $BaseUrl" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# =============================================================================
Section "[ 0 ] Health (publico)"
# =============================================================================
T -Name "GET /health" -Url "$API/health"

# =============================================================================
Section "[ 1 ] Auth"
# =============================================================================
try {
    $loginBody = "{`"email`":`"$Email`",`"password`":`"$Password`"}"
    Invoke-WebRequest -Uri "$API/auth/login" -Method POST `
        -ContentType "application/json" -Body $loginBody `
        -UseBasicParsing -SessionVariable sv -ErrorAction Stop | Out-Null
    $script:session = $sv
    Write-Host "  [PASS] POST /auth/login (200)" -ForegroundColor Green
    $script:pass++
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    Write-Host "  [FAIL] POST /auth/login -- HTTP $sc ($Email)" -ForegroundColor Red
    $script:fail++
    $script:failures.Add("POST /auth/login")
}

T -Name "GET /auth/me (con sesion)" -Url "$API/auth/me" -Assert "user"

# Guard sin sesion
try {
    Invoke-WebRequest -Uri "$API/auth/me" -Method GET -UseBasicParsing -ErrorAction Stop | Out-Null
    Write-Host "  [FAIL] Auth guard -- /auth/me sin sesion devolvio 200" -ForegroundColor Red
    $script:fail++
    $script:failures.Add("Auth guard /auth/me")
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 401) {
        Write-Host "  [PASS] Auth guard -- 401 sin sesion" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  [FAIL] Auth guard -- HTTP $sc (esperaba 401)" -ForegroundColor Red
        $script:fail++
        $script:failures.Add("Auth guard /auth/me")
    }
}

# =============================================================================
Section "[ 2 ] Ciclos"
# =============================================================================
T -Name "GET /cycles (lista)"     -Url "$API/cycles"
T -Name "GET /cycles/{Q2 ACTIVE}" -Url "$API/cycles/$CYC_Q2"
T -Name "GET /cycles/{Q1 CLOSED}" -Url "$API/cycles/$CYC_Q1"

# =============================================================================
Section "[ 3 ] Objetivos"
# =============================================================================
T -Name "GET /objectives?cycle_id=Q2"  -Url "$API/objectives?cycle_id=$CYC_Q2"
T -Name "GET /objectives?cycle_id=Q1"  -Url "$API/objectives?cycle_id=$CYC_Q1"
T -Name "GET /objectives/{COMPANY Q2}" -Url "$API/objectives/$OBJ_CO"
T -Name "GET /objectives/{COMPANY Q1}" -Url "$API/objectives/$OBJ_Q1"

# =============================================================================
Section "[ 4 ] Key Results"
# =============================================================================
T -Name "GET /objectives/{Q2}/key-results"    -Url "$API/objectives/$OBJ_CO/key-results"
T -Name "GET /objectives/{Q1}/key-results"    -Url "$API/objectives/$OBJ_Q1/key-results"
T -Name "GET /key-results/{KR AT_RISK} detail" -Url "$API/objectives/$OBJ_CO/key-results/$KR_AT"

# =============================================================================
Section "[ 5 ] Check-ins"
# =============================================================================
T -Name "GET /key-results/{AT_RISK}/check-ins" -Url "$API/key-results/$KR_AT/check-ins"
T -Name "GET /key-results/{Q1 KR}/check-ins"   -Url "$API/key-results/$KR_Q1/check-ins"

# =============================================================================
Section "[ 6 ] Equipos y Areas"
# =============================================================================
T -Name "GET /teams" -Url "$API/teams"
T -Name "GET /areas" -Url "$API/areas"

# =============================================================================
Section "[ 7 ] Iniciativas y Hitos"
# =============================================================================
T -Name "GET /initiatives?cycle_id=Q2"     -Url "$API/initiatives?cycle_id=$CYC_Q2"
T -Name "GET /initiatives/{INI}"           -Url "$API/initiatives/$INI"
T -Name "GET /initiatives/{INI}/milestones" -Url "$API/initiatives/$INI/milestones"

# =============================================================================
Section "[ 8 ] Backlog -- C4 (Acuerdo a Epica)"
# =============================================================================
T -Name "GET /backlog?cycle_id=Q2" -Url "$API/backlog?cycle_id=$CYC_Q2"
T -Name "GET /backlog/{EPIC}"      -Url "$API/backlog/$EPK"

# =============================================================================
Section "[ 9 ] Sprints / Delivery Board"
# =============================================================================
T -Name "GET /sprints?cycle_id=Q2"  -Url "$API/sprints?cycle_id=$CYC_Q2"
T -Name "GET /sprints/{SPR_ACTIVO}" -Url "$API/sprints/$SPR"

# =============================================================================
Section "[ 10 ] Acuerdos -- C2 / C4"
# =============================================================================
T -Name "GET /agreements?cycle_id=Q2" -Url "$API/agreements?cycle_id=$CYC_Q2"
T -Name "GET /agreements/stats"        -Url "$API/agreements/stats"
T -Name "GET /agreements/links"        -Url "$API/agreements/links"
T -Name "GET /agreements/{AGR}"        -Url "$API/agreements/$AGR"
T -Name "GET /agreements/{AGR}/items"  -Url "$API/agreements/$AGR/items"

# =============================================================================
Section "[ 11 ] Governance y Mapa Estrategico -- K1"
# =============================================================================
T -Name "GET /governance"              -Url "$API/governance"
T -Name "GET /strategic-intents"       -Url "$API/strategic-intents"
T -Name "GET /strategic-intents/{ID}"  -Url "$API/strategic-intents/$SIN"
T -Name "GET /problems"                -Url "$API/problems"
T -Name "GET /problems/{ID}"           -Url "$API/problems/$OPR"
T -Name "GET /reports/governance"      -Url "$API/reports/governance"

# =============================================================================
Section "[ 12 ] Reports -- K4 Dashboard Ejecutivo"
# =============================================================================
T -Name "GET /reports/executive-dashboard"             -Url "$API/reports/executive-dashboard"
T -Name "GET /reports/executive-dashboard?cycle_id=Q2" -Url "$API/reports/executive-dashboard?cycle_id=$CYC_Q2"
T -Name "GET /reports/risk-dashboard"                  -Url "$API/reports/risk-dashboard"
T -Name "GET /reports/risk-dashboard?cycle_id=Q2"      -Url "$API/reports/risk-dashboard?cycle_id=$CYC_Q2"
T -Name "GET /reports/alignment"                       -Url "$API/reports/alignment"
T -Name "GET /reports/cycle-health"                    -Url "$API/reports/cycle-health"
T -Name "GET /reports/team-health"                     -Url "$API/reports/team-health"
T -Name "GET /reports/portfolio"                       -Url "$API/reports/portfolio"
T -Name "GET /reports/activity-feed"                   -Url "$API/reports/activity-feed"
T -Name "GET /reports/upcoming-milestones"             -Url "$API/reports/upcoming-milestones"
T -Name "GET /reports/welcome-context"                 -Url "$API/reports/welcome-context"
T -Name "GET /reports/commitment-ranking"              -Url "$API/reports/commitment-ranking"

# =============================================================================
Section "[ 13 ] Cierre de Ciclo -- K5"
# =============================================================================
T -Name "GET /reports/close-report/{Q1-CLOSED}" -Url "$API/reports/close-report/$CYC_Q1"
T -Name "GET /ai/cycle-close-briefing/{Q1}"     -Url "$API/ai/cycle-close-briefing/$CYC_Q1"

# =============================================================================
Section "[ 14 ] Mi Estrategia -- K2"
# =============================================================================
T -Name "GET /me/my-work"                 -Url "$API/me/my-work"
T -Name "GET /me/my-work?cycle_id=Q2"    -Url "$API/me/my-work?cycle_id=$CYC_Q2"
T -Name "GET /me/profile"                 -Url "$API/me/profile"

# =============================================================================
Section "[ 15 ] AI Briefings -- K3 / C5"
# =============================================================================
T -Name "GET /ai/briefings"               -Url "$API/ai/briefings"
T -Name "GET /ai/briefings?cycle_id=Q1"  -Url "$API/ai/briefings?cycle_id=$CYC_Q1"
T -Name "GET /ai/conversations"           -Url "$API/ai/conversations"

# =============================================================================
Section "[ 16 ] MCP Tools"
# =============================================================================
T -Name "GET /mcp/tools" -Url "$API/mcp/tools"

$mcpHealth = '{"method":"tools/call","params":{"name":"health_check","arguments":{}}}'
$mcpObjs   = '{"method":"tools/call","params":{"name":"list_objectives","arguments":{}}}'
$mcpRisk   = '{"method":"tools/call","params":{"name":"get_at_risk_krs","arguments":{}}}'

T -Name "POST /mcp health_check"    -Method POST -Url "$API/mcp" -Body $mcpHealth
T -Name "POST /mcp list_objectives" -Method POST -Url "$API/mcp" -Body $mcpObjs
T -Name "POST /mcp get_at_risk_krs" -Method POST -Url "$API/mcp" -Body $mcpRisk

# =============================================================================
Section "[ 17 ] Seguridad"
# =============================================================================

# Guard global: endpoint protegido sin sesion devuelve 401
try {
    Invoke-WebRequest -Uri "$API/objectives" -Method GET -UseBasicParsing -ErrorAction Stop | Out-Null
    Write-Host "  [FAIL] Guard global -- /objectives sin sesion devolvio 200" -ForegroundColor Red
    $script:fail++
    $script:failures.Add("Guard global /objectives")
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 401) {
        Write-Host "  [PASS] Guard global -- 401 sin sesion" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  [FAIL] Guard global -- HTTP $sc (esperaba 401)" -ForegroundColor Red
        $script:fail++
        $script:failures.Add("Guard global /objectives")
    }
}

# =============================================================================
Section "[ 18 ] Programas de Transformacion -- /program"
# =============================================================================
$PRG = "b3000001-0000-4000-a000-000000000001"
T -Name "GET /transformation-programs (lista)" -Url "$API/transformation-programs"
T -Name "GET /transformation-programs/{PRG}" -Url "$API/transformation-programs/$PRG" -Assert "id"

# =============================================================================
Section "[ 19 ] Nuevos perfiles de usuario demo"
# =============================================================================
# Verificar login de los 3 nuevos perfiles y que pueden acceder a sus datos
$perfiles = @(
    @{ email = "elena.flores@demo.com";  label = "Elena Flores (Consejo/VIEWER)" },
    @{ email = "pedro.ramirez@demo.com"; label = "Pedro Ramirez (Gerencia/MANAGER)" },
    @{ email = "ana.torres@demo.com";    label = "Ana Torres (Comercial/MEMBER)" }
)
foreach ($p in $perfiles) {
    try {
        $loginB = "{`"email`":`"$($p.email)`",`"password`":`"Demo2026#`"}"
        Invoke-WebRequest -Uri "$API/auth/login" -Method POST `
            -ContentType "application/json" -Body $loginB `
            -UseBasicParsing -SessionVariable svp -ErrorAction Stop | Out-Null
        Write-Host "  [PASS] Login $($p.label) (200)" -ForegroundColor Green
        $script:pass++
        # Verificar que puede ver objetivos Q2
        $ro = Invoke-WebRequest -Uri "$API/objectives?cycle_id=$CYC_Q2" `
            -UseBasicParsing -WebSession $svp -ErrorAction Stop
        Write-Host "  [PASS] $($p.label) ve objetivos Q2 (200)" -ForegroundColor Green
        $script:pass++
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        Write-Host "  [FAIL] $($p.label) -- HTTP $sc" -ForegroundColor Red
        $script:fail++
        $script:failures.Add("Perfil $($p.email)")
    }
}

# Verificar objetivo individual de Pedro (b2000011)
$OBJ_PEDRO = "b2000011-0000-4000-a000-000000000001"
$OBJ_ANA   = "b2000012-0000-4000-a000-000000000001"
$KR_PEDRO  = "c2000022-0000-4000-a000-000000000001"
T -Name "GET objetivo individual Pedro" -Url "$API/objectives/$OBJ_PEDRO" -Assert "id"
T -Name "GET objetivo individual Ana"   -Url "$API/objectives/$OBJ_ANA"   -Assert "id"
T -Name "GET KR individual Pedro"       -Url "$API/objectives/$OBJ_PEDRO/key-results"
T -Name "GET check-ins KR Pedro"        -Url "$API/key-results/$KR_PEDRO/check-ins"

# =============================================================================
Section "[ 20 ] Delivery Programs -- /delivery"
# =============================================================================
$DLV1 = "ba000001-0000-4000-a000-000000000001"
$DLV2 = "ba000002-0000-4000-a000-000000000001"
T -Name "GET /delivery (lista programas)"     -Url "$API/delivery"
T -Name "GET /delivery/{DLV1}"                -Url "$API/delivery/$DLV1"   -Assert "program.id"
T -Name "GET /delivery/{DLV2}"                -Url "$API/delivery/$DLV2"   -Assert "program.id"
T -Name "GET /delivery/upcoming"              -Url "$API/delivery/upcoming"

# =============================================================================
Section "[ 21 ] Sector Assessment -- /sector-assessment"
# =============================================================================
$SAS1 = "bd000001-0000-4000-a000-000000000001"
$SAS2 = "bd000002-0000-4000-a000-000000000001"
$SA1  = "be000001-0000-4000-a000-000000000001"
$SA2  = "be000002-0000-4000-a000-000000000001"
T -Name "GET /sector-assessment/sessions (lista)"      -Url "$API/sector-assessment/sessions"
T -Name "GET /sector-assessment/sessions/{SAS1}"       -Url "$API/sector-assessment/sessions/$SAS1" -Assert "id"
T -Name "GET /sector-assessment/sessions/{SAS2}"       -Url "$API/sector-assessment/sessions/$SAS2" -Assert "id"
T -Name "GET /sector-assessment (lista assessments)"   -Url "$API/sector-assessment"
T -Name "GET /sector-assessment/{SA1}"                 -Url "$API/sector-assessment/$SA1"           -Assert "id"
T -Name "GET /sector-assessment/{SA2}"                 -Url "$API/sector-assessment/$SA2"           -Assert "id"
T -Name "GET /sector-assessment/sessions/{SAS1}/assessments" -Url "$API/sector-assessment/sessions/$SAS1/assessments"

# Probe UUID inexistente: UUID valido pero no registrado — debe retornar 200 (fallback a ciclo activo)
$ghostCycle = "00000000-0000-4000-a000-000000000000"
$probeUrl   = "$API/reports/risk-dashboard?cycle_id=$ghostCycle"
try {
    $rp = Invoke-WebRequest -Uri $probeUrl -UseBasicParsing -WebSession $session -ErrorAction Stop
    try {
        $rp.Content | ConvertFrom-Json | Out-Null
        Write-Host "  [PASS] Probe UUID inexistente -- 200 con fallback a ciclo activo" -ForegroundColor Green
        $script:pass++
    } catch {
        Write-Host "  [FAIL] Probe UUID inexistente -- respuesta no es JSON" -ForegroundColor Red
        $script:fail++
        $script:failures.Add("Probe UUID inexistente")
    }
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if (@(200, 400, 404) -contains $sc) {
        Write-Host "  [PASS] Probe UUID inexistente -- HTTP $sc aceptable" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  [FAIL] Probe UUID inexistente -- HTTP $sc (esperaba 200 o 404, no 500)" -ForegroundColor Red
        $script:fail++
        $script:failures.Add("Probe UUID inexistente")
    }
}

# =============================================================================
# RESUMEN
# =============================================================================
$total = $pass + $fail + $skip
$pct   = if (($pass + $fail) -gt 0) { [math]::Round($pass * 100 / ($pass + $fail), 0) } else { 100 }

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
$color = if ($fail -eq 0) { "Green" } else { "Red" }
Write-Host ("  PASS {0,3}   FAIL {1,3}   SKIP {2,3}   TOTAL {3,3}   ({4}% OK)" -f $pass, $fail, $skip, $total, $pct) -ForegroundColor $color
Write-Host "======================================================" -ForegroundColor Cyan

if ($failures.Count -gt 0) {
    Write-Host "`n  Fallos:" -ForegroundColor Red
    $failures | ForEach-Object { Write-Host "    - $_" -ForegroundColor Red }
}
Write-Host ""

exit $(if ($fail -gt 0) { 1 } else { 0 })
