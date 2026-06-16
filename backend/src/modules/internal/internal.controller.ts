import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Public } from '../../common/decorators/public.decorator';
import { DbService } from '../../database/db.service';

@Controller('internal')
export class InternalController {
  constructor(
    private readonly db: DbService,
    private readonly config: ConfigService,
  ) {}

  private checkToken(auth: string) {
    const token = this.config.get<string>('SUPER_AGENT_TOKEN');
    if (!token || auth !== `Bearer ${token}`) {
      throw new UnauthorizedException();
    }
  }

  private resolveOrg(orgId?: string) {
    return orgId || this.config.get<string>('PRIMARY_ORG_ID') || null;
  }

  @Public()
  @Get('organizations')
  async getOrganizations(@Headers('authorization') auth: string) {
    this.checkToken(auth);
    return this.db.query(
      `SELECT id, name, slug FROM organizations WHERE deleted_at IS NULL ORDER BY name ASC`,
      [],
    );
  }

  @Public()
  @Get('agreements')
  async getAgreements(
    @Headers('authorization') auth: string,
    @Query('orgId') orgId?: string,
    @Query('code') code?: string,
  ) {
    this.checkToken(auth);
    const activeOrgId = this.resolveOrg(orgId);
    if (!activeOrgId) return { error: 'Sin empresa. Usa /empresa para seleccionar una.' };

    if (code) {
      const rows = await this.db.query(
        `SELECT code, title, status, priority, due_date, owner_name,
                linked_items_count, is_overdue, source, completion_notes
           FROM v_agreements
          WHERE organization_id = $1
            AND UPPER(code) = UPPER($2)
          LIMIT 1`,
        [activeOrgId, code],
      );
      return rows[0] ?? null;
    }

    return this.db.query(
      `SELECT code, title, status, priority, due_date, owner_name,
              linked_items_count, is_overdue
         FROM v_agreements
        WHERE organization_id = $1
          AND status NOT IN ('CANCELLED')
        ORDER BY
          CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
          due_date ASC NULLS LAST
        LIMIT 20`,
      [activeOrgId],
    );
  }
}
