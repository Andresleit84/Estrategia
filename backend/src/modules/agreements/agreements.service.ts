import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { TelegramService } from '../../common/telegram/telegram.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';

const STATUS_ES: Record<string, string> = {
  OPEN:        'Abierto',
  PENDING:     'Pendiente',
  IN_PROGRESS: 'En progreso',
  TRACKING:    'En seguimiento',
  EVIDENCE:    'Evidencia',
  FULFILLED:   'Cumplido',
  CLOSED:      'Cerrado',
  ESCALATED:   'Escalado',
  CANCELLED:   'Cancelado',
};
const STATUS_ICON: Record<string, string> = {
  OPEN:        '🔵',
  PENDING:     '⏳',
  IN_PROGRESS: '🟡',
  TRACKING:    '🔍',
  EVIDENCE:    '📋',
  FULFILLED:   '✅',
  CLOSED:      '🔒',
  ESCALATED:   '🚨',
  CANCELLED:   '⚫',
};

@Injectable()
export class AgreementsService {
  constructor(
    private readonly db: DbService,
    private readonly telegram: TelegramService,
  ) {}

  async findAll(orgId: string, status?: string) {
    const params: unknown[] = [orgId];
    let where = 'WHERE organization_id = $1';
    if (status) {
      params.push(status);
      where += ` AND status = $${params.length}`;
    }
    return this.db.query(
      `SELECT * FROM v_agreements ${where} ORDER BY
         CASE priority WHEN 'CRITICAL' THEN 1 WHEN 'HIGH' THEN 2 WHEN 'MEDIUM' THEN 3 ELSE 4 END,
         due_date ASC NULLS LAST, created_at DESC`,
      params,
    );
  }

  async findOne(orgId: string, id: string) {
    const row = await this.db.queryOne(
      `SELECT * FROM v_agreements WHERE id = $1 AND organization_id = $2`,
      [id, orgId],
    );
    if (!row) throw new NotFoundException('Acuerdo no encontrado');
    return row;
  }

  async create(orgId: string, userId: string, dto: CreateAgreementDto) {
    try {
      const [row] = await this.db.query<{ p_id: string }>(
        `CALL sp_create_agreement($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,NULL)`,
        [
          orgId,
          dto.title,
          dto.description ?? null,
          dto.source ?? null,
          dto.agreement_date ?? null,
          dto.due_date ?? null,
          dto.priority ?? 'MEDIUM',
          dto.cycle_id ?? null,
          userId,
          dto.owner_id ?? null,
        ],
      );
      return this.findOne(orgId, row.p_id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('P0012') || msg.includes('3 caracteres')) throw new BadRequestException(msg);
      throw err;
    }
  }

  async update(orgId: string, id: string, dto: UpdateAgreementDto) {
    const before = await this.findOne(orgId, id);
    try {
      await this.db.query(
        `SELECT fn_update_agreement($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          id,
          dto.title ?? null,
          dto.description ?? null,
          dto.source ?? null,
          dto.agreement_date ?? null,
          dto.due_date ?? null,
          dto.priority ?? null,
          dto.status ?? null,
          dto.cycle_id ?? null,
          dto.owner_id ?? null,
          dto.completion_notes ?? null,
        ],
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('P0002')) throw new NotFoundException(msg);
      throw err;
    }
    const after = await this.findOne(orgId, id);

    if (dto.status && dto.status !== before.status && this.telegram.isConfigured) {
      const [orgRow] = await this.db.query<{ name: string }>(
        `SELECT name FROM organizations WHERE id = $1`, [orgId],
      );
      const e = TelegramService.esc;
      const daysLabel = (iso: string | null): string => {
        if (!iso) return 'sin fecha';
        const diff = Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
        if (diff < 0)   return `vencido hace ${Math.abs(diff)}d`;
        if (diff === 0) return 'vence HOY';
        return `vence en ${diff}d`;
      };
      const bSt = String(before.status ?? '');
      const aSt = String(after.status  ?? '');
      const fromIcon = STATUS_ICON[bSt] ?? '❓';
      const toIcon   = STATUS_ICON[aSt] ?? '❓';
      const lines = [
        `🔔 <b>Acuerdo actualizado</b> — ${e(orgRow?.name ?? orgId)}`,
        ``,
        `📋 <b>${e(String(after.code ?? ''))}</b>  ${e(String(after.title ?? ''))}`,
        ``,
        `${fromIcon} ${STATUS_ES[bSt] ?? bSt}  →  ${toIcon} <b>${STATUS_ES[aSt] ?? aSt}</b>`,
        `👤 ${after.owner_name ? e(String(after.owner_name)) : '<i>Sin responsable</i>'}`,
        `📅 ${daysLabel(after.due_date != null ? String(after.due_date) : null)}`,
      ];
      if (after.completion_notes) {
        lines.push(``, `💬 <i>${e(String(after.completion_notes))}</i>`);
      }
      const msg = lines.join('\n');
      this.telegram.send(msg).catch(() => { /* non-critical */ });
    }

    return after;
  }

  async delete(orgId: string, id: string) {
    await this.findOne(orgId, id);
    await this.db.query(
      `UPDATE agreements SET deleted_at = NOW() WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [id, orgId],
    );
    return { deleted: true, id };
  }

  async getLinkedItems(orgId: string, id: string) {
    await this.findOne(orgId, id);
    return this.db.query(
      `SELECT bi.*, abi.created_at AS linked_at
         FROM backlog_items bi
         JOIN agreement_backlog_items abi ON abi.backlog_item_id = bi.id
        WHERE abi.agreement_id = $1
        ORDER BY bi.created_at DESC`,
      [id],
    );
  }

  async linkBacklogItem(orgId: string, id: string, backlogItemId: string) {
    await this.findOne(orgId, id);
    await this.db.query(
      `INSERT INTO agreement_backlog_items (agreement_id, backlog_item_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, backlogItemId],
    );
    return { linked: true };
  }

  async unlinkBacklogItem(orgId: string, id: string, backlogItemId: string) {
    await this.findOne(orgId, id);
    await this.db.query(
      `DELETE FROM agreement_backlog_items WHERE agreement_id = $1 AND backlog_item_id = $2`,
      [id, backlogItemId],
    );
    return { unlinked: true };
  }

  async getLinks(orgId: string) {
    return this.db.query<{ agreement_id: string; backlog_item_id: string }>(
      `SELECT abi.agreement_id, abi.backlog_item_id
         FROM agreement_backlog_items abi
         JOIN agreements a ON a.id = abi.agreement_id
        WHERE a.organization_id = $1 AND a.deleted_at IS NULL`,
      [orgId],
    );
  }

  async getStats(orgId: string) {
    const [row] = await this.db.query<Record<string, number>>(
      `SELECT
         COUNT(*)                                                                        AS total,
         COUNT(*) FILTER (WHERE status IN ('OPEN','PENDING','IN_PROGRESS','TRACKING','EVIDENCE','ESCALATED')) AS active,
         COUNT(*) FILTER (WHERE status = 'PENDING')                                     AS pending,
         COUNT(*) FILTER (WHERE status = 'IN_PROGRESS')                                 AS in_progress,
         COUNT(*) FILTER (WHERE status = 'OPEN')                                        AS open,
         COUNT(*) FILTER (WHERE status = 'TRACKING')                                    AS tracking,
         COUNT(*) FILTER (WHERE status = 'EVIDENCE')                                    AS evidence,
         COUNT(*) FILTER (WHERE status = 'ESCALATED')                                   AS escalated,
         COUNT(*) FILTER (WHERE status IN ('FULFILLED','CLOSED'))                        AS fulfilled,
         COUNT(*) FILTER (WHERE status = 'CANCELLED')                                   AS cancelled,
         COUNT(*) FILTER (WHERE is_overdue = TRUE)                                      AS overdue
       FROM v_agreements WHERE organization_id = $1`,
      [orgId],
    );
    return row;
  }
}
