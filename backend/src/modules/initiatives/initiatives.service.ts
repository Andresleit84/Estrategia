import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateInitiativeDto } from './dto/create-initiative.dto';
import { UpdateInitiativeDto } from './dto/update-initiative.dto';
import { CreateMilestoneDto } from './dto/create-milestone.dto';
import { UpdateMilestoneDto } from './dto/update-milestone.dto';
import { CreateDependencyDto, UpdateDependencyDto } from './dto/create-dependency.dto';
import { asPgError } from '../../common/utils/db-error';

// Maps common PostgreSQL constraint violation codes to 400 BadRequest
function mapDbError(err: unknown): never {
  const e = asPgError(err);
  const code = e.code ?? '';
  const msg  = e.message ?? 'Error de base de datos';

  if (code === 'P0030') throw new BadRequestException('Hito no encontrado o ya completado');
  if (code === '23502') throw new BadRequestException('Falta un campo obligatorio');
  if (code === '23503') throw new BadRequestException('Referencia inválida (FK no existe)');
  if (code === '23505') throw new BadRequestException('Ya existe un registro con esos datos');
  if (code === '23514') throw new BadRequestException(`Valor no permitido: ${msg}`);
  throw err;
}

@Injectable()
export class InitiativesService {
  constructor(private readonly db: DbService) {}

  private async verifyInitiativeAccess(orgId: string, initiativeId: string) {
    const row = await this.db.queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM initiatives WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [initiativeId, orgId],
    );
    if (!row) throw new NotFoundException('Iniciativa no encontrada');
    return row;
  }

  async list(orgId: string, filters: { cycle_id?: string; team_id?: string; status?: string }) {
    const params: unknown[] = [orgId];
    let sql = `SELECT * FROM v_initiative_timeline WHERE organization_id = $1`;

    if (filters.cycle_id) {
      params.push(filters.cycle_id);
      sql += ` AND cycle_id = $${params.length}`;
    }
    if (filters.team_id) {
      params.push(filters.team_id);
      sql += ` AND team_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      sql += ` AND status = $${params.length}`;
    }

    sql += ` ORDER BY is_overdue DESC, due_date NULLS LAST, created_at DESC`;
    return this.db.query(sql, params);
  }

  async getOne(orgId: string, initiativeId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    return this.db.queryOne(
      `SELECT * FROM v_initiative_timeline WHERE id = $1`,
      [initiativeId],
    );
  }

  async create(orgId: string, userId: string, dto: CreateInitiativeDto) {
    try {
      const [row] = await this.db.query<{ p_initiative_id: string }>(
        `CALL sp_create_initiative($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)`,
        [
          orgId,
          dto.cycle_id ?? null,
          dto.team_id ?? null,
          dto.owner_id ?? userId,
          dto.title,
          dto.description ?? null,
          dto.start_date ?? null,
          dto.due_date ?? null,
          userId,
          dto.kr_ids?.length ? `{${dto.kr_ids.join(',')}}` : null,
        ],
      );
      const initId = row.p_initiative_id;
      if (dto.sprint_id) {
        await this.db.execute(
          `UPDATE initiatives SET sprint_id = $1 WHERE id = $2`,
          [dto.sprint_id, initId],
        );
      }
      if (dto.primary_area_id || dto.involved_area_ids?.length) {
        await this._syncAreas(initId, dto.primary_area_id, dto.involved_area_ids);
      }
      return this.db.queryOne(
        `SELECT * FROM v_initiative_timeline WHERE id = $1`,
        [initId],
      );
    } catch (err: any) {
      mapDbError(err);
    }
  }

  async update(orgId: string, initiativeId: string, dto: UpdateInitiativeDto) {
    const init = await this.verifyInitiativeAccess(orgId, initiativeId);
    if (['DONE', 'CANCELLED'].includes(init.status)) {
      throw new BadRequestException('No se puede editar una iniciativa completada o cancelada');
    }

    const fields: string[] = [];
    const params: unknown[] = [];

    if (dto.title !== undefined)       { params.push(dto.title);       fields.push(`title = $${params.length}`); }
    if (dto.description !== undefined) { params.push(dto.description); fields.push(`description = $${params.length}`); }
    if (dto.status !== undefined)      { params.push(dto.status);      fields.push(`status = $${params.length}`); }
    if (dto.start_date !== undefined)  { params.push(dto.start_date);  fields.push(`start_date = $${params.length}`); }
    if (dto.due_date !== undefined)    { params.push(dto.due_date);    fields.push(`due_date = $${params.length}`); }
    if (dto.owner_id !== undefined)    { params.push(dto.owner_id);    fields.push(`owner_id = $${params.length}`); }
    if (dto.sprint_id !== undefined)   { params.push(dto.sprint_id);   fields.push(`sprint_id = $${params.length}`); }

    if (fields.length === 0) return this.getOne(orgId, initiativeId);

    params.push(initiativeId);
    try {
      await this.db.execute(
        `UPDATE initiatives SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $${params.length} AND deleted_at IS NULL`,
        params,
      );
    } catch (err: any) {
      mapDbError(err);
    }
    return this.getOne(orgId, initiativeId);
  }

  async delete(orgId: string, initiativeId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    await this.db.execute(
      `UPDATE initiatives SET deleted_at = NOW() WHERE id = $1`,
      [initiativeId],
    );
    return { success: true };
  }

  async linkKr(orgId: string, initiativeId: string, krId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    const kr = await this.db.queryOne(
      `SELECT kr.id FROM key_results kr
         JOIN objectives o ON kr.objective_id = o.id
        WHERE kr.id = $1 AND o.organization_id = $2 AND kr.deleted_at IS NULL`,
      [krId, orgId],
    );
    if (!kr) throw new NotFoundException('Resultado clave no encontrado');

    await this.db.execute(
      `INSERT INTO initiative_key_results (initiative_id, kr_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [initiativeId, krId],
    );
    return this.getOne(orgId, initiativeId);
  }

  async unlinkKr(orgId: string, initiativeId: string, krId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    await this.db.execute(
      `DELETE FROM initiative_key_results WHERE initiative_id = $1 AND kr_id = $2`,
      [initiativeId, krId],
    );
    return this.getOne(orgId, initiativeId);
  }

  async getByKr(orgId: string, krId: string) {
    const kr = await this.db.queryOne(
      `SELECT kr.id FROM key_results kr
         JOIN objectives o ON kr.objective_id = o.id
        WHERE kr.id = $1 AND o.organization_id = $2 AND kr.deleted_at IS NULL`,
      [krId, orgId],
    );
    if (!kr) throw new NotFoundException('Resultado clave no encontrado');
    return this.db.query(
      `SELECT * FROM v_initiatives_by_kr WHERE kr_id = $1`,
      [krId],
    );
  }

  async getHealth(orgId: string, initiativeId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    const [row] = await this.db.query<{ fn_initiative_health: Record<string, unknown> }>(
      `SELECT fn_initiative_health($1)`,
      [initiativeId],
    );
    return row?.fn_initiative_health ?? {};
  }

  async getOverdueMilestones(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_overdue_milestones WHERE organization_id = $1`,
      [orgId],
    );
  }

  // ── Milestones ────────────────────────────────────────────────────────────

  async getMilestones(orgId: string, initiativeId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    return this.db.query(
      `SELECT m.*, u.name AS assignee_name
         FROM milestones m
         LEFT JOIN users u ON m.assignee_id = u.id
        WHERE m.initiative_id = $1
        ORDER BY m.sort_order, m.due_date NULLS LAST`,
      [initiativeId],
    );
  }

  async createMilestone(orgId: string, initiativeId: string, userId: string, dto: CreateMilestoneDto) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    try {
      const [row] = await this.db.query<{ id: string }>(
        `INSERT INTO milestones (initiative_id, title, description, due_date, assignee_id, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          initiativeId,
          dto.title,
          dto.description ?? null,
          dto.due_date ?? null,
          dto.assignee_id ?? null,
          dto.sort_order ?? 0,
        ],
      );
      const [milestone] = await this.db.query(
        `SELECT m.*, u.name AS assignee_name
           FROM milestones m LEFT JOIN users u ON m.assignee_id = u.id
          WHERE m.id = $1`,
        [row.id],
      );
      return milestone;
    } catch (err: any) {
      mapDbError(err);
    }
  }

  async completeMilestone(orgId: string, initiativeId: string, milestoneId: string, userId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);

    // Verify milestone belongs to this initiative
    const m = await this.db.queryOne(
      `SELECT id, status FROM milestones WHERE id = $1 AND initiative_id = $2`,
      [milestoneId, initiativeId],
    );
    if (!m) throw new NotFoundException('Hito no encontrado');

    try {
      await this.db.execute(`CALL sp_complete_milestone($1, $2)`, [milestoneId, userId]);
    } catch (err: any) {
      mapDbError(err);
    }

    const [milestone] = await this.db.query(
      `SELECT m.*, u.name AS assignee_name
         FROM milestones m LEFT JOIN users u ON m.assignee_id = u.id
        WHERE m.id = $1`,
      [milestoneId],
    );
    return milestone;
  }

  async updateMilestone(orgId: string, initiativeId: string, milestoneId: string, dto: UpdateMilestoneDto) {
    await this.verifyInitiativeAccess(orgId, initiativeId);

    const row = await this.db.queryOne(
      `SELECT id FROM milestones WHERE id = $1 AND initiative_id = $2`,
      [milestoneId, initiativeId],
    );
    if (!row) throw new NotFoundException('Hito no encontrado');

    const fields: string[] = [];
    const params: unknown[] = [];

    if (dto.title !== undefined)       { params.push(dto.title);       fields.push(`title = $${params.length}`); }
    if (dto.description !== undefined) { params.push(dto.description); fields.push(`description = $${params.length}`); }
    if (dto.due_date !== undefined)    { params.push(dto.due_date);    fields.push(`due_date = $${params.length}`); }
    if (dto.assignee_id !== undefined) { params.push(dto.assignee_id); fields.push(`assignee_id = $${params.length}`); }
    if (dto.sort_order !== undefined)  { params.push(dto.sort_order);  fields.push(`sort_order = $${params.length}`); }
    if (dto.status !== undefined)      { params.push(dto.status);      fields.push(`status = $${params.length}`); }

    if (fields.length === 0) {
      const [m] = await this.db.query(
        `SELECT m.*, u.name AS assignee_name FROM milestones m LEFT JOIN users u ON m.assignee_id = u.id WHERE m.id = $1`,
        [milestoneId],
      );
      return m;
    }

    params.push(milestoneId);
    try {
      await this.db.execute(
        `UPDATE milestones SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params,
      );
    } catch (err: any) {
      mapDbError(err);
    }

    const [m] = await this.db.query(
      `SELECT m.*, u.name AS assignee_name FROM milestones m LEFT JOIN users u ON m.assignee_id = u.id WHERE m.id = $1`,
      [milestoneId],
    );
    return m;
  }

  async deleteMilestone(orgId: string, initiativeId: string, milestoneId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    const row = await this.db.queryOne(
      `SELECT id FROM milestones WHERE id = $1 AND initiative_id = $2`,
      [milestoneId, initiativeId],
    );
    if (!row) throw new NotFoundException('Hito no encontrado');
    await this.db.execute(`DELETE FROM milestones WHERE id = $1`, [milestoneId]);
    return { success: true };
  }

  // ── Areas ─────────────────────────────────────────────────────────────────

  private async _syncAreas(initiativeId: string, primaryAreaId?: string, involvedAreaIds?: string[]) {
    await this.db.execute(
      `DELETE FROM initiative_areas WHERE initiative_id = $1`,
      [initiativeId],
    );
    const all = new Set<string>();
    if (primaryAreaId) all.add(primaryAreaId);
    for (const id of involvedAreaIds ?? []) all.add(id);

    for (const areaId of all) {
      await this.db.execute(
        `INSERT INTO initiative_areas (initiative_id, area_id, is_primary)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [initiativeId, areaId, areaId === primaryAreaId],
      );
    }
  }

  async setAreas(orgId: string, initiativeId: string, primaryAreaId?: string, involvedAreaIds?: string[]) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    await this._syncAreas(initiativeId, primaryAreaId, involvedAreaIds);
    return this.getOne(orgId, initiativeId);
  }

  // ── Dependencies ──────────────────────────────────────────────────────────

  async getDependencies(orgId: string, initiativeId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    return this.db.query(
      `SELECT d.*, i.title AS depends_on_title
       FROM initiative_dependencies d
       LEFT JOIN initiatives i ON d.depends_on_id = i.id
       WHERE d.initiative_id = $1
       ORDER BY d.created_at`,
      [initiativeId],
    );
  }

  async addDependency(orgId: string, initiativeId: string, dto: CreateDependencyDto) {
    await this.verifyInitiativeAccess(orgId, initiativeId);

    if (dto.depends_on_id) {
      const dep = await this.db.queryOne(
        `SELECT id FROM initiatives WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
        [dto.depends_on_id, orgId],
      );
      if (!dep) throw new NotFoundException('Iniciativa dependencia no encontrada');
      if (dto.depends_on_id === initiativeId) throw new BadRequestException('Una iniciativa no puede depender de sí misma');
    }

    try {
      const [row] = await this.db.query<{ id: string }>(
        `INSERT INTO initiative_dependencies (initiative_id, depends_on_id, description, type)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [initiativeId, dto.depends_on_id ?? null, dto.description, dto.type],
      );
      const [dep] = await this.db.query(
        `SELECT d.*, i.title AS depends_on_title
         FROM initiative_dependencies d
         LEFT JOIN initiatives i ON d.depends_on_id = i.id
         WHERE d.id = $1`,
        [row.id],
      );
      return dep;
    } catch (err: any) {
      mapDbError(err);
    }
  }

  async updateDependency(orgId: string, initiativeId: string, depId: string, dto: UpdateDependencyDto) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    const dep = await this.db.queryOne(
      `SELECT id FROM initiative_dependencies WHERE id = $1 AND initiative_id = $2`,
      [depId, initiativeId],
    );
    if (!dep) throw new NotFoundException('Dependencia no encontrada');

    const fields: string[] = [];
    const params: unknown[] = [];

    if (dto.status !== undefined) {
      params.push(dto.status);
      fields.push(`status = $${params.length}`);
      if (dto.status === 'RESOLVED') {
        fields.push(`resolved_at = NOW()`);
      }
    }
    if (dto.description !== undefined) {
      params.push(dto.description);
      fields.push(`description = $${params.length}`);
    }

    if (fields.length > 0) {
      params.push(depId);
      await this.db.execute(
        `UPDATE initiative_dependencies SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params,
      );
    }

    const [updated] = await this.db.query(
      `SELECT d.*, i.title AS depends_on_title
       FROM initiative_dependencies d
       LEFT JOIN initiatives i ON d.depends_on_id = i.id
       WHERE d.id = $1`,
      [depId],
    );
    return updated;
  }

  async deleteDependency(orgId: string, initiativeId: string, depId: string) {
    await this.verifyInitiativeAccess(orgId, initiativeId);
    await this.db.execute(
      `DELETE FROM initiative_dependencies WHERE id = $1 AND initiative_id = $2`,
      [depId, initiativeId],
    );
    return { success: true };
  }

  async getObjectiveLinks(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_traceability_objective_links WHERE organization_id = $1`,
      [orgId],
    );
  }
}
