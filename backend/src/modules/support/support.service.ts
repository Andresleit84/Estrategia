import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { DbService } from '../../database/db.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddMessageDto } from './dto/add-message.dto';

@Injectable()
export class SupportService {
  constructor(private readonly db: DbService) {}

  async findAll(orgId: string, userId: string, role: string) {
    const isStaff = role === 'OWNER' || role === 'ADMIN';
    if (isStaff) {
      return this.db.query(
        `SELECT * FROM v_support_tickets
          WHERE organization_id = $1
          ORDER BY
            CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
            updated_at DESC`,
        [orgId],
      );
    }
    return this.db.query(
      `SELECT * FROM v_support_tickets
        WHERE organization_id = $1 AND user_id = $2
        ORDER BY updated_at DESC`,
      [orgId, userId],
    );
  }

  async findOne(orgId: string, ticketId: string, userId: string, role: string) {
    const isStaff = role === 'OWNER' || role === 'ADMIN';
    const row = await this.db.queryOne<any>(
      `SELECT * FROM v_support_ticket_detail
        WHERE id = $1 AND organization_id = $2`,
      [ticketId, orgId],
    );
    if (!row) throw new NotFoundException('Ticket no encontrado');
    if (!isStaff && row.user_id !== userId) throw new ForbiddenException();
    return row;
  }

  async create(orgId: string, userId: string, dto: CreateTicketDto) {
    try {
      const [row] = await this.db.query<{ p_ticket_id: string }>(
        `CALL sp_create_support_ticket($1, $2, $3, $4, $5, NULL)`,
        [orgId, userId, dto.title, dto.category ?? 'general', dto.body],
      );
      return this.db.queryOne(
        `SELECT * FROM v_support_ticket_detail WHERE id = $1`,
        [row.p_ticket_id],
      );
    } catch (err: any) {
      const msg: string = err?.message ?? '';
      if (msg.includes('P0011')) throw new BadRequestException(msg);
      throw err;
    }
  }

  async addMessage(orgId: string, ticketId: string, senderId: string, role: string, dto: AddMessageDto) {
    const ticket = await this.findOne(orgId, ticketId, senderId, role);
    if (ticket.status === 'closed') throw new BadRequestException('El ticket está cerrado');

    const isStaff = role === 'OWNER' || role === 'ADMIN';
    await this.db.query(
      `CALL sp_add_support_message($1, $2, $3, $4)`,
      [ticketId, senderId, dto.body, isStaff],
    );
    return this.findOne(orgId, ticketId, senderId, role);
  }

  async updateStatus(orgId: string, ticketId: string, userId: string, role: string, status: string) {
    const isStaff = role === 'OWNER' || role === 'ADMIN';
    if (!isStaff) throw new ForbiddenException('Solo administradores pueden cambiar el estado');

    const valid = ['open', 'in_progress', 'resolved', 'closed'];
    if (!valid.includes(status)) throw new BadRequestException('Estado inválido');

    await this.db.query(
      `UPDATE support_tickets SET status = $1, updated_at = NOW()
        WHERE id = $2 AND organization_id = $3`,
      [status, ticketId, orgId],
    );
    return this.findOne(orgId, ticketId, userId, role);
  }
}
