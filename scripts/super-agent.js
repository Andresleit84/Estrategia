#!/usr/bin/env node
/**
 * Super Agent — Telegram bot + PM2 supervisor + IPC hub
 *
 * Commands:
 *   /status         — system overview with quick-action buttons
 *   /agents         — PM2 process status
 *   /restart [backend|frontend] — restart services
 *   /tests          — run Jest test suite now
 *   /logs [n]       — last n lines from monitor.log (default 30)
 *   /help           — command list
 *
 * Env (loaded from .env.dev → backend/.env → .env):
 *   TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, SUPER_AGENT_PORT, BACKEND_URL, FRONTEND_URL
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

const http    = require('http');
const https   = require('https');
const { execSync, spawn } = require('child_process');

const SUPER_PORT     = parseInt(process.env.SUPER_AGENT_PORT ?? '3099', 10);
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN ?? '';
const TELEGRAM_CHAT  = process.env.TELEGRAM_CHAT_ID   ?? '';

const LOGS_DIR    = path.join(__dirname, '..', 'logs');
const STATE_FILE  = path.join(LOGS_DIR, 'agent-state.json');
const LOG_FILE    = path.join(LOGS_DIR, 'super-agent.log');
const MONITOR_LOG = path.join(LOGS_DIR, 'monitor.log');

fs.mkdirSync(LOGS_DIR, { recursive: true });

// ── Helpers ───────────────────────────────────────────────────────────────────

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  process.stdout.write(line + '\n');
  try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch { /* ignore */ }
}

function esc(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function bar(value, width = 10) {
  const filled = Math.min(Math.round((Math.max(0, Math.min(100, value)) / 100) * width), width);
  return '▓'.repeat(filled) + '░'.repeat(width - filled);
}

function ts() {
  return new Date().toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60)    return `hace ${s}s`;
  if (s < 3600)  return `hace ${Math.floor(s / 60)}m`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
  return `hace ${Math.floor(s / 86400)}d`;
}

function readState() {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')); }
  catch { return {}; }
}

function writeState(patch) {
  const s = { ...readState(), ...patch };
  try { fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2)); } catch { /* ignore */ }
}

// ── Org context (persisted) ───────────────────────────────────────────────────

const orgCache = new Map(); // id → name — populated on /empresa

function getActiveOrgId()   { return readState().selectedOrgId   || process.env.PRIMARY_ORG_ID || null; }
function getActiveOrgName() { return readState().selectedOrgName || null; }

function saveOrgSelection(id, name) {
  writeState({ selectedOrgId: id, selectedOrgName: name });
}

// ── Telegram API ──────────────────────────────────────────────────────────────

function telegramRequest(method, params = {}) {
  if (!TELEGRAM_TOKEN) return Promise.resolve(null);
  return new Promise((resolve) => {
    const body = JSON.stringify(params);
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${TELEGRAM_TOKEN}/${method}`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve(null); } });
    });
    req.on('error', () => resolve(null));
    req.write(body);
    req.end();
  });
}

async function sendHtml(chatId, html, keyboard) {
  if (!html) return;
  const chunks = [];
  for (let i = 0; i < html.length; i += 4000) chunks.push(html.slice(i, i + 4000));
  for (let i = 0; i < chunks.length; i++) {
    const params = { chat_id: chatId, text: chunks[i], parse_mode: 'HTML' };
    // attach keyboard only to last chunk
    if (keyboard && i === chunks.length - 1) {
      params.reply_markup = JSON.stringify({ inline_keyboard: keyboard });
    }
    await telegramRequest('sendMessage', params);
  }
}

function answerCallback(callbackQueryId, text) {
  return telegramRequest('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

// ── Keyboards ─────────────────────────────────────────────────────────────────

const KB_MAIN = [
  [
    { text: '📋 Acuerdos',   callback_data: 'agreements'    },
    { text: '🏢 Empresa',    callback_data: 'orgs'          },
  ],
  [
    { text: '📊 Sistema',    callback_data: 'system_status' },
    { text: '❓ Ayuda',      callback_data: 'help'          },
  ],
];

const KB_SYSTEM = [
  [
    { text: '🔄 Backend',  callback_data: 'restart_backend'  },
    { text: '🔄 Frontend', callback_data: 'restart_frontend' },
  ],
  [
    { text: '🧪 Tests',    callback_data: 'run_tests' },
    { text: '📋 Logs',     callback_data: 'view_logs' },
  ],
  [{ text: '← Menú principal', callback_data: 'main' }],
];

const KB_AGREEMENTS = [
  [{ text: '🔄 Actualizar', callback_data: 'refresh_agreements' }],
  [
    { text: '🏢 Empresa',       callback_data: 'orgs' },
    { text: '← Menú principal', callback_data: 'main' },
  ],
];

const KB_BACK = [[{ text: '← Menú principal', callback_data: 'main' }]];

// ── Internal API client ───────────────────────────────────────────────────────

function callInternal(urlPath) {
  const base  = (process.env.BACKEND_URL ?? 'http://localhost:3020').replace(/\/$/, '');
  const token = process.env.SUPER_AGENT_TOKEN ?? '';
  const full  = `${base}/api/v1${urlPath}`;

  let parsed;
  try { parsed = new URL(full); } catch { return Promise.resolve(null); }

  const lib = parsed.protocol === 'https:' ? https : http;

  return new Promise((resolve) => {
    const req = lib.request(
      {
        hostname: parsed.hostname,
        port:     parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers:  { Authorization: `Bearer ${token}` },
        timeout:  8000,
      },
      (res) => {
        let data = '';
        res.on('data', (d) => { data += d; });
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch { resolve(null); }
        });
      },
    );
    req.on('error',   () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function statusIcon(status) {
  return { FULFILLED: '✅', IN_PROGRESS: '🟡', PENDING: '⏳', CANCELLED: '⚫' }[status] ?? '❓';
}

function priorityLabel(p) {
  return { CRITICAL: '🔴 Crítico', HIGH: '🟠 Alto', MEDIUM: '🟡 Medio', LOW: '⚪ Bajo' }[p] ?? esc(p);
}

function daysLabel(dueDateStr) {
  if (!dueDateStr) return 'sin fecha límite';
  const diff = Math.ceil((new Date(dueDateStr) - Date.now()) / 86_400_000);
  if (diff < 0)  return `⚠️ <b>vencido hace ${Math.abs(diff)}d</b>`;
  if (diff === 0) return '⚠️ <b>vence HOY</b>';
  return `vence en ${diff}d`;
}

async function handleAgreements() {
  const orgId   = getActiveOrgId();
  const orgName = getActiveOrgName();
  if (!orgId) return {
    text: '🏢 <i>Sin empresa seleccionada.</i>\nToca el botón Empresa para elegir una.',
    keyboard: KB_BACK,
  };

  const data = await callInternal(`/internal/agreements?orgId=${encodeURIComponent(orgId)}`);
  if (!data || data.error) return {
    text: data?.error ? `⚠️ ${esc(data.error)}` : '❌ No se pudo conectar al backend.',
    keyboard: KB_BACK,
  };
  if (!Array.isArray(data) || data.length === 0) return {
    text: `📋 <b>${esc(orgName ?? '')}</b>\n\nNo hay acuerdos activos.`,
    keyboard: [[{ text: '🏢 Cambiar empresa', callback_data: 'orgs' }, { text: '← Menú', callback_data: 'main' }]],
  };

  const text = [
    `📋 <b>${esc(orgName ?? orgId)}</b>`,
    `<i>${data.length} acuerdo(s) activo(s)  ·  ${ts()}</i>`,
  ].join('\n');

  const rows = data.map((a) => {
    const over  = a.is_overdue ? '⚠️ ' : '';
    const short = a.title.length > 34 ? a.title.slice(0, 32) + '…' : a.title;
    return [{ text: `${statusIcon(a.status)} ${a.code}  ${over}${short}`, callback_data: `agr_detail:${a.code}` }];
  });
  rows.push([
    { text: '🔄 Actualizar',    callback_data: 'refresh_agreements' },
    { text: '🏢 Empresa',       callback_data: 'orgs'               },
    { text: '← Menú',           callback_data: 'main'               },
  ]);

  return { text, keyboard: rows };
}

async function handleAgreementDetail(code) {
  const orgId   = getActiveOrgId();
  const orgName = getActiveOrgName();
  const KB_BACK_LIST = [[{ text: '← Volver a lista', callback_data: 'agreements' }]];

  if (!orgId) return { text: '🏢 Sin empresa seleccionada.', keyboard: KB_BACK_LIST };

  const url  = `/internal/agreements?orgId=${encodeURIComponent(orgId)}&code=${encodeURIComponent(code)}`;
  const data = await callInternal(url);
  if (!data)      return { text: '❌ No se pudo conectar al backend.', keyboard: KB_BACK_LIST };
  if (data.error) return { text: `⚠️ ${esc(data.error)}`,             keyboard: KB_BACK_LIST };
  if (!data.code) return { text: `❌ <code>${esc(code)}</code> no encontrado.`, keyboard: KB_BACK_LIST };

  const STATUS_LABEL = { PENDING: 'Pendiente', IN_PROGRESS: 'En progreso', FULFILLED: 'Cumplido', CANCELLED: 'Cancelado' };

  const lines = [
    `📋 <b>${esc(data.code)}</b>`,
    `${esc(data.title)}`,
    `<i>${esc(orgName ?? orgId)}</i>`,
    '',
    `${statusIcon(data.status)} ${STATUS_LABEL[data.status] ?? data.status}    ${priorityLabel(data.priority)}`,
    `📅 ${daysLabel(data.due_date)}`,
  ];
  lines.push(`👤 ${data.owner_name ? esc(data.owner_name) : '<i>Sin responsable asignado</i>'}`);
  if (data.source)                 lines.push(`🔗 ${esc(data.source)}`);
  if (data.linked_items_count > 0) lines.push(`📦 ${data.linked_items_count} épica(s) vinculada(s)`);
  if (data.status === 'FULFILLED' && data.completion_notes) {
    lines.push('', `📝 <i>${esc(data.completion_notes)}</i>`);
  }

  return { text: lines.join('\n'), keyboard: KB_BACK_LIST };
}

// ── Edit-or-send helper (updates message in place) ────────────────────────────

async function editOrSend(chatId, messageId, html, keyboard) {
  if (messageId) {
    const params = { chat_id: chatId, message_id: messageId, text: html, parse_mode: 'HTML' };
    if (keyboard) params.reply_markup = JSON.stringify({ inline_keyboard: keyboard });
    const r = await telegramRequest('editMessageText', params);
    if (r?.ok) return;
    // 400 "message is not modified" is fine — fall through only on other errors
    if (r?.error_code !== 400) { await sendHtml(chatId, html, keyboard); return; }
    return;
  }
  await sendHtml(chatId, html, keyboard);
}

// ── Main menu ─────────────────────────────────────────────────────────────────

function handleMain() {
  const name = getActiveOrgName();
  const orgLine = name
    ? `🏢 <b>${esc(name)}</b>`
    : `🏢 <i>Sin empresa seleccionada — toca Empresa</i>`;
  return [`${orgLine}  ·  <code>${ts()}</code>`, ``, `¿Qué necesitas?`].join('\n');
}

// ── Org selection ─────────────────────────────────────────────────────────────

async function handleOrganizations() {
  const data = await callInternal('/internal/organizations');
  if (!data || data.error || !Array.isArray(data)) {
    return { text: '❌ No se pudieron cargar las empresas.', keyboard: KB_BACK };
  }
  if (data.length === 0) {
    return { text: '⚠️ No hay empresas registradas.', keyboard: KB_BACK };
  }

  const activeId = getActiveOrgId();
  orgCache.clear();
  for (const o of data) orgCache.set(o.id, o.name);

  const rows = data.map((o) => [{
    text: `${o.id === activeId ? '✓ ' : ''}${o.name}`,
    callback_data: `org_select:${o.id}`,
  }]);
  rows.push([{ text: '← Cancelar', callback_data: 'main' }]);

  return { text: `🏢 <b>Selecciona la empresa:</b>`, keyboard: rows };
}

// ── Command handlers ──────────────────────────────────────────────────────────

function handleStatus() {
  const s  = readState();
  const m  = s.monitor ?? {};
  const t  = s.tests   ?? {};
  const be = m.backend  ?? {};
  const fe = m.frontend ?? {};

  const icon   = (up) => up === true ? '🟢' : up === false ? '🔴' : '⚪';
  const state  = (up) => up === true ? 'Activo' : up === false ? 'Caído' : 'Desconocido';
  const age    = (iso) => iso ? relativeTime(iso) : 'sin datos';

  const testLine = t.lastRun
    ? (t.passed
        ? `✅ <b>${t.numPassed}/${t.numTests}</b> OK — ${t.duration}s — ${relativeTime(t.lastRun)}`
        : `❌ <b>${t.numFailed} fallos</b> / ${t.numTests} — ${relativeTime(t.lastRun)}`)
    : `⚪ Sin datos`;

  const beExtra = be.restarts > 0 ? `  ·  ${be.restarts} reinicio(s)` : '';
  const feExtra = fe.restarts > 0 ? `  ·  ${fe.restarts} reinicio(s)` : '';

  const orgName = getActiveOrgName();
  return [
    `🖥 <b>Sistema OKR</b>  ·  <code>${ts()}</code>`,
    orgName ? `🏢 ${esc(orgName)}` : '',
    ``,
    `${icon(be.up)} <b>Backend</b>  ${state(be.up)}`,
    be.lastCheck ? `   └ revisado ${age(be.lastCheck)}${beExtra}` : '',
    ``,
    `${icon(fe.up)} <b>Frontend</b>  ${state(fe.up)}`,
    fe.lastCheck ? `   └ revisado ${age(fe.lastCheck)}${feExtra}` : '',
    ``,
    `🧪 <b>Tests</b>`,
    `   └ ${testLine}`,
  ].filter((l) => l !== '').join('\n');
}

function handleHelp() {
  return [
    `🤖 <b>Super Agent OKR</b>`,
    ``,
    `Usa los botones del menú principal o escribe:`,
    ``,
    `<b>📋 Acuerdos</b>`,
    `<code>/acuerdos</code>       — Lista activos de la empresa`,
    `<code>/acuerdo AGR-N</code>  — Detalle por código`,
    `<code>/empresa</code>        — Cambiar empresa activa`,
    ``,
    `<b>📊 Sistema</b>`,
    `<code>/status</code>         — Estado del sistema`,
    `<code>/agents</code>         — Procesos PM2`,
    `<code>/restart [backend|frontend]</code>`,
    `<code>/tests</code>          — Ejecutar tests`,
    `<code>/logs [n]</code>       — Últimas n líneas`,
  ].join('\n');
}

function handleAgents() {
  try {
    const apps    = JSON.parse(execSync('pm2 jlist', { stdio: 'pipe', timeout: 10000 }).toString());
    const managed = ['okr-backend', 'okr-frontend', 'okr-monitor', 'okr-test-agent', 'okr-super-agent'];
    const icon    = (status) =>
      status === 'online' ? '🟢' : status === 'stopped' ? '⚪' : '🔴';

    const lines = [`🖥 <b>Procesos PM2</b>`, ``];
    for (const app of apps) {
      if (!managed.some((m) => app.name.startsWith(m))) continue;
      const status  = app.pm2_env?.status ?? '?';
      const mem     = app.monit?.memory ? `${Math.round(app.monit.memory / 1024 / 1024)}MB` : '';
      const cpu     = app.monit?.cpu != null ? `${app.monit.cpu}% CPU` : '';
      const uptime  = app.pm2_env?.pm_uptime
        ? relativeTime(new Date(app.pm2_env.pm_uptime).toISOString())
        : '';
      const meta = [mem, cpu, uptime].filter(Boolean).join('  ·  ');
      lines.push(`${icon(status)} <b>${esc(app.name)}</b>  <i>${status}</i>`);
      if (meta) lines.push(`   └ ${meta}`);
    }
    return lines.join('\n');
  } catch (err) {
    return `⚠️ No se pudo obtener estado de PM2: ${esc(err.message)}`;
  }
}

function handleRestart(target) {
  const map = { backend: 'okr-backend', frontend: 'okr-frontend', all: 'okr-backend okr-frontend' };
  const key  = (target || 'all').toLowerCase().trim();
  const apps = map[key] ?? map.all;
  try {
    execSync(`pm2 restart ${apps}`, { stdio: 'pipe', timeout: 20000 });
    return `🔄 <b>Reiniciado:</b> <code>${apps}</code>`;
  } catch (err) {
    return `❌ Error reiniciando <code>${apps}</code>:\n${esc(err.message.slice(0, 200))}`;
  }
}

function handleLogs(nStr) {
  const n = Math.min(parseInt(nStr ?? '30', 10) || 30, 100);
  try {
    const lines = fs.readFileSync(MONITOR_LOG, 'utf8').split('\n').filter(Boolean);
    const tail  = lines.slice(-n).join('\n');
    return `📋 <b>Últimas ${n} líneas — monitor.log</b>\n<pre>${esc(tail)}</pre>`;
  } catch {
    return '⚠️ No hay logs de monitor disponibles aún.';
  }
}

function handleTests(chatId) {
  sendHtml(chatId, '🧪 <b>Ejecutando tests…</b> (puede tardar unos minutos)');
  const proc = spawn('node', [path.join(__dirname, 'test-agent.js')], {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env },
  });
  proc.unref();
  return null;
}

// ── Callback query handler ────────────────────────────────────────────────────

async function handleCallback(cq) {
  const chatId = String(cq.message?.chat?.id ?? TELEGRAM_CHAT);
  if (chatId !== TELEGRAM_CHAT) {
    await answerCallback(cq.id, 'No autorizado');
    return;
  }

  const msgId = cq.message?.message_id;
  log(`Callback: ${cq.data}`);

  // ── Agreement detail ────────────────────────────────────────────────────────
  if (cq.data.startsWith('agr_detail:')) {
    const code = cq.data.slice('agr_detail:'.length);
    await answerCallback(cq.id, 'Cargando…');
    const { text: dt, keyboard: dk } = await handleAgreementDetail(code);
    await editOrSend(chatId, msgId, dt, dk);
    return;
  }

  // ── Org selection ────────────────────────────────────────────────────────────
  if (cq.data.startsWith('org_select:')) {
    const id   = cq.data.slice('org_select:'.length);
    const name = orgCache.get(id) || 'Empresa seleccionada';
    saveOrgSelection(id, name);
    await answerCallback(cq.id, `✅ ${name}`);
    await editOrSend(chatId, msgId, handleMain(), KB_MAIN);
    return;
  }

  switch (cq.data) {
    // ── Menú principal ──────────────────────────────────────────────────────────
    case 'main':
      await answerCallback(cq.id, '');
      await editOrSend(chatId, msgId, handleMain(), KB_MAIN);
      break;

    // ── Acuerdos ────────────────────────────────────────────────────────────────
    case 'agreements':
    case 'refresh_agreements': {
      await answerCallback(cq.id, cq.data === 'refresh_agreements' ? 'Actualizando…' : 'Cargando acuerdos…');
      const { text: at, keyboard: ak } = await handleAgreements();
      await editOrSend(chatId, msgId, at, ak);
      break;
    }

    // ── Empresa ─────────────────────────────────────────────────────────────────
    case 'orgs': {
      await answerCallback(cq.id, 'Cargando empresas…');
      const { text, keyboard } = await handleOrganizations();
      await editOrSend(chatId, msgId, text, keyboard);
      break;
    }

    // ── Sistema ─────────────────────────────────────────────────────────────────
    case 'system_status':
      await answerCallback(cq.id, '');
      await editOrSend(chatId, msgId, handleStatus(), KB_SYSTEM);
      break;
    case 'restart_backend':
      await answerCallback(cq.id, 'Reiniciando backend…');
      await editOrSend(chatId, msgId, handleRestart('backend'), KB_SYSTEM);
      break;
    case 'restart_frontend':
      await answerCallback(cq.id, 'Reiniciando frontend…');
      await editOrSend(chatId, msgId, handleRestart('frontend'), KB_SYSTEM);
      break;
    case 'restart_all':
      await answerCallback(cq.id, 'Reiniciando servicios…');
      await editOrSend(chatId, msgId, handleRestart('all'), KB_SYSTEM);
      break;
    case 'run_tests':
      await answerCallback(cq.id, 'Lanzando tests…');
      handleTests(chatId);
      break;
    case 'view_logs':
      await answerCallback(cq.id, 'Cargando logs…');
      await sendHtml(chatId, handleLogs('30'), KB_BACK);
      break;

    // ── Ayuda ────────────────────────────────────────────────────────────────────
    case 'help':
      await answerCallback(cq.id, '');
      await editOrSend(chatId, msgId, handleHelp(), KB_BACK);
      break;

    default:
      await answerCallback(cq.id, '');
  }
}

// ── Event handler from sub-agents ─────────────────────────────────────────────

function handleEvent(payload) {
  log(`Event from ${payload.source}: ${payload.type}`);
  if (!TELEGRAM_CHAT) return;

  const { type, message, results } = payload;

  if (type === 'ALERT' && message) {
    sendHtml(TELEGRAM_CHAT, `⚠️ ${esc(message)}`);
    return;
  }
  if (type === 'RUN_TESTS') {
    handleTests(TELEGRAM_CHAT);
    return;
  }
  if (type === 'RUN_PASSED' && results) {
    sendHtml(TELEGRAM_CHAT, [
      `✅ <b>Tests completados</b>`,
      `${results.numPassed}/${results.numTests} OK  ·  ${results.duration}s`,
    ].join('\n'));
    return;
  }
  if (type === 'RUN_FAILED' && results) {
    const failed = (results.failedSuites ?? []).slice(0, 3)
      .map((s) => `• <code>${esc(s.name)}</code>`).join('\n');
    sendHtml(TELEGRAM_CHAT, [
      `❌ <b>Tests FALLIDOS</b>`,
      `${results.numFailed} fallos / ${results.numTests} tests`,
      failed,
    ].filter(Boolean).join('\n'));
    return;
  }
}

// ── Internal HTTP server (IPC from sub-agents) ────────────────────────────────

const ipcServer = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/event') {
    res.writeHead(404).end();
    return;
  }
  let body = '';
  req.on('data', (d) => { body += d; });
  req.on('end', () => {
    res.writeHead(204).end();
    try { handleEvent(JSON.parse(body)); } catch { /* ignore */ }
  });
});

ipcServer.listen(SUPER_PORT, '127.0.0.1', () => {
  log(`IPC server listening on 127.0.0.1:${SUPER_PORT}`);
});

ipcServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    log(`Port ${SUPER_PORT} already in use — IPC disabled`);
  } else {
    log(`IPC server error: ${err.message}`);
  }
});

// ── Telegram long polling ─────────────────────────────────────────────────────

let tgOffset  = 0;
let tgRunning = false;

async function pollTelegram() {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT) return;
  if (tgRunning) return;
  tgRunning = true;

  try {
    const res = await telegramRequest('getUpdates', {
      offset: tgOffset,
      timeout: 25,
      allowed_updates: ['message', 'callback_query'],
    });
    if (!res?.ok || !Array.isArray(res.result)) { tgRunning = false; return; }

    for (const update of res.result) {
      tgOffset = update.update_id + 1;

      if (update.callback_query) {
        await handleCallback(update.callback_query);
        continue;
      }

      const msg = update.message;
      if (!msg?.text) continue;

      const chatId = String(msg.chat.id);
      if (chatId !== TELEGRAM_CHAT) {
        log(`Ignored message from unauthorized chat ${chatId}`);
        continue;
      }

      const text           = msg.text.trim();
      const [cmd, ...args] = text.split(/\s+/);
      log(`Telegram command: ${text}`);

      switch (cmd.toLowerCase()) {
        case '/start':
          await sendHtml(chatId, handleMain(), KB_MAIN);
          break;
        case '/status':
          await sendHtml(chatId, handleStatus(), KB_SYSTEM);
          break;
        case '/help':
          await sendHtml(chatId, handleHelp(), KB_BACK);
          break;
        case '/agents':
          await sendHtml(chatId, handleAgents(), KB_SYSTEM);
          break;
        case '/restart':
          await sendHtml(chatId, handleRestart(args[0]));
          break;
        case '/logs':
          await sendHtml(chatId, handleLogs(args[0]), KB_BACK);
          break;
        case '/tests': {
          const r = handleTests(chatId);
          if (r) await sendHtml(chatId, r);
          break;
        }
        case '/empresa': {
          const { text: t, keyboard: k } = await handleOrganizations();
          await sendHtml(chatId, t, k);
          break;
        }
        case '/acuerdos': {
          const { text: at, keyboard: ak } = await handleAgreements();
          await sendHtml(chatId, at, ak);
          break;
        }
        case '/acuerdo': {
          if (!args[0]) { await sendHtml(chatId, '❌ Especifica el código: <code>/acuerdo AGR-5</code>', KB_BACK); break; }
          const { text: dt, keyboard: dk } = await handleAgreementDetail(args[0]);
          await sendHtml(chatId, dt, dk);
          break;
        }
        default:
          if (text.startsWith('/')) {
            await sendHtml(chatId, `Comando no reconocido: <code>${esc(cmd)}</code>`, KB_BACK);
          }
      }
    }
  } catch (err) {
    log(`Telegram poll error: ${err.message}`);
  }

  tgRunning = false;
}

setInterval(pollTelegram, 2000);

// ── Heartbeat ─────────────────────────────────────────────────────────────────

setInterval(() => {
  const s    = readState();
  const beUp = s.monitor?.backend?.up;
  const feUp = s.monitor?.frontend?.up;
  if (beUp === false || feUp === false) {
    const down = [beUp === false && 'backend', feUp === false && 'frontend'].filter(Boolean).join(', ');
    log(`HEARTBEAT — services DOWN: ${down}`);
  }
}, 60_000);

// ── Startup ───────────────────────────────────────────────────────────────────

log('Super Agent started');

if (!TELEGRAM_TOKEN) {
  log('WARN: TELEGRAM_BOT_TOKEN not set — Telegram integration disabled');
} else if (!TELEGRAM_CHAT) {
  log('WARN: TELEGRAM_CHAT_ID not set — cannot send/receive messages');
} else {
  sendHtml(TELEGRAM_CHAT, handleMain(), KB_MAIN)
    .then(() => log('Telegram startup message sent'));
}

process.on('SIGTERM', () => {
  log('Super Agent stopping (SIGTERM)');
  if (TELEGRAM_CHAT) sendHtml(TELEGRAM_CHAT, '⏹ <b>Super Agent</b> detenido');
  ipcServer.close();
  process.exit(0);
});
