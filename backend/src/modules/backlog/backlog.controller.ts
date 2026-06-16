import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, Query, ParseUUIDPipe,
} from '@nestjs/common';
import { BacklogService } from './backlog.service';
import { CreateBacklogItemDto } from './dto/create-backlog-item.dto';
import { UpdateBacklogItemDto } from './dto/update-backlog-item.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller('backlog')
export class BacklogController {
  constructor(private readonly svc: BacklogService) {}

  @Get()
  list(
    @CurrentUser() user: UserSession,
    @Query('type')          type?:          string,
    @Query('status')        status?:        string,
    @Query('priority')      priority?:      string,
    @Query('initiative_id') initiative_id?: string,
    @Query('cycle_id')      cycle_id?:      string,
    @Query('sprint_id')     sprint_id?:     string,
    @Query('parent_id')     parent_id?:     string,
  ) {
    return this.svc.list(user.organization_id, {
      type, status, priority, initiative_id, cycle_id,
      sprint_id: sprint_id === 'null' ? null : sprint_id,
      parent_id: parent_id === 'null' ? null : parent_id,
    });
  }

  @Get('tree')
  tree(
    @CurrentUser() user: UserSession,
    @Query('initiative_id') initiative_id?: string,
    @Query('cycle_id')      cycle_id?:      string,
  ) {
    return this.svc.getTree(user.organization_id, { initiative_id, cycle_id });
  }

  @Get('my-items')
  myItems(@CurrentUser() user: UserSession) {
    return this.svc.myItems(user.user_id, user.organization_id);
  }

  @Get('my-impact')
  myImpact(
    @CurrentUser() user: UserSession,
    @Query('item_id') item_id?: string,
  ) {
    return this.svc.myImpact(user.user_id, user.organization_id, item_id);
  }

  @Get('stats')
  stats(
    @CurrentUser() user: UserSession,
    @Query('initiative_id') initiative_id?: string,
    @Query('cycle_id')      cycle_id?:      string,
  ) {
    return this.svc.stats(user.organization_id, { initiative_id, cycle_id });
  }

  @Get(':id')
  getOne(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getOne(user.organization_id, id);
  }

  @Post()
  create(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateBacklogItemDto,
  ) {
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBacklogItemDto,
  ) {
    return this.svc.update(user.organization_id, id, dto);
  }

  @Delete(':id')
  delete(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.delete(user.organization_id, id);
  }
}
