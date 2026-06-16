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
import { StrategicIntentsService } from './strategic-intents.service';
import { CreateStrategicIntentDto } from './dto/create-strategic-intent.dto';
import { UpdateStrategicIntentDto } from './dto/update-strategic-intent.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller('strategic-intents')
export class StrategicIntentsController {
  constructor(private readonly svc: StrategicIntentsService) {}

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
    @Body() dto: CreateStrategicIntentDto,
  ) {
    return this.svc.create(user.organization_id, user.user_id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStrategicIntentDto,
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

  @Get(':id/problems')
  getLinkedProblems(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getLinkedProblems(user.organization_id, id);
  }

  @Get(':id/objectives')
  getAlignedObjectives(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.getAlignedObjectives(user.organization_id, id);
  }
}
