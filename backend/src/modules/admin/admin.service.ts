import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { DbService } from '../../database/db.service';

export type PlanLevel = 'FREE' | 'PRO' | 'ENTERPRISE';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  constructor(private readonly db: DbService) {}

  async deleteOrganization(orgId: string, requestingUserId: string, requestingOrgId: string) {
    if (orgId === requestingOrgId) {
      throw new ConflictException('No puedes eliminar la empresa en la que estás activo');
    }
    // Bloquear si el usuario solicitante pertenece a la org objetivo (sesión cruzada)
    const isMember = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [requestingUserId, orgId],
    );
    if (isMember) {
      throw new ConflictException('No puedes eliminar una empresa a la que perteneces');
    }
    const row = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    if (!row) throw new NotFoundException('Empresa no encontrada');

    await this.db.execute(
      `UPDATE organizations SET deleted_at = NOW() WHERE id = $1`,
      [orgId],
    );
    // Revoke all tokens for users in this org
    await this.db.execute(
      `UPDATE refresh_tokens rt
          SET revoked_at = NOW()
         FROM users u
        WHERE rt.user_id = u.id
          AND u.organization_id = $1
          AND rt.revoked_at IS NULL`,
      [orgId],
    );
  }

  async updateOrgPlan(
    orgId: string,
    plan: PlanLevel,
    periodStartDate: string | null,
    periodEndDate: string | null,
    notes: string | undefined,
    adminUserId: string,
  ) {
    const VALID_PLANS: PlanLevel[] = ['FREE', 'PRO', 'ENTERPRISE'];
    if (!VALID_PLANS.includes(plan)) throw new BadRequestException('Plan inválido');
    this.logger.log(`updateOrgPlan orgId=${orgId} plan=${plan} start=${periodStartDate} end=${periodEndDate}`);

    const org = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    if (!org) throw new NotFoundException('Empresa no encontrada');

    await this.db.execute(
      `UPDATE organizations
          SET plan                    = $2,
              plan_current_period_end = $4,
              trial_starts_at         = CASE
                                          WHEN $2 != 'FREE' THEN NULL
                                          WHEN $3 IS NOT NULL THEN $3::timestamptz
                                          ELSE trial_starts_at
                                        END,
              trial_expires_at        = CASE
                                          WHEN $2 != 'FREE' THEN NULL
                                          WHEN $4 IS NOT NULL THEN $4::timestamptz
                                          ELSE trial_expires_at
                                        END,
              updated_at              = NOW()
        WHERE id = $1`,
      [orgId, plan, periodStartDate ?? null, periodEndDate ?? null],
    );

    await this.db.execute(
      `INSERT INTO billing_events (id, organization_id, provider, event_type, payload, processed_at)
       VALUES (gen_random_uuid(), $1, 'manual', 'plan_updated', $2, NOW())`,
      [orgId, JSON.stringify({ plan, notes, changed_by: adminUserId })],
    );

    return { ok: true, plan };
  }

  async listOrganizations() {
    return this.db.query<Record<string, unknown>>(`
      SELECT
        o.id, o.name, o.slug, o.plan, o.mode,
        o.created_at, o.trial_starts_at, o.trial_expires_at,
        COUNT(DISTINCT u.id)  FILTER (WHERE u.is_active = true)::int         AS member_count,
        COUNT(DISTINCT c.id)  FILTER (WHERE c.status = 'ACTIVE')::int        AS active_cycles,
        COUNT(DISTINCT obj.id) FILTER (WHERE obj.deleted_at IS NULL)::int    AS objective_count
      FROM organizations o
      LEFT JOIN users u   ON u.organization_id = o.id AND u.deleted_at IS NULL
      LEFT JOIN cycles c  ON c.organization_id = o.id
      LEFT JOIN objectives obj ON obj.organization_id = o.id
      WHERE o.deleted_at IS NULL
      GROUP BY o.id, o.name, o.slug, o.plan, o.mode, o.created_at, o.trial_starts_at, o.trial_expires_at
      ORDER BY o.created_at DESC
    `);
  }
}
