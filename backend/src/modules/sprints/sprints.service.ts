import {
  Injectable, NotFoundException, BadRequestException, InternalServerErrorException,
} from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateSprintDto } from './dto/create-sprint.dto';
import { UpdateSprintDto } from './dto/update-sprint.dto';
import { CloseSprintDto } from './dto/close-sprint.dto';
import { LinkKrDto } from './dto/link-kr.dto';
import { GenerateSprintsDto } from './dto/generate-sprints.dto';
import { asPgError } from '../../common/utils/db-error';

function mapDbError(err: unknown): never {
  const e = asPgError(err);
  const code = e.code ?? '';
  const msg  = e.message ?? 'Error de base de datos';

  if (code === 'P0050') throw new BadRequestException('Los sprints solo están disponibles en organizaciones AGILE o HYBRID');
  if (code === 'P0051') throw new BadRequestException(msg.includes('ciclo') ? msg : 'El sprint no puede comenzar antes que el ciclo OKR');
  if (code === 'P0052') throw new BadRequestException(msg.includes('ciclo') ? msg : 'El sprint no puede terminar después del ciclo OKR');
  if (code === 'P0053') throw new BadRequestException('Ya existe un sprint activo para este equipo');
  if (code === 'P0054') throw new BadRequestException('Sprint no encontrado o no está en estado PLANNING');
  if (code === 'P0055') throw new BadRequestException('Sprint no encontrado o no está en estado ACTIVE');
  if (code === '23502') throw new BadRequestException('Falta un campo obligatorio');
  if (code === '23503') throw new BadRequestException('Referencia inválida');
  if (code === '23505') throw new BadRequestException('Ya existe un registro con esos datos');
  if (code === '23514') throw new BadRequestException(`Valor no permitido: ${msg}`);
  throw new InternalServerErrorException();
}

@Injectable()
export class SprintsService {
  constructor(private readonly db: DbService) {}

  private async verifySprint(orgId: string, sprintId: string) {
    const row = await this.db.queryOne<{ id: string; status: string }>(
      `SELECT id, status FROM sprint_cycles WHERE id = $1 AND organization_id = $2`,
      [sprintId, orgId],
    );
    if (!row) throw new NotFoundException('Sprint no encontrado');
    return row;
  }

  async list(orgId: string, filters: { cycle_id?: string; team_id?: string; status?: string }) {
    const params: unknown[] = [orgId];
    let sql = `SELECT * FROM v_cycle_sprint_timeline WHERE organization_id = $1`;

    if (filters.cycle_id) { params.push(filters.cycle_id); sql += ` AND cycle_id = $${params.length}`; }
    if (filters.team_id)  { params.push(filters.team_id);  sql += ` AND team_id = $${params.length}`; }
    if (filters.status)   { params.push(filters.status);   sql += ` AND status = $${params.length}`; }

    sql += ` ORDER BY team_id, start_date`;
    return this.db.query(sql, params);
  }

  async create(orgId: string, userId: string, dto: CreateSprintDto) {
    try {
      const rows = await this.db.query<{ p_sprint_id: string }>(
        `CALL sp_create_sprint($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)`,
        [
          orgId,
          dto.cycle_id,
          dto.team_id,
          dto.name,
          dto.goal ?? null,
          dto.start_date,
          dto.end_date,
          dto.planned_velocity ?? 0,
          userId,
        ],
      );
      const sprintId = rows[0]?.p_sprint_id;
      return this.getBoard(orgId, sprintId);
    } catch (err) {
      mapDbError(err);
    }
  }

  async getBoard(orgId: string, sprintId: string) {
    await this.verifySprint(orgId, sprintId);
    const row = await this.db.queryOne(
      `SELECT * FROM v_sprint_board WHERE sprint_id = $1`,
      [sprintId],
    );
    if (!row) throw new NotFoundException('Sprint no encontrado');
    return row;
  }

  async update(orgId: string, sprintId: string, dto: UpdateSprintDto) {
    await this.verifySprint(orgId, sprintId);

    const sets: string[] = [];
    const params: unknown[] = [sprintId];

    if (dto.name !== undefined)             { params.push(dto.name);             sets.push(`name = $${params.length}`); }
    if (dto.goal !== undefined)             { params.push(dto.goal);             sets.push(`goal = $${params.length}`); }
    if (dto.start_date !== undefined)       { params.push(dto.start_date);       sets.push(`start_date = $${params.length}`); }
    if (dto.end_date !== undefined)         { params.push(dto.end_date);         sets.push(`end_date = $${params.length}`); }
    if (dto.planned_velocity !== undefined) { params.push(dto.planned_velocity); sets.push(`planned_velocity = $${params.length}`); }

    if (sets.length === 0) return this.getBoard(orgId, sprintId);

    try {
      await this.db.execute(
        `UPDATE sprint_cycles SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`,
        params,
      );
    } catch (err) {
      mapDbError(err);
    }
    return this.getBoard(orgId, sprintId);
  }

  async activate(orgId: string, sprintId: string, userId: string) {
    await this.verifySprint(orgId, sprintId);
    try {
      await this.db.execute(`CALL sp_activate_sprint($1, $2)`, [sprintId, userId]);
    } catch (err) {
      mapDbError(err);
    }
    return this.getBoard(orgId, sprintId);
  }

  async close(orgId: string, sprintId: string, userId: string, dto: CloseSprintDto) {
    await this.verifySprint(orgId, sprintId);
    try {
      const rows = await this.db.query<{ p_suggested_checkins: unknown }>(
        `CALL sp_close_sprint($1, $2, $3, NULL)`,
        [sprintId, dto.actual_velocity ?? 0, userId],
      );
      return {
        sprint: await this.getBoard(orgId, sprintId),
        suggested_checkins: rows[0]?.p_suggested_checkins ?? [],
      };
    } catch (err) {
      mapDbError(err);
    }
  }

  async getOkrImpact(orgId: string, sprintId: string) {
    await this.verifySprint(orgId, sprintId);
    const [row] = await this.db.query<{ fn_sprint_okr_impact: unknown }>(
      `SELECT fn_sprint_okr_impact($1)`,
      [sprintId],
    );
    return row?.fn_sprint_okr_impact ?? {};
  }

  async linkKr(orgId: string, sprintId: string, dto: LinkKrDto) {
    await this.verifySprint(orgId, sprintId);
    // Verify KR belongs to org
    const kr = await this.db.queryOne<{ id: string }>(
      `SELECT kr.id FROM key_results kr
       JOIN objectives o ON kr.objective_id = o.id
       WHERE kr.id = $1 AND o.organization_id = $2 AND kr.deleted_at IS NULL`,
      [dto.kr_id, orgId],
    );
    if (!kr) throw new NotFoundException('KR no encontrado');

    await this.db.execute(
      `INSERT INTO sprint_goal_krs (sprint_id, kr_id, expected_contribution)
       VALUES ($1, $2, $3) ON CONFLICT (sprint_id, kr_id) DO UPDATE SET expected_contribution = $3`,
      [sprintId, dto.kr_id, dto.expected_contribution ?? 0],
    );
    return this.getBoard(orgId, sprintId);
  }

  async unlinkKr(orgId: string, sprintId: string, krId: string) {
    await this.verifySprint(orgId, sprintId);
    await this.db.execute(
      `DELETE FROM sprint_goal_krs WHERE sprint_id = $1 AND kr_id = $2`,
      [sprintId, krId],
    );
    return this.getBoard(orgId, sprintId);
  }

  async getBurnup(orgId: string, cycleId: string, teamId: string) {
    // Verify cycle belongs to org
    const cycle = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM cycles WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [cycleId, orgId],
    );
    if (!cycle) throw new NotFoundException('Ciclo no encontrado');

    const [row] = await this.db.query<{ fn_calculate_burnup: unknown }>(
      `SELECT fn_calculate_burnup($1, $2)`,
      [cycleId, teamId],
    );
    return row?.fn_calculate_burnup ?? [];
  }

  async getTimeline(orgId: string, cycleId: string, filters: { team_id?: string }) {
    const params: unknown[] = [orgId, cycleId];
    let sql = `SELECT * FROM v_cycle_sprint_timeline WHERE organization_id = $1 AND cycle_id = $2`;
    if (filters.team_id) { params.push(filters.team_id); sql += ` AND team_id = $${params.length}`; }
    sql += ` ORDER BY team_id, start_date`;
    return this.db.query(sql, params);
  }

  async getVelocity(orgId: string, teamId: string) {
    return this.db.query(
      `SELECT * FROM v_sprint_velocity WHERE organization_id = $1 AND team_id = $2 ORDER BY sprint_num`,
      [orgId, teamId],
    );
  }

  async getActiveForTeam(orgId: string, teamId: string) {
    const row = await this.db.queryOne(
      `SELECT * FROM v_sprint_board
       WHERE organization_id = $1 AND team_id = $2 AND status = 'ACTIVE'`,
      [orgId, teamId],
    );
    return row ?? null;
  }

  async generate(orgId: string, userId: string, dto: GenerateSprintsDto) {
    const cycle = await this.db.queryOne<{ start_date: string; end_date: string }>(
      `SELECT start_date, end_date FROM cycles WHERE id = $1 AND organization_id = $2`,
      [dto.cycle_id, orgId],
    );
    if (!cycle) throw new NotFoundException('Ciclo no encontrado');
    if (!cycle.start_date || !cycle.end_date) {
      throw new BadRequestException('El ciclo debe tener fechas de inicio y fin para generar sprints');
    }

    const active = await this.db.queryOne(
      `SELECT id FROM sprint_cycles WHERE cycle_id = $1 AND team_id = $2 AND status = 'ACTIVE'`,
      [dto.cycle_id, dto.team_id],
    );
    if (active) throw new BadRequestException('Existe un sprint activo para este equipo. Ciérralo primero.');

    await this.db.execute(
      `DELETE FROM sprint_cycles WHERE cycle_id = $1 AND team_id = $2 AND status = 'PLANNING'`,
      [dto.cycle_id, dto.team_id],
    );

    const cycleEnd   = new Date(cycle.end_date);
    const dayMs      = 86_400_000;
    const sprintDays = dto.sprint_length_weeks * 7;
    const startFrom  = dto.start_from ? new Date(dto.start_from) : new Date(cycle.start_date);

    let current = new Date(startFrom);
    let num     = 1;
    const MAX_SPRINTS = 52;

    while (current < cycleEnd && num <= MAX_SPRINTS) {
      const endMs    = current.getTime() + sprintDays * dayMs - dayMs;
      const sprintEnd = new Date(Math.min(endMs, cycleEnd.getTime()));

      try {
        const rows = await this.db.query<{ p_sprint_id: string }>(
          `CALL sp_create_sprint($1,$2,$3,$4,$5,$6,$7,$8,$9,NULL)`,
          [
            orgId, dto.cycle_id, dto.team_id,
            `Sprint ${num}`, null,
            current.toISOString().split('T')[0],
            sprintEnd.toISOString().split('T')[0],
            dto.planned_velocity ?? 0,
            userId,
          ],
        );
        if (!rows[0]?.p_sprint_id) break;
      } catch {
        break;
      }

      current = new Date(sprintEnd.getTime() + dayMs);
      num++;
    }

    return this.list(orgId, { cycle_id: dto.cycle_id, team_id: dto.team_id });
  }

  async delete(orgId: string, sprintId: string) {
    const sprint = await this.verifySprint(orgId, sprintId);
    if (sprint.status === 'ACTIVE') {
      throw new BadRequestException('No se puede eliminar un sprint activo. Ciérralo primero.');
    }
    if (sprint.status === 'COMPLETED') {
      throw new BadRequestException('No se puede eliminar un sprint completado.');
    }
    await this.db.execute(
      `UPDATE sprint_cycles SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
      [sprintId],
    );
    return { message: 'Sprint cancelado' };
  }
}
