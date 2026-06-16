import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';
import { CyclesService } from './cycles.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';
import { RolloverCycleDto } from './dto/rollover-cycle.dto';

@Controller('cycles')
export class CyclesController {
  constructor(private readonly cycles: CyclesService) {}

  @Get()
  findAll(@CurrentUser() user: UserSession) {
    return this.cycles.findAll(user.organization_id);
  }

  @Get('active')
  findActive(@CurrentUser() user: UserSession) {
    return this.cycles.findActive(user.organization_id);
  }

  @Get(':id')
  findOne(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.cycles.findOne(user.organization_id, id);
  }

  @Post()
  create(@CurrentUser() user: UserSession, @Body() dto: CreateCycleDto) {
    return this.cycles.create(user.organization_id, user.user_id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCycleDto,
  ) {
    return this.cycles.update(user.organization_id, id, dto);
  }

  @Post(':id/activate')
  activate(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.cycles.activate(user.organization_id, id, user.user_id);
  }

  @Post(':id/close')
  close(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.cycles.close(user.organization_id, id, user.user_id);
  }

  @Get(':id/score')
  getScore(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.cycles.getScore(user.organization_id, id);
  }

  @Get(':id/incomplete')
  getIncomplete(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.cycles.getIncomplete(user.organization_id, id);
  }

  @Post(':id/rollover')
  rollover(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RolloverCycleDto,
  ) {
    return this.cycles.rollover(user.organization_id, id, user.user_id, dto);
  }
}
