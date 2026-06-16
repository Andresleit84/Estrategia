#!/usr/bin/env node
/**
 * Test Agent
 * Runs the Jest test suite and reports results.
 * Designed for PM2 cron_restart with autorestart: false.
 * Also callable on-demand by the Super Agent.
 *
 * Exit 0 always — failures are communicated via state file and notifications.
 */

'use strict';

const fs   = require('fs');
const path = require('path');

(function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env.dev'),
    path.join(__dirname, '..', 'backend', '.env'),
    path.join(__dirname, '..', '.env'),
  ];
  for (const envPath of candidates) {
    try {
      for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
        const t = line.trim();
        if (!t || t.startsWith('#')) continue;
        const eq = t.indexOf('=');
        if (eq < 1) continue;
        const key = t.slice(0, eq).trim();
        const val = t.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
        if (!(key in process.env)) process.env[key] = val;
      }
    } catch { /* try next */ }
  }
})();

const http  = require('http');
const https = require('https');
const { spawn } = require('child_process');

// Load test dependencies from backend/node_modules
const BM = path.join(__dirname, '..', 'backend', 'node_modules');
let autocannon, Pool, jwt;
try {
  autocannon = require(path.join(BM, 'autocannon'));
  ({ Pool }  = require(path.join(BM, 'pg')));
  jwt        = require(path.join(BM, 'jsonwebtoken'));
} catch { /* load tests will be skipped */ }

const SUPER_PORT  = parseInt(process.env.SUPER_AGENT_PORT ?? '3099', 10);
const SERVER_PORT = parseInt(process.env.PORT ?? '3021', 10);
const SERVER_URL  = `http://127.0.0.1:${SERVER_PORT}`;
const LOGS_DIR    = path.join(__dirname, '..', 'logs');
const STATE_FILE  = path.join(LOGS_DIR, 'agent-state.json');
const LOG_FILE    = path.join(LOGS_DIR, 'test-results.log');
const JEST_OUT    = path.join(LOGS_DIR, 'jest-results.json');
const BACKEND_DIR = path.join(__dirname, '..', 'backend');

fs.mkdirSync(LOGS_DIR, { recursive: true });

// ── Logging ──────────────────────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch { /* ignore */ }
}

// ── Telegram ─────────────────────────────────────────────────────────────────

function sendTelegram(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  const req = https.request({
    hostname: 'api.telegram.org',
    path: `/bot${token}/sendMessage`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => { res.resume(); });
  req.on('error', () => {});
  req.write(body);
  req.end();
}

// ── Super Agent IPC ───────────────────────────────────────────────────────────

function postEvent(payload) {
  const body = JSON.stringify(payload);
  const req = http.request({
    hostname: '127.0.0.1', port: SUPER_PORT, path: '/event', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  }, (res) => { res.resume(); });
  req.on('error', () => {});
  req.write(body);
  req.end();
}

// ── State persistence ─────────────────────────────────────────────────────────

function persistResults(testsData) {
  try {
    let current = {};
    try { current = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8').replace(/^﻿/, '')); } catch { /* new */ }
    current.tests = testsData;
    fs.writeFileSync(STATE_FILE, JSON.stringify(current, null, 2));
  } catch { /* ignore */ }
}

// ── Load test helpers ─────────────────────────────────────────────────────────

function checkBackendServer() {
  return new Promise((resolve) => {
    const req = http.get(
      { hostname: '127.0.0.1', port: SERVER_PORT, path: '/api/v1/health', timeout: 3000 },
      (res) => { res.resume(); resolve(res.statusCode === 200); },
    );
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

async function getTestUser() {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 4000 })
    : new Pool({
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 1, connectionTimeoutMillis: 4000,
      });
  try {
    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.organization_id, u.role FROM users u
        WHERE u.is_active = true AND u.deleted_at IS NULL LIMIT 1`,
    );
    return rows[0] ?? null;
  } catch { return null; }
  finally { await pool.end().catch(() => {}); }
}

function cannon(opts) {
  return new Promise((resolve, reject) => {
    const inst = autocannon({ ...opts, outputStream: null }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
    // silence progress output in cron mode
    inst.on('error', () => {});
  });
}

async function runLoadTests() {
  if (!autocannon || !Pool || !jwt) {
    log('Load tests skipped — dependencies not available');
    return { ran: false };
  }

  const serverOk = await checkBackendServer();
  if (!serverOk) {
    log('Load tests skipped — backend not responding on /api/v1/health');
    return { ran: false };
  }

  const user = await getTestUser();
  if (!user || !process.env.JWT_SECRET) {
    log('Load tests skipped — no active user or JWT_SECRET missing');
    return { ran: false };
  }

  const token = jwt.sign(
    { sub: user.user_id, orgId: user.organization_id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '2h' },
  );
  const authH = { Authorization: `Bearer ${token}` };

  // Abbreviated ramp for daily cron: 3 levels, 5s each
  const LEVELS   = [1, 10, 50];
  const DURATION = 5;

  const scenarios = {
    health:      { url: `${SERVER_URL}/api/v1/health`,                         headers: {} },
    objectives:  { url: `${SERVER_URL}/api/v1/objectives`,                     headers: authH },
    checkins:    { url: `${SERVER_URL}/api/v1/check-ins/at-risk`,              headers: authH },
    agreements:  { url: `${SERVER_URL}/api/v1/agreements`,                     headers: authH },
    dashboard:   { url: `${SERVER_URL}/api/v1/reports/executive-dashboard`,    headers: authH },
  };

  const results = {};
  for (const [name, opts] of Object.entries(scenarios)) {
    log(`Load test: ${name}...`);
    const rows = [];
    for (const connections of LEVELS) {
      try {
        const res = await cannon({ url: opts.url, connections, duration: DURATION, headers: opts.headers, timeout: 15 });
        const p99  = Math.round(res.latency.p99 ?? res.latency.mean ?? 0);
        const rps  = Math.round(res.requests.average);
        const err  = (res.errors ?? 0) + (res['5xx'] ?? 0) + (res.timeouts ?? 0);
        const errRate = res.requests.total > 0 ? err / res.requests.total : 0;
        const ok = errRate <= 0.05 && p99 <= 3000 && errRate === 0 && p99 <= 800;
        rows.push({ c: connections, rps, p99, err, ok });
      } catch { /* skip this level */ }
    }
    const maxOk  = [...rows].reverse().find((r) => r.ok);
    const topRow = rows[rows.length - 1] ?? { rps: 0, p99: 0 };
    results[name] = {
      maxOkUsers:   maxOk?.c ?? 0,
      maxWarnUsers: rows.length > 0 ? rows[rows.length - 1].c : 0,
      topRps:       topRow.rps,
      topP99:       topRow.p99,
      ok:           maxOk !== undefined,
    };
  }

  log(`Load tests done: health=${results.health?.maxOkUsers}u obj=${results.objectives?.maxOkUsers}u ci=${results.checkins?.maxOkUsers}u agr=${results.agreements?.maxOkUsers}u dash=${results.dashboard?.maxOkUsers}u`);
  return { ran: true, lastRun: new Date().toISOString(), scenarios: results };
}

// ── Jest runner ───────────────────────────────────────────────────────────────

function runTests() {
  return new Promise((resolve) => {
    log('Starting Jest test suite...');
    const startTs = Date.now();

    const jest = spawn(
      'npx',
      ['jest', '--json', `--outputFile=${JEST_OUT}`, '--forceExit', '--passWithNoTests'],
      { cwd: BACKEND_DIR, shell: true, stdio: ['ignore', 'pipe', 'pipe'] }
    );

    let stderr = '';
    jest.stderr.on('data', (d) => { stderr += d.toString(); });
    jest.stdout.on('data', () => {});

    jest.on('close', (code) => {
      const duration = ((Date.now() - startTs) / 1000).toFixed(1);
      log(`Jest exited with code ${code} in ${duration}s`);

      let results = {
        lastRun: new Date().toISOString(),
        passed: code === 0,
        exitCode: code,
        duration: parseFloat(duration),
        numSuites: 0,
        numTests: 0,
        numFailed: 0,
        numPassed: 0,
        failedSuites: [],
        rawTestResults: [],
      };

      // Try file first; if missing/incomplete, fall back to stderr snippet
      const sources = [];
      try { sources.push(fs.readFileSync(JEST_OUT, 'utf8')); } catch { /* file not ready */ }
      // Jest --json also writes to stdout when no --outputFile — captured via pipe but we discard it above.
      // Attempt a short-poll for the file (--forceExit can race the flush)
      if (!sources.length) {
        for (let i = 0; i < 3; i++) {
          const start = Date.now(); while (Date.now() - start < 300) { /* spin */ }
          try { sources.push(fs.readFileSync(JEST_OUT, 'utf8')); break; } catch { /* retry */ }
        }
      }

      if (sources.length) {
        try {
          const raw = JSON.parse(sources[0]);
          results.numSuites       = raw.numTotalTestSuites  ?? 0;
          results.numTests        = raw.numTotalTests       ?? 0;
          results.numFailed       = raw.numFailedTests      ?? 0;
          results.numPassed       = raw.numPassedTests      ?? 0;
          results.passed          = raw.success             ?? (code === 0);
          results.rawTestResults  = raw.testResults         ?? [];
          // Capture both failed suites and individual failed assertions
          results.failedSuites = (raw.testResults ?? [])
            .filter((s) => s.status === 'failed' || (s.assertionResults ?? []).some((a) => a.status === 'failed'))
            .map((s) => ({ name: path.basename(s.testFilePath), message: (s.failureMessage ?? '').slice(0, 300) }));
          results.failedTests = (raw.testResults ?? []).flatMap((s) =>
            (s.assertionResults ?? [])
              .filter((a) => a.status === 'failed')
              .map((a) => ({
                suite: path.basename(s.testFilePath ?? ''),
                name:  [...(a.ancestorTitles ?? []), a.title].filter(Boolean).join(' › '),
                error: (a.failureMessages?.[0] ?? '').split('\n')[0].slice(0, 250),
              }))
          );
        } catch {
          log('Could not parse Jest JSON output — using exit code only');
          if (stderr) log(`Jest stderr: ${stderr.slice(0, 500)}`);
        }
      } else {
        log('Jest JSON output file not found — using exit code only');
        if (stderr) log(`Jest stderr: ${stderr.slice(0, 500)}`);
      }

      resolve(results);
    });
  });
}

// ── Suite categorisation ──────────────────────────────────────────────────────

function categoriseSuites(testResults) {
  const cats = {
    unit:      { passed: 0, failed: 0, total: 0, failedTests: [] },
    integrity: { passed: 0, failed: 0, total: 0, failedTests: [] },
    http:      { passed: 0, failed: 0, total: 0, failedTests: [] },
  };
  for (const suite of (testResults ?? [])) {
    const name = path.basename(suite.name ?? suite.testFilePath ?? '');
    const cat = name === 'db.integrity.spec.ts' ? 'integrity'
              : name === 'app.http.spec.ts'      ? 'http'
              : 'unit';
    const assertions = suite.assertionResults ?? [];
    const s = cats[cat];
    for (const a of assertions) {
      if (a.status === 'passed') { s.passed++; s.total++; }
      else if (a.status === 'failed') {
        s.failed++;
        s.total++;
        const title = [...(a.ancestorTitles ?? []), a.title].filter(Boolean).join(' › ');
        const error = (a.failureMessages?.[0] ?? '').split('\n')[0].slice(0, 200);
        s.failedTests.push({ name: title, suite: name, error });
      }
    }
  }
  return cats;
}

function buildTelegramMessage(results, cats, load) {
  const icon   = results.passed ? '✅' : '❌';
  const status = results.passed ? 'VERDE' : 'ROJO';
  const now    = new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota', hour12: false });

  const lines = [
    `${icon} *OKR Backend — Tests ${status}*`,
    `📅 ${now}  ⏱ ${results.duration}s`,
    '',
    `📊 *Tests:* ${results.numPassed}/${results.numTests} · ${results.numSuites} suites`,
    `• 🧪 Unitarios    ${cats.unit.passed}/${cats.unit.total}${cats.unit.failed > 0 ? ` ❌ ${cats.unit.failed}` : ' ✓'}`,
    `• 🗄  Integridad   ${cats.integrity.passed}/${cats.integrity.total}${cats.integrity.failed > 0 ? ` ❌ ${cats.integrity.failed}` : ' ✓'}`,
    `• 🌐 HTTP          ${cats.http.passed}/${cats.http.total}${cats.http.failed > 0 ? ` ❌ ${cats.http.failed}` : ' ✓'}`,
  ];

  if (load?.ran && load.scenarios) {
    lines.push('');
    lines.push('⚡ *Carga:*');
    for (const [name, s] of Object.entries(load.scenarios)) {
      const label = name === 'health' ? 'Health' : name === 'objectives' ? 'Objetivos'
                  : name === 'checkins' ? 'Check-ins' : name === 'agreements' ? 'Acuerdos' : 'Dashboard';
      const users = s.maxOkUsers > 0 ? `${s.maxOkUsers} usuarios` : '< 1 usuario';
      lines.push(`• ${label.padEnd(11)} ${users}  ${s.topRps}rps  p99:${s.topP99}ms ${s.ok ? '✓' : '⚠️'}`);
    }
  }

  if (!results.passed && results.failedSuites.length > 0) {
    lines.push('', '*Suites con fallos:*');
    for (const s of results.failedSuites.slice(0, 5)) {
      lines.push(`• \`${s.name}\``);
    }
  }

  return lines.join('\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

function setRunning(value) {
  try {
    let current = {};
    try { current = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8').replace(/^﻿/, '')); } catch { /* new */ }
    if (!current.tests) current.tests = {};
    current.tests.running = value;
    fs.writeFileSync(STATE_FILE, JSON.stringify(current, null, 2));
  } catch { /* ignore */ }
}

async function main() {
  log('Test Agent run started');
  setRunning(true);
  postEvent({ source: 'test-agent', type: 'RUN_START', ts: new Date().toISOString() });

  // ── Phase 1: Jest (unit + integrity + HTTP) ────────────────────────────────
  const results = await runTests();
  const cats    = categoriseSuites(results.rawTestResults);

  // ── Phase 2: Load tests ────────────────────────────────────────────────────
  log('Starting load tests...');
  const load = await runLoadTests().catch((e) => {
    log(`Load tests error: ${e.message}`);
    return { ran: false };
  });

  // ── Persist everything ─────────────────────────────────────────────────────
  const fullResults = { ...results, categories: cats, load, running: false };
  delete fullResults.rawTestResults; // don't bloat the state file
  persistResults(fullResults);

  // ── Notify ────────────────────────────────────────────────────────────────
  const msg = buildTelegramMessage(results, cats, load);
  log(msg.replace(/[*`]/g, ''));
  sendTelegram(msg);

  postEvent({
    source: 'test-agent',
    type: results.passed ? 'RUN_PASSED' : 'RUN_FAILED',
    results: fullResults,
    ts: new Date().toISOString(),
  });

  log('Test Agent run finished');
  process.exit(0);
}

main().catch((err) => {
  log(`Test Agent fatal error: ${err.message}`);
  process.exit(0);
});
