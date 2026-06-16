import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import * as OTPAuth from 'otpauth';
import * as QRCode from 'qrcode';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface UserProfile {
  user_id: string;
  timezone: string;
  locale: string;
  notify_at_risk: boolean;
  notify_checkin_reminder: boolean;
  notify_weekly_briefing: boolean;
  updated_at: string;
}

@Injectable()
export class UsersService {
  constructor(private readonly db: DbService) {}

  // ── Profile ────────────────────────────────────────────────

  async getProfile(userId: string): Promise<UserProfile> {
    const row = await this.db.queryOne<UserProfile>(
      `SELECT * FROM user_profiles WHERE user_id = $1`,
      [userId],
    );
    if (!row) {
      // Auto-create if missing (shouldn't happen after migration backfill)
      await this.db.execute(`INSERT INTO user_profiles(user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId]);
      return this.getProfile(userId);
    }
    return row;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserProfile> {
    const current = await this.getProfile(userId);
    await this.db.execute(
      `CALL sp_update_user_profile($1,$2,$3,$4,$5,$6)`,
      [
        userId,
        dto.timezone ?? current.timezone,
        dto.locale   ?? current.locale,
        dto.notify_at_risk           ?? current.notify_at_risk,
        dto.notify_checkin_reminder  ?? current.notify_checkin_reminder,
        dto.notify_weekly_briefing   ?? current.notify_weekly_briefing,
      ],
    );
    return this.getProfile(userId);
  }

  // ── MFA ───────────────────────────────────────────────────

  async setupMfa(userId: string): Promise<{ secret: string; otpauthUrl: string; qrCodeDataUrl: string }> {
    const user = await this.db.queryOne<{ email: string; name: string }>(
      `SELECT email, name FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [userId],
    );
    if (!user) throw new NotFoundException('Usuario no encontrado');

    // Revoke any pending unverified MFA secret
    await this.db.execute(
      `DELETE FROM user_mfa_secrets WHERE user_id = $1 AND is_active = false`,
      [userId],
    );

    // Generate new TOTP secret
    const totp = new OTPAuth.TOTP({
      issuer: 'OKR System',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });

    const secretBase32 = totp.secret.base32;
    const otpauthUrl = totp.toString();

    await this.db.execute(
      `INSERT INTO user_mfa_secrets(user_id, secret_base32, is_active)
       VALUES ($1, $2, false)
       ON CONFLICT (user_id) DO UPDATE SET secret_base32 = $2, is_active = false, verified_at = NULL`,
      [userId, secretBase32],
    );

    const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl);
    return { secret: secretBase32, otpauthUrl, qrCodeDataUrl };
  }

  async enableMfa(userId: string, code: string): Promise<void> {
    const row = await this.db.queryOne<{ secret_base32: string; is_active: boolean }>(
      `SELECT secret_base32, is_active FROM user_mfa_secrets WHERE user_id = $1`,
      [userId],
    );
    if (!row) throw new NotFoundException('MFA no configurado. Llama a /auth/mfa/setup primero.');
    if (row.is_active) throw new ConflictException('MFA ya está habilitado.');

    if (!this.verifyTotpCode(row.secret_base32, code)) {
      throw new ForbiddenException('Código MFA inválido');
    }

    await this.db.execute(
      `UPDATE user_mfa_secrets SET is_active = true, verified_at = NOW() WHERE user_id = $1`,
      [userId],
    );
  }

  async disableMfa(userId: string, code: string): Promise<void> {
    const row = await this.db.queryOne<{ secret_base32: string; is_active: boolean }>(
      `SELECT secret_base32, is_active FROM user_mfa_secrets WHERE user_id = $1`,
      [userId],
    );
    if (!row || !row.is_active) throw new NotFoundException('MFA no está habilitado.');

    if (!this.verifyTotpCode(row.secret_base32, code)) {
      throw new ForbiddenException('Código MFA inválido');
    }

    await this.db.execute(`DELETE FROM user_mfa_secrets WHERE user_id = $1`, [userId]);
  }

  async getMfaStatus(userId: string): Promise<{ enabled: boolean; verified_at: string | null }> {
    const row = await this.db.queryOne<{ is_active: boolean; verified_at: string | null }>(
      `SELECT is_active, verified_at FROM user_mfa_secrets WHERE user_id = $1`,
      [userId],
    );
    return { enabled: row?.is_active ?? false, verified_at: row?.verified_at ?? null };
  }

  verifyTotpCode(secretBase32: string, code: string): boolean {
    const totp = new OTPAuth.TOTP({
      secret: OTPAuth.Secret.fromBase32(secretBase32),
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
    });
    // delta=1 allows ±30s clock drift
    const delta = totp.validate({ token: code, window: 1 });
    return delta !== null;
  }

  // ── My Work ───────────────────────────────────────────────

  async getMyWork(userId: string, orgId: string, cycleId?: string) {
    const cycleParam = cycleId ?? null;

    const [krs, northStar, activeCycle] = await Promise.all([
      this.db.query<{
        kr_id: string; kr_title: string; current_value: number; target_value: number;
        start_value: number; metric_unit: string | null; confidence_pct: number;
        kr_status: string; kr_progress: number; check_in_cadence: string | null;
        objective_id: string; objective_title: string; objective_code: string | null;
        level: string; objective_progress: number; objective_status: string;
        team_id: string | null; team_name: string | null;
        area_id: string | null; area_name: string | null;
        last_checkin_at: string | null; days_since_checkin: number;
        cycle_id: string; cycle_name: string; cycle_end_date: string;
      }>(
        `SELECT
           kr.id AS kr_id, kr.title AS kr_title,
           kr.current_value, kr.target_value, kr.start_value, kr.metric_unit,
           ROUND(kr.confidence * 100)::int AS confidence_pct,
           kr.status AS kr_status,
           CASE WHEN (kr.target_value - kr.start_value) = 0 THEN 0
             ELSE LEAST(100, ROUND(((kr.current_value - kr.start_value) /
               (kr.target_value - kr.start_value)) * 100))::int
           END AS kr_progress,
           kr.check_in_cadence,
           o.id AS objective_id, o.title AS objective_title, o.code AS objective_code,
           o.level, fn_calculate_objective_progress(o.id)::int AS objective_progress,
           o.status AS objective_status,
           t.id AS team_id, t.name AS team_name,
           a.id AS area_id, a.name AS area_name,
           (SELECT MAX(ci.checked_at) FROM check_ins ci WHERE ci.kr_id = kr.id) AS last_checkin_at,
           COALESCE(GREATEST(0, EXTRACT(EPOCH FROM (NOW() -
             (SELECT MAX(ci.checked_at) FROM check_ins ci WHERE ci.kr_id = kr.id)))::int / 86400), 999)::int AS days_since_checkin,
           c.id AS cycle_id, c.name AS cycle_name, c.end_date::text AS cycle_end_date
         FROM key_results kr
         JOIN objectives o ON o.id = kr.objective_id
         LEFT JOIN teams t ON t.id = o.team_id
         LEFT JOIN areas a ON a.id = t.area_id
         JOIN cycles c ON c.id = o.cycle_id
         WHERE kr.owner_id = $1
           AND o.organization_id = $2
           AND o.deleted_at IS NULL
           AND kr.deleted_at IS NULL
           AND kr.status NOT IN ('CANCELLED','COMPLETED')
           AND ($3::uuid IS NULL OR c.id = $3)
           AND c.status = 'ACTIVE'
         ORDER BY o.level, o.title, kr.title`,
        [userId, orgId, cycleParam],
      ),
      this.db.query<{
        id: string; title: string; code: string | null; progress: number;
        status: string; cycle_name: string;
      }>(
        `SELECT o.id, o.title, o.code,
           fn_calculate_objective_progress(o.id)::int AS progress,
           o.status, c.name AS cycle_name
         FROM objectives o
         JOIN cycles c ON c.id = o.cycle_id
         WHERE o.organization_id = $1
           AND o.level = 'COMPANY'
           AND o.deleted_at IS NULL
           AND o.status = 'ACTIVE'
           AND c.status = 'ACTIVE'
           AND ($2::uuid IS NULL OR c.id = $2)
         ORDER BY o.title`,
        [orgId, cycleParam],
      ),
      this.db.queryOne<{ id: string; name: string; end_date: string; days_remaining: number }>(
        `SELECT id, name, end_date::text,
           GREATEST(0, end_date::date - CURRENT_DATE)::int AS days_remaining
         FROM cycles WHERE organization_id = $1 AND status = 'ACTIVE'
           AND ($2::uuid IS NULL OR id = $2)
         ORDER BY start_date DESC LIMIT 1`,
        [orgId, cycleParam],
      ),
    ]);

    return { krs, north_star: northStar, cycle: activeCycle };
  }

  // ── First Day Onboarding ──────────────────────────────────

  async getFirstDayContext(userId: string, orgId: string) {
    const [row] = await this.db.query<{ fn_first_day_context: Record<string, unknown> }>(
      `SELECT fn_first_day_context($1, $2)`,
      [orgId, userId],
    );
    return row.fn_first_day_context;
  }

  async completeFirstDay(userId: string): Promise<void> {
    await this.db.execute(
      `UPDATE users SET first_day_completed_at = NOW() WHERE id = $1 AND first_day_completed_at IS NULL`,
      [userId],
    );
  }

  async resetFirstDay(orgId: string, targetUserId: string): Promise<void> {
    await this.db.execute(
      `UPDATE users SET first_day_completed_at = NULL
        WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [targetUserId, orgId],
    );
  }

  // ── GDPR ──────────────────────────────────────────────────

  async exportData(userId: string): Promise<Record<string, unknown>> {
    const row = await this.db.queryOne<{ sp_export_user_data: Record<string, unknown> }>(
      `SELECT sp_export_user_data($1)`,
      [userId],
    );
    return row?.sp_export_user_data ?? {};
  }

  async deleteAccount(userId: string): Promise<void> {
    await this.db.execute(`CALL sp_anonymize_user($1)`, [userId]);
  }
}
