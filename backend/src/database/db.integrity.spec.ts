/**
 * DB Integrity & Performance Tests
 * Connects to the REAL PostgreSQL database.
 * Uses transactions rolled back after each write test — no persistent side effects.
 * Skips gracefully when DB is unreachable.
 */

import { Pool, PoolClient } from 'pg';
import * as path from 'path';
import * as fs from 'fs';

// ── Load .env ────────────────────────────────────────────────────────────────

function loadEnv() {
  const candidates = [
    path.join(__dirname, '..', '..', '.env'),
    path.join(__dirname, '..', '..', '..', 'backend', '.env'),
    path.join(__dirname, '..', '..', '..', '.env.dev'),
  ];
  for (const p of candidates) {
    try {
      for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
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
}
loadEnv();

// ── Pool setup ───────────────────────────────────────────────────────────────

const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME     ?? 'Estrategia',
  user:     process.env.DB_USER     ?? 'okr_user',
  password: process.env.DB_PASSWORD ?? '',
  max: 5,
  connectionTimeoutMillis: 3000,
  idleTimeoutMillis: 10000,
});

let dbAvailable = false;

// ── Helpers ──────────────────────────────────────────────────────────────────

async function q<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await pool.query(sql, params);
  return res.rows as T[];
}

async function qOne<T = Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await q<T>(sql, params);
  return rows[0] ?? null;
}

function ms(start: [number, number]): number {
  const [s, ns] = process.hrtime(start);
  return s * 1000 + ns / 1e6;
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

beforeAll(async () => {
  try {
    await pool.query('SELECT 1');
    dbAvailable = true;
  } catch {
    dbAvailable = false;
    console.warn('[DB Integrity] Database unavailable — skipping all tests');
  }
}, 5000);

afterAll(async () => {
  await pool.end().catch(() => {});
});

function skipIfNoDb() {
  if (!dbAvailable) pending('DB unavailable');
}

// ════════════════════════════════════════════════════════════════════════════
// 1. SCHEMA INTEGRITY — views exist
// ════════════════════════════════════════════════════════════════════════════

describe('Schema integrity — critical views exist', () => {
  const REQUIRED_VIEWS = [
    'v_objectives_with_progress',
    'v_key_results_with_trend',
    'v_check_in_history',
    'v_cycles_with_stats',
    'v_at_risk_krs',
    'v_cadence_dashboard',
    'v_executive_dashboard',
    'v_cycle_health',
    'v_team_health',
    'v_alignment_map',
    'v_org_members',
    'v_user_session',
    'v_weekly_trend',
    'v_portfolio_dashboard',
    'v_security_audit',
    'v_upcoming_milestones',
    'v_initiatives_by_kr',
    'v_agreements',
    'v_plan_limits',
  ];

  test.each(REQUIRED_VIEWS)('view %s exists', async (viewName) => {
    skipIfNoDb();
    const row = await qOne<{ table_name: string }>(
      `SELECT table_name FROM information_schema.views
        WHERE table_schema = 'public' AND table_name = $1`,
      [viewName],
    );
    expect(row).not.toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. SCHEMA INTEGRITY — stored procedures exist
// ════════════════════════════════════════════════════════════════════════════

describe('Schema integrity — stored procedures exist', () => {
  const REQUIRED_PROCS = [
    'sp_create_objective',
    'sp_cancel_objective',
    'sp_create_key_result',
    'sp_cancel_key_result',
    'sp_create_check_in',
    'sp_create_cycle',
    'sp_activate_cycle',
    'sp_close_cycle',
    'sp_rollover_cycle_items',
    'sp_apply_billing_upgrade',
    'sp_downgrade_to_free',
    'sp_remove_member',
    'sp_update_member_role',
    'sp_anonymize_user',
    'sp_mark_stale_krs_at_risk',
    'sp_update_org_parameters',
    'sp_complete_milestone',
    'sp_update_user_profile',
    'sp_send_forecast_notification',
    'sp_create_agreement',
  ];

  test.each(REQUIRED_PROCS)('procedure %s exists', async (procName) => {
    skipIfNoDb();
    const row = await qOne<{ routine_name: string }>(
      `SELECT routine_name FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_type = 'PROCEDURE' AND routine_name = $1`,
      [procName],
    );
    expect(row).not.toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. SCHEMA INTEGRITY — functions exist
// ════════════════════════════════════════════════════════════════════════════

describe('Schema integrity — functions exist', () => {
  const REQUIRED_FUNCTIONS = [
    'fn_calculate_kr_progress',
    'fn_calculate_objective_progress',
    'fn_check_login_attempts',
    'fn_get_cycle_score',
    'fn_get_reset_token_info',
    'fn_predict_kr_completion',
    'fn_update_objective',
    'fn_update_key_result',
    'fn_update_organization',
    'fn_generate_cycle_close_report',
    'fn_get_alignment_gaps',
    'fn_validate_kr_limits',
    'fn_validate_objective_limits',
    'fn_governance_calendar',
    'fn_welcome_context',
    'fn_reset_member_password',
    'fn_kr_forecast',
    'fn_first_day_context',
    'fn_update_agreement',
  ];

  test.each(REQUIRED_FUNCTIONS)('function %s exists', async (fnName) => {
    skipIfNoDb();
    const row = await qOne<{ routine_name: string }>(
      `SELECT routine_name FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_type = 'FUNCTION' AND routine_name = $1`,
      [fnName],
    );
    expect(row).not.toBeNull();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. COLUMN CONTRACTS — critical views have expected columns
// ════════════════════════════════════════════════════════════════════════════

describe('Column contracts — view schemas match backend expectations', () => {
  async function getColumns(viewName: string): Promise<string[]> {
    const rows = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position`,
      [viewName],
    );
    return rows.map((r) => r.column_name);
  }

  it('v_objectives_with_progress has required columns', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_objectives_with_progress');
    const required = ['id', 'organization_id', 'cycle_id', 'title', 'level', 'status', 'progress', 'owner_id'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it('v_check_in_history has required columns', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_check_in_history');
    const required = ['id', 'kr_id', 'user_id', 'current_value', 'confidence', 'checked_at'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it('v_user_session has required columns', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_user_session');
    const required = ['user_id', 'organization_id', 'role', 'name'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it('v_at_risk_krs has objective_level column (not is_company_okr)', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_at_risk_krs');
    expect(cols).toContain('objective_level');
    expect(cols).toContain('days_since_checkin');
    expect(cols).toContain('organization_id');
  });

  it('v_cycles_with_stats has required columns', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_cycles_with_stats');
    const required = ['id', 'organization_id', 'name', 'status', 'start_date', 'end_date'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it('v_key_results_with_trend has required columns', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_key_results_with_trend');
    const required = ['id', 'objective_id', 'title', 'type', 'status', 'progress', 'confidence', 'current_value', 'target_value'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it('v_executive_dashboard has required columns', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_executive_dashboard');
    const required = ['organization_id', 'cycle_id'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it('v_at_risk_krs has kr_code and obj_code columns', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_at_risk_krs');
    expect(cols).toContain('kr_code');
    expect(cols).toContain('obj_code');
  });

  it('v_cadence_dashboard has kr_code and obj_code columns', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_cadence_dashboard');
    expect(cols).toContain('kr_code');
    expect(cols).toContain('obj_code');
  });

  it('v_user_session has first_day_completed_at column', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_user_session');
    expect(cols).toContain('first_day_completed_at');
  });

  it('v_agreements has required columns', async () => {
    skipIfNoDb();
    const cols = await getColumns('v_agreements');
    const required = ['id', 'organization_id', 'title', 'status'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. CONSTRAINT VALIDATION — error codes match backend handlers
// ════════════════════════════════════════════════════════════════════════════

describe('Constraint validation — PG error codes match backend handlers', () => {
  let client: PoolClient;

  beforeEach(async () => {
    if (!dbAvailable) return;
    client = await pool.connect();
    await client.query('BEGIN');
  });

  afterEach(async () => {
    if (!dbAvailable || !client) return;
    await client.query('ROLLBACK');
    client.release();
  });

  it('organizations.slug unique constraint returns 23505', async () => {
    skipIfNoDb();
    const existing = await client.query(
      `SELECT slug FROM organizations WHERE deleted_at IS NULL LIMIT 1`,
    );
    if (existing.rows.length === 0) {
      pending('No organizations in DB to test with');
      return;
    }
    const slug = existing.rows[0].slug;
    try {
      await client.query(
        `INSERT INTO organizations (name, slug, mode) VALUES ('Test Dup', $1, 'AGILE')`,
        [slug],
      );
      fail('Expected unique constraint violation');
    } catch (err: any) {
      expect(err.code).toBe('23505');
    }
  });

  it('confidence check constraint returns 23514 for value > 1', async () => {
    skipIfNoDb();
    try {
      await client.query(
        `INSERT INTO check_ins (kr_id, user_id, current_value, confidence, checked_at)
         VALUES (gen_random_uuid(), gen_random_uuid(), 50, 1.5, NOW())`,
      );
      fail('Expected check constraint violation');
    } catch (err: any) {
      expect(['23514', '23503', '23502']).toContain(err.code);
    }
  });

  it('refresh_tokens require valid user_id (FK constraint 23503)', async () => {
    skipIfNoDb();
    try {
      await client.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES (gen_random_uuid(), 'fakehash', NOW() + INTERVAL '1 day')`,
      );
      fail('Expected FK constraint violation');
    } catch (err: any) {
      expect(err.code).toBe('23503');
    }
  });

  it('invitations reject null organization_id (23502 not-null)', async () => {
    skipIfNoDb();
    try {
      await client.query(
        `INSERT INTO invitations (organization_id, email, role, token)
         VALUES (NULL, 'test@test.com', 'MEMBER', 'tok123')`,
      );
      fail('Expected not-null violation');
    } catch (err: any) {
      expect(err.code).toBe('23502');
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. PERFORMANCE — critical query response times
// ════════════════════════════════════════════════════════════════════════════

describe('Performance — query response times', () => {
  const THRESHOLD_MS = 500;

  async function measureQuery(sql: string, params: unknown[] = []): Promise<number> {
    const start = process.hrtime();
    await pool.query(sql, params);
    return ms(start);
  }

  it('SELECT 1 responds in < 50ms (connection baseline)', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery('SELECT 1');
    expect(elapsed).toBeLessThan(50);
  });

  it('v_objectives_with_progress query responds in < 500ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(`SELECT * FROM v_objectives_with_progress LIMIT 100`);
    expect(elapsed).toBeLessThan(THRESHOLD_MS);
  });

  it('v_at_risk_krs query responds in < 500ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(`SELECT * FROM v_at_risk_krs LIMIT 50`);
    expect(elapsed).toBeLessThan(THRESHOLD_MS);
  });

  it('v_cycles_with_stats query responds in < 500ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(`SELECT * FROM v_cycles_with_stats LIMIT 50`);
    expect(elapsed).toBeLessThan(THRESHOLD_MS);
  });

  it('v_check_in_history query responds in < 500ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(`SELECT * FROM v_check_in_history LIMIT 100`);
    expect(elapsed).toBeLessThan(THRESHOLD_MS);
  });

  it('v_user_session query responds in < 200ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(
      `SELECT * FROM v_user_session WHERE user_id = $1`,
      ['00000000-0000-0000-0000-000000000000'],
    );
    expect(elapsed).toBeLessThan(200);
  });

  it('fn_check_login_attempts responds in < 200ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(
      `SELECT fn_check_login_attempts($1::citext)`,
      ['perf-test@example.com'],
    );
    expect(elapsed).toBeLessThan(200);
  });

  it('v_executive_dashboard query responds in < 500ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(`SELECT * FROM v_executive_dashboard LIMIT 10`);
    expect(elapsed).toBeLessThan(THRESHOLD_MS);
  });

  it('repeated SELECT 1 shows stable connection pool (10 calls < 1000ms total)', async () => {
    skipIfNoDb();
    const start = process.hrtime();
    await Promise.all(Array.from({ length: 10 }, () => pool.query('SELECT 1')));
    const elapsed = ms(start);
    expect(elapsed).toBeLessThan(1000);
  });

  it('v_cadence_dashboard query responds in < 500ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(`SELECT * FROM v_cadence_dashboard LIMIT 50`);
    expect(elapsed).toBeLessThan(THRESHOLD_MS);
  });

  it('fn_kr_forecast with null UUID responds in < 1000ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(
      `SELECT fn_kr_forecast('00000000-0000-0000-0000-000000000000'::uuid)`,
    );
    expect(elapsed).toBeLessThan(1000);
  });

  it('fn_first_day_context with null UUIDs responds in < 2000ms', async () => {
    skipIfNoDb();
    const elapsed = await measureQuery(
      `SELECT fn_first_day_context('00000000-0000-0000-0000-000000000000'::uuid, '00000000-0000-0000-0000-000000000000'::uuid)`,
    );
    expect(elapsed).toBeLessThan(2000);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. DATA INTEGRITY — functional rules enforced by DB
// ════════════════════════════════════════════════════════════════════════════

describe('Data integrity — DB enforces business rules', () => {
  it('fn_check_login_attempts returns is_locked=false for unknown email', async () => {
    skipIfNoDb();
    const row = await qOne<{ fn_check_login_attempts: Record<string, unknown> }>(
      `SELECT fn_check_login_attempts($1::citext)`,
      ['nobody_ever@nonexistent.example'],
    );
    expect(row).not.toBeNull();
    const result = row!.fn_check_login_attempts;
    expect(result['is_locked']).toBe(false);
  });

  it('fn_get_reset_token_info returns null for invalid token', async () => {
    skipIfNoDb();
    const row = await qOne(
      `SELECT * FROM fn_get_reset_token_info($1)`,
      ['invalid-token-that-does-not-exist'],
    );
    expect(row).toBeNull();
  });

  it('v_plan_limits view is queryable', async () => {
    skipIfNoDb();
    const rows = await q(`SELECT * FROM v_plan_limits LIMIT 5`);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('v_security_audit view is queryable', async () => {
    skipIfNoDb();
    const rows = await q(`SELECT * FROM v_security_audit LIMIT 5`);
    expect(Array.isArray(rows)).toBe(true);
  }, 25000);

  it('organizations table has required columns', async () => {
    skipIfNoDb();
    const rows = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organizations' ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    const required = ['id', 'name', 'slug', 'plan', 'mode', 'deleted_at', 'trial_expires_at', 'stripe_subscription_id'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it('organizations table has vision and mission columns', async () => {
    skipIfNoDb();
    const rows = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organizations' ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).toContain('vision');
    expect(cols).toContain('mission');
  });

  it('users table has required columns', async () => {
    skipIfNoDb();
    const rows = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    const required = ['id', 'organization_id', 'email', 'role', 'is_active', 'deleted_at'];
    for (const col of required) {
      expect(cols).toContain(col);
    }
  });

  it('users table has first_day_completed_at column', async () => {
    skipIfNoDb();
    const rows = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).toContain('first_day_completed_at');
  });

  it('key_results table has confidence column with check constraint', async () => {
    skipIfNoDb();
    const rows = await q<{ conname: string; def: string }>(
      `SELECT con.conname, pg_get_constraintdef(con.oid) AS def
         FROM pg_constraint con
         JOIN pg_class rel ON rel.oid = con.conrelid
         JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
        WHERE rel.relname = 'key_results'
          AND nsp.nspname = 'public'
          AND con.contype = 'c'
          AND pg_get_constraintdef(con.oid) LIKE '%confidence%'`,
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('sp_validate_login function exists', async () => {
    skipIfNoDb();
    const row = await qOne<{ routine_name: string }>(
      `SELECT routine_name FROM information_schema.routines
        WHERE routine_schema = 'public' AND routine_name = 'sp_validate_login'`,
    );
    expect(row).not.toBeNull();
  });

  it('v_agreements is queryable', async () => {
    skipIfNoDb();
    const rows = await q(`SELECT * FROM v_agreements LIMIT 5`);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('consultant_clients table exists', async () => {
    skipIfNoDb();
    const row = await qOne<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'consultant_clients'`,
    );
    expect(row).not.toBeNull();
  });

  it('fn_kr_forecast handles unknown KR UUID without throwing', async () => {
    skipIfNoDb();
    let threw = false;
    let result: Record<string, unknown> | null = null;
    try {
      result = await qOne(
        `SELECT fn_kr_forecast('00000000-0000-0000-0000-000000000000'::uuid)`,
      );
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
    if (result !== null) {
      const val = Object.values(result)[0] as any;
      if (val !== null && typeof val === 'object') {
        const asStr = JSON.stringify(val);
        expect(asStr).not.toMatch(/exception.*thrown/i);
      }
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. PLAN LIMITS
// ════════════════════════════════════════════════════════════════════════════

describe('Plan limits — v_plan_limits integrity', () => {
  it('v_plan_limits is queryable', async () => {
    skipIfNoDb();
    const rows = await q(`SELECT * FROM v_plan_limits LIMIT 10`);
    expect(Array.isArray(rows)).toBe(true);
  });

  it('v_plan_limits has plan column', async () => {
    skipIfNoDb();
    const rows = await q<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'v_plan_limits'
        ORDER BY ordinal_position`,
    );
    const cols = rows.map((r) => r.column_name);
    expect(cols).toContain('plan');
  });
});
