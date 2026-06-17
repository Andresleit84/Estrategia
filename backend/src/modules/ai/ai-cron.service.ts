import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { DbService } from '../../database/db.service';
import { AiService } from './ai.service';
import { EmailService } from '../../common/email/email.service';
import { TelegramService } from '../../common/telegram/telegram.service';
import { Inject, forwardRef } from '@nestjs/common';
import { ConsultantService } from '../consultant/consultant.service';

// ── Types ──────────────────────────────────────────────────────────────────────

interface OrgInfo {
  organization_id: string;
  org_name: string;
  owner_email: string;
  owner_id: string;
  notif_config: NotifConfig;
  notif_sent: NotifSentAt;
}

interface OrgSnapshot {
  org_id: string;
  org_name: string;
  cycle_id: string | null;
  cycle_name: string | null;
  cycle_score: number | null;
  active_objectives: number;
  on_track: number;
  at_risk: number;
  completed: number;
  krs_at_risk: number;
}

interface NotifSetting {
  enabled: boolean;
  channels: Array<'email' | 'telegram'>;
  hour: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'quarterly' | 'annual';
  day_of_week?: number;          // 0-6, weekly only
  day_of_month?: number;         // 1-28, monthly/quarterly/annual
  month_of_year?: number;        // 1-12, annual only
  quarter_start_month?: number;  // 1-12, quarterly: primer mes del trimestre (default 1)
  stale_days?: number;
}

interface NotifConfig {
  timezone: string;
  telegram_chat_id?: string;   // per-org override for global TELEGRAM_CHAT_ID
  email_recipients?: string;   // extra emails, comma-separated
  risk_sentinel: NotifSetting;
  executive_briefer: NotifSetting;
  checkin_reminder: NotifSetting;
  cycle_closure: NotifSetting;
  agreement_status: NotifSetting;
  personal_briefing: NotifSetting;
}

interface NotifSentAt {
  risk_sentinel?: string;
  executive_briefer?: string;
  checkin_reminder?: string;
  cycle_closure?: string;
  agreement_status?: string;
  personal_briefing?: string;
}

const DEFAULT_CONFIG: NotifConfig = {
  timezone: 'America/Lima',
  risk_sentinel:     { enabled: true,  channels: ['email','telegram'], hour: 2,  frequency: 'daily'  },
  executive_briefer: { enabled: true,  channels: ['email','telegram'], hour: 8,  frequency: 'weekly', day_of_week: 1 },
  checkin_reminder:  { enabled: true,  channels: ['telegram'],          hour: 10, frequency: 'weekly', day_of_week: 4, stale_days: 7 },
  cycle_closure:     { enabled: true,  channels: ['telegram'],          hour: 9,  frequency: 'daily'  },
  agreement_status:  { enabled: true,  channels: ['email','telegram'], hour: 8,  frequency: 'weekly', day_of_week: 1, stale_days: 7 },
  personal_briefing: { enabled: true,  channels: ['email'],             hour: 7,  frequency: 'weekly', day_of_week: 1 },
};

export type NotifType = 'risk_sentinel' | 'executive_briefer' | 'checkin_reminder' | 'cycle_closure' | 'agreement_status' | 'personal_briefing';

const VALID_TYPES = new Set<NotifType>(['risk_sentinel','executive_briefer','checkin_reminder','cycle_closure','agreement_status','personal_briefing']);

const e   = TelegramService.esc;
const bar = TelegramService.bar;

function ts(): string {
  return new Date().toLocaleString('es-CO', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

// ── Service ────────────────────────────────────────────────────────────────────

@Injectable()
export class AiCronService {
  private readonly logger = new Logger(AiCronService.name);

  constructor(
    private readonly db: DbService,
    private readonly ai: AiService,
    private readonly email: EmailService,
    private readonly telegram: TelegramService,
    @Inject(forwardRef(() => ConsultantService))
    private readonly consultant: ConsultantService,
  ) {}

  // ── Hourly check: fire notifications for each org per their config ──────────

  @Cron('0 * * * *', { name: 'notifications-hourly', timeZone: 'UTC' })
  async runHourlyNotifications() {
    const now = new Date();
    const orgs = await this.activeOrgs();
    this.logger.log(`Hourly notifications check — ${orgs.length} active orgs`);

    await Promise.allSettled(
      orgs.map(org => this.processOrg(org, now, false)),
    );
  }

  // ── Monday 12:00 UTC (7am Lima) — Consultant digest ─────────────────────────

  @Cron('0 12 * * 1', { name: 'consultant-digest-weekly', timeZone: 'UTC' })
  async runConsultantDigests() {
    const links = await this.consultant.getAllActiveLinks();
    if (links.length === 0) return;

    // Group by consultant email
    const byConsultant = links.reduce<Record<string, string[]>>((acc, l) => {
      (acc[l.consultant_email] ??= []).push(l.client_org_id);
      return acc;
    }, {});

    this.logger.log(`Consultant digest — ${Object.keys(byConsultant).length} consultants`);

    await Promise.allSettled(
      Object.entries(byConsultant).map(([email, orgIds]) =>
        this.sendConsultantDigest(email, orgIds),
      ),
    );
  }

  // ── Public: trigger digest immediately for a consultant ────────────────────

  async triggerConsultantDigest(consultantEmail: string): Promise<{ ok: boolean; sent_channels: string[] }> {
    const links = await this.consultant.getAllActiveLinks();
    const orgIds = links
      .filter(l => l.consultant_email === consultantEmail)
      .map(l => l.client_org_id);

    if (orgIds.length === 0) {
      return { ok: false, sent_channels: [] };
    }
    const sent = await this.sendConsultantDigest(consultantEmail, orgIds);
    return { ok: true, sent_channels: sent };
  }

  private async sendConsultantDigest(consultantEmail: string, orgIds: string[]): Promise<string[]> {
    const snapshots = await Promise.all(
      orgIds.map(id => this.getOrgSnapshot(id)),
    );
    const valid = snapshots.filter(Boolean) as OrgSnapshot[];
    if (valid.length === 0) return [];

    const message = this.buildConsultantDigestMessage(consultantEmail, valid);
    const sent: string[] = [];
    try {
      await this.telegram.send(message);
      sent.push('telegram');
    } catch (err) {
      this.logger.error(`Consultant digest telegram failed for ${consultantEmail}: ${(err as Error).message}`);
    }
    // Email: look up consultant's email address (already have it) — send to all orgs they own
    try {
      await this.email.sendConsultantDigest(consultantEmail, valid);
      sent.push('email');
    } catch (err) {
      this.logger.error(`Consultant digest email failed for ${consultantEmail}: ${(err as Error).message}`);
    }
    return sent;
  }

  // ── Daily 9am — Cycle closure (kept for backward compat, uses per-org check) ─

  // ── Public: trigger any notification type immediately for one org ───────────

  async triggerForOrg(orgId: string, userId: string, type: string): Promise<{
    ok: boolean;
    sent_channels: string[];
    message?: string;
  }> {
    if (!VALID_TYPES.has(type as NotifType)) {
      return { ok: false, sent_channels: [], message: `Tipo desconocido: ${type}` };
    }

    const orgs = await this.activeOrgs(orgId);
    const org  = orgs[0];
    if (!org) {
      return { ok: false, sent_channels: [], message: 'Organización no encontrada o sin ciclo activo' };
    }

    const channels = await this.runNotification(org, type as NotifType);
    await this.updateSentAt(orgId, type as NotifType, channels);
    return { ok: true, sent_channels: channels };
  }

  // ── Core: decide which notifications are due for this org this hour ─────────

  private async processOrg(org: OrgInfo, now: Date, forceSend: boolean) {
    const cfg = org.notif_config;
    const tz  = cfg.timezone || 'America/Lima';

    // Local time in org's timezone
    const localHour  = this.getLocalHour(now, tz);
    const localDow   = this.getLocalDow(now, tz);    // 0=Sun … 6=Sat
    const localDom   = this.getLocalDom(now, tz);    // 1-31
    const localMonth = this.getLocalMonth(now, tz);  // 1-12

    const checks: Array<{ type: NotifType; setting: NotifSetting }> = [
      { type: 'risk_sentinel',     setting: cfg.risk_sentinel     ?? DEFAULT_CONFIG.risk_sentinel },
      { type: 'executive_briefer', setting: cfg.executive_briefer ?? DEFAULT_CONFIG.executive_briefer },
      { type: 'checkin_reminder',  setting: cfg.checkin_reminder  ?? DEFAULT_CONFIG.checkin_reminder },
      { type: 'cycle_closure',     setting: cfg.cycle_closure     ?? DEFAULT_CONFIG.cycle_closure },
      { type: 'agreement_status',  setting: cfg.agreement_status  ?? DEFAULT_CONFIG.agreement_status },
      { type: 'personal_briefing', setting: cfg.personal_briefing ?? DEFAULT_CONFIG.personal_briefing },
    ];

    for (const { type, setting } of checks) {
      if (!setting.enabled && !forceSend) continue;
      if (!this.isScheduledNow(setting, localHour, localDow, localDom, localMonth)) continue;
      if (this.wasRecentlySent(type, setting, org.notif_sent, now, tz)) continue;

      try {
        const sent = await this.runNotification(org, type);
        await this.updateSentAt(org.organization_id, type, sent);
      } catch (err) {
        this.logger.error(`Failed ${type} for ${org.org_name}: ${(err as Error).message}`);
      }
    }
  }

  // ── Check if hour/day matches ───────────────────────────────────────────────

  private isScheduledNow(
    setting: NotifSetting,
    localHour: number,
    localDow: number,
    localDom: number,
    localMonth: number,
  ): boolean {
    if (setting.hour !== localHour) return false;
    switch (setting.frequency) {
      case 'daily':
        return true;
      case 'weekly':
        return setting.day_of_week === localDow;
      case 'monthly':
        return localDom === (setting.day_of_month ?? 1);
      case 'quarterly': {
        const dom = setting.day_of_month ?? 1;
        const qsm = setting.quarter_start_month ?? 1;  // 1-12
        const quarterMonths = [0, 1, 2, 3].map(i => ((qsm - 1 + i * 3) % 12) + 1);
        return localDom === dom && quarterMonths.includes(localMonth);
      }
      case 'annual': {
        const dom = setting.day_of_month ?? 1;
        const mon = setting.month_of_year ?? 1;
        return localDom === dom && localMonth === mon;
      }
      default:
        return true;
    }
  }

  // ── Deduplication: skip if already sent recently ───────────────────────────

  private wasRecentlySent(
    type: NotifType,
    setting: NotifSetting,
    sent: NotifSentAt,
    now: Date,
    tz: string,
  ): boolean {
    const lastSentStr = sent[type];
    if (!lastSentStr) return false;

    const lastSent = new Date(lastSentStr);
    const diffHours = (now.getTime() - lastSent.getTime()) / 3_600_000;

    switch (setting.frequency) {
      case 'daily':     return diffHours < 20;    // allow re-schedule same day
      case 'weekly':    return diffHours < 144;   // 6 days
      case 'monthly':   return diffHours < 672;   // 28 days
      case 'quarterly': return diffHours < 2016;  // 84 days
      case 'annual':    return diffHours < 8400;  // 350 days
      default:          return false;
    }
  }

  // ── Run the actual notification and return which channels received it ───────

  private async runNotification(org: OrgInfo, type: NotifType): Promise<string[]> {
    const cfg           = org.notif_config;
    const setting       = (cfg[type] as NotifSetting | undefined) ?? DEFAULT_CONFIG[type];
    const channels      = setting?.channels ?? [];
    const tgChatId      = cfg.telegram_chat_id?.trim() || undefined;  // per-org override
    const extraEmails   = (cfg.email_recipients ?? '').split(',').map(e => e.trim()).filter(Boolean);
    const sent: string[] = [];

    switch (type) {

      case 'risk_sentinel': {
        const report = await this.ai.runRiskSentinel(org.organization_id) as Record<string, unknown>;
        const atRisk = report['total_at_risk'] as number;
        if (channels.includes('email') && atRisk > 0) {
          const allEmails = [org.owner_email, ...extraEmails].filter(Boolean);
          await Promise.all(allEmails.map(em => this.email.sendRiskDigest(em, org.org_name, report)));
          sent.push(`email(${allEmails.length})`);
        }
        if (channels.includes('telegram')) {
          await this.telegram.send(this.buildRiskMessage(org.org_name, report), tgChatId);
          sent.push('telegram');
        }
        break;
      }

      case 'executive_briefer': {
        const report = await this.ai.generateExecutiveBriefing(org.organization_id, org.owner_id) as Record<string, unknown>;
        if (channels.includes('email')) {
          const allEmails = [org.owner_email, ...extraEmails].filter(Boolean);
          await Promise.all(allEmails.map(em => this.email.sendExecutiveBriefing(em, org.org_name, report)));
          sent.push(`email(${allEmails.length})`);
        }
        if (channels.includes('telegram')) {
          await this.telegram.send(this.buildBriefingMessage(org.org_name, report), tgChatId);
          sent.push('telegram');
        }
        break;
      }

      case 'checkin_reminder': {
        const staleDays = (cfg.checkin_reminder?.stale_days) ?? 7;
        const stale = await this.db.query<Record<string, unknown>>(
          `SELECT kr_title, objective_title, owner_name, team_name,
                  progress, confidence, days_since_checkin
             FROM v_cadence_dashboard
            WHERE organization_id = $1 AND days_since_checkin > $2
            ORDER BY days_since_checkin DESC NULLS LAST
            LIMIT 5`,
          [org.organization_id, staleDays],
        );
        if (stale.length === 0) break;
        if (channels.includes('telegram')) {
          await this.telegram.send(this.buildStaleMessage(org.org_name, stale, staleDays), tgChatId);
          sent.push('telegram');
        }
        if (channels.includes('email')) {
          const allEmails = [org.owner_email, ...extraEmails].filter(Boolean);
          await Promise.all(allEmails.map(em =>
            this.email.sendCheckinReminderEmail(em, org.org_name, stale, staleDays),
          ));
          sent.push(`email(${allEmails.length})`);
        }
        break;
      }

      case 'agreement_status': {
        const dueSoonDays = (cfg.agreement_status?.stale_days) ?? 7;
        const agreements = await this.db.query<Record<string, unknown>>(
          `SELECT code, title, status, priority, due_date, is_overdue,
                  owner_name,
                  (due_date::date - CURRENT_DATE)::int AS days_remaining
             FROM v_agreements
            WHERE organization_id = $1
              AND status NOT IN ('FULFILLED','CANCELLED')
              AND (
                is_overdue = TRUE
                OR (due_date IS NOT NULL AND (due_date::date - CURRENT_DATE) BETWEEN 0 AND $2)
              )
            ORDER BY
              CASE WHEN is_overdue THEN 0 ELSE 1 END,
              due_date ASC NULLS LAST
            LIMIT 10`,
          [org.organization_id, dueSoonDays],
        );

        const stats = await this.db.query<Record<string, unknown>>(
          `SELECT
             COUNT(*)                                               AS total,
             COUNT(*) FILTER (WHERE status = 'PENDING')            AS pending,
             COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')        AS in_progress,
             COUNT(*) FILTER (WHERE is_overdue = TRUE)             AS overdue
           FROM v_agreements WHERE organization_id = $1 AND status NOT IN ('FULFILLED','CANCELLED')`,
          [org.organization_id],
        );
        const stat = stats[0] ?? {};

        if (Number(stat['total'] ?? 0) === 0 && agreements.length === 0) break;

        if (channels.includes('telegram')) {
          await this.telegram.send(this.buildAgreementStatusMessage(org.org_name, agreements, stat, dueSoonDays), tgChatId);
          sent.push('telegram');
        }
        if (channels.includes('email')) {
          const allEmails = [org.owner_email, ...extraEmails].filter(Boolean);
          await Promise.all(allEmails.map(em =>
            this.email.sendAgreementStatusEmail(em, org.org_name, agreements, stat, dueSoonDays),
          ));
          sent.push(`email(${allEmails.length})`);
        }
        break;
      }

      case 'personal_briefing': {
        // Send individual briefings to every active user in the org
        const users = await this.db.query<{ id: string; email: string; name: string }>(
          `SELECT id, email, name FROM users
            WHERE organization_id = $1 AND deleted_at IS NULL AND is_active = TRUE
            ORDER BY name`,
          [org.organization_id],
        );

        const summaries: { name: string; atRisk: number; agreements: number }[] = [];
        let emailCount = 0;

        for (const user of users) {
          try {
            const report = await this.ai.generatePersonalBriefing(org.organization_id, user.id) as Record<string, unknown>;
            if (report['error']) continue;

            if (channels.includes('email')) {
              await this.email.sendPersonalBriefing(user.email, user.name, report);
              emailCount++;
            }

            summaries.push({
              name: user.name,
              atRisk: (report['at_risk_count'] as number) ?? 0,
              agreements: (report['agreements_count'] as number) ?? 0,
            });
          } catch (err) {
            this.logger.error(`Personal briefing failed for ${user.email}: ${(err as Error).message}`);
          }
        }

        if (emailCount > 0) sent.push(`email(${emailCount})`);

        if (channels.includes('telegram') && summaries.length > 0) {
          await this.telegram.send(this.buildPersonalBriefingSummaryMessage(org.org_name, summaries), tgChatId);
          sent.push('telegram');
        }
        break;
      }

      case 'cycle_closure': {
        const closed = await this.db.query<Record<string, unknown>>(
          `SELECT c.id, c.name, o.name AS org_name,
                  fn_get_cycle_score(c.id) AS score,
                  COUNT(DISTINCT obj.id) FILTER (WHERE obj.deleted_at IS NULL)::int AS objective_count,
                  COUNT(DISTINCT obj.id) FILTER (WHERE obj.status = 'COMPLETED')::int AS completed_count
             FROM cycles c
             JOIN organizations o ON o.id = c.organization_id
             LEFT JOIN objectives obj ON obj.cycle_id = c.id
            WHERE DATE(c.end_date AT TIME ZONE 'America/Lima') = CURRENT_DATE - INTERVAL '1 day'
              AND c.organization_id = $1
              AND o.deleted_at IS NULL
            GROUP BY c.id, c.name, o.name`,
          [org.organization_id],
        );
        for (const cycle of closed) {
          if (channels.includes('telegram')) {
            await this.telegram.send(this.buildCycleClosedMessage(cycle), tgChatId);
            if (!sent.includes('telegram')) sent.push('telegram');
          }
          if (channels.includes('email')) {
            const report = await this.ai.generateExecutiveBriefing(org.organization_id, org.owner_id) as Record<string, unknown>;
            const allEmails = [org.owner_email, ...extraEmails].filter(Boolean);
            await Promise.all(allEmails.map(em =>
              this.email.sendExecutiveBriefing(em, org.org_name, { ...report, cycle_name: cycle['name'] }),
            ));
            if (!sent.includes(`email(${allEmails.length})`)) sent.push(`email(${allEmails.length})`);
          }
        }
        if (closed.length === 0 && channels.includes('telegram')) {
          // Manual trigger: send current cycle briefing when no cycles closed yesterday
          const report = await this.ai.generateExecutiveBriefing(org.organization_id, org.owner_id) as Record<string, unknown>;
          await this.telegram.send(this.buildBriefingMessage(org.org_name, report), tgChatId);
          sent.push('telegram');
        }
        break;
      }
    }

    return sent;
  }

  // ── Update last-sent timestamp + log (last 5) in org.parameters ─────────────

  private async updateSentAt(orgId: string, type: NotifType, channels: string[] = []) {
    const sentKey = `notif_sent_${type}`;
    const logKey  = `notif_log_${type}`;
    const now     = new Date().toISOString();
    const entry   = JSON.stringify({ sent_at: now, channels });

    // Atomic: set timestamp + prepend log entry, keep last 5
    await this.db.execute(
      `UPDATE organizations
          SET parameters = parameters
            || jsonb_build_object($2::text, $3::text)
            || jsonb_build_object(
                 $4::text,
                 (jsonb_build_array($5::jsonb) || COALESCE(parameters->$4::text, '[]'::jsonb))[0:4]
               )
        WHERE id = $1`,
      [orgId, sentKey, now, logKey, entry],
    );
  }

  // ── Timezone helpers ───────────────────────────────────────────────────────

  private getLocalHour(utc: Date, tz: string): number {
    return parseInt(utc.toLocaleString('en-US', { timeZone: tz, hour: 'numeric', hour12: false }), 10);
  }

  private getLocalDow(utc: Date, tz: string): number {
    return new Date(utc.toLocaleString('en-US', { timeZone: tz })).getDay();
  }

  private getLocalDom(utc: Date, tz: string): number {
    return parseInt(utc.toLocaleString('en-US', { timeZone: tz, day: 'numeric' }), 10);
  }

  private getLocalMonth(utc: Date, tz: string): number {
    return parseInt(utc.toLocaleString('en-US', { timeZone: tz, month: 'numeric' }), 10);
  }

  // ── DB helpers ─────────────────────────────────────────────────────────────

  private activeOrgs(specificOrgId?: string): Promise<OrgInfo[]> {
    const filter = specificOrgId ? `AND c.organization_id = '${specificOrgId}'` : '';
    return this.db.query<OrgInfo>(
      `SELECT DISTINCT ON (c.organization_id)
              c.organization_id,
              o.name AS org_name,
              u.email AS owner_email,
              u.id    AS owner_id,
              COALESCE(o.settings -> 'notifications', '{}'::jsonb) AS notif_config,
              jsonb_build_object(
                'risk_sentinel',     o.settings->>'notif_sent_risk_sentinel',
                'executive_briefer', o.settings->>'notif_sent_executive_briefer',
                'checkin_reminder',  o.settings->>'notif_sent_checkin_reminder',
                'cycle_closure',     o.settings->>'notif_sent_cycle_closure',
                'agreement_status',  o.settings->>'notif_sent_agreement_status',
                'personal_briefing', o.settings->>'notif_sent_personal_briefing'
              ) AS notif_sent
         FROM cycles c
         JOIN organizations o ON o.id = c.organization_id
         JOIN users u ON u.organization_id = c.organization_id
                     AND u.role = 'OWNER'
                     AND u.deleted_at IS NULL
        WHERE c.status = 'ACTIVE'
          AND o.deleted_at IS NULL
          ${filter}`,
      [],
    );
  }

  // ── Message builders ───────────────────────────────────────────────────────

  private buildRiskMessage(orgName: string, r: Record<string, unknown>): string {
    const atRisk     = r['total_at_risk']         as number;
    const company    = r['company_level_at_risk'] as number;
    const stale      = r['stale_krs']             as number;
    const cycle      = r['cycle']                 as string | undefined;
    const analysis   = r['analysis']              as string | undefined;
    const priorities = (r['priorities']           as string[] | undefined) ?? [];
    const krs        = (r['at_risk_krs']          as Record<string, unknown>[] | undefined) ?? [];

    const lines: string[] = [
      `🚨 <b>Risk Sentinel</b>`,
      `<i>${e(orgName)}</i>${cycle ? `  ·  <i>${e(cycle)}</i>` : ''}`,
      ``,
      `<b>⚠️ ${atRisk} KR${atRisk !== 1 ? 's' : ''} en riesgo</b>`,
    ];

    const meta: string[] = [];
    if (company > 0) meta.push(`${company} a nivel empresa`);
    if (stale > 0)   meta.push(`${stale} sin check-in +14d`);
    if (meta.length) lines.push(meta.join('  ·  '));

    if (priorities.length) {
      lines.push(``, `<b>Prioridades críticas:</b>`);
      priorities.slice(0, 3).forEach((p, i) => lines.push(`${i + 1}. ${e(p)}`));
    } else if (krs.length) {
      lines.push(``, `<b>KRs más críticos:</b>`);
      krs.slice(0, 3).forEach((k) => {
        const conf = Math.round(Number(k['confidence'] ?? 0) * 100);
        const prog = Math.round(Number(k['progress']   ?? 0));
        lines.push(`• <b>${e(String(k['kr_title'] ?? ''))}</b>`);
        lines.push(`  conf. <code>${bar(conf)}</code> ${conf}%  ·  prog. ${prog}%`);
      });
    }

    if (analysis) lines.push(``, `<i>${e(analysis.slice(0, 300))}</i>`);
    lines.push(``, `<code>🕐 ${ts()}</code>`);
    return lines.join('\n');
  }

  private buildBriefingMessage(orgName: string, r: Record<string, unknown>): string {
    const cycle     = r['cycle_name']        as string | undefined;
    const score     = r['cycle_score']       as number | undefined;
    const onTrack   = (r['on_track']         as number) ?? 0;
    const behind    = (r['behind']           as number) ?? 0;
    const atRisk    = (r['at_risk_count']    as number) ?? 0;
    const total     = (r['total_objectives'] as number) ?? 0;
    const narrative = r['narrative']         as string | undefined;
    const nextSteps = (r['next_steps']       as string[] | undefined) ?? [];
    const highlights= (r['highlights']       as string[] | undefined) ?? [];

    const scoreStr = score !== undefined ? ` — score <b>${score}/10</b>` : '';
    const lines: string[] = [
      `📊 <b>Briefing Semanal</b>`,
      `<i>${e(orgName)}</i>${cycle ? `  ·  <i>${e(cycle)}</i>` : ''}${scoreStr}`,
      ``,
      `✅ <b>${onTrack}</b> en camino   ⚠️ <b>${behind}</b> rezagados   🔴 <b>${atRisk}</b> en riesgo   📌 ${total} total`,
    ];

    if (total > 0) {
      const pct = Math.round((onTrack / total) * 100);
      lines.push(`<code>${bar(pct)}</code> ${pct}% de objetivos en camino`);
    }

    if (narrative)      lines.push(``, `<i>${e(narrative.slice(0, 300))}</i>`);
    if (highlights.length) {
      lines.push(``, `<b>Destacados:</b>`);
      highlights.slice(0, 2).forEach((h) => lines.push(`✨ ${e(h)}`));
    }
    if (nextSteps.length) {
      lines.push(``, `<b>Próximos pasos:</b>`);
      nextSteps.slice(0, 3).forEach((s) => lines.push(`▶️ ${e(s)}`));
    }

    lines.push(``, `<code>🕐 ${ts()}</code>`);
    return lines.join('\n');
  }

  private buildStaleMessage(orgName: string, stale: Record<string, unknown>[], staleDays: number): string {
    const lines: string[] = [
      `⏰ <b>Check-in Reminder</b>`,
      `<i>${e(orgName)}</i>`,
      ``,
      `<b>${stale.length} KR${stale.length !== 1 ? 's' : ''} sin actualizar en más de ${staleDays} días:</b>`,
      ``,
    ];
    stale.forEach((k) => {
      const days = k['days_since_checkin'] != null ? `${k['days_since_checkin']}d` : '?';
      lines.push(`• <b>${e(String(k['kr_title'] ?? ''))}</b>  <code>${days} sin check-in</code>`);
    });
    lines.push(``, `<code>🕐 ${ts()}</code>`);
    return lines.join('\n');
  }

  private buildAgreementStatusMessage(
    orgName: string,
    items: Record<string, unknown>[],
    stat: Record<string, unknown>,
    dueSoonDays: number,
  ): string {
    const overdue   = Number(stat['overdue']     ?? 0);
    const pending   = Number(stat['pending']     ?? 0);
    const inProg    = Number(stat['in_progress'] ?? 0);
    const total     = Number(stat['total']       ?? 0);

    const STATUS_LABEL: Record<string, string> = {
      PENDING:     '🕐 Pendiente',
      IN_PROGRESS: '🔄 En curso',
    };
    const PRIORITY_ICON: Record<string, string> = {
      CRITICAL: '🔴',
      HIGH:     '🟠',
      MEDIUM:   '🟡',
      LOW:      '⚪',
    };

    const lines: string[] = [
      `📋 <b>Estado de Acuerdos</b>`,
      `<i>${e(orgName)}</i>`,
      ``,
    ];

    // Summary line
    const summary: string[] = [];
    if (overdue > 0)  summary.push(`🔴 <b>${overdue} vencido${overdue !== 1 ? 's' : ''}</b>`);
    if (pending > 0)  summary.push(`🕐 ${pending} pendiente${pending !== 1 ? 's' : ''}`);
    if (inProg  > 0)  summary.push(`🔄 ${inProg} en curso`);
    if (total   > 0)  lines.push(summary.join('   ·   '));
    else              lines.push(`✅ Sin acuerdos activos`);

    if (items.length > 0) {
      lines.push(``, `<b>Acuerdos que requieren atención:</b>`);
      for (const a of items) {
        const code     = a['code']           ? `<code>${e(String(a['code']))}</code> ` : '';
        const title    = e(String(a['title'] ?? ''));
        const status   = STATUS_LABEL[String(a['status'] ?? '')] ?? String(a['status'] ?? '');
        const priIcon  = PRIORITY_ICON[String(a['priority'] ?? 'MEDIUM')] ?? '⚪';
        const isOver   = a['is_overdue'] === true;
        const daysRem  = a['days_remaining'] != null ? Number(a['days_remaining']) : null;
        const owner    = a['owner_name'] ? `  👤 ${e(String(a['owner_name']))}` : '';

        let timing: string;
        if (isOver) {
          const daysLate = daysRem != null ? Math.abs(daysRem) : '?';
          timing = `⚠️ Vencido hace ${daysLate} día${daysLate !== 1 ? 's' : ''}`;
        } else if (daysRem === 0) {
          timing = `⏰ Vence <b>hoy</b>`;
        } else if (daysRem != null) {
          timing = `⏳ Faltan <b>${daysRem} día${daysRem !== 1 ? 's' : ''}</b>`;
        } else {
          timing = `📅 Sin fecha`;
        }

        lines.push(``, `${priIcon} ${code}<b>${title}</b>`);
        lines.push(`   ${status}${owner}`);
        lines.push(`   ${timing}`);
      }
    }

    lines.push(``, `<i>Mostrando acuerdos vencidos o que vencen en ${dueSoonDays} días.</i>`);
    lines.push(`<code>🕐 ${ts()}</code>`);
    return lines.join('\n');
  }

  // ── Org snapshot for consultant digest ────────────────────────────────────

  private async getOrgSnapshot(orgId: string): Promise<OrgSnapshot | null> {
    const rows = await this.db.query<OrgSnapshot>(
      `SELECT
         o.id                   AS org_id,
         o.name                 AS org_name,
         c.id                   AS cycle_id,
         c.name                 AS cycle_name,
         ROUND(fn_get_cycle_score(c.id)::numeric, 1)::float AS cycle_score,
         COUNT(obj.id) FILTER (WHERE obj.deleted_at IS NULL AND obj.status NOT IN ('COMPLETED','CANCELLED'))::int AS active_objectives,
         COUNT(obj.id) FILTER (WHERE obj.deleted_at IS NULL AND obj.status NOT IN ('COMPLETED','CANCELLED') AND obj.progress >= 70)::int AS on_track,
         COUNT(obj.id) FILTER (WHERE obj.deleted_at IS NULL AND obj.status NOT IN ('COMPLETED','CANCELLED') AND obj.progress < 40)::int AS at_risk,
         COUNT(obj.id) FILTER (WHERE obj.deleted_at IS NULL AND obj.status = 'COMPLETED')::int AS completed,
         COUNT(kr.id)  FILTER (WHERE kr.deleted_at IS NULL AND kr.status NOT IN ('COMPLETED','CANCELLED') AND kr.confidence < 0.4)::int AS krs_at_risk
       FROM organizations o
       LEFT JOIN LATERAL (
         SELECT id, name FROM cycles
         WHERE organization_id = o.id AND status = 'ACTIVE'
         ORDER BY start_date DESC NULLS LAST
         LIMIT 1
       ) c ON TRUE
       LEFT JOIN objectives obj ON obj.cycle_id = c.id
       LEFT JOIN key_results kr ON kr.objective_id = obj.id
      WHERE o.id = $1 AND o.deleted_at IS NULL
      GROUP BY o.id, o.name, c.id, c.name`,
      [orgId],
    );
    return rows[0] ?? null;
  }

  private buildConsultantDigestMessage(email: string, orgs: OrgSnapshot[]): string {
    const totalAtRisk = orgs.reduce((s, o) => s + o.at_risk, 0);
    const totalKrsAtRisk = orgs.reduce((s, o) => s + o.krs_at_risk, 0);
    const avgScore = orgs.length > 0
      ? (orgs.reduce((s, o) => s + (o.cycle_score ?? 0), 0) / orgs.length).toFixed(1)
      : '—';

    const lines: string[] = [
      `📊 <b>Digest Semanal de Consultor</b>`,
      `<i>${e(email)}</i>  ·  <b>${orgs.length}</b> empresa${orgs.length !== 1 ? 's' : ''} cliente`,
      ``,
      `Score promedio: <b>${avgScore}/10</b>   ⚠️ <b>${totalAtRisk}</b> obj. rezagados   🔴 <b>${totalKrsAtRisk}</b> KRs en riesgo`,
      ``,
    ];

    for (const org of orgs) {
      const score  = org.cycle_score !== null ? `<b>${org.cycle_score}/10</b>` : '<i>sin ciclo</i>';
      const cycle  = org.cycle_name ? `· <i>${e(org.cycle_name)}</i>` : '';
      const health = org.at_risk > 0 ? `  ⚠️ ${org.at_risk} rezag.` : '';
      const krsWarn = org.krs_at_risk > 0 ? `  🔴 ${org.krs_at_risk} KRs` : '';
      const pct    = org.active_objectives > 0
        ? `<code>${bar(Math.round((org.on_track / org.active_objectives) * 100))}</code>`
        : '';
      lines.push(`<b>${e(org.org_name)}</b> ${cycle}`);
      lines.push(`  Score: ${score}${health}${krsWarn}`);
      if (pct) lines.push(`  ${pct} ${org.on_track}/${org.active_objectives} en camino`);
    }

    lines.push(``, `<code>🕐 ${ts()}</code>`);
    return lines.join('\n');
  }

  private buildPersonalBriefingSummaryMessage(
    orgName: string,
    summaries: { name: string; atRisk: number; agreements: number }[],
  ): string {
    const withAlerts = summaries.filter(s => s.atRisk > 0 || s.agreements > 0).length;
    const lines: string[] = [
      `📋 <b>Briefings Pre-reunión Enviados</b>`,
      `<i>${e(orgName)}</i>  ·  <b>${summaries.length}</b> persona${summaries.length !== 1 ? 's' : ''}`,
      ``,
      withAlerts > 0
        ? `⚠️ <b>${withAlerts}</b> con alertas activas`
        : `✅ Sin alertas críticas esta semana`,
      ``,
    ];
    for (const s of summaries) {
      const flags: string[] = [];
      if (s.atRisk > 0)     flags.push(`🔴 ${s.atRisk} KR${s.atRisk > 1 ? 's' : ''}`);
      if (s.agreements > 0) flags.push(`⚠️ ${s.agreements} acuerdo${s.agreements > 1 ? 's' : ''}`);
      lines.push(`• <b>${e(s.name)}</b>${flags.length ? `  ·  ${flags.join(' ')}` : '  ✅'}`);
    }
    lines.push(``, `<code>🕐 ${ts()}</code>`);
    return lines.join('\n');
  }

  private buildCycleClosedMessage(cycle: Record<string, unknown>): string {
    const score     = Number(cycle['score']           ?? 0).toFixed(1);
    const total     = Number(cycle['objective_count'] ?? 0);
    const completed = Number(cycle['completed_count'] ?? 0);
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;

    return [
      `🏁 <b>Ciclo Cerrado</b>`,
      `<i>${e(String(cycle['org_name'] ?? ''))}</i>  ·  <b>${e(String(cycle['name'] ?? ''))}</b>`,
      ``,
      `Score final: <b>${score}/10</b>`,
      `Objetivos completados: <b>${completed}/${total}</b>`,
      `<code>${bar(pct)}</code> ${pct}%`,
      ``,
      `<i>Revisa el cierre completo en el sistema para el briefing final.</i>`,
      ``,
      `<code>🕐 ${ts()}</code>`,
    ].join('\n');
  }
}
