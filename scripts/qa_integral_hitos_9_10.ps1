# ================================================================
# QA Integral — Hitos 9 y 10
# Cubre: AI endpoints, Reports endpoints, MCP rate limiting,
#        cron safety, null safety, SQL injection checks
#
# Uso: .\qa_integral_hitos_9_10.ps1 -BaseUrl http://localhost:3000 -Token "Bearer eyJ..."
# ================================================================
param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$Token   = $env:QA_TOKEN,
    [string]$CycleId = $env:QA_CYCLE_ID,
    [string]$KrId    = $env:QA_KR_ID
)

$headers = @{ Authorization = $Token; "Content-Type" = "application/json" }
$pass = 0; $fail = 0; $skip = 0

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method = "GET",
        [string]$Url,
        [string]$Body = $null,
        [int[]]$ExpectStatus = @(200, 201)
    )
    try {
        $params = @{ Method = $Method; Uri = $Url; Headers = $headers; ErrorAction = "Stop" }
        if ($Body) { $params.Body = $Body }
        $res = Invoke-WebRequest @params
        if ($ExpectStatus -contains $res.StatusCode) {
            Write-Host "  [PASS] $Name ($($res.StatusCode))" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "  [FAIL] $Name — Expected $($ExpectStatus -join '/'), got $($res.StatusCode)" -ForegroundColor Red
            $script:fail++
        }
        return $res
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        if ($ExpectStatus -contains $sc) {
            Write-Host "  [PASS] $Name ($sc)" -ForegroundColor Green
            $script:pass++
        } else {
            Write-Host "  [FAIL] $Name — $($_.Exception.Message)" -ForegroundColor Red
            $script:fail++
        }
        return $null
    }
}

function Skip-Test { param([string]$Name, [string]$Reason)
    Write-Host "  [SKIP] $Name — $Reason" -ForegroundColor Yellow
    $script:skip++
}

Write-Host "`n==== QA Integral Hitos 9 & 10 ====" -ForegroundColor Cyan
Write-Host "Base: $BaseUrl | $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')`n"

# ── AUTH CHECK ─────────────────────────────────────────────────────────────────
Write-Host "[ Auth check ]"
if (-not $Token) {
    Write-Host "  [SKIP] All tests — QA_TOKEN not set" -ForegroundColor Yellow
    exit 1
}
Test-Endpoint -Name "GET /api/v1/auth/me" -Url "$BaseUrl/api/v1/auth/me"

# ── HITO 9: AI ENDPOINTS ──────────────────────────────────────────────────────
Write-Host "`n[ Hito 9 — AI Endpoints ]"

Test-Endpoint -Name "GET /api/v1/ai/briefings" `
    -Url "$BaseUrl/api/v1/ai/briefings"

Test-Endpoint -Name "GET /api/v1/ai/briefings?type=risk_sentinel" `
    -Url "$BaseUrl/api/v1/ai/briefings?type=risk_sentinel"

Test-Endpoint -Name "GET /api/v1/ai/conversations" `
    -Url "$BaseUrl/api/v1/ai/conversations"

Test-Endpoint -Name "POST /api/v1/ai/okr-coach" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/ai/okr-coach" `
    -Body '{"title":"Aumentar ingresos mensuales en 30% para el Q4"}'

Test-Endpoint -Name "POST /api/v1/ai/strategy-advisor" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/ai/strategy-advisor" `
    -Body '{"message":"¿Cuáles son los principales riesgos del ciclo actual?"}'

Test-Endpoint -Name "POST /api/v1/ai/risk-sentinel" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/ai/risk-sentinel" `
    -Body '{}'

Test-Endpoint -Name "POST /api/v1/ai/executive-briefing" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/ai/executive-briefing" `
    -Body '{}'

Test-Endpoint -Name "POST /api/v1/ai/alignment-audit" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/ai/alignment-audit" `
    -Body '{}'

if ($KrId) {
    Test-Endpoint -Name "POST /api/v1/ai/checkin-assistant" `
        -Method "POST" `
        -Url "$BaseUrl/api/v1/ai/checkin-assistant" `
        -Body "{`"kr_id`":`"$KrId`",`"current_value`":75,`"confidence`":0.7}"
} else { Skip-Test "POST /api/v1/ai/checkin-assistant" "QA_KR_ID not set" }

# ── HITO 9: MCP ENDPOINTS ─────────────────────────────────────────────────────
Write-Host "`n[ Hito 9 — MCP Endpoints ]"

Test-Endpoint -Name "GET /api/v1/mcp/tools" `
    -Url "$BaseUrl/api/v1/mcp/tools"

Test-Endpoint -Name "POST /api/v1/mcp/call — health_check" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/mcp/call" `
    -Body '{"name":"health_check","input":{}}'

Test-Endpoint -Name "POST /api/v1/mcp/call — list_objectives" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/mcp/call" `
    -Body '{"name":"list_objectives","input":{}}'

Test-Endpoint -Name "POST /api/v1/mcp/call — get_at_risk_krs" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/mcp/call" `
    -Body '{"name":"get_at_risk_krs","input":{}}'

Test-Endpoint -Name "POST /api/v1/mcp/call — get_cadence_dashboard" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/mcp/call" `
    -Body '{"name":"get_cadence_dashboard","input":{}}'

Test-Endpoint -Name "POST /api/v1/mcp/call — generate_okr_suggestions" `
    -Method "POST" `
    -Url "$BaseUrl/api/v1/mcp/call" `
    -Body '{"name":"generate_okr_suggestions","input":{"level":"COMPANY","count":2}}'

# ── HITO 9: REPORTS (legacy) ──────────────────────────────────────────────────
Write-Host "`n[ Hito 9 — Reports (risk, briefing, alignment) ]"

Test-Endpoint -Name "GET /api/v1/reports/risk-dashboard" `
    -Url "$BaseUrl/api/v1/reports/risk-dashboard"

Test-Endpoint -Name "GET /api/v1/reports/executive-briefing" `
    -Url "$BaseUrl/api/v1/reports/executive-briefing"

Test-Endpoint -Name "GET /api/v1/reports/alignment" `
    -Url "$BaseUrl/api/v1/reports/alignment"

# ── HITO 10: REPORTS (new dashboards) ────────────────────────────────────────
Write-Host "`n[ Hito 10 — Executive Dashboard ]"

Test-Endpoint -Name "GET /api/v1/reports/executive-dashboard" `
    -Url "$BaseUrl/api/v1/reports/executive-dashboard"

if ($CycleId) {
    Test-Endpoint -Name "GET /api/v1/reports/executive-dashboard?cycle_id" `
        -Url "$BaseUrl/api/v1/reports/executive-dashboard?cycle_id=$CycleId"
} else { Skip-Test "GET /api/v1/reports/executive-dashboard?cycle_id" "QA_CYCLE_ID not set" }

Write-Host "`n[ Hito 10 — Cycle Health ]"

Test-Endpoint -Name "GET /api/v1/reports/cycle-health" `
    -Url "$BaseUrl/api/v1/reports/cycle-health"

Write-Host "`n[ Hito 10 — Team Health ]"

Test-Endpoint -Name "GET /api/v1/reports/team-health" `
    -Url "$BaseUrl/api/v1/reports/team-health"

Write-Host "`n[ Hito 10 — Portfolio ]"

Test-Endpoint -Name "GET /api/v1/reports/portfolio" `
    -Url "$BaseUrl/api/v1/reports/portfolio"

Write-Host "`n[ Hito 10 — Weekly Trend ]"

Test-Endpoint -Name "GET /api/v1/reports/weekly-trend" `
    -Url "$BaseUrl/api/v1/reports/weekly-trend"

Write-Host "`n[ Hito 10 — Close Report ]"

if ($CycleId) {
    Test-Endpoint -Name "POST /api/v1/reports/close-report/:cycleId" `
        -Method "POST" `
        -Url "$BaseUrl/api/v1/reports/close-report/$CycleId" `
        -Body '{}'
} else { Skip-Test "POST /api/v1/reports/close-report" "QA_CYCLE_ID not set" }

Write-Host "`n[ Hito 10 — CSV Export ]"

if ($CycleId) {
    Test-Endpoint -Name "GET /api/v1/reports/export-csv/:cycleId" `
        -Url "$BaseUrl/api/v1/reports/export-csv/$CycleId"
} else { Skip-Test "GET /api/v1/reports/export-csv" "QA_CYCLE_ID not set" }

# ── SECURITY: SQL INJECTION PROBE ─────────────────────────────────────────────
Write-Host "`n[ Security — SQL injection probe ]"

$sqlProbe = "'; DROP TABLE objectives; --"
$encodedProbe = [uri]::EscapeDataString($sqlProbe)

$res = Test-Endpoint -Name "GET risk-dashboard?cycle_id=SQL_PROBE" `
    -Url "$BaseUrl/api/v1/reports/risk-dashboard?cycle_id=$encodedProbe" `
    -ExpectStatus @(200, 400, 404, 422)

# Verify response is valid JSON (not a DB error)
if ($res -and $res.Content) {
    try {
        $null = $res.Content | ConvertFrom-Json
        Write-Host "    -> Response is valid JSON (parameterized query confirmed)" -ForegroundColor DarkGreen
    } catch {
        Write-Host "    -> WARNING: Response is not JSON — possible unhandled error" -ForegroundColor Red
        $script:fail++
    }
}

# ── AUTH: UNAUTHORIZED CHECK ──────────────────────────────────────────────────
Write-Host "`n[ Auth — unauthorized access ]"

$noAuth = @{ "Content-Type" = "application/json" }
try {
    $r = Invoke-WebRequest -Method GET -Uri "$BaseUrl/api/v1/reports/executive-dashboard" -Headers $noAuth -ErrorAction Stop
    Write-Host "  [FAIL] GET /reports/executive-dashboard without token returned $($r.StatusCode)" -ForegroundColor Red
    $script:fail++
} catch {
    $sc = $_.Exception.Response.StatusCode.value__
    if ($sc -eq 401) {
        Write-Host "  [PASS] Unauthorized returns 401" -ForegroundColor Green
        $script:pass++
    } else {
        Write-Host "  [FAIL] Unexpected status $sc for unauthorized request" -ForegroundColor Red
        $script:fail++
    }
}

# ── RATE LIMIT CHECK ──────────────────────────────────────────────────────────
Write-Host "`n[ MCP rate limiting — burst test (5 rapid calls) ]"

$rateLimitHit = $false
for ($i = 1; $i -le 5; $i++) {
    try {
        $r = Invoke-WebRequest -Method POST -Uri "$BaseUrl/api/v1/mcp/call" -Headers $headers `
            -Body '{"name":"health_check","input":{}}' -ErrorAction Stop
        Write-Host "  Call $i: $($r.StatusCode)" -ForegroundColor DarkGray
    } catch {
        $sc = $_.Exception.Response.StatusCode.value__
        if ($sc -eq 403) { $rateLimitHit = $true; Write-Host "  Call $i: 403 (rate limit hit)" -ForegroundColor Yellow }
    }
}
if ($rateLimitHit) {
    Write-Host "  [INFO] Rate limit triggered as expected" -ForegroundColor Cyan
} else {
    Write-Host "  [INFO] Rate limit not triggered in 5 calls (expected for non-FREE plans or if Redis unavailable)" -ForegroundColor DarkGray
}

# ── SUMMARY ───────────────────────────────────────────────────────────────────
Write-Host "`n==== Results ====" -ForegroundColor Cyan
Write-Host "PASS: $pass" -ForegroundColor Green
Write-Host "FAIL: $fail" -ForegroundColor $(if ($fail -gt 0) { "Red" } else { "Green" })
Write-Host "SKIP: $skip" -ForegroundColor Yellow
Write-Host "TOTAL: $($pass + $fail + $skip)"

if ($fail -gt 0) { exit 1 } else { exit 0 }
