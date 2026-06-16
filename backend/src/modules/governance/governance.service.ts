import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateBodyDto } from './dto/create-body.dto';
import { UpdateBodyDto } from './dto/update-body.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class GovernanceService {
  constructor(private readonly db: DbService) {}

  listBodies(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_governance_bodies WHERE org_id = $1 ORDER BY sort_order, name`,
      [orgId],
    );
  }

  private async getBody(orgId: string, bodyId: string) {
    const row = await this.db.queryOne(
      `SELECT * FROM v_governance_bodies WHERE id = $1 AND org_id = $2`,
      [bodyId, orgId],
    );
    if (!row) throw new NotFoundException('Cuerpo de gobierno no encontrado');
    return row;
  }

  async createBody(orgId: string, dto: CreateBodyDto) {
    const [row] = await this.db.query<{ id: string }>(
      `INSERT INTO governance_bodies (org_id, name, type, description, sort_order)
       VALUES ($1,$2,$3,$4,$5) RETURNING id`,
      [orgId, dto.name, dto.type, dto.description ?? null, dto.sort_order ?? 0],
    );
    return this.getBody(orgId, row.id);
  }

  async updateBody(orgId: string, bodyId: string, dto: UpdateBodyDto) {
    const existing = await this.db.queryOne(
      `SELECT id FROM governance_bodies WHERE id = $1 AND org_id = $2 AND is_active = true`,
      [bodyId, orgId],
    );
    if (!existing) throw new NotFoundException('Cuerpo de gobierno no encontrado');

    const fields: string[] = [];
    const params: unknown[] = [];

    if (dto.name !== undefined)        { params.push(dto.name);        fields.push(`name = $${params.length}`); }
    if (dto.type !== undefined)        { params.push(dto.type);        fields.push(`type = $${params.length}`); }
    if (dto.description !== undefined) { params.push(dto.description); fields.push(`description = $${params.length}`); }
    if (dto.sort_order !== undefined)  { params.push(dto.sort_order);  fields.push(`sort_order = $${params.length}`); }

    if (fields.length > 0) {
      params.push(bodyId);
      await this.db.execute(
        `UPDATE governance_bodies SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params,
      );
    }

    return this.getBody(orgId, bodyId);
  }

  async deleteBody(orgId: string, bodyId: string) {
    const existing = await this.db.queryOne(
      `SELECT id FROM governance_bodies WHERE id = $1 AND org_id = $2`,
      [bodyId, orgId],
    );
    if (!existing) throw new NotFoundException('Cuerpo de gobierno no encontrado');
    await this.db.execute(
      `UPDATE governance_bodies SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [bodyId],
    );
    return { success: true };
  }

  async addMember(orgId: string, bodyId: string, dto: AddMemberDto) {
    const [body, user] = await Promise.all([
      this.db.queryOne(
        `SELECT id FROM governance_bodies WHERE id = $1 AND org_id = $2 AND is_active = true`,
        [bodyId, orgId],
      ),
      this.db.queryOne(
        `SELECT id FROM users WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [dto.user_id, orgId],
      ),
    ]);
    if (!body) throw new NotFoundException('Cuerpo de gobierno no encontrado');
    if (!user) throw new NotFoundException('Usuario no encontrado en esta organización');

    try {
      await this.db.execute(
        `INSERT INTO governance_members (body_id, user_id, role_label, sort_order)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (body_id, user_id) DO UPDATE
           SET role_label = EXCLUDED.role_label,
               sort_order = EXCLUDED.sort_order`,
        [bodyId, dto.user_id, dto.role_label ?? null, dto.sort_order ?? 0],
      );
    } catch (err: any) {
      if (err.code === '23505') throw new BadRequestException('El miembro ya pertenece a este cuerpo');
      throw err;
    }

    return this.getBody(orgId, bodyId);
  }

  async removeMember(orgId: string, bodyId: string, userId: string) {
    const body = await this.db.queryOne(
      `SELECT id FROM governance_bodies WHERE id = $1 AND org_id = $2`,
      [bodyId, orgId],
    );
    if (!body) throw new NotFoundException('Cuerpo de gobierno no encontrado');

    await this.db.execute(
      `DELETE FROM governance_members WHERE body_id = $1 AND user_id = $2`,
      [bodyId, userId],
    );

    return this.getBody(orgId, bodyId);
  }
}
