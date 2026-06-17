import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { NotificationsGateway } from '../../common/notifications/notifications.gateway';
import { RedisService } from '../../common/redis/redis.service';
import { TelegramService } from '../../common/telegram/telegram.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { asPgError } from '../../common/utils/db-error';

const e   = TelegramService.esc;
const bar = TelegramService.bar;

interface ForecastTelegramData {
  kr_title: string;
  kr_owner_name: string;
  obj_title: string;
  obj_owner_name: string;
  org_name: string;
  org_chat_id: string;
  forecast: Record<string, unknown>;
}

@Injectable()
export class CheckInsService {
  constructor(
    private readonly db: DbService,
    private readonly redis: RedisService,
    private readonly telegram: TelegramService,
    @Optional() private readonly notifications?: NotificationsGateway,
  ) {}

  private async verifyKrOwnership(orgId: string, krId: string) {
    const kr = await this.db.queryOne<{ id: string; status: string }>(
      `SELECT kr.id, kr.status
         FROM key_results kr
         JOIN objectives o ON kr.objective_id = o.id
        WHERE kr.id = $1 AND o.organization_id = $2 AND kr.deleted_at IS NULL`,
      [krId, orgId],
    );
    if (!kr) throw new NotFoundException('Resultado clave no encontrado');
    return kr;
  }

  async create(orgId: string, krId: string, userId: string, dto: CreateCheckInDto) {
    const kr = await this.verifyKrOwnership(orgId, krId);
    if (kr.status === 'COMPLETED') {
      throw new BadRequestException('No se puede registrar un check-in en un KR completado');
    }
    if (kr.status === 'CANCELLED') {
      throw new BadRequestException('No se puede registrar un check-in en un KR cancelado');
    }

    try {
      const [row] = await this.db.query<{ p_checkin_id: string }>(
        `CALL sp_create_check_in($1, $2, $3, $4, $5, $6, NULL)`,
        [krId, userId, dto.current_value, dto.confidence, dto.notes ?? null, dto.mood ?? null],
      );
      const checkInId = row.p_checkin_id;
      const [checkIn] = await this.db.query(
        `SELECT * FROM v_check_in_history WHERE id = $1`,
        [checkInId],
      );

      const orgRow = await this.db.queryOne<{ organization_id: string }>(
        `SELECT o.organization_id FROM key_results kr JOIN objectives o ON o.id = kr.objective_id WHERE kr.id = $1`,
        [krId],
      );
      if (orgRow) {
        this.notifications?.emitToOrg(orgRow.organization_id, 'checkin:created', {
          kr_id: krId, user_id: userId, ts: new Date().toISOString(),
        });
        this.redis.delPattern(`reports:*:${orgRow.organization_id}:*`).catch(() => {});

        // Forecast: call procedure, check if a new notification was created, and if so send Telegram
        setImmediate(() => {
          this.handleForecastNotification(krId, orgRow.organization_id).catch(() => {});
        });
      }

      return checkIn;
    } catch (err: unknown) {
      const e = asPgError(err);
      const code = e.code ?? '';
      const msg  = e.message ?? '';
      if (code === 'P0020' || msg.includes('anterior al último')) {
        throw new BadRequestException('No se puede registrar un check-in con fecha anterior al último check-in');
      }
      if (code === '23514') throw new BadRequestException(`Valor no permitido: ${msg}`);
      if (code === '23502') throw new BadRequestException('Falta un campo obligatorio');
      throw err;
    }
  }

  private async handleForecastNotification(krId: string, orgId: string): Promise<void> {
    const [row] = await this.db.query<{ p_notification_id: string | null }>(
      `CALL sp_send_forecast_notification($1, $2, NULL)`,
      [krId, orgId],
    );
    if (!row?.p_notification_id) return; // deduped or not at risk

    await this.sendForecastTelegram(krId, orgId);
  }

  private async sendForecastTelegram(krId: string, orgId: string): Promise<void> {
    if (!this.telegram.isConfigured) return;

    const data = await this.db.queryOne<ForecastTelegramData>(
      `SELECT
         kr.title                                                   AS kr_title,
         COALESCE(kr_owner.name, 'Sin asignar')                    AS kr_owner_name,
         o.title                                                    AS obj_title,
         COALESCE(obj_owner.name, '')                              AS obj_owner_name,
         org.name                                                   AS org_name,
         COALESCE(org.settings->'notifications'->>'telegram_chat_id', '') AS org_chat_id,
         fn_kr_forecast(kr.id)                                     AS forecast
       FROM key_results kr
       JOIN objectives o   ON o.id  = kr.objective_id
       JOIN organizations org ON org.id = o.organization_id
       LEFT JOIN users kr_owner  ON kr_owner.id  = kr.owner_id
       LEFT JOIN users obj_owner ON obj_owner.id = o.owner_id
       WHERE kr.id = $1 AND o.organization_id = $2`,
      [krId, orgId],
    );
    if (!data) return;

    const fc         = data.forecast;
    const action     = fc['action_type'] as string;
    const projPct    = Number(fc['projected_completion_pct']);
    const gapUnits   = Number(fc['gap_units']);
    const metricUnit = String(fc['metric_unit'] ?? '');
    const daysRem    = Number(fc['days_remaining']);
    const weeksRem   = Number(fc['weeks_remaining']);
    const paceC      = Number(fc['pace_current_per_day']);
    const paceN      = Number(fc['pace_needed_per_day']);
    const recCw      = Number(fc['recommended_checkins_per_week']);
    const vpci       = Number(fc['value_needed_per_checkin']);
    const daysCi     = Number(fc['days_since_last_checkin']);
    const cadDays    = Number(fc['cadence_days']);
    const pesPct     = Number(fc['scenario_pessimistic_pct']);
    const basePct    = Number(fc['scenario_base_pct']);
    const optPct     = Number(fc['scenario_optimistic_pct']);

    const actionIcon = action === 'URGENT_CHECKIN' ? '⏰' : '📉';
    const actionLine = action === 'URGENT_CHECKIN'
      ? `<b>${daysCi} días sin check-in</b> (cadencia: cada ${cadDays} días)`
      : `<b>Necesitas acelerar el ritmo</b> — proyección: ${projPct}%`;

    const superiorLine = data.obj_owner_name && data.obj_owner_name !== data.kr_owner_name
      ? `\n👆 Superior: <b>${e(data.obj_owner_name)}</b> (owner del objetivo)`
      : '';

    const gapLine = gapUnits > 0
      ? `\n📍 Brecha: <b>${gapUnits} ${e(metricUnit)}</b> por debajo de la meta`
      : '';

    const velocityLine = paceN > 0
      ? `\n⚡ Ritmo actual: ${paceC} ${e(metricUnit)}/día  →  Necesario: ${paceN} ${e(metricUnit)}/día\n   ${bar(Math.round((paceC / paceN) * 100))} ${Math.round((paceC / paceN) * 100)}% del ritmo necesario`
      : '';

    const vpciLine = vpci > 0 ? ` (+${vpci} ${e(metricUnit)}/check-in)` : '';

    const html = [
      `${actionIcon} <b>Alerta de cierre — KR en riesgo</b>`,
      `<b>${e(data.org_name)}</b>`,
      ``,
      `📌 ${e(data.kr_title)}`,
      `👤 Responsable: <b>${e(data.kr_owner_name)}</b>${superiorLine}`,
      `🎯 Objetivo: ${e(data.obj_title)}`,
      ``,
      `━━━━━━━━━━━━━━━━━━━━`,
      ``,
      `${actionIcon} ${actionLine}`,
      ``,
      `📊 <b>Proyección al cierre del ciclo</b>`,
      `   ${bar(projPct)} <b>${projPct}%</b>`,
      `   Escenarios: ${pesPct}% · ${basePct}% · ${optPct}%${gapLine}${velocityLine}`,
      ``,
      `⏳ Quedan <b>${daysRem} días</b> (${weeksRem} semanas)`,
      ``,
      `💡 <b>Acción recomendada:</b> ${recCw} check-in(s)/semana${vpciLine}`,
    ].join('\n');

    const chatId = data.org_chat_id || undefined;
    await this.telegram.send(html, chatId);
  }

  async getHistory(orgId: string, krId: string) {
    await this.verifyKrOwnership(orgId, krId);
    return this.db.query(
      `SELECT * FROM v_check_in_history WHERE kr_id = $1 ORDER BY checked_at DESC`,
      [krId],
    );
  }

  async getAtRiskKrs(orgId: string, cycleId?: string) {
    const params: unknown[] = [orgId];
    let sql = `SELECT * FROM v_at_risk_krs WHERE organization_id = $1`;
    if (cycleId) {
      params.push(cycleId);
      sql += ` AND cycle_id = $${params.length}`;
    }
    return this.db.query(sql, params);
  }

  async getCadenceDashboard(orgId: string, cycleId: string) {
    return this.db.query(
      `SELECT * FROM v_cadence_dashboard WHERE organization_id = $1 AND cycle_id = $2`,
      [orgId, cycleId],
    );
  }

  async getPrediction(orgId: string, krId: string) {
    await this.verifyKrOwnership(orgId, krId);
    const [row] = await this.db.query<{ fn_kr_forecast: Record<string, unknown> }>(
      `SELECT fn_kr_forecast($1)`,
      [krId],
    );
    return row.fn_kr_forecast;
  }

  async getNotifications(orgId: string, userId: string) {
    return this.db.query(
      `SELECT * FROM notifications
        WHERE organization_id = $1
          AND (user_id = $2 OR user_id IS NULL)
        ORDER BY created_at DESC
        LIMIT 50`,
      [orgId, userId],
    );
  }

  async markNotificationRead(orgId: string, userId: string, notifId: string) {
    const notif = await this.db.queryOne(
      `SELECT id FROM notifications WHERE id = $1 AND organization_id = $2 AND (user_id = $3 OR user_id IS NULL)`,
      [notifId, orgId, userId],
    );
    if (!notif) throw new NotFoundException('Notificación no encontrada');
    await this.db.execute(
      `UPDATE notifications SET read_at = NOW() WHERE id = $1`,
      [notifId],
    );
    return { success: true };
  }

  async markAllNotificationsRead(orgId: string, userId: string) {
    await this.db.execute(
      `UPDATE notifications SET read_at = NOW()
        WHERE organization_id = $1
          AND (user_id = $2 OR user_id IS NULL)
          AND read_at IS NULL`,
      [orgId, userId],
    );
    return { success: true };
  }

  async runStaleKrsCron(orgId: string) {
    await this.db.execute(`CALL sp_mark_stale_krs_at_risk($1)`, [orgId]);
  }
}
