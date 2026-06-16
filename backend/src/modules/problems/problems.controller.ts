import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ProblemsService } from './problems.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { UpdateProblemDto } from './dto/update-problem.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller('problems')
export class ProblemsController {
  constructor(private readonly svc: ProblemsService) {}

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
  create(
    @CurrentUser() user: UserSession,
    @Body() dto: CreateProblemDto,
  ) {
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProblemDto,
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

  @Get(':id/intents')
  findIntents(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findIntents(user.organization_id, id);
  }

  @Post(':id/intents/:intentId')
  linkToIntent(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('intentId', ParseUUIDPipe) intentId: string,
  ) {
    return this.svc.linkToIntent(user.organization_id, id, intentId);
  }

  @Delete(':id/intents/:intentId')
  unlinkFromIntent(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('intentId', ParseUUIDPipe) intentId: string,
  ) {
    return this.svc.unlinkFromIntent(user.organization_id, id, intentId);
  }
}
