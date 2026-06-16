import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { UpdateProgramDto } from './dto/update-program.dto';
import { CreatePhaseDto } from './dto/create-phase.dto';
import { UpdatePhaseDto } from './dto/update-phase.dto';
import { CreateDeliverableDto } from './dto/create-deliverable.dto';
import { UpdateDeliverableDto } from './dto/update-deliverable.dto';
import { asPgError } from '../../common/utils/db-error';

function mapDbError(err: unknown): never {
  const e = asPgError(err);
  const code = e.code ?? '';
  const msg  = e.message ?? 'Error de base de datos';

  if (code === '23502') throw new BadRequestException('Falta un campo obligatorio');
  if (code === '23503') throw new BadRequestException('Referencia inválida (FK no existe)');
  if (code === '23505') throw new BadRequestException('Ya existe un registro con esos datos');
  if (code === '23514') throw new BadRequestException(`Valor no permitido: ${msg}`);
  throw err;
}

@Injectable()
export class DeliveryService {
  constructor(private readonly db: DbService) {}

  // ── Programs ──────────────────────────────────────────────────────────────

  async listPrograms(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_program_dashboard WHERE organization_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
  }

  async createProgram(orgId: string, userId: string, dto: CreateProgramDto) {
    try {
      const [row] = await this.db.query<{ id: string }>(
        `INSERT INTO delivery_programs (organization_id, name, description, cycle_id, status, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          orgId,
          dto.name,
          dto.description ?? null,
          dto.cycle_id ?? null,
          dto.status ?? 'DRAFT',
          userId,
        ],
      );
      return this.db.queryOne(
        `SELECT * FROM v_program_dashboard WHERE id = $1`,
        [row.id],
      );
    } catch (err: any) {
      mapDbError(err);
    }
  }

  async getProgram(orgId: string, programId: string) {
    const program = await this.db.queryOne(
      `SELECT * FROM v_program_dashboard WHERE id = $1 AND organization_id = $2`,
      [programId, orgId],
    );
    if (!program) throw new NotFoundException('Programa de entrega no encontrado');

    const phases = await this.db.query<{ id: string } & Record<string, unknown>>(
      `SELECT * FROM v_phase_progress WHERE program_id = $1 ORDER BY order_index`,
      [programId],
    );

    const phaseIds = phases.map((p) => p.id);

    // Fetch all deliverables for all phases in a single query
    const allDeliverables = phaseIds.length > 0
      ? await this.db.query<{ phase_id: string } & Record<string, unknown>>(
          `SELECT * FROM v_deliverables_full WHERE phase_id = ANY($1) ORDER BY created_at`,
          [`{${phaseIds.join(',')}}`],
        )
      : [];

    // Fetch dependencies for all deliverables
    const delivIds = allDeliverables.map((d: any) => d.id);
    const allDeps = delivIds.length > 0
      ? await this.db.query<{ deliverable_id: string; depends_on_id: string; depends_on_title: string }>(
          `SELECT dd.deliverable_id, dd.depends_on_id, d.title AS depends_on_title
             FROM deliverable_dependencies dd
             JOIN deliverables d ON d.id = dd.depends_on_id
            WHERE dd.deliverable_id = ANY($1)`,
          [`{${delivIds.join(',')}}`],
        )
      : [];

    // Group deliverables and deps by phase
    const depsByDeliv = new Map<string, typeof allDeps>();
    for (const dep of allDeps) {
      const list = depsByDeliv.get(dep.deliverable_id) ?? [];
      list.push(dep);
      depsByDeliv.set(dep.deliverable_id, list);
    }

    const delivsByPhase = new Map<string, typeof allDeliverables>();
    for (const deliv of allDeliverables) {
      const list = delivsByPhase.get(deliv.phase_id) ?? [];
      list.push({
        ...deliv,
        dependencies: depsByDeliv.get((deliv as any).id) ?? [],
      });
      delivsByPhase.set(deliv.phase_id, list);
    }

    const phasesWithDeliverables = phases.map((phase) => ({
      ...phase,
      deliverables: delivsByPhase.get(phase.id) ?? [],
    }));

    return { program, phases: phasesWithDeliverables };
  }

  async updateProgram(orgId: string, programId: string, dto: UpdateProgramDto) {
    const existing = await this.db.queryOne(
      `SELECT id FROM delivery_programs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [programId, orgId],
    );
    if (!existing) throw new NotFoundException('Programa de entrega no encontrado');

    const fields: string[] = [];
    const params: unknown[] = [];

    if (dto.name !== undefined)        { params.push(dto.name);        fields.push(`name = $${params.length}`); }
    if (dto.description !== undefined) { params.push(dto.description); fields.push(`description = $${params.length}`); }
    if (dto.cycle_id !== undefined)    { params.push(dto.cycle_id);    fields.push(`cycle_id = $${params.length}`); }
    if (dto.status !== undefined)      { params.push(dto.status);      fields.push(`status = $${params.length}`); }

    if (fields.length === 0) {
      return this.db.queryOne(`SELECT * FROM v_program_dashboard WHERE id = $1`, [programId]);
    }

    params.push(programId, orgId);
    try {
      await this.db.execute(
        `UPDATE delivery_programs SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $${params.length - 1} AND organization_id = $${params.length} AND deleted_at IS NULL`,
        params,
      );
    } catch (err: any) {
      mapDbError(err);
    }

    return this.db.queryOne(`SELECT * FROM v_program_dashboard WHERE id = $1`, [programId]);
  }

  async deleteProgram(orgId: string, programId: string) {
    const existing = await this.db.queryOne(
      `SELECT id FROM delivery_programs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [programId, orgId],
    );
    if (!existing) throw new NotFoundException('Programa de entrega no encontrado');

    await this.db.execute(
      `UPDATE delivery_programs SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [programId, orgId],
    );
    return { success: true };
  }

  // ── Phases ────────────────────────────────────────────────────────────────

  private async verifyPhaseAccess(orgId: string, phaseId: string) {
    const row = await this.db.queryOne<{ id: string }>(
      `SELECT dp.id
         FROM delivery_phases dp
         JOIN delivery_programs prog ON prog.id = dp.program_id
        WHERE dp.id = $1 AND prog.organization_id = $2 AND prog.deleted_at IS NULL`,
      [phaseId, orgId],
    );
    if (!row) throw new NotFoundException('Fase no encontrada');
    return row;
  }

  async createPhase(orgId: string, programId: string, dto: CreatePhaseDto) {
    const program = await this.db.queryOne(
      `SELECT id FROM delivery_programs WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [programId, orgId],
    );
    if (!program) throw new NotFoundException('Programa de entrega no encontrado');

    const [orderRow] = await this.db.query<{ next_order: number }>(
      `SELECT COALESCE(MAX(order_index), 0) + 1 AS next_order FROM delivery_phases WHERE program_id = $1`,
      [programId],
    );
    const orderIndex = orderRow?.next_order ?? 1;

    try {
      const [row] = await this.db.query<{ id: string }>(
        `INSERT INTO delivery_phases (program_id, name, description, gate_criteria, target_start_date, target_end_date, order_index, owner_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [
          programId,
          dto.name,
          dto.description ?? null,
          dto.gate_criteria ?? null,
          dto.target_start_date ?? null,
          dto.target_end_date ?? null,
          orderIndex,
          dto.owner_id ?? null,
        ],
      );
      return this.db.queryOne(
        `SELECT * FROM v_phase_progress WHERE id = $1`,
        [row.id],
      );
    } catch (err: any) {
      mapDbError(err);
    }
  }

  async updatePhase(orgId: string, phaseId: string, dto: UpdatePhaseDto) {
    await this.verifyPhaseAccess(orgId, phaseId);

    const fields: string[] = [];
    const params: unknown[] = [];

    if (dto.name !== undefined)              { params.push(dto.name);              fields.push(`name = $${params.length}`); }
    if (dto.description !== undefined)       { params.push(dto.description);       fields.push(`description = $${params.length}`); }
    if (dto.gate_criteria !== undefined)     { params.push(dto.gate_criteria);     fields.push(`gate_criteria = $${params.length}`); }
    if (dto.target_start_date !== undefined) { params.push(dto.target_start_date); fields.push(`target_start_date = $${params.length}`); }
    if (dto.target_end_date !== undefined)   { params.push(dto.target_end_date);   fields.push(`target_end_date = $${params.length}`); }
    if (dto.status !== undefined)            { params.push(dto.status);            fields.push(`status = $${params.length}`); }
    if (dto.order_index !== undefined)       { params.push(dto.order_index);       fields.push(`order_index = $${params.length}`); }
    if (dto.owner_id !== undefined)          { params.push(dto.owner_id ?? null);  fields.push(`owner_id = $${params.length}`); }

    if (fields.length === 0) {
      return this.db.queryOne(`SELECT * FROM v_phase_progress WHERE id = $1`, [phaseId]);
    }

    params.push(phaseId);
    try {
      await this.db.execute(
        `UPDATE delivery_phases SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`,
        params,
      );
    } catch (err: any) {
      mapDbError(err);
    }

    return this.db.queryOne(`SELECT * FROM v_phase_progress WHERE id = $1`, [phaseId]);
  }

  async deletePhase(orgId: string, phaseId: string) {
    await this.verifyPhaseAccess(orgId, phaseId);
    await this.db.execute(`DELETE FROM delivery_phases WHERE id = $1`, [phaseId]);
    return { success: true };
  }

  // ── Deliverables ──────────────────────────────────────────────────────────

  private async verifyDeliverableAccess(orgId: string, delivId: string) {
    const row = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM deliverables WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [delivId, orgId],
    );
    if (!row) throw new NotFoundException('Entregable no encontrado');
    return row;
  }

  async createDeliverable(orgId: string, phaseId: string, userId: string, dto: CreateDeliverableDto) {
    await this.verifyPhaseAccess(orgId, phaseId);

    try {
      const [row] = await this.db.query<{ id: string }>(
        `INSERT INTO deliverables
           (phase_id, organization_id, title, description, acceptance_criteria,
            owner_id, due_date, document_url, notes, linked_objective_id, linked_initiative_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         RETURNING id`,
        [
          phaseId,
          orgId,
          dto.title,
          dto.description ?? null,
          dto.acceptance_criteria ?? null,
          dto.owner_id ?? null,
          dto.due_date ?? null,
          dto.document_url ?? null,
          dto.notes ?? null,
          dto.linked_objective_id ?? null,
          dto.linked_initiative_id ?? null,
          userId,
        ],
      );
      return this.db.queryOne(
        `SELECT * FROM v_deliverables_full WHERE id = $1`,
        [row.id],
      );
    } catch (err: any) {
      mapDbError(err);
    }
  }

  async updateDeliverable(orgId: string, delivId: string, dto: UpdateDeliverableDto) {
    await this.verifyDeliverableAccess(orgId, delivId);

    const fields: string[] = [];
    const params: unknown[] = [];

    if (dto.title !== undefined)               { params.push(dto.title);               fields.push(`title = $${params.length}`); }
    if (dto.description !== undefined)         { params.push(dto.description);         fields.push(`description = $${params.length}`); }
    if (dto.acceptance_criteria !== undefined) { params.push(dto.acceptance_criteria); fields.push(`acceptance_criteria = $${params.length}`); }
    if (dto.owner_id !== undefined)            { params.push(dto.owner_id);            fields.push(`owner_id = $${params.length}`); }
    if (dto.due_date !== undefined)            { params.push(dto.due_date);            fields.push(`due_date = $${params.length}`); }
    if (dto.status !== undefined)              { params.push(dto.status);              fields.push(`status = $${params.length}`); }
    if (dto.document_url !== undefined)        { params.push(dto.document_url);        fields.push(`document_url = $${params.length}`); }
    if (dto.notes !== undefined)               { params.push(dto.notes);               fields.push(`notes = $${params.length}`); }
    if (dto.linked_objective_id !== undefined) { params.push(dto.linked_objective_id); fields.push(`linked_objective_id = $${params.length}`); }
    if (dto.linked_initiative_id !== undefined){ params.push(dto.linked_initiative_id);fields.push(`linked_initiative_id = $${params.length}`); }

    if (fields.length === 0) {
      return this.db.queryOne(`SELECT * FROM v_deliverables_full WHERE id = $1`, [delivId]);
    }

    params.push(delivId, orgId);
    try {
      await this.db.execute(
        `UPDATE deliverables SET ${fields.join(', ')}, updated_at = NOW()
          WHERE id = $${params.length - 1} AND organization_id = $${params.length} AND deleted_at IS NULL`,
        params,
      );
    } catch (err: any) {
      mapDbError(err);
    }

    return this.db.queryOne(`SELECT * FROM v_deliverables_full WHERE id = $1`, [delivId]);
  }

  async deleteDeliverable(orgId: string, delivId: string) {
    await this.verifyDeliverableAccess(orgId, delivId);
    await this.db.execute(
      `UPDATE deliverables SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2`,
      [delivId, orgId],
    );
    return { success: true };
  }

  // ── Upcoming ──────────────────────────────────────────────────────────────

  async getUpcoming(orgId: string, days = 30) {
    return this.db.query(
      `SELECT * FROM v_upcoming_deliverables
        WHERE organization_id = $1
          AND due_date <= CURRENT_DATE + $2::int
        ORDER BY due_date ASC
        LIMIT 20`,
      [orgId, days],
    );
  }
}
