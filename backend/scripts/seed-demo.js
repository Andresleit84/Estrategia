/**
 * Seed demo — Caja Cooprogreso
 * Genera 3 años de historia OKR completa para propósitos de demo.
 * Ejecutar: node scripts/seed-demo.js
 */
'use strict';

const { Pool } = require('pg');
const bcrypt   = require('bcrypt');
const crypto   = require('crypto');

const pool = new Pool({
  host: '127.0.0.1', port: 5432,
  user: 'postgres', password: 'Andres',
  database: 'Estrategia_dev',
});

const ORG_ID  = process.env.DEMO_ORG_ID   || 'cc25bd52-3b85-40ac-b226-cd98bc1a69e1';
const OWNER   = process.env.DEMO_OWNER_ID || 'afa7c805-bfa5-46c7-b48a-656e3557ad0e';

const id = () => crypto.randomUUID();

// ── Progress helpers ──────────────────────────────────────────────────────────

// maxRatio: 1.0 = reach target, 0.35 = reach 35% of the way toward target
function buildCheckIns(krId, userId, startValue, targetValue, krType, startDate, endDate, count, maxRatio = 1.0) {
  const items = [];
  const range = endDate.getTime() - startDate.getTime();
  const step  = range / count;
  const effectiveTarget = krType === 'INCREASE'
    ? startValue + (targetValue - startValue) * maxRatio
    : krType === 'DECREASE'
      ? startValue - (startValue - targetValue) * maxRatio
      : targetValue;

  for (let i = 0; i < count; i++) {
    const ratio  = (i + 1) / count;
    const checked_at = new Date(startDate.getTime() + (i + 1) * step);

    let current_value;
    if (krType === 'INCREASE') {
      current_value = startValue + (effectiveTarget - startValue) * ratio;
      if (i === count - 1 && maxRatio >= 1.0) current_value = targetValue * 1.02;
    } else if (krType === 'DECREASE') {
      current_value = startValue - (startValue - effectiveTarget) * ratio;
      if (i === count - 1 && maxRatio >= 1.0) current_value = targetValue * 0.97;
    } else if (krType === 'MAINTAIN') {
      const drift = (targetValue > 0 ? targetValue : 1) * 0.02 * (i % 2 === 0 ? 1 : -1);
      current_value = targetValue + drift;
    } else { // ACHIEVE
      current_value = (i === count - 1 && maxRatio >= 1.0) ? targetValue : 0;
    }
    current_value = Math.round(current_value * 10) / 10;

    const confidence = i < 2 ? 0.7 : Math.min(1.0, 0.7 + ratio * 0.3);
    const moods = ['GOOD', 'GOOD', 'GREAT', 'GOOD', 'NEUTRAL', 'GREAT'];
    const mood  = moods[i % moods.length];

    items.push({ kr_id: krId, user_id: userId, checked_at, current_value, confidence, mood });
  }
  return items;
}

function buildCheckInsAtRisk(krId, userId, startValue, targetValue, krType, startDate, endDate, count, maxRatio = 0.20) {
  const items = [];
  const range = endDate.getTime() - startDate.getTime();
  const step  = range / count;

  for (let i = 0; i < count; i++) {
    const ratio  = (i + 1) / count;
    const checked_at = new Date(startDate.getTime() + (i + 1) * step);
    let current_value;
    if (krType === 'INCREASE') {
      current_value = startValue + (targetValue - startValue) * ratio * maxRatio;
    } else if (krType === 'DECREASE') {
      current_value = startValue - (startValue - targetValue) * ratio * maxRatio;
    } else if (krType === 'ACHIEVE') {
      current_value = 0; // not yet achieved
    } else {
      current_value = targetValue;
    }
    current_value = Math.round(current_value * 10) / 10;
    const confidence = Math.max(0.3, 0.5 - ratio * 0.1);
    const moods = ['NEUTRAL', 'CONCERNED', 'CONCERNED', 'NEUTRAL'];
    items.push({ kr_id: krId, user_id: userId, checked_at, current_value, confidence, mood: moods[i % moods.length] });
  }
  return items;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    console.log('🌱 Iniciando seed Caja Cooprogreso...\n');

    // ── 0. Limpiar datos previos (idempotente) ──────────────────────────────
    // Orden: tablas hija primero, luego padre
    // ai_briefings tiene trigger inmutable — deshabilitar para limpieza y reactivar
    await client.query(`ALTER TABLE ai_briefings DISABLE TRIGGER trg_ai_briefings_immutable`);
    await client.query(`DELETE FROM ai_briefings WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`ALTER TABLE ai_briefings ENABLE TRIGGER trg_ai_briefings_immutable`);
    // Módulos delivery
    await client.query(`DELETE FROM deliverable_dependencies WHERE deliverable_id IN (SELECT id FROM deliverables WHERE organization_id=$1)`, [ORG_ID]);
    await client.query(`DELETE FROM deliverables WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM delivery_phases WHERE program_id IN (SELECT id FROM delivery_programs WHERE organization_id=$1)`, [ORG_ID]);
    await client.query(`DELETE FROM delivery_programs WHERE organization_id = $1`, [ORG_ID]);
    // Módulo transformation programs
    await client.query(`DELETE FROM program_cycles WHERE program_id IN (SELECT id FROM transformation_programs WHERE organization_id=$1)`, [ORG_ID]);
    await client.query(`DELETE FROM transformation_programs WHERE organization_id = $1`, [ORG_ID]);
    // Módulo sector assessment
    await client.query(`DELETE FROM threat_scores WHERE assessment_id IN (SELECT sa.id FROM sector_assessments sa JOIN sector_assessment_sessions ss ON sa.session_id=ss.id WHERE ss.organization_id=$1)`, [ORG_ID]);
    await client.query(`DELETE FROM sector_assessments WHERE session_id IN (SELECT id FROM sector_assessment_sessions WHERE organization_id=$1)`, [ORG_ID]);
    await client.query(`DELETE FROM sector_session_participants WHERE session_id IN (SELECT id FROM sector_assessment_sessions WHERE organization_id=$1)`, [ORG_ID]);
    await client.query(`DELETE FROM sector_consolidation_plans WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM sector_assessment_sessions WHERE organization_id = $1`, [ORG_ID]);
    // Gobernanza
    await client.query(`DELETE FROM governance_members WHERE body_id IN (SELECT id FROM governance_bodies WHERE org_id=$1)`, [ORG_ID]);
    await client.query(`DELETE FROM governance_activities WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM governance_bodies WHERE org_id = $1`, [ORG_ID]);
    // Acuerdos
    await client.query(`DELETE FROM agreement_backlog_items WHERE agreement_id IN (SELECT id FROM agreements WHERE organization_id=$1)`, [ORG_ID]);
    await client.query(`DELETE FROM agreements WHERE organization_id = $1`, [ORG_ID]);
    // AI
    await client.query(`DELETE FROM ai_conversations WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM ai_diagnostic_reports WHERE organization_id = $1`, [ORG_ID]);
    // Reportes y billing
    await client.query(`DELETE FROM cycle_close_reports WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM billing_events WHERE organization_id = $1`, [ORG_ID]);
    // Support
    await client.query(`DELETE FROM support_messages WHERE ticket_id IN (SELECT id FROM support_tickets WHERE organization_id=$1)`, [ORG_ID]);
    await client.query(`DELETE FROM support_tickets WHERE organization_id = $1`, [ORG_ID]);
    // OKRs y sprints
    await client.query(`DELETE FROM check_ins WHERE kr_id IN (SELECT kr.id FROM key_results kr JOIN objectives o ON kr.objective_id = o.id WHERE o.organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM notifications WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM sprint_goal_krs WHERE sprint_id IN (SELECT id FROM sprint_cycles WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM backlog_items WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM sprint_cycles WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM milestones WHERE initiative_id IN (SELECT id FROM initiatives WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM initiative_key_results WHERE initiative_id IN (SELECT id FROM initiatives WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM initiative_areas WHERE initiative_id IN (SELECT id FROM initiatives WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM key_results WHERE objective_id IN (SELECT id FROM objectives WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM objective_alignments WHERE source_id IN (SELECT id FROM objectives WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM objectives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM initiatives WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM strategic_intents WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM organizational_problems WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM cycles WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE organization_id = $1)`, [ORG_ID]);
    await client.query(`DELETE FROM teams WHERE organization_id = $1`, [ORG_ID]);
    await client.query(`DELETE FROM areas WHERE org_id = $1`, [ORG_ID]);
    // Eliminar usuarios de demo en 2 pasos (soft-delete trigger: deleted_at IS NOT NULL → permite DELETE físico)
    await client.query(`DELETE FROM mcp_audit_log WHERE user_id IN (SELECT id FROM users WHERE organization_id=$1 AND id!=$2)`, [ORG_ID, OWNER]);
    await client.query(`DELETE FROM user_profiles WHERE user_id IN (SELECT id FROM users WHERE organization_id=$1 AND id!=$2)`, [ORG_ID, OWNER]);
    await client.query(`UPDATE users SET deleted_at=NOW() WHERE organization_id=$1 AND id!=$2 AND deleted_at IS NULL`, [ORG_ID, OWNER]);
    await client.query(`DELETE FROM users WHERE organization_id=$1 AND id!=$2`, [ORG_ID, OWNER]);
    console.log('✓ Datos previos limpiados');

    // ── 1. Actualizar organización ──────────────────────────────────────────
    await client.query(`
      UPDATE organizations
      SET mode   = 'HYBRID',
          sector = 'COOPERATIVE_FINANCIAL',
          plan   = 'ENTERPRISE',
          parameters = '{
            "unstarted_kr_days": 7,
            "confidence_at_risk": 0.40,
            "stale_checkin_days": 14,
            "story_points_scale": [1, 2, 3, 5, 8, 13, 21],
            "confidence_on_track": 0.70,
            "max_sprints_per_year": 52,
            "max_krs_per_objective": 5,
            "auto_complete_threshold": 70,
            "max_objectives_per_level": 10,
            "progress_behind_threshold": 30
          }'::jsonb
      WHERE id = $1
    `, [ORG_ID]);
    console.log('✓ Organización actualizada (HYBRID / COOPERATIVE_FINANCIAL / ENTERPRISE)');

    // ── 2. Usuarios — UUIDs fijos para estabilidad en cada ejecución ────────
    // Usar pgcrypto para generar el hash (compatible con sp_validate_login que usa crypt())
    const { rows: [{ hash: PASS }] } = await client.query(
      `SELECT crypt('Demo@2025!', gen_salt('bf', 10)) AS hash`,
    );

    const USER_ERIC      = '11111111-1111-4001-a001-000000000000';
    const USER_CARLOS    = '11111111-1111-4001-a001-000000000001';
    const USER_MARIA     = '11111111-1111-4001-a001-000000000002';
    const USER_ROBERTO   = '11111111-1111-4001-a001-000000000003';
    const USER_VALENTINA = '11111111-1111-4001-a001-000000000004';
    const USER_DIEGO     = '11111111-1111-4001-a001-000000000005';
    const USER_SOFIA     = '11111111-1111-4001-a001-000000000006';

    const newUsers = [
      { id: USER_ERIC,      email: 'eric@sendoagil.com',                  name: 'Eric',               role: 'OWNER'   },
      { id: USER_CARLOS,    email: 'carlos.gomez@cooprogreso.com',        name: 'Carlos Gómez',       role: 'ADMIN'   },
      { id: USER_MARIA,     email: 'maria.torres@cooprogreso.com',        name: 'María Torres',       role: 'MANAGER' },
      { id: USER_ROBERTO,   email: 'roberto.silva@cooprogreso.com',       name: 'Roberto Silva',      role: 'MANAGER' },
      { id: USER_VALENTINA, email: 'valentina.jimenez@cooprogreso.com',   name: 'Valentina Jiménez',  role: 'MEMBER'  },
      { id: USER_DIEGO,     email: 'diego.morales@cooprogreso.com',       name: 'Diego Morales',      role: 'MEMBER'  },
      { id: USER_SOFIA,     email: 'sofia.rodriguez@cooprogreso.com',     name: 'Sofía Rodríguez',    role: 'MEMBER'  },
    ];

    for (const u of newUsers) {
      await client.query(`
        INSERT INTO users (id, organization_id, email, password_hash, name, role, is_active, email_verified, deleted_at)
        VALUES ($1,$2,$3,$4,$5,$6,true,true,NULL)
        ON CONFLICT (id) DO UPDATE SET
          organization_id = $2, email = $3, password_hash = $4,
          name = $5, role = $6, is_active = true, email_verified = true, deleted_at = NULL
      `, [u.id, ORG_ID, u.email, PASS, u.name, u.role]);
    }
    console.log(`✓ ${newUsers.length} usuarios OKR creados`);

    // ── Usuarios SECTOR_DIAGNOSTICS — evaluadores externos del diagnóstico sectorial ──
    const diagnosticUsers = [
      { id: '11111111-1111-4001-a002-000000000001', email: 'usuario1@sendoagil.com', name: 'Ana Vargas'        },
      { id: '11111111-1111-4001-a002-000000000002', email: 'usuario2@sendoagil.com', name: 'Fernando López'    },
      { id: '11111111-1111-4001-a002-000000000003', email: 'usuario3@sendoagil.com', name: 'Patricia Reyes'    },
      { id: '11111111-1111-4001-a002-000000000004', email: 'usuario4@sendoagil.com', name: 'Mauricio Castro'   },
      { id: '11111111-1111-4001-a002-000000000005', email: 'usuario5@sendoagil.com', name: 'Elena Mendoza'     },
    ];
    for (const u of diagnosticUsers) {
      await client.query(`
        INSERT INTO users (id, organization_id, email, password_hash, name, role, is_active, email_verified, deleted_at)
        VALUES ($1,$2,$3,$4,$5,'SECTOR_DIAGNOSTICS',true,true,NULL)
        ON CONFLICT (id) DO UPDATE SET
          organization_id = $2, email = $3, password_hash = $4,
          name = $5, role = 'SECTOR_DIAGNOSTICS', is_active = true, email_verified = true, deleted_at = NULL
      `, [u.id, ORG_ID, u.email, PASS, u.name]);
    }
    console.log(`✓ ${diagnosticUsers.length} usuarios SECTOR_DIAGNOSTICS creados (evaluadores diagnóstico)`);

    // Perfiles de usuario (timezone + locale para todos, incluido el owner)
    const allUserIds = [OWNER, ...newUsers.map(u => u.id), ...diagnosticUsers.map(u => u.id)];
    for (const uid of allUserIds) {
      await client.query(`
        INSERT INTO user_profiles (user_id, timezone, locale, notify_at_risk, notify_checkin_reminder, notify_weekly_briefing)
        VALUES ($1, 'America/Bogota', 'es', true, true, true)
        ON CONFLICT (user_id) DO UPDATE
          SET timezone = 'America/Bogota', locale = 'es',
              notify_at_risk = true, notify_checkin_reminder = true, notify_weekly_briefing = true
      `, [uid]);
    }
    console.log(`✓ ${allUserIds.length} perfiles de usuario configurados (America/Bogota / es)`);

    // ── 3. Áreas ─────────────────────────────────────────────────────────────
    const AREA_TI   = id();
    const AREA_FIN  = id();
    const AREA_EXP  = id();
    const AREA_OPS  = id();

    const areas = [
      { id: AREA_TI,  name: 'Tecnología e Innovación', color: '#6366f1', mgr: USER_CARLOS,    sort: 1 },
      { id: AREA_FIN, name: 'Finanzas y Riesgo',        color: '#10b981', mgr: USER_ROBERTO,   sort: 2 },
      { id: AREA_EXP, name: 'Experiencia al Socio',     color: '#f59e0b', mgr: USER_MARIA,     sort: 3 },
      { id: AREA_OPS, name: 'Operaciones',               color: '#ef4444', mgr: USER_DIEGO,     sort: 4 },
    ];
    for (const a of areas) {
      await client.query(`
        INSERT INTO areas (id, org_id, name, color, manager_id, sort_order)
        VALUES ($1,$2,$3,$4,$5,$6)
      `, [a.id, ORG_ID, a.name, a.color, a.mgr, a.sort]);
    }
    console.log('✓ 4 áreas creadas');

    // ── 4. Equipos ───────────────────────────────────────────────────────────
    const TEAM_ROOT = id();
    const TEAM_TI   = id();
    const TEAM_FIN  = id();
    const TEAM_EXP  = id();
    const TEAM_OPS  = id();

    await client.query(`INSERT INTO teams (id,organization_id,name,description,is_root,owner_id) VALUES ($1,$2,$3,$4,true,$5)`,
      [TEAM_ROOT, ORG_ID, 'Alta Dirección', 'Comité de dirección ejecutiva', OWNER]);
    await client.query(`INSERT INTO teams (id,organization_id,name,description,parent_team_id,area_id,owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [TEAM_TI, ORG_ID, 'Transformación Digital', 'Desarrollo e innovación tecnológica', TEAM_ROOT, AREA_TI, USER_CARLOS]);
    await client.query(`INSERT INTO teams (id,organization_id,name,description,parent_team_id,area_id,owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [TEAM_FIN, ORG_ID, 'Finanzas y Riesgo', 'Gestión financiera y control de riesgos', TEAM_ROOT, AREA_FIN, USER_ROBERTO]);
    await client.query(`INSERT INTO teams (id,organization_id,name,description,parent_team_id,area_id,owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [TEAM_EXP, ORG_ID, 'Experiencia al Socio', 'Atención, fidelización y NPS', TEAM_ROOT, AREA_EXP, USER_MARIA]);
    await client.query(`INSERT INTO teams (id,organization_id,name,description,parent_team_id,area_id,owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [TEAM_OPS, ORG_ID, 'Operaciones', 'Eficiencia operativa y soporte', TEAM_ROOT, AREA_OPS, USER_DIEGO]);
    console.log('✓ 5 equipos creados');

    const teamMemberships = [
      [TEAM_ROOT, OWNER,          'LEAD'],
      [TEAM_ROOT, USER_CARLOS,    'MEMBER'],
      [TEAM_ROOT, USER_MARIA,     'MEMBER'],
      [TEAM_ROOT, USER_ROBERTO,   'MEMBER'],
      [TEAM_TI,   USER_CARLOS,    'LEAD'],
      [TEAM_TI,   USER_VALENTINA, 'MEMBER'],
      [TEAM_TI,   USER_DIEGO,     'MEMBER'],
      [TEAM_FIN,  USER_ROBERTO,   'LEAD'],
      [TEAM_FIN,  USER_SOFIA,     'MEMBER'],
      [TEAM_EXP,  USER_MARIA,     'LEAD'],
      [TEAM_EXP,  USER_VALENTINA, 'MEMBER'],
      [TEAM_OPS,  USER_DIEGO,     'LEAD'],
      [TEAM_OPS,  USER_SOFIA,     'MEMBER'],
    ];
    for (const [tid, uid, role] of teamMemberships) {
      await client.query(`INSERT INTO team_members (id,team_id,user_id,role,added_by_id) VALUES ($1,$2,$3,$4,$5)`,
        [id(), tid, uid, role, OWNER]);
    }
    console.log('✓ Membresías de equipos asignadas');

    // ── 5. Intenciones estratégicas ──────────────────────────────────────────
    const SI_GROWTH = id();
    const SI_EFFIC  = id();
    const SI_CULT   = id();

    const intents = [
      { id: SI_GROWTH, title: 'Ser la cooperativa financiera más innovadora de la región', category: 'GROWTH',       horizon: 3, target: 2025, status: 'ACTIVE' },
      { id: SI_EFFIC,  title: 'Lograr excelencia operacional con procesos 100% digitales',  category: 'EFFICIENCY',   horizon: 3, target: 2025, status: 'ACTIVE' },
      { id: SI_CULT,   title: 'Construir la cultura de mejora continua más sólida del sector', category: 'CULTURE',  horizon: 3, target: 2025, status: 'ACTIVE' },
    ];
    for (const si of intents) {
      await client.query(`
        INSERT INTO strategic_intents (id,organization_id,title,category,horizon_years,target_year,status,created_by,description)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [si.id, ORG_ID, si.title, si.category, si.horizon, si.target, si.status, OWNER,
          `Intención estratégica 2023-2025 — ${si.category}`]);
    }
    console.log('✓ 3 intenciones estratégicas creadas');

    // ── 6. Problemas organizacionales ────────────────────────────────────────
    const problems = [
      { title: 'Baja penetración digital entre socios mayores de 50 años',        cat: 'TECHNOLOGY', sev: 4, freq: 4, status: 'BEING_ADDRESSED' },
      { title: 'Procesos de crédito lentos y dependientes de papel físico',        cat: 'PROCESS',    sev: 5, freq: 5, status: 'RESOLVED' },
      { title: 'Alta rotación en equipos de atención al socio',                    cat: 'PEOPLE',     sev: 3, freq: 3, status: 'BEING_ADDRESSED' },
      { title: 'Dependencia excesiva de canales presenciales de atención',         cat: 'OPERATIONAL',sev: 4, freq: 3, status: 'BEING_ADDRESSED' },
      { title: 'Brechas de competencias digitales en el equipo operativo',         cat: 'PEOPLE',     sev: 3, freq: 4, status: 'BEING_ADDRESSED' },
      { title: 'Sistemas legacy con deuda técnica acumulada en core bancario',     cat: 'TECHNOLOGY', sev: 5, freq: 4, status: 'IDENTIFIED' },
    ];
    for (const p of problems) {
      await client.query(`
        INSERT INTO organizational_problems (id,organization_id,title,category,severity,frequency,status,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      `, [id(), ORG_ID, p.title, p.cat, p.sev, p.freq, p.status, OWNER]);
    }
    console.log('✓ 6 problemas organizacionales registrados');

    // ── 7. Ciclos ────────────────────────────────────────────────────────────
    // Regla: primero CLOSED, al final ACTIVE (un ACTIVE por type)

    const CYC_3Y    = id(); // CUSTOM  3-year plan
    const CYC_2023  = id(); // ANNUAL  2023 CLOSED
    const CYC_2024  = id(); // ANNUAL  2024 CLOSED
    const CYC_2025  = id(); // ANNUAL  2025 ACTIVE
    const CYC_Q1_23 = id(); const CYC_Q2_23 = id();
    const CYC_Q3_23 = id(); const CYC_Q4_23 = id();
    const CYC_Q1_24 = id(); const CYC_Q2_24 = id();
    const CYC_Q3_24 = id(); const CYC_Q4_24 = id();
    const CYC_Q1_25 = id(); const CYC_Q2_25 = id();
    const CYC_Q3_25 = id(); // QUARTERLY 2025 Q3 ACTIVE
    const CYC_STRAT = id(); // CUSTOM 2025-2027 strategic plan ACTIVE

    // CLOSED cycles first
    const closedCycles = [
      { id: CYC_3Y,    type: 'CUSTOM',     status: 'CLOSED', name: 'Plan Estratégico 2023-2025', start: '2023-01-01', end: '2025-12-31', closedAt: '2026-01-15' },
      { id: CYC_2023,  type: 'ANNUAL',     status: 'CLOSED', name: 'Año 2023',      start: '2023-01-01', end: '2023-12-31', closedAt: '2024-01-15' },
      { id: CYC_2024,  type: 'ANNUAL',     status: 'CLOSED', name: 'Año 2024',      start: '2024-01-01', end: '2024-12-31', closedAt: '2025-01-15' },
      { id: CYC_Q1_23, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q1 2023', start: '2023-01-01', end: '2023-03-31', closedAt: '2023-04-05' },
      { id: CYC_Q2_23, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q2 2023', start: '2023-04-01', end: '2023-06-30', closedAt: '2023-07-05' },
      { id: CYC_Q3_23, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q3 2023', start: '2023-07-01', end: '2023-09-30', closedAt: '2023-10-05' },
      { id: CYC_Q4_23, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q4 2023', start: '2023-10-01', end: '2023-12-31', closedAt: '2024-01-05' },
      { id: CYC_Q1_24, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q1 2024', start: '2024-01-01', end: '2024-03-31', closedAt: '2024-04-05' },
      { id: CYC_Q2_24, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q2 2024', start: '2024-04-01', end: '2024-06-30', closedAt: '2024-07-05' },
      { id: CYC_Q3_24, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q3 2024', start: '2024-07-01', end: '2024-09-30', closedAt: '2024-10-05' },
      { id: CYC_Q4_24, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q4 2024', start: '2024-10-01', end: '2024-12-31', closedAt: '2025-01-05' },
      { id: CYC_Q1_25, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q1 2025', start: '2025-01-01', end: '2025-03-31', closedAt: '2025-04-05' },
      { id: CYC_Q2_25, type: 'QUARTERLY',  status: 'CLOSED', name: 'Q2 2025', start: '2025-04-01', end: '2025-06-30', closedAt: '2025-07-05' },
    ];
    for (const c of closedCycles) {
      await client.query(`
        INSERT INTO cycles (id,organization_id,name,type,status,start_date,end_date,closed_at,created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      `, [c.id, ORG_ID, c.name, c.type, c.status, c.start, c.end, c.closedAt, OWNER]);
    }

    // ACTIVE cycles last
    await client.query(`INSERT INTO cycles (id,organization_id,name,type,status,start_date,end_date,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [CYC_2025, ORG_ID, 'Año 2025', 'ANNUAL', 'ACTIVE', '2025-01-01', '2025-12-31', OWNER]);
    await client.query(`INSERT INTO cycles (id,organization_id,name,type,status,start_date,end_date,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [CYC_Q3_25, ORG_ID, 'Q3 2025', 'QUARTERLY', 'ACTIVE', '2025-07-01', '2025-09-30', OWNER]);
    await client.query(`INSERT INTO cycles (id,organization_id,name,type,status,start_date,end_date,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [CYC_STRAT, ORG_ID, 'Plan Estratégico 2025-2027', 'CUSTOM', 'ACTIVE', '2025-01-01', '2027-12-31', OWNER]);
    console.log('✓ 16 ciclos creados (13 CLOSED + 3 ACTIVE)');

    // ── 8. Objetivos del Plan 3 años ─────────────────────────────────────────
    const O3Y_1 = id(); const O3Y_2 = id(); const O3Y_3 = id();
    const objs3Y = [
      { id: O3Y_1, title: 'Posicionarnos como la cooperativa de referencia en transformación digital', si: SI_GROWTH  },
      { id: O3Y_2, title: 'Construir la base financiera para la expansión sostenida 2023-2025',          si: SI_EFFIC  },
      { id: O3Y_3, title: 'Transformar la cultura organizacional hacia la innovación continua',           si: SI_CULT   },
    ];
    for (const o of objs3Y) {
      await client.query(`
        INSERT INTO objectives (id,organization_id,cycle_id,title,level,status,owner_id,strategic_intent_id,created_by)
        VALUES ($1,$2,$3,$4,'COMPANY','COMPLETED',$5,$6,$7)
      `, [o.id, ORG_ID, CYC_3Y, o.title, OWNER, o.si, OWNER]);
    }

    // ── 9. Objetivos Anuales 2023 ────────────────────────────────────────────
    const OA23_1 = id(); const OA23_2 = id(); const OA23_3 = id(); const OA23_4 = id();
    const annualObj2023 = [
      { id: OA23_1, title: 'Transformar la experiencia digital del socio',        si: SI_GROWTH, owner: USER_CARLOS    },
      { id: OA23_2, title: 'Fortalecer la salud financiera de la cooperativa',    si: SI_EFFIC,  owner: USER_ROBERTO   },
      { id: OA23_3, title: 'Digitalizar los procesos críticos de crédito',        si: SI_EFFIC,  owner: USER_CARLOS    },
      { id: OA23_4, title: 'Construir las capacidades digitales del equipo',      si: SI_CULT,   owner: OWNER           },
    ];
    for (const o of annualObj2023) {
      await client.query(`
        INSERT INTO objectives (id,organization_id,cycle_id,title,level,status,owner_id,strategic_intent_id,created_by)
        VALUES ($1,$2,$3,$4,'COMPANY','COMPLETED',$5,$6,$7)
      `, [o.id, ORG_ID, CYC_2023, o.title, o.owner, o.si, OWNER]);
    }

    // TEAM objectives 2023 (alineados a OA23_1)
    const OT23_TI  = id(); const OT23_EXP = id();
    await client.query(`INSERT INTO objectives (id,organization_id,cycle_id,team_id,parent_objective_id,title,level,status,owner_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,'TEAM','COMPLETED',$7,$8)`,
      [OT23_TI, ORG_ID, CYC_2023, TEAM_TI, OA23_1, 'Desarrollar y lanzar la app móvil de socios v1.0', USER_CARLOS, OWNER]);
    await client.query(`INSERT INTO objectives (id,organization_id,cycle_id,team_id,parent_objective_id,title,level,status,owner_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,'TEAM','COMPLETED',$7,$8)`,
      [OT23_EXP, ORG_ID, CYC_2023, TEAM_EXP, OA23_1, 'Rediseñar el journey de atención presencial y digital', USER_MARIA, OWNER]);

    console.log('✓ Objetivos 2023 creados (4 COMPANY + 2 TEAM)');

    // ── 10. Objetivos Anuales 2024 ───────────────────────────────────────────
    const OA24_1 = id(); const OA24_2 = id(); const OA24_3 = id(); const OA24_4 = id();
    const annualObj2024 = [
      { id: OA24_1, title: 'Expandir la oferta de productos financieros digitales', si: SI_GROWTH, owner: USER_CARLOS    },
      { id: OA24_2, title: 'Alcanzar excelencia operacional en todos los procesos',  si: SI_EFFIC,  owner: USER_ROBERTO   },
      { id: OA24_3, title: 'Convertir a los socios en promotores activos de Cooprogreso', si: SI_GROWTH, owner: USER_MARIA },
      { id: OA24_4, title: 'Fortalecer el gobierno corporativo y gestión de riesgos', si: SI_EFFIC, owner: USER_ROBERTO   },
    ];
    for (const o of annualObj2024) {
      await client.query(`
        INSERT INTO objectives (id,organization_id,cycle_id,title,level,status,owner_id,strategic_intent_id,created_by)
        VALUES ($1,$2,$3,$4,'COMPANY','COMPLETED',$5,$6,$7)
      `, [o.id, ORG_ID, CYC_2024, o.title, o.owner, o.si, OWNER]);
    }

    const OT24_TI = id(); const OT24_FIN = id(); const OT24_EXP = id();
    await client.query(`INSERT INTO objectives (id,organization_id,cycle_id,team_id,parent_objective_id,title,level,status,owner_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,'TEAM','COMPLETED',$7,$8)`,
      [OT24_TI,  ORG_ID, CYC_2024, TEAM_TI,  OA24_1, 'Construir plataforma Open Banking e integraciones API',     USER_CARLOS,  OWNER]);
    await client.query(`INSERT INTO objectives (id,organization_id,cycle_id,team_id,parent_objective_id,title,level,status,owner_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,'TEAM','COMPLETED',$7,$8)`,
      [OT24_FIN, ORG_ID, CYC_2024, TEAM_FIN, OA24_4, 'Implementar sistema de scoring crediticio en tiempo real',   USER_ROBERTO, OWNER]);
    await client.query(`INSERT INTO objectives (id,organization_id,cycle_id,team_id,parent_objective_id,title,level,status,owner_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,'TEAM','COMPLETED',$7,$8)`,
      [OT24_EXP, ORG_ID, CYC_2024, TEAM_EXP, OA24_3, 'Diseñar programa de lealtad y referidos digitales',          USER_MARIA,   OWNER]);

    console.log('✓ Objetivos 2024 creados (4 COMPANY + 3 TEAM)');

    // ── 11. Objetivos Anuales 2025 (ACTIVE) ──────────────────────────────────
    const OA25_1 = id(); const OA25_2 = id(); const OA25_3 = id(); const OA25_4 = id();
    const annualObj2025 = [
      { id: OA25_1, title: 'Liderar la transformación digital del sector cooperativo', si: SI_GROWTH, owner: USER_CARLOS    },
      { id: OA25_2, title: 'Alcanzar sostenibilidad financiera y crecimiento rentable', si: SI_EFFIC, owner: USER_ROBERTO   },
      { id: OA25_3, title: 'Crear la mejor experiencia para nuestros socios',           si: SI_GROWTH, owner: USER_MARIA    },
      { id: OA25_4, title: 'Construir la organización del futuro',                      si: SI_CULT,   owner: OWNER          },
    ];
    for (const o of annualObj2025) {
      await client.query(`
        INSERT INTO objectives (id,organization_id,cycle_id,title,level,status,owner_id,strategic_intent_id,created_by)
        VALUES ($1,$2,$3,$4,'COMPANY','ACTIVE',$5,$6,$7)
      `, [o.id, ORG_ID, CYC_2025, o.title, o.owner, o.si, OWNER]);
    }

    const OT25_TI = id(); const OT25_FIN = id(); const OT25_EXP = id();
    await client.query(`INSERT INTO objectives (id,organization_id,cycle_id,team_id,parent_objective_id,title,level,status,owner_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,'TEAM','ACTIVE',$7,$8)`,
      [OT25_TI,  ORG_ID, CYC_2025, TEAM_TI,  OA25_1, 'Migrar core bancario a arquitectura cloud-native',          USER_CARLOS,  OWNER]);
    await client.query(`INSERT INTO objectives (id,organization_id,cycle_id,team_id,parent_objective_id,title,level,status,owner_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,'TEAM','ACTIVE',$7,$8)`,
      [OT25_FIN, ORG_ID, CYC_2025, TEAM_FIN, OA25_2, 'Optimizar la cartera de crédito y reducir morosidad a 1.5%', USER_ROBERTO, OWNER]);
    await client.query(`INSERT INTO objectives (id,organization_id,cycle_id,team_id,parent_objective_id,title,level,status,owner_id,created_by) VALUES ($1,$2,$3,$4,$5,$6,'TEAM','ACTIVE',$7,$8)`,
      [OT25_EXP, ORG_ID, CYC_2025, TEAM_EXP, OA25_3, 'Implementar omnicanalidad completa y asistente IA para socios', USER_MARIA, OWNER]);

    console.log('✓ Objetivos 2025 creados (4 COMPANY + 3 TEAM)');

    // ── 11b. OKRs Estratégicos 2025-2027 (CUSTOM cycle, ACTIVE) ─────────────
    const OS_1 = id(); const OS_2 = id(); const OS_3 = id();
    const strategicObjs = [
      { id: OS_1, title: 'Ser la plataforma financiera digital de referencia del sector cooperativo ecuatoriano', si: SI_GROWTH, owner: USER_CARLOS  },
      { id: OS_2, title: 'Alcanzar la sostenibilidad financiera para escalar el impacto cooperativo a nivel regional', si: SI_EFFIC, owner: USER_ROBERTO },
      { id: OS_3, title: 'Construir la organización más ágil e innovadora del ecosistema financiero cooperativo',     si: SI_CULT,  owner: OWNER        },
    ];
    for (const o of strategicObjs) {
      await client.query(`
        INSERT INTO objectives (id,organization_id,cycle_id,title,level,status,owner_id,strategic_intent_id,created_by)
        VALUES ($1,$2,$3,$4,'COMPANY','ACTIVE',$5,$6,$7)
      `, [o.id, ORG_ID, CYC_STRAT, o.title, o.owner, o.si, OWNER]);
    }
    // Vincular OKRs anuales 2025 a sus OKRs estratégicos padre
    await client.query(`UPDATE objectives SET parent_objective_id=$1 WHERE id=$2`, [OS_1, OA25_1]);
    await client.query(`UPDATE objectives SET parent_objective_id=$1 WHERE id=$2`, [OS_2, OA25_2]);
    await client.query(`UPDATE objectives SET parent_objective_id=$1 WHERE id=$2`, [OS_1, OA25_3]);
    await client.query(`UPDATE objectives SET parent_objective_id=$1 WHERE id=$2`, [OS_3, OA25_4]);
    console.log('✓ 3 OKRs estratégicos creados (Plan Estratégico 2025-2027)');

    // ── 12. Objetivos Trimestrales ────────────────────────────────────────────
    // Q1-Q4 2023 / 2024 CLOSED: 2 COMPANY objectives each
    // Q1-Q2 2025 CLOSED + Q3 2025 ACTIVE: 2 COMPANY each
    const quarterDefs = [
      { cycle: CYC_Q1_23, y: '2023', q: 'Q1', status: 'COMPLETED' },
      { cycle: CYC_Q2_23, y: '2023', q: 'Q2', status: 'COMPLETED' },
      { cycle: CYC_Q3_23, y: '2023', q: 'Q3', status: 'COMPLETED' },
      { cycle: CYC_Q4_23, y: '2023', q: 'Q4', status: 'COMPLETED' },
      { cycle: CYC_Q1_24, y: '2024', q: 'Q1', status: 'COMPLETED' },
      { cycle: CYC_Q2_24, y: '2024', q: 'Q2', status: 'COMPLETED' },
      { cycle: CYC_Q3_24, y: '2024', q: 'Q3', status: 'COMPLETED' },
      { cycle: CYC_Q4_24, y: '2024', q: 'Q4', status: 'COMPLETED' },
      { cycle: CYC_Q1_25, y: '2025', q: 'Q1', status: 'COMPLETED' },
      { cycle: CYC_Q2_25, y: '2025', q: 'Q2', status: 'COMPLETED' },
      { cycle: CYC_Q3_25, y: '2025', q: 'Q3', status: 'ACTIVE'    },
    ];

    const quarterlyObjTitles = {
      '2023-Q1': ['Lanzar campaña de adopción digital para socios jóvenes',       'Cerrar el primer trimestre con mora < 4.0%'],
      '2023-Q2': ['Implementar módulo de crédito digital en la app',               'Reducir tiempo de atención presencial a 30 min'],
      '2023-Q3': ['Alcanzar 3,500 usuarios activos en la app móvil',               'Automatizar el proceso de evaluación de créditos < $5K'],
      '2023-Q4': ['Completar la digitalización de los 5 procesos core de crédito', 'Cerrar el año con NPS > 40'],
      '2024-Q1': ['Lanzar producto de ahorro digital programado',                  'Implementar dashboard de indicadores financieros en tiempo real'],
      '2024-Q2': ['Integrar 3 canales de atención en una sola plataforma',         'Reducir costo operativo por transacción en 15%'],
      '2024-Q3': ['Superar 12,000 usuarios activos en plataformas digitales',      'Lanzar programa piloto de scoring crediticio IA'],
      '2024-Q4': ['Alcanzar NPS de 60 puntos',                                     'Cerrar el año con ROA > 1.3%'],
      '2025-Q1': ['Migrar primer módulo del core bancario a cloud',                'Lanzar asistente virtual IA para consultas de socios'],
      '2025-Q2': ['Alcanzar 30,000 usuarios digitales activos',                    'Consolidar Open Banking con 5 integraciones activas'],
      '2025-Q3': ['Completar migración a arquitectura cloud-native',               'Alcanzar NPS de 75 y tiempo de respuesta < 3h'],
    };

    const quarterlyObjIds = {}; // key: 'cycleId-1' or 'cycleId-2'
    for (const qd of quarterDefs) {
      const titles = quarterlyObjTitles[`${qd.y}-${qd.q}`];
      const owners = [USER_CARLOS, USER_ROBERTO, USER_MARIA, OWNER];
      for (let i = 0; i < 2; i++) {
        const oid = id();
        quarterlyObjIds[`${qd.cycle}-${i + 1}`] = oid;
        await client.query(`
          INSERT INTO objectives (id,organization_id,cycle_id,title,level,status,owner_id,created_by)
          VALUES ($1,$2,$3,$4,'COMPANY',$5,$6,$7)
        `, [oid, ORG_ID, qd.cycle, titles[i], qd.status, owners[(qd.y + qd.q + i).length % 4], OWNER]);
      }
    }
    console.log('✓ Objetivos trimestrales creados (22 COMPANY)');

    // ── 13. Key Results ───────────────────────────────────────────────────────
    // Returns array of KR rows to track
    const allKRs = []; // { id, objective_id, start_value, target_value, type, unit, owner, cycleStart, cycleEnd, completed }

    // Owner → equipo responsable (derivación automática)
    const ownerToTeam = {
      [OWNER]:          TEAM_ROOT,
      [USER_CARLOS]:    TEAM_TI,
      [USER_VALENTINA]: TEAM_TI,
      [USER_ROBERTO]:   TEAM_FIN,
      [USER_SOFIA]:     TEAM_FIN,
      [USER_MARIA]:     TEAM_EXP,
      [USER_DIEGO]:     TEAM_OPS,
    };

    async function insertKR(krDef) {
      const krId  = id();
      const owner = krDef.owner || OWNER;
      const teamId = krDef.team ?? ownerToTeam[owner] ?? null;
      await client.query(`
        INSERT INTO key_results
          (id, objective_id, title, type, metric_unit, start_value, target_value, current_value, confidence, status, owner_id, team_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      `, [
        krId, krDef.obj, krDef.title, krDef.type, krDef.unit,
        krDef.start, krDef.target, krDef.start, 0.7, 'ON_TRACK',
        owner, teamId, OWNER,
      ]);
      allKRs.push({ id: krId, ...krDef, team: teamId });
      return krId;
    }

    // ── KRs Plan Estratégico 2025-2027 ──────────────────────────────────────
    // cycleEnd = 2026-05-08 para que los check-ins terminen en la fecha actual del demo
    await insertKR({ obj: OS_1, title: 'Alcanzar 100,000 socios digitales activos al cierre de 2027',                             type: 'INCREASE', unit: 'socios',    start: 18000, target: 100000, owner: USER_CARLOS,  cycleStart: new Date('2025-01-01'), cycleEnd: new Date('2026-05-08'), months: 10, completed: false, atRisk: false });
    await insertKR({ obj: OS_1, title: 'Obtener NPS ≥ 85 puntos sostenido por 4 trimestres consecutivos en 2027',                 type: 'INCREASE', unit: 'puntos',   start: 65,    target: 85,     owner: USER_MARIA,   cycleStart: new Date('2025-01-01'), cycleEnd: new Date('2026-05-08'), months: 10, completed: false, atRisk: false });
    await insertKR({ obj: OS_1, title: 'Posicionarse #1 en ranking de cooperativas financieras digitales del sector en Ecuador',  type: 'ACHIEVE',  unit: '%',        start: 0,     target: 100,    owner: USER_CARLOS,  cycleStart: new Date('2025-01-01'), cycleEnd: new Date('2026-05-08'), months: 10, completed: false, atRisk: false });

    await insertKR({ obj: OS_2, title: 'Crecer cartera neta de crédito de $68M a $150M al cierre del Plan 2027',                  type: 'INCREASE', unit: '$M',       start: 68,    target: 150,    owner: USER_ROBERTO, cycleStart: new Date('2025-01-01'), cycleEnd: new Date('2026-05-08'), months: 10, completed: false, atRisk: false });
    await insertKR({ obj: OS_2, title: 'Reducir morosidad global de 2.1% a 1.0% sostenido durante 2027',                         type: 'DECREASE', unit: '%',        start: 2.1,   target: 1.0,    owner: USER_ROBERTO, cycleStart: new Date('2025-01-01'), cycleEnd: new Date('2026-05-08'), months: 10, completed: false, atRisk: false });
    await insertKR({ obj: OS_2, title: 'Alcanzar ROA de 2.0% anual al cierre del Plan Estratégico 2027',                         type: 'INCREASE', unit: '%',        start: 1.4,   target: 2.0,    owner: USER_ROBERTO, cycleStart: new Date('2025-01-01'), cycleEnd: new Date('2026-05-08'), months: 10, completed: false, atRisk: false });

    await insertKR({ obj: OS_3, title: '100% del equipo certificado en metodologías ágiles y herramientas digitales al 2027',     type: 'INCREASE', unit: '%',        start: 30,    target: 100,    owner: OWNER,        cycleStart: new Date('2025-01-01'), cycleEnd: new Date('2026-05-08'), months: 10, completed: false, atRisk: false });
    await insertKR({ obj: OS_3, title: 'Reducir índice de rotación voluntaria del personal del 18% al 5% al cierre de 2027',     type: 'DECREASE', unit: '%',        start: 18,    target: 5,      owner: OWNER,        cycleStart: new Date('2025-01-01'), cycleEnd: new Date('2026-05-08'), months: 10, completed: false, atRisk: false });
    await insertKR({ obj: OS_3, title: 'Lanzar 5 productos o servicios completamente nuevos al mercado cooperativo en 2027',      type: 'INCREASE', unit: 'productos', start: 0,   target: 5,      owner: USER_CARLOS,  cycleStart: new Date('2025-01-01'), cycleEnd: new Date('2026-05-08'), months: 10, completed: false, atRisk: false });

    // ── KRs Plan 3 años ──────────────────────────────────────────────────────
    await insertKR({ obj: O3Y_1, title: 'Crecer usuarios digitales activos de 0 a 45,000',              type: 'INCREASE', unit: 'usuarios', start: 0,    target: 45000, owner: USER_CARLOS,  cycleStart: new Date('2023-01-01'), cycleEnd: new Date('2025-12-31'), months: 12, completed: true });
    await insertKR({ obj: O3Y_1, title: 'Alcanzar NPS ≥ 80 (partiendo de 25)',                         type: 'INCREASE', unit: 'puntos',   start: 25,   target: 80,    owner: USER_MARIA,   cycleStart: new Date('2023-01-01'), cycleEnd: new Date('2025-12-31'), months: 12, completed: true });
    await insertKR({ obj: O3Y_2, title: 'Crecer cartera de crédito de $35M a $85M',                    type: 'INCREASE', unit: '$M',       start: 35,   target: 85,    owner: USER_ROBERTO, cycleStart: new Date('2023-01-01'), cycleEnd: new Date('2025-12-31'), months: 12, completed: true });
    await insertKR({ obj: O3Y_2, title: 'Reducir morosidad de 4.5% a 1.5%',                             type: 'DECREASE', unit: '%',        start: 4.5,  target: 1.5,   owner: USER_ROBERTO, cycleStart: new Date('2023-01-01'), cycleEnd: new Date('2025-12-31'), months: 12, completed: true });
    await insertKR({ obj: O3Y_3, title: 'Alcanzar 100% del equipo certificado en herramientas digitales',type: 'ACHIEVE',  unit: '%',        start: 0,    target: 100,   owner: OWNER,        cycleStart: new Date('2023-01-01'), cycleEnd: new Date('2025-12-31'), months: 12, completed: false });

    // ── KRs 2023 COMPANY objectives ──────────────────────────────────────────
    await insertKR({ obj: OA23_1, title: 'Crecer usuarios app móvil de 1,200 a 8,000',                  type: 'INCREASE', unit: 'usuarios', start: 1200, target: 8000,  owner: USER_CARLOS,  cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA23_1, title: 'Reducir tiempo promedio de atención presencial de 45 a 20 min',type: 'DECREASE', unit: 'min',      start: 45,   target: 20,    owner: USER_MARIA,   cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA23_1, title: 'Alcanzar NPS de 45 (partiendo de 28)',                        type: 'INCREASE', unit: 'puntos',   start: 28,   target: 45,    owner: USER_MARIA,   cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });

    await insertKR({ obj: OA23_2, title: 'Incrementar cartera de crédito de $45M a $52M',              type: 'INCREASE', unit: '$M',       start: 45,   target: 52,    owner: USER_ROBERTO, cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA23_2, title: 'Reducir índice de morosidad de 4.2% a 2.8%',                 type: 'DECREASE', unit: '%',        start: 4.2,  target: 2.8,   owner: USER_ROBERTO, cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA23_2, title: 'Mejorar ROA de 0.8% a 1.2%',                                 type: 'INCREASE', unit: '%',        start: 0.8,  target: 1.2,   owner: USER_ROBERTO, cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });

    await insertKR({ obj: OA23_3, title: 'Reducir tiempo de aprobación de crédito de 5 días a 1 día',  type: 'DECREASE', unit: 'días',     start: 5,    target: 1,     owner: USER_CARLOS,  cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA23_3, title: 'Digitalizar el 80% de las solicitudes de crédito',            type: 'INCREASE', unit: '%',        start: 5,    target: 80,    owner: USER_CARLOS,  cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA23_3, title: 'Eliminar papel en el proceso de evaluación crediticia',       type: 'ACHIEVE',  unit: '%',        start: 0,    target: 100,   owner: USER_CARLOS,  cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });

    await insertKR({ obj: OA23_4, title: 'Capacitar 100% del equipo en competencias digitales básicas', type: 'ACHIEVE',  unit: '%',        start: 0,    target: 100,   owner: OWNER,        cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA23_4, title: 'Reducir tiempo de onboarding de 30 a 15 días',               type: 'DECREASE', unit: 'días',     start: 30,   target: 15,    owner: OWNER,        cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA23_4, title: 'Lograr 85% de satisfacción en encuesta de clima laboral',    type: 'INCREASE', unit: '%',        start: 62,   target: 85,    owner: OWNER,        cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });

    // ── KRs 2023 TEAM objectives ─────────────────────────────────────────────
    await insertKR({ obj: OT23_TI,  title: 'Lanzar app iOS y Android con 10 funcionalidades core',     type: 'ACHIEVE',  unit: '%',        start: 0,    target: 100,   owner: USER_CARLOS,  cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OT23_TI,  title: 'Alcanzar 4.2 estrellas en stores de apps',                 type: 'INCREASE', unit: 'estrellas',start: 0,    target: 4.2,   owner: USER_CARLOS,  cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OT23_EXP, title: 'Implementar nuevo protocolo de atención en 4 sucursales',  type: 'ACHIEVE',  unit: '%',        start: 0,    target: 100,   owner: USER_MARIA,   cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });
    await insertKR({ obj: OT23_EXP, title: 'Reducir reclamos de atención en un 40%',                   type: 'DECREASE', unit: 'reclamos', start: 120,  target: 72,    owner: USER_MARIA,   cycleStart: new Date('2023-01-15'), cycleEnd: new Date('2023-12-15'), months: 12, completed: true });

    // ── KRs 2024 COMPANY objectives ──────────────────────────────────────────
    await insertKR({ obj: OA24_1, title: 'Lanzar 3 nuevos productos financieros 100% digitales',       type: 'ACHIEVE',  unit: '%',        start: 0,    target: 100,   owner: USER_CARLOS,  cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA24_1, title: 'Aumentar transacciones digitales del 35% al 65% del total',  type: 'INCREASE', unit: '%',        start: 35,   target: 65,    owner: USER_CARLOS,  cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA24_1, title: 'Crecer base de socios activos digitales de 8,000 a 18,000',  type: 'INCREASE', unit: 'socios',   start: 8000, target: 18000, owner: USER_CARLOS,  cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });

    await insertKR({ obj: OA24_2, title: 'Reducir costo operativo por transacción de $3.20 a $1.80',   type: 'DECREASE', unit: '$',        start: 3.2,  target: 1.8,   owner: USER_ROBERTO, cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA24_2, title: 'Automatizar 12 procesos manuales críticos',                  type: 'INCREASE', unit: 'procesos', start: 0,    target: 12,    owner: USER_ROBERTO, cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA24_2, title: 'Mantener disponibilidad de plataformas en ≥ 99.5%',          type: 'MAINTAIN', unit: '%',        start: 99.5, target: 99.5,  owner: USER_CARLOS,  cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });

    await insertKR({ obj: OA24_3, title: 'Aumentar NPS de 45 a 65 puntos',                             type: 'INCREASE', unit: 'puntos',   start: 45,   target: 65,    owner: USER_MARIA,   cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA24_3, title: 'Reducir tasa de retiro de socios del 8% al 4%',              type: 'DECREASE', unit: '%',        start: 8,    target: 4,     owner: USER_MARIA,   cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA24_3, title: 'Lograr que 70% de socios tengan 2+ productos activos',       type: 'INCREASE', unit: '%',        start: 42,   target: 70,    owner: USER_MARIA,   cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });

    await insertKR({ obj: OA24_4, title: 'Reducir eventos de fraude de 45 a 12 por trimestre',         type: 'DECREASE', unit: 'eventos',  start: 45,   target: 12,    owner: USER_ROBERTO, cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA24_4, title: 'Alcanzar índice de adecuación de capital del 14%',           type: 'INCREASE', unit: '%',        start: 11,   target: 14,    owner: USER_ROBERTO, cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OA24_4, title: 'Zero hallazgos críticos en auditoría externa anual',        type: 'ACHIEVE',  unit: '%',        start: 0,    target: 100,   owner: USER_ROBERTO, cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });

    // ── KRs 2024 TEAM objectives ─────────────────────────────────────────────
    await insertKR({ obj: OT24_TI,  title: 'Integrar 5 partners financieros vía API Open Banking',    type: 'INCREASE', unit: 'partners', start: 0,    target: 5,     owner: USER_CARLOS,  cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OT24_TI,  title: 'Alcanzar latencia promedio de API < 200ms',               type: 'DECREASE', unit: 'ms',       start: 850,  target: 200,   owner: USER_CARLOS,  cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OT24_FIN, title: 'Implementar modelo de scoring con AUC ≥ 0.85',            type: 'ACHIEVE',  unit: '%',        start: 0,    target: 100,   owner: USER_ROBERTO, cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OT24_FIN, title: 'Reducir tiempo de evaluación crediticia de 5 días a 2h',  type: 'DECREASE', unit: 'horas',    start: 120,  target: 2,     owner: USER_ROBERTO, cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OT24_EXP, title: 'Lanzar programa de referidos con 2,000 activaciones',     type: 'INCREASE', unit: 'refls',    start: 0,    target: 2000,  owner: USER_MARIA,   cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });
    await insertKR({ obj: OT24_EXP, title: 'Alcanzar 60% de participación en programa de lealtad',    type: 'INCREASE', unit: '%',        start: 0,    target: 60,    owner: USER_MARIA,   cycleStart: new Date('2024-01-15'), cycleEnd: new Date('2024-12-15'), months: 12, completed: true });

    // ── KRs 2025 COMPANY objectives (active) ─────────────────────────────────
    await insertKR({ obj: OA25_1, title: 'Crecer usuarios app de 18,000 a 45,000 socios activos',      type: 'INCREASE', unit: 'usuarios', start: 18000, target: 45000, owner: USER_CARLOS,  cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OA25_1, title: 'Alcanzar 80% de transacciones 100% digitales',              type: 'INCREASE', unit: '%',        start: 65,   target: 80,    owner: USER_CARLOS,  cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OA25_1, title: 'Obtener certificación ISO 27001 de seguridad de la información', type: 'ACHIEVE', unit: '%', start: 0, target: 100, owner: USER_CARLOS, cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: true });

    await insertKR({ obj: OA25_2, title: 'Crecer cartera de crédito de $68M a $85M',                  type: 'INCREASE', unit: '$M',       start: 68,   target: 85,    owner: USER_ROBERTO, cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OA25_2, title: 'Reducir morosidad de 2.1% a 1.5%',                          type: 'DECREASE', unit: '%',        start: 2.1,  target: 1.5,   owner: USER_ROBERTO, cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: true  });
    await insertKR({ obj: OA25_2, title: 'Incrementar ROA de 1.4% a 1.8%',                            type: 'INCREASE', unit: '%',        start: 1.4,  target: 1.8,   owner: USER_ROBERTO, cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });

    await insertKR({ obj: OA25_3, title: 'Alcanzar NPS de 80 puntos (desde 65)',                      type: 'INCREASE', unit: 'puntos',   start: 65,   target: 80,    owner: USER_MARIA,   cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OA25_3, title: 'Implementar 5 canales de atención integrados (omnicanal)',   type: 'INCREASE', unit: 'canales',  start: 2,    target: 5,     owner: USER_MARIA,   cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OA25_3, title: 'Reducir tiempo de respuesta promedio de 6h a 2h',           type: 'DECREASE', unit: 'horas',   start: 6,    target: 2,     owner: USER_MARIA,   cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: true  });

    await insertKR({ obj: OA25_4, title: '100% del equipo certificado en metodologías ágiles',        type: 'INCREASE', unit: '%',        start: 30,   target: 100,   owner: OWNER,        cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OA25_4, title: 'Reducir índice de rotación de personal del 18% al 8%',     type: 'DECREASE', unit: '%',        start: 18,   target: 8,     owner: OWNER,        cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OA25_4, title: 'Alcanzar 90% de satisfacción en encuesta de clima 2025',   type: 'INCREASE', unit: '%',        start: 75,   target: 90,    owner: OWNER,        cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: true  });

    // ── KRs 2025 TEAM objectives ─────────────────────────────────────────────
    await insertKR({ obj: OT25_TI,  title: 'Migrar 3 módulos del core a AWS (contrato firmado)',        type: 'INCREASE', unit: 'módulos', start: 0,    target: 3,     owner: USER_CARLOS,  cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OT25_TI,  title: 'Reducir tiempo de despliegue de nuevas versiones de 2 semanas a 1 día', type: 'DECREASE', unit: 'días', start: 14, target: 1, owner: USER_CARLOS, cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OT25_FIN, title: 'Reducir mora en segmento PYME del 3.8% al 2.0%',           type: 'DECREASE', unit: '%',       start: 3.8,  target: 2.0,   owner: USER_ROBERTO, cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: true  });
    await insertKR({ obj: OT25_FIN, title: 'Implementar alertas tempranas de morosidad automáticas',   type: 'ACHIEVE',  unit: '%',       start: 0,    target: 100,   owner: USER_ROBERTO, cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OT25_EXP, title: 'Lanzar chatbot IA con 95% de resolución autónoma',         type: 'INCREASE', unit: '%',       start: 0,    target: 95,    owner: USER_MARIA,   cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });
    await insertKR({ obj: OT25_EXP, title: 'Integrar WhatsApp Business como canal de atención',        type: 'ACHIEVE',  unit: '%',       start: 0,    target: 100,   owner: USER_MARIA,   cycleStart: new Date('2025-01-15'), cycleEnd: new Date('2025-12-15'), months: 4, completed: false, atRisk: false });

    // ── KRs trimestral (2 KRs por objetivo) ──────────────────────────────────
    const qCycleInfo = {
      [CYC_Q1_23]: { start: new Date('2023-01-05'), end: new Date('2023-03-25'), months: 3 },
      [CYC_Q2_23]: { start: new Date('2023-04-05'), end: new Date('2023-06-25'), months: 3 },
      [CYC_Q3_23]: { start: new Date('2023-07-05'), end: new Date('2023-09-25'), months: 3 },
      [CYC_Q4_23]: { start: new Date('2023-10-05'), end: new Date('2023-12-25'), months: 3 },
      [CYC_Q1_24]: { start: new Date('2024-01-05'), end: new Date('2024-03-25'), months: 3 },
      [CYC_Q2_24]: { start: new Date('2024-04-05'), end: new Date('2024-06-25'), months: 3 },
      [CYC_Q3_24]: { start: new Date('2024-07-05'), end: new Date('2024-09-25'), months: 3 },
      [CYC_Q4_24]: { start: new Date('2024-10-05'), end: new Date('2024-12-25'), months: 3 },
      [CYC_Q1_25]: { start: new Date('2025-01-05'), end: new Date('2025-03-25'), months: 3 },
      [CYC_Q2_25]: { start: new Date('2025-04-05'), end: new Date('2025-06-25'), months: 3 },
      [CYC_Q3_25]: { start: new Date('2025-07-05'), end: new Date('2025-08-25'), months: 2 },
    };

    // KRs específicos por trimestre y por objetivo
    const quarterlyKRDefs = {
      '2023-Q1': [
        { obj:1, title:'Registrar 800 nuevos socios menores de 35 años en la app móvil',                    type:'INCREASE', unit:'socios',      start:0,    target:800,   owner: USER_CARLOS  },
        { obj:1, title:'Alcanzar tasa de activación del 65% en nuevos registros de la campaña digital',     type:'INCREASE', unit:'%',           start:40,   target:65,    owner: USER_CARLOS  },
        { obj:2, title:'Reducir índice de mora de 4.2% a 4.0% al cierre del trimestre',                    type:'DECREASE', unit:'%',           start:4.2,  target:4.0,   owner: USER_ROBERTO },
        { obj:2, title:'Recuperar $320K de cartera vencida mediante gestión proactiva de cobros',           type:'INCREASE', unit:'$K',          start:0,    target:320,   owner: USER_ROBERTO },
      ],
      '2023-Q2': [
        { obj:1, title:'Lanzar módulo de solicitud de crédito 100% digital en la app móvil',               type:'ACHIEVE',  unit:'%',           start:0,    target:100,   owner: USER_CARLOS  },
        { obj:1, title:'Procesar 100 solicitudes de crédito de forma completamente digital',                type:'INCREASE', unit:'solicitudes', start:0,    target:100,   owner: USER_CARLOS  },
        { obj:2, title:'Reducir tiempo promedio de atención presencial de 45 a 30 minutos',                 type:'DECREASE', unit:'min',         start:45,   target:30,    owner: USER_MARIA   },
        { obj:2, title:'Alcanzar 78% de satisfacción en encuesta post-atención al socio',                   type:'INCREASE', unit:'%',           start:62,   target:78,    owner: USER_MARIA   },
      ],
      '2023-Q3': [
        { obj:1, title:'Crecer base de usuarios activos en app de 1,800 a 3,500 socios',                   type:'INCREASE', unit:'usuarios',    start:1800, target:3500,  owner: USER_CARLOS  },
        { obj:1, title:'Mantener tasa de retención mensual de la app ≥ 65%',                               type:'MAINTAIN', unit:'%',           start:65,   target:65,    owner: USER_CARLOS  },
        { obj:2, title:'Reducir tiempo de aprobación de créditos < $5K de 72 horas a 4 horas',             type:'DECREASE', unit:'horas',       start:72,   target:4,     owner: USER_ROBERTO },
        { obj:2, title:'Alcanzar 60% de solicitudes de crédito < $5K completamente automatizadas',          type:'INCREASE', unit:'%',           start:0,    target:60,    owner: USER_ROBERTO },
      ],
      '2023-Q4': [
        { obj:1, title:'Digitalizar 5 procesos core de crédito (formulario→evaluación→aprobación→firma→desembolso)', type:'ACHIEVE', unit:'%', start:0, target:100, owner: USER_CARLOS },
        { obj:1, title:'Reducir uso de papel físico en procesos de crédito del 100% al 10%',               type:'DECREASE', unit:'%',           start:100,  target:10,    owner: USER_CARLOS  },
        { obj:2, title:'Alcanzar NPS de 42 puntos al cierre del año 2023',                                  type:'INCREASE', unit:'puntos',     start:28,   target:42,    owner: USER_MARIA   },
        { obj:2, title:'Resolver el 90% de reclamos de socios en menos de 48 horas',                       type:'INCREASE', unit:'%',           start:55,   target:90,    owner: USER_MARIA   },
      ],
      '2024-Q1': [
        { obj:1, title:'Lanzar "Ahorro Metas" y captar 1,200 cuentas activas en el trimestre',              type:'INCREASE', unit:'cuentas',    start:0,    target:1200,  owner: USER_CARLOS  },
        { obj:1, title:'Alcanzar $280K en saldo captado a través del producto de ahorro programado',        type:'INCREASE', unit:'$K',          start:0,    target:280,   owner: USER_CARLOS  },
        { obj:2, title:'Lanzar dashboard ejecutivo con 15 KPIs financieros en tiempo real',                 type:'ACHIEVE',  unit:'%',           start:0,    target:100,   owner: USER_ROBERTO },
        { obj:2, title:'Reducir tiempo de generación de reportes gerenciales de 3 horas a 5 minutos',      type:'DECREASE', unit:'min',         start:180,  target:5,     owner: USER_ROBERTO },
      ],
      '2024-Q2': [
        { obj:1, title:'Unificar app móvil, web y sucursal presencial en plataforma omnicanal única',       type:'ACHIEVE',  unit:'%',           start:0,    target:100,   owner: USER_CARLOS  },
        { obj:1, title:'Reducir consultas duplicadas entre canales del 35% al 10%',                        type:'DECREASE', unit:'%',           start:35,   target:10,    owner: USER_CARLOS  },
        { obj:2, title:'Reducir costo operativo por transacción de $3.20 a $2.72 (↓15%)',                  type:'DECREASE', unit:'$',           start:3.2,  target:2.72,  owner: USER_ROBERTO },
        { obj:2, title:'Incrementar transacciones digitales del 45% al 55% del total operacional',          type:'INCREASE', unit:'%',           start:45,   target:55,    owner: USER_ROBERTO },
      ],
      '2024-Q3': [
        { obj:1, title:'Superar 12,500 usuarios activos en plataformas digitales al cierre del trimestre',  type:'INCREASE', unit:'usuarios',    start:8000, target:12500, owner: USER_CARLOS  },
        { obj:1, title:'Alcanzar promedio de 4 sesiones mensuales por usuario activo digital',              type:'INCREASE', unit:'sesiones',    start:2.1,  target:4,     owner: USER_CARLOS  },
        { obj:2, title:'Lanzar modelo de scoring crediticio IA en producción para créditos < $10K',         type:'ACHIEVE',  unit:'%',           start:0,    target:100,   owner: USER_ROBERTO },
        { obj:2, title:'Reducir mora en segmento de créditos evaluados por IA del 3.1% al 1.8%',           type:'DECREASE', unit:'%',           start:3.1,  target:1.8,   owner: USER_ROBERTO },
      ],
      '2024-Q4': [
        { obj:1, title:'Alcanzar NPS de 60 puntos al cierre del ejercicio 2024',                           type:'INCREASE', unit:'puntos',     start:52,   target:60,    owner: USER_MARIA   },
        { obj:1, title:'Reducir tasa de promotores pasivos (NPS) del 40% al 25%',                          type:'DECREASE', unit:'%',           start:40,   target:25,    owner: USER_MARIA   },
        { obj:2, title:'Alcanzar ROA de 1.35% al cierre del ejercicio fiscal 2024',                        type:'INCREASE', unit:'%',           start:1.1,  target:1.35,  owner: USER_ROBERTO },
        { obj:2, title:'Incrementar cartera de crédito neta de $61M a $68M',                               type:'INCREASE', unit:'$M',          start:61,   target:68,    owner: USER_ROBERTO },
      ],
      '2025-Q1': [
        { obj:1, title:'Completar migración del módulo de autenticación a AWS ECS Fargate',                type:'ACHIEVE',  unit:'%',           start:0,    target:100,   owner: USER_CARLOS  },
        { obj:1, title:'Mantener disponibilidad del módulo migrado en cloud ≥ 99.9%',                      type:'MAINTAIN', unit:'%',           start:99.9, target:99.9,  owner: USER_CARLOS  },
        { obj:2, title:'Lanzar asistente virtual IA con 200 FAQs corporativas configuradas',               type:'ACHIEVE',  unit:'%',           start:0,    target:100,   owner: USER_MARIA   },
        { obj:2, title:'Alcanzar tasa de resolución autónoma del 40% en piloto interno de chatbot',         type:'INCREASE', unit:'%',           start:0,    target:40,    owner: USER_MARIA   },
      ],
      '2025-Q2': [
        { obj:1, title:'Crecer de 22,000 a 30,000 usuarios activos en plataformas digitales',              type:'INCREASE', unit:'usuarios',    start:22000,target:30000, owner: USER_CARLOS  },
        { obj:1, title:'Reducir churn mensual de usuarios digitales del 4% al 2%',                         type:'DECREASE', unit:'%',           start:4,    target:2,     owner: USER_CARLOS  },
        { obj:2, title:'Mantener 5 partners activos en Open Banking sin incidentes críticos en el trimestre', type:'MAINTAIN', unit:'partners',  start:5,    target:5,     owner: USER_CARLOS  },
        { obj:2, title:'Alcanzar 98% de uptime en APIs de Open Banking (SLA garantizado a partners)',       type:'INCREASE', unit:'%',           start:95,   target:98,    owner: USER_CARLOS  },
      ],
      '2025-Q3': [
        { obj:1, title:'Migrar 2 módulos adicionales del core a AWS (cuentas y créditos) — Q3 2025',       type:'INCREASE', unit:'módulos',     start:1,    target:3,     owner: USER_CARLOS  },
        { obj:1, title:'Reducir tiempo de despliegue de nuevas versiones del core de 14 días a 1 día',     type:'DECREASE', unit:'días',        start:14,   target:1,     owner: USER_CARLOS  },
        { obj:2, title:'Alcanzar NPS de 75 puntos al cierre del Q3 2025',                                  type:'INCREASE', unit:'puntos',     start:65,   target:75,    owner: USER_MARIA   },
        { obj:2, title:'Reducir tiempo de respuesta promedio al socio de 6 horas a 3 horas',               type:'DECREASE', unit:'horas',       start:6,    target:3,     owner: USER_MARIA   },
      ],
    };

    for (const qd of quarterDefs) {
      const info = qCycleInfo[qd.cycle];
      const isActive = qd.status === 'ACTIVE';
      const krDefs = quarterlyKRDefs[`${qd.y}-${qd.q}`] || [];
      for (const kd of krDefs) {
        const objId = quarterlyObjIds[`${qd.cycle}-${kd.obj}`];
        await insertKR({
          obj: objId,
          title: kd.title, type: kd.type, unit: kd.unit, start: kd.start, target: kd.target,
          owner: kd.owner,
          cycleStart: info.start, cycleEnd: info.end,
          months: info.months,
          completed: !isActive,
          atRisk: false,
        });
      }
    }

    console.log(`✓ ${allKRs.length} Key Results creados`);

    // ── 14. Check-ins ─────────────────────────────────────────────────────────
    let checkinCount = 0;
    for (const kr of allKRs) {
      // For active cycles: only show partial progress (cycle not yet finished)
      const maxRatio = kr.completed ? 1.0 : (kr.atRisk ? 0.20 : 0.35);
      const checkInFn = kr.atRisk ? buildCheckInsAtRisk : buildCheckIns;
      const items = checkInFn(
        kr.id, kr.owner || OWNER,
        kr.start, kr.target, kr.type,
        kr.cycleStart, kr.cycleEnd,
        kr.months,
        maxRatio
      );
      for (const ci of items) {
        await client.query(`
          INSERT INTO check_ins (id, kr_id, user_id, checked_at, current_value, confidence, notes, mood)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `, [
          id(), ci.kr_id, ci.user_id, ci.checked_at,
          ci.current_value, ci.confidence,
          `Check-in ${ci.mood === 'GREAT' ? 'excelente progreso' : ci.mood === 'CONCERNED' ? 'necesita atención' : 'progreso normal'}`,
          ci.mood,
        ]);
        checkinCount++;
      }
    }
    console.log(`✓ ${checkinCount} check-ins creados`);

    // ── 14b. Check-ins recientes (últimas 8 semanas — para v_weekly_trend) ────
    // Usamos la fecha real de ejecución para que el demo siempre tenga datos
    // vigentes. Cada persona tiene un "último check-in" configurado para que
    // el ranking de compromiso muestre semáforos variados desde el primer cargue:
    //   OWNER / Carlos / Valentina / María → 🟢 al día (overdue=0, BIWEEKLY 14d)
    //   Roberto                            → 🟡 leve retraso (overdue=3)
    //   Sofía                              → 🔴 retraso moderado (overdue=6)
    //   Diego                              → 🔴 sin actualizar (overdue=18)
    const SEED_TODAY      = new Date();
    const EIGHT_WEEKS_AGO = new Date(SEED_TODAY.getTime() - 8 * 7 * 24 * 60 * 60 * 1000);
    const activeKRs       = allKRs.filter(kr => !kr.completed && kr.cycleEnd < EIGHT_WEEKS_AGO);

    const ownerLastCheckinDays = {
      [OWNER]:          2,
      [USER_CARLOS]:    6,
      [USER_VALENTINA]: 4,
      [USER_MARIA]:    13,
      [USER_ROBERTO]:  17,
      [USER_SOFIA]:    20,
      [USER_DIEGO]:    32,
    };

    let recentCiCount = 0;
    for (const kr of activeKRs) {
      const owner           = kr.owner || OWNER;
      const daysAgo         = ownerLastCheckinDays[owner] ?? 7;
      const lastCheckinDate = new Date(SEED_TODAY.getTime() - daysAgo * 24 * 60 * 60 * 1000);

      // Historical weekly check-ins — oldest first, skip any newer than the target
      for (let week = 8; week >= 2; week--) {
        const checked_at = new Date(SEED_TODAY.getTime() - week * 7 * 24 * 60 * 60 * 1000);
        if (checked_at >= lastCheckinDate) continue;

        const ratio    = (9 - week) / 8;
        const basePct  = kr.atRisk ? 0.22 + ratio * 0.08 : 0.40 + ratio * 0.28;
        let cv;
        if (kr.type === 'INCREASE' || kr.type === 'ACHIEVE') {
          cv = Number(kr.start) + (Number(kr.target) - Number(kr.start)) * basePct;
        } else if (kr.type === 'DECREASE') {
          cv = Number(kr.start) - (Number(kr.start) - Number(kr.target)) * basePct;
        } else {
          const drift = (Number(kr.target) > 0 ? Number(kr.target) : 1) * 0.015 * (week % 2 === 0 ? 1 : -1);
          cv = Number(kr.target) + drift;
        }
        cv = Math.round(cv * 10) / 10;
        const confidence = Math.min(1.0, 0.60 + ratio * 0.32);
        const mood       = week <= 2 ? 'GREAT' : week <= 5 ? 'GOOD' : 'NEUTRAL';
        await client.query(
          `INSERT INTO check_ins (id, kr_id, user_id, checked_at, current_value, confidence, notes, mood)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [id(), kr.id, owner, checked_at, cv, confidence, 'Seguimiento semanal', mood],
        );
        recentCiCount++;
      }

      // Final check-in at the target date — sets last_checkin_at for commitment ranking
      const finalRatio = 0.92;
      let finalCv;
      if (kr.type === 'INCREASE' || kr.type === 'ACHIEVE') {
        finalCv = Number(kr.start) + (Number(kr.target) - Number(kr.start)) * finalRatio;
      } else if (kr.type === 'DECREASE') {
        finalCv = Number(kr.start) - (Number(kr.start) - Number(kr.target)) * finalRatio;
      } else {
        finalCv = Number(kr.target);
      }
      finalCv = Math.round(finalCv * 10) / 10;
      await client.query(
        `INSERT INTO check_ins (id, kr_id, user_id, checked_at, current_value, confidence, notes, mood)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
        [id(), kr.id, owner, lastCheckinDate, finalCv, kr.atRisk ? 0.70 : 0.85, 'Seguimiento semanal', 'GOOD'],
      );
      recentCiCount++;
    }
    console.log(`✓ ${recentCiCount} check-ins recientes agregados (últimas 8 semanas)`);

    // ── 15. Iniciativas ───────────────────────────────────────────────────────
    const initiatives = [
      // 2023
      { title: 'Desarrollo app móvil Cooprogreso v1.0',         cycle: CYC_2023, team: TEAM_TI,  owner: USER_CARLOS,  status: 'DONE',        progress: 100, start: '2023-01-15', due: '2023-06-30' },
      { title: 'Rediseño de procesos de crédito digital',        cycle: CYC_2023, team: TEAM_TI,  owner: USER_CARLOS,  status: 'DONE',        progress: 100, start: '2023-03-01', due: '2023-09-30' },
      { title: 'Programa de capacitación digital masiva',        cycle: CYC_2023, team: null,     owner: OWNER,        status: 'DONE',        progress: 100, start: '2023-02-01', due: '2023-11-30' },
      { title: 'Rediseño journey atención presencial',           cycle: CYC_2023, team: TEAM_EXP, owner: USER_MARIA,   status: 'DONE',        progress: 100, start: '2023-04-01', due: '2023-12-31' },
      // 2024
      { title: 'Plataforma Open Banking API',                    cycle: CYC_2024, team: TEAM_TI,  owner: USER_CARLOS,  status: 'DONE',        progress: 100, start: '2024-01-15', due: '2024-06-30' },
      { title: 'Motor de scoring crediticio con IA',             cycle: CYC_2024, team: TEAM_FIN, owner: USER_ROBERTO, status: 'DONE',        progress: 100, start: '2024-02-01', due: '2024-08-31' },
      { title: 'Programa de lealtad y referidos digitales',      cycle: CYC_2024, team: TEAM_EXP, owner: USER_MARIA,   status: 'DONE',        progress: 100, start: '2024-03-01', due: '2024-10-31' },
      { title: 'Automatización de 12 procesos manuales',         cycle: CYC_2024, team: TEAM_OPS, owner: USER_DIEGO,   status: 'DONE',        progress: 100, start: '2024-01-15', due: '2024-12-31' },
      // 2025 en progreso
      { title: 'Migración core bancario a AWS',                  cycle: CYC_2025, team: TEAM_TI,  owner: USER_CARLOS,  status: 'IN_PROGRESS', progress: 35,  start: '2025-01-15', due: '2025-10-31' },
      { title: 'Implementación chatbot IA para socios',          cycle: CYC_2025, team: TEAM_TI,  owner: USER_CARLOS,  status: 'IN_PROGRESS', progress: 55,  start: '2025-02-01', due: '2025-07-31' },
      { title: 'Certificación ISO 27001',                        cycle: CYC_2025, team: null,     owner: USER_CARLOS,  status: 'IN_PROGRESS', progress: 40,  start: '2025-01-15', due: '2025-11-30' },
      { title: 'Programa de bienestar y retención del talento',  cycle: CYC_2025, team: null,     owner: OWNER,        status: 'IN_PROGRESS', progress: 60,  start: '2025-01-15', due: '2025-09-30' },
      { title: 'Sistema de alertas tempranas de morosidad',      cycle: CYC_2025, team: TEAM_FIN, owner: USER_ROBERTO, status: 'IN_PROGRESS', progress: 70,  start: '2025-02-01', due: '2025-06-30' },
      { title: 'Integración WhatsApp Business + omnicanalidad',  cycle: CYC_2025, team: TEAM_EXP, owner: USER_MARIA,   status: 'TODO',        progress: 10,  start: '2025-05-01', due: '2025-09-30' },
    ];

    const initIds = [];
    for (const ini of initiatives) {
      const initId = id();
      initIds.push(initId);
      await client.query(`
        INSERT INTO initiatives (id, organization_id, cycle_id, team_id, owner_id, title, status, progress, start_date, due_date, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
      `, [initId, ORG_ID, ini.cycle, ini.team, ini.owner, ini.title, ini.status, ini.progress, ini.start, ini.due, OWNER]);
    }
    console.log(`✓ ${initiatives.length} iniciativas creadas`);

    // ── 16. Hitos de iniciativas activas ─────────────────────────────────────
    const milestones2025 = [
      // Migración AWS (index 8)
      { ini: initIds[8],  title: 'Contrato cloud firmado con AWS',                  due: '2025-02-15', status: 'COMPLETED' },
      { ini: initIds[8],  title: 'Arquitectura cloud-native definida y aprobada',   due: '2025-03-31', status: 'COMPLETED' },
      { ini: initIds[8],  title: 'Migración módulo de autenticación',               due: '2025-05-31', status: 'COMPLETED' },
      { ini: initIds[8],  title: 'Migración módulo de cuentas',                     due: '2025-07-31', status: 'PENDING'   },
      { ini: initIds[8],  title: 'Migración módulo de créditos',                    due: '2025-09-30', status: 'PENDING'   },
      // Chatbot IA (index 9)
      { ini: initIds[9],  title: 'Selección de plataforma IA y firma de contrato',  due: '2025-02-28', status: 'COMPLETED' },
      { ini: initIds[9],  title: 'Entrenamiento modelo con FAQs corporativas',       due: '2025-04-30', status: 'COMPLETED' },
      { ini: initIds[9],  title: 'Pruebas piloto con 500 socios voluntarios',        due: '2025-06-30', status: 'COMPLETED' },
      { ini: initIds[9],  title: 'Lanzamiento chatbot en producción',               due: '2025-07-31', status: 'PENDING'   },
      // ISO 27001 (index 10)
      { ini: initIds[10], title: 'Diagnóstico de brechas ISO 27001 completado',     due: '2025-02-28', status: 'COMPLETED' },
      { ini: initIds[10], title: 'Plan de remediación implementado',                due: '2025-05-31', status: 'COMPLETED' },
      { ini: initIds[10], title: 'Auditoría interna de certificación',              due: '2025-08-31', status: 'PENDING'   },
      { ini: initIds[10], title: 'Auditoría externa y emisión de certificado',      due: '2025-11-30', status: 'PENDING'   },
    ];
    for (let i = 0; i < milestones2025.length; i++) {
      const m = milestones2025[i];
      await client.query(`
        INSERT INTO milestones (id, initiative_id, title, status, due_date, sort_order, completed_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `, [
        id(), m.ini, m.title, m.status, m.due, i,
        m.status === 'COMPLETED' ? new Date(m.due) : null,
      ]);
    }
    console.log(`✓ ${milestones2025.length} hitos de iniciativas 2025 creados`);

    // ── 17. Vínculos initiative → KR (traceabilidad completa) ───────────────────
    const findKR = (frag) => allKRs.find(k => k.title.includes(frag))?.id;

    // 2023 KRs
    const KR_APP_USERS       = findKR('Crecer usuarios app móvil de 1,200');
    const KR_APP_LAUNCH      = findKR('Lanzar app iOS y Android');
    const KR_ATENCION_PRES   = findKR('Reducir tiempo promedio de atención presencial');
    const KR_CREDITO_TIEMPO  = findKR('Reducir tiempo de aprobación de crédito');
    const KR_DIGITALIZAR_80  = findKR('Digitalizar el 80%');
    const KR_CAPACITAR_100   = findKR('Capacitar 100% del equipo');
    const KR_ONBOARDING      = findKR('Reducir tiempo de onboarding');
    const KR_PROTOCOLO       = findKR('Implementar nuevo protocolo de atención');
    // 2024 KRs
    const KR_OPEN_BANKING    = findKR('Integrar 5 partners');
    const KR_AUTOMATIZAR_12  = findKR('Automatizar 12 procesos');
    const KR_SCORING         = findKR('Implementar modelo de scoring');
    const KR_REFERIDOS       = findKR('Lanzar programa de referidos');
    const KR_RETIRO          = findKR('Reducir tasa de retiro');
    const KR_COSTO_TX        = findKR('Reducir costo operativo por transacción');
    // 2025 KRs
    const KR_MIGRATE_MODULES = findKR('Migrar 3 módulos');
    const KR_DEPLOY_TIME     = findKR('tiempo de despliegue');
    const KR_MORA_PYME       = findKR('mora en segmento PYME');
    const KR_ALERTAS         = findKR('alertas tempranas de morosidad');
    const KR_CHATBOT         = findKR('chatbot IA');
    const KR_WHATSAPP        = findKR('WhatsApp Business');
    const KR_ISO             = findKR('ISO 27001');
    const KR_ROTACION        = findKR('rotación de personal');
    const KR_CANALES         = findKR('canales de atención');

    const ikrLinks = [
      // 2023: App móvil (initIds[0])
      [initIds[0],  KR_APP_USERS],
      [initIds[0],  KR_APP_LAUNCH],
      // 2023: Crédito digital (initIds[1])
      [initIds[1],  KR_CREDITO_TIEMPO],
      [initIds[1],  KR_DIGITALIZAR_80],
      // 2023: Capacitación digital (initIds[2])
      [initIds[2],  KR_CAPACITAR_100],
      [initIds[2],  KR_ONBOARDING],
      // 2023: Journey atención (initIds[3])
      [initIds[3],  KR_ATENCION_PRES],
      [initIds[3],  KR_PROTOCOLO],
      // 2024: Open Banking (initIds[4])
      [initIds[4],  KR_OPEN_BANKING],
      // 2024: Scoring IA (initIds[5])
      [initIds[5],  KR_SCORING],
      [initIds[5],  KR_AUTOMATIZAR_12],
      // 2024: Lealtad y referidos (initIds[6])
      [initIds[6],  KR_REFERIDOS],
      [initIds[6],  KR_RETIRO],
      // 2024: Automatización procesos (initIds[7])
      [initIds[7],  KR_AUTOMATIZAR_12],
      [initIds[7],  KR_COSTO_TX],
      // 2025 (initIds[8-13])
      [initIds[8],  KR_MIGRATE_MODULES],
      [initIds[8],  KR_DEPLOY_TIME],
      [initIds[9],  KR_CHATBOT],
      [initIds[9],  KR_WHATSAPP],
      [initIds[10], KR_ISO],
      [initIds[11], KR_ROTACION],
      [initIds[12], KR_ALERTAS],
      [initIds[12], KR_MORA_PYME],
      [initIds[13], KR_WHATSAPP],
      [initIds[13], KR_CANALES],
    ].filter(([a, b]) => a && b);

    for (const [ini_id, kr_id] of ikrLinks) {
      await client.query(`INSERT INTO initiative_key_results (initiative_id, kr_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [ini_id, kr_id]);
    }
    console.log(`✓ ${ikrLinks.length} vínculos initiative→KR creados`);

    // ── 18. Objective Alignments (cross-cycle: trimestral → anual) ────────────
    // Quarterly 2025 objectives aligned to annual 2025 objectives
    const ANNUAL_2025_OBJS = await client.query(`
      SELECT o.id, o.title FROM objectives o JOIN cycles c ON o.cycle_id=c.id
      WHERE o.organization_id=$1 AND c.name='Año 2025' AND o.level='COMPANY'
      ORDER BY o.created_at
    `, [ORG_ID]);
    // [0]=Liderar digital, [1]=Sostenibilidad financiera, [2]=Experiencia socios, [3]=Organización futuro
    const A25 = ANNUAL_2025_OBJS.rows;

    const alignments = [];
    if (A25.length >= 4) {
      // Q1 2025: "Migrar módulo core" → Liderar digital; "Asistente IA" → Liderar digital
      alignments.push([quarterlyObjIds[`${CYC_Q1_25}-1`], A25[0].id]);
      alignments.push([quarterlyObjIds[`${CYC_Q1_25}-2`], A25[0].id]);
      // Q2 2025: "30,000 usuarios" → Liderar digital; "Open Banking" → Liderar digital
      alignments.push([quarterlyObjIds[`${CYC_Q2_25}-1`], A25[0].id]);
      alignments.push([quarterlyObjIds[`${CYC_Q2_25}-2`], A25[0].id]);
      // Q3 2025: "Completar migración" → Liderar digital; "NPS 75" → Experiencia socios
      alignments.push([quarterlyObjIds[`${CYC_Q3_25}-1`], A25[0].id]);
      alignments.push([quarterlyObjIds[`${CYC_Q3_25}-2`], A25[2].id]);
    }

    // Also align 2023/2024 quarterly to annual for history
    const ANN23 = await client.query(`SELECT o.id, o.title FROM objectives o JOIN cycles c ON o.cycle_id=c.id WHERE o.organization_id=$1 AND c.name='Año 2023' AND o.level='COMPANY' ORDER BY o.created_at`, [ORG_ID]);
    const ANN24 = await client.query(`SELECT o.id, o.title FROM objectives o JOIN cycles c ON o.cycle_id=c.id WHERE o.organization_id=$1 AND c.name='Año 2024' AND o.level='COMPANY' ORDER BY o.created_at`, [ORG_ID]);

    const quarterMap23 = [[CYC_Q1_23,0],[CYC_Q2_23,0],[CYC_Q3_23,1],[CYC_Q4_23,2]];
    const quarterMap24 = [[CYC_Q1_24,0],[CYC_Q2_24,1],[CYC_Q3_24,0],[CYC_Q4_24,2]];

    for (const [cycId, annIdx] of quarterMap23) {
      if (ANN23.rows[annIdx]) {
        alignments.push([quarterlyObjIds[`${cycId}-1`], ANN23.rows[annIdx].id]);
        alignments.push([quarterlyObjIds[`${cycId}-2`], ANN23.rows[annIdx].id]);
      }
    }
    for (const [cycId, annIdx] of quarterMap24) {
      if (ANN24.rows[annIdx]) {
        alignments.push([quarterlyObjIds[`${cycId}-1`], ANN24.rows[annIdx].id]);
        alignments.push([quarterlyObjIds[`${cycId}-2`], ANN24.rows[annIdx].id]);
      }
    }

    for (const [src, tgt] of alignments) {
      if (src && tgt) await client.query(`INSERT INTO objective_alignments (source_id, target_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`, [src, tgt]);
    }
    console.log(`✓ ${alignments.length} alineaciones objetivo→objetivo creadas`);

    // ── 19. Sprint Cycles (Q3 2025) ────────────────────────────────────────────
    const SP1 = id(), SP2 = id(), SP3 = id(), SP4 = id();

    const sprints = [
      { id: SP1, team: TEAM_TI,  name: 'Sprint 1 — Q3 2025', goal: 'Infraestructura cloud base y pipeline CI/CD operativo',           status: 'COMPLETED', start: '2025-07-01', end: '2025-07-13', planned: 24, actual: 22 },
      { id: SP2, team: TEAM_TI,  name: 'Sprint 2 — Q3 2025', goal: 'Migración módulo Auth a ECS y entrenamiento chatbot completado',  status: 'COMPLETED', start: '2025-07-14', end: '2025-07-27', planned: 24, actual: 26 },
      { id: SP3, team: TEAM_TI,  name: 'Sprint 3 — Q3 2025', goal: 'Integración WhatsApp Business y smoke tests de Auth en AWS',      status: 'ACTIVE',    start: '2025-07-28', end: '2025-08-10', planned: 26, actual: null },
      { id: SP4, team: TEAM_TI,  name: 'Sprint 4 — Q3 2025', goal: 'Launch chatbot en producción (feature flag) y monitoreo cloud',  status: 'PLANNING',  start: '2025-08-11', end: '2025-08-24', planned: 24, actual: null },
    ];
    const SP_FIN1 = id(), SP_FIN2 = id();
    const sprintsFin = [
      { id: SP_FIN1, team: TEAM_FIN, name: 'Sprint 1 — Q3 2025 Finanzas', goal: 'Modelo predictivo de riesgo validado en producción',            status: 'COMPLETED', start: '2025-07-01', end: '2025-07-27', planned: 18, actual: 20 },
      { id: SP_FIN2, team: TEAM_FIN, name: 'Sprint 2 — Q3 2025 Finanzas', goal: 'Dashboard de alertas y CRM integración completada',            status: 'ACTIVE',    start: '2025-07-28', end: '2025-08-24', planned: 21, actual: null },
    ];

    for (const s of [...sprints, ...sprintsFin]) {
      await client.query(`
        INSERT INTO sprint_cycles (id, organization_id, cycle_id, team_id, name, goal, status, start_date, end_date, planned_velocity, actual_velocity, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
      `, [s.id, ORG_ID, CYC_Q3_25, s.team, s.name, s.goal, s.status, s.start, s.end, s.planned, s.actual, OWNER]);
    }
    console.log(`✓ ${sprints.length + sprintsFin.length} sprints creados`);

    // Sprint goal KRs
    const sgkLinks = [
      [SP1, KR_MIGRATE_MODULES, 30],
      [SP2, KR_MIGRATE_MODULES, 30],
      [SP2, KR_CHATBOT, 20],
      [SP3, KR_MIGRATE_MODULES, 30],
      [SP3, KR_WHATSAPP, 50],
      [SP4, KR_CHATBOT, 60],
      [SP_FIN1, KR_ALERTAS, 50],
      [SP_FIN2, KR_ALERTAS, 50],
      [SP_FIN2, KR_MORA_PYME, 30],
    ].filter(([,kr]) => kr);
    for (const [sp, kr, pct] of sgkLinks) {
      await client.query(`INSERT INTO sprint_goal_krs (sprint_id, kr_id, expected_contribution) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [sp, kr, pct]);
    }
    console.log(`✓ ${sgkLinks.length} sprint→KR goal links creados`);

    // ── 20. Backlog Items (EPIC → FEATURE → STORY) ────────────────────────────
    let biCount = 0;
    async function insertBI(data) {
      const biId = id();
      await client.query(`
        INSERT INTO backlog_items (id, organization_id, type, title, description, status, priority, story_points, parent_id, initiative_id, sprint_id, assignee_id, cycle_id, created_by)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
      `, [biId, ORG_ID, data.type, data.title, data.desc || null, data.status || 'OPEN', data.priority || 'MEDIUM', data.pts || null, data.parent || null, data.initiative || null, data.sprint || null, data.assignee || null, data.cycle || null, OWNER]);
      biCount++;
      return biId;
    }

    // ─── HISTORIAL DONE: App móvil 2023 ───────────────────────────────────────
    const EP_APP = await insertBI({ type:'EPIC', title:'App Móvil Cooprogreso v1.0', status:'DONE', priority:'HIGH', initiative: initIds[0], cycle: CYC_2023, desc:'Desarrollo y lanzamiento de la primera app móvil para socios' });
    const FT_APP1 = await insertBI({ type:'FEATURE', title:'Onboarding y autenticación de socios', status:'DONE', priority:'HIGH', pts:21, parent: EP_APP, initiative: initIds[0] });
    await insertBI({ type:'STORY', title:'Como socio quiero registrarme con mi cédula y selfie', status:'DONE', priority:'HIGH', pts:8, parent: FT_APP1, initiative: initIds[0] });
    await insertBI({ type:'STORY', title:'Como socio quiero autenticarme con huella o PIN', status:'DONE', priority:'HIGH', pts:5, parent: FT_APP1, initiative: initIds[0] });
    await insertBI({ type:'STORY', title:'Como socio quiero recuperar mi contraseña por SMS', status:'DONE', priority:'MEDIUM', pts:3, parent: FT_APP1, initiative: initIds[0] });
    const FT_APP2 = await insertBI({ type:'FEATURE', title:'Consultas de saldo y movimientos', status:'DONE', priority:'HIGH', pts:13, parent: EP_APP, initiative: initIds[0] });
    await insertBI({ type:'STORY', title:'Como socio quiero ver mis saldos en tiempo real', status:'DONE', priority:'HIGH', pts:5, parent: FT_APP2, initiative: initIds[0] });
    await insertBI({ type:'STORY', title:'Como socio quiero ver mis últimos 30 movimientos', status:'DONE', priority:'HIGH', pts:5, parent: FT_APP2, initiative: initIds[0] });
    await insertBI({ type:'STORY', title:'Como socio quiero filtrar movimientos por fecha y tipo', status:'DONE', priority:'MEDIUM', pts:3, parent: FT_APP2, initiative: initIds[0] });

    // ─── HISTORIAL DONE: Open Banking 2024 ────────────────────────────────────
    const EP_OB = await insertBI({ type:'EPIC', title:'Plataforma Open Banking API v1.0', status:'DONE', priority:'HIGH', initiative: initIds[4], cycle: CYC_2024, desc:'Integración con partners financieros vía API REST' });
    const FT_OB1 = await insertBI({ type:'FEATURE', title:'Gateway API y seguridad OAuth2', status:'DONE', priority:'HIGH', pts:34, parent: EP_OB, initiative: initIds[4] });
    await insertBI({ type:'STORY', title:'Como partner quiero autenticarme con OAuth2/PKCE', status:'DONE', priority:'HIGH', pts:13, parent: FT_OB1, initiative: initIds[4] });
    await insertBI({ type:'STORY', title:'Como admin quiero gestionar tokens de acceso de partners', status:'DONE', priority:'HIGH', pts:8, parent: FT_OB1, initiative: initIds[4] });
    await insertBI({ type:'STORY', title:'Como partner quiero ver el catálogo de APIs disponibles', status:'DONE', priority:'MEDIUM', pts:5, parent: FT_OB1, initiative: initIds[4] });
    const FT_OB2 = await insertBI({ type:'FEATURE', title:'Endpoints de consulta de saldo y transferencias', status:'DONE', priority:'HIGH', pts:21, parent: EP_OB, initiative: initIds[4] });
    await insertBI({ type:'STORY', title:'Como partner quiero GET /accounts/{id}/balance con latencia < 200ms', status:'DONE', priority:'HIGH', pts:8, parent: FT_OB2, initiative: initIds[4] });
    await insertBI({ type:'STORY', title:'Como partner quiero POST /transfers para pagos instantáneos', status:'DONE', priority:'HIGH', pts:8, parent: FT_OB2, initiative: initIds[4] });
    await insertBI({ type:'STORY', title:'Como partner quiero webhooks de confirmación de transacciones', status:'DONE', priority:'MEDIUM', pts:5, parent: FT_OB2, initiative: initIds[4] });

    // ─── ACTIVO: Migración core bancario a AWS ─────────────────────────────────
    const EP_AWS1 = await insertBI({ type:'EPIC', title:'Infraestructura Cloud AWS (Base)', status:'IN_PROGRESS', priority:'HIGH', initiative: initIds[8], cycle: CYC_2025, desc:'Setup de infraestructura AWS: VPC, ECS, RDS, secrets' });
    const FT_AWS1 = await insertBI({ type:'FEATURE', title:'AWS Base Infrastructure (VPC / ECS / RDS)', status:'DONE', priority:'HIGH', pts:24, parent: EP_AWS1, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como DevOps quiero VPC con subnets privadas y públicas configurada', status:'DONE', priority:'HIGH', pts:8, parent: FT_AWS1, sprint: SP1, assignee: USER_CARLOS, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como DevOps quiero ECS cluster con Fargate y auto-scaling configurado', status:'DONE', priority:'HIGH', pts:8, parent: FT_AWS1, sprint: SP1, assignee: USER_CARLOS, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como DBA quiero RDS PostgreSQL con réplica de lectura operativa', status:'DONE', priority:'HIGH', pts:5, parent: FT_AWS1, sprint: SP2, assignee: USER_DIEGO, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como DevSecOps quiero AWS Secrets Manager con rotación automática', status:'DONE', priority:'MEDIUM', pts:3, parent: FT_AWS1, sprint: SP2, assignee: USER_CARLOS, initiative: initIds[8] });

    const FT_AWS2 = await insertBI({ type:'FEATURE', title:'Pipeline CI/CD automatizado', status:'IN_PROGRESS', priority:'HIGH', pts:21, parent: EP_AWS1, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como developer quiero GitHub Actions que despliega a AWS en < 10 min', status:'DONE', priority:'HIGH', pts:8, parent: FT_AWS2, sprint: SP2, assignee: USER_CARLOS, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como developer quiero rollback automático si health check falla', status:'IN_PROGRESS', priority:'HIGH', pts:8, parent: FT_AWS2, sprint: SP3, assignee: USER_CARLOS, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como QA quiero smoke tests automáticos post-deploy en < 3 min', status:'OPEN', priority:'MEDIUM', pts:5, parent: FT_AWS2, sprint: SP3, assignee: USER_VALENTINA, initiative: initIds[8] });

    const EP_AWS2 = await insertBI({ type:'EPIC', title:'Migración módulo de autenticación', status:'IN_PROGRESS', priority:'HIGH', initiative: initIds[8], cycle: CYC_2025, desc:'Containerizar y migrar el servicio de auth al ECS de AWS' });
    const FT_AUTH = await insertBI({ type:'FEATURE', title:'Servicio Auth containerizado en ECS Fargate', status:'IN_PROGRESS', priority:'HIGH', pts:26, parent: EP_AWS2, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como ingeniero quiero imagen Docker del servicio auth optimizada (< 150MB)', status:'DONE', priority:'HIGH', pts:5, parent: FT_AUTH, sprint: SP1, assignee: USER_CARLOS, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como ingeniero quiero task definition ECS con variables de entorno securizadas', status:'IN_PROGRESS', priority:'HIGH', pts:8, parent: FT_AUTH, sprint: SP3, assignee: USER_CARLOS, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como QA quiero pruebas de carga: 1000 req/s con latencia < 100ms en AWS', status:'OPEN', priority:'HIGH', pts:8, parent: FT_AUTH, sprint: SP4, assignee: USER_VALENTINA, initiative: initIds[8] });
    await insertBI({ type:'STORY', title:'Como SRE quiero CloudWatch dashboards con alertas de auth service', status:'OPEN', priority:'MEDIUM', pts:5, parent: FT_AUTH, sprint: SP4, assignee: USER_CARLOS, initiative: initIds[8] });

    // ─── ACTIVO: Chatbot IA para socios ───────────────────────────────────────
    const EP_CHAT1 = await insertBI({ type:'EPIC', title:'Modelo NLP y entrenamiento con datos Cooprogreso', status:'DONE', priority:'HIGH', initiative: initIds[9], cycle: CYC_2025, desc:'Construcción y validación del modelo de lenguaje para el chatbot' });
    const FT_CHAT1 = await insertBI({ type:'FEATURE', title:'Dataset curation y fine-tuning del modelo', status:'DONE', priority:'HIGH', pts:21, parent: EP_CHAT1, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como data engineer quiero recolectar y etiquetar 500 FAQs históricas de atención', status:'DONE', priority:'HIGH', pts:5, parent: FT_CHAT1, sprint: SP1, assignee: USER_SOFIA, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como ML engineer quiero fine-tunear Claude API con prompts de cooperativa', status:'DONE', priority:'HIGH', pts:8, parent: FT_CHAT1, sprint: SP1, assignee: USER_CARLOS, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como QA quiero validar que el modelo alcanza ≥ 85% de precisión en test set', status:'DONE', priority:'HIGH', pts:5, parent: FT_CHAT1, sprint: SP2, assignee: USER_VALENTINA, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como PM quiero reporte de los 20 temas con menor precisión para mejora', status:'DONE', priority:'MEDIUM', pts:3, parent: FT_CHAT1, sprint: SP2, assignee: USER_SOFIA, initiative: initIds[9] });

    const FT_CHAT2 = await insertBI({ type:'FEATURE', title:'Integración WhatsApp Business y canal web', status:'IN_PROGRESS', priority:'HIGH', pts:26, parent: EP_CHAT1, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como DevOps quiero WhatsApp Business API configurado con número oficial', status:'IN_PROGRESS', priority:'HIGH', pts:8, parent: FT_CHAT2, sprint: SP3, assignee: USER_CARLOS, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como developer quiero webhook que enruta mensajes WhatsApp al motor NLP', status:'OPEN', priority:'HIGH', pts:8, parent: FT_CHAT2, sprint: SP3, assignee: USER_CARLOS, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como QA quiero pruebas E2E: socio envía mensaje → chatbot responde en < 3s', status:'OPEN', priority:'HIGH', pts:5, parent: FT_CHAT2, sprint: SP3, assignee: USER_VALENTINA, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como socio quiero que el chatbot transfiera a humano cuando no puede resolver', status:'OPEN', priority:'MEDIUM', pts:5, parent: FT_CHAT2, sprint: SP4, assignee: USER_SOFIA, initiative: initIds[9] });

    const EP_CHAT2 = await insertBI({ type:'EPIC', title:'Despliegue en producción y monitoreo del chatbot', status:'OPEN', priority:'HIGH', initiative: initIds[9], cycle: CYC_2025, desc:'Launch controlado y métricas de calidad del chatbot' });
    const FT_CHAT3 = await insertBI({ type:'FEATURE', title:'Launch controlado con feature flags', status:'OPEN', priority:'HIGH', pts:16, parent: EP_CHAT2, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como PM quiero activar chatbot para el 10% de socios digitales con feature flag', status:'OPEN', priority:'HIGH', pts:5, parent: FT_CHAT3, sprint: SP4, assignee: USER_CARLOS, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como analista quiero dashboard en tiempo real: % resolución, CSAT, escalados', status:'OPEN', priority:'HIGH', pts:8, parent: FT_CHAT3, sprint: SP4, assignee: USER_SOFIA, initiative: initIds[9] });
    await insertBI({ type:'STORY', title:'Como PM quiero activación completa para todos los socios tras 2 semanas piloto', status:'OPEN', priority:'MEDIUM', pts:3, parent: FT_CHAT3, initiative: initIds[9] });

    // ─── ACTIVO: Sistema de alertas de morosidad ──────────────────────────────
    const EP_ALERT = await insertBI({ type:'EPIC', title:'Motor de scoring de riesgo crediticio predictivo', status:'IN_PROGRESS', priority:'HIGH', initiative: initIds[12], cycle: CYC_2025, desc:'Modelo predictivo de comportamiento de pago por segmento' });
    const FT_ALERT1 = await insertBI({ type:'FEATURE', title:'Modelo de riesgo por segmento', status:'DONE', priority:'HIGH', pts:21, parent: EP_ALERT, initiative: initIds[12] });
    await insertBI({ type:'STORY', title:'Como analista de riesgo quiero umbrales de morosidad configurables por segmento', status:'DONE', priority:'HIGH', pts:5, parent: FT_ALERT1, sprint: SP_FIN1, assignee: USER_ROBERTO, initiative: initIds[12] });
    await insertBI({ type:'STORY', title:'Como ML engineer quiero modelo de scoring con comportamiento últimos 12 meses', status:'DONE', priority:'HIGH', pts:8, parent: FT_ALERT1, sprint: SP_FIN1, assignee: USER_ROBERTO, initiative: initIds[12] });
    await insertBI({ type:'STORY', title:'Como analista quiero validación del modelo: AUC ≥ 0.80 en holdout 2024', status:'DONE', priority:'HIGH', pts:5, parent: FT_ALERT1, sprint: SP_FIN1, assignee: USER_SOFIA, initiative: initIds[12] });
    await insertBI({ type:'STORY', title:'Como gerente quiero reporte mensual de socios en categoría de riesgo alto', status:'DONE', priority:'MEDIUM', pts:3, parent: FT_ALERT1, sprint: SP_FIN1, assignee: USER_SOFIA, initiative: initIds[12] });

    const FT_ALERT2 = await insertBI({ type:'FEATURE', title:'Notificaciones automáticas a gestores de cobranza', status:'IN_PROGRESS', priority:'HIGH', pts:18, parent: EP_ALERT, initiative: initIds[12] });
    await insertBI({ type:'STORY', title:'Como gestor quiero email automático cuando un socio sube a riesgo alto', status:'DONE', priority:'HIGH', pts:5, parent: FT_ALERT2, sprint: SP_FIN1, assignee: USER_ROBERTO, initiative: initIds[12] });
    await insertBI({ type:'STORY', title:'Como gestor quiero dashboard de socios en riesgo con filtros por zona y producto', status:'IN_PROGRESS', priority:'HIGH', pts:8, parent: FT_ALERT2, sprint: SP_FIN2, assignee: USER_SOFIA, initiative: initIds[12] });
    await insertBI({ type:'STORY', title:'Como gerente quiero integrar alertas con el CRM para registro de gestión', status:'OPEN', priority:'HIGH', pts:5, parent: FT_ALERT2, sprint: SP_FIN2, assignee: USER_ROBERTO, initiative: initIds[12] });

    // ─── ACTIVO: WhatsApp Business + Omnicanalidad ────────────────────────────
    const EP_WA = await insertBI({ type:'EPIC', title:'Canal WhatsApp Business para atención al socio', status:'OPEN', priority:'HIGH', initiative: initIds[13], cycle: CYC_2025, desc:'Habilitar WhatsApp como canal oficial de atención' });
    const FT_WA1 = await insertBI({ type:'FEATURE', title:'Setup y configuración del canal WhatsApp', status:'IN_PROGRESS', priority:'HIGH', pts:16, parent: EP_WA, initiative: initIds[13] });
    await insertBI({ type:'STORY', title:'Como admin quiero número de WhatsApp Business verificado y activo', status:'DONE', priority:'HIGH', pts:3, parent: FT_WA1, assignee: USER_MARIA, initiative: initIds[13] });
    await insertBI({ type:'STORY', title:'Como developer quiero webhooks configurados para mensajes entrantes/salientes', status:'IN_PROGRESS', priority:'HIGH', pts:8, parent: FT_WA1, assignee: USER_CARLOS, initiative: initIds[13] });
    await insertBI({ type:'STORY', title:'Como QA quiero pruebas con socios beta: respuesta < 5 segundos', status:'OPEN', priority:'HIGH', pts:5, parent: FT_WA1, assignee: USER_VALENTINA, initiative: initIds[13] });

    const FT_WA2 = await insertBI({ type:'FEATURE', title:'Integración con CRM y sistema de tickets', status:'OPEN', priority:'MEDIUM', pts:13, parent: EP_WA, initiative: initIds[13] });
    await insertBI({ type:'STORY', title:'Como gestor quiero ver conversaciones de WhatsApp en el CRM centralizado', status:'OPEN', priority:'HIGH', pts:8, parent: FT_WA2, assignee: USER_MARIA, initiative: initIds[13] });
    await insertBI({ type:'STORY', title:'Como socio quiero que mis tickets de WhatsApp queden en el historial unificado', status:'OPEN', priority:'MEDIUM', pts:5, parent: FT_WA2, assignee: USER_SOFIA, initiative: initIds[13] });

    console.log(`✓ ${biCount} backlog items creados (EPICs/FEATUREs/STORYs)`);

    // ─── Acuerdos ─────────────────────────────────────────────────────────────
    const AGR1 = id(), AGR2 = id(), AGR3 = id(), AGR4 = id();
    const agreements = [
      { id: AGR1, code: 'AGR-1', title: 'Activar scoring automático en el 85% de solicitudes de crédito',
        desc: 'Comité de Riesgos acordó que toda solicitud > $30,000 debe pasar por el modelo ML antes del comité de aprobación. Criterio: 85% de solicitudes procesadas automáticamente sin intervención manual.',
        source: 'Comité de Riesgos — Agosto 2025', date: '2025-08-20', due: '2025-09-30',
        status: 'IN_PROGRESS', priority: 'HIGH', cycle: CYC_Q3_25, owner: USER_ROBERTO },
      { id: AGR2, code: 'AGR-2', title: 'Publicar tablero de mora con datos del día anterior para la Dirección',
        desc: 'La Dirección General acordó que mora, recuperación y exposición por segmento estén disponibles en el dashboard con latencia máxima de 24 horas. El tablero debe ser accesible desde móvil.',
        source: 'Sesión Dirección General — Julio 2025', date: '2025-07-10', due: '2025-09-15',
        status: 'FULFILLED', priority: 'CRITICAL', cycle: CYC_Q3_25, owner: OWNER },
      { id: AGR3, code: 'AGR-3', title: 'Certificar 3 nuevos gestores de riesgo antes de cierre Q3',
        desc: 'RRHH y el área de Riesgo acordaron que los gestores en proceso de certificación deben completarla antes del cierre del ciclo para validar las métricas de talento del OKR.',
        source: 'Comité de Talento — Agosto 2025', date: '2025-08-05', due: '2025-09-25',
        status: 'IN_PROGRESS', priority: 'MEDIUM', cycle: CYC_Q3_25, owner: USER_MARIA },
      { id: AGR4, code: 'AGR-4', title: 'Habilitar WhatsApp Business como canal oficial de atención al socio',
        desc: 'La Dirección acordó lanzar el canal WhatsApp antes del cierre de año. Criterio: número verificado, webhooks activos y prueba con 50 socios beta con tiempo de respuesta < 5 segundos.',
        source: 'Sesión Dirección General — Septiembre 2025', date: '2025-09-03', due: '2025-11-30',
        status: 'PENDING', priority: 'HIGH', cycle: CYC_2025, owner: USER_CARLOS },
    ];
    for (const a of agreements) {
      await client.query(
        `INSERT INTO agreements (id,organization_id,cycle_id,code,title,description,source,agreement_date,due_date,status,priority,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [a.id, ORG_ID, a.cycle, a.code, a.title, a.desc, a.source, a.date, a.due, a.status, a.priority, a.owner],
      );
    }
    console.log(`✓ ${agreements.length} acuerdos creados`);

    // ─── Gobierno corporativo ─────────────────────────────────────────────────
    const GOV1 = id(), GOV2 = id(), GOV3 = id();
    const govBodies = [
      { id: GOV1, name: 'Consejo de Administración', type: 'CONSEJO',
        desc: 'Máximo órgano de gobierno de la cooperativa. Se reúne mensualmente para revisar avance estratégico, estados financieros y decisiones de alto impacto.', sort: 1 },
      { id: GOV2, name: 'Comité de Riesgos', type: 'COMITE',
        desc: 'Supervisa la gestión de riesgo crediticio, operativo y de liquidez. Reporta al Consejo de Administración con periodicidad mensual.', sort: 2 },
      { id: GOV3, name: 'Comité de Transformación Digital', type: 'COMITE',
        desc: 'Impulsa y supervisa los proyectos de digitalización. Revisa avance de la agenda digital quincenal con presencia de TI, Experiencia y Dirección.', sort: 3 },
    ];
    for (const g of govBodies) {
      await client.query(
        `INSERT INTO governance_bodies (id,org_id,name,type,description,sort_order,is_active) VALUES ($1,$2,$3,$4,$5,$6,true)`,
        [g.id, ORG_ID, g.name, g.type, g.desc, g.sort],
      );
    }
    console.log(`✓ ${govBodies.length} cuerpos de gobierno creados`);

    // ─── Programas de Transformación ──────────────────────────────────────────
    const PRG1 = id(), PRG2 = id();
    await client.query(
      `INSERT INTO transformation_programs (id,organization_id,created_by,title,description,start_year,end_year,status,vision_statement) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [PRG1, ORG_ID, OWNER,
       'Transformación Digital 2025–2027',
       'Digitalización integral del modelo de negocio: scoring automático, app móvil de nueva generación, canales digitales y cultura de datos.',
       2025, 2027, 'ACTIVE',
       'En 2027, Caja Cooprogreso procesa el 70% de sus operaciones en canales digitales con una experiencia de clase mundial para los socios.'],
    );
    await client.query(
      `INSERT INTO transformation_programs (id,organization_id,created_by,title,description,start_year,end_year,status,vision_statement) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [PRG2, ORG_ID, OWNER,
       'Excelencia en Riesgo y Gobernanza 2025–2026',
       'Fortalecimiento del marco de gestión de riesgo crediticio, operativo y regulatorio, con énfasis en scoring predictivo y cumplimiento normativo.',
       2025, 2026, 'ACTIVE',
       'En 2026, Caja Cooprogreso mantiene mora por debajo del 4% y opera con riesgo cuantificado en tiempo real.'],
    );
    // program_cycles
    const PC1 = id(), PC2 = id(), PC3 = id(), PC4 = id();
    const programCycles = [
      { id: PC1, prog: PRG1, cyc: CYC_Q3_25, label: 'Q3 2025', num: 2025,
        focus: ['Digital','Scoring','Canal Digital'], outcomes: 'Scoring automático operando en 85% de solicitudes. App móvil en beta. WhatsApp habilitado.' },
      { id: PC2, prog: PRG1, cyc: CYC_2025,  label: 'Año 2025', num: 2025,
        focus: ['Digital','Modelo de Negocio','Talento'], outcomes: '60% de operaciones en digital. 3 canales digitales activos. 8 gestores certificados en data.' },
      { id: PC3, prog: PRG2, cyc: CYC_Q3_25, label: 'Q3 2025', num: 2025,
        focus: ['Riesgo','Regulatorio'], outcomes: 'Mora Q3 por debajo del 4.5%. Observaciones CNBV atendidas.' },
      { id: PC4, prog: PRG2, cyc: CYC_2025,  label: 'Año 2025', num: 2025,
        focus: ['Gobernanza','Eficiencia','Riesgo'], outcomes: 'Mora anual por debajo del 4%. Dashboard de riesgo en tiempo real para la Dirección.' },
    ];
    for (const pc of programCycles) {
      await client.query(
        `INSERT INTO program_cycles (id,program_id,cycle_id,year_label,year_number,focus_areas,expected_outcomes) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [pc.id, pc.prog, pc.cyc, pc.label, pc.num, pc.focus, pc.outcomes],
      );
    }
    console.log('✓ 2 programas de transformación + 4 ciclos de programa creados');

    // ─── Delivery Programs ────────────────────────────────────────────────────
    const DLV1 = id(), DLV2 = id();
    await client.query(
      `INSERT INTO delivery_programs (id,organization_id,cycle_id,name,description,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [DLV1, ORG_ID, CYC_Q3_25,
       'Plataforma de Scoring y Recuperación Digital',
       'Scoring conductual ML, portal de auto-gestión de cartera y firma electrónica NOM-151. Meta: 85% de solicitudes procesadas automáticamente y mora Q3 por debajo del 4.5%.',
       'ACTIVE', OWNER],
    );
    await client.query(
      `INSERT INTO delivery_programs (id,organization_id,cycle_id,name,description,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [DLV2, ORG_ID, CYC_Q3_25,
       'App Móvil Socios v3 — Canal Digital',
       'Nueva versión con onboarding 100% digital, pagos NFC, apertura de productos y chatbot integrado. Meta: 10,000 descargas y 30% de operaciones en digital.',
       'ACTIVE', OWNER],
    );
    // Phases
    const PH1 = id(), PH2 = id(), PH3 = id(), PH4 = id(), PH5 = id(), PH6 = id();
    const phases = [
      { id: PH1, prog: DLV1, name: 'Diagnóstico y Arquitectura', desc: 'Mapeo del proceso de cobranza AS-IS, diseño de microservicios y definición de APIs con el core.', idx: 1, gate: 'Arquitectura aprobada por TI. APIs documentadas. Plan de migración firmado.', start: '2025-07-01', end: '2025-07-31', status: 'COMPLETED', owner: USER_CARLOS },
      { id: PH2, prog: DLV1, name: 'Desarrollo e Integración',   desc: 'Scoring conductual ML, portal de auto-gestión y módulo de firma electrónica NOM-151.', idx: 2, gate: 'Scoring en staging con precisión > 78%. Portal con 3 flujos. Firma NOM-151 certificada.', start: '2025-08-01', end: '2025-09-15', status: 'IN_PROGRESS', owner: USER_CARLOS },
      { id: PH3, prog: DLV1, name: 'Piloto y Lanzamiento',       desc: 'Piloto con 300 socios en mora temprana, capacitación a gestores y escalamiento completo.', idx: 3, gate: 'Piloto NPS > 60. Auto-gestión > 30%. Mora early reducida 0.5pp.', start: '2025-09-16', end: '2025-09-30', status: 'PENDING', owner: USER_ROBERTO },
      { id: PH4, prog: DLV2, name: 'Diseño UX y Prototipo',      desc: 'Research con 30 socios, flujos de onboarding digital y prototipo Figma validado.', idx: 1, gate: 'Prototipo aprobado por 80% de usuarios. Design system actualizado.', start: '2025-07-01', end: '2025-07-25', status: 'COMPLETED', owner: USER_MARIA },
      { id: PH5, prog: DLV2, name: 'Desarrollo y QA',            desc: 'Módulos: apertura de productos, pagos NFC, notificaciones push y chatbot integrado.', idx: 2, gate: 'App en beta con 200 socios. Crash rate < 0.1%. Carga inicial < 2s.', start: '2025-07-26', end: '2025-09-10', status: 'IN_PROGRESS', owner: USER_CARLOS },
      { id: PH6, prog: DLV2, name: 'Lanzamiento y Growth',       desc: 'Publicación en App Store y Google Play, campaña de activación y programa de referidos.', idx: 3, gate: '10,000 descargas. Rating > 4.2. 30% de operaciones en digital.', start: '2025-09-11', end: '2025-09-30', status: 'PENDING', owner: USER_MARIA },
    ];
    for (const ph of phases) {
      await client.query(
        `INSERT INTO delivery_phases (id,program_id,name,description,order_index,gate_criteria,target_start_date,target_end_date,status,owner_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [ph.id, ph.prog, ph.name, ph.desc, ph.idx, ph.gate, ph.start, ph.end, ph.status, ph.owner],
      );
    }
    // Deliverables
    const deliverables = [
      { phase: PH1, title: 'Mapa de proceso de cobranza AS-IS', criteria: 'Aprobado por Gerencia de Cobranza. 5 flujos mapeados.', owner: USER_ROBERTO, due: '2025-07-20', status: 'APPROVED' },
      { phase: PH1, title: 'Documento de arquitectura técnica',  criteria: 'Firmado por CTO. Sin observaciones de auditoría.', owner: USER_CARLOS, due: '2025-07-28', status: 'APPROVED' },
      { phase: PH2, title: 'Motor de scoring conductual v1',     criteria: 'Precisión > 78% en holdout. Integrado en staging.', owner: USER_CARLOS, due: '2025-08-31', status: 'IN_REVIEW' },
      { phase: PH2, title: 'Portal de auto-gestión socios mora', criteria: '3 flujos completos. Accesible en móvil. WCAG AA.', owner: USER_ROBERTO, due: '2025-09-10', status: 'IN_PROGRESS' },
      { phase: PH2, title: 'Módulo de firma electrónica NOM-151',criteria: 'Certificación obtenida. 10 reestructuras piloto firmadas.', owner: USER_CARLOS, due: '2025-09-15', status: 'BLOCKED' },
      { phase: PH4, title: 'Research con 30 socios (UX)',        criteria: 'Reporte de hallazgos. Top-5 fricciones priorizadas.', owner: USER_MARIA, due: '2025-07-15', status: 'APPROVED' },
      { phase: PH4, title: 'Prototipo alta fidelidad (Figma)',   criteria: 'NPS de prototipo > 60. Specs entregadas a TI.', owner: USER_MARIA, due: '2025-07-22', status: 'APPROVED' },
      { phase: PH5, title: 'Módulo de apertura de productos',    criteria: 'KYC automatizado aprobado por Compliance. 50 socios piloto.', owner: USER_CARLOS, due: '2025-08-31', status: 'IN_REVIEW' },
      { phase: PH5, title: 'Sistema de pagos NFC y QR',          criteria: 'Certificación switch. 10 comercios piloto. Transacción < 4s.', owner: USER_CARLOS, due: '2025-09-05', status: 'IN_PROGRESS' },
      { phase: PH5, title: 'Notificaciones push y alertas',      criteria: 'Entrega < 2s. Opt-in > 70% en beta. 0 falsos positivos.', owner: USER_SOFIA, due: '2025-09-10', status: 'IN_PROGRESS' },
    ];
    let delivCount = 0;
    for (const d of deliverables) {
      await client.query(
        `INSERT INTO deliverables (id,phase_id,organization_id,title,acceptance_criteria,owner_id,due_date,status,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id(), d.phase, ORG_ID, d.title, d.criteria, d.owner, d.due, d.status, OWNER],
      );
      delivCount++;
    }
    console.log(`✓ 2 delivery programs + 6 fases + ${delivCount} entregables creados`);

    // ─── Sector Assessment Sessions ───────────────────────────────────────────
    const SAS1 = id(), SAS2 = id();
    await client.query(
      `INSERT INTO sector_assessment_sessions (id,organization_id,name,period_label,status,calibrated_scores,ai_plan,created_by,session_documents) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [SAS1, ORG_ID, 'Diagnóstico Estratégico Q2 2025', 'Q2 2025', 'COMPLETED',
       JSON.stringify({ STRATEGIC_EXECUTION:5.5, GOVERNANCE_MATURITY:6.0, MARGIN_DEPENDENCY:4.5, DIGITAL_CAPABILITY:3.5, LEADERSHIP_TALENT:5.0, BUSINESS_MODEL:4.0, REGULATORY_PRESSURE:6.0, MEMBER_DIGITAL_DISCONNECT:3.0 }),
       JSON.stringify({ priority_areas:['DIGITAL_CAPABILITY','MEMBER_DIGITAL_DISCONNECT','BUSINESS_MODEL'], '90_day_actions':['Lanzar scoring automático en staging','Iniciar desarrollo App v3','Contratar Head of Digital'] }),
       OWNER,
       JSON.stringify([{ name:'Plan Estratégico 2025-2027.pdf', uploaded_at:'2025-06-10T10:00:00Z' },{ name:'Benchmarks cooperativas 2025.xlsx', uploaded_at:'2025-06-10T10:05:00Z' }])],
    );
    await client.query(
      `INSERT INTO sector_assessment_sessions (id,organization_id,name,period_label,status,calibrated_scores,ai_plan,created_by,session_documents) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [SAS2, ORG_ID, 'Seguimiento Estratégico Q3 2025', 'Q3 2025', 'OPEN',
       JSON.stringify({ STRATEGIC_EXECUTION:6.2, GOVERNANCE_MATURITY:6.5, MARGIN_DEPENDENCY:5.0, DIGITAL_CAPABILITY:5.5, LEADERSHIP_TALENT:5.5, BUSINESS_MODEL:5.0, REGULATORY_PRESSURE:6.0, MEMBER_DIGITAL_DISCONNECT:4.5 }),
       JSON.stringify({ priority_areas:['MARGIN_DEPENDENCY','STRATEGIC_EXECUTION','DIGITAL_CAPABILITY'], '90_day_actions':['Completar piloto scoring (300 socios)','Publicar App v3 en tiendas','Cerrar Q3 con mora < 4.5%'] }),
       OWNER,
       JSON.stringify([{ name:'Avance OKRs Q3 semana 10.pdf', uploaded_at:'2025-09-05T09:00:00Z' }])],
    );

    // Assessments + threat_scores
    const SA1 = id(), SA2 = id();
    const threats = ['STRATEGIC_EXECUTION','GOVERNANCE_MATURITY','MARGIN_DEPENDENCY','DIGITAL_CAPABILITY','LEADERSHIP_TALENT','BUSINESS_MODEL','REGULATORY_PRESSURE','MEMBER_DIGITAL_DISCONNECT'];
    // Q2 (baseline — scores bajos)
    const scoresQ2 = { STRATEGIC_EXECUTION:5.5, GOVERNANCE_MATURITY:6.0, MARGIN_DEPENDENCY:4.5, DIGITAL_CAPABILITY:3.5, LEADERSHIP_TALENT:5.0, BUSINESS_MODEL:4.0, REGULATORY_PRESSURE:6.0, MEMBER_DIGITAL_DISCONNECT:3.0 };
    const benchQ2  = { STRATEGIC_EXECUTION:'AT', GOVERNANCE_MATURITY:'AT', MARGIN_DEPENDENCY:'BELOW', DIGITAL_CAPABILITY:'BELOW', LEADERSHIP_TALENT:'AT', BUSINESS_MODEL:'BELOW', REGULATORY_PRESSURE:'ABOVE', MEMBER_DIGITAL_DISCONNECT:'BELOW' };
    const evidQ2   = {
      STRATEGIC_EXECUTION:'OKR Q2 cerrado con 71% de progreso. 3 de 5 objetivos ON_TRACK al inicio.',
      GOVERNANCE_MATURITY:'Consejo activo con sesiones mensuales. Comité de Riesgos con reportes trimestrales.',
      MARGIN_DEPENDENCY:'Margen financiero neto: 4.6%. Crédito de nómina concentra 68% de cartera. Sensibilidad TIIE alta.',
      DIGITAL_CAPABILITY:'Core bancario con 10 años de antigüedad. App actual con rating 3.0. Sin APIs abiertas.',
      LEADERSHIP_TALENT:'Dirección estable promedio 6 años. Sin Head of Digital. 2 posiciones técnicas vacantes.',
      BUSINESS_MODEL:'Ingresos por servicios: 11% del total. Retención socios: 90%. Caída de comisiones 7%.',
      REGULATORY_PRESSURE:'CNBV con 3 observaciones activas. Sin sanciones en 2 años. NOM-151 en proceso.',
      MEMBER_DIGITAL_DISCONNECT:'App: 6,200 descargas, rating 3.0. Transacciones digitales: 6% del total.',
    };
    const insightQ2 = {
      STRATEGIC_EXECUTION:'Ejecución estable pero sin mecanismos de corrección temprana. Implementar revisiones quincenales con escalación automática.',
      GOVERNANCE_MATURITY:'Gobernanza formal consolidada. Oportunidad: tablero digital en tiempo real reduce latencia de decisión de 30 a 7 días.',
      MARGIN_DEPENDENCY:'Diversificación urgente hacia crédito PyME y seguros. El scoring automático es el habilitador clave.',
      DIGITAL_CAPABILITY:'Brecha digital crítica. Prioridad máxima: App v3 y scoring conductual como base competitiva.',
      LEADERSHIP_TALENT:'Contratar Head of Digital es la acción de mayor impacto en los próximos 60 días.',
      BUSINESS_MODEL:'Potencial en seguros, pagos y nómina no explotado. La app v3 es el catalizador para cross-sell.',
      REGULATORY_PRESSURE:'Exposición moderada-alta pero controlada. Resolver observación NOM-151 con firma electrónica.',
      MEMBER_DIGITAL_DISCONNECT:'Riesgo de pérdida de socios jóvenes ante fintechs. App v3 con onboarding < 5 min es la respuesta.',
    };
    await client.query(
      `INSERT INTO sector_assessments (id,organization_id,created_by,title,engagement_type,status,notes,ai_analysis,session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [SA1, ORG_ID, OWNER, 'Diagnóstico Estratégico — Caja Cooprogreso Q2 2025', 'DIAGNOSTIC', 'COMPLETED',
       'Diagnóstico inicial del ciclo 2025. Prioridades: Capacidad Digital (3.5) y Desconexión Socio-Digital (3.0). Aprobado por Consejo en sesión de junio.',
       JSON.stringify({ executive_summary:'Caja Cooprogreso muestra fortaleza en Gobernanza (6.0) pero brechas críticas en Digital (3.5) y Desconexión Socio (3.0).', confidence:0.87 }),
       SAS1],
    );
    for (const th of threats) {
      await client.query(
        `INSERT INTO threat_scores (id,assessment_id,threat_key,overall_score,benchmark,evidence,ai_insights) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id(), SA1, th, scoresQ2[th], benchQ2[th], evidQ2[th], insightQ2[th]],
      );
    }

    // Q3 (seguimiento — mejora en digital)
    const scoresQ3 = { STRATEGIC_EXECUTION:6.2, GOVERNANCE_MATURITY:6.5, MARGIN_DEPENDENCY:5.0, DIGITAL_CAPABILITY:5.5, LEADERSHIP_TALENT:5.5, BUSINESS_MODEL:5.0, REGULATORY_PRESSURE:6.0, MEMBER_DIGITAL_DISCONNECT:4.5 };
    const benchQ3  = { STRATEGIC_EXECUTION:'AT', GOVERNANCE_MATURITY:'AT', MARGIN_DEPENDENCY:'AT', DIGITAL_CAPABILITY:'AT', LEADERSHIP_TALENT:'AT', BUSINESS_MODEL:'AT', REGULATORY_PRESSURE:'ABOVE', MEMBER_DIGITAL_DISCONNECT:'AT' };
    const evidQ3   = {
      STRATEGIC_EXECUTION:'OKR Q3 semana 10: 65% de progreso. Revisiones quincenales implementadas. 1 KR AT_RISK (mora).',
      GOVERNANCE_MATURITY:'Dashboard OKR accesible en tiempo real para el Consejo desde agosto. Alertas automáticas activas.',
      MARGIN_DEPENDENCY:'Crédito PyME subió de 8% a 13% de cartera. Margen estable en 4.7%. Seguros: +18% vs Q2.',
      DIGITAL_CAPABILITY:'App v3 en beta con 200 socios: NPS 70. Scoring en staging con precisión 78%.',
      LEADERSHIP_TALENT:'Head of Digital contratado (inicio octubre). 1 posición técnica cubierta de 2.',
      BUSINESS_MODEL:'Ingresos servicios: 14% del total. 220 socios nuevos por referidos digitales.',
      REGULATORY_PRESSURE:'Observación NOM-151 en proceso de cierre. Las otras 2 observaciones CNBV atendidas.',
      MEMBER_DIGITAL_DISCONNECT:'Beta app: 200 socios activos. Transacciones digitales: 12% (vs 6% en Q2).',
    };
    const insightQ3 = {
      STRATEGIC_EXECUTION:'Mejora en ejecución: revisiones quincenales detectaron retraso en mora 3 semanas antes. Siguiente: automatizar alertas cuando KR cae bajo 70% del ritmo.',
      GOVERNANCE_MATURITY:'Latencia de decisión de 30 días eliminada. Siguiente: incorporar benchmarks del sector en el tablero.',
      MARGIN_DEPENDENCY:'Diversificación en marcha. Scoring PyME acelerará el crecimiento seguro. Riesgo: si mora no baja, el costo de riesgo absorbe la mejora.',
      DIGITAL_CAPABILITY:'Progreso digital acelerado (+57% en 3 meses). Bloqueador: integración firma electrónica retrasa lanzamiento del portal.',
      LEADERSHIP_TALENT:'Head of Digital despeja el mayor riesgo de liderazgo. Atención: retener equipo de cobranza — 2 salidas en Q3.',
      BUSINESS_MODEL:'Cross-sell en marcha. App v3 con apertura de productos es el catalizador para llegar al 20% de ingresos por servicios.',
      REGULATORY_PRESSURE:'Resolver NOM-151 antes del 31 de octubre o solicitar prórroga formal para evitar sanción.',
      MEMBER_DIGITAL_DISCONNECT:'Mejora significativa (+50% adopción digital). Con lanzamiento público de app v3, proyectamos 40% de socios jóvenes en digital para Q4.',
    };
    await client.query(
      `INSERT INTO sector_assessments (id,organization_id,created_by,title,engagement_type,status,notes,ai_analysis,session_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [SA2, ORG_ID, OWNER, 'Seguimiento Estratégico — Caja Cooprogreso Q3 2025', 'FOLLOWUP', 'IN_PROGRESS',
       'Seguimiento a 3 meses del diagnóstico inicial. Avance significativo en Digital (+57%). Mora sigue siendo el indicador más crítico.',
       JSON.stringify({ executive_summary:'Caja Cooprogreso muestra progreso relevante en Digital (3.5→5.5) y Desconexión Socio (3.0→4.5). El ritmo de cierre de mora es el área de mayor preocupación.', confidence:0.83 }),
       SAS2],
    );
    for (const th of threats) {
      await client.query(
        `INSERT INTO threat_scores (id,assessment_id,threat_key,overall_score,benchmark,evidence,ai_insights) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [id(), SA2, th, scoresQ3[th], benchQ3[th], evidQ3[th], insightQ3[th]],
      );
    }
    console.log('✓ 2 sesiones de diagnóstico sectorial + 2 assessments + 16 threat scores creados');

    // ─── AI Briefing ejecutivo ────────────────────────────────────────────────
    await client.query(`ALTER TABLE ai_briefings DISABLE TRIGGER trg_ai_briefings_immutable`);
    await client.query(
      `INSERT INTO ai_briefings (id,organization_id,cycle_id,type,title,content,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id(), ORG_ID, CYC_Q3_25, 'executive_briefing',
       'Briefing Ejecutivo — Semana 10, Septiembre 2025',
       JSON.stringify({
         headline: 'Q3 al 65% — Mora sigue siendo el KR crítico; Digital acelera más rápido de lo esperado',
         overall_health: 'CAUTION',
         progress_summary: 'El ciclo Q3 avanza al 65% de progreso promedio en semana 10. 3 de 5 objetivos están ON_TRACK. El scoring automático está en staging (78% precisión) y la App v3 beta tiene NPS 70 con 200 socios.',
         krs_spotlight: [
           { kr:'Mora total de cartera', status:'AT_RISK', current:'4.8%', target:'4.5%', owner:'Roberto Silva' },
           { kr:'Scoring automático 85%', status:'IN_PROGRESS', current:'78% precisión', target:'85% cobertura', owner:'Carlos Gómez' },
           { kr:'Descargas App Móvil', status:'BEHIND', current:'Beta 200 socios', target:'10,000 descargas', owner:'María Torres' },
         ],
         executive_actions: [
           'Desbloquear firma electrónica NOM-151 — retrasa el portal de cobranza 3 semanas',
           'Retener equipo de gestores de cobranza (2 salidas en Q3)',
           'Acelerar lanzamiento público App v3 en tiendas',
         ],
         generated_at: '2025-09-05T07:00:00.000Z',
       }),
       OWNER],
    );
    await client.query(`ALTER TABLE ai_briefings ENABLE TRIGGER trg_ai_briefings_immutable`);
    console.log('✓ 1 briefing ejecutivo Q3 creado');

    await client.query('COMMIT');
    console.log('\n✅ Seed completado exitosamente!\n');
    console.log('📊 Resumen Caja Cooprogreso:');
    console.log('   • Org: HYBRID / COOPERATIVE_FINANCIAL / ENTERPRISE');
    console.log('   • 13 usuarios (2 OWNER + 1 ADMIN + 2 MANAGER + 3 MEMBER + 5 SECTOR_DIAGNOSTICS)');
    console.log('   • 4 áreas + 5 equipos con membresías');
    console.log('   • 3 intenciones estratégicas + 6 problemas organizacionales');
    console.log(`   • 16 ciclos: 1 plan 3Y + 1 plan estratégico 2025-2027 (activo) + 3 anuales (2 closed + 1 active) + 11 trimestrales`);
    console.log(`   • 48 objetivos: 31 COMPANY completed + 9 COMPANY active + 5 TEAM completed + 3 TEAM active`);
    console.log(`   • ${allKRs.length} key results | ${checkinCount} check-ins`);
    console.log(`   • ${initiatives.length} iniciativas + ${milestones2025.length} hitos`);
    console.log(`   • ${ikrLinks.length} vínculos initiative→KR | ${alignments.length} alineaciones obj→obj`);
    console.log(`   • ${sprints.length + sprintsFin.length} sprints | ${biCount} backlog items (EPIC/FEATURE/STORY)`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error — ROLLBACK ejecutado:', err.message);
    console.error(err.stack);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
