import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, Request,
} from '@nestjs/common';
import { PlanningService } from './planning.service';

@Controller('planning')
export class PlanningController {
  constructor(private readonly service: PlanningService) {}

  // ─── Sessions ────────────────────────────────────────────

  @Get('sessions')
  listSessions(@Request() req: any) {
    return this.service.listSessions(req.user.organizationId);
  }

  @Post('sessions')
  createSession(@Request() req: any, @Body() body: any) {
    return this.service.createSession(req.user.organizationId, body);
  }

  @Patch('sessions/:id')
  updateSession(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.updateSession(req.user.organizationId, id, body);
  }

  @Delete('sessions/:id')
  deleteSession(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteSession(req.user.organizationId, id);
  }

  // ─── Items ───────────────────────────────────────────────

  @Get('sessions/:id/items')
  listItems(
    @Request() req: any,
    @Param('id') sessionId: string,
    @Query('stage') stage?: string,
  ) {
    return this.service.listItems(
      req.user.organizationId,
      sessionId,
      stage ? Number(stage) : undefined,
    );
  }

  @Post('items')
  upsertItem(@Request() req: any, @Body() body: any) {
    return this.service.upsertItem(req.user.organizationId, body);
  }

  @Patch('items/:id')
  updateItem(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.upsertItem(req.user.organizationId, { ...body, id });
  }

  @Patch('items/:id/move')
  moveItem(@Request() req: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.service.moveItem(req.user.organizationId, id, body.status);
  }

  @Delete('items/:id')
  deleteItem(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteItem(req.user.organizationId, id);
  }

  // ─── Dependencies ────────────────────────────────────────

  @Get('sessions/:id/dependencies')
  listDependencies(@Request() req: any, @Param('id') sessionId: string) {
    return this.service.listDependencies(req.user.organizationId, sessionId);
  }

  @Post('dependencies')
  upsertDependency(@Request() req: any, @Body() body: any) {
    return this.service.upsertDependency(req.user.organizationId, body);
  }

  @Patch('dependencies/:id')
  updateDependency(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.upsertDependency(req.user.organizationId, { ...body, id });
  }

  @Delete('dependencies/:id')
  deleteDependency(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteDependency(req.user.organizationId, id);
  }

  // ─── Capacity ─────────────────────────────────────────────

  @Get('sessions/:id/capacity')
  listCapacity(@Request() req: any, @Param('id') sessionId: string) {
    return this.service.listCapacity(req.user.organizationId, sessionId);
  }

  @Post('capacity')
  upsertCapacity(@Request() req: any, @Body() body: any) {
    return this.service.upsertCapacity(req.user.organizationId, body);
  }

  @Patch('capacity/:id')
  updateCapacity(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.service.upsertCapacity(req.user.organizationId, { ...body, id });
  }

  @Delete('capacity/:id')
  deleteCapacity(@Request() req: any, @Param('id') id: string) {
    return this.service.deleteCapacity(req.user.organizationId, id);
  }
}
