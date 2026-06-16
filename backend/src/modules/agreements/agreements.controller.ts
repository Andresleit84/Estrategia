import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { AgreementsService } from './agreements.service';
import { CreateAgreementDto } from './dto/create-agreement.dto';
import { UpdateAgreementDto } from './dto/update-agreement.dto';
import { LinkBacklogDto } from './dto/link-backlog.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller('agreements')
export class AgreementsController {
  constructor(private readonly svc: AgreementsService) {}

  @Get()
  findAll(@CurrentUser() user: UserSession, @Query('status') status?: string) {
    return this.svc.findAll(user.organization_id, status);
  }

  @Get('stats')
  getStats(@CurrentUser() user: UserSession) {
    return this.svc.getStats(user.organization_id);
  }

  @Get('links')
  getLinks(@CurrentUser() user: UserSession) {
    return this.svc.getLinks(user.organization_id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(user.organization_id, id);
  }

  @Post()
  create(@CurrentUser() user: UserSession, @Body() dto: CreateAgreementDto) {
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgreementDto,
  ) {
    return this.svc.update(user.organization_id, id, dto);
  }

  @Delete(':id')
  delete(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.delete(user.organization_id, id);
  }

  @Get(':id/items')
  getLinkedItems(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getLinkedItems(user.organization_id, id);
  }

  @Post(':id/items')
  linkItem(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: LinkBacklogDto,
  ) {
    return this.svc.linkBacklogItem(user.organization_id, id, dto.backlog_item_id);
  }

  @Delete(':id/items/:itemId')
  unlinkItem(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.svc.unlinkBacklogItem(user.organization_id, id, itemId);
  }
}
