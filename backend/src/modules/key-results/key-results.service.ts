import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateKeyResultDto } from './dto/create-key-result.dto';
import { UpdateKeyResultDto } from './dto/update-key-result.dto';
import { asPgError } from '../../common/utils/db-error';

@Injectable()
export class KeyResultsService {
  constructor(private readonly db: DbService) {}

  private async verifyOrgOwnership(orgId: string, krId: string) {
    const kr = await this.db.queryOne<{ id: string }>(
      `SELECT kr.id FROM key_results kr
       JOIN objectives o ON o.id = kr.objective_id
       WHERE kr.id = $1 AND o.organization_id = $2 AND kr.deleted_at IS NULL`,
      [krId, orgId],
    );
    if (!kr) throw new NotFoundException('Resultado clave no encontrado');
    return kr;
  }

  async findOne(orgId: string, id: string) {
    await this.verifyOrgOwnership(orgId, id);
    const kr = await this.db.queryOne(
      'SELECT * FROM v_key_results_with_trend WHERE id = $1',
      [id],
    );
    if (!kr) throw new NotFoundException('Resultado clave no encontrado');
    return kr;
  }

  async create(orgId: string, objId: string, userId: string, dto: CreateKeyResultDto) {
    // Verify the objective belongs to this org
    const obj = await this.db.queryOne<{ id: string }>(
      'SELECT id FROM objectives WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL',
      [objId, orgId],
    );
    if (!obj) throw new NotFoundException('Objetivo no encontrado');

    // P2: cross-field validation for directional KRs
    const type = dto.type ?? 'INCREASE';
    const start = dto.start_value ?? 0;
    const target = dto.target_value;
    if (type === 'INCREASE' && target <= start) {
      throw new BadRequestException(
        'Para tipo INCREASE, el valor objetivo debe ser mayor al valor inicial',
      );
    }
    if (type === 'DECREASE' && target >= start) {
      throw new BadRequestException(
        'Para tipo DECREASE, el valor objetivo debe ser menor al valor inicial',
      );
    }
    const description = dto.description?.trim() || null;
    try {
      const [row] = await this.db.query<{ p_kr_id: string }>(
        `CALL sp_create_key_result($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL)`,
        [
          objId,
          dto.owner_id ?? userId,
          dto.title,
          dto.type ?? 'INCREASE',
          dto.metric_unit ?? '%',
          dto.start_value ?? 0,
          dto.target_value,
          description,
          userId,
          dto.check_in_cadence ?? 'BIWEEKLY',
          dto.team_id ?? null,
        ],
      );
      return this.findOne(orgId, row.p_kr_id);
    } catch (err: unknown) {
      const msg = asPgError(err).message ?? '';
      if (msg.includes('P0007') || msg.includes('límite de 5 resultados')) {
        throw new BadRequestException(msg);
      }
      throw err;
    }
  }

  async update(orgId: string, id: string, dto: UpdateKeyResultDto) {
    await this.verifyOrgOwnership(orgId, id);
    try {
      await this.db.query(
        `SELECT fn_update_key_result($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          dto.title ?? null,
          dto.description ?? null,
          dto.current_value ?? null,
          dto.confidence ?? null,
          dto.owner_id ?? null,
          dto.type ?? null,
          dto.metric_unit ?? null,
          dto.start_value ?? null,
          dto.target_value ?? null,
          dto.check_in_cadence ?? null,
          dto.team_id ?? null,
        ],
      );
    } catch (err: unknown) {
      const msg = asPgError(err).message ?? '';
      if (msg.includes('P0003') || msg.includes('No se puede editar')) {
        throw new BadRequestException(msg);
      }
      throw err;
    }
    return this.findOne(orgId, id);
  }

  async cancel(orgId: string, id: string, userId: string) {
    await this.verifyOrgOwnership(orgId, id);
    await this.db.query(`CALL sp_cancel_key_result($1, $2)`, [id, userId]);
    return this.findOne(orgId, id);
  }
}
