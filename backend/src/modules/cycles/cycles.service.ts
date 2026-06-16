import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { AiService } from '../ai/ai.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';
import { RolloverCycleDto } from './dto/rollover-cycle.dto';
import { asPgError } from '../../common/utils/db-error';

@Injectable()
export class CyclesService {
  private readonly logger = new Logger(CyclesService.name);

  constructor(
    private readonly db: DbService,
    private readonly ai: AiService,
  ) {}

  async findAll(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_cycles_with_stats WHERE organization_id = $1 ORDER BY start_date DESC`,
      [orgId],
    );
  }

  async findActive(orgId: string) {
    return this.db.queryOne(
      `SELECT * FROM v_cycles_with_stats
        WHERE organization_id = $1 AND status = 'ACTIVE'
        ORDER BY (end_date - start_date) ASC`,
      [orgId],
    );
  }

  async findOne(orgId: string, cycleId: string) {
    const cycle = await this.db.queryOne(
      `SELECT * FROM v_cycles_with_stats WHERE organization_id = $1 AND id = $2`,
      [orgId, cycleId],
    );
    if (!cycle) throw new NotFoundException('Ciclo no encontrado');
    return cycle;
  }

  async create(orgId: string, userId: string, dto: CreateCycleDto) {
    const description = dto.description?.trim() || null;
    try {
      const [row] = await this.db.query<{ p_cycle_id: string }>(
        `CALL sp_create_cycle($1, $2, $3, $4, $5::DATE, $6::DATE, $7, NULL)`,
        [orgId, dto.name, description, dto.type ?? 'ANNUAL', dto.start_date, dto.end_date, userId],
      );
      return this.findOne(orgId, row.p_cycle_id);
    } catch (err: unknown) {
      const msg = asPgError(err).message ?? '';
      if (msg.includes('La fecha de fin debe ser posterior') || msg.includes('P0005')) {
        throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      if (msg.includes('cycles_dates_check')) {
        throw new BadRequestException('La fecha de fin debe ser posterior a la fecha de inicio');
      }
      throw err;
    }
  }

  async update(orgId: string, cycleId: string, dto: UpdateCycleDto) {
    await this.findOne(orgId, cycleId);
    await this.db.execute(
      `SELECT fn_update_cycle($1, $2, $3, $4, $5::DATE, $6::DATE)`,
      [cycleId, dto.name ?? null, dto.description ?? null, dto.type ?? null, dto.start_date ?? null, dto.end_date ?? null],
    );
    return this.findOne(orgId, cycleId);
  }

  async activate(orgId: string, cycleId: string, userId: string) {
    await this.findOne(orgId, cycleId);
    try {
      await this.db.execute(`CALL sp_activate_cycle($1, $2)`, [cycleId, userId]);
    } catch (err: unknown) {
      throw new BadRequestException(asPgError(err).message ?? 'No se pudo activar el ciclo');
    }
    // Auto-dispatch alignment audit async (fire and forget)
    this.ai.runAlignmentAudit(orgId, cycleId).catch((err) =>
      this.logger.warn('Auto alignment audit failed on cycle activate', err),
    );
    return this.findOne(orgId, cycleId);
  }

  async close(orgId: string, cycleId: string, userId: string) {
    await this.findOne(orgId, cycleId);
    try {
      await this.db.execute(`CALL sp_close_cycle($1, $2)`, [cycleId, userId]);
    } catch (err: unknown) {
      throw new BadRequestException(asPgError(err).message ?? 'No se pudo cerrar el ciclo');
    }
    // Auto-dispatch close briefing async (fire and forget)
    this.ai.generateCycleCloseBriefing(orgId, cycleId).catch((err) =>
      this.logger.warn('Auto cycle close briefing failed', err),
    );
    return this.findOne(orgId, cycleId);
  }

  async getScore(orgId: string, cycleId: string) {
    await this.findOne(orgId, cycleId);
    const row = await this.db.queryOne<{ score: number }>(
      `SELECT fn_get_cycle_score($1) AS score`,
      [cycleId],
    );
    return { score: row?.score ?? 0 };
  }

  async getIncomplete(orgId: string, cycleId: string) {
    await this.findOne(orgId, cycleId);
    return this.db.query(
      `SELECT o.id, o.title, o.level, o.status,
              fn_calculate_objective_progress(o.id) AS progress,
              COALESCE(
                json_agg(
                  json_build_object(
                    'id',           kr.id,
                    'title',        kr.title,
                    'progress',     kr.progress,
                    'status',       kr.status,
                    'current_value',kr.current_value,
                    'target_value', kr.target_value,
                    'metric_unit',  kr.metric_unit
                  ) ORDER BY kr.created_at
                ) FILTER (WHERE kr.id IS NOT NULL),
                '[]'
              ) AS key_results
         FROM objectives o
         LEFT JOIN key_results kr
                ON kr.objective_id = o.id
               AND kr.deleted_at IS NULL
               AND kr.status <> 'CANCELLED'
        WHERE o.cycle_id = $1
          AND o.deleted_at IS NULL
          AND o.status NOT IN ('COMPLETED', 'CANCELLED')
        GROUP BY o.id, o.title, o.level, o.status
       HAVING fn_calculate_objective_progress(o.id) < 100
        ORDER BY fn_calculate_objective_progress(o.id) DESC`,
      [cycleId],
    );
  }

  async rollover(orgId: string, fromCycleId: string, userId: string, dto: RolloverCycleDto) {
    await this.findOne(orgId, fromCycleId);
    await this.findOne(orgId, dto.to_cycle_id);
    try {
      await this.db.execute(
        `CALL sp_rollover_cycle_items($1, $2, $3::uuid[], $4)`,
        [fromCycleId, dto.to_cycle_id, dto.objective_ids, userId],
      );
    } catch (err: unknown) {
      throw new BadRequestException(asPgError(err).message ?? 'No se pudo migrar los objetivos');
    }
    return { migrated: dto.objective_ids.length };
  }
}
