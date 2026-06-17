import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DbService } from '../../database/db.service';

export interface ClientOrgHealth {
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
  digest_enabled: boolean;
  client_alerts_enabled: boolean;
  linked_at: string;
}

export interface ConsultantClientRow {
  id: string;
  client_org_id: string;
  digest_enabled: boolean;
  created_at: string;
}

@Injectable()
export class ConsultantService {
  constructor(private readonly db: DbService) {}

  async listClients(consultantEmail: string): Promise<ClientOrgHealth[]> {
    return this.db.query<ClientOrgHealth>(
      `SELECT
         cc.client_org_id                    AS org_id,
         o.name                              AS org_name,
         c.id                                AS cycle_id,
         c.name                              AS cycle_name,
         ROUND(fn_get_cycle_score(c.id)::numeric, 1)::float AS cycle_score,
         COUNT(obj.id) FILTER (WHERE obj.status NOT IN ('COMPLETED','CANCELLED') AND obj.deleted_at IS NULL)::int AS active_objectives,
         COUNT(obj.id) FILTER (WHERE obj.status NOT IN ('COMPLETED','CANCELLED') AND obj.deleted_at IS NULL AND obj.progress >= 70)::int AS on_track,
         COUNT(obj.id) FILTER (WHERE obj.status NOT IN ('COMPLETED','CANCELLED') AND obj.deleted_at IS NULL AND obj.progress < 40)::int AS at_risk,
         COUNT(obj.id) FILTER (WHERE obj.status = 'COMPLETED' AND obj.deleted_at IS NULL)::int AS completed,
         COUNT(kr.id) FILTER (WHERE kr.status NOT IN ('COMPLETED','CANCELLED') AND kr.deleted_at IS NULL AND kr.confidence < 0.4)::int AS krs_at_risk,
         cc.digest_enabled,
         cc.client_alerts_enabled,
         cc.created_at                       AS linked_at
       FROM consultant_clients cc
       JOIN organizations o ON o.id = cc.client_org_id AND o.deleted_at IS NULL
       LEFT JOIN LATERAL (
         SELECT id, name FROM cycles
         WHERE organization_id = o.id AND status = 'ACTIVE'
         ORDER BY start_date DESC NULLS LAST
         LIMIT 1
       ) c ON TRUE
       LEFT JOIN objectives obj ON obj.cycle_id = c.id
       LEFT JOIN key_results kr ON kr.objective_id = obj.id
      WHERE cc.consultant_email = $1 AND cc.is_active = TRUE
      GROUP BY cc.client_org_id, o.name, c.id, c.name, cc.digest_enabled, cc.client_alerts_enabled, cc.created_at
      ORDER BY o.name`,
      [consultantEmail],
    );
  }

  async addClient(consultantEmail: string, orgId: string): Promise<ConsultantClientRow> {
    // Verify the consultant actually has a user account in this org
    const member = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM users
        WHERE lower(email) = lower($1) AND organization_id = $2 AND deleted_at IS NULL`,
      [consultantEmail, orgId],
    );
    if (!member) {
      throw new ForbiddenException('No tienes acceso a esa organización');
    }
    const org = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [orgId],
    );
    if (!org) throw new NotFoundException('Organización no encontrada');

    const existing = await this.db.queryOne<ConsultantClientRow>(
      `SELECT id, client_org_id, digest_enabled, created_at
         FROM consultant_clients
        WHERE consultant_email = $1 AND client_org_id = $2`,
      [consultantEmail, orgId],
    );
    if (existing) {
      // Reactivate if was deactivated
      await this.db.execute(
        `UPDATE consultant_clients SET is_active = TRUE WHERE consultant_email = $1 AND client_org_id = $2`,
        [consultantEmail, orgId],
      );
      return existing;
    }

    const rows = await this.db.query<ConsultantClientRow>(
      `INSERT INTO consultant_clients (consultant_email, client_org_id)
       VALUES ($1, $2)
       RETURNING id, client_org_id, digest_enabled, created_at`,
      [consultantEmail, orgId],
    );
    return rows[0];
  }

  async removeClient(consultantEmail: string, orgId: string): Promise<void> {
    await this.db.execute(
      `UPDATE consultant_clients SET is_active = FALSE
        WHERE consultant_email = $1 AND client_org_id = $2`,
      [consultantEmail, orgId],
    );
  }

  async toggleDigest(consultantEmail: string, orgId: string, enabled: boolean): Promise<void> {
    await this.db.execute(
      `UPDATE consultant_clients SET digest_enabled = $3
        WHERE consultant_email = $1 AND client_org_id = $2 AND is_active = TRUE`,
      [consultantEmail, orgId, enabled],
    );
  }

  async toggleClientAlerts(consultantEmail: string, orgId: string, enabled: boolean): Promise<void> {
    // Verify consultant has access to this org
    const link = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM consultant_clients
        WHERE consultant_email = $1 AND client_org_id = $2 AND is_active = TRUE`,
      [consultantEmail, orgId],
    );
    if (!link) throw new Error('No tienes acceso a esa organización como consultor');

    // Update the client_alerts_enabled flag on the link record
    await this.db.execute(
      `UPDATE consultant_clients SET client_alerts_enabled = $3
        WHERE consultant_email = $1 AND client_org_id = $2`,
      [consultantEmail, orgId, enabled],
    );

    await this.db.execute(
      `UPDATE organizations
          SET parameters = jsonb_set(
            COALESCE(parameters, '{}'::jsonb),
            '{notifications_feature_enabled}',
            $2::jsonb
          )
        WHERE id = $1`,
      [orgId, JSON.stringify(enabled)],
    );
  }

  async getClientAlertsState(orgId: string): Promise<boolean> {
    const row = await this.db.queryOne<{ enabled: boolean }>(
      `SELECT (parameters->>'notifications_feature_enabled')::boolean AS enabled
         FROM organizations WHERE id = $1`,
      [orgId],
    );
    return row?.enabled ?? false;
  }

  // Used by ai-cron to get all consultant→clients mappings
  async getAllActiveLinks(): Promise<Array<{ consultant_email: string; client_org_id: string }>> {
    return this.db.query(
      `SELECT consultant_email, client_org_id
         FROM consultant_clients
        WHERE is_active = TRUE AND digest_enabled = TRUE
        ORDER BY consultant_email`,
      [],
    );
  }
}
