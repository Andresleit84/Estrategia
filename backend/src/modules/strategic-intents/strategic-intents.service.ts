import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateStrategicIntentDto } from './dto/create-strategic-intent.dto';
import { UpdateStrategicIntentDto } from './dto/update-strategic-intent.dto';

@Injectable()
export class StrategicIntentsService {
  constructor(private readonly db: DbService) {}

  async findAll(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_strategic_intents_with_stats
        WHERE organization_id = $1
        ORDER BY target_year NULLS LAST, created_at`,
      [orgId],
    );
  }

  async findOne(orgId: string, id: string) {
    const row = await this.db.queryOne(
      `SELECT * FROM v_strategic_intents_with_stats
        WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!row) throw new NotFoundException('Intención estratégica no encontrada');
    return row;
  }

  async create(orgId: string, userId: string, dto: CreateStrategicIntentDto) {
    try {
      const [row] = await this.db.query<{ p_intent_id: string }>(
        `CALL sp_create_strategic_intent($1, $2, $3, $4, $5, $6, $7, NULL)`,
        [
          orgId,
          dto.title,
          dto.description ?? null,
          dto.horizon_years ?? null,
          dto.target_year ?? null,
          dto.category ?? null,
          userId,
        ],
      );
      return this.findOne(orgId, row.p_intent_id);
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('P0012') || msg.includes('al menos 3 caracteres')) {
        throw new BadRequestException(msg);
      }
      throw err;
    }
  }

  async update(orgId: string, id: string, dto: UpdateStrategicIntentDto) {
    await this.findOne(orgId, id);
    try {
      await this.db.query(
        `CALL sp_update_strategic_intent($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          dto.title ?? null,
          dto.description ?? null,
          dto.horizon_years ?? null,
          dto.target_year ?? null,
          dto.category ?? null,
          dto.status ?? null,
        ],
      );
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('P0002') || msg.includes('no encontrada')) {
        throw new NotFoundException(msg);
      }
      throw err;
    }
    return this.findOne(orgId, id);
  }

  async delete(orgId: string, id: string) {
    await this.findOne(orgId, id);
    await this.db.query(
      `UPDATE strategic_intents
          SET deleted_at = NOW()
        WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id, orgId],
    );
    return { deleted: true, id };
  }

  async getLinkedProblems(orgId: string, intentId: string) {
    await this.findOne(orgId, intentId);
    return this.db.query(
      `SELECT * FROM v_problems_with_stats
        WHERE id IN (
          SELECT problem_id FROM problem_intents WHERE intent_id = $1
        )
        ORDER BY priority_score DESC`,
      [intentId],
    );
  }

  async getAlignedObjectives(orgId: string, intentId: string) {
    await this.findOne(orgId, intentId);
    return this.db.query(
      `SELECT * FROM v_objectives_with_progress
        WHERE strategic_intent_id = $1
          AND organization_id = $2
        ORDER BY level, created_at`,
      [intentId, orgId],
    );
  }
}
