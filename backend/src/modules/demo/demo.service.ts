import { Injectable, ForbiddenException, Logger } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { spawn } from 'child_process';
import * as path from 'path';

export interface SeedResult {
  success: boolean;
  output: string;
  lines: number;
}

export interface CleanResult {
  success: boolean;
  message: string;
}

@Injectable()
export class DemoService {
  private readonly logger = new Logger(DemoService.name);

  constructor(private readonly db: DbService) {}

  async seedOrg(organizationId: string, userId: string): Promise<SeedResult> {
    const rows = await this.db.query<{ role: string }>(
      `SELECT role FROM users WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL`,
      [userId, organizationId],
    );
    if (!rows.length || rows[0].role !== 'OWNER') {
      throw new ForbiddenException('Solo el propietario puede cargar datos demo en esta organización');
    }

    return new Promise((resolve) => {
      const scriptPath = path.join(process.cwd(), 'scripts', 'seed-demo.js');
      const child = spawn('node', [scriptPath], {
        env: { ...process.env, DEMO_ORG_ID: organizationId, DEMO_OWNER_ID: userId },
        timeout: 180_000,
      });

      const lines: string[] = [];

      child.stdout.on('data', (d: Buffer) => {
        const text = d.toString().trim();
        if (text) { lines.push(text); this.logger.log(`[demo] ${text}`); }
      });
      child.stderr.on('data', (d: Buffer) => {
        const text = d.toString().trim();
        if (text) { lines.push(`ERR: ${text}`); this.logger.error(`[demo] ${text}`); }
      });
      child.on('close', (code: number | null) => {
        resolve({ success: code === 0, output: lines.join('\n'), lines: lines.length });
      });
      child.on('error', (err: Error) => {
        resolve({ success: false, output: err.message, lines: 0 });
      });
    });
  }

  async cleanOrg(organizationId: string, userId: string): Promise<CleanResult> {
    const rows = await this.db.query<{ role: string }>(
      `SELECT role FROM users WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL`,
      [userId, organizationId],
    );
    if (!rows.length || rows[0].role !== 'OWNER') {
      throw new ForbiddenException('Solo el propietario puede limpiar datos de esta organización');
    }

    const orgQueries = [
      `SELECT fn_demo_clean_ai_briefings($1)`,
      `DELETE FROM check_ins WHERE kr_id IN (SELECT kr.id FROM key_results kr JOIN objectives o ON kr.objective_id = o.id WHERE o.organization_id = $1)`,
      `DELETE FROM notifications WHERE organization_id = $1`,
      `DELETE FROM sprint_goal_krs WHERE sprint_id IN (SELECT id FROM sprint_cycles WHERE organization_id = $1)`,
      // Agreements: eliminar M2M primero, luego acuerdos (agreements.created_by → users es NO ACTION)
      `DELETE FROM agreement_backlog_items WHERE agreement_id IN (SELECT id FROM agreements WHERE organization_id = $1)`,
      `DELETE FROM agreements WHERE organization_id = $1`,
      `DELETE FROM backlog_items WHERE organization_id = $1`,
      `DELETE FROM sprint_cycles WHERE organization_id = $1`,
      `DELETE FROM milestones WHERE initiative_id IN (SELECT id FROM initiatives WHERE organization_id = $1)`,
      `DELETE FROM initiative_key_results WHERE initiative_id IN (SELECT id FROM initiatives WHERE organization_id = $1)`,
      `DELETE FROM initiative_areas WHERE initiative_id IN (SELECT id FROM initiatives WHERE organization_id = $1)`,
      `DELETE FROM key_results WHERE objective_id IN (SELECT id FROM objectives WHERE organization_id = $1)`,
      `DELETE FROM objective_alignments WHERE source_id IN (SELECT id FROM objectives WHERE organization_id = $1)`,
      `DELETE FROM objectives WHERE organization_id = $1`,
      `DELETE FROM initiatives WHERE organization_id = $1`,
      `DELETE FROM strategic_intents WHERE organization_id = $1`,
      `DELETE FROM organizational_problems WHERE organization_id = $1`,
      // Eliminar dependencias de cycles antes de borrar cycles (FK NO ACTION)
      `DELETE FROM program_cycles WHERE cycle_id IN (SELECT id FROM cycles WHERE organization_id = $1)`,
      `DELETE FROM delivery_programs WHERE organization_id = $1`,
      `DELETE FROM cycle_close_reports WHERE cycle_id IN (SELECT id FROM cycles WHERE organization_id = $1)`,
      `DELETE FROM cycles WHERE organization_id = $1`,
      `DELETE FROM team_members WHERE team_id IN (SELECT id FROM teams WHERE organization_id = $1)`,
      `DELETE FROM teams WHERE organization_id = $1`,
      `DELETE FROM areas WHERE org_id = $1`,
    ];

    for (const sql of orgQueries) {
      await this.db.query(sql, [organizationId]);
    }
    await this.db.query(
      `DELETE FROM mcp_audit_log WHERE user_id IN (SELECT id FROM users WHERE organization_id=$1 AND id!=$2)`,
      [organizationId, userId],
    );
    await this.db.query(
      `UPDATE users SET deleted_at=NOW() WHERE organization_id=$1 AND id!=$2 AND deleted_at IS NULL`,
      [organizationId, userId],
    );
    await this.db.query(
      `DELETE FROM users WHERE organization_id=$1 AND id!=$2`,
      [organizationId, userId],
    );

    this.logger.log(`[demo] cleanOrg completed for org=${organizationId}`);
    return { success: true, message: 'Organización limpiada correctamente' };
  }

  async resetDemoObjectives(organizationId: string, cycleId: string, userId: string): Promise<{ deleted: number }> {
    const rows = await this.db.query<{ role: string }>(
      `SELECT role FROM users WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL`,
      [userId, organizationId],
    );
    if (!rows.length || rows[0].role !== 'OWNER') {
      throw new ForbiddenException('Solo el propietario puede resetear objetivos de demo');
    }

    // Limpiar problemas e intenciones de demo anteriores (hard delete — son datos de prueba)
    await this.db.execute(
      `DELETE FROM problem_intents WHERE problem_id IN (SELECT id FROM problems WHERE organization_id = $1)`,
      [organizationId],
    ).catch(() => {});
    await this.db.execute(
      `DELETE FROM strategic_intents WHERE organization_id = $1`,
      [organizationId],
    ).catch(() => {});
    await this.db.execute(
      `DELETE FROM problems WHERE organization_id = $1`,
      [organizationId],
    ).catch(() => {});
    // Limpiar backlog items e iniciativas del ciclo (demo completo incluye backlog)
    await this.db.execute(
      `DELETE FROM backlog_items WHERE organization_id = $1`,
      [organizationId],
    ).catch(() => {});
    await this.db.execute(
      `DELETE FROM agreement_backlog_items WHERE agreement_id IN (SELECT id FROM agreements WHERE organization_id = $1)`,
      [organizationId],
    ).catch(() => {});
    await this.db.execute(
      `DELETE FROM milestones WHERE initiative_id IN (SELECT id FROM initiatives WHERE organization_id = $1)`,
      [organizationId],
    ).catch(() => {});
    await this.db.execute(
      `DELETE FROM initiative_key_results WHERE initiative_id IN (SELECT id FROM initiatives WHERE organization_id = $1)`,
      [organizationId],
    ).catch(() => {});
    await this.db.execute(
      `DELETE FROM initiative_areas WHERE initiative_id IN (SELECT id FROM initiatives WHERE organization_id = $1)`,
      [organizationId],
    ).catch(() => {});
    await this.db.execute(
      `DELETE FROM initiatives WHERE organization_id = $1`,
      [organizationId],
    ).catch(() => {});

    // Soft-delete objectives del ciclo (triggers y cascadas manejan KRs y check-ins)
    const result = await this.db.query<{ count: string }>(
      `WITH deleted AS (
        UPDATE objectives
        SET deleted_at = NOW()
        WHERE organization_id = $1 AND cycle_id = $2 AND deleted_at IS NULL
        RETURNING id
      ) SELECT COUNT(*)::text AS count FROM deleted`,
      [organizationId, cycleId],
    );

    const deleted = parseInt(result[0]?.count ?? '0', 10);
    this.logger.log(`[demo] resetDemoObjectives: ${deleted} objetivos + problemas + intenciones eliminados para org=${organizationId}`);
    return { deleted };
  }
}
