import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { DbService } from '../../database/db.service';
import { EmailService } from '../../common/email/email.service';
import { RegisterDto } from './dto/register.dto';
import { UserSession } from './types/auth.types';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly db: DbService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  private toSlug(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 50);
  }

  async registerTrial(
    dto: { name: string; email: string; company: string; password: string },
    ip: string,
    deviceInfo: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: UserSession }> {
    const baseSlug = this.toSlug(dto.company);

    let orgId: string, userId: string;
    let slug = baseSlug;
    for (let attempt = 0; attempt < 5; attempt++) {
      if (attempt > 0) {
        slug = `${baseSlug.substring(0, 44)}-${Math.random().toString(36).substring(2, 7)}`;
      }
      try {
        const result = await this.db.queryOne<{ p_org_id: string; p_user_id: string }>(
          `SELECT p_org_id, p_user_id FROM sp_create_organization($1,$2,$3,$4,$5,$6)`,
          [dto.company, slug, 'AGILE', dto.email, dto.password, dto.name],
        );
        orgId  = result!.p_org_id;
        userId = result!.p_user_id;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('SLUG_ALREADY_EXISTS') && attempt < 4) continue;
        this.mapDbError(err);
      }
    }

    await this.db.execute(
      `UPDATE organizations SET trial_starts_at = NOW(), trial_expires_at = NOW() + INTERVAL '15 days' WHERE id = $1`,
      [orgId!],
    );

    return this.buildSession(userId!, ip, deviceInfo);
  }

  async register(dto: RegisterDto): Promise<{ accessToken: string; refreshToken: string; user: UserSession }> {
    let orgId: string;
    let userId: string;
    try {
      const result = await this.db.queryOne<{ p_org_id: string; p_user_id: string }>(
        `SELECT p_org_id, p_user_id FROM sp_create_organization($1,$2,$3,$4,$5,$6)`,
        [dto.orgName, dto.orgSlug, dto.orgMode ?? 'AGILE', dto.email, dto.password, dto.name],
      );
      orgId  = result!.p_org_id;
      userId = result!.p_user_id;
    } catch (err) {
      this.mapDbError(err);
    }

    await this.db.execute(
      `UPDATE organizations SET trial_starts_at = NOW(), trial_expires_at = NOW() + INTERVAL '15 days' WHERE id = $1`,
      [orgId!],
    );

    return this.buildSession(userId!, null, null);
  }

  async validateUser(email: string, password: string, ip = ''): Promise<UserSession | null> {
    const lockRow = await this.db.queryOne<{ is_locked: boolean; locked_until: string }>(
      `SELECT ((fn_check_login_attempts($1::citext))->>'is_locked')::boolean AS is_locked,
              (fn_check_login_attempts($1::citext))->>'locked_until' AS locked_until`,
      [email],
    );
    if (lockRow?.is_locked) {
      throw new UnauthorizedException(`Cuenta bloqueada hasta ${lockRow.locked_until}`);
    }

    const session = await this.db.queryOne<UserSession>(
      `SELECT * FROM sp_validate_login($1, $2)`,
      [email, password],
    );

    await this.db.query(
      `INSERT INTO login_attempts(email, ip_address, success) VALUES ($1::citext, $2::inet, $3)`,
      [email, ip || '127.0.0.1', !!session],
    );

    return session ?? null;
  }

  async login(
    user: UserSession,
    ip: string,
    deviceInfo: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken  = this.signAccess(user.user_id, user.organization_id, user.role);
    const refreshToken = await this.createRefreshToken(user.user_id, ip, deviceInfo);
    return { accessToken, refreshToken };
  }

  async refresh(
    rawToken: string,
    ip: string,
    deviceInfo: string,
  ): Promise<{ accessToken: string; refreshToken: string } | null> {
    const tokenHash = await this.hashToken(rawToken);
    const row = await this.db.queryOne<{ user_id: string; organization_id: string; role: string }>(
      `SELECT u.id AS user_id, u.organization_id, u.role
         FROM refresh_tokens rt
         JOIN users u ON u.id = rt.user_id
        WHERE rt.token_hash = $1
          AND rt.expires_at > NOW()
          AND rt.revoked_at IS NULL
          AND u.deleted_at IS NULL
          AND u.is_active = true`,
      [tokenHash],
    );
    if (!row) return null;

    // Rotate token
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );
    const accessToken  = this.signAccess(row.user_id, row.organization_id, row.role);
    const refreshToken = await this.createRefreshToken(row.user_id, ip, deviceInfo);
    return { accessToken, refreshToken };
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = await this.hashToken(rawToken);
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE token_hash = $1`,
      [tokenHash],
    );
  }

  async logoutAll(userId: string): Promise<void> {
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId],
    );
  }

  async switchOrg(
    currentEmail: string,
    targetOrgId: string,
    ip: string,
    deviceInfo: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: UserSession }> {
    const row = await this.db.queryOne<{ user_id: string }>(
      `SELECT id AS user_id FROM users
        WHERE lower(email) = lower($1)
          AND organization_id = $2
          AND deleted_at IS NULL
          AND is_active = true`,
      [currentEmail, targetOrgId],
    );
    if (!row) {
      throw new UnauthorizedException('No tienes acceso a esa organización');
    }
    return this.buildSession(row.user_id, ip, deviceInfo);
  }

  async acceptInvitation(
    token: string,
    name: string,
    password: string,
    ip: string,
    deviceInfo: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: UserSession }> {
    let userId: string;
    try {
      const result = await this.db.queryOne<{ sp_accept_invitation: string }>(
        `SELECT sp_accept_invitation($1, $2, $3)`,
        [token, name, password],
      );
      userId = result!.sp_accept_invitation;
    } catch (err) {
      this.mapDbError(err);
    }
    return this.buildSession(userId!, ip, deviceInfo);
  }

  async forgotPassword(email: string): Promise<void> {
    // Always respond OK — never reveal if email exists (security best practice)
    const user = await this.db.queryOne<{ id: string; name: string; locale: string }>(
      `SELECT u.id, u.name, COALESCE(p.locale, 'es') AS locale
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE lower(u.email) = lower($1) AND u.is_active = true AND u.deleted_at IS NULL LIMIT 1`,
      [email],
    );
    if (!user) return;

    const row = await this.db.queryOne<{ sp_create_reset_token: string }>(
      `SELECT sp_create_reset_token($1)`,
      [user.id],
    );
    const token = row!.sp_create_reset_token;

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const resetLink = `${frontendUrl}/auth/reset-password/${token}`;

    await this.email.sendPasswordReset(email, user.name, resetLink, undefined, user.locale);
  }

  async getResetTokenInfo(token: string) {
    const row = await this.db.queryOne<{ user_id: string; email: string; name: string; expires_at: string }>(
      `SELECT user_id, email, name, expires_at FROM fn_get_reset_token_info($1)`,
      [token],
    );
    if (!row) throw new UnauthorizedException('Enlace inválido o expirado');
    return { email: row.email, name: row.name, expires_at: row.expires_at };
  }

  async consumeResetToken(
    token: string,
    newPassword: string,
    ip: string,
    deviceInfo: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: UserSession }> {
    let userId: string;
    try {
      const row = await this.db.queryOne<{ sp_consume_reset_token: string }>(
        `SELECT sp_consume_reset_token($1, $2)`,
        [token, newPassword],
      );
      userId = row!.sp_consume_reset_token;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg.includes('RESET_TOKEN_INVALID_OR_EXPIRED')) {
        throw new UnauthorizedException('El enlace de restablecimiento es inválido o ya expiró');
      }
      throw err;
    }
    return this.buildSession(userId, ip, deviceInfo);
  }

  async getMyOrgs(email: string): Promise<{ id: string; name: string }[]> {
    return this.db.query<{ id: string; name: string }>(
      `SELECT o.id, o.name
         FROM organizations o
         JOIN users u ON u.organization_id = o.id
        WHERE lower(u.email) = lower($1)
          AND u.is_active = true
          AND u.deleted_at IS NULL
          AND o.deleted_at IS NULL
        ORDER BY o.name`,
      [email],
    );
  }

  async getInvitationInfo(token: string) {
    const inv = await this.db.queryOne<{ email: string; org_name: string; role: string; expires_at: string }>(
      `SELECT i.email, o.name AS org_name, i.role, i.expires_at
         FROM invitations i
         JOIN organizations o ON o.id = i.organization_id
        WHERE i.token = $1 AND i.accepted_at IS NULL AND i.expires_at > NOW()`,
      [token],
    );
    if (!inv) throw new UnauthorizedException('Invitación inválida o expirada');
    return inv;
  }

  private async buildSession(
    userId: string,
    ip: string | null,
    deviceInfo: string | null,
  ): Promise<{ accessToken: string; refreshToken: string; user: UserSession }> {
    const [session, refreshTokenRow] = await Promise.all([
      this.db.queryOne<UserSession>(
        `SELECT * FROM v_user_session WHERE user_id = $1`,
        [userId],
      ),
      this.createRefreshToken(userId, ip ?? '', deviceInfo ?? ''),
    ]);
    if (!session) throw new UnauthorizedException('Sesión no encontrada');
    const accessToken = this.signAccess(session.user_id, session.organization_id, session.role);
    return { accessToken, refreshToken: refreshTokenRow, user: session };
  }

  private signAccess(userId: string, orgId: string, role: string): string {
    return this.jwt.sign({ sub: userId, orgId, role });
  }

  private async createRefreshToken(userId: string, ip: string, deviceInfo: string): Promise<string> {
    const token = crypto.randomUUID();
    const tokenHash = await this.hashToken(token);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, ip_address, device_info)
       VALUES ($1, $2, $3, $4::inet, $5)`,
      [userId, tokenHash, expiresAt.toISOString(), ip || '127.0.0.1', deviceInfo || null],
    );
    return token;
  }

  private async hashToken(token: string): Promise<string> {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
    return Buffer.from(buf).toString('hex');
  }

  private mapDbError(err: unknown): never {
    const msg: string = err instanceof Error ? err.message : '';
    if (msg.includes('SLUG_ALREADY_EXISTS'))         throw new ConflictException('El slug de organización ya está en uso');
    if (msg.includes('users_organization_id_email_key')) throw new ConflictException('El email ya existe en esta organización');
    if (msg.includes('INVITATION_INVALID_OR_EXPIRED')) throw new ConflictException('Invitación inválida o expirada');
    this.logger.error(`DB error in auth: ${msg}`);
    throw err;
  }
}
