import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Response } from 'express';
import { DbService } from '../../database/db.service';
import { RedisService } from '../../common/redis/redis.service';
import { PdfService } from './pdf.service';

const CACHE_TTL = 300; // 5 minutes

@Injectable()
export class ReportsService {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
    private readonly pdf: PdfService,
  ) {}

  private cacheKey(endpoint: string, orgId: string, cycleId?: string): string {
    return `reports:${endpoint}:${orgId}:${cycleId ?? 'active'}`;
  }

  /** Devuelve el id solo si es un UUID válido — descarta strings arbitrarios antes de ir a la DB */
  private safeUUID(id?: string): string | undefined {
    if (!id) return undefined;
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? id : undefined;
  }

  async getRiskDashboard(orgId: string, cycleId?: string) {
    const cycle = this.safeUUID(cycleId)
      ? await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE id = $1 AND organization_id = $2`, [cycleId, orgId])
      : await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`, [orgId]);

    const riskParams: unknown[] = [orgId];
    if (cycle) riskParams.push(cycle.id);
    const atRisk = await this.db.query(
      `SELECT * FROM v_at_risk_krs WHERE organization_id = $1${cycle ? ' AND cycle_id = $2' : ''} ORDER BY (objective_level = 'COMPANY') DESC, days_since_checkin DESC`,
      riskParams,
    );
    const cadenceParams: unknown[] = [orgId];
    if (cycle) cadenceParams.push(cycle.id);
    const cadence = await this.db.query(
      `SELECT * FROM v_cadence_dashboard WHERE organization_id = $1${cycle ? ' AND cycle_id = $2' : ''} ORDER BY days_since_checkin DESC NULLS LAST LIMIT 20`,
      cadenceParams,
    );
    const lastSentinel = await this.db.queryOne(
      `SELECT content, created_at FROM ai_briefings WHERE organization_id = $1 AND type = 'risk_sentinel' ORDER BY created_at DESC LIMIT 1`,
      [orgId],
    );

    return {
      cycle,
      at_risk: atRisk,
      cadence,
      last_sentinel_run: lastSentinel,
      summary: {
        total_at_risk: atRisk.length,
        company_level: atRisk.filter((k) => (k as Record<string, unknown>)['objective_level'] === 'COMPANY').length,
        stale_14d: cadence.filter((k) => Number((k as Record<string, unknown>)['days_since_checkin']) > 14).length,
      },
    };
  }

  async getExecutiveBriefingDashboard(orgId: string, cycleId?: string) {
    const cycle = cycleId
      ? await this.db.queryOne<Record<string, unknown>>(`SELECT * FROM v_cycles_with_stats WHERE id = $1 AND organization_id = $2`, [cycleId, orgId])
      : await this.db.queryOne<Record<string, unknown>>(`SELECT * FROM v_cycles_with_stats WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`, [orgId]);

    const briefingParams: unknown[] = [orgId];
    if (cycle) briefingParams.push(cycle['id']);
    const lastBriefing = await this.db.queryOne(
      `SELECT * FROM ai_briefings WHERE organization_id = $1 AND type = 'executive_briefing'${cycle ? ' AND cycle_id = $2' : ''} ORDER BY created_at DESC LIMIT 1`,
      briefingParams,
    );
    const objectives = cycle
      ? await this.db.query(`SELECT code, title, level, status, fn_calculate_objective_progress(id) as progress FROM objectives WHERE cycle_id = $1 AND deleted_at IS NULL ORDER BY level, code NULLS LAST`, [cycle['id']])
      : [];
    const score = cycle ? await this.db.queryOne<{ fn_get_cycle_score: number }>(`SELECT fn_get_cycle_score($1)`, [cycle['id']]) : null;

    return { cycle, last_briefing: lastBriefing, objectives, cycle_score: score?.fn_get_cycle_score ?? 0 };
  }

  async getAlignmentReport(orgId: string, cycleId?: string) {
    const cycle = cycleId
      ? await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE id = $1 AND organization_id = $2`, [cycleId, orgId])
      : await this.db.queryOne<{ id: string; name: string }>(`SELECT id, name FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`, [orgId]);

    if (!cycle) throw new UnprocessableEntityException('No hay ciclo activo');

    const [gaps] = await this.db.query<{ fn_get_alignment_gaps: unknown }>(
      `SELECT fn_get_alignment_gaps($1, $2)`, [cycle.id, orgId],
    );
    const alignmentMap = await this.db.query(
      `SELECT * FROM v_alignment_map WHERE organization_id = $1 AND cycle_id = $2`, [orgId, cycle.id],
    );
    const lastAudit = await this.db.queryOne(
      `SELECT content, created_at FROM ai_briefings WHERE organization_id = $1 AND type = 'alignment_audit' AND cycle_id = $2 ORDER BY created_at DESC LIMIT 1`,
      [orgId, cycle.id],
    );

    return { cycle, gaps: gaps?.fn_get_alignment_gaps, alignment_map: alignmentMap, last_audit: lastAudit };
  }

  async getExecutiveDashboard(orgId: string, cycleId?: string) {
    return this.redis.getOrSet(this.cacheKey('executive-dashboard', orgId, cycleId), CACHE_TTL, () => {
      const params: unknown[] = [orgId];
      const filter = cycleId
        ? ' AND cycle_id = $2'
        : " AND cycle_status IN ('ACTIVE', 'CLOSED') ORDER BY last_updated DESC LIMIT 1";
      if (cycleId) params.push(cycleId);
      return this.db.queryOne(
        `SELECT * FROM v_executive_dashboard WHERE organization_id = $1${filter}`,
        params,
      );
    });
  }

  async getCycleHealth(orgId: string, cycleId?: string) {
    return this.redis.getOrSet(this.cacheKey('cycle-health', orgId, cycleId), CACHE_TTL, () => {
      const params: unknown[] = [orgId];
      const filter = cycleId
        ? ' AND cycle_id = $2'
        : " AND cycle_status = 'ACTIVE' LIMIT 1";
      if (cycleId) params.push(cycleId);
      return this.db.queryOne(
        `SELECT * FROM v_cycle_health WHERE organization_id = $1${filter}`,
        params,
      );
    });
  }

  async getTeamHealth(orgId: string, cycleId?: string) {
    return this.redis.getOrSet(this.cacheKey('team-health', orgId, cycleId), CACHE_TTL, () => {
      const params: unknown[] = [orgId];
      const filter = cycleId ? ' AND cycle_id = $2' : '';
      if (cycleId) params.push(cycleId);
      return this.db.query(
        `SELECT * FROM v_team_health WHERE organization_id = $1${filter} ORDER BY avg_progress DESC`,
        params,
      );
    });
  }

  async getPortfolio(orgId: string, cycleId?: string) {
    return this.redis.getOrSet(this.cacheKey('portfolio', orgId, cycleId), CACHE_TTL, () => {
      const params: unknown[] = [orgId];
      const filter = cycleId ? ' AND cycle_id = $2' : '';
      if (cycleId) params.push(cycleId);
      return this.db.query(
        `SELECT * FROM v_portfolio_dashboard WHERE organization_id = $1${filter} ORDER BY team_name, status, due_date NULLS LAST`,
        params,
      );
    });
  }

  async getAreaCheckinStatus(orgId: string) {
    return this.db.query(
      `SELECT
         a.id,
         a.name,
         a.color,
         MAX(ci.checked_at)                                                   AS last_checkin,
         EXTRACT(EPOCH FROM (NOW() - MAX(ci.checked_at)))::int / 86400        AS days_since,
         COUNT(DISTINCT kr.id)::int                                           AS kr_count,
         COUNT(ci.id) FILTER (WHERE ci.checked_at >= NOW() - INTERVAL '14 days')::int
                                                                              AS checkins_last_14d
       FROM areas a
       LEFT JOIN teams      t  ON t.area_id       = a.id    AND t.deleted_at  IS NULL
       LEFT JOIN objectives o  ON o.team_id        = t.id   AND o.organization_id = a.org_id
                                                            AND o.deleted_at  IS NULL
       LEFT JOIN key_results kr ON kr.objective_id = o.id   AND kr.deleted_at IS NULL
       LEFT JOIN check_ins  ci ON ci.kr_id         = kr.id
       WHERE a.org_id = $1 AND a.is_active = true
       GROUP BY a.id, a.name, a.color
       ORDER BY MAX(ci.checked_at) DESC NULLS LAST`,
      [orgId],
    );
  }

  async getCommitmentRanking(orgId: string) {
    return this.db.query(
      `WITH kr_status AS (
         SELECT
           kr.owner_id                                                                        AS user_id,
           kr.id                                                                              AS kr_id,
           MAX(ci.checked_at)                                                                 AS last_checkin_at,
           COUNT(ci.id) FILTER (WHERE ci.checked_at >= NOW() - INTERVAL '30 days')::int      AS ci_30d,
           GREATEST(0,
             COALESCE(
               EXTRACT(EPOCH FROM (NOW() - MAX(ci.checked_at)))::int / 86400,
               999
             ) - fn_cadence_days(kr.check_in_cadence)
           )::int                                                                             AS overdue_days
         FROM key_results kr
         JOIN objectives o ON o.id = kr.objective_id
                           AND o.organization_id = $1
                           AND o.deleted_at IS NULL
                           AND o.status = 'ACTIVE'
         LEFT JOIN check_ins ci ON ci.kr_id = kr.id
         WHERE kr.deleted_at IS NULL AND kr.status NOT IN ('CANCELLED', 'COMPLETED')
         GROUP BY kr.id, kr.owner_id
       )
       SELECT
         u.id                            AS user_id,
         u.name,
         ua.area_name,
         COUNT(DISTINCT ks.kr_id)::int   AS kr_count,
         SUM(ks.ci_30d)::int             AS checkins_30d,
         MAX(ks.last_checkin_at)         AS last_checkin_at,
         MAX(ks.overdue_days)::int       AS max_overdue_days
       FROM users u
       LEFT JOIN LATERAL (
         SELECT a.name AS area_name
         FROM team_members tm
         JOIN teams t ON t.id = tm.team_id AND t.deleted_at IS NULL
         JOIN areas a ON a.id = t.area_id  AND a.is_active = true
         WHERE tm.user_id = u.id
         ORDER BY CASE WHEN tm.role = 'LEAD' THEN 0 ELSE 1 END
         LIMIT 1
       ) ua ON true
       JOIN kr_status ks ON ks.user_id = u.id
       WHERE u.organization_id = $1 AND u.is_active = true AND u.deleted_at IS NULL
       GROUP BY u.id, u.name, ua.area_name
       HAVING COUNT(DISTINCT ks.kr_id) > 0
       ORDER BY MAX(ks.overdue_days) ASC, MAX(ks.last_checkin_at) DESC NULLS LAST`,
      [orgId],
    );
  }

  async getWeeklyTrend(orgId: string, cycleId?: string) {
    let resolvedCycleId = cycleId;
    if (!resolvedCycleId) {
      const active = await this.db.queryOne<{ id: string }>(
        `SELECT id FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1`,
        [orgId],
      );
      resolvedCycleId = active?.id;
    }
    if (!resolvedCycleId) return [];
    return this.db.query(
      `SELECT * FROM v_weekly_trend WHERE organization_id = $1 AND cycle_id = $2 ORDER BY week_number`,
      [orgId, resolvedCycleId],
    );
  }

  async getCycleProjection(orgId: string) {
    // Database-First: Toda la lógica está en fn_get_cycle_projection() en PostgreSQL
    const result = await this.db.queryOne<{
      cycle_id: string; cycle_name: string; days_remaining: number;
      expected_progress: number; actual_progress: number; progress_gap: number;
      weekly_velocity: number; weeks_remaining: number; projected_final: number;
      objectives_json: any;
    }>(
      `SELECT * FROM fn_get_cycle_projection(
        (SELECT id FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE' LIMIT 1),
        $1
      )`,
      [orgId],
    );

    if (!result) return null;

    return {
      cycle: {
        id: result.cycle_id,
        name: result.cycle_name,
        days_remaining: result.days_remaining,
      },
      actual_progress: result.actual_progress,
      expected_progress: result.expected_progress,
      gap: result.progress_gap,
      weekly_velocity: result.weekly_velocity,
      projected_final_progress: result.projected_final,
      objectives: result.objectives_json || [],
    };
  }

  async generateCloseReport(orgId: string, cycleId: string, userId: string) {
    const cycle = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM cycles WHERE id = $1 AND organization_id = $2`,
      [cycleId, orgId],
    );
    if (!cycle) throw new NotFoundException('Cycle not found for this organization');

    const result = await this.db.queryOne<{ fn_generate_cycle_close_report: unknown }>(
      `SELECT fn_generate_cycle_close_report($1, $2)`,
      [cycleId, orgId],
    );
    const content = result?.fn_generate_cycle_close_report ?? null;

    await this.db.execute(
      `INSERT INTO cycle_close_reports (cycle_id, organization_id, content, generated_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (cycle_id) DO UPDATE SET content = $3, generated_by = $4`,
      [cycleId, orgId, content, userId],
    );

    await this.redis.delPattern(`reports:*:${orgId}:*`);

    return content;
  }

  async getCloseReport(orgId: string, cycleId: string) {
    return this.db.queryOne(
      `SELECT content, generated_by, created_at FROM cycle_close_reports WHERE cycle_id = $1 AND organization_id = $2`,
      [cycleId, orgId],
    );
  }

  async getUpcomingMilestones(orgId: string, days = 30) {
    const params: unknown[] = [orgId, Math.min(Math.max(days, 1), 90)];
    return this.db.query(
      `SELECT * FROM v_upcoming_milestones
       WHERE organization_id = $1
         AND days_until_due <= $2
       ORDER BY days_until_due, initiative_title`,
      params,
    );
  }

  async getActivityFeed(orgId: string, cycleId?: string, teamId?: string, limit = 50) {
    const params: unknown[] = [orgId, Math.min(limit, 100)];
    let cycleFilter = '';
    let teamFilter = '';
    if (cycleId) { params.push(cycleId); cycleFilter = ` AND o.cycle_id = $${params.length}`; }
    if (teamId)  { params.push(teamId);  teamFilter  = ` AND t.id = $${params.length}`; }
    return this.db.query(
      `SELECT
         ci.id,
         ci.checked_at                      AS event_at,
         'checkin'                           AS event_type,
         u.name                              AS actor_name,
         kr.title                            AS kr_title,
         o.title                             AS objective_title,
         o.level                             AS objective_level,
         ci.current_value,
         ci.confidence,
         ci.notes,
         ci.mood,
         t.name                              AS team_name
       FROM check_ins ci
       JOIN key_results kr ON kr.id = ci.kr_id
       JOIN objectives o ON o.id = kr.objective_id
       LEFT JOIN teams t ON t.id = o.team_id
       LEFT JOIN users u ON u.id = ci.user_id
       WHERE o.organization_id = $1${cycleFilter}${teamFilter}
       ORDER BY ci.checked_at DESC
       LIMIT $2`,
      params,
    );
  }

  async exportCycleCsv(orgId: string, cycleId: string) {
    return this.db.query(
      `SELECT
         o.title                                              AS objective_title,
         o.level,
         o.status                                             AS objective_status,
         fn_calculate_objective_progress(o.id)               AS objective_progress,
         kr.title                                             AS kr_title,
         kr.type,
         kr.status                                           AS kr_status,
         kr.start_value,
         kr.current_value,
         kr.target_value,
         kr.metric_unit,
         ROUND(kr.confidence * 100)                          AS confidence_pct,
         u.name                                              AS owner_name,
         (SELECT COUNT(*) FROM check_ins ci WHERE ci.kr_id = kr.id) AS checkin_count,
         (SELECT MAX(ci.checked_at) FROM check_ins ci WHERE ci.kr_id = kr.id) AS last_checkin_at
       FROM objectives o
       JOIN key_results kr ON kr.objective_id = o.id
       LEFT JOIN users u ON u.id = kr.owner_id
       WHERE o.cycle_id = $1
         AND o.organization_id = $2
         AND o.deleted_at IS NULL
         AND kr.deleted_at IS NULL
       ORDER BY o.level, o.title, kr.title`,
      [cycleId, orgId],
    );
  }

  // â"€â"€ PDF Export â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  private async fetchReportData(orgId: string, cycleId: string) {
    const [cycle, org, dash, atRisk, objectives, agreementStats, topInitiatives, aiBriefing, agreements] = await Promise.all([
      this.db.queryOne<{ name: string; end_date: string; start_date: string }>(
        `SELECT name, end_date, start_date FROM cycles WHERE id = $1 AND organization_id = $2`,
        [cycleId, orgId],
      ),
      this.db.queryOne<{ name: string }>(
        `SELECT name FROM organizations WHERE id = $1`,
        [orgId],
      ),
      this.db.queryOne<{ cycle_score: number; avg_progress: number; total_objectives: number; completed_objectives: number }>(
        `SELECT cycle_score, avg_progress, total_objectives, completed_objectives
           FROM v_executive_dashboard WHERE cycle_id = $1 AND organization_id = $2`,
        [cycleId, orgId],
      ),
      this.db.query<{ kr_title: string; objective_title: string; level: string; confidence: number }>(
        `SELECT kr_title, objective_title, objective_level AS level, confidence
           FROM v_at_risk_krs WHERE cycle_id = $1 AND organization_id = $2
           ORDER BY (objective_level = 'COMPANY') DESC LIMIT 10`,
        [cycleId, orgId],
      ),
      this.db.query<{ code: string | null; title: string; level: string; status: string; progress: number }>(
        `SELECT code, title, level, status, fn_calculate_objective_progress(id) AS progress
           FROM objectives WHERE cycle_id = $1 AND organization_id = $2 AND deleted_at IS NULL
           ORDER BY level, code NULLS LAST`,
        [cycleId, orgId],
      ),
      this.db.queryOne<{ total: number; pending: number; in_progress: number; fulfilled: number; overdue: number }>(
        `SELECT
           COUNT(*)::INT AS total,
           COUNT(*) FILTER (WHERE status = 'PENDING')::INT     AS pending,
           COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::INT AS in_progress,
           COUNT(*) FILTER (WHERE status = 'FULFILLED')::INT   AS fulfilled,
           COUNT(*) FILTER (WHERE is_overdue = TRUE)::INT      AS overdue
         FROM v_agreements WHERE organization_id = $1 AND status != 'CANCELLED'`,
        [orgId],
      ),
      this.db.query<{ title: string; status: string; progress: number; owner_name: string | null }>(
        `SELECT title, status, COALESCE(progress, 0)::INT AS progress, owner_name
           FROM v_initiative_timeline WHERE organization_id = $1 AND status NOT IN ('CANCELLED','DONE')
           ORDER BY progress DESC LIMIT 6`,
        [orgId],
      ),
      // AI cycle-close briefing (narrative, logros, misses, learnings, recomendaciones)
      this.db.queryOne<{ content: Record<string, unknown> }>(
        `SELECT content FROM ai_briefings WHERE organization_id = $1 AND cycle_id = $2 AND type = 'cycle_close' ORDER BY created_at DESC LIMIT 1`,
        [orgId, cycleId],
      ),
      // Individual agreements (for detailed slide/section)
      this.db.query<{ title: string; status: string; priority: string; owner_name: string | null; is_overdue: boolean; due_date: string | null; days_remaining: number | null }>(
        `SELECT title, status, priority, owner_name, is_overdue,
                to_char(due_date, 'DD/MM/YYYY') AS due_date,
                CASE WHEN due_date IS NOT NULL THEN (due_date::date - CURRENT_DATE)::int END AS days_remaining
           FROM v_agreements WHERE organization_id = $1 AND status != 'CANCELLED'
           ORDER BY CASE WHEN is_overdue THEN 0 ELSE 1 END,
                    CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
                    due_date ASC NULLS LAST
           LIMIT 15`,
        [orgId],
      ),
    ]);

    return { cycle, org, dash, atRisk, objectives, agreementStats, topInitiatives, aiBriefing, agreements };
  }

  async exportPdf(orgId: string, cycleId: string, res: Response): Promise<void> {
    const { cycle, org, dash, atRisk, objectives, agreementStats, topInitiatives, aiBriefing, agreements } = await this.fetchReportData(orgId, cycleId);
    if (!cycle) throw new NotFoundException('Ciclo no encontrado');

    const ai = aiBriefing?.content ?? null;
    const html = this.pdf.buildExecutiveReportHtml({
      orgName: org?.name ?? '',
      cycleName: cycle.name,
      cycleStartDate: cycle.start_date,
      cycleEndDate: cycle.end_date,
      score: Number(dash?.cycle_score ?? 0),
      avgProgress: Number(dash?.avg_progress ?? 0),
      totalObjectives: Number(dash?.total_objectives ?? 0),
      completedObjectives: Number(dash?.completed_objectives ?? 0),
      atRisk,
      objectives,
      agreementStats: agreementStats ?? { total: 0, pending: 0, in_progress: 0, fulfilled: 0, overdue: 0 },
      topInitiatives,
      agreements,
      aiNarrative:    ai ? String(ai['narrative']   ?? '')          : undefined,
      achievements:   ai ? (ai['achievements']  as string[] ?? [])  : undefined,
      misses:         ai ? (ai['misses']         as string[] ?? [])  : undefined,
      learnings:      ai ? (ai['learnings']      as string[] ?? [])  : undefined,
      nextCycleRecs:  ai ? (ai['next_cycle_recommendations'] as string[] ?? []) : undefined,
    });

    const buffer = await this.pdf.htmlToPdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="reporte-ejecutivo-${cycleId.slice(0, 8)}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  async exportPptx(orgId: string, cycleId: string, res: Response): Promise<void> {
    const { cycle, org, dash, atRisk, objectives, agreementStats, topInitiatives, aiBriefing, agreements } = await this.fetchReportData(orgId, cycleId);
    if (!cycle) throw new NotFoundException('Ciclo no encontrado');

    const ai = aiBriefing?.content ?? null;
    const buffer = await this.pdf.buildExecutivePptx({
      orgName: org?.name ?? '',
      cycleName: cycle.name,
      cycleStartDate: cycle.start_date,
      cycleEndDate: cycle.end_date,
      score: Number(dash?.cycle_score ?? 0),
      avgProgress: Number(dash?.avg_progress ?? 0),
      totalObjectives: Number(dash?.total_objectives ?? 0),
      completedObjectives: Number(dash?.completed_objectives ?? 0),
      atRisk,
      objectives,
      agreementStats: agreementStats ?? { total: 0, pending: 0, in_progress: 0, fulfilled: 0, overdue: 0 },
      topInitiatives,
      agreements,
      aiNarrative:    ai ? String(ai['narrative']   ?? '')          : undefined,
      achievements:   ai ? (ai['achievements']  as string[] ?? [])  : undefined,
      misses:         ai ? (ai['misses']         as string[] ?? [])  : undefined,
      learnings:      ai ? (ai['learnings']      as string[] ?? [])  : undefined,
      nextCycleRecs:  ai ? (ai['next_cycle_recommendations'] as string[] ?? []) : undefined,
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
    res.setHeader('Content-Disposition', `attachment; filename="presentacion-ejecutiva-${cycleId.slice(0, 8)}.pptx"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }

  // â"€â"€ Security Audit â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async getSecurityAudit(orgId: string, limit = 100) {
    return this.db.query(
      `SELECT * FROM v_security_audit WHERE organization_id = $1 LIMIT $2`,
      [orgId, limit],
    );
  }

  // â"€â"€ Governance Calendar â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async getGovernanceCalendar(orgId: string, horizon: string) {
    const validHorizons = ['QUARTERLY', 'ANNUAL', '3YEAR'];
    const h = validHorizons.includes(horizon) ? horizon : 'ANNUAL';
    return this.db.query(
      `SELECT * FROM fn_governance_calendar($1, $2)`,
      [orgId, h],
    );
  }

  // â"€â"€ Welcome Context â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

  async getWelcomeContext(orgId: string, userId: string, cycleId?: string) {
    const row = await this.db.queryOne<{ fn_welcome_context: Record<string, unknown> }>(
      `SELECT fn_welcome_context($1, $2, $3)`,
      [orgId, userId, cycleId ?? null],
    );
    return row?.fn_welcome_context ?? null;
  }

  async getPortfolioMetrics(userId: string) {
    return this.db.query(
      `SELECT * FROM fn_portfolio_metrics($1)`,
      [userId],
    );
  }

  // ── Engagement ROI (WOW 4) ────────────────────────────────────────────────────

  async getEngagementRoi(orgId: string, cycleId: string) {
    const cycle = await this.db.queryOne<{
      id: string; name: string; status: string; start_date: string; end_date: string;
    }>(
      `SELECT id, name, status, start_date, end_date FROM cycles WHERE id = $1 AND organization_id = $2`,
      [cycleId, orgId],
    );
    if (!cycle) throw new NotFoundException('Ciclo no encontrado');

    const [org, agreements, objectives, backlogStats, initiativeStats, checkInCount, score] = await Promise.all([
      this.db.queryOne<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [orgId]),

      // Solo acuerdos explícitamente asignados a este ciclo — evita duplicados entre ciclos
      this.db.query<{
        id: string; code: string; title: string; status: string; priority: string;
        source: string | null; due_date: string | null; is_overdue: boolean; epics_count: number;
      }>(
        `SELECT
           a.id, a.code, a.title, a.status, a.priority, a.source,
           to_char(a.due_date, 'DD/MM/YYYY') AS due_date,
           CASE WHEN a.due_date IS NOT NULL AND a.due_date < CURRENT_DATE
                     AND a.status NOT IN ('FULFILLED','CANCELLED') THEN true ELSE false END AS is_overdue,
           COUNT(DISTINCT abi.backlog_item_id) FILTER (WHERE bi.type = 'EPIC')::INT AS epics_count
         FROM agreements a
         LEFT JOIN agreement_backlog_items abi ON abi.agreement_id = a.id
         LEFT JOIN backlog_items bi ON bi.id = abi.backlog_item_id
         WHERE a.organization_id = $1
           AND a.deleted_at IS NULL
           AND a.cycle_id = $2
         GROUP BY a.id, a.code, a.title, a.status, a.priority, a.source, a.due_date
         ORDER BY CASE a.status WHEN 'FULFILLED' THEN 1 WHEN 'IN_PROGRESS' THEN 2 WHEN 'PENDING' THEN 3 ELSE 4 END, a.created_at`,
        [orgId, cycleId],
      ),

      // Excluye CANCELLED — no son "fallidos", son eliminados del alcance
      this.db.query<{ id: string; code: string | null; title: string; level: string; status: string; progress: number }>(
        `SELECT id, code, title, level, status,
                fn_calculate_objective_progress(id)::INT AS progress
         FROM objectives
         WHERE cycle_id = $1 AND organization_id = $2
           AND deleted_at IS NULL
           AND status != 'CANCELLED'
         ORDER BY level, code NULLS LAST`,
        [cycleId, orgId],
      ),

      // Incluye ítems con cycle_id directo + ítems de iniciativas del ciclo + ítems de sprints del ciclo
      this.db.queryOne<{
        epics: number; features: number; stories: number;
        done_epics: number; done_features: number; done_stories: number;
        total_points: number; done_points: number;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE type = 'EPIC')::INT                          AS epics,
           COUNT(*) FILTER (WHERE type = 'FEATURE')::INT                       AS features,
           COUNT(*) FILTER (WHERE type = 'STORY')::INT                         AS stories,
           COUNT(*) FILTER (WHERE type = 'EPIC' AND status = 'DONE')::INT      AS done_epics,
           COUNT(*) FILTER (WHERE type = 'FEATURE' AND status = 'DONE')::INT   AS done_features,
           COUNT(*) FILTER (WHERE type = 'STORY' AND status = 'DONE')::INT     AS done_stories,
           COALESCE(SUM(story_points), 0)::INT                                 AS total_points,
           COALESCE(SUM(story_points) FILTER (WHERE status = 'DONE'), 0)::INT  AS done_points
         FROM backlog_items bi
         WHERE bi.organization_id = $1
           AND bi.status != 'CANCELLED'
           AND (
             bi.cycle_id = $2
             OR bi.initiative_id IN (SELECT id FROM initiatives WHERE cycle_id = $2 AND deleted_at IS NULL)
             OR bi.sprint_id    IN (SELECT id FROM sprint_cycles  WHERE cycle_id = $2)
           )`,
        [orgId, cycleId],
      ),

      this.db.queryOne<{ total: number; done: number; in_progress: number }>(
        `SELECT
           COUNT(*)::INT                                       AS total,
           COUNT(*) FILTER (WHERE status = 'DONE')::INT       AS done,
           COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')::INT AS in_progress
         FROM initiatives
         WHERE organization_id = $1 AND cycle_id = $2 AND deleted_at IS NULL`,
        [orgId, cycleId],
      ),

      this.db.queryOne<{ count: number }>(
        `SELECT COUNT(ci.id)::INT AS count
         FROM check_ins ci
         JOIN key_results kr ON kr.id = ci.kr_id
         JOIN objectives o ON o.id = kr.objective_id
         WHERE o.organization_id = $1 AND o.cycle_id = $2`,
        [orgId, cycleId],
      ),

      this.db.queryOne<{ fn_get_cycle_score: number }>(`SELECT fn_get_cycle_score($1)`, [cycleId]),
    ]);

    const totalAgreements = agreements.length;
    const fulfilled = agreements.filter((a) => a.status === 'FULFILLED').length;
    const inProgress = agreements.filter((a) => a.status === 'IN_PROGRESS').length;
    const pending = agreements.filter((a) => a.status === 'PENDING').length;

    const totalObjectives = objectives.length;
    // Regla única: COMPLETED (status oficial) → logrado; ACTIVE con progress ≥70 → logrado; 40-69 → parcial; <40 → no cumplido
    // Esto hace que badges, tabla e ícono usen exactamente la misma lógica
    const completedObjectives = objectives.filter((o) => o.status === 'COMPLETED' || o.progress >= 70).length;
    const partialObjectives   = objectives.filter((o) => o.status !== 'COMPLETED' && o.progress >= 40 && o.progress < 70).length;
    const missedObjectives    = totalObjectives - completedObjectives - partialObjectives;

    // Enriquecer cada objetivo con su categoría para que frontend y backend usen la misma fuente
    const objectivesWithCategory = objectives.map((o) => ({
      ...o,
      category: o.status === 'COMPLETED' || o.progress >= 70 ? 'completed' as const
               : o.progress >= 40 ? 'partial' as const
               : 'missed' as const,
    }));

    return {
      cycle: { ...cycle, score: Number(score?.fn_get_cycle_score ?? 0) / 10 },
      org: { name: org?.name ?? '' },
      agreements: {
        items: agreements,
        total: totalAgreements,
        fulfilled,
        in_progress: inProgress,
        pending,
        fulfillment_rate: totalAgreements > 0 ? Math.round((fulfilled / totalAgreements) * 100) : 0,
      },
      objectives: {
        items: objectivesWithCategory,
        total: totalObjectives,
        completed: completedObjectives,
        partial: partialObjectives,
        missed: missedObjectives < 0 ? 0 : missedObjectives,
        completion_rate: totalObjectives > 0 ? Math.round((completedObjectives / totalObjectives) * 100) : 0,
      },
      work: {
        epics: backlogStats?.epics ?? 0,
        features: backlogStats?.features ?? 0,
        stories: backlogStats?.stories ?? 0,
        done_epics: backlogStats?.done_epics ?? 0,
        done_features: backlogStats?.done_features ?? 0,
        done_stories: backlogStats?.done_stories ?? 0,
        total_points: backlogStats?.total_points ?? 0,
        done_points: backlogStats?.done_points ?? 0,
        initiatives_total: initiativeStats?.total ?? 0,
        initiatives_done: initiativeStats?.done ?? 0,
      },
      check_ins_total: checkInCount?.count ?? 0,
    };
  }

  // ── Consejo Package ───────────────────────────────────────────────────────────

  async getConsejoPackage(orgId: string, cycleId: string) {
    const row = await this.db.queryOne<{ fn_consejo_package: any }>(
      `SELECT fn_consejo_package($1, $2)`,
      [cycleId, orgId],
    );
    return row?.fn_consejo_package ?? {};
  }

  // ── Governance Activities (custom) ─────────────────────────────────────────

  async createGovernanceActivity(orgId: string, userId: string, body: Record<string, unknown>) {
    const result = await this.db.queryOne<{ p_id: string }>(
      `CALL sp_create_governance_activity($1,$2,$3,$4,$5,$6,$7,$8,$9::date,$10,$11,$12,NULL)`,
      [
        orgId, userId,
        body['title'], body['event_type'] ?? 'CUSTOM',
        body['responsible'] ?? null, body['deliverable'] ?? null,
        body['description'] ?? null, body['frequency'] ?? null,
        body['scheduled_date'], body['due_date'] ?? null,
        body['status'] ?? 'UPCOMING', body['cycle_id'] ?? null,
      ],
    );
    await this.redis.delPattern(`reports:*:${orgId}:*`);
    return { id: result?.p_id };
  }

  async updateGovernanceActivity(orgId: string, id: string, body: Record<string, unknown>) {
    await this.db.execute(
      `CALL sp_update_governance_activity($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        orgId, id,
        body['title'] ?? null, body['event_type'] ?? null,
        body['responsible'] ?? null, body['deliverable'] ?? null,
        body['description'] ?? null, body['frequency'] ?? null,
        body['scheduled_date'] ?? null, body['due_date'] ?? null,
        body['status'] ?? null,
      ],
    );
    await this.redis.delPattern(`reports:*:${orgId}:*`);
    return { ok: true };
  }

  async deleteGovernanceActivity(orgId: string, id: string) {
    await this.db.execute(`CALL sp_delete_governance_activity($1,$2)`, [orgId, id]);
    await this.redis.delPattern(`reports:*:${orgId}:*`);
    return { ok: true };
  }

  // ── Governance PDF ─────────────────────────────────────────────────────────

  async exportGovernancePdf(orgId: string, horizon: string, res: Response): Promise<void> {
    const validHorizons = ['QUARTERLY', 'ANNUAL', '3YEAR'];
    const h = validHorizons.includes(horizon) ? horizon : 'ANNUAL';
    const horizonLabel = h === 'QUARTERLY' ? 'Trimestral' : h === 'ANNUAL' ? 'Anual' : '3 Años';

    const events = await this.db.query<{
      event_id: string; event_type: string; title: string; responsible: string | null;
      scheduled_date: string; due_date: string | null; status: string; cycle_name: string | null;
    }>(`SELECT * FROM fn_governance_calendar($1, $2)`, [orgId, h]);

    const html = this.pdf.buildGovernancePdfHtml({ horizonLabel, events });
    const buffer = await this.pdf.htmlToPdf(html);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="gobierno-okr-${h.toLowerCase()}.pdf"`);
    res.setHeader('Content-Length', buffer.length);
    res.end(buffer);
  }
}
