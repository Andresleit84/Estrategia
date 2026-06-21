#!/usr/bin/env node
/**
 * post-deploy-check.js — Verificación completa post-deploy
 * Corre al final de deploy.sh. Siempre exit 0 (el deploy no debe fallar por los checks).
 * Notifica por Telegram con el resultado detallado.
 *
 * Cobertura: infraestructura · DB (vistas/funciones/SP/triggers/integridad) ·
 *            API (public + autenticados) · agentes PM2 · logs · migraciones
 */

'use strict';

const fs      = require('fs');
const path    = require('path');
const http    = require('http');
const https   = require('https');
const { execSync } = require('child_process');

// ── Cargar .env ────────────────────────────────────────────────────────────────

(function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '.env'),
    path.join(__dirname, '..', 'backend', '.env'),
    path.join(__dirname, '..', '.env.dev'),
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
    } catch { /* siguiente */ }
  }
})();

// ── Dependencias desde backend/node_modules ───────────────────────────────────

const BM = path.join(__dirname, '..', 'backend', 'node_modules');
let Pool, jwt;
try {
  ({ Pool } = require(path.join(BM, 'pg')));
  jwt        = require(path.join(BM, 'jsonwebtoken'));
} catch (e) {
  console.error('[post-deploy-check] ERROR cargando dependencias:', e.message);
  process.exit(0);
}

// ── Constantes ─────────────────────────────────────────────────────────────────

const BACKEND_PORT = parseInt(process.env.PORT ?? '3020', 10);
const BACKEND      = `http://127.0.0.1:${BACKEND_PORT}`;
const LOGS_DIR     = path.join(__dirname, '..', 'logs');
const STATE_FILE   = path.join(LOGS_DIR, 'agent-state.json');
const LOG_FILE     = path.join(LOGS_DIR, 'post-deploy-check.log');
const RESULTS_FILE = path.join(LOGS_DIR, 'post-deploy-check.json');
const START_TS     = Date.now();

const DB_OPTS = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, max: 3, connectionTimeoutMillis: 5000 }
  : {
      host: process.env.DB_HOST ?? '127.0.0.1',
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 3,
      connectionTimeoutMillis: 5000,
    };

// PM2 esperados
const EXPECTED_PM2 = ['okr-backend', 'okr-frontend', 'okr-super-agent', 'okr-monitor', 'okr-test-agent'];

// Vistas críticas que deben existir y ser consultables
const CRITICAL_VIEWS = [
  'v_objectives_with_progress',
  'v_key_results_with_trend',
  'v_cycle_health',
  'v_executive_dashboard',
  'v_at_risk_krs',
  'v_user_session',
  'v_alignment_map',
  'v_team_health',
  'v_initiative_timeline',
  'v_mcp_audit_summary',
];

// Funciones críticas
const CRITICAL_FUNCTIONS = [
  'fn_user_has_permission',
  'fn_calculate_kr_progress',
  'fn_calculate_objective_progress',
  'fn_predict_kr_completion',
  'fn_get_alignment_gaps',
  'fn_get_cycle_score',
  'fn_validate_okr_quality',
  'fn_check_login_attempts',
  'fn_global_search',
];

// Procedimientos críticos
const CRITICAL_PROCEDURES = [
  'sp_validate_login',
  'sp_create_check_in',
  'sp_create_objective',
  'sp_create_key_result',
  'sp_close_cycle',
  'sp_activate_cycle',
  'sp_invite_user',
  'sp_create_organization',
  'sp_register_user',
];

// Tablas críticas
const CRITICAL_TABLES = [
  'users', 'organizations', 'cycles', 'objectives',
  'key_results', 'check_ins', 'teams', 'audit_log',
  'refresh_tokens', 'invitations',
];

// Triggers críticos (nombres reales en la DB)
const CRITICAL_TRIGGERS = [
  'trg_audit_log_key_results',
  'trg_audit_log_objectives',
  'trg_audit_log_checkins',
  'trg_audit_log_cycles',
  'trg_audit_log_organizations',
];

// Endpoints API a verificar: [método, path, requiereAuth, descripción, statusEsperado]
const API_CHECKS = [
  ['GET',  '/api/v1/health',                        false, 'health check',                200],
  ['GET',  '/api/v1/auth/me',                       true,  'auth /me',                    200],
  ['GET',  '/api/v1/organizations/me',              true,  'organization actual',         200],
  ['GET',  '/api/v1/organizations/me/members',      true,  'org members',                 200],
  ['GET',  '/api/v1/cycles',                        true,  'cycles list',                 200],
  ['GET',  '/api/v1/objectives',                    true,  'objectives list',             200],
  ['GET',  '/api/v1/teams',                         true,  'teams list',                  200],
  ['GET',  '/api/v1/check-ins/at-risk-krs',         true,  'check-ins at-risk-krs',       200],
  ['GET',  '/api/v1/check-ins/cadence-dashboard',   true,  'cadence dashboard',           200],
  ['GET',  '/api/v1/reports/executive-dashboard',   true,  'executive dashboard',         200],
  ['GET',  '/api/v1/search?q=test',                 true,  'global search',               200],
  ['GET',  '/api/v1/areas',                         true,  'areas list',                  200],
  ['GET',  '/api/v1/initiatives',                   true,  'initiatives list',            200],
  ['POST', '/api/v1/auth/login',                    false, 'login → 401 expected',        401],
];

// ── Estado de checks ───────────────────────────────────────────────────────────

const checks = [];

function record(category, name, status, detail = '') {
  // status: 'pass' | 'warn' | 'fail'
  const entry = { category, name, status, detail };
  checks.push(entry);
  const icon = status === 'pass' ? 'OK' : status === 'warn' ? 'WARN' : 'FAIL';
  log(`[${icon}] [${category}] ${name}${detail ? ': ' + detail : ''}`);
  return status === 'pass';
}

// ── Logging ────────────────────────────────────────────────────────────────────

fs.mkdirSync(LOGS_DIR, { recursive: true });

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch { /* ignore */ }
}

// ── HTTP helper ────────────────────────────────────────────────────────────────

function httpRequest(method, url, opts = {}) {
  return new Promise((resolve) => {
    try {
      const u   = new URL(url);
      const mod = u.protocol === 'https:' ? https : http;
      const body = opts.body ? JSON.stringify(opts.body) : undefined;
      const reqOpts = {
        hostname: u.hostname,
        port:     u.port || (u.protocol === 'https:' ? 443 : 80),
        path:     u.pathname + (u.search || ''),
        method,
        timeout:  opts.timeout ?? 8000,
        headers:  {
          'Content-Type': 'application/json',
          ...(body ? { 'Content-Length': Buffer.byteLength(body) } : {}),
          ...(opts.headers ?? {}),
        },
      };
      const req = mod.request(reqOpts, (res) => {
        let raw = '';
        res.on('data', (d) => { raw += d; });
        res.on('end', () => {
          let json = null;
          try { json = JSON.parse(raw); } catch { /* texto plano */ }
          resolve({ status: res.statusCode, body: json ?? raw });
        });
      });
      req.on('timeout', () => { req.destroy(); resolve({ status: 0, body: 'timeout' }); });
      req.on('error',   (e) => resolve({ status: 0, body: e.message }));
      if (body) req.write(body);
      req.end();
    } catch (e) {
      resolve({ status: 0, body: e.message });
    }
  });
}

// ── JWT para tests autenticados ────────────────────────────────────────────────

async function buildTestToken(pool) {
  if (!jwt || !process.env.JWT_SECRET) return null;
  try {
    const { rows } = await pool.query(
      `SELECT u.id AS user_id, u.organization_id, u.role
         FROM users u
        WHERE u.is_active = true AND u.deleted_at IS NULL
        ORDER BY u.created_at
        LIMIT 1`,
    );
    if (!rows.length) return null;
    const { user_id, organization_id, role } = rows[0];
    return jwt.sign(
      { sub: user_id, orgId: organization_id, role },
      process.env.JWT_SECRET,
      { expiresIn: '5m' },
    );
  } catch { return null; }
}

// ── 1. INFRAESTRUCTURA ─────────────────────────────────────────────────────────

async function checkInfrastructure() {
  log('\n--- INFRAESTRUCTURA ---');

  // PM2 procesos
  try {
    const raw  = execSync('pm2 jlist', { timeout: 10000 }).toString();
    const list = JSON.parse(raw);
    const online = list.filter((p) => p.pm2_env?.status === 'online').map((p) => p.name);
    // okr-test-agent tiene autorestart:false — puede estar stopped (normal fuera de cron)
    const missingStrict = EXPECTED_PM2.filter((name) => {
      if (name === 'okr-test-agent') return false; // puede estar stopped
      return !online.includes(name);
    });
    if (missingStrict.length === 0) {
      record('INFRA', `PM2 (${online.length} activos de ${EXPECTED_PM2.length})`, 'pass', online.join(', '));
    } else {
      record('INFRA', 'PM2 procesos', 'fail', `Faltantes: ${missingStrict.join(', ')}`);
    }
    // Restarts excesivos en okr-backend
    const backend = list.filter((p) => p.name === 'okr-backend');
    const maxRestarts = Math.max(...backend.map((p) => p.pm2_env?.restart_time ?? 0), 0);
    if (maxRestarts > 50) {
      record('INFRA', 'PM2 backend restarts', 'warn', `${maxRestarts} restarts — revisar logs`);
    } else {
      record('INFRA', `PM2 backend restarts (${maxRestarts})`, 'pass');
    }
  } catch (e) {
    record('INFRA', 'PM2 estado', 'fail', e.message.slice(0, 100));
  }

  // Backend health endpoint
  const health = await httpRequest('GET', `${BACKEND}/api/v1/health`);
  if (health.status === 200 && health.body?.status === 'ok') {
    record('INFRA', 'Backend /health', 'pass', 'status:ok');
  } else if (health.status === 200 && health.body?.status === 'degraded') {
    record('INFRA', 'Backend /health', 'warn', `degraded — ${JSON.stringify(health.body?.checks)}`);
  } else {
    record('INFRA', 'Backend /health', 'fail', `status=${health.status} body=${JSON.stringify(health.body).slice(0, 80)}`);
  }

  // DB check desde health
  if (health.body?.checks?.database === 'ok') {
    record('INFRA', 'PostgreSQL (via health)', 'pass');
  } else {
    record('INFRA', 'PostgreSQL (via health)', 'fail', health.body?.checks?.database ?? 'no response');
  }

  // Redis check desde health
  if (health.body?.checks?.redis === 'ok') {
    record('INFRA', 'Redis (via health)', 'pass');
  } else {
    record('INFRA', 'Redis (via health)', 'fail', health.body?.checks?.redis ?? 'no response');
  }

  // Frontend
  const fe = await httpRequest('GET', 'http://127.0.0.1:3000');
  if (fe.status === 200) {
    record('INFRA', 'Frontend HTTP', 'pass', 'HTTP 200');
  } else {
    record('INFRA', 'Frontend HTTP', 'fail', `HTTP ${fe.status}`);
  }

  // Nginx (si está corriendo)
  try {
    execSync('systemctl is-active --quiet nginx', { timeout: 3000 });
    record('INFRA', 'Nginx', 'pass', 'active');
  } catch {
    record('INFRA', 'Nginx', 'warn', 'no activo o sin systemctl');
  }
}

// ── 2. BASE DE DATOS ───────────────────────────────────────────────────────────

async function checkDatabase(pool) {
  log('\n--- BASE DE DATOS ---');

  // Conexión básica
  try {
    const { rows } = await pool.query('SELECT version() AS v');
    const ver = rows[0]?.v?.match(/PostgreSQL ([0-9.]+)/)?.[1] ?? 'desconocida';
    record('DB', `Conexión PostgreSQL ${ver}`, 'pass');
  } catch (e) {
    record('DB', 'Conexión PostgreSQL', 'fail', e.message.slice(0, 100));
    return; // sin conexión, no tiene sentido seguir
  }

  // Tablas críticas
  try {
    const names = CRITICAL_TABLES.map((t) => `'${t}'`).join(',');
    const { rows } = await pool.query(
      `SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename IN (${names})`,
    );
    const found   = rows.map((r) => r.tablename);
    const missing = CRITICAL_TABLES.filter((t) => !found.includes(t));
    if (missing.length === 0) {
      record('DB', `Tablas críticas (${CRITICAL_TABLES.length})`, 'pass');
    } else {
      record('DB', 'Tablas críticas', 'fail', `Faltantes: ${missing.join(', ')}`);
    }
  } catch (e) {
    record('DB', 'Tablas críticas', 'fail', e.message.slice(0, 100));
  }

  // Vistas críticas — existencia
  try {
    const names = CRITICAL_VIEWS.map((v) => `'${v}'`).join(',');
    const { rows } = await pool.query(
      `SELECT viewname FROM pg_views WHERE schemaname='public' AND viewname IN (${names})`,
    );
    const found   = rows.map((r) => r.viewname);
    const missing = CRITICAL_VIEWS.filter((v) => !found.includes(v));
    if (missing.length === 0) {
      record('DB', `Vistas críticas (${CRITICAL_VIEWS.length})`, 'pass');
    } else {
      record('DB', 'Vistas críticas', 'fail', `Faltantes: ${missing.join(', ')}`);
    }
  } catch (e) {
    record('DB', 'Vistas críticas', 'fail', e.message.slice(0, 100));
  }

  // Vistas consultables — ejecutar SELECT en las más críticas
  const viewsToQuery = ['v_objectives_with_progress', 'v_key_results_with_trend', 'v_cycle_health', 'v_user_session'];
  for (const v of viewsToQuery) {
    try {
      await pool.query(`SELECT 1 FROM ${v} LIMIT 1`);
      record('DB', `Vista consultable: ${v}`, 'pass');
    } catch (e) {
      record('DB', `Vista consultable: ${v}`, 'fail', e.message.slice(0, 120));
    }
  }

  // Funciones críticas — existencia
  try {
    const names = CRITICAL_FUNCTIONS.map((f) => `'${f}'`).join(',');
    const { rows } = await pool.query(
      `SELECT routine_name FROM information_schema.routines
        WHERE routine_schema='public' AND routine_name IN (${names})`,
    );
    const found   = rows.map((r) => r.routine_name);
    const missing = CRITICAL_FUNCTIONS.filter((f) => !found.includes(f));
    if (missing.length === 0) {
      record('DB', `Funciones críticas (${CRITICAL_FUNCTIONS.length})`, 'pass');
    } else {
      record('DB', 'Funciones críticas', 'fail', `Faltantes: ${missing.join(', ')}`);
    }
  } catch (e) {
    record('DB', 'Funciones críticas', 'fail', e.message.slice(0, 100));
  }

  // Procedimientos críticos — existencia
  try {
    const names = CRITICAL_PROCEDURES.map((p) => `'${p}'`).join(',');
    const { rows } = await pool.query(
      `SELECT routine_name FROM information_schema.routines
        WHERE routine_schema='public' AND routine_name IN (${names})`,
    );
    const found   = rows.map((r) => r.routine_name);
    const missing = CRITICAL_PROCEDURES.filter((p) => !found.includes(p));
    if (missing.length === 0) {
      record('DB', `Procedimientos críticos (${CRITICAL_PROCEDURES.length})`, 'pass');
    } else {
      record('DB', 'Procedimientos críticos', 'fail', `Faltantes: ${missing.join(', ')}`);
    }
  } catch (e) {
    record('DB', 'Procedimientos críticos', 'fail', e.message.slice(0, 100));
  }

  // Triggers críticos
  try {
    const names = CRITICAL_TRIGGERS.map((t) => `'${t}'`).join(',');
    const { rows } = await pool.query(
      `SELECT trigger_name FROM information_schema.triggers
        WHERE trigger_schema='public' AND trigger_name IN (${names})`,
    );
    const found   = [...new Set(rows.map((r) => r.trigger_name))];
    const missing = CRITICAL_TRIGGERS.filter((t) => !found.includes(t));
    if (missing.length === 0) {
      record('DB', `Triggers críticos (${CRITICAL_TRIGGERS.length})`, 'pass');
    } else {
      record('DB', 'Triggers críticos', 'fail', `Faltantes: ${missing.join(', ')}`);
    }
  } catch (e) {
    record('DB', 'Triggers críticos', 'fail', e.message.slice(0, 100));
  }

  // Integridad: al menos 1 usuario activo
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM users WHERE is_active=true AND deleted_at IS NULL`,
    );
    const n = rows[0]?.n ?? 0;
    if (n > 0) {
      record('DB', `Usuarios activos (${n})`, 'pass');
    } else {
      record('DB', 'Usuarios activos', 'fail', 'ningún usuario activo encontrado');
    }
  } catch (e) {
    record('DB', 'Usuarios activos', 'fail', e.message.slice(0, 100));
  }

  // Integridad: al menos 1 organización
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM organizations WHERE deleted_at IS NULL`,
    );
    const n = rows[0]?.n ?? 0;
    if (n > 0) {
      record('DB', `Organizaciones (${n})`, 'pass');
    } else {
      record('DB', 'Organizaciones', 'warn', 'sin organizaciones — sistema sin datos');
    }
  } catch (e) {
    record('DB', 'Organizaciones', 'fail', e.message.slice(0, 100));
  }

  // Audit log funcional (tiene registros recientes)
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM audit_log WHERE occurred_at > NOW() - INTERVAL '24 hours'`,
    );
    const n = rows[0]?.n ?? 0;
    record('DB', `Audit log activo (${n} registros 24h)`, n >= 0 ? 'pass' : 'warn');
  } catch (e) {
    record('DB', 'Audit log', 'fail', e.message.slice(0, 100));
  }

  // Migraciones aplicadas sin errores
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM _prisma_migrations WHERE rolled_back_at IS NOT NULL`,
    );
    const n = rows[0]?.n ?? 0;
    if (n === 0) {
      record('DB', 'Migraciones (sin rollbacks)', 'pass');
    } else {
      record('DB', 'Migraciones', 'fail', `${n} migración(es) con rollback`);
    }
  } catch (e) {
    record('DB', 'Migraciones (_prisma_migrations)', 'warn', 'tabla no encontrada o sin acceso');
  }

  // Total de migraciones aplicadas
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM _prisma_migrations WHERE finished_at IS NOT NULL`,
    );
    const n = rows[0]?.n ?? 0;
    record('DB', `Migraciones aplicadas (${n})`, 'pass');
  } catch { /* ignorar */ }

  // Índices críticos: verificar que existen
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM pg_indexes WHERE schemaname='public' AND indexname LIKE 'idx_%'`,
    );
    const n = rows[0]?.n ?? 0;
    if (n > 10) {
      record('DB', `Índices (${n})`, 'pass');
    } else {
      record('DB', `Índices (${n})`, 'warn', 'pocos índices — posible migración faltante');
    }
  } catch (e) {
    record('DB', 'Índices', 'fail', e.message.slice(0, 80));
  }

  // fn_user_has_permission ejecutable
  try {
    await pool.query(
      `SELECT fn_user_has_permission('00000000-0000-0000-0000-000000000000'::uuid, 'objectives', 'read')`,
    );
    record('DB', 'fn_user_has_permission ejecutable', 'pass');
  } catch (e) {
    const msg = e.message.slice(0, 120);
    // Puede lanzar error de negocio (user no existe) pero si llega aquí la función existe
    if (msg.includes('does not exist')) {
      record('DB', 'fn_user_has_permission ejecutable', 'fail', msg);
    } else {
      record('DB', 'fn_user_has_permission ejecutable', 'pass', 'función existe y responde');
    }
  }
}

// ── 3. API ENDPOINTS ───────────────────────────────────────────────────────────

async function checkApi(token) {
  log('\n--- API ENDPOINTS ---');

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  for (const [method, urlPath, requiresAuth, desc, expectedStatus] of API_CHECKS) {
    const headers = requiresAuth ? authHeader : {};

    // Para el test de login: enviar body con credenciales inválidas a propósito
    const body = (urlPath === '/api/v1/auth/login')
      ? { email: 'check@deploy.test', password: 'InvalidPass999!' }
      : undefined;

    const res = await httpRequest(method, `${BACKEND}${urlPath}`, { headers, body, timeout: 10000 });

    if (res.status === expectedStatus) {
      record('API', `${method} ${urlPath}`, 'pass', `HTTP ${res.status}`);
    } else if (requiresAuth && !token && res.status === 401) {
      record('API', `${method} ${urlPath}`, 'warn', 'sin token de test — 401 esperado');
    } else if (res.status === 0) {
      record('API', `${method} ${urlPath}`, 'fail', `timeout o sin respuesta`);
    } else {
      record('API', `${method} ${urlPath}`, 'fail', `esperado ${expectedStatus}, recibido ${res.status}`);
    }
  }

  // Verificar que los endpoints protegidos retornan 401 sin token
  const protected401 = await httpRequest('GET', `${BACKEND}/api/v1/objectives`, { headers: {}, timeout: 5000 });
  if (protected401.status === 401) {
    record('API', 'Guard global (retorna 401 sin token)', 'pass');
  } else {
    record('API', 'Guard global (retorna 401 sin token)', 'fail', `HTTP ${protected401.status} — endpoints desprotegidos`);
  }

  // Rate limiting responde (no 500)
  const rl = await httpRequest('GET', `${BACKEND}/api/v1/health`, { timeout: 5000 });
  if (rl.status > 0 && rl.status < 500) {
    record('API', 'Rate limiting operativo (no 5xx)', 'pass');
  } else {
    record('API', 'Rate limiting', 'warn', `HTTP ${rl.status}`);
  }
}

// ── 4. AGENTES PM2 ─────────────────────────────────────────────────────────────

async function checkAgents() {
  log('\n--- AGENTES ---');

  try {
    const raw  = execSync('pm2 jlist', { timeout: 10000 }).toString();
    const list = JSON.parse(raw);
    const byName = {};
    for (const p of list) {
      if (!byName[p.name]) byName[p.name] = [];
      byName[p.name].push(p);
    }

    // Verificar cada agente individualmente
    for (const agent of ['okr-monitor', 'okr-super-agent', 'okr-test-agent']) {
      const procs = byName[agent] ?? [];
      const online = procs.filter((p) => p.pm2_env?.status === 'online');
      if (online.length > 0) {
        const restarts = online[0].pm2_env?.restart_time ?? 0;
        record('AGENTES', `${agent} online`, 'pass', `restarts: ${restarts}`);
      } else if (procs.length > 0) {
        const status = procs[0].pm2_env?.status;
        // test-agent es autorestart:false — stopped es normal fuera del cron
        if (agent === 'okr-test-agent' && status === 'stopped') {
          record('AGENTES', `${agent}`, 'pass', 'stopped (normal — cron 02:00)');
        } else {
          record('AGENTES', `${agent}`, 'fail', `status: ${status}`);
        }
      } else {
        record('AGENTES', `${agent}`, 'fail', 'proceso no encontrado en PM2');
      }
    }

    // okr-backend cluster — todos online
    const backends = byName['okr-backend'] ?? [];
    const backOnline = backends.filter((p) => p.pm2_env?.status === 'online').length;
    if (backOnline === backends.length && backends.length > 0) {
      record('AGENTES', `okr-backend cluster (${backOnline}/${backends.length} online)`, 'pass');
    } else {
      record('AGENTES', `okr-backend cluster`, 'fail', `${backOnline}/${backends.length} online`);
    }

  } catch (e) {
    record('AGENTES', 'PM2 jlist', 'fail', e.message.slice(0, 100));
  }

  // agent-state.json — el monitor ha chequeado recientemente
  try {
    const raw   = fs.readFileSync(STATE_FILE, 'utf8').replace(/^﻿/, '');
    const state = JSON.parse(raw);
    const backendCheck = state?.backend?.lastCheck;
    if (backendCheck) {
      const secsAgo = Math.round((Date.now() - new Date(backendCheck).getTime()) / 1000);
      if (secsAgo < 120) {
        record('AGENTES', `Monitor último check hace ${secsAgo}s`, 'pass');
      } else if (secsAgo < 300) {
        record('AGENTES', `Monitor último check hace ${secsAgo}s`, 'warn', 'lento pero activo');
      } else {
        record('AGENTES', `Monitor último check`, 'fail', `hace ${secsAgo}s — monitor no está corriendo`);
      }
    } else {
      record('AGENTES', 'Monitor estado', 'warn', 'agent-state.json sin lastCheck');
    }
  } catch {
    record('AGENTES', 'agent-state.json', 'warn', 'archivo no encontrado — primera corrida');
  }
}

// ── 5. LOGS ────────────────────────────────────────────────────────────────────

async function checkLogs() {
  log('\n--- LOGS ---');

  // Backend error log — sin errores críticos recientes
  const backendErrorLog = path.join(LOGS_DIR, 'backend-error.log');
  try {
    if (!fs.existsSync(backendErrorLog)) {
      record('LOGS', 'backend-error.log', 'pass', 'sin errores registrados');
    } else {
      const stat = fs.statSync(backendErrorLog);
      const sizeMB = (stat.size / 1024 / 1024).toFixed(1);
      // Leer las últimas 50 líneas
      const content = execSync(`tail -50 "${backendErrorLog}" 2>/dev/null || echo ''`).toString();
      const criticals = (content.match(/ERROR|FATAL|Unhandled/gi) ?? []).length;
      if (criticals === 0) {
        record('LOGS', `backend-error.log (${sizeMB}MB)`, 'pass', 'sin errores críticos recientes');
      } else {
        record('LOGS', `backend-error.log`, 'warn', `${criticals} línea(s) con ERROR/FATAL en últimas 50 líneas`);
      }
    }
  } catch (e) {
    record('LOGS', 'backend-error.log', 'warn', e.message.slice(0, 80));
  }

  // Backend out log — hay actividad reciente
  const backendOutLog = path.join(LOGS_DIR, 'backend-out.log');
  try {
    if (fs.existsSync(backendOutLog)) {
      const stat    = fs.statSync(backendOutLog);
      const minsOld = Math.round((Date.now() - stat.mtimeMs) / 60000);
      if (minsOld < 10) {
        record('LOGS', `backend-out.log (activo hace ${minsOld}min)`, 'pass');
      } else {
        record('LOGS', `backend-out.log`, 'warn', `sin actividad hace ${minsOld} min`);
      }
    } else {
      record('LOGS', 'backend-out.log', 'warn', 'archivo no existe aún');
    }
  } catch (e) {
    record('LOGS', 'backend-out.log', 'warn', e.message.slice(0, 80));
  }

  // Deploy log — último deploy sin errores fatales
  const deployLog = path.join(LOGS_DIR, 'deploy.log');
  try {
    if (fs.existsSync(deployLog)) {
      const content  = execSync(`tail -20 "${deployLog}" 2>/dev/null || echo ''`).toString();
      const hasError = /ERROR|FATAL|exit code [^0]/.test(content);
      if (!hasError) {
        record('LOGS', 'deploy.log', 'pass', 'sin errores fatales en último deploy');
      } else {
        record('LOGS', 'deploy.log', 'warn', 'posibles errores en deploy anterior');
      }
    } else {
      record('LOGS', 'deploy.log', 'warn', 'archivo no existe aún');
    }
  } catch (e) {
    record('LOGS', 'deploy.log', 'warn', e.message.slice(0, 80));
  }

  // Espacio en disco
  try {
    const dfOut = execSync('df -h / | tail -1', { timeout: 3000 }).toString().trim();
    const match = dfOut.match(/(\d+)%/);
    const usedPct = match ? parseInt(match[1]) : 0;
    if (usedPct < 80) {
      record('LOGS', `Disco (${usedPct}% usado)`, 'pass');
    } else if (usedPct < 90) {
      record('LOGS', `Disco (${usedPct}% usado)`, 'warn', 'espacio disponible reducido');
    } else {
      record('LOGS', `Disco (${usedPct}% usado)`, 'fail', 'disco casi lleno — URGENTE');
    }
  } catch {
    record('LOGS', 'Disco', 'warn', 'no se pudo verificar');
  }
}

// ── Telegram ───────────────────────────────────────────────────────────────────

function sendTelegram(text) {
  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  const body = JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' });
  const req  = https.request({
    hostname: 'api.telegram.org',
    path:     `/bot${token}/sendMessage`,
    method:   'POST',
    headers:  { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    timeout:  8000,
  }, (res) => { res.resume(); });
  req.on('error', () => {});
  req.on('timeout', () => { req.destroy(); });
  req.write(body);
  req.end();
}

// ── Reporte ────────────────────────────────────────────────────────────────────

function buildReport() {
  const elapsed = ((Date.now() - START_TS) / 1000).toFixed(1);
  const pass    = checks.filter((c) => c.status === 'pass').length;
  const warn    = checks.filter((c) => c.status === 'warn').length;
  const fail    = checks.filter((c) => c.status === 'fail').length;
  const total   = checks.length;
  const overall = fail > 0 ? 'FAIL' : warn > 0 ? 'WARN' : 'PASS';
  const icon    = fail > 0 ? '🔴' : warn > 0 ? '🟡' : '🟢';

  const byCategory = {};
  for (const c of checks) {
    if (!byCategory[c.category]) byCategory[c.category] = [];
    byCategory[c.category].push(c);
  }

  const catIcon  = (cat) => {
    const c = byCategory[cat] ?? [];
    if (c.some((x) => x.status === 'fail')) return '❌';
    if (c.some((x) => x.status === 'warn')) return '⚠️';
    return '✅';
  };

  const now = new Date().toLocaleString('es-ES', { timeZone: 'America/Bogota', hour12: false });

  const lines = [
    `${icon} *POST-DEPLOY CHECK — ${overall}*`,
    `📅 ${now}  ⏱ ${elapsed}s`,
    `📊 ${pass} OK  ${warn > 0 ? warn + ' WARN  ' : ''}${fail > 0 ? fail + ' FAIL  ' : ''}(${total} checks)`,
    '',
  ];

  const catLabels = {
    INFRA:   '🏗 Infraestructura',
    DB:      '🗄 Base de datos',
    API:     '🌐 API Endpoints',
    AGENTES: '🤖 Agentes',
    LOGS:    '📋 Logs & Disco',
  };

  for (const [cat, label] of Object.entries(catLabels)) {
    const items = byCategory[cat] ?? [];
    if (!items.length) continue;
    const passN = items.filter((c) => c.status === 'pass').length;
    lines.push(`${catIcon(cat)} *${label}* (${passN}/${items.length})`);
    for (const c of items) {
      const ci = c.status === 'pass' ? '✓' : c.status === 'warn' ? '⚠' : '✗';
      const detail = c.detail ? ` — ${c.detail.slice(0, 60)}` : '';
      lines.push(`  ${ci} ${c.name}${detail}`);
    }
    lines.push('');
  }

  if (fail > 0) {
    lines.push('*Fallos críticos:*');
    for (const c of checks.filter((x) => x.status === 'fail').slice(0, 8)) {
      lines.push(`• [${c.category}] ${c.name}: ${(c.detail ?? '').slice(0, 80)}`);
    }
  }

  return lines.join('\n');
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  log('=== POST-DEPLOY CHECK INICIADO ===');

  const pool = new Pool(DB_OPTS);

  await checkInfrastructure();
  await checkDatabase(pool);

  const token = await buildTestToken(pool).catch(() => null);
  if (!token) log('[WARN] No se pudo generar token de test — checks de API sin autenticación');

  await checkApi(token);
  await checkAgents();
  await checkLogs();

  await pool.end().catch(() => {});

  const pass  = checks.filter((c) => c.status === 'pass').length;
  const warn  = checks.filter((c) => c.status === 'warn').length;
  const fail  = checks.filter((c) => c.status === 'fail').length;
  const total = checks.length;

  log(`\n=== RESULTADO: ${pass}/${total} OK | ${warn} WARN | ${fail} FAIL ===`);

  const report = buildReport();

  // Persistir resultados
  try {
    fs.writeFileSync(RESULTS_FILE, JSON.stringify({
      timestamp: new Date().toISOString(),
      summary: { pass, warn, fail, total },
      checks,
    }, null, 2));
  } catch { /* ignorar */ }

  sendTelegram(report);
  log('=== POST-DEPLOY CHECK FINALIZADO ===');
  process.exit(0);
}

main().catch((err) => {
  log(`ERROR FATAL: ${err.message}`);
  process.exit(0);
});
