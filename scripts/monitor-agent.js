#!/usr/bin/env node
/**
 * Monitor Agent
 * Polls backend and frontend health, auto-restarts failed services via PM2,
 * and forwards incidents to the Super Agent.
 *
 * Env vars (read from backend/.env):
 *   BACKEND_URL, FRONTEND_URL, SUPER_AGENT_PORT, MONITOR_INTERVAL
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
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
const { execSync } = require('child_process');

const BACKEND_URL    = process.env.BACKEND_URL    ?? 'http://localhost:3001';
const FRONTEND_URL   = process.env.FRONTEND_URL   ?? 'http://localhost:3000';
const SUPER_PORT     = parseInt(process.env.SUPER_AGENT_PORT  ?? '3099', 10);
const INTERVAL_MS    = parseInt(process.env.MONITOR_INTERVAL  ?? '30000', 10);
const FAIL_THRESHOLD = 3;
const RESTART_COOLDOWN_MS = 5 * 60 * 1000;

const LOGS_DIR   = path.join(__dirname, '..', 'logs');
const STATE_FILE = path.join(LOGS_DIR, 'agent-state.json');
const LOG_FILE   = path.join(LOGS_DIR, 'monitor.log');

const svcState = {
  backend:  { up: true, failures: 0, lastRestart: 0, lastCheck: null, restarts: 0 },
  frontend: { up: true, failures: 0, lastRestart: 0, lastCheck: null, restarts: 0 },
};

// ── Logging ──────────────────────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch { /* ignore */ }
}

// ── HTTP health check ────────────────────────────────────────────────────────

function checkUrl(urlStr, timeoutMs = 6000) {
  return new Promise((resolve) => {
    try {
      const u   = new URL(urlStr);
      const mod = u.protocol === 'https:' ? https : http;
      const req = mod.request(
        { hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80), path: u.pathname || '/', method: 'GET', timeout: timeoutMs },
        (res) => { res.resume(); resolve(res.statusCode < 500); }
      );
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.on('error',   () => resolve(false));
      req.end();
    } catch { resolve(false); }
  });
}

// ── PM2 restart ──────────────────────────────────────────────────────────────

function pm2Restart(appName) {
  try {
    execSync(`pm2 restart ${appName}`, { stdio: 'pipe', timeout: 15000 });
    return true;
  } catch (err) {
    log(`pm2 restart ${appName} failed: ${err.message}`);
    return false;
  }
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

function notify(message) {
  log(message.replace(/\*/g, ''));
  sendTelegram(message);
  postEvent({ source: 'monitor', type: 'ALERT', message, ts: new Date().toISOString() });
}

// ── State file ────────────────────────────────────────────────────────────────

function persistState() {
  try {
    let current = {};
    try { current = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8').replace(/^﻿/, '')); } catch { /* new */ }
    current.monitor = {
      backend:   { up: svcState.backend.up,  failures: svcState.backend.failures,  restarts: svcState.backend.restarts,  lastCheck: svcState.backend.lastCheck  },
      frontend:  { up: svcState.frontend.up, failures: svcState.frontend.failures, restarts: svcState.frontend.restarts, lastCheck: svcState.frontend.lastCheck },
      updatedAt: new Date().toISOString(),
    };
    fs.writeFileSync(STATE_FILE, JSON.stringify(current, null, 2));
  } catch { /* ignore */ }
}

// ── Per-service check ─────────────────────────────────────────────────────────

async function checkService(name, healthUrl, pm2App) {
  const svc    = svcState[name];
  const isUp   = await checkUrl(healthUrl);
  svc.lastCheck = new Date().toISOString();

  if (isUp) {
    if (!svc.up) {
      svc.up     = true;
      svc.failures = 0;
      notify(`✅ *${name.toUpperCase()}* recuperado — ${new Date().toLocaleString('es-ES')}`);
    } else {
      svc.failures = 0;
    }
    return;
  }

  svc.failures++;
  log(`${name} health check failed (${svc.failures}/${FAIL_THRESHOLD})`);

  if (svc.failures < FAIL_THRESHOLD) return;

  if (svc.up) {
    svc.up = false;
    notify(`🔴 *${name.toUpperCase()}* no responde (${FAIL_THRESHOLD} intentos fallidos). Iniciando reinicio...`);
  }

  const cooldownOk = Date.now() - svc.lastRestart > RESTART_COOLDOWN_MS;
  if (!cooldownOk) {
    const wait = Math.ceil((RESTART_COOLDOWN_MS - (Date.now() - svc.lastRestart)) / 1000);
    log(`${name} restart in cooldown — ${wait}s remaining`);
    return;
  }

  svc.lastRestart = Date.now();
  svc.restarts++;
  svc.failures = 0;

  const ok = pm2Restart(pm2App);
  if (ok) {
    notify(`🔄 *${pm2App}* reiniciado (intento #${svc.restarts}). Monitoreando recuperación...`);
  } else {
    notify(`⚠️ *${pm2App}* no pudo reiniciarse. Intervención manual requerida.`);
  }
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function tick() {
  await Promise.all([
    checkService('backend',  `${BACKEND_URL}/api/v1/health`, 'okr-backend'),
    checkService('frontend', `${FRONTEND_URL}/`,             'okr-frontend'),
  ]);
  persistState();
}

fs.mkdirSync(LOGS_DIR, { recursive: true });
log('Monitor Agent started');
sendTelegram(`🟢 *Monitor Agent* iniciado\nMonitoreando backend y frontend cada ${INTERVAL_MS / 1000}s`);
postEvent({ source: 'monitor', type: 'START', ts: new Date().toISOString() });

tick();
setInterval(tick, INTERVAL_MS);

process.on('SIGTERM', () => {
  log('Monitor Agent stopping (SIGTERM)');
  sendTelegram('⏹ *Monitor Agent* detenido');
  process.exit(0);
});
