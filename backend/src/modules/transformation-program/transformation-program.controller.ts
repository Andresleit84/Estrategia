import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, HttpCode, ParseUUIDPipe, ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiCookieAuth } from '@nestjs/swagger';
import { TransformationProgramService } from './transformation-program.service';
import { CreateProgramDto } from './dto/create-program.dto';
import { AddCycleDto } from './dto/add-cycle.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';

const WRITE_ROLES = ['OWNER', 'ADMIN'];

@ApiTags('transformation-programs')
@ApiCookieAuth('access_token')
@Controller('transformation-programs')
export class TransformationProgramController {
  constructor(private readonly svc: TransformationProgramService) {}

  @Get()
  findAll(@CurrentUser() user: UserSession) {
    return this.svc.findAll(user.organization_id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOne(user.organization_id, id);
  }

  @Post()
  @HttpCode(201)
  create(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateProgramDto,
  ) {
    if (!WRITE_ROLES.includes(user.role)) throw new ForbiddenException();
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: Partial<{ title: string; description: string; status: string; vision_statement: string }>,
  ) {
    if (!WRITE_ROLES.includes(user.role)) throw new ForbiddenException();
    return this.svc.update(user.organization_id, id, body);
  }

  @Post(':id/cycles')
  addCycle(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddCycleDto,
  ) {
    if (!WRITE_ROLES.includes(user.role)) throw new ForbiddenException();
    return this.svc.addCycle(user.organization_id, id, dto);
  }

  @Delete(':id/cycles/:cycleId')
  removeCycle(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('cycleId', ParseUUIDPipe) cycleId: string,
  ) {
    if (!WRITE_ROLES.includes(user.role)) throw new ForbiddenException();
    return this.svc.removeCycle(user.organization_id, id, cycleId);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (!WRITE_ROLES.includes(user.role)) throw new ForbiddenException();
    return this.svc.remove(user.organization_id, id);
  }
}
