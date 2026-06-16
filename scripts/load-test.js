#!/usr/bin/env node
/**
 * Load Test — OKR Backend
 * Mide cuántos usuarios simultáneos aguanta el sistema antes de degradarse.
 *
 * Uso:
 *   node scripts/load-test.js                     # todo contra localhost:3010
 *   node scripts/load-test.js --url http://host:3010
 *   node scripts/load-test.js --scenario health   # un solo escenario
 *   node scripts/load-test.js --duration 20       # segundos por nivel (default 10)
 *
 * Requiere: backend corriendo + DB con al menos un usuario activo.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');

// Modules live in backend/node_modules — resolve from there
const BM = path.join(__dirname, '..', 'backend', 'node_modules');
const { Pool }   = require(path.join(BM, 'pg'));
const autocannon = require(path.join(BM, 'autocannon'));
const jwt        = require(path.join(BM, 'jsonwebtoken'));

// ── Env loader ────────────────────────────────────────────────────────────────

;(function loadEnv() {
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
    } catch { /* next candidate */ }
  }
})();

// ── CLI ───────────────────────────────────────────────────────────────────────

const args    = process.argv.slice(2);
const getArg  = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };

const BASE_URL = getArg('--url')      ?? `http://localhost:${process.env.PORT ?? 3010}`;
const DURATION = parseInt(getArg('--duration') ?? '10', 10);
const SCENARIO = getArg('--scenario') ?? 'all';

// ── Terminal colours ──────────────────────────────────────────────────────────

const G = '\x1b[32m', Y = '\x1b[33m', R = '\x1b[1;31m', B = '\x1b[1m', Z = '\x1b[0m';
const colourRps = (v) => v >= 50 ? `${G}${v}${Z}` : v >= 10 ? `${Y}${v}${Z}` : `${R}${v}${Z}`;
const colourLat = (v) => v < 500 ? `${G}${v}${Z}` : v < 2000 ? `${Y}${v}${Z}` : `${R}${v}${Z}`;
const colourErr = (v) => v === 0  ? `${G}${v}${Z}` : `${R}${v}${Z}`;

// ── Server liveness ───────────────────────────────────────────────────────────

function checkServer() {
  return new Promise((resolve) => {
    const lib  = BASE_URL.startsWith('https') ? https : http;
    const u    = new URL(BASE_URL + '/api/v1/health');
    const req  = lib.get(
      { hostname: u.hostname, port: u.port || 3010, path: u.pathname, timeout: 4000 },
      (res) => { res.resume(); resolve(res.statusCode === 200); },
    );
    req.on('error',   () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// ── DB: get a real active user ────────────────────────────────────────────────

async function getTestUser() {
  const pool = process.env.DATABASE_URL
    ? new Pool({ connectionString: process.env.DATABASE_URL, max: 1, connectionTimeoutMillis: 5000 })
    : new Pool({
        host: process.env.DB_HOST ?? '127.0.0.1',
        port: parseInt(process.env.DB_PORT ?? '5432', 10),
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 1, connectionTimeoutMillis: 5000,
      });
  try {
    const { rows } = await pool.query(`
      SELECT u.id AS user_id, u.organization_id, u.role, u.email
        FROM users u
       WHERE u.is_active = true AND u.deleted_at IS NULL
       LIMIT 1
    `);
    return rows[0] ?? null;
  } catch { return null; }
  finally { await pool.end().catch(() => {}); }
}

// ── JWT ───────────────────────────────────────────────────────────────────────

function makeToken(user) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no encontrado en .env');
  return jwt.sign(
    { sub: user.user_id, orgId: user.organization_id, role: user.role },
    secret,
    { expiresIn: '2h' },
  );
}

// ── Run one autocannon scenario ───────────────────────────────────────────────

function cannon(opts) {
  return new Promise((resolve, reject) => {
    const inst = autocannon({ ...opts, outputStream: null }, (err, res) => {
      if (err) return reject(err);
      resolve(res);
    });
    autocannon.track(inst, { renderProgressBar: true, renderResultsTable: false });
  });
}

// ── Ramp: run the same endpoint at escalating concurrency ────────────────────

async function ramp(label, urlPath, { headers = {}, method = 'GET', body, levels } = {}) {
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`${B}Escenario: ${label}${Z}`);
  console.log(`URL:    ${BASE_URL}${urlPath}`);
  console.log(`Rampa:  ${levels.join(' → ')} usuarios  |  ${DURATION}s por nivel`);
  console.log('─'.repeat(65));

  const colW = 7;
  const hdr  = ['Usuarios','Req/s','p50ms','p90ms','p99ms','Errors','Estado'].map((h, i) => h.padStart(i === 6 ? 10 : colW)).join(' ');
  console.log(`\n${B}${hdr}${Z}`);

  const rows = [];

  for (const connections of levels) {
    process.stdout.write(`  nivel ${String(connections).padStart(3)} → `);

    let res;
    try {
      res = await cannon({
        url: `${BASE_URL}${urlPath}`,
        connections,
        duration: DURATION,
        headers,
        method,
        body: body ? JSON.stringify(body) : undefined,
        timeout: 15,
      });
    } catch (e) {
      console.log(`ERROR: ${e.message}`);
      rows.push({ c: connections, rps: 0, p50: 0, p90: 0, p99: 9999, err: 999 });
      continue;
    }

    const rps  = Math.round(res.requests.average);
    const p50  = Math.round(res.latency.p50  ?? res.latency.mean ?? 0);
    const p90  = Math.round(res.latency.p90  ?? res.latency.mean ?? 0);
    const p99  = Math.round(res.latency.p99  ?? res.latency.mean ?? 0);
    // Only count real failures: network errors, server-side 5xx, and timeouts.
    // 4xx are valid HTTP responses (401 login, 403 forbidden) — not server failures.
    const err  = (res.errors ?? 0) + (res['5xx'] ?? 0) + (res.timeouts ?? 0);

    const errRate = res.requests.total > 0 ? err / res.requests.total : 0;
    const ok      = errRate > 0.05 || p99 > 3000 ? 'fail'
                  : p99 > 800  || errRate > 0      ? 'warn'
                  :                                   'ok';
    const estadoStr = ok === 'fail' ? `${R}❌ SATURADO${Z}`
                    : ok === 'warn' ? `${Y}⚠️  DEGRADADO${Z}`
                    :                 `${G}✅ OK${Z}`;

    const fmt = (v, fn) => { const s = String(v).padStart(colW); return fn(v).padStart(colW + fn(v).length - s.length); };
    console.log(`${String(connections).padStart(colW)} ${fmt(rps, colourRps)} ${fmt(p50, colourLat)} ${fmt(p90, colourLat)} ${fmt(p99, colourLat)} ${fmt(err, colourErr)}  ${estadoStr}`);

    rows.push({ c: connections, rps, p50, p90, p99, err, ok });
  }

  const maxOk   = [...rows].reverse().find((r) => r.ok === 'ok');
  const maxWarn = [...rows].reverse().find((r) => r.ok !== 'fail');
  const breaking= rows.find((r) => r.ok === 'fail');

  console.log('');
  if (maxOk)   console.log(`  ${G}${B}Carga cómoda:${Z}    hasta ${maxOk.c} usuarios (p99 < 800ms, 0 errores)`);
  if (maxWarn && maxWarn !== maxOk)
               console.log(`  ${Y}${B}Zona degradada:${Z}  hasta ${maxWarn.c} usuarios (lento pero funcional)`);
  if (breaking) console.log(`  ${R}${B}Punto de quiebre:${Z} ${breaking.c} usuarios (errores > 5% o p99 > 3s)`);

  return rows;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${'╔' + '═'.repeat(63) + '╗'}`);
  console.log(`${'║'}${B}   OKR Backend — Prueba de Carga${''.padEnd(32)}${Z}${'║'}`);
  console.log(`${'╚' + '═'.repeat(63) + '╝'}`);
  console.log(`  Servidor : ${BASE_URL}`);
  console.log(`  Fecha    : ${new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota' })}`);
  console.log(`  Pool DB  : max=10 conexiones PostgreSQL`);

  // 1. Server check
  console.log('\n🔍 Verificando servidor...');
  if (!await checkServer()) {
    console.error(`${R}❌ Sin respuesta en ${BASE_URL}/health${Z}`);
    console.error('   Inicia el backend: npm run start:dev  (en backend/)');
    process.exit(1);
  }
  console.log(`${G}✓ Servidor activo${Z}`);

  // 2. Test user + JWT
  console.log('\n🔑 Buscando usuario de prueba en la base de datos...');
  const user = await getTestUser();
  let authHeaders = {};

  if (!user) {
    console.log(`${Y}⚠️  No hay usuarios activos en BD — sólo se prueban rutas públicas${Z}`);
  } else {
    authHeaders = { Authorization: `Bearer ${makeToken(user)}` };
    console.log(`${G}✓ ${user.email}  |  org: ${user.organization_id}  |  rol: ${user.role}${Z}`);
  }

  // Rampa estándar y rampa de stress
  const RAMP_STD    = [1, 5, 10, 20, 50, 100];
  const RAMP_LOGIN  = [1, 5, 10, 20];          // login tiene bcrypt, no necesita más
  const summary     = {};

  // ── A. Health (sin auth, sin DB) — baseline puro ─────────────────────────
  if (SCENARIO === 'all' || SCENARIO === 'health') {
    summary.health = await ramp(
      'GET /api/v1/health  (sin auth — línea base NestJS puro)',
      '/api/v1/health',
      { levels: RAMP_STD },
    );
  }

  // ── B. Objectives (auth + vista liviana) ─────────────────────────────────
  if (user && (SCENARIO === 'all' || SCENARIO === 'objectives')) {
    summary.objectives = await ramp(
      'GET /api/v1/objectives  (auth + v_objectives_with_progress)',
      '/api/v1/objectives',
      { headers: authHeaders, levels: RAMP_STD },
    );
  }

  // ── C. Dashboard ejecutivo (auth + query pesada) ──────────────────────────
  if (user && (SCENARIO === 'all' || SCENARIO === 'dashboard')) {
    summary.dashboard = await ramp(
      'GET /api/v1/reports/executive-dashboard  (auth + query pesada)',
      '/api/v1/reports/executive-dashboard',
      { headers: authHeaders, levels: RAMP_STD },
    );
  }

  // ── D. Login (Passport + bcrypt + DB) ────────────────────────────────────
  if (SCENARIO === 'all' || SCENARIO === 'login') {
    summary.login = await ramp(
      'POST /api/v1/auth/login  (Passport + bcrypt — siempre 401, mide throughput)',
      '/api/v1/auth/login',
      {
        method: 'POST',
        body: { email: 'load@test.com', password: 'wrongpassword' },
        headers: { 'Content-Type': 'application/json' },
        levels: RAMP_LOGIN,
      },
    );
  }

  // ── Resumen global ────────────────────────────────────────────────────────
  console.log(`\n${'═'.repeat(65)}`);
  console.log(`${B}  CAPACIDAD DEL SISTEMA${Z}`);
  console.log('═'.repeat(65));
  console.log(`\n  ${'Escenario'.padEnd(18)} ${'Cómodo (OK)'.padEnd(16)} ${'Límite (degradado)'.padEnd(20)}`);
  console.log(`  ${'─'.repeat(56)}`);

  const LABELS = { health: 'Health check', objectives: 'Objetivos', dashboard: 'Dashboard', login: 'Login' };
  for (const [key, rows] of Object.entries(summary)) {
    if (!rows) continue;
    const ok   = [...rows].reverse().find((r) => r.ok === 'ok');
    const warn = [...rows].reverse().find((r) => r.ok !== 'fail');
    const okStr   = ok   ? `${G}${ok.c} usuarios${Z}`   : `${R}< 1${Z}`;
    const warnStr = warn ? `${Y}${warn.c} usuarios${Z}` : `${R}ninguno${Z}`;
    const label = (LABELS[key] ?? key).padEnd(18);
    const okPad = okStr.padEnd(16 + okStr.length - String(ok?.c ?? '').length - (ok ? 9 : 3));
    console.log(`  ${label} ${okPad} ${warnStr}`);
  }

  console.log(`\n  ${B}Interpretación:${Z}`);
  console.log('  • Cómodo    = p99 < 800ms y cero errores');
  console.log('  • Degradado = p99 < 3s pero latencia alta (UX aceptable)');
  console.log('  • Saturado  = > 5% de errores o p99 > 3s (usuarios afectados)\n');
  console.log('  Cuello de botella típico en este stack:');
  console.log('  → Pool DB max=10: cuando hay > 10 req simultáneas con DB, empiezan a hacer cola');
  console.log('  → bcrypt en login: ~100ms/hash, limita a ~10 logins/s por worker');
  console.log('  → PM2 cluster: añadir workers duplica el throughput (ya configurado)\n');
}

main().catch((err) => {
  console.error(`${R}Error fatal: ${err.message}${Z}`);
  process.exit(1);
});
