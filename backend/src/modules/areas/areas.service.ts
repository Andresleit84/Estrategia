import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreasService {
  constructor(private readonly db: DbService) {}

  list(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_areas_with_teams WHERE org_id = $1 ORDER BY sort_order, name`,
      [orgId],
    );
  }

  async getOne(orgId: string, areaId: string) {
    const row = await this.db.queryOne(
      `SELECT * FROM v_areas_with_teams WHERE id = $1 AND org_id = $2`,
      [areaId, orgId],
    );
    if (!row) throw new NotFoundException('Área no encontrada');
    return row;
  }

  async create(orgId: string, dto: CreateAreaDto) {
    try {
      const [row] = await this.db.query<{ id: string }>(
        `INSERT INTO areas (org_id, name, description, manager_id, color, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [orgId, dto.name, dto.description ?? null, dto.manager_id ?? null,
         dto.color ?? '#6366f1', dto.sort_order ?? 0],
      );
      return this.db.queryOne(
        `SELECT * FROM v_areas_with_teams WHERE id = $1`,
        [row.id],
      );
    } catch (err: any) {
      if (err.code === '23505') throw new BadRequestException('Ya existe un área con ese nombre');
      throw err;
    }
  }

  async update(orgId: string, areaId: string, dto: UpdateAreaDto) {
    const existing = await this.db.queryOne(
      `SELECT id FROM areas WHERE id = $1 AND org_id = $2 AND is_active = true`,
      [areaId, orgId],
    );
    if (!existing) throw new NotFoundException('Área no encontrada');

    const fields: string[] = [];
    const params: unknown[] = [];

    if (dto.name !== undefined)        { params.push(dto.name);        fields.push(`name = $${params.length}`); }
    if (dto.description !== undefined) { params.push(dto.description); fields.push(`description = $${params.length}`); }
    if (dto.manager_id !== undefined)  { params.push(dto.manager_id);  fields.push(`manager_id = $${params.length}`); }
    if (dto.color !== undefined)       { params.push(dto.color);       fields.push(`color = $${params.length}`); }
    if (dto.sort_order !== undefined)  { params.push(dto.sort_order);  fields.push(`sort_order = $${params.length}`); }

    if (fields.length > 0) {
      params.push(areaId);
      try {
        await this.db.execute(
          `UPDATE areas SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
          params,
        );
      } catch (err: any) {
        if (err.code === '23505') throw new BadRequestException('Ya existe un área con ese nombre');
        throw err;
      }
    }

    return this.getOne(orgId, areaId);
  }

  async delete(orgId: string, areaId: string) {
    const existing = await this.db.queryOne(
      `SELECT id FROM areas WHERE id = $1 AND org_id = $2`,
      [areaId, orgId],
    );
    if (!existing) throw new NotFoundException('Área no encontrada');
    await this.db.execute(
      `UPDATE areas SET is_active = false, updated_at = NOW() WHERE id = $1`,
      [areaId],
    );
    return { success: true };
  }

  async assignTeam(orgId: string, areaId: string, teamId: string) {
    const [area, team] = await Promise.all([
      this.db.queryOne(
        `SELECT id FROM areas WHERE id = $1 AND org_id = $2 AND is_active = true`,
        [areaId, orgId],
      ),
      this.db.queryOne(
        `SELECT id FROM teams WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [teamId, orgId],
      ),
    ]);
    if (!area) throw new NotFoundException('Área no encontrada');
    if (!team) throw new NotFoundException('Equipo no encontrado');

    await this.db.execute(
      `UPDATE teams SET area_id = $1 WHERE id = $2`,
      [areaId, teamId],
    );
    return this.getOne(orgId, areaId);
  }

  async removeTeam(orgId: string, areaId: string, teamId: string) {
    const area = await this.db.queryOne(
      `SELECT id FROM areas WHERE id = $1 AND org_id = $2`,
      [areaId, orgId],
    );
    if (!area) throw new NotFoundException('Área no encontrada');

    await this.db.execute(
      `UPDATE teams SET area_id = NULL WHERE id = $1 AND organization_id = $2`,
      [teamId, orgId],
    );
    return this.getOne(orgId, areaId);
  }

  listOrgUsers(orgId: string) {
    return this.db.query(
      `SELECT id, name, email, avatar_url, role
       FROM users
       WHERE organization_id = $1 AND deleted_at IS NULL AND is_active = true
       ORDER BY name`,
      [orgId],
    );
  }
}
