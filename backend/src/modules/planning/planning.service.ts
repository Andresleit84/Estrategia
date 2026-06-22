import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class PlanningService {
  constructor(private readonly db: DatabaseService) {}

  // ─── Sessions ───────────────────────────────────────────

  async listSessions(orgId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM v_planning_sessions WHERE organization_id = $1 ORDER BY created_at DESC`,
      [orgId],
    );
    return rows;
  }

  async createSession(orgId: string, body: {
    cycle_id?: string; name: string; type: string; description?: string;
  }) {
    const { rows } = await this.db.query(
      `SELECT sp_create_planning_session($1,$2,$3,$4,$5) AS id`,
      [orgId, body.cycle_id ?? null, body.name, body.type ?? 'QUARTERLY', body.description ?? null],
    );
    return rows[0];
  }

  async updateSession(orgId: string, id: string, body: {
    name?: string; status?: string; current_stage?: number; description?: string;
  }) {
    await this.db.query(
      `CALL sp_update_planning_session($1,$2,$3,$4,$5,$6)`,
      [orgId, id, body.name ?? null, body.status ?? null,
       body.current_stage ?? null, body.description ?? null],
    );
    return { ok: true };
  }

  async deleteSession(orgId: string, id: string) {
    await this.db.query(`CALL sp_delete_planning_session($1,$2)`, [orgId, id]);
    return { ok: true };
  }

  // ─── Items ───────────────────────────────────────────────

  async listItems(orgId: string, sessionId: string, stage?: number) {
    const { rows } = await this.db.query(
      `SELECT * FROM planning_items
       WHERE organization_id = $1 AND session_id = $2
         AND ($3::int IS NULL OR stage = $3)
       ORDER BY stage, sort_order, created_at`,
      [orgId, sessionId, stage ?? null],
    );
    return rows;
  }

  async upsertItem(orgId: string, body: {
    id?: string; session_id: string; stage: number; title: string;
    description?: string; assignee?: string; due_date?: string;
    status?: string; item_type?: string; sort_order?: number;
  }) {
    const { rows } = await this.db.query(
      `SELECT sp_upsert_planning_item($1,$2,$3,$4,$5,$6,$7,$8::date,$9,$10,$11) AS id`,
      [body.id ?? null, body.session_id, orgId, body.stage, body.title,
       body.description ?? null, body.assignee ?? null, body.due_date ?? null,
       body.status ?? null, body.item_type ?? null, body.sort_order ?? null],
    );
    return rows[0];
  }

  async moveItem(orgId: string, id: string, status: string) {
    await this.db.query(`CALL sp_move_planning_item($1,$2,$3)`, [orgId, id, status]);
    return { ok: true };
  }

  async deleteItem(orgId: string, id: string) {
    await this.db.query(`CALL sp_delete_planning_item($1,$2)`, [orgId, id]);
    return { ok: true };
  }

  // ─── Dependencies ────────────────────────────────────────

  async listDependencies(orgId: string, sessionId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM planning_dependencies
       WHERE organization_id = $1 AND session_id = $2
       ORDER BY sort_order, created_at`,
      [orgId, sessionId],
    );
    return rows;
  }

  async upsertDependency(orgId: string, body: {
    id?: string; session_id: string; from_area: string; to_area: string;
    description?: string; status?: string; owner?: string;
  }) {
    const { rows } = await this.db.query(
      `SELECT sp_upsert_planning_dependency($1,$2,$3,$4,$5,$6,$7,$8) AS id`,
      [body.id ?? null, body.session_id, orgId, body.from_area, body.to_area,
       body.description ?? null, body.status ?? null, body.owner ?? null],
    );
    return rows[0];
  }

  async deleteDependency(orgId: string, id: string) {
    await this.db.query(`CALL sp_delete_planning_dependency($1,$2)`, [orgId, id]);
    return { ok: true };
  }

  // ─── Capacity ─────────────────────────────────────────────

  async listCapacity(orgId: string, sessionId: string) {
    const { rows } = await this.db.query(
      `SELECT * FROM planning_capacity
       WHERE organization_id = $1 AND session_id = $2
       ORDER BY sort_order, created_at`,
      [orgId, sessionId],
    );
    return rows;
  }

  async upsertCapacity(orgId: string, body: {
    id?: string; session_id: string; area: string; objective_title?: string;
    total_people?: number; allocated?: number; notes?: string;
  }) {
    const { rows } = await this.db.query(
      `SELECT sp_upsert_planning_capacity($1,$2,$3,$4,$5,$6,$7,$8) AS id`,
      [body.id ?? null, body.session_id, orgId, body.area, body.objective_title ?? null,
       body.total_people ?? null, body.allocated ?? null, body.notes ?? null],
    );
    return rows[0];
  }

  async deleteCapacity(orgId: string, id: string) {
    await this.db.query(`CALL sp_delete_planning_capacity($1,$2)`, [orgId, id]);
    return { ok: true };
  }
}
