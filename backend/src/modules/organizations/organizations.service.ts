import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DbService } from '../../database/db.service';
import { EmailService, SmtpConfig } from '../../common/email/email.service';
import { UpdateOrgDto } from './dto/update-org.dto';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly db: DbService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async findOne(orgId: string) {
    const org = await this.db.queryOne<Record<string, unknown>>(
      `SELECT id, name, slug, mode, plan, logo_url, settings, sector, vision, mission, values_list, created_at
         FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    if (!org) throw new NotFoundException('Organización no encontrada');
    return org;
  }

  async update(orgId: string, dto: UpdateOrgDto) {
    await this.db.execute(
      `SELECT fn_update_organization($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        orgId,
        dto.name    ?? null,
        dto.mode    ?? null,
        dto.settings ? JSON.stringify(dto.settings) : null,
        dto.sector  ?? null,
        dto.vision  ?? null,
        dto.mission ?? null,
        dto.values_list ?? null,
      ],
    );
    return this.findOne(orgId);
  }

  async getMembers(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_org_members WHERE organization_id = $1 ORDER BY name`,
      [orgId],
    );
  }

  async getTeamTree(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_team_tree WHERE organization_id = $1`,
      [orgId],
    );
  }

  async inviteMember(orgId: string, invitedById: string, email: string, role: string) {
    try {
      const result = await this.db.queryOne<{ sp_invite_user: string }>(
        `SELECT sp_invite_user($1, $2, $3, $4)`,
        [orgId, email, role, invitedById],
      );
      const token = result?.sp_invite_user;

      // Obtener nombre del org, invitador y su locale para el email
      const [org, inviter] = await Promise.all([
        this.db.queryOne<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [orgId]),
        this.db.queryOne<{ name: string; locale: string }>(
          `SELECT u.name, COALESCE(p.locale, 'es') AS locale FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`,
          [invitedById],
        ),
      ]);

      const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
      const smtp = await this.getOrgSmtp(orgId);
      await this.email.sendInvitation(email, org?.name ?? '', inviter?.name ?? '', role, token!, frontendUrl, smtp, inviter?.locale);

      return { ok: true, email };
    } catch (err: any) {
      if (err.code === '23505') throw new ConflictException(`${email} ya tiene una invitación pendiente`);
      throw err;
    }
  }

  async getInvitations(orgId: string) {
    return this.db.query(
      `SELECT id, email, role, accepted_at, expires_at, created_at
         FROM invitations
        WHERE organization_id = $1
          AND accepted_at IS NULL
          AND expires_at > NOW()
        ORDER BY created_at DESC`,
      [orgId],
    );
  }

  async updateMemberRole(actorId: string, targetId: string, role: string) {
    await this.db.execute(
      `CALL sp_update_member_role($1, $2, $3)`,
      [actorId, targetId, role],
    );
  }

  async resetMemberPassword(actorId: string, targetId: string): Promise<{ newPassword: string }> {
    const row = await this.db.queryOne<{ fn_reset_member_password: string }>(
      `SELECT fn_reset_member_password($1, $2)`,
      [actorId, targetId],
    );
    return { newPassword: row!.fn_reset_member_password };
  }

  async sendResetEmail(orgId: string, targetId: string): Promise<{ ok: boolean }> {
    // Verify the user belongs to this org
    const member = await this.db.queryOne<{ email: string; name: string; locale: string }>(
      `SELECT u.email, u.name, COALESCE(p.locale, 'es') AS locale
         FROM users u
         LEFT JOIN user_profiles p ON p.user_id = u.id
        WHERE u.id = $1 AND u.organization_id = $2 AND u.deleted_at IS NULL AND u.is_active = true`,
      [targetId, orgId],
    );
    if (!member) throw new NotFoundException('Usuario no encontrado en esta organización');

    const row = await this.db.queryOne<{ sp_create_reset_token: string }>(
      `SELECT sp_create_reset_token($1)`,
      [targetId],
    );
    const token = row!.sp_create_reset_token;
    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const resetLink = `${frontendUrl}/auth/reset-password/${token}`;

    const smtp = await this.getOrgSmtp(orgId);
    await this.email.sendPasswordReset(member.email, member.name, resetLink, smtp, member.locale);
    return { ok: true };
  }

  async removeMember(actorId: string, targetId: string) {
    await this.db.execute(`CALL sp_remove_member($1, $2)`, [actorId, targetId]);
  }

  async getParameters(orgId: string) {
    const row = await this.db.queryOne<{ parameters: Record<string, unknown>; organization_id: string }>(
      `SELECT id as organization_id, parameters FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    if (!row) throw new NotFoundException('Organización no encontrada');
    const params = (row.parameters ?? {}) as Record<string, unknown>;
    if (params.smtp_pass) params.smtp_pass = '***';
    return { organization_id: row.organization_id, ...params };
  }

  private async getOrgSmtp(orgId: string): Promise<SmtpConfig | undefined> {
    const row = await this.db.queryOne<{ parameters: Record<string, unknown> }>(
      `SELECT parameters FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    const p = row?.parameters as Record<string, unknown> | undefined;
    if (!p?.smtp_host) return undefined;
    return {
      host: p.smtp_host as string,
      port: Number(p.smtp_port ?? 587),
      user: (p.smtp_user as string) ?? '',
      pass: (p.smtp_pass as string) ?? '',
      from: (p.smtp_from as string) ?? '',
    };
  }

  async updateParameters(orgId: string, params: Record<string, unknown>) {
    await this.db.execute(
      `CALL sp_update_org_parameters($1, $2)`,
      [orgId, JSON.stringify(params)],
    );
    return this.getParameters(orgId);
  }

  async resendInvitation(orgId: string, invitationId: string, actorId: string) {
    const inv = await this.db.queryOne<{ email: string; role: string; token: string }>(
      `UPDATE invitations
          SET expires_at = NOW() + INTERVAL '7 days'
        WHERE id = $1 AND organization_id = $2 AND accepted_at IS NULL
        RETURNING email, role, token`,
      [invitationId, orgId],
    );
    if (!inv) throw new NotFoundException('Invitación no encontrada o ya aceptada');

    const [org, inviter] = await Promise.all([
      this.db.queryOne<{ name: string }>(`SELECT name FROM organizations WHERE id = $1`, [orgId]),
      this.db.queryOne<{ name: string; locale: string }>(
        `SELECT u.name, COALESCE(p.locale, 'es') AS locale FROM users u LEFT JOIN user_profiles p ON p.user_id = u.id WHERE u.id = $1`,
        [actorId],
      ),
    ]);

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3001';
    const smtp = await this.getOrgSmtp(orgId);
    await this.email.sendInvitation(inv.email, org?.name ?? '', inviter?.name ?? '', inv.role, inv.token, frontendUrl, smtp, inviter?.locale);
    return { ok: true };
  }
}
