import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';

@Injectable()
export class ProblemsService {
  constructor(private readonly db: DbService) {}

  async findAll(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_problems_with_stats
        WHERE organization_id = $1
        ORDER BY priority_score DESC, created_at DESC`,
      [orgId],
    );
  }

  async findOne(orgId: string, id: string) {
    const row = await this.db.queryOne(
      `SELECT * FROM v_problems_with_stats
        WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!row) throw new NotFoundException('Problema no encontrado');
    return row;
  }

  async create(orgId: string, userId: string, dto: CreateProblemDto) {
    try {
      const [row] = await this.db.query<{ p_problem_id: string }>(
        `CALL sp_create_problem($1, $2, $3, $4, $5, $6, $7, NULL)`,
        [
          orgId,
          dto.title,
          dto.description ?? null,
          dto.category ?? null,
          dto.severity,
          dto.frequency,
          userId,
        ],
      );
      return this.findOne(orgId, row.p_problem_id);
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('P0011') || msg.includes('al menos 3 caracteres')) {
        throw new BadRequestException(msg);
      }
      throw err;
    }
  }

  async update(orgId: string, id: string, dto: UpdateProblemDto) {
    await this.findOne(orgId, id);
    try {
      await this.db.query(
        `CALL sp_update_problem($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          dto.title ?? null,
          dto.description ?? null,
          dto.category ?? null,
          dto.severity ?? null,
          dto.frequency ?? null,
          dto.status ?? null,
        ],
      );
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('P0002') || msg.includes('no encontrado')) {
        throw new NotFoundException(msg);
      }
      throw err;
    }
    return this.findOne(orgId, id);
  }

  async delete(orgId: string, id: string) {
    await this.findOne(orgId, id);
    await this.db.query(
      `UPDATE organizational_problems
          SET deleted_at = NOW()
        WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id, orgId],
    );
    return { deleted: true, id };
  }

  async findIntents(orgId: string, problemId: string) {
    await this.findOne(orgId, problemId);
    return this.db.query(
      `SELECT si.id, si.title, si.category, si.status, si.horizon_years, si.target_year
         FROM strategic_intents si
         JOIN problem_intents pi ON pi.intent_id = si.id
        WHERE pi.problem_id = $1 AND si.organization_id = $2 AND si.deleted_at IS NULL
        ORDER BY si.created_at`,
      [problemId, orgId],
    );
  }

  async linkToIntent(orgId: string, problemId: string, intentId: string) {
    // Verify problem belongs to org
    await this.findOne(orgId, problemId);

    // Verify intent belongs to org
    const intent = await this.db.queryOne(
      `SELECT id FROM strategic_intents
        WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [intentId, orgId],
    );
    if (!intent) throw new NotFoundException('Intención estratégica no encontrada');

    await this.db.query(
      `INSERT INTO problem_intents (problem_id, intent_id)
       VALUES ($1, $2)
       ON CONFLICT (problem_id, intent_id) DO NOTHING`,
      [problemId, intentId],
    );
    return { linked: true, problemId, intentId };
  }

  async unlinkFromIntent(orgId: string, problemId: string, intentId: string) {
    await this.findOne(orgId, problemId);
    await this.db.query(
      `DELETE FROM problem_intents
        WHERE problem_id = $1 AND intent_id = $2`,
      [problemId, intentId],
    );
    return { unlinked: true, problemId, intentId };
  }
}
