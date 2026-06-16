import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { AddCycleDto } from './dto/add-cycle.dto';

@Injectable()
export class TransformationProgramService {
  constructor(private readonly db: DbService) {}

  async findAll(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_transformation_programs WHERE organization_id = $1 ORDER BY start_year, created_at`,
      [orgId],
    );
  }

  async findOne(orgId: string, id: string) {
    const program = await this.db.queryOne(
      `SELECT * FROM v_transformation_programs WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!program) throw new NotFoundException('Program not found');
    return program;
  }

  async create(orgId: string, userId: string, dto: CreateProgramDto) {
    const result = await this.db.queryOne<{ p_id: string }>(
      `CALL sp_create_program($1, $2, $3, $4, $5, $6, $7, NULL)`,
      [orgId, userId, dto.title, dto.description ?? null, dto.start_year, dto.end_year, dto.vision_statement ?? null],
    );
    return this.findOne(orgId, result!.p_id);
  }

  async update(orgId: string, id: string, body: Partial<{ title: string; description: string; status: string; vision_statement: string }>) {
    const existing = await this.db.queryOne(
      `SELECT id FROM transformation_programs WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!existing) throw new NotFoundException('Program not found');

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (body.title !== undefined)            { setClauses.push(`title = $${idx++}`);            params.push(body.title); }
    if (body.description !== undefined)      { setClauses.push(`description = $${idx++}`);      params.push(body.description); }
    if (body.status !== undefined)           { setClauses.push(`status = $${idx++}`);           params.push(body.status); }
    if (body.vision_statement !== undefined) { setClauses.push(`vision_statement = $${idx++}`); params.push(body.vision_statement); }

    if (setClauses.length > 0) {
      params.push(id, orgId);
      await this.db.execute(
        `UPDATE transformation_programs SET ${setClauses.join(', ')} WHERE id = $${idx++} AND organization_id = $${idx++}`,
        params,
      );
    }

    return this.findOne(orgId, id);
  }

  async addCycle(orgId: string, programId: string, dto: AddCycleDto) {
    const existing = await this.db.queryOne(
      `SELECT id FROM transformation_programs WHERE id = $1 AND organization_id = $2`,
      [programId, orgId],
    );
    if (!existing) throw new NotFoundException('Program not found');

    const cycle = await this.db.queryOne(
      `SELECT id FROM cycles WHERE id = $1 AND organization_id = $2`,
      [dto.cycle_id, orgId],
    );
    if (!cycle) throw new NotFoundException('Cycle not found in this organization');

    await this.db.execute(
      `CALL sp_add_program_cycle($1, $2, $3, $4, $5, $6)`,
      [programId, dto.cycle_id, dto.year_label, dto.year_number, dto.focus_areas ?? null, dto.expected_outcomes ?? null],
    );

    return this.findOne(orgId, programId);
  }

  async removeCycle(orgId: string, programId: string, cycleId: string) {
    const existing = await this.db.queryOne(
      `SELECT id FROM transformation_programs WHERE id = $1 AND organization_id = $2`,
      [programId, orgId],
    );
    if (!existing) throw new NotFoundException('Program not found');

    await this.db.execute(
      `CALL sp_remove_program_cycle($1, $2)`,
      [programId, cycleId],
    );

    return this.findOne(orgId, programId);
  }

  async remove(orgId: string, id: string) {
    const existing = await this.db.queryOne(
      `SELECT id FROM transformation_programs WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!existing) throw new NotFoundException('Program not found');

    await this.db.execute(
      `DELETE FROM transformation_programs WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
  }
}
