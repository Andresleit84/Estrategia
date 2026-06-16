import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddMemberDto } from './dto/add-member.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly db: DbService) {}

  async list(orgId: string) {
    return this.db.query(
      `SELECT * FROM v_team_tree WHERE organization_id = $1`,
      [orgId],
    );
  }

  async create(orgId: string, dto: CreateTeamDto, userId: string) {
    try {
      const result = await this.db.queryOne<{ sp_create_team: string }>(
        `SELECT sp_create_team($1, $2, $3, $4, $5)`,
        [orgId, dto.name, dto.description ?? null, dto.parentTeamId ?? null, userId],
      );
      const teamId = result!.sp_create_team;
      return this.findOne(teamId, orgId);
    } catch (err: any) {
      this.mapDbError(err);
    }
  }

  async findOne(teamId: string, orgId: string) {
    const team = await this.db.queryOne(
      `SELECT * FROM v_team_tree WHERE id = $1 AND organization_id = $2`,
      [teamId, orgId],
    );
    if (!team) throw new NotFoundException('Equipo no encontrado');
    return team;
  }

  async getMembers(teamId: string, orgId: string) {
    await this.findOne(teamId, orgId); // valida pertenencia
    return this.db.query(
      `SELECT tm.id, tm.role, tm.created_at AS joined_at,
              u.id AS user_id, u.name, u.email, u.avatar_url, u.role AS org_role
         FROM team_members tm
         JOIN users u ON u.id = tm.user_id
        WHERE tm.team_id = $1`,
      [teamId],
    );
  }

  async addMember(teamId: string, orgId: string, dto: AddMemberDto, addedById: string) {
    await this.findOne(teamId, orgId); // valida pertenencia
    try {
      await this.db.execute(
        `SELECT sp_add_team_member($1, $2, $3, $4)`,
        [teamId, dto.user_id, dto.role ?? 'MEMBER', addedById],
      );
    } catch (err: any) {
      this.mapDbError(err);
    }
    return { ok: true };
  }

  async removeMember(teamId: string, userId: string, orgId: string) {
    await this.findOne(teamId, orgId);
    try {
      await this.db.execute(`SELECT sp_remove_team_member($1, $2)`, [teamId, userId]);
    } catch (err: any) {
      if (err.message?.includes('MEMBER_NOT_FOUND')) throw new NotFoundException('Miembro no encontrado');
      throw err;
    }
    return { ok: true };
  }

  private mapDbError(err: any): never {
    const msg: string = err?.message ?? '';
    if (msg.includes('PARENT_TEAM_NOT_FOUND')) throw new NotFoundException('Equipo padre no encontrado');
    if (msg.includes('USER_NOT_IN_ORG')) throw new ConflictException('El usuario no pertenece a la organización');
    if (msg.includes('TEAM_CANNOT_BE_OWN_PARENT')) throw new ConflictException('Un equipo no puede ser su propio padre');
    if (msg.includes('TEAM_HIERARCHY_CYCLE_DETECTED')) throw new ConflictException('La jerarquía de equipos crearía un ciclo');
    if (msg.includes('unique constraint') || msg.includes('UNIQUE')) throw new ConflictException('El nombre del equipo ya existe en esta organización');
    throw err;
  }
}
