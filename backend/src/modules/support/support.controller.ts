import { Controller, Get, Post, Patch, Body, Param, ParseUUIDPipe } from '@nestjs/common';
import { SupportService } from './support.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller('support')
export class SupportController {
  constructor(private readonly svc: SupportService) {}

  @Get()
  findAll(@CurrentUser() user: UserSession) {
    return this.svc.findAll(user.organization_id, user.user_id, user.role);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOne(user.organization_id, id, user.user_id, user.role);
  }

  @Post()
  create(@CurrentUser() user: UserSession, @Body() dto: CreateTicketDto) {
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  @Post(':id/messages')
  addMessage(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddMessageDto,
  ) {
    return this.svc.addMessage(user.organization_id, id, user.user_id, user.role, dto);
  }

  @Patch(':id/status')
  updateStatus(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: string,
  ) {
    return this.svc.updateStatus(user.organization_id, id, user.user_id, user.role, status);
  }
}
