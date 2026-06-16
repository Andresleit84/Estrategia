import {
  Controller, Get, Post, Patch, Delete,
  Body, Param, ParseUUIDPipe,
} from '@nestjs/common';
import { KeyResultsService } from './key-results.service';
import { CreateKeyResultDto } from './dto/create-key-result.dto';
import { UpdateKeyResultDto } from './dto/update-key-result.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../../modules/auth/types/auth.types';

@Controller()
export class KeyResultsController {
  constructor(private readonly svc: KeyResultsService) {}

  // GET /objectives/:objId/key-results/:id
  @Get('objectives/:objId/key-results/:id')
  findOne(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.findOne(user.organization_id, id);
  }

  // POST /objectives/:objId/key-results
  @Post('objectives/:objId/key-results')
  create(
    @CurrentUser() user: UserSession,
    @Param('objId', ParseUUIDPipe) objId: string,
    @Body() dto: CreateKeyResultDto,
  ) {
    return this.svc.create(user.organization_id, objId, user.user_id, dto);
  }

  // PATCH /key-results/:id
  @Patch('key-results/:id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKeyResultDto,
  ) {
    return this.svc.update(user.organization_id, id, dto);
  }

  // DELETE /key-results/:id
  @Delete('key-results/:id')
  cancel(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.svc.cancel(user.organization_id, id, user.user_id);
  }
}
