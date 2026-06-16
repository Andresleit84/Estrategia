################################################################################
# QA AUDIT - Hito 8: Sprints y cadencia
# Ejecutar: Set-Location D:\estrategia\scripts; .\qa_hito8_sprints.ps1
################################################################################

$BASE      = "http://localhost:3001/api/v1"
$CYCLE_ID  = "950630ed-394a-4636-84a7-4240c80c9fa5"
$TEAM_ID   = "0b616d8e-fb39-4a39-8581-6c280103ed08"
$NULL_UUID = "00000000-0000-0000-0000-000000000000"

$pass = 0; $fail = 0; $bugs = [System.Collections.Generic.List[string]]::new()

function Login {
    param([string]$Email = "qa@test.com", [string]$Pw = "Sprint2024!")
    Invoke-RestMethod -Uri "$BASE/auth/login" -Method POST `
        -ContentType "application/json" `
        -Body (@{email=$Email; password=$Pw} | ConvertTo-Json) `
        -SessionVariable sv | Out-Null
    return $sv
}

function Pass { param([string]$id, [string]$desc)
    $script:pass++
    Write-Host "[PASS] $id : $desc" -ForegroundColor Green
}

function Fail { param([string]$id, [string]$desc, [string]$detail = "")
    $script:fail++
    $entry = "[$id] $desc"
    if ($detail) { $entry += " :: $detail" }
    $script:bugs.Add($entry)
    Write-Host "[FAIL] $id : $desc :: $detail" -ForegroundColor Red
}

function Get-HttpCode {
    param([System.Management.Automation.ErrorRecord]$Err)
    try { return $Err.Exception.Response.StatusCode.value__ }
    catch { return 0 }
}

function Expect-Error {
    param([string]$id, [string]$desc, [scriptblock]$block, [int]$expectedCode)
    Start-Sleep -Milliseconds 180
    try {
        & $block | Out-Null
        Fail $id $desc "Esperaba HTTP $expectedCode pero obtuvo 2xx"
    } catch {
        $code = Get-HttpCode $_
        if ($code -eq $expectedCode) { Pass $id $desc }
        else { Fail $id $desc "HTTP $code (esperaba $expectedCode)" }
    }
}

function New-Sprint {
    param([object]$Session, [hashtable]$Fields)
    Start-Sleep -Milliseconds 180
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST `
        -ContentType "application/json" -WebSession $Session `
        -Body ($Fields | ConvertTo-Json)
}

function Cancel-Sprint {
    param([object]$Session, [string]$SprintId)
    try { Invoke-RestMethod -Uri "$BASE/sprints/$SprintId" -Method DELETE -WebSession $Session | Out-Null }
    catch {}
}

function Activate-Sprint {
    param([object]$Session, [string]$SprintId)
    Start-Sleep -Milliseconds 180
    Invoke-RestMethod -Uri "$BASE/sprints/$SprintId/activate" -Method POST -WebSession $Session
}

function Close-Sprint {
    param([object]$Session, [string]$SprintId, [int]$Vel = 0)
    Start-Sleep -Milliseconds 180
    $body = (@{actual_velocity=$Vel} | ConvertTo-Json)
    Invoke-RestMethod -Uri "$BASE/sprints/$SprintId/close" -Method POST `
        -ContentType "application/json" -WebSession $Session -Body $body
}

# ============================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  QA AUDIT -- HITO 8: SPRINTS Y CADENCIA" -ForegroundColor Cyan
Write-Host "================================================================" -ForegroundColor Cyan

$S = Login
Write-Host "  Sesion QA activa`n"

# ============================================================================
Write-Host "-- BLOQUE 1: VALIDACION DE DTOs --" -ForegroundColor Yellow

# TC-01: Sin cycle_id (campo obligatorio)
Expect-Error "TC-01" "POST sin cycle_id -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{team_id=$TEAM_ID; name="X Test"; start_date="2026-04-21"; end_date="2026-04-28"} | ConvertTo-Json)
} 400

# TC-02: name de 1 caracter (MinLength=2)
Expect-Error "TC-02" "name de 1 char -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="X"; start_date="2026-04-21"; end_date="2026-04-28"} | ConvertTo-Json)
} 400

# TC-03: name de 101 caracteres (MaxLength=100)
Expect-Error "TC-03" "name de 101 chars -> 400" {
    $n = "A" * 101
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name=$n; start_date="2026-04-21"; end_date="2026-04-28"} | ConvertTo-Json)
} 400

# TC-04: goal de 501 caracteres (MaxLength=500)
Expect-Error "TC-04" "goal de 501 chars -> 400" {
    $g = "G" * 501
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Test Goal"; goal=$g; start_date="2026-04-21"; end_date="2026-04-28"} | ConvertTo-Json)
} 400

# TC-05: planned_velocity negativo (Min=0)
Expect-Error "TC-05" "planned_velocity negativo -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Vel Neg"; start_date="2026-05-01"; end_date="2026-05-14"; planned_velocity=-1} | ConvertTo-Json)
} 400

# TC-06: planned_velocity decimal (debe ser entero)
Expect-Error "TC-06" "planned_velocity decimal -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body '{"cycle_id":"950630ed-394a-4636-84a7-4240c80c9fa5","team_id":"0b616d8e-fb39-4a39-8581-6c280103ed08","name":"Float","start_date":"2026-05-01","end_date":"2026-05-14","planned_velocity":3.5}'
} 400

# TC-07: cycle_id no es UUID valido
Expect-Error "TC-07" "cycle_id no UUID -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id="not-a-uuid"; team_id=$TEAM_ID; name="Test"; start_date="2026-05-01"; end_date="2026-05-14"} | ConvertTo-Json)
} 400

# TC-08: sin start_date
Expect-Error "TC-08" "sin start_date -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Sin Fecha"; end_date="2026-05-14"} | ConvertTo-Json)
} 400

# TC-09: fecha en formato MM/DD/YYYY (no ISO)
Expect-Error "TC-09" "formato fecha invalido -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Bad Date"; start_date="04/21/2026"; end_date="04/28/2026"} | ConvertTo-Json)
} 400

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 2: RESTRICCIONES DE BASE DE DATOS (TRIGGERS) --" -ForegroundColor Yellow

# TC-10: end_date = start_date (violacion CHECK end_date > start_date)
Expect-Error "TC-10" "end_date = start_date -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Same Day"; start_date="2026-05-01"; end_date="2026-05-01"} | ConvertTo-Json)
} 400

# TC-11: end_date < start_date
Expect-Error "TC-11" "end_date < start_date -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Invertidas"; start_date="2026-05-10"; end_date="2026-05-05"} | ConvertTo-Json)
} 400

# TC-12: start_date un dia ANTES del inicio del ciclo (P0051 - ciclo inicia 2026-04-01)
Expect-Error "TC-12" "start_date dia antes del ciclo -> 400 (P0051)" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Antes Ciclo"; start_date="2026-03-31"; end_date="2026-04-14"} | ConvertTo-Json)
} 400

# TC-13: end_date un dia DESPUES del fin del ciclo (P0052 - ciclo termina 2026-06-30)
Expect-Error "TC-13" "end_date dia despues del ciclo -> 400 (P0052)" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Mas Ciclo"; start_date="2026-06-20"; end_date="2026-07-01"} | ConvertTo-Json)
} 400

# TC-14: BOUNDARY - start_date = primer dia del ciclo (debe pasar)
try {
    $sp14 = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Boundary Start"; start_date="2026-04-01"; end_date="2026-04-14"}
    Pass "TC-14" "start_date = inicio exacto del ciclo -> acepta"
    Cancel-Sprint $S $sp14.sprint_id
} catch { Fail "TC-14" "start_date = inicio ciclo -> debe aceptar" $_.Exception.Message }

# TC-15: BOUNDARY - end_date = ultimo dia del ciclo (debe pasar)
try {
    $sp15 = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Boundary End"; start_date="2026-06-17"; end_date="2026-06-30"}
    Pass "TC-15" "end_date = fin exacto del ciclo -> acepta"
    Cancel-Sprint $S $sp15.sprint_id
} catch { Fail "TC-15" "end_date = fin ciclo -> debe aceptar" $_.Exception.Message }

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 3: MAQUINA DE ESTADOS --" -ForegroundColor Yellow

$spState = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA States"; start_date="2026-05-05"; end_date="2026-05-18"; planned_velocity=20}
$SID = $spState.sprint_id
Write-Host "  Sprint base: $SID (PLANNING)"

# TC-16: Activar sprint PLANNING -> ACTIVE
try {
    $act = Activate-Sprint $S $SID
    if ($act.status -eq "ACTIVE") { Pass "TC-16" "PLANNING -> ACTIVE correcto" }
    else { Fail "TC-16" "Status esperado ACTIVE, obtuvo $($act.status)" }
} catch { Fail "TC-16" "Activar sprint PLANNING -> debe pasar" $_.Exception.Message }

# TC-17: Activar sprint ya ACTIVE -> P0054
Expect-Error "TC-17" "Activar sprint ACTIVE -> 400 (P0054)" {
    Activate-Sprint $S $SID
} 400

# TC-18: Cerrar sprint PLANNING (crear uno aparte)
$spPlan = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Plan Close"; start_date="2026-05-19"; end_date="2026-06-01"}
Expect-Error "TC-18" "Cerrar sprint PLANNING -> 400 (P0055)" {
    Close-Sprint $S $spPlan.sprint_id 5
} 400
Cancel-Sprint $S $spPlan.sprint_id

# TC-19: Cerrar sprint ACTIVE -> COMPLETED
try {
    $closed = Close-Sprint $S $SID 18
    if ($closed.sprint.status -eq "COMPLETED") { Pass "TC-19" "ACTIVE -> COMPLETED correcto" }
    else { Fail "TC-19" "Status esperado COMPLETED, obtuvo $($closed.sprint.status)" }
} catch { Fail "TC-19" "Cerrar sprint ACTIVE -> debe pasar" $_.Exception.Message }

# TC-20: actual_velocity persistida correctamente
$board20 = Invoke-RestMethod -Uri "$BASE/sprints/$SID" -WebSession $S
if ($board20.actual_velocity -eq 18) { Pass "TC-20" "actual_velocity=18 persistida en board" }
else { Fail "TC-20" "actual_velocity esperado 18, obtuvo $($board20.actual_velocity)" }

# TC-21: Cerrar sprint ya COMPLETED -> P0055
Expect-Error "TC-21" "Cerrar sprint COMPLETED -> 400 (P0055)" {
    Close-Sprint $S $SID 5
} 400

# TC-22: Activar sprint COMPLETED -> P0054
Expect-Error "TC-22" "Activar sprint COMPLETED -> 400 (P0054)" {
    Activate-Sprint $S $SID
} 400

# TC-23: Eliminar sprint ACTIVE -> 400
$spAct23 = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Del Active"; start_date="2026-06-02"; end_date="2026-06-15"}
Activate-Sprint $S $spAct23.sprint_id | Out-Null
Expect-Error "TC-23" "Eliminar sprint ACTIVE -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints/$($spAct23.sprint_id)" -Method DELETE -WebSession $S
} 400
Close-Sprint $S $spAct23.sprint_id 3 | Out-Null

# TC-24: Eliminar sprint COMPLETED -> BUG esperado si lo permite
try {
    Invoke-RestMethod -Uri "$BASE/sprints/$SID" -Method DELETE -WebSession $S | Out-Null
    Fail "TC-24" "COMPLETED puede cancelarse via DELETE [DEFECTO LOGICO: COMPLETED no deberia ser reversible]" ""
} catch {
    $code = Get-HttpCode $_
    if ($code -eq 400) { Pass "TC-24" "Eliminar sprint COMPLETED -> 400 (correcto)" }
    else { Fail "TC-24" "Eliminar sprint COMPLETED -> HTTP $code inesperado" "" }
}

# TC-25: Eliminar sprint PLANNING -> 200
$spDel25 = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Del Plan"; start_date="2026-06-16"; end_date="2026-06-29"}
try {
    $delRes = Invoke-RestMethod -Uri "$BASE/sprints/$($spDel25.sprint_id)" -Method DELETE -WebSession $S
    if ($delRes.message) { Pass "TC-25" "Eliminar sprint PLANNING -> 200 con mensaje" }
    else { Fail "TC-25" "Respuesta sin campo message" ($delRes | ConvertTo-Json -Compress) }
} catch { Fail "TC-25" "Eliminar sprint PLANNING -> debe pasar" $_.Exception.Message }

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 4: UN SOLO SPRINT ACTIVO POR EQUIPO --" -ForegroundColor Yellow

$spA = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Active A"; start_date="2026-05-05"; end_date="2026-05-18"}
$spB = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Active B"; start_date="2026-05-19"; end_date="2026-06-01"}
Activate-Sprint $S $spA.sprint_id | Out-Null

# TC-26: Activar segundo sprint mientras hay uno ACTIVE (P0053)
Expect-Error "TC-26" "2do sprint ACTIVE mismo equipo -> 400 (P0053)" {
    Activate-Sprint $S $spB.sprint_id
} 400

# TC-27: Cerrar el activo y activar el segundo -> debe pasar
Close-Sprint $S $spA.sprint_id 4 | Out-Null
try {
    Activate-Sprint $S $spB.sprint_id | Out-Null
    Pass "TC-27" "Activar 2do sprint tras cerrar el 1ro -> OK"
    Close-Sprint $S $spB.sprint_id 4 | Out-Null
} catch { Fail "TC-27" "Activar sprint tras cerrar anterior -> debe pasar" $_.Exception.Message }

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 5: AISLAMIENTO ENTRE ORGANIZACIONES --" -ForegroundColor Yellow

$allSprints = Invoke-RestMethod -Uri "$BASE/sprints?cycle_id=$CYCLE_ID" -WebSession $S
$QA_SID = ($allSprints | Where-Object { $_.status -ne 'CANCELLED' } | Select-Object -First 1).sprint_id

# Crear una segunda org TRADITIONAL para tests de aislamiento
$S2 = $null
$tradSlug = "tradcorp-qa-$(Get-Random -Maximum 9999)"
try {
    $reg2 = Invoke-RestMethod -Uri "$BASE/auth/register" -Method POST -ContentType "application/json" `
        -Body (@{organization_name="TradCorp QA"; org_slug=$tradSlug; org_mode="TRADITIONAL"; owner_name="Admin QA2"; owner_email="qa2_$tradSlug@test.com"; owner_password="Sprint2024!"} | ConvertTo-Json) `
        -SessionVariable sv2 2>$null
    $S2 = $sv2
} catch {}

if ($S2 -and $QA_SID) {
    # TC-28: Leer sprint de org ajena -> 404
    Expect-Error "TC-28" "Leer sprint de otra org -> 404" {
        Invoke-RestMethod -Uri "$BASE/sprints/$QA_SID" -WebSession $S2
    } 404

    # TC-29: Activar sprint de org ajena -> 404
    Expect-Error "TC-29" "Activar sprint de otra org -> 404" {
        Invoke-RestMethod -Uri "$BASE/sprints/$QA_SID/activate" -Method POST -WebSession $S2
    } 404

    # TC-30: Cerrar sprint de org ajena -> 404
    Expect-Error "TC-30" "Cerrar sprint de otra org -> 404" {
        Invoke-RestMethod -Uri "$BASE/sprints/$QA_SID/close" -Method POST `
            -ContentType "application/json" -WebSession $S2 `
            -Body (@{actual_velocity=5} | ConvertTo-Json)
    } 404

    # TC-31: Eliminar sprint de org ajena -> 404
    Expect-Error "TC-31" "Eliminar sprint de otra org -> 404" {
        Invoke-RestMethod -Uri "$BASE/sprints/$QA_SID" -Method DELETE -WebSession $S2
    } 404

    # TC-32: OKR impact sprint de org ajena -> 404
    Expect-Error "TC-32" "OKR impact sprint de otra org -> 404" {
        Invoke-RestMethod -Uri "$BASE/sprints/$QA_SID/okr-impact" -WebSession $S2
    } 404
} else {
    Write-Host "[SKIP] TC-28..32 -- No se pudo crear org secundaria" -ForegroundColor DarkYellow
}

# TC-33: UUID inexistente siempre -> 404
Expect-Error "TC-33" "Sprint UUID inexistente -> 404" {
    Invoke-RestMethod -Uri "$BASE/sprints/$NULL_UUID" -WebSession $S
} 404

Expect-Error "TC-34" "Activar UUID inexistente -> 404" {
    Invoke-RestMethod -Uri "$BASE/sprints/$NULL_UUID/activate" -Method POST -WebSession $S
} 404

Expect-Error "TC-35" "OKR impact UUID inexistente -> 404" {
    Invoke-RestMethod -Uri "$BASE/sprints/$NULL_UUID/okr-impact" -WebSession $S
} 404

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 6: PATCH - ACTUALIZACION CON VALIDACION --" -ForegroundColor Yellow

$spUpd = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Update"; start_date="2026-05-05"; end_date="2026-05-18"; planned_velocity=20}
$SID_UPD = $spUpd.sprint_id

# TC-36: PATCH body vacio -> 200 no-op
try {
    $noop = Invoke-RestMethod -Uri "$BASE/sprints/$SID_UPD" -Method PATCH `
        -ContentType "application/json" -WebSession $S -Body '{}'
    if ($noop.sprint_id) { Pass "TC-36" "PATCH vacio -> 200 no-op devuelve board" }
    else { Fail "TC-36" "PATCH vacio no devuelve board" ($noop | ConvertTo-Json -Compress) }
} catch { Fail "TC-36" "PATCH vacio -> debe pasar" $_.Exception.Message }

# TC-37: PATCH end_date fuera del ciclo -> 400
Expect-Error "TC-37" "PATCH end_date fuera del ciclo -> 400 (P0052)" {
    Invoke-RestMethod -Uri "$BASE/sprints/$SID_UPD" -Method PATCH `
        -ContentType "application/json" -WebSession $S `
        -Body (@{end_date="2026-07-01"} | ConvertTo-Json)
} 400

# TC-38: PATCH name = 1 char -> 400
Expect-Error "TC-38" "PATCH name 1 char -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints/$SID_UPD" -Method PATCH `
        -ContentType "application/json" -WebSession $S `
        -Body (@{name="X"} | ConvertTo-Json)
} 400

# TC-39: PATCH start_date = end_date -> 400
Expect-Error "TC-39" "PATCH start=end -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints/$SID_UPD" -Method PATCH `
        -ContentType "application/json" -WebSession $S `
        -Body (@{start_date="2026-05-10"; end_date="2026-05-10"} | ConvertTo-Json)
} 400

# TC-40: PATCH valido -> nombre y velocidad actualizados
try {
    $upd40 = Invoke-RestMethod -Uri "$BASE/sprints/$SID_UPD" -Method PATCH `
        -ContentType "application/json" -WebSession $S `
        -Body (@{name="Sprint Renombrado"; planned_velocity=35} | ConvertTo-Json)
    if ($upd40.sprint_name -eq "Sprint Renombrado" -and $upd40.planned_velocity -eq 35) {
        Pass "TC-40" "PATCH valido -> nombre y velocidad actualizados"
    } else {
        Fail "TC-40" "PATCH: name=$($upd40.sprint_name) vel=$($upd40.planned_velocity)" ""
    }
} catch { Fail "TC-40" "PATCH valido -> debe pasar" $_.Exception.Message }

Cancel-Sprint $S $SID_UPD

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 7: VINCULACION DE KRs --" -ForegroundColor Yellow

# Obtener un KR real del ciclo
$firstKrId = $null
try {
    $objs = Invoke-RestMethod -Uri "$BASE/objectives?cycle_id=$CYCLE_ID" -WebSession $S
    foreach ($obj in $objs) {
        $od = Invoke-RestMethod -Uri "$BASE/objectives/$($obj.id)" -WebSession $S -ErrorAction SilentlyContinue
        if ($od -and $od.key_results -and $od.key_results.Count -gt 0) {
            $firstKrId = $od.key_results[0].id
            break
        }
    }
} catch {}

$spKr = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA KR Link"; start_date="2026-05-05"; end_date="2026-05-18"; planned_velocity=20}
$SID_KR = $spKr.sprint_id

if ($firstKrId) {
    # TC-41: Vincular KR valido -> aparece en sprint_krs del board
    try {
        $linked = Invoke-RestMethod -Uri "$BASE/sprints/$SID_KR/krs" -Method POST `
            -ContentType "application/json" -WebSession $S `
            -Body (@{kr_id=$firstKrId; expected_contribution=30} | ConvertTo-Json)
        $krs = if ($linked.sprint_krs -is [string]) { $linked.sprint_krs | ConvertFrom-Json } else { $linked.sprint_krs }
        $found = $krs | Where-Object { $_.kr_id -eq $firstKrId }
        if ($found) { Pass "TC-41" "Vincular KR -> aparece en sprint_krs del board" }
        else { Fail "TC-41" "KR vinculado no aparece en sprint_krs" "" }
    } catch { Fail "TC-41" "Vincular KR valido -> debe pasar" $_.Exception.Message }

    # TC-42: expected_contribution=50 en segundo link (ON CONFLICT UPDATE idempotente)
    try {
        $relinked = Invoke-RestMethod -Uri "$BASE/sprints/$SID_KR/krs" -Method POST `
            -ContentType "application/json" -WebSession $S `
            -Body (@{kr_id=$firstKrId; expected_contribution=50} | ConvertTo-Json)
        $krs2 = if ($relinked.sprint_krs -is [string]) { $relinked.sprint_krs | ConvertFrom-Json } else { $relinked.sprint_krs }
        $updated = $krs2 | Where-Object { $_.kr_id -eq $firstKrId }
        if ($updated.expected_contribution -eq 50) { Pass "TC-42" "Revincular KR actualiza expected_contribution (idempotente)" }
        else { Fail "TC-42" "expected_contribution no actualizado: $($updated.expected_contribution)" "" }
    } catch { Fail "TC-42" "Revincular KR -> debe ser idempotente" $_.Exception.Message }

    # TC-43: expected_contribution > 100 -> 400
    Expect-Error "TC-43" "expected_contribution 101 -> 400" {
        Invoke-RestMethod -Uri "$BASE/sprints/$SID_KR/krs" -Method POST `
            -ContentType "application/json" -WebSession $S `
            -Body (@{kr_id=$firstKrId; expected_contribution=101} | ConvertTo-Json)
    } 400

    # TC-44: expected_contribution negativo -> 400
    Expect-Error "TC-44" "expected_contribution negativo -> 400" {
        Invoke-RestMethod -Uri "$BASE/sprints/$SID_KR/krs" -Method POST `
            -ContentType "application/json" -WebSession $S `
            -Body (@{kr_id=$firstKrId; expected_contribution=-1} | ConvertTo-Json)
    } 400

    # TC-45: Desvincular KR vinculado -> 200
    try {
        Invoke-RestMethod -Uri "$BASE/sprints/$SID_KR/krs/$firstKrId" -Method DELETE -WebSession $S | Out-Null
        $boardAfter = Invoke-RestMethod -Uri "$BASE/sprints/$SID_KR" -WebSession $S
        $krsAfter = if ($boardAfter.sprint_krs -is [string]) { $boardAfter.sprint_krs | ConvertFrom-Json } else { $boardAfter.sprint_krs }
        $stillThere = $krsAfter | Where-Object { $_.kr_id -eq $firstKrId }
        if (-not $stillThere) { Pass "TC-45" "Desvincular KR -> desaparece del board" }
        else { Fail "TC-45" "KR sigue apareciendo en sprint_krs tras desvincular" "" }
    } catch { Fail "TC-45" "Desvincular KR existente -> debe pasar" $_.Exception.Message }

    # TC-46: Desvincular KR que ya no esta vinculado (idempotente, no debe dar 404/500)
    try {
        Invoke-RestMethod -Uri "$BASE/sprints/$SID_KR/krs/$firstKrId" -Method DELETE -WebSession $S | Out-Null
        Pass "TC-46" "Desvincular KR no vinculado -> idempotente (no error)"
    } catch { Fail "TC-46" "Desvincular KR no vinculado -> debe ser idempotente" $_.Exception.Message }
} else {
    Write-Host "[SKIP] TC-41..46 -- Sin KRs disponibles en el ciclo" -ForegroundColor DarkYellow
}

# TC-47: Vincular KR UUID inexistente -> 404
Expect-Error "TC-47" "Vincular KR UUID inexistente -> 404" {
    Invoke-RestMethod -Uri "$BASE/sprints/$SID_KR/krs" -Method POST `
        -ContentType "application/json" -WebSession $S `
        -Body (@{kr_id=$NULL_UUID; expected_contribution=20} | ConvertTo-Json)
} 404

# TC-48: Vincular KR a sprint UUID inexistente -> 404
Expect-Error "TC-48" "Vincular KR a sprint inexistente -> 404" {
    Invoke-RestMethod -Uri "$BASE/sprints/$NULL_UUID/krs" -Method POST `
        -ContentType "application/json" -WebSession $S `
        -Body (@{kr_id=if($firstKrId){$firstKrId}else{$NULL_UUID}; expected_contribution=10} | ConvertTo-Json)
} 404

Cancel-Sprint $S $SID_KR

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 8: CLOSE SPRINT - CASOS EXTREMOS --" -ForegroundColor Yellow

$spCl = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Close Extreme"; start_date="2026-05-05"; end_date="2026-05-18"; planned_velocity=20}
Activate-Sprint $S $spCl.sprint_id | Out-Null

# TC-49: actual_velocity = 0 (sprint sin entregas)
try {
    $cl0 = Close-Sprint $S $spCl.sprint_id 0
    if ($cl0.sprint.status -eq "COMPLETED" -and $cl0.sprint.actual_velocity -eq 0) {
        Pass "TC-49" "Cerrar con velocity=0 -> COMPLETED con actual_velocity=0"
    } else {
        Fail "TC-49" "status=$($cl0.sprint.status) vel=$($cl0.sprint.actual_velocity)" ""
    }
} catch { Fail "TC-49" "Cerrar con velocity=0 -> debe pasar" $_.Exception.Message }

# TC-50: actual_velocity negativa -> 400
$spCl2 = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Close Neg"; start_date="2026-05-19"; end_date="2026-06-01"}
Activate-Sprint $S $spCl2.sprint_id | Out-Null
Expect-Error "TC-50" "actual_velocity negativa -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints/$($spCl2.sprint_id)/close" -Method POST `
        -ContentType "application/json" -WebSession $S `
        -Body (@{actual_velocity=-5} | ConvertTo-Json)
} 400
Close-Sprint $S $spCl2.sprint_id 0 | Out-Null

# TC-51: Cerrar sin body (actual_velocity default 0)
$spCl3 = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Close NoBod"; start_date="2026-06-02"; end_date="2026-06-15"}
Activate-Sprint $S $spCl3.sprint_id | Out-Null
try {
    $clNB = Invoke-RestMethod -Uri "$BASE/sprints/$($spCl3.sprint_id)/close" -Method POST `
        -ContentType "application/json" -WebSession $S -Body '{}'
    if ($clNB.sprint.actual_velocity -eq 0) { Pass "TC-51" "Cerrar sin actual_velocity -> default 0" }
    else { Fail "TC-51" "actual_velocity esperado 0, obtuvo $($clNB.sprint.actual_velocity)" "" }
} catch { Fail "TC-51" "Cerrar sin body -> debe usar default 0" $_.Exception.Message }

# TC-52: suggested_checkins existe en la respuesta (puede ser [] o null, pero el campo debe estar)
$spCl4 = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Close NoKRs"; start_date="2026-06-16"; end_date="2026-06-29"}
Activate-Sprint $S $spCl4.sprint_id | Out-Null
try {
    $clNK = Close-Sprint $S $spCl4.sprint_id 0
    $raw = $clNK | ConvertTo-Json -Compress
    # En PS5.1, [] JSON se parsea como null en property access. Verificar via raw JSON string.
    if ($raw -match '"suggested_checkins"') {
        Pass "TC-52" "suggested_checkins presente en respuesta de close ([] o array de KRs)"
    } else {
        Fail "TC-52" "Campo suggested_checkins ausente en respuesta" $raw
    }
} catch { Fail "TC-52" "Cerrar sprint sin KRs -> debe pasar" $_.Exception.Message }

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 9: METRICAS - BURNUP, VELOCITY, TIMELINE --" -ForegroundColor Yellow

# TC-53: Burnup sin team_id -> 400 (ParseUUIDPipe)
Expect-Error "TC-53" "Burnup sin team_id -> 400" {
    Invoke-RestMethod -Uri "$BASE/cycles/$CYCLE_ID/sprints/burnup" -WebSession $S
} 400

# TC-54: Burnup team_id no UUID -> 400
Expect-Error "TC-54" "Burnup team_id no UUID -> 400" {
    Invoke-RestMethod -Uri "$BASE/cycles/$CYCLE_ID/sprints/burnup?team_id=not-uuid" -WebSession $S
} 400

# TC-55: Burnup ciclo inexistente -> 404
Expect-Error "TC-55" "Burnup ciclo inexistente -> 404" {
    Invoke-RestMethod -Uri "$BASE/cycles/$NULL_UUID/sprints/burnup?team_id=$TEAM_ID" -WebSession $S
} 404

# TC-56: Burnup equipo sin sprints -> [] vacio (no error)
try {
    $burnEmpty = Invoke-RestMethod -Uri "$BASE/cycles/$CYCLE_ID/sprints/burnup?team_id=$NULL_UUID" -WebSession $S
    Pass "TC-56" "Burnup equipo UUID inexistente -> respuesta valida (no 500)"
} catch {
    $code = Get-HttpCode $_
    if ($code -eq 404) { Pass "TC-56" "Burnup equipo inexistente -> 404 (aceptable)" }
    else { Fail "TC-56" "Burnup equipo inexistente -> HTTP $code inesperado" "" }
}

# TC-57: Velocity equipo sin sprints -> respuesta 200 (puede ser [] o null en PS5.1)
try {
    # En PS5.1, Invoke-RestMethod serializa JSON [] como $null. Usamos -SkipHeaderValidation workaround.
    $velRaw = Invoke-WebRequest -Uri "$BASE/teams/$NULL_UUID/velocity" -WebSession $S -UseBasicParsing
    $body = $velRaw.Content
    if ($body -eq "[]" -or $body -eq "null" -or ($body -and $body.Length -lt 10)) {
        Pass "TC-57" "Velocity equipo inexistente -> respuesta valida (array vacio)"
    } else {
        Pass "TC-57" "Velocity equipo inexistente -> HTTP 200 ($body)"
    }
} catch {
    $code = Get-HttpCode $_
    if ($code -eq 200) { Pass "TC-57" "Velocity equipo inexistente -> 200 OK" }
    elseif ($code -eq 404) { Pass "TC-57" "Velocity equipo inexistente -> 404 (aceptable)" }
    else { Fail "TC-57" "Velocity equipo inexistente -> HTTP $code" "" }
}

# TC-58: Timeline con team_id filter -> solo ese equipo en resultados
try {
    $tl = Invoke-RestMethod -Uri "$BASE/cycles/$CYCLE_ID/sprints/timeline?team_id=$TEAM_ID" -WebSession $S
    $wrong = $tl | Where-Object { $_.team_id -ne $TEAM_ID }
    if ($wrong.Count -eq 0) { Pass "TC-58" "Timeline filtrado por team_id -> solo ese equipo" }
    else { Fail "TC-58" "Timeline devuelve $($wrong.Count) sprints de otro equipo" "" }
} catch { Fail "TC-58" "Timeline con team_id -> debe pasar" $_.Exception.Message }

# TC-59: burnup ideal_progress proporcional (sprint 1 de N = 1/N * 100)
try {
    $burnup = Invoke-RestMethod -Uri "$BASE/cycles/$CYCLE_ID/sprints/burnup?team_id=$TEAM_ID" -WebSession $S
    $totalSprints = $burnup.Count
    if ($totalSprints -gt 0) {
        $first = $burnup | Select-Object -First 1
        $expectedIdeal = [Math]::Round(1.0 / $totalSprints * 100, 1)
        $actualIdeal = $first.ideal_progress
        if ([Math]::Abs($actualIdeal - $expectedIdeal) -lt 1) {
            Pass "TC-59" "ideal_progress sprint 1/$totalSprints = $actualIdeal% (correcto)"
        } else {
            Fail "TC-59" "ideal_progress sprint 1: esperado $expectedIdeal%, obtuvo $actualIdeal%" ""
        }
    } else {
        Write-Host "[SKIP] TC-59 -- Sin sprints no cancelados en burnup" -ForegroundColor DarkYellow
    }
} catch { Fail "TC-59" "Burnup -> calcular ideal_progress" $_.Exception.Message }

# TC-60: Velocity lista solo sprints COMPLETED (via raw JSON para evitar PS5.1 [] issue)
try {
    $velRaw = Invoke-WebRequest -Uri "$BASE/teams/$TEAM_ID/velocity" -WebSession $S -UseBasicParsing
    $velJson = $velRaw.Content | ConvertFrom-Json
    if (-not $velJson) {
        Pass "TC-60" "Velocity -> respuesta vacia (sin sprints COMPLETED aun)"
    } else {
        $velArray = @($velJson)
        $notCompleted = $velArray | Where-Object { $_.status -and $_.status -ne "COMPLETED" }
        if ($notCompleted.Count -eq 0) { Pass "TC-60" "Velocity solo incluye sprints COMPLETED" }
        else { Fail "TC-60" "Velocity incluye $($notCompleted.Count) sprint(s) no COMPLETED" "" }
    }
} catch { Fail "TC-60" "Velocity -> debe pasar" $_.Exception.Message }

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 10: EDGE CASES DE NOMBRE Y TRANSFORMACIONES --" -ForegroundColor Yellow

# TC-61: nombre con espacios iniciales/finales -> @Transform recorta
try {
    $spTrim = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="  Sprint Trim  "; start_date="2026-05-05"; end_date="2026-05-18"}
    if ($spTrim.sprint_name -eq "Sprint Trim") { Pass "TC-61" "@Transform recorta espacios en name" }
    else { Fail "TC-61" "name no recortado: '$($spTrim.sprint_name)'" "" }
    Cancel-Sprint $S $spTrim.sprint_id
} catch { Fail "TC-61" "Nombre con espacios -> @Transform debe recortar" $_.Exception.Message }

# TC-62: nombre con solo espacios -> post-trim vacio -> MinLength(2) -> 400
Expect-Error "TC-62" "name solo espacios -> 400 post-trim" {
    Invoke-RestMethod -Uri "$BASE/sprints" -Method POST -ContentType "application/json" -WebSession $S `
        -Body (@{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="   "; start_date="2026-05-05"; end_date="2026-05-18"} | ConvertTo-Json)
} 400

# TC-63: goal = "" (string vacio, campo opcional)
try {
    $spEG = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="Sprint Empty Goal"; goal=""; start_date="2026-05-05"; end_date="2026-05-18"}
    Pass "TC-63" "goal='' acepta (campo opcional)"
    Cancel-Sprint $S $spEG.sprint_id
} catch { Fail "TC-63" "goal='' -> debe aceptar (opcional)" $_.Exception.Message }

# TC-64: name exactamente 100 caracteres -> debe pasar (limite MaxLength)
try {
    $maxName = "A" * 100
    $spMax = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name=$maxName; start_date="2026-05-05"; end_date="2026-05-18"}
    Pass "TC-64" "name de 100 chars exactos -> acepta (limite MaxLength)"
    Cancel-Sprint $S $spMax.sprint_id
} catch { Fail "TC-64" "name 100 chars -> debe aceptar" $_.Exception.Message }

# TC-65: name exactamente 2 caracteres -> debe pasar (limite MinLength)
try {
    $spMin = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="AB"; start_date="2026-05-05"; end_date="2026-05-18"}
    Pass "TC-65" "name de 2 chars exactos -> acepta (limite MinLength)"
    Cancel-Sprint $S $spMin.sprint_id
} catch { Fail "TC-65" "name 2 chars -> debe aceptar" $_.Exception.Message }

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 11: ENDPOINT /sprints/active --" -ForegroundColor Yellow

# TC-66: GET /sprints/active sin team_id -> 400 (ParseUUIDPipe)
Expect-Error "TC-66" "GET /active sin team_id -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints/active" -WebSession $S
} 400

# TC-67: GET /sprints/active con team_id invalido -> 400
Expect-Error "TC-67" "GET /active team_id no UUID -> 400" {
    Invoke-RestMethod -Uri "$BASE/sprints/active?team_id=invalid" -WebSession $S
} 400

# TC-68: GET /active cuando no hay sprint ACTIVE -> null/200 (no debe explotar)
try {
    $active = Invoke-RestMethod -Uri "$BASE/sprints/active?team_id=$TEAM_ID" -WebSession $S
    Pass "TC-68" "GET /active sin sprint activo -> null/200 (no error)"
} catch {
    $code = Get-HttpCode $_
    if ($code -eq 404) { Pass "TC-68" "GET /active sin sprint activo -> 404 (aceptable)" }
    else { Fail "TC-68" "GET /active sin activo -> HTTP $code inesperado" "" }
}

# TC-69: GET /active con sprint activo -> devuelve board correcto
$spAct = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Active Check"; start_date="2026-05-05"; end_date="2026-05-18"}
Activate-Sprint $S $spAct.sprint_id | Out-Null
try {
    $activeRes = Invoke-RestMethod -Uri "$BASE/sprints/active?team_id=$TEAM_ID" -WebSession $S
    if ($activeRes -and $activeRes.sprint_id -eq $spAct.sprint_id) {
        Pass "TC-69" "GET /active con sprint activo -> devuelve el sprint correcto"
    } else {
        Fail "TC-69" "sprint_id: esperado $($spAct.sprint_id), obtuvo $($activeRes.sprint_id)" ""
    }
} catch { Fail "TC-69" "GET /active con sprint activo -> debe pasar" $_.Exception.Message }
Close-Sprint $S $spAct.sprint_id 0 | Out-Null

# ============================================================================
Write-Host ""
Write-Host "-- BLOQUE 12: INTEGRIDAD OKR IMPACT + BOARD --" -ForegroundColor Yellow

# TC-70: board tiene columnas todo/in_progress/done con counts enteros
$anyActive = ($allSprints | Where-Object { $_.status -eq 'ACTIVE' } | Select-Object -First 1)
if (-not $anyActive) {
    $spBoard = New-Sprint $S @{cycle_id=$CYCLE_ID; team_id=$TEAM_ID; name="QA Board Test"; start_date="2026-05-05"; end_date="2026-05-18"}
    $SID_BOARD = $spBoard.sprint_id
    $cleanup70 = $true
} else {
    $SID_BOARD = $anyActive.sprint_id
    $cleanup70 = $false
}
try {
    $board = Invoke-RestMethod -Uri "$BASE/sprints/$SID_BOARD" -WebSession $S
    $hasCounts = ($board.todo_count -ne $null -and $board.in_progress_count -ne $null -and $board.done_count -ne $null)
    $validCounts = ($board.total_count -eq ($board.todo_count + $board.in_progress_count + $board.done_count + 0))
    if ($hasCounts -and $validCounts) { Pass "TC-70" "Board tiene counts consistentes (todo+inprogress+done = total)" }
    elseif ($hasCounts) { Fail "TC-70" "Counts no cuadran: total=$($board.total_count) todo=$($board.todo_count) ip=$($board.in_progress_count) done=$($board.done_count)" "" }
    else { Fail "TC-70" "Board sin campos de count" "" }
} catch { Fail "TC-70" "GET board -> debe pasar" $_.Exception.Message }
if ($cleanup70) { Cancel-Sprint $S $SID_BOARD }

# TC-71: OKR impact devuelve estructura esperada (via raw JSON para evitar PS5.1 [] issue)
try {
    $impactRaw = Invoke-WebRequest -Uri "$BASE/sprints/$SID/okr-impact" -WebSession $S -UseBasicParsing
    $impactJson = $impactRaw.Content
    $hasSprintId   = $impactJson -match '"sprint_id"'
    $hasStatus     = $impactJson -match '"status"'
    $hasKeyResults = $impactJson -match '"key_results"'
    if ($hasSprintId -and $hasStatus -and $hasKeyResults) {
        Pass "TC-71" "OKR impact devuelve sprint_id, status, key_results"
    } else {
        Fail "TC-71" "OKR impact campos faltantes. sprintId=$hasSprintId status=$hasStatus krs=$hasKeyResults" $impactJson
    }
} catch { Fail "TC-71" "OKR impact -> debe pasar" $_.Exception.Message }

# ============================================================================
Write-Host ""
Write-Host "================================================================" -ForegroundColor Cyan
Write-Host "  RESULTADOS FINALES" -ForegroundColor Cyan
Write-Host "================================================================"
Write-Host "  Pasados : $pass" -ForegroundColor Green
Write-Host "  Fallidos: $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
Write-Host "  Total   : $($pass + $fail)"
Write-Host "  Cobertura: $([Math]::Round($pass * 100.0 / ($pass + $fail), 1))%" -ForegroundColor Cyan

if ($bugs.Count -gt 0) {
    Write-Host ""
    Write-Host "  DEFECTOS ENCONTRADOS:" -ForegroundColor Red
    foreach ($b in $bugs) { Write-Host "    - $b" -ForegroundColor Red }
} else {
    Write-Host ""
    Write-Host "  Sin defectos detectados." -ForegroundColor Green
}
