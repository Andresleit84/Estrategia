import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { AiService } from '../ai/ai.service';
import { RedisService } from '../../common/redis/redis.service';
import { CreateObjectiveDto } from './dto/create-objective.dto';
import { UpdateObjectiveDto } from './dto/update-objective.dto';

@Injectable()
export class ObjectivesService {
  private readonly logger = new Logger(ObjectivesService.name);

  constructor(
    private readonly db: DbService,
    private readonly ai: AiService,
    private readonly redis: RedisService,
  ) {}

  async findAll(orgId: string, cycleId?: string, level?: string, status?: string, ownerId?: string, teamId?: string) {
    const params: unknown[] = [orgId];
    let sql = 'SELECT * FROM v_objectives_with_progress WHERE organization_id = $1';
    if (cycleId)  { params.push(cycleId);  sql += ` AND cycle_id = $${params.length}`; }
    if (level)    { params.push(level);    sql += ` AND level = $${params.length}`; }
    if (status)   { params.push(status);   sql += ` AND status = $${params.length}`; }
    if (ownerId)  { params.push(ownerId);  sql += ` AND owner_id = $${params.length}`; }
    if (teamId)   { params.push(teamId);   sql += ` AND team_id = $${params.length}`; }
    sql += ' ORDER BY level, created_at';
    return this.db.query(sql, params);
  }

  async findOne(orgId: string, id: string) {
    const obj = await this.db.queryOne(
      'SELECT * FROM v_objectives_with_progress WHERE id = $1 AND organization_id = $2',
      [id, orgId],
    );
    if (!obj) throw new NotFoundException('Objetivo no encontrado');
    return obj;
  }

  async findKeyResults(orgId: string, objId: string) {
    // Verify org ownership
    const obj = await this.db.queryOne(
      'SELECT id FROM objectives WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [objId, orgId],
    );
    if (!obj) throw new NotFoundException('Objetivo no encontrado');
    return this.db.query(
      'SELECT * FROM v_key_results_with_trend WHERE objective_id = $1 ORDER BY created_at',
      [objId],
    );
  }

  async getAlignmentMap(orgId: string, cycleId: string) {
    return this.db.query(
      'SELECT * FROM v_alignment_map WHERE organization_id = $1 AND cycle_id = $2 ORDER BY company_title',
      [orgId, cycleId],
    );
  }

  async getTree(orgId: string, cycleId: string) {
    return this.db.query(
      `WITH RECURSIVE
        -- Step 1: all objectives in the requested cycle
        seeds AS (
          SELECT id, code, title, description, level, status, progress,
                 parent_objective_id, owner_id, owner_name, owner_email,
                 team_id, team_name, kr_count
          FROM v_objectives_with_progress
          WHERE organization_id = $1 AND cycle_id = $2
        ),
        -- Step 2: walk UP from seeds to collect ancestors (any cycle)
        ancestors AS (
          SELECT s.id, s.code, s.title, s.description, s.level, s.status, s.progress,
                 s.parent_objective_id, s.owner_id, s.owner_name, s.owner_email,
                 s.team_id, s.team_name, s.kr_count
          FROM seeds s
          UNION
          SELECT o.id, o.code, o.title, o.description, o.level, o.status, o.progress,
                 o.parent_objective_id, o.owner_id, o.owner_name, o.owner_email,
                 o.team_id, o.team_name, o.kr_count
          FROM v_objectives_with_progress o
          JOIN ancestors a ON o.id = a.parent_objective_id
          WHERE o.organization_id = $1
        ),
        -- Step 3: build top-down tree from the full ancestor+seed set
        tree AS (
          SELECT a.*, 0 AS depth
          FROM ancestors a
          WHERE a.parent_objective_id IS NULL
             OR a.parent_objective_id NOT IN (SELECT id FROM ancestors)
          UNION ALL
          SELECT a.*, t.depth + 1
          FROM ancestors a
          JOIN tree t ON a.parent_objective_id = t.id
        )
      SELECT t.*,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', kr.id, 'code', kr.code, 'title', kr.title, 'description', kr.description,
            'progress', kr.progress, 'status', kr.status, 'confidence', kr.confidence,
            'type', kr.type, 'kr_category', kr.kr_category,
            'kpi_description', kr.kpi_description, 'gap_note', kr.gap_note,
            'recommendation', kr.recommendation, 'refs_data', kr.refs_data,
            'current_value', kr.current_value, 'target_value', kr.target_value,
            'metric_unit', kr.metric_unit, 'trend', kr.trend
          ) ORDER BY kr.code NULLS LAST, kr.created_at)
          FROM v_key_results_with_trend kr WHERE kr.objective_id = t.id),
          '[]'::json
        ) AS key_results
      FROM tree t
      ORDER BY t.depth, t.title`,
      [orgId, cycleId],
    );
  }

  async create(orgId: string, userId: string, dto: CreateObjectiveDto) {
    // P0: validate cycle belongs to this org before creating
    const cycle = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM cycles WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [dto.cycle_id, orgId],
    );
    if (!cycle) throw new NotFoundException('Ciclo no encontrado');

    const description = dto.description?.trim() || null;
    const level = dto.level ?? 'COMPANY';
    try {
      const [row] = await this.db.query<{ p_objective_id: string }>(
        `CALL sp_create_objective($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)`,
        [
          orgId,
          dto.cycle_id,
          dto.parent_objective_id ?? null,
          dto.owner_id ?? userId,
          dto.team_id ?? null,
          level,
          dto.title,
          description,
          userId,
        ],
      );
      const objId = row.p_objective_id;
      if (dto.strategic_intent_id) {
        // Validate intent belongs to org before linking
        const intent = await this.db.queryOne(
          'SELECT id FROM strategic_intents WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
          [dto.strategic_intent_id, orgId],
        );
        if (intent) {
          await this.db.execute(
            'UPDATE objectives SET strategic_intent_id = $1 WHERE id = $2',
            [dto.strategic_intent_id, objId],
          );
        }
      }
      const created = await this.findOne(orgId, objId);
      this.redis.delPattern(`reports:*:${orgId}:*`).catch((err) => this.logger.warn('Failed to invalidate report cache', err));
      if (level === 'TEAM') {
        this.ai.runAlignmentAudit(orgId, dto.cycle_id).catch((err) =>
          this.logger.warn('Auto alignment audit failed on team objective create', err),
        );
      }
      return created;
    } catch (err) {
      const msg: string = err instanceof Error ? err.message : '';
      if (msg.includes('P0006') || msg.includes('límite de 5 objetivos')) {
        throw new BadRequestException(msg);
      }
      if (msg.includes('P0010') || msg.includes('TEAM') || msg.includes('INDIVIDUAL') || msg.includes('padre')) {
        throw new BadRequestException(msg);
      }
      throw err;
    }
  }

  async update(orgId: string, id: string, dto: UpdateObjectiveDto) {
    await this.findOne(orgId, id);
    try {
      await this.db.query(
        `SELECT fn_update_objective($1, $2, $3, $4)`,
        [id, dto.title ?? null, dto.description ?? null, dto.owner_id ?? null],
      );
    } catch (err) {
      const msg: string = err instanceof Error ? err.message : '';
      if (msg.includes('P0003') || msg.includes('No se puede editar')) {
        throw new BadRequestException(msg);
      }
      throw err;
    }
    if (dto.parent_objective_id !== undefined) {
      await this.db.execute(
        'SELECT fn_set_objective_parent($1, $2)',
        [id, dto.parent_objective_id ?? null],
      );
    }
    if (dto.strategic_intent_id !== undefined) {
      const newIntentId = dto.strategic_intent_id || null;
      if (newIntentId) {
        const intent = await this.db.queryOne(
          'SELECT id FROM strategic_intents WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
          [newIntentId, orgId],
        );
        if (!intent) throw new BadRequestException('Intención estratégica no encontrada');
      }
      await this.db.execute(
        'UPDATE objectives SET strategic_intent_id = $1 WHERE id = $2 AND organization_id = $3',
        [newIntentId, id, orgId],
      );
    }
    this.redis.delPattern(`reports:*:${orgId}:*`).catch((err) => this.logger.warn('Failed to invalidate report cache', err));
    return this.findOne(orgId, id);
  }

  async cancel(orgId: string, id: string, userId: string) {
    await this.findOne(orgId, id);
    await this.db.query(`CALL sp_cancel_objective($1, $2)`, [id, userId]);
    this.redis.delPattern(`reports:*:${orgId}:*`).catch((err) => this.logger.warn('Failed to invalidate report cache', err));
    return this.findOne(orgId, id);
  }

  async getAlignments(orgId: string, id: string) {
    return this.db.query(
      `SELECT o.* FROM v_objectives_with_progress o
         JOIN objective_alignments a ON a.target_id = o.id
        WHERE a.source_id = $1 AND o.organization_id = $2
        ORDER BY o.created_at`,
      [id, orgId],
    );
  }

  async addAlignment(orgId: string, sourceId: string, targetId: string) {
    await this.findOne(orgId, sourceId);
    await this.findOne(orgId, targetId);
    await this.db.execute(
      `INSERT INTO objective_alignments (source_id, target_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [sourceId, targetId],
    );
  }

  async removeAlignment(orgId: string, sourceId: string, targetId: string) {
    await this.db.execute(
      `DELETE FROM objective_alignments WHERE source_id = $1 AND target_id = $2`,
      [sourceId, targetId],
    );
  }
}
