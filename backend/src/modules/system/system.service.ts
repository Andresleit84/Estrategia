import { Injectable } from '@nestjs/common';
import { execSync, spawn } from 'child_process';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { DbService } from '../../database/db.service';
import { RedisService } from '../../common/redis/redis.service';

interface Pm2Process {
  name: string;
  pm2_env?: { status?: string; pm_uptime?: number; restart_time?: number };
  monit?: { memory?: number; cpu?: number };
}

const AGENT_META: Record<string, { name: string; description: string; role: string }> = {
  'okr-monitor': {
    name: 'Monitor Agent',
    description: 'Verifica cada 30 s que el backend y frontend respondan. Si detecta 3 fallos consecutivos ejecuta un reinicio automático vía PM2 con cooldown de 5 min.',
    role: 'Vigilancia y auto-recuperación',
  },
  'okr-test-agent': {
    name: 'Test Agent',
    description: 'Ejecuta la suite de tests Jest cada noche a las 02:00 AM. Analiza los resultados y notifica vía Telegram si algún test falla.',
    role: 'Calidad continua',
  },
  'okr-super-agent': {
    name: 'Super Agent',
    description: 'Supervisa a los demás agentes y actúa como hub de control. Expone un bot de Telegram para consultar el estado del sistema, ejecutar reinicios y lanzar tests bajo demanda.',
    role: 'Supervisión y control',
  },
};

const SERVICE_NAMES: Record<string, { name: string; description: string }> = {
  'okr-backend': {
    name: 'Backend API',
    description: 'API REST + WebSockets. NestJS en modo cluster, una instancia por núcleo CPU.',
  },
  'okr-frontend': {
    name: 'Frontend Web',
    description: 'Interfaz web del sistema OKR. Next.js en modo producción.',
  },
};

@Injectable()
export class SystemService {
  private pm2Cache: { data: Pm2Process[]; ts: number } | null = null;
  private readonly STATE_FILE = path.join(process.cwd(), '..', 'logs', 'agent-state.json');

  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
    private readonly config: ConfigService,
  ) {}

  async getStatus() {
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const parsed      = new URL(frontendUrl);
    const frontendHost = parsed.hostname;
    const frontendPort = parseInt(parsed.port || (parsed.protocol === 'https:' ? '443' : '80'), 10);

    const [pm2Processes, dbOk, redisOk, agentState, frontendReachable] = await Promise.all([
      this.getPm2Processes(),
      this.db.healthCheck().catch(() => false),
      this.redis.ping().then(() => true).catch(() => false),
      this.readAgentState(),
      this.checkHttp(frontendHost, frontendPort, '/').catch(() => false),
    ]);

    // Match by prefix to support both production (okr-backend) and dev (okr-backend-dev) names
    const findAll  = (prefix: string) => pm2Processes.filter((p) => p.name.startsWith(prefix));
    const findOne  = (prefix: string) => pm2Processes.find((p) => p.name.startsWith(prefix));

    const backendProc  = findAll('okr-backend');
    const frontendProc = findOne('okr-frontend');

    // Backend is always online if we are responding to this request.
    // PM2 process info is used only for metrics (memory, CPU, uptime).
    const backendOnline  = true;
    const frontendOnline = frontendProc?.pm2_env?.status === 'online' || frontendReachable;

    const avgMemory = (procs: Pm2Process[]) => {
      const vals = procs.map((p) => p.monit?.memory ?? 0).filter(Boolean);
      return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
    };
    const avgCpu = (procs: Pm2Process[]) => {
      const vals = procs.map((p) => p.monit?.cpu ?? 0);
      return vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
    };

    const services = [
      {
        id: 'okr-backend',
        name: 'Backend API',
        description: SERVICE_NAMES['okr-backend'].description,
        status: dbOk && redisOk ? 'online' : 'degraded',
        instances: backendProc.length || 1,
        memory: avgMemory(backendProc),
        cpu: avgCpu(backendProc),
        uptime: backendProc[0]?.pm2_env?.pm_uptime ?? null,
        checks: [
          { key: 'API', status: backendOnline ? 'ok' : 'error' },
          { key: 'Base de datos', status: dbOk ? 'ok' : 'error' },
          { key: 'Redis', status: redisOk ? 'ok' : 'error' },
        ],
      },
      {
        id: 'okr-frontend',
        name: 'Frontend Web',
        description: SERVICE_NAMES['okr-frontend'].description,
        status: frontendOnline
          ? 'online'
          : agentState?.monitor?.frontend?.up === false
          ? 'offline'
          : 'unknown',
        instances: frontendOnline ? 1 : 0,
        memory: frontendProc?.monit?.memory ?? null,
        cpu: frontendProc?.monit?.cpu ?? null,
        uptime: frontendProc?.pm2_env?.pm_uptime ?? null,
        checks: [],
      },
    ];

    const agents = Object.entries(AGENT_META).map(([pm2Name, meta]) => {
      const proc = findOne(pm2Name);
      const status = proc?.pm2_env?.status ?? 'unknown';

      let lastEvent: string | null = null;
      if (pm2Name === 'okr-monitor') lastEvent = agentState?.monitor?.updatedAt ?? null;
      if (pm2Name === 'okr-test-agent') lastEvent = agentState?.tests?.lastRun ?? null;

      return {
        id: pm2Name,
        name: meta.name,
        description: meta.description,
        role: meta.role,
        status: status === 'online' ? 'online' : status === 'stopped' ? 'stopped' : status === 'errored' ? 'errored' : 'unknown',
        memory: proc?.monit?.memory ?? null,
        cpu: proc?.monit?.cpu ?? null,
        uptime: proc?.pm2_env?.pm_uptime ?? null,
        restarts: proc?.pm2_env?.restart_time ?? 0,
        lastEvent,
      };
    });

    return {
      generatedAt: new Date().toISOString(),
      services,
      agents,
      tests: {
        lastRun:      agentState?.tests?.lastRun      ?? null,
        passed:       agentState?.tests?.passed       ?? null,
        numTests:     agentState?.tests?.numTests     ?? 0,
        numPassed:    agentState?.tests?.numPassed    ?? 0,
        numFailed:    agentState?.tests?.numFailed    ?? 0,
        duration:     agentState?.tests?.duration     ?? 0,
        failedSuites: agentState?.tests?.failedSuites ?? [],
        failedTests:  agentState?.tests?.failedTests  ?? [],
        categories:   agentState?.tests?.categories   ?? null,
        load:         agentState?.tests?.load         ?? null,
        running:      agentState?.tests?.running      ?? false,
      },
      telegram: {
        configured: !!(this.config.get('TELEGRAM_BOT_TOKEN') && this.config.get('TELEGRAM_CHAT_ID')),
      },
      monitor: agentState?.monitor ?? null,
    };
  }

  private async getPm2Processes(): Promise<Pm2Process[]> {
    if (this.pm2Cache && Date.now() - this.pm2Cache.ts < 10_000) {
      return this.pm2Cache.data;
    }
    try {
      const raw = execSync('pm2 jlist', { stdio: 'pipe', timeout: 5000 }).toString();
      const data = JSON.parse(raw) as Pm2Process[];
      this.pm2Cache = { data, ts: Date.now() };
      return data;
    } catch {
      return [];
    }
  }

  private readAgentState(): Record<string, any> | null {
    try {
      return JSON.parse(fs.readFileSync(this.STATE_FILE, 'utf8'));
    } catch {
      return null;
    }
  }

  private checkHttp(host: string, port: number, path: string): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get({ host, port, path, timeout: 3000 }, (res) => {
        resolve(res.statusCode !== undefined && res.statusCode < 500);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
    });
  }

  async runTests(): Promise<{ queued: boolean }> {
    // Mark running in state file immediately so UI responds fast
    try {
      let state: Record<string, any> = {};
      try { state = JSON.parse(fs.readFileSync(this.STATE_FILE, 'utf8')); } catch { /* new */ }
      if (!state.tests) state.tests = {};
      state.tests.running = true;
      fs.writeFileSync(this.STATE_FILE, JSON.stringify(state, null, 2));
    } catch { /* non-fatal */ }

    // Prefer triggering via super-agent IPC so it can also send Telegram notification
    const superPort = parseInt(this.config.get<string>('SUPER_AGENT_PORT') ?? '3099', 10);
    const triggered = await new Promise<boolean>((resolve) => {
      const body = JSON.stringify({ source: 'web', type: 'RUN_TESTS', ts: new Date().toISOString() });
      const req = http.request(
        { hostname: '127.0.0.1', port: superPort, path: '/event', method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
          timeout: 2000 },
        (res) => { res.resume(); resolve(true); },
      );
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.write(body);
      req.end();
    });

    // Fallback: spawn test-agent.js directly
    if (!triggered) {
      const scriptPath = path.join(process.cwd(), '..', 'scripts', 'test-agent.js');
      const proc = spawn('node', [scriptPath], { detached: true, stdio: 'ignore', env: { ...process.env } });
      proc.unref();
    }

    return { queued: true };
  }

  async getSetupStatus(orgId: string, userId: string) {
    const [problems, cycles, intents, objectives, keyResults, teamMembers, checkIns] = await Promise.all([
      this.db.queryOne('SELECT 1 AS x FROM organizational_problems WHERE organization_id=$1 AND deleted_at IS NULL LIMIT 1', [orgId]),
      this.db.queryOne('SELECT 1 AS x FROM cycles WHERE organization_id=$1 AND deleted_at IS NULL LIMIT 1', [orgId]),
      this.db.queryOne('SELECT 1 AS x FROM strategic_intents WHERE organization_id=$1 AND deleted_at IS NULL LIMIT 1', [orgId]),
      this.db.queryOne('SELECT 1 AS x FROM objectives WHERE organization_id=$1 AND deleted_at IS NULL LIMIT 1', [orgId]),
      this.db.queryOne('SELECT 1 AS x FROM key_results kr JOIN objectives o ON o.id=kr.objective_id WHERE o.organization_id=$1 AND kr.deleted_at IS NULL LIMIT 1', [orgId]),
      this.db.queryOne('SELECT 1 AS x FROM users WHERE organization_id=$1 AND id != $2 AND deleted_at IS NULL LIMIT 1', [orgId, userId]),
      this.db.queryOne('SELECT 1 AS x FROM check_ins ci JOIN key_results kr ON kr.id=ci.kr_id JOIN objectives o ON o.id=kr.objective_id WHERE o.organization_id=$1 LIMIT 1', [orgId]),
    ]);

    const steps = [
      { id: 'invite',      label: 'Invitar miembros al equipo',           description: 'Suma a tu equipo para que cada área defina y haga seguimiento de sus propios OKRs desde el inicio.',                        done: !!teamMembers, url: '/settings',  icon: 'users' },
      { id: 'diagnostic',  label: 'Registrar diagnóstico organizacional', description: 'Documenta los problemas y oportunidades reales de tu organización — son la materia prima de toda estrategia.',             done: !!problems,    url: '/problems', icon: 'alert-triangle' },
      { id: 'cycle',       label: 'Crear los ciclos OKR',                 description: 'Define el horizonte de tiempo: estratégico (3 años), anual y trimestrales. Sin ciclos no hay contexto para los objetivos.', done: !!cycles,      url: '/cycles',   icon: 'calendar' },
      { id: 'strategy',    label: 'Definir intenciones estratégicas',     description: 'Traduce el diagnóstico en apuestas de largo plazo. Son la brújula que orienta todos los OKRs que vendrán.',              done: !!intents,     url: '/strategy', icon: 'compass' },
      { id: 'objective',   label: 'Crear tu primer objetivo estratégico', description: 'Define qué quiere lograr la organización en el largo plazo. Estos objetivos guían todo lo que viene después.',              done: !!objectives,  url: '/strategic',icon: 'target' },
      { id: 'key_result',  label: 'Agregar un Key Result',                description: 'Sin KRs no hay OKRs. Cada objetivo necesita al menos una métrica medible que indique si lo estás logrando.',               done: !!keyResults,  url: '/strategic',icon: 'bar-chart-2' },
      { id: 'check_in',    label: 'Realizar tu primer check-in',          description: 'Registra el avance real de tus KRs. El check-in semanal es el hábito que mantiene vivos los OKRs.',                         done: !!checkIns,    url: '/checkins', icon: 'check-circle' },
    ];

    const completed = steps.filter(s => s.done).length;
    return { steps, completed, total: steps.length, percentage: Math.round((completed / steps.length) * 100) };
  }
}
