import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateBacklogItemDto } from './dto/create-backlog-item.dto';
import { UpdateBacklogItemDto } from './dto/update-backlog-item.dto';
import { asPgError } from '../../common/utils/db-error';

function mapDbError(err: unknown): never {
  const e   = asPgError(err);
  const msg = e.message ?? 'Error de base de datos';
  if (msg.includes('parent must be') || msg.includes('must have a parent')) throw new BadRequestException(msg);
  if (e.code === '23502') throw new BadRequestException('Falta un campo obligatorio');
  if (e.code === '23503') throw new BadRequestException('Referencia inválida (FK)');
  if (e.code === '23505') throw new BadRequestException('Ya existe un registro con esos datos');
  if (e.code === '23514') throw new BadRequestException(`Valor no permitido: ${msg}`);
  if (e.code === 'P0001') throw new BadRequestException(msg);
  throw new BadRequestException(`Error de base de datos: ${msg}`);
}

@Injectable()
export class BacklogService {
  constructor(private readonly db: DbService) {}

  // ── Queries ──────────────────────────────────────────────────────────────

  async list(
    orgId: string,
    filters: {
      type?:          string;
      status?:        string;
      priority?:      string;
      initiative_id?: string;
      cycle_id?:      string;
      sprint_id?:     string | null;
      parent_id?:     string | null;
    },
  ) {
    const params: unknown[] = [orgId];
    let sql = `SELECT * FROM v_backlog_items WHERE organization_id = $1`;

    if (filters.type)          { params.push(filters.type);          sql += ` AND type = $${params.length}`; }
    if (filters.status)        { params.push(filters.status);        sql += ` AND status = $${params.length}`; }
    if (filters.priority)      { params.push(filters.priority);      sql += ` AND priority = $${params.length}`; }
    if (filters.initiative_id) { params.push(filters.initiative_id); sql += ` AND initiative_id = $${params.length}`; }
    if (filters.cycle_id)      { params.push(filters.cycle_id);      sql += ` AND cycle_id = $${params.length}`; }
    if (filters.sprint_id !== undefined) {
      if (filters.sprint_id === null) {
        sql += ` AND sprint_id IS NULL`;
      } else {
        params.push(filters.sprint_id);
        sql += ` AND sprint_id = $${params.length}`;
      }
    }
    if (filters.parent_id !== undefined) {
      if (filters.parent_id === null) {
        sql += ` AND parent_id IS NULL`;
      } else {
        params.push(filters.parent_id);
        sql += ` AND parent_id = $${params.length}`;
      }
    }

    sql += ` ORDER BY
      CASE type WHEN 'EPIC' THEN 0 WHEN 'FEATURE' THEN 1 ELSE 2 END,
      CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
      created_at DESC`;

    return this.db.query(sql, params);
  }

  async getOne(orgId: string, id: string) {
    const row = await this.db.queryOne(
      `SELECT * FROM v_backlog_items WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!row) throw new NotFoundException('Elemento no encontrado');
    return row;
  }

  async getTree(orgId: string, filters: { initiative_id?: string; cycle_id?: string }) {
    const params: unknown[] = [orgId];
    let where = `organization_id = $1 AND parent_id IS NULL AND type = 'EPIC'`;
    if (filters.initiative_id) { params.push(filters.initiative_id); where += ` AND initiative_id = $${params.length}`; }
    if (filters.cycle_id)      { params.push(filters.cycle_id);      where += ` AND cycle_id = $${params.length}`; }

    const epics = await this.db.query<any>(`SELECT * FROM v_backlog_items WHERE ${where} ORDER BY CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, created_at`, params);

    // Fetch all descendants in one query and build tree in memory
    const epicIds = epics.map((e: any) => e.id);
    if (epicIds.length === 0) return [];

    const all = await this.db.query<any>(
      `WITH RECURSIVE tree AS (
         SELECT * FROM v_backlog_items WHERE parent_id = ANY($1::uuid[])
         UNION ALL
         SELECT bi.* FROM v_backlog_items bi JOIN tree t ON bi.parent_id = t.id
       )
       SELECT * FROM tree ORDER BY
         CASE type WHEN 'FEATURE' THEN 0 ELSE 1 END,
         CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         created_at`,
      [`{${epicIds.join(',')}}`],
    );

    const byParent = new Map<string, any[]>();
    for (const item of all) {
      const arr = byParent.get(item.parent_id) ?? [];
      arr.push(item);
      byParent.set(item.parent_id, arr);
    }

    return epics.map((epic: any) => ({
      ...epic,
      children: (byParent.get(epic.id) ?? []).map((feature: any) => ({
        ...feature,
        children: byParent.get(feature.id) ?? [],
      })),
    }));
  }

  // ── Mutations ────────────────────────────────────────────────────────────

  async create(orgId: string, userId: string, dto: CreateBacklogItemDto) {
    try {
      const [row] = await this.db.query<{ id: string }>(
        `INSERT INTO backlog_items
           (organization_id, type, title, description, acceptance_criteria,
            priority, story_points, parent_id, initiative_id, sprint_id,
            assignee_id, cycle_id, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          orgId,
          dto.type,
          dto.title,
          dto.description ?? null,
          dto.acceptance_criteria ?? null,
          dto.priority ?? 'MEDIUM',
          dto.story_points ?? null,
          dto.parent_id ?? null,
          dto.initiative_id ?? null,
          dto.sprint_id ?? null,
          dto.assignee_id ?? null,
          dto.cycle_id ?? null,
          userId,
        ],
      );
      return this.getOne(orgId, row.id);
    } catch (err) {
      mapDbError(err);
    }
  }

  async update(orgId: string, id: string, dto: UpdateBacklogItemDto) {
    await this.getOne(orgId, id);

    const fields: string[] = [];
    const params: unknown[] = [];

    const set = (col: string, val: unknown) => { params.push(val); fields.push(`${col} = $${params.length}`); };

    if (dto.title              !== undefined) set('title',               dto.title);
    if (dto.description        !== undefined) set('description',         dto.description);
    if (dto.acceptance_criteria !== undefined) set('acceptance_criteria', dto.acceptance_criteria);
    if (dto.status             !== undefined) set('status',              dto.status);
    if (dto.priority           !== undefined) set('priority',            dto.priority);
    if (dto.story_points       !== undefined) set('story_points',        dto.story_points);
    if (dto.parent_id          !== undefined) set('parent_id',           dto.parent_id);
    if (dto.initiative_id      !== undefined) set('initiative_id',       dto.initiative_id);
    if (dto.sprint_id          !== undefined) set('sprint_id',           dto.sprint_id);
    if (dto.assignee_id        !== undefined) set('assignee_id',         dto.assignee_id);
    if (dto.cycle_id           !== undefined) set('cycle_id',            dto.cycle_id);

    if (fields.length === 0) return this.getOne(orgId, id);

    params.push(id);
    try {
      await this.db.execute(
        `UPDATE backlog_items SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params,
      );
    } catch (err) {
      mapDbError(err);
    }
    return this.getOne(orgId, id);
  }

  async delete(orgId: string, id: string) {
    await this.getOne(orgId, id);
    await this.db.execute(`DELETE FROM backlog_items WHERE id = $1`, [id]);
    return { success: true };
  }

  async stats(orgId: string, filters: { initiative_id?: string; cycle_id?: string }) {
    const params: unknown[] = [orgId];
    let where = `organization_id = $1`;
    if (filters.initiative_id) { params.push(filters.initiative_id); where += ` AND initiative_id = $${params.length}`; }
    if (filters.cycle_id)      { params.push(filters.cycle_id);      where += ` AND cycle_id = $${params.length}`; }

    const [row] = await this.db.query<any>(
      `SELECT
         COUNT(*)                                              AS total,
         COUNT(*) FILTER (WHERE type = 'EPIC')                AS epics,
         COUNT(*) FILTER (WHERE type = 'FEATURE')             AS features,
         COUNT(*) FILTER (WHERE type = 'STORY')               AS stories,
         COUNT(*) FILTER (WHERE status = 'DONE')              AS done,
         COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')       AS in_progress,
         COALESCE(SUM(story_points), 0)                       AS total_points,
         COALESCE(SUM(story_points) FILTER (WHERE status = 'DONE'), 0) AS done_points
       FROM backlog_items WHERE ${where}`,
      params,
    );
    return row;
  }

  // ── My strategic impact chain ─────────────────────────────────────────────

  async myItems(userId: string, orgId: string) {
    return this.db.query(
      `SELECT id, code, title, type, status, priority
       FROM backlog_items
       WHERE organization_id = $1
         AND (assignee_id = $2 OR created_by = $2)
         AND status NOT IN ('DONE', 'CANCELLED')
       ORDER BY
         CASE type WHEN 'STORY' THEN 1 WHEN 'FEATURE' THEN 2 ELSE 3 END,
         CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END,
         updated_at DESC NULLS LAST`,
      [orgId, userId],
    );
  }

  async myImpact(userId: string, orgId: string, itemId?: string): Promise<{ nodes: ImpactNode[]; complete: boolean }> {
    const params: unknown[] = [userId, orgId];
    if (itemId) params.push(itemId);
    const row = await this.db.queryOne<{ result: { nodes: ImpactNode[]; complete: boolean } }>(
      `SELECT fn_my_impact_chain($1::uuid, $2::uuid${itemId ? ', $3::uuid' : ''}) AS result`,
      params,
    );
    return row?.result ?? { nodes: [], complete: false };
  }
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface ImpactNode {
  type: 'STORY' | 'FEATURE' | 'EPIC' | 'INITIATIVE' | 'KR'
      | 'OBJECTIVE_TEAM' | 'OBJECTIVE_AREA' | 'OBJECTIVE_COMPANY'
      | 'OBJECTIVE_INDIVIDUAL' | 'INTENT' | 'VISION';
  id?:         string;
  code?:       string;
  title:       string;
  status?:     string;
  progress?:   number;
  confidence?: number;
  category?:   string;
  href:        string;
}
