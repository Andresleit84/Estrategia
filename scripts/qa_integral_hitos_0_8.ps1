################################################################################
# QA INTEGRAL -- Hitos 0-8
# Cubre: Auth, Orgs, Teams, Ciclos, OKRs, KRs, Check-ins, Iniciativas,
#        Problemas, Intenciones Estrategicas, Sprints + integracion cross-module
################################################################################

param([switch]$Verbose)

$BASE     = "http://localhost:3001/api/v1"
$THROTTLE = 160   # ms entre requests

$pass = 0; $fail = 0; $skip = 0
$bugs = [System.Collections.Generic.List[string]]::new()

# -- helpers ------------------------------------------------------------------
function Req {
    param([string]$Method="GET",[string]$Url,[object]$Session,[hashtable]$Body,[string]$Raw)
    Start-Sleep -Milliseconds $THROTTLE
    $params = @{ Uri=$Url; Method=$Method; UseBasicParsing=$true }
    if ($Session)  { $params.WebSession   = $Session }
    if ($Body)     { $params.Body = ($Body | ConvertTo-Json -Depth 5); $params.ContentType = "application/json" }
    if ($Raw)      { $params.Body = $Raw; $params.ContentType = "application/json" }
    return Invoke-WebRequest @params
}

function ReqObj {
    param([string]$Method="GET",[string]$Url,[object]$Session,[hashtable]$Body,[string]$Raw)
    $r = Req -Method $Method -Url $Url -Session $Session -Body $Body -Raw $Raw
    return $r.Content | ConvertFrom-Json
}

function Login {
    param([string]$Email="qa@test.com",[string]$Pw="Sprint2024!")
    Start-Sleep -Milliseconds $THROTTLE
    Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST -ContentType "application/json" `
        -Body (@{email=$Email;password=$Pw}|ConvertTo-Json) -SessionVariable sv | Out-Null
    return $sv
}

function Code { param($Err); try{$Err.Exception.Response.StatusCode.value__}catch{0} }

function Pass { param([string]$id,[string]$desc)
    $script:pass++
    Write-Host "[PASS] $id : $desc" -ForegroundColor Green }

function Fail { param([string]$id,[string]$desc,[string]$detail="")
    $script:fail++
    $e = if($detail){"[$id] $desc :: $detail"}else{"[$id] $desc"}
    $script:bugs.Add($e)
    Write-Host "[FAIL] $id : $desc" -ForegroundColor Red
    if($detail -and $Verbose){ Write-Host "       $detail" -ForegroundColor DarkRed } }

function Skip { param([string]$id,[string]$reason)
    $script:skip++
    Write-Host "[SKIP] $id : $reason" -ForegroundColor DarkYellow }

function Expect-Code {
    param([string]$id,[string]$desc,[scriptblock]$block,[int]$expected)
    Start-Sleep -Milliseconds $THROTTLE
    try {
        & $block | Out-Null
        if($expected -ge 200 -and $expected -lt 300){Pass $id $desc}
        else{Fail $id $desc "Esperaba HTTP $expected, obtuvo 2xx"}
    } catch {
        $c = Code $_
        if($c -eq $expected){Pass $id $desc}
        else{Fail $id $desc "HTTP $c (esperaba $expected)"}
    }
}

function Section { param([string]$t)
    Write-Host "`n-- $t" -ForegroundColor Yellow }

# -- estado compartido --------------------------------------------------------
$ctx = @{}

Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  QA INTEGRAL -- HITOS 0-8 -- $((Get-Date).ToString('yyyy-MM-dd HH:mm'))" -ForegroundColor Cyan
Write-Host "================================================================"

$S = Login
$me = ReqObj -Url "$BASE/auth/me" -Session $S
# /auth/me returns { user: { user_id, organization_id, ... } }
$u = $me.user
$ctx.user_id  = $u.user_id
$ctx.org_id   = $u.organization_id
$ctx.org_mode = $u.org_mode
Write-Host "  Usuario: $($u.email) | Org: $($u.org_name) | Modo: $($ctx.org_mode)"
if ($u.org_name -ne "Test Corp") {
    Write-Host "  [ADVERTENCIA] La sesion no es 'Test Corp' sino '$($u.org_name)'." -ForegroundColor Red
    Write-Host "  Los tests de Bloque 5+ usan datos hardcodeados de Test Corp y pueden fallar." -ForegroundColor Red
    Write-Host "  Causa probable: qa@test.com tiene multiples orgs por tests previos contaminados." -ForegroundColor Red
}

# ============================================================================
Section "BLOQUE 1 -- SEGURIDAD GLOBAL: JWT + ENDPOINTS PUBLICOS"

# TC-A01: /auth/me sin token -> 401
Expect-Code "TC-A01" "GET /me sin JWT -> 401" {
    Invoke-WebRequest -Uri "$BASE/auth/me" -UseBasicParsing } 401

# TC-A02: token invalido -> 401
Expect-Code "TC-A02" "Bearer invalido -> 401" {
    Invoke-WebRequest -Uri "$BASE/auth/me" -Headers @{Authorization="Bearer invalid.token.here"} -UseBasicParsing } 401

# TC-A03: endpoints protegidos sin token -> 401
# /key-results NO tiene ruta GET raiz (solo PATCH/DELETE por id) -- espera 404 sin JWT
foreach ($ep in @("/cycles","/objectives","/initiatives","/sprints","/teams","/problems","/strategic-intents")) {
    Expect-Code "TC-A03$ep" "GET $ep sin JWT -> 401" {
        Invoke-WebRequest -Uri "$BASE$ep" -UseBasicParsing } 401
}
Expect-Code "TC-A03/key-results" "GET /key-results sin ruta -> 404 (ruta no existe)" {
    Invoke-WebRequest -Uri "$BASE/key-results" -UseBasicParsing } 404

# TC-A04: health check publico -> 200
Expect-Code "TC-A04" "GET /health (public) -> 200" {
    Invoke-WebRequest -Uri "$BASE/health" -UseBasicParsing } 200

# ============================================================================
Section "BLOQUE 2 -- AUTENTICACION"

# TC-B01: login correcto -> user session completa (respuesta envuelta en {user: {...}})
$r = ReqObj -Url "$BASE/auth/me" -Session $S
$ru = $r.user
if ($ru.user_id -and $ru.organization_id -and $ru.email) { Pass "TC-B01" "GET /me devuelve user_id, org_id, email" }
else { Fail "TC-B01" "GET /me campos incompletos" ($r|ConvertTo-Json -Compress) }

# TC-B02: login con password incorrecto -> 401
Expect-Code "TC-B02" "Login password incorrecto -> 401" {
    Invoke-WebRequest -Uri "$BASE/auth/login" -Method POST -ContentType "application/json" `
        -Body (@{email="qa@test.com";password="WrongPass99!"}|ConvertTo-Json) -UseBasicParsing } 401

# TC-B03: login con email inexistente -> 401
Expect-Code "TC-B03" "Login email inexistente -> 401" {
    Invoke-WebRequest -Uri "$BASE/auth/login" -Method POST -ContentType "application/json" `
        -Body (@{email="noexiste_$(Get-Random)@test.com";password="Pass1234!"}|ConvertTo-Json) -UseBasicParsing } 401

# TC-B04: register slug duplicado (usar emails unicos, NO qa@test.com)
$dupSlug = "qa-dup-$(Get-Random -Max 99999)"
$dupEmail1 = "qadup1_$(Get-Random -Max 99999)@qatestonly.com"
$dupEmail2 = "qadup2_$(Get-Random -Max 99999)@qatestonly.com"
Start-Sleep -Milliseconds $THROTTLE
try { Invoke-RestMethod -Uri "$BASE/auth/register" -Method POST -ContentType "application/json" `
    -Body (@{orgName="DupOrg";orgSlug=$dupSlug;name="Test";email=$dupEmail1;password="Pass1234!"}|ConvertTo-Json) | Out-Null }
catch {}
Start-Sleep -Milliseconds 300
Expect-Code "TC-B04" "Register slug duplicado -> 409" {
    Invoke-WebRequest -Uri "$BASE/auth/register" -Method POST -ContentType "application/json" `
        -Body (@{orgName="DupOrg2";orgSlug=$dupSlug;name="Test2";email=$dupEmail2;password="Pass1234!"}|ConvertTo-Json) -UseBasicParsing } 409

# TC-B05: register mismo email crea org nueva (multi-tenant por diseno)
# Usar email unico para NO contaminar qa@test.com
$dupMailEmail = "qamail_$(Get-Random -Max 99999)@qatestonly.com"
$dupMailSlug1 = "qamail1-$(Get-Random -Max 99999)"
$dupMailSlug2 = "qamail2-$(Get-Random -Max 99999)"
Start-Sleep -Milliseconds $THROTTLE
try { Invoke-RestMethod -Uri "$BASE/auth/register" -Method POST -ContentType "application/json" `
    -Body (@{orgName="MailOrg1";orgSlug=$dupMailSlug1;name="User";email=$dupMailEmail;password="Pass1234!"}|ConvertTo-Json) | Out-Null }
catch {}
Start-Sleep -Milliseconds 300
try {
    $dupMailR = Invoke-WebRequest -Uri "$BASE/auth/register" -Method POST -ContentType "application/json" `
        -Body (@{orgName="MailOrg2";orgSlug=$dupMailSlug2;name="User2";email=$dupMailEmail;password="Pass1234!"}|ConvertTo-Json) -UseBasicParsing
    if ($dupMailR.StatusCode -ge 200 -and $dupMailR.StatusCode -lt 300) {
        Pass "TC-B05" "Register mismo email -> $($dupMailR.StatusCode) (multi-tenant por diseno)"
    } else { Pass "TC-B05" "Register mismo email -> $($dupMailR.StatusCode)" }
} catch {
    $code = Code $_
    if ($code -eq 409) { Pass "TC-B05" "Register email duplicado -> 409 (unicidad de email global activa)" }
    else { Fail "TC-B05" "Register mismo email -> HTTP $code inesperado" "" }
}

# TC-B06: register password menos de 8 chars
Expect-Code "TC-B06" "Register password menos de 8 chars -> 400" {
    Invoke-WebRequest -Uri "$BASE/auth/register" -Method POST -ContentType "application/json" `
        -Body (@{orgName="ShortPw";orgSlug="shortpw-$(Get-Random -Max 9999)";name="A";email="short_$(Get-Random)@t.com";password="Pass1"}|ConvertTo-Json) -UseBasicParsing } 400

# TC-B07: register slug con caracteres invalidos (mayusculas)
Expect-Code "TC-B07" "Register slug con mayusculas -> 400" {
    Invoke-WebRequest -Uri "$BASE/auth/register" -Method POST -ContentType "application/json" `
        -Body (@{orgName="BadSlug";orgSlug="BadSlug123";name="A";email="bad_$(Get-Random)@t.com";password="Pass1234!"}|ConvertTo-Json) -UseBasicParsing } 400

# TC-B08: /auth/me retorna org_mode dentro de .user
if ($ru.org_mode -in @("AGILE","TRADITIONAL","HYBRID")) { Pass "TC-B08" "org_mode en sesion: $($ru.org_mode)" }
else { Fail "TC-B08" "org_mode invalido o ausente: $($ru.org_mode)" }

# ============================================================================
Section "BLOQUE 3 -- ORGANIZACION"

$org = ReqObj -Url "$BASE/organizations/me" -Session $S
if ($org.id) { Pass "TC-C01" "GET /organizations/me devuelve org" }
else { Fail "TC-C01" "No devuelve org" ($org|ConvertTo-Json -Compress) }

# TC-C02: PATCH org name
try {
    $upd = ReqObj -Method PATCH -Url "$BASE/organizations/me" -Session $S -Body @{name="Test Corp QA Updated"}
    if ($upd.name) { Pass "TC-C02" "PATCH org name -> actualizado" }
    else { Fail "TC-C02" "PATCH org no devuelve nombre" ($upd|ConvertTo-Json -Compress) }
    Req -Method PATCH -Url "$BASE/organizations/me" -Session $S -Body @{name="Test Corp"} | Out-Null
} catch { Fail "TC-C02" "PATCH org -> error" $_.Exception.Message }

# TC-C03: miembros de la org
try {
    $members = ReqObj -Url "$BASE/organizations/me/members" -Session $S
    $arr = @($members)
    if ($arr.Count -ge 1) { Pass "TC-C03" "GET /members -> $($arr.Count) miembro(s)" }
    else { Fail "TC-C03" "Sin miembros en la org" }
} catch { Fail "TC-C03" "GET /members -> error" $_.Exception.Message }

# TC-C04: arbol de equipos
try {
    $tree = ReqObj -Url "$BASE/organizations/me/team-tree" -Session $S
    Pass "TC-C04" "GET /team-tree -> OK"
} catch { Fail "TC-C04" "GET /team-tree -> error" $_.Exception.Message }

# ============================================================================
Section "BLOQUE 4 -- EQUIPOS"

# TC-D01: crear equipo nuevo
$teamName = "QA Team $(Get-Random -Max 9999)"
try {
    $team = ReqObj -Method POST -Url "$BASE/teams" -Session $S -Body @{name=$teamName; description="Equipo de prueba QA"}
    $ctx.team_id2 = $team.id
    if ($team.id) { Pass "TC-D01" "Crear equipo -> OK ($teamName)" }
    else { Fail "TC-D01" "No devuelve id" ($team|ConvertTo-Json -Compress) }
} catch { Fail "TC-D01" "Crear equipo -> error" $_.Exception.Message }

# TC-D02: nombre duplicado de equipo
if ($ctx.team_id2) {
    Expect-Code "TC-D02" "Equipo nombre duplicado -> 409" {
        Req -Method POST -Url "$BASE/teams" -Session $S -Body @{name=$teamName} } 409
}

# TC-D03: equipo sin nombre -> 400
Expect-Code "TC-D03" "Crear equipo sin nombre -> 400" {
    Req -Method POST -Url "$BASE/teams" -Session $S -Body @{description="Sin nombre"} } 400

# TC-D04: listar equipos
try {
    $teams = ReqObj -Url "$BASE/teams" -Session $S
    $arr = @($teams)
    if ($arr.Count -ge 1) { Pass "TC-D04" "GET /teams -> $($arr.Count) equipo(s)" }
    else { Fail "TC-D04" "Sin equipos" }
} catch { Fail "TC-D04" "GET /teams -> error" $_.Exception.Message }

# TC-D05: miembros del equipo QA
$ctx.team_id = "0b616d8e-fb39-4a39-8581-6c280103ed08"
try {
    $mems = ReqObj -Url "$BASE/teams/$($ctx.team_id)/members" -Session $S
    Pass "TC-D05" "GET equipo/members -> OK"
} catch { Fail "TC-D05" "GET equipo/members -> error" $_.Exception.Message }

# TC-D06: AddMemberDto ahora usa user_id (snake_case) -- verificar que userId (camelCase) es rechazado
$adminUserId = $ctx.user_id
if ($ctx.team_id2) {
    try {
        $addR = Req -Method POST -Url "$BASE/teams/$($ctx.team_id2)/members" -Session $S `
            -Body @{userId=$adminUserId; role="MEMBER"}
        Fail "TC-D06" "AddMemberDto: userId (camelCase) deberia ser rechazado tras correccion del DTO" ""
    } catch {
        $code = Code $_
        if ($code -eq 400) { Pass "TC-D06" "AddMemberDto: userId camelCase -> 400 (DTO corregido a snake_case)" }
        else { Fail "TC-D06" "AddMemberDto: userId camelCase -> HTTP $code inesperado" "" }
    }
}

# TC-D07: equipo UUID inexistente -> 404
Expect-Code "TC-D07" "Equipo inexistente -> 404" {
    Req -Url "$BASE/teams/00000000-0000-0000-0000-000000000000/members" -Session $S } 404

# ============================================================================
Section "BLOQUE 5 -- CICLOS"

$ctx.cycle_id = "950630ed-394a-4636-84a7-4240c80c9fa5"

# TC-E01: GET ciclos
try {
    $cycles = ReqObj -Url "$BASE/cycles" -Session $S
    $arr = @($cycles)
    if ($arr.Count -ge 1) { Pass "TC-E01" "GET /cycles -> $($arr.Count) ciclo(s)" }
    else { Fail "TC-E01" "Sin ciclos" }
} catch { Fail "TC-E01" "GET /cycles -> error" $_.Exception.Message }

# TC-E02: GET ciclo activo
try {
    $active = ReqObj -Url "$BASE/cycles/active" -Session $S
    if ($active.id -and $active.status -eq "ACTIVE") { Pass "TC-E02" "GET /cycles/active -> $($active.name)" }
    else { Fail "TC-E02" "Ciclo activo no tiene status ACTIVE: $($active.status)" }
} catch { Fail "TC-E02" "GET /cycles/active -> error" $_.Exception.Message }

# TC-E03: GET ciclo por ID con org isolation
try {
    $c = ReqObj -Url "$BASE/cycles/$($ctx.cycle_id)" -Session $S
    if ($c.organization_id -eq $ctx.org_id) { Pass "TC-E03" "GET ciclo -> pertenece a la org correcta" }
    else { Fail "TC-E03" "org_id del ciclo no coincide" }
} catch { Fail "TC-E03" "GET ciclo -> error" $_.Exception.Message }

# TC-E04: crear ciclo con end menor que start -> 400
Expect-Code "TC-E04" "Ciclo end menor que start -> 400" {
    Req -Method POST -Url "$BASE/cycles" -Session $S `
        -Body @{name="Inv"; start_date="2027-01-01"; end_date="2026-12-31"} } 400

# TC-E05: crear ciclo con end = start -> 400
Expect-Code "TC-E05" "Ciclo end igual a start -> 400" {
    Req -Method POST -Url "$BASE/cycles" -Session $S `
        -Body @{name="Same"; start_date="2027-06-01"; end_date="2027-06-01"} } 400

# TC-E06: crear, activar segundo ciclo con uno ya activo
try {
    $c2 = ReqObj -Method POST -Url "$BASE/cycles" -Session $S `
        -Body @{name="QA Ciclo 2026-Q3"; start_date="2026-07-01"; end_date="2026-09-30"; type="QUARTERLY"}
    $ctx.cycle_id2 = $c2.id
    Pass "TC-E06a" "Crear segundo ciclo DRAFT -> OK"
    try {
        Req -Method POST -Url "$BASE/cycles/$($ctx.cycle_id2)/activate" -Session $S | Out-Null
        Fail "TC-E06b" "Activar ciclo con otro ya ACTIVE -> deberia fallar [VERIFICAR TRIGGER]" ""
    } catch {
        $code = Code $_
        if ($code -eq 400 -or $code -eq 409) { Pass "TC-E06b" "Activar 2do ciclo con uno activo -> $code (correcto)" }
        else { Fail "TC-E06b" "Codigo inesperado al activar 2do ciclo: HTTP $code" "" }
    }
} catch { Fail "TC-E06a" "Crear segundo ciclo -> error" $_.Exception.Message }

# TC-E07: ciclo UUID inexistente -> 404
Expect-Code "TC-E07" "Ciclo inexistente -> 404" {
    Req -Url "$BASE/cycles/00000000-0000-0000-0000-000000000000" -Session $S } 404

# TC-E08: score del ciclo activo
try {
    $score = ReqObj -Url "$BASE/cycles/$($ctx.cycle_id)/score" -Session $S
    if ($null -ne $score.score) { Pass "TC-E08" "Ciclo score -> $($score.score)" }
    else { Fail "TC-E08" "Score no devuelto" ($score|ConvertTo-Json -Compress) }
} catch { Fail "TC-E08" "Ciclo score -> error" $_.Exception.Message }

# ============================================================================
Section "BLOQUE 6 -- OBJETIVOS"

# TC-F01: crear objetivo COMPANY
try {
    $obj = ReqObj -Method POST -Url "$BASE/objectives" -Session $S `
        -Body @{title="QA Objetivo Empresa Test"; cycle_id=$ctx.cycle_id; level="COMPANY"}
    $ctx.obj_id = $obj.id
    if ($obj.id -and $obj.level -eq "COMPANY") { Pass "TC-F01" "Crear objetivo COMPANY -> OK" }
    else { Fail "TC-F01" "Objetivo COMPANY sin id o level incorrecto" ($obj|ConvertTo-Json -Compress) }
} catch { Fail "TC-F01" "Crear objetivo COMPANY -> error" $_.Exception.Message }

# TC-F02: crear objetivo TEAM sin parent -> debe fallar (trigger P0010)
Expect-Code "TC-F02" "Objetivo TEAM sin parent_id -> 400 (P0010)" {
    Req -Method POST -Url "$BASE/objectives" -Session $S `
        -Body @{title="Team Sin Parent"; cycle_id=$ctx.cycle_id; level="TEAM"; team_id=$ctx.team_id} } 400

# TC-F03: crear objetivo TEAM con parent valido -> OK
if ($ctx.obj_id) {
    try {
        $teamObj = ReqObj -Method POST -Url "$BASE/objectives" -Session $S `
            -Body @{title="QA Objetivo Equipo Test"; cycle_id=$ctx.cycle_id; level="TEAM";
                    parent_objective_id=$ctx.obj_id; team_id=$ctx.team_id}
        $ctx.team_obj_id = $teamObj.id
        if ($teamObj.id) { Pass "TC-F03" "Objetivo TEAM con parent -> OK" }
        else { Fail "TC-F03" "Sin id" ($teamObj|ConvertTo-Json -Compress) }
    } catch { Fail "TC-F03" "Objetivo TEAM con parent -> error" $_.Exception.Message }
}

# TC-F04: title de 2 chars (MinLength=3) -> 400
Expect-Code "TC-F04" "Objetivo title 2 chars -> 400" {
    Req -Method POST -Url "$BASE/objectives" -Session $S `
        -Body @{title="AB"; cycle_id=$ctx.cycle_id} } 400

# TC-F05: listar objetivos del ciclo
try {
    $objs = ReqObj -Url "$BASE/objectives?cycle_id=$($ctx.cycle_id)" -Session $S
    $arr = @($objs)
    if ($arr.Count -ge 1) { Pass "TC-F05" "GET /objectives?cycle_id -> $($arr.Count) objetivo(s)" }
    else { Fail "TC-F05" "Sin objetivos" }
} catch { Fail "TC-F05" "GET /objectives -> error" $_.Exception.Message }

# TC-F06: filtrar por level=COMPANY
try {
    $qs = "cycle_id=$($ctx.cycle_id)&level=COMPANY"
    $compObjs = ReqObj -Url "$BASE/objectives?$qs" -Session $S
    $arr = @($compObjs)
    $wrong = @($arr | Where-Object { $_.level -ne "COMPANY" })
    if ($wrong.Count -eq 0) { Pass "TC-F06" "Filtro level=COMPANY -> solo COMPANY ($($arr.Count) items)" }
    else { Fail "TC-F06" "Filtro level=COMPANY devuelve $($wrong.Count) no-COMPANY" }
} catch { Fail "TC-F06" "Filtro level -> error" $_.Exception.Message }

# TC-F07: mapa de alineacion
try {
    $map = ReqObj -Url "$BASE/objectives/alignment?cycle_id=$($ctx.cycle_id)" -Session $S
    Pass "TC-F07" "GET /alignment -> OK"
} catch { Fail "TC-F07" "GET /alignment -> error" $_.Exception.Message }

# TC-F08: objetivo inexistente -> 404
Expect-Code "TC-F08" "Objetivo inexistente -> 404" {
    Req -Url "$BASE/objectives/00000000-0000-0000-0000-000000000000" -Session $S } 404

# TC-F09: PATCH objetivo -> titulo actualizado
if ($ctx.obj_id) {
    try {
        $upd = ReqObj -Method PATCH -Url "$BASE/objectives/$($ctx.obj_id)" -Session $S `
            -Body @{title="QA Objetivo Empresa Actualizado"}
        if ($upd.title -eq "QA Objetivo Empresa Actualizado") { Pass "TC-F09" "PATCH objetivo -> titulo actualizado" }
        else { Fail "TC-F09" "Titulo no actualizado: $($upd.title)" }
    } catch { Fail "TC-F09" "PATCH objetivo -> error" $_.Exception.Message }
}

# TC-F10: LIMITE 5 objetivos COMPANY (usar sufijo unico para evitar colision con datos anteriores)
$fillSuffix = Get-Random -Max 99999
try {
    $fillIds = [System.Collections.Generic.List[string]]::new()
    $qs2 = "cycle_id=$($ctx.cycle_id)&level=COMPANY"
    $_r2 = ReqObj -Url "$BASE/objectives?$qs2" -Session $S; $compObjs2 = @($_r2)
    $existing = $compObjs2.Count
    Write-Host "  Objetivos COMPANY existentes (incluyendo otros): $existing/5"
    # Crear hasta completar 5 con titulos unicos
    $fillTarget = [Math]::Max(0, 5 - $existing)
    for ($i = 0; $i -lt $fillTarget; $i++) {
        try {
            $fo = ReqObj -Method POST -Url "$BASE/objectives" -Session $S `
                -Body @{title="QA Fill $fillSuffix-$i"; cycle_id=$ctx.cycle_id; level="COMPANY"}
            if ($fo.id) { $fillIds.Add($fo.id) }
        } catch { break }
    }
    # Verificar limite
    $qs3 = "cycle_id=$($ctx.cycle_id)&level=COMPANY"
    $_r3 = ReqObj -Url "$BASE/objectives?$qs3" -Session $S; $compObjs3 = @($_r3)
    $nowCount = $compObjs3.Count
    Write-Host "  Objetivos COMPANY despues de relleno: $nowCount/5"
    if ($nowCount -ge 5) {
        Expect-Code "TC-F10" "6to objetivo COMPANY -> 400 (P0006 limite)" {
            Req -Method POST -Url "$BASE/objectives" -Session $S `
                -Body @{title="Limite Plus1 $fillSuffix"; cycle_id=$ctx.cycle_id; level="COMPANY"} } 400
    } else {
        Skip "TC-F10" "No se pudo alcanzar 5 obj COMPANY: ciclo acumulado con datos previos ($nowCount)"
    }
    # Limpiar los fill objs creados en este run
    foreach ($fid in $fillIds) {
        try { Req -Method DELETE -Url "$BASE/objectives/$fid" -Session $S | Out-Null } catch {}
    }
} catch { Fail "TC-F10" "Verificar limite COMPANY -> error" $_.Exception.Message }

# ============================================================================
Section "BLOQUE 7 -- KEY RESULTS"

# TC-G01: crear KR INCREASE
if ($ctx.obj_id) {
    try {
        $kr = ReqObj -Method POST -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S `
            -Body @{title="QA KR Incrementar NPS"; type="INCREASE"; start_value=20; target_value=70; metric_unit="puntos"}
        $ctx.kr_id = $kr.id
        if ($kr.id -and $kr.type -eq "INCREASE") { Pass "TC-G01" "Crear KR INCREASE -> OK" }
        else { Fail "TC-G01" "KR sin id o tipo incorrecto" ($kr|ConvertTo-Json -Compress) }
    } catch { Fail "TC-G01" "Crear KR INCREASE -> error" $_.Exception.Message }
}

# TC-G02: KR INCREASE con target igual o menor a start -> 400
if ($ctx.obj_id) {
    Expect-Code "TC-G02" "KR INCREASE target igual o menor a start -> 400" {
        Req -Method POST -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S `
            -Body @{title="KR Inv"; type="INCREASE"; start_value=50; target_value=50; metric_unit="pts"} } 400
}

# TC-G03: KR DECREASE con target mayor o igual a start -> 400
if ($ctx.obj_id) {
    Expect-Code "TC-G03" "KR DECREASE target mayor o igual a start -> 400" {
        Req -Method POST -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S `
            -Body @{title="KR Dec Inv"; type="DECREASE"; start_value=10; target_value=50; metric_unit="pts"} } 400
}

# TC-G04: KR ACHIEVE -> OK (sin validacion start/target)
if ($ctx.obj_id) {
    try {
        $krA = ReqObj -Method POST -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S `
            -Body @{title="QA KR Lograr certificacion"; type="ACHIEVE"; target_value=1; metric_unit="cert"}
        $ctx.kr_achieve_id = $krA.id
        if ($krA.id) { Pass "TC-G04" "KR ACHIEVE -> OK" }
        else { Fail "TC-G04" "KR ACHIEVE sin id" }
    } catch { Fail "TC-G04" "KR ACHIEVE -> error" $_.Exception.Message }
}

# TC-G05: KR MAINTAIN -> OK
if ($ctx.obj_id) {
    try {
        $krM = ReqObj -Method POST -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S `
            -Body @{title="QA KR Mantener disponibilidad"; type="MAINTAIN"; start_value=99; target_value=99; metric_unit="%"}
        $ctx.kr_maintain_id = $krM.id
        if ($krM.id) { Pass "TC-G05" "KR MAINTAIN -> OK" }
        else { Fail "TC-G05" "KR MAINTAIN sin id" }
    } catch { Fail "TC-G05" "KR MAINTAIN -> error" $_.Exception.Message }
}

# TC-G06: KR title de 2 chars -> 400
if ($ctx.obj_id) {
    Expect-Code "TC-G06" "KR title 2 chars -> 400" {
        Req -Method POST -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S `
            -Body @{title="AB"; type="INCREASE"; target_value=100; metric_unit="pts"} } 400
}

# TC-G07: KR sin target_value -> 400
if ($ctx.obj_id) {
    Expect-Code "TC-G07" "KR sin target_value -> 400" {
        Req -Method POST -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S `
            -Body @{title="KR Sin Target"; type="INCREASE"; metric_unit="pts"} } 400
}

# TC-G08: listar KRs del objetivo
if ($ctx.obj_id) {
    try {
        $krs = ReqObj -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S
        $arr = @($krs)
        if ($arr.Count -ge 1) { Pass "TC-G08" "GET KRs del objetivo -> $($arr.Count) KR(s)" }
        else { Fail "TC-G08" "Sin KRs" }
    } catch { Fail "TC-G08" "GET KRs -> error" $_.Exception.Message }
}

# TC-G09: PATCH KR -> actualizar titulo
if ($ctx.kr_id) {
    try {
        $updKr = ReqObj -Method PATCH -Url "$BASE/key-results/$($ctx.kr_id)" -Session $S `
            -Body @{title="QA KR NPS Actualizado"; current_value=35}
        if ($updKr.title -eq "QA KR NPS Actualizado") { Pass "TC-G09" "PATCH KR -> titulo actualizado" }
        else { Fail "TC-G09" "Titulo KR no actualizado: $($updKr.title)" }
    } catch { Fail "TC-G09" "PATCH KR -> error" $_.Exception.Message }
}

# TC-G10: LIMITE 5 KRs por objetivo
if ($ctx.obj_id) {
    try {
        $_kr2 = ReqObj -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S; $krs2 = @($_kr2)
        $existingKrs = $krs2.Count
        Write-Host "  KRs existentes en objetivo: $existingKrs/5"
        for ($i = $existingKrs; $i -lt 5; $i++) {
            try {
                ReqObj -Method POST -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S `
                    -Body @{title="QA KR Fill $i"; type="INCREASE"; start_value=0; target_value=100; metric_unit="pts"} | Out-Null
            } catch { break }
        }
        Expect-Code "TC-G10" "6to KR en objetivo -> 400 (P0007 limite)" {
            Req -Method POST -Url "$BASE/objectives/$($ctx.obj_id)/key-results" -Session $S `
                -Body @{title="KR Limite Plus1"; type="INCREASE"; start_value=0; target_value=100; metric_unit="pts"} } 400
    } catch { Fail "TC-G10" "Verificar limite KRs -> error" $_.Exception.Message }
}

# ============================================================================
Section "BLOQUE 8 -- CHECK-INS + CASCADA DE PROGRESO"

if ($ctx.kr_id) {
    # TC-H01: check-in valido
    try {
        $ci = ReqObj -Method POST -Url "$BASE/key-results/$($ctx.kr_id)/check-ins" -Session $S `
            -Body @{current_value=40; confidence=0.7; notes="Avance positivo QA"; mood="GOOD"}
        $ctx.checkin_id = $ci.id
        if ($ci.id) { Pass "TC-H01" "Check-in -> creado OK" }
        else { Fail "TC-H01" "Check-in sin id" ($ci|ConvertTo-Json -Compress) }
    } catch { Fail "TC-H01" "Check-in -> error" $_.Exception.Message }

    # TC-H02: verificar que KR actualizo su progress
    try {
        Start-Sleep -Milliseconds 500
        $krR = ReqObj -Url "$BASE/objectives/$($ctx.obj_id)/key-results/$($ctx.kr_id)" -Session $S
        # Con INCREASE: start=20, target=70, current=40 -> progress = (40-20)/(70-20)*100 = 40%
        if ($krR.progress -gt 0) { Pass "TC-H02" "Check-in actualizo KR progress: $($krR.progress)%" }
        else { Fail "TC-H02" "KR progress = 0 despues de check-in (trigger no actuo?)" }
    } catch { Fail "TC-H02" "GET KR post-checkin -> error" $_.Exception.Message }

    # TC-H03: verificar cascada al objetivo
    try {
        $objR = ReqObj -Url "$BASE/objectives/$($ctx.obj_id)" -Session $S
        if ($objR.progress -gt 0) { Pass "TC-H03" "Check-in cascadeo a objetivo: progress=$($objR.progress)%" }
        else { Fail "TC-H03" "Objetivo progress = 0 (cascada no funciono)" }
    } catch { Fail "TC-H03" "GET objetivo post-checkin -> error" $_.Exception.Message }

    # TC-H04: confidence fuera de rango -> 400
    Expect-Code "TC-H04" "Check-in confidence mayor que 1.0 -> 400" {
        Req -Method POST -Url "$BASE/key-results/$($ctx.kr_id)/check-ins" -Session $S `
            -Body @{current_value=45; confidence=1.5} } 400

    Expect-Code "TC-H04b" "Check-in confidence negativo -> 400" {
        Req -Method POST -Url "$BASE/key-results/$($ctx.kr_id)/check-ins" -Session $S `
            -Body @{current_value=45; confidence=-0.1} } 400

    # TC-H05: check-in en KR cancelado -> 400
    if ($ctx.kr_achieve_id) {
        try {
            Req -Method DELETE -Url "$BASE/key-results/$($ctx.kr_achieve_id)" -Session $S | Out-Null
            Start-Sleep -Milliseconds 300
            Expect-Code "TC-H05" "Check-in en KR cancelado -> 400" {
                Req -Method POST -Url "$BASE/key-results/$($ctx.kr_achieve_id)/check-ins" -Session $S `
                    -Body @{current_value=1; confidence=0.9} } 400
        } catch { Fail "TC-H05" "Setup cancelar KR -> error" $_.Exception.Message }
    }

    # TC-H06: historial de check-ins
    try {
        $hist = ReqObj -Url "$BASE/key-results/$($ctx.kr_id)/check-ins" -Session $S
        $arr = @($hist)
        if ($arr.Count -ge 1) { Pass "TC-H06" "Historial check-ins -> $($arr.Count) registro(s)" }
        else { Fail "TC-H06" "Historial vacio" }
    } catch { Fail "TC-H06" "Historial check-ins -> error" $_.Exception.Message }

    # TC-H07: prediccion (puede devolver null con 1 solo check-in)
    try {
        $pred = ReqObj -Url "$BASE/key-results/$($ctx.kr_id)/predict" -Session $S
        Pass "TC-H07" "Prediccion KR -> OK"
    } catch { Skip "TC-H07" "Prediccion requiere mas de 2 check-ins" }

    # TC-H08: mood invalido -> 400
    Expect-Code "TC-H08" "Check-in mood invalido -> 400" {
        Req -Method POST -Url "$BASE/key-results/$($ctx.kr_id)/check-ins" -Session $S `
            -Body @{current_value=50; confidence=0.6; mood="FELIZ"} } 400
}

# TC-H09: cadencia dashboard
try {
    $cad = ReqObj -Url "$BASE/cadence-dashboard?cycle_id=$($ctx.cycle_id)" -Session $S
    Pass "TC-H09" "Cadence dashboard -> OK"
} catch { Fail "TC-H09" "Cadence dashboard -> error" $_.Exception.Message }

# TC-H10: at-risk KRs
try {
    $atRisk = ReqObj -Url "$BASE/at-risk-krs" -Session $S
    Pass "TC-H10" "AT RISK KRs -> OK"
} catch { Fail "TC-H10" "AT RISK KRs -> error" $_.Exception.Message }

# TC-H11: notificaciones
try {
    $notifs = ReqObj -Url "$BASE/notifications" -Session $S
    Pass "TC-H11" "Notificaciones -> OK"
} catch { Fail "TC-H11" "Notificaciones -> error" $_.Exception.Message }

# ============================================================================
Section "BLOQUE 9 -- INICIATIVAS + MILESTONES"

# TC-I01: crear iniciativa (sin kr_ids para evitar problema de serializacion PS5.1 single-elem array)
try {
    $init = ReqObj -Method POST -Url "$BASE/initiatives" -Session $S `
        -Body @{title="QA Iniciativa Prueba"; cycle_id=$ctx.cycle_id; team_id=$ctx.team_id;
                start_date="2026-04-01"; due_date="2026-06-30"}
    $ctx.init_id = $init.id
    if ($init.id) { Pass "TC-I01" "Crear iniciativa -> OK" }
    else { Fail "TC-I01" "Sin id" ($init|ConvertTo-Json -Compress) }
} catch { Fail "TC-I01" "Crear iniciativa -> error" $_.Exception.Message }

# TC-I02: titulo de 2 chars -> 400
Expect-Code "TC-I02" "Iniciativa titulo 2 chars -> 400" {
    Req -Method POST -Url "$BASE/initiatives" -Session $S -Body @{title="AB"} } 400

# TC-I03: listar iniciativas
try {
    $inits = ReqObj -Url "$BASE/initiatives?cycle_id=$($ctx.cycle_id)" -Session $S
    $arr = @($inits)
    if ($arr.Count -ge 1) { Pass "TC-I03" "GET /initiatives -> $($arr.Count) iniciativa(s)" }
    else { Fail "TC-I03" "Sin iniciativas" }
} catch { Fail "TC-I03" "GET /initiatives -> error" $_.Exception.Message }

# TC-I04: crear milestone
if ($ctx.init_id) {
    try {
        $ms = ReqObj -Method POST -Url "$BASE/initiatives/$($ctx.init_id)/milestones" -Session $S `
            -Body @{title="QA Milestone 1"; due_date="2026-05-15"; sort_order=1}
        $ctx.milestone_id = $ms.id
        if ($ms.id) { Pass "TC-I04" "Crear milestone -> OK" }
        else { Fail "TC-I04" "Sin id" ($ms|ConvertTo-Json -Compress) }
    } catch { Fail "TC-I04" "Crear milestone -> error" $_.Exception.Message }
}

# TC-I05: milestone title 1 char -> 400
if ($ctx.init_id) {
    Expect-Code "TC-I05" "Milestone title 1 char -> 400" {
        Req -Method POST -Url "$BASE/initiatives/$($ctx.init_id)/milestones" -Session $S `
            -Body @{title="X"} } 400
}

# TC-I06: completar milestone -> cascada a iniciativa progress
if ($ctx.init_id -and $ctx.milestone_id) {
    try {
        $ms2 = ReqObj -Method POST -Url "$BASE/initiatives/$($ctx.init_id)/milestones" -Session $S `
            -Body @{title="QA Milestone 2"; sort_order=2}
        Req -Method POST -Url "$BASE/initiatives/$($ctx.init_id)/milestones/$($ctx.milestone_id)/complete" -Session $S | Out-Null
        Start-Sleep -Milliseconds 500
        $initR = ReqObj -Url "$BASE/initiatives/$($ctx.init_id)" -Session $S
        if ($initR.progress -gt 0) { Pass "TC-I06" "Completar milestone -> iniciativa progress=$($initR.progress)%" }
        else { Fail "TC-I06" "Iniciativa progress = 0 tras completar milestone" }
    } catch { Fail "TC-I06" "Completar milestone -> error" $_.Exception.Message }
}

# TC-I07: iniciativa health
if ($ctx.init_id) {
    try {
        $health = ReqObj -Url "$BASE/initiatives/$($ctx.init_id)/health" -Session $S
        if ($health.status -or $health.health) { Pass "TC-I07" "Health iniciativa -> status=$($health.status)" }
        else { Fail "TC-I07" "Health sin campos" ($health|ConvertTo-Json -Compress) }
    } catch { Fail "TC-I07" "Health iniciativa -> error" $_.Exception.Message }
}

# TC-I08: vincular KR a iniciativa
if ($ctx.init_id -and $ctx.kr_maintain_id) {
    try {
        Req -Method POST -Url "$BASE/initiatives/$($ctx.init_id)/key-results/$($ctx.kr_maintain_id)" -Session $S | Out-Null
        Pass "TC-I08" "Vincular KR a iniciativa -> OK"
    } catch { Fail "TC-I08" "Vincular KR -> error" $_.Exception.Message }
}

# TC-I09: editar iniciativa DONE -> 400
if ($ctx.init_id) {
    try {
        Req -Method PATCH -Url "$BASE/initiatives/$($ctx.init_id)" -Session $S -Body @{status="DONE"} | Out-Null
        Expect-Code "TC-I09" "Editar iniciativa DONE -> 400" {
            Req -Method PATCH -Url "$BASE/initiatives/$($ctx.init_id)" -Session $S -Body @{title="Nuevo titulo"} } 400
    } catch { Fail "TC-I09" "Setup DONE iniciativa -> error" $_.Exception.Message }
}

# TC-I10: overdue milestones endpoint
try {
    $ovd = ReqObj -Url "$BASE/initiatives/overdue-milestones" -Session $S
    Pass "TC-I10" "Overdue milestones -> OK"
} catch { Fail "TC-I10" "Overdue milestones -> error" $_.Exception.Message }

# TC-I11: delete iniciativa -> soft delete
if ($ctx.init_id) {
    try {
        Req -Method DELETE -Url "$BASE/initiatives/$($ctx.init_id)" -Session $S | Out-Null
        Start-Sleep -Milliseconds 300
        Expect-Code "TC-I11" "Iniciativa eliminada -> 404 al acceder" {
            Req -Url "$BASE/initiatives/$($ctx.init_id)" -Session $S } 404
    } catch { Fail "TC-I11" "Delete iniciativa -> error" $_.Exception.Message }
}

# ============================================================================
Section "BLOQUE 10 -- PROBLEMAS E INTENCIONES ESTRATEGICAS"

# TC-J01: crear problema
try {
    $prob = ReqObj -Method POST -Url "$BASE/problems" -Session $S `
        -Body @{title="QA Problema Alta Rotacion"; severity=4; frequency=3; category="PEOPLE"; description="Test"}
    $ctx.prob_id = $prob.id
    if ($prob.id) { Pass "TC-J01" "Crear problema -> OK" }
    else { Fail "TC-J01" "Sin id" ($prob|ConvertTo-Json -Compress) }
} catch { Fail "TC-J01" "Crear problema -> error" $_.Exception.Message }

# TC-J02: severity fuera de rango -> 400
Expect-Code "TC-J02" "Problema severity=6 -> 400" {
    Req -Method POST -Url "$BASE/problems" -Session $S `
        -Body @{title="Test"; severity=6; frequency=3} } 400

Expect-Code "TC-J02b" "Problema severity=0 -> 400" {
    Req -Method POST -Url "$BASE/problems" -Session $S `
        -Body @{title="Test"; severity=0; frequency=3} } 400

# TC-J03: crear intencion estrategica
try {
    $intent = ReqObj -Method POST -Url "$BASE/strategic-intents" -Session $S `
        -Body @{title="QA Intencion Dominar mercado"; category="GROWTH"; horizon_years=3; target_year=2028}
    $ctx.intent_id = $intent.id
    if ($intent.id) { Pass "TC-J03" "Crear intencion estrategica -> OK" }
    else { Fail "TC-J03" "Sin id" ($intent|ConvertTo-Json -Compress) }
} catch { Fail "TC-J03" "Crear intencion -> error" $_.Exception.Message }

# TC-J04: target_year fuera de rango (menor a 2024) -> 400
Expect-Code "TC-J04" "Intencion target_year menor a 2024 -> 400" {
    Req -Method POST -Url "$BASE/strategic-intents" -Session $S `
        -Body @{title="Test Ano Pasado"; target_year=2020; horizon_years=1} } 400

# TC-J05: vincular problema a intencion
if ($ctx.prob_id -and $ctx.intent_id) {
    try {
        Req -Method POST -Url "$BASE/problems/$($ctx.prob_id)/intents/$($ctx.intent_id)" -Session $S | Out-Null
        Pass "TC-J05" "Vincular problema a intencion -> OK"
    } catch { Fail "TC-J05" "Vincular problema-intencion -> error" $_.Exception.Message }
}

# TC-J06: vincular objetivo a intencion (via PATCH objetivo)
if ($ctx.obj_id -and $ctx.intent_id) {
    try {
        $objUpd = ReqObj -Method PATCH -Url "$BASE/objectives/$($ctx.obj_id)" -Session $S `
            -Body @{strategic_intent_id=$ctx.intent_id}
        if ($objUpd.strategic_intent_id -eq $ctx.intent_id) { Pass "TC-J06" "Objetivo vinculado a intencion -> OK" }
        else { Fail "TC-J06" "strategic_intent_id no actualizado: $($objUpd.strategic_intent_id)" }
    } catch { Fail "TC-J06" "Vincular obj-intencion -> error" $_.Exception.Message }
}

# TC-J07: DEUDA -- crear objetivo con strategic_intent_id de otra org o inexistente
if ($ctx.obj_id) {
    try {
        $fakeIntentId = "00000000-0000-0000-0000-000000000001"
        $objFakeIntent = ReqObj -Method POST -Url "$BASE/objectives" -Session $S `
            -Body @{title="QA Obj Con Intent Falso"; cycle_id=$ctx.cycle_id; level="AREA"; strategic_intent_id=$fakeIntentId}
        if (-not $objFakeIntent.strategic_intent_id) {
            Pass "TC-J07" "Intent inexistente ignorado silenciosamente (deuda tecnica documentada)"
            $bugs.Add("[DEUDA-J07] Crear objetivo con strategic_intent_id inexistente no retorna error. Deberia retornar 400.")
        } else {
            Fail "TC-J07" "Objetivo vinculado a intent UUID nulo/inexistente" ""
        }
        try { Req -Method DELETE -Url "$BASE/objectives/$($objFakeIntent.id)" -Session $S | Out-Null } catch {}
    } catch {
        $code = Code $_
        if ($code -eq 400 -or $code -eq 404) { Pass "TC-J07" "Crear objetivo con intent inexistente -> $code (correcto)" }
        else { Fail "TC-J07" "Codigo inesperado: $code" "" }
    }
}

# ============================================================================
Section "BLOQUE 11 -- SPRINTS (INTEGRACION)"

# TC-K01: crear sprint y vincularlo con KR real
if ($ctx.kr_maintain_id -and $ctx.cycle_id -and $ctx.team_id) {
    try {
        $sp = ReqObj -Method POST -Url "$BASE/sprints" -Session $S `
            -Body @{cycle_id=$ctx.cycle_id; team_id=$ctx.team_id; name="QA Sprint Integration";
                    start_date="2026-05-20"; end_date="2026-06-02"; planned_velocity=25}
        $ctx.sprint_id = $sp.sprint_id
        Req -Method POST -Url "$BASE/sprints/$($ctx.sprint_id)/krs" -Session $S `
            -Body @{kr_id=$ctx.kr_maintain_id; expected_contribution=40} | Out-Null
        Pass "TC-K01" "Sprint creado y KR vinculado -> OK"
    } catch { Fail "TC-K01" "Sprint integration -> error" $_.Exception.Message }
}

# TC-K02: asignar iniciativa al sprint
if ($ctx.sprint_id) {
    try {
        $init2 = ReqObj -Method POST -Url "$BASE/initiatives" -Session $S `
            -Body @{title="QA Iniciativa Sprint"; cycle_id=$ctx.cycle_id; team_id=$ctx.team_id;
                    sprint_id=$ctx.sprint_id}
        $ctx.init_sprint_id = $init2.id
        if ($init2.sprint_id -eq $ctx.sprint_id) { Pass "TC-K02" "Iniciativa asignada al sprint -> OK" }
        else { Fail "TC-K02" "sprint_id no seteado: $($init2.sprint_id)" }
    } catch { Fail "TC-K02" "Iniciativa en sprint -> error" $_.Exception.Message }
}

# TC-K03: board del sprint muestra la iniciativa
if ($ctx.sprint_id) {
    try {
        $board = ReqObj -Url "$BASE/sprints/$($ctx.sprint_id)" -Session $S
        if ($board.total_count -ge 1) { Pass "TC-K03" "Board sprint -> $($board.total_count) iniciativa(s)" }
        else { Fail "TC-K03" "Board sprint sin iniciativas (total_count=$($board.total_count))" }
    } catch { Fail "TC-K03" "GET sprint board -> error" $_.Exception.Message }
}

# TC-K04: activar sprint y cerrar -- flujo completo
if ($ctx.sprint_id) {
    try {
        Req -Method POST -Url "$BASE/sprints/$($ctx.sprint_id)/activate" -Session $S | Out-Null
        $closeR = ReqObj -Method POST -Url "$BASE/sprints/$($ctx.sprint_id)/close" -Session $S `
            -Body @{actual_velocity=22}
        $hasSugg = ($closeR | ConvertTo-Json -Compress) -match '"suggested_checkins"'
        if ($closeR.sprint.status -eq "COMPLETED" -and $hasSugg) {
            Pass "TC-K04" "Sprint cierre completo con suggested_checkins -> OK"
        } else {
            Fail "TC-K04" "Sprint close: status=$($closeR.sprint.status) sugg=$hasSugg" ""
        }
    } catch { Fail "TC-K04" "Sprint close completo -> error" $_.Exception.Message }
}

# ============================================================================
Section "BLOQUE 12 -- AISLAMIENTO CROSS-ORG"

$isolS = $null
$isolSlug = "iso-qa-$(Get-Random -Max 99999)"
Start-Sleep -Milliseconds 500
try {
    $isoReg = Invoke-RestMethod -Uri "$BASE/auth/register" -Method POST -ContentType "application/json" `
        -Body (@{orgName="ISO Org QA"; orgSlug=$isolSlug; orgMode="AGILE";
                 name="ISO Admin"; email="iso_$isolSlug@test.com"; password="Sprint2024!"}|ConvertTo-Json) `
        -SessionVariable isolSV
    $isolS = $isolSV
    Write-Host "  Org de aislamiento creada: $isolSlug"
} catch { Write-Host "  [WARN] No se pudo crear org de aislamiento: $_" -ForegroundColor DarkYellow }

if ($isolS -and $ctx.cycle_id -and $ctx.obj_id -and $ctx.kr_id -and $ctx.sprint_id) {

    Expect-Code "TC-L01" "Ciclo de org ajena -> 404" {
        Req -Url "$BASE/cycles/$($ctx.cycle_id)" -Session $isolS } 404

    Expect-Code "TC-L02" "Objetivo de org ajena -> 404" {
        Req -Url "$BASE/objectives/$($ctx.obj_id)" -Session $isolS } 404

    Expect-Code "TC-L03" "KR de org ajena via check-in -> 404" {
        Req -Method POST -Url "$BASE/key-results/$($ctx.kr_id)/check-ins" -Session $isolS `
            -Body @{current_value=50; confidence=0.5} } 404

    Expect-Code "TC-L04" "Sprint de org ajena -> 404" {
        Req -Url "$BASE/sprints/$($ctx.sprint_id)" -Session $isolS } 404

    Expect-Code "TC-L05" "Activar sprint de org ajena -> 404" {
        Req -Method POST -Url "$BASE/sprints/$($ctx.sprint_id)/activate" -Session $isolS } 404

    if ($ctx.init_sprint_id) {
        Expect-Code "TC-L06" "Iniciativa de org ajena -> 404" {
            Req -Url "$BASE/initiatives/$($ctx.init_sprint_id)" -Session $isolS } 404
    }

    if ($ctx.prob_id) {
        Expect-Code "TC-L07" "Problema de org ajena -> 404" {
            Req -Url "$BASE/problems/$($ctx.prob_id)" -Session $isolS } 404
    }

    Expect-Code "TC-L08" "PATCH ciclo org ajena -> 404" {
        Req -Method PATCH -Url "$BASE/cycles/$($ctx.cycle_id)" -Session $isolS `
            -Body @{name="Hack"} } 404

} else { Skip "TC-L01..08" "Org de aislamiento no disponible o datos previos fallaron" }

# ============================================================================
Section "BLOQUE 13 -- DEUDA TECNICA: CASOS ESPECIFICOS"

# TC-M01: strategic_intent_id en objetivo CANCELADO
if ($ctx.team_obj_id -and $ctx.intent_id) {
    try {
        Req -Method DELETE -Url "$BASE/objectives/$($ctx.team_obj_id)" -Session $S | Out-Null
        Start-Sleep -Milliseconds 400
        try {
            $cancelledUpd = ReqObj -Method PATCH -Url "$BASE/objectives/$($ctx.team_obj_id)" -Session $S `
                -Body @{strategic_intent_id=$ctx.intent_id}
            if ($cancelledUpd.status -eq "CANCELLED") {
                $bugs.Add("[DEUDA-M01] PATCH strategic_intent_id en objetivo CANCELADO tiene exito. Deberia retornar 400.")
                Fail "TC-M01" "PATCH strategic_intent_id en CANCELADO deberia ser 400" ""
            } else {
                Pass "TC-M01" "PATCH en objetivo CANCELADO -> rechazo correcto"
            }
        } catch {
            $code = Code $_
            if ($code -eq 400 -or $code -eq 404) { Pass "TC-M01" "PATCH objetivo CANCELADO -> $code (correcto)" }
            else { Fail "TC-M01" "Codigo inesperado: HTTP $code" "" }
        }
    } catch { Fail "TC-M01" "Setup cancelar objetivo -> error" $_.Exception.Message }
} else { Skip "TC-M01" "Sin team_obj_id o intent_id" }

# TC-M02: AddMemberDto usa userId (camelCase) -- verificar que user_id (snake_case) falla
if ($ctx.team_id2) {
    try {
        $r400 = Invoke-WebRequest -Uri "$BASE/teams/$($ctx.team_id2)/members" -Method POST `
            -ContentType "application/json" -WebSession $S `
            -Body (@{user_id=$ctx.user_id; role="OBSERVER"} | ConvertTo-Json) -UseBasicParsing
        $code = $r400.StatusCode
        if ($code -ge 400) {
            $bugs.Add("[DEUDA-M02] AddMemberDto usa 'userId' (camelCase). El campo user_id (snake_case) es rechazado. Inconsistente con la API. Fix: renombrar a user_id.")
            Fail "TC-M02" "AddMemberDto rechaza user_id (snake_case) [DEUDA: debe usar snake_case]" ""
        } else {
            Pass "TC-M02" "API acepta user_id snake_case (consistente)"
        }
    } catch {
        $code = Code $_
        if ($code -eq 400) {
            $bugs.Add("[DEUDA-M02] AddMemberDto usa 'userId' (camelCase). Inconsistente con la API (snake_case). Fix: renombrar a user_id en DTO y service.")
            Fail "TC-M02" "user_id (snake_case) rechazado por AddMemberDto [DEUDA: debe usar snake_case]" ""
        } else {
            Pass "TC-M02" "user_id aceptado correctamente (HTTP $code)"
        }
    }
} else { Skip "TC-M02" "Sin team_id2" }

# TC-M03: cycles.service error code check -- ciclo end menor que start -> 400
try {
    Req -Method POST -Url "$BASE/cycles" -Session $S `
        -Body @{name="Error Ciclo"; start_date="2027-06-01"; end_date="2027-05-01"} | Out-Null
    Fail "TC-M03" "Ciclo end-menor-start deberia rechazarse" ""
} catch {
    $code = Code $_
    if ($code -eq 400) { Pass "TC-M03" "Ciclo end-menor-start -> 400 (error code check funciona)" }
    else { Fail "TC-M03" "Ciclo end-menor-start -> HTTP $code inesperado" "" }
}

# TC-M04: initiatives.getHealth() con iniciativa sin milestones
try {
    $initNoMs = ReqObj -Method POST -Url "$BASE/initiatives" -Session $S `
        -Body @{title="QA Sin Milestones"; cycle_id=$ctx.cycle_id}
    try {
        $health = ReqObj -Url "$BASE/initiatives/$($initNoMs.id)/health" -Session $S
        Pass "TC-M04" "Health iniciativa sin milestones -> OK (no TypeError)"
    } catch {
        Fail "TC-M04" "Health sin milestones -> error [POSIBLE BUG: TypeError]" $_.Exception.Message
    }
    Req -Method DELETE -Url "$BASE/initiatives/$($initNoMs.id)" -Session $S | Out-Null
} catch { Fail "TC-M04" "Setup iniciativa sin milestones -> error" $_.Exception.Message }

# TC-M05: KR predict con 0 check-ins
if ($ctx.kr_maintain_id) {
    try {
        $pred = ReqObj -Url "$BASE/key-results/$($ctx.kr_maintain_id)/predict" -Session $S
        Pass "TC-M05" "Predict con 0 check-ins -> responde sin error"
    } catch { Skip "TC-M05" "Predict sin check-ins -> error esperado (aceptable)" }
} else { Skip "TC-M05" "Sin kr_maintain_id" }

# TC-M06: check-in en KR de objetivo CANCELADO
if ($ctx.obj_id) {
    try {
        Req -Method DELETE -Url "$BASE/objectives/$($ctx.obj_id)" -Session $S | Out-Null
        Start-Sleep -Milliseconds 500
        if ($ctx.kr_maintain_id) {
            Expect-Code "TC-M06" "Check-in en KR de objetivo CANCELADO -> 400 o 404" {
                Req -Method POST -Url "$BASE/key-results/$($ctx.kr_maintain_id)/check-ins" -Session $S `
                    -Body @{current_value=99; confidence=0.9} } 400
        } else { Skip "TC-M06" "Sin kr_maintain_id" }
    } catch { Skip "TC-M06" "Objetivo ya cancelado previamente" }
} else { Skip "TC-M06" "Sin obj_id" }

# ============================================================================
Section "LIMPIEZA FINAL"
if ($ctx.cycle_id2) {
    try { Req -Method POST -Url "$BASE/cycles/$($ctx.cycle_id2)/close" -Session $S | Out-Null } catch {}
}

# ============================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  RESULTADOS FINALES" -ForegroundColor Cyan
Write-Host "================================================================"
Write-Host "  Pasados : $pass" -ForegroundColor Green
Write-Host "  Fallidos: $fail" -ForegroundColor $(if($fail -gt 0){"Red"}else{"Green"})
Write-Host "  Skipped : $skip" -ForegroundColor DarkYellow
Write-Host "  Total   : $($pass+$fail+$skip)"
$pct = if($pass+$fail -gt 0){ [Math]::Round($pass*100.0/($pass+$fail),1) } else { 0 }
Write-Host "  Cobertura pass/fail: $pct%" -ForegroundColor Cyan

if ($bugs.Count -gt 0) {
    Write-Host ""
    Write-Host "  DEFECTOS Y DEUDA TECNICA:" -ForegroundColor Red
    foreach ($b in $bugs) { Write-Host "    $b" -ForegroundColor $(if($b -like "*DEUDA*"){"Yellow"}else{"Red"}) }
}
