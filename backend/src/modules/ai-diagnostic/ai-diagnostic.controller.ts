import {
  Controller, Get, Post, Delete, Param, Body, Res, HttpCode,
  UseGuards, ParseUUIDPipe, BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import * as fs from 'fs';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';
import { AiDiagnosticService } from './ai-diagnostic.service';
import { CreateDiagnosticDto } from './dto/create-diagnostic.dto';

@Controller('ai/diagnostic')
@UseGuards(JwtAuthGuard)
export class AiDiagnosticController {
  constructor(private readonly svc: AiDiagnosticService) {}

  @Get()
  list(@CurrentUser() user: UserSession) {
    return this.svc.findAll(user.organization_id);
  }

  @Get(':id')
  get(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(user.organization_id, id);
  }

  @Post()
  @HttpCode(202)
  create(@CurrentUser() user: UserSession, @Body() dto: CreateDiagnosticDto) {
    return this.svc.generate(user.organization_id, user.user_id, dto);
  }

  @Get(':id/pdf')
  async downloadPdf(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    const report = await this.svc.findOne(user.organization_id, id);
    let pdfPath = report.pdf_path;
    if (!pdfPath || !fs.existsSync(pdfPath)) {
      pdfPath = await this.svc.regeneratePdf(user.organization_id, id);
    }
    const filename = `diagnostico-${report.org_name.replace(/\s+/g, '-').toLowerCase()}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(pdfPath).pipe(res);
  }

  @Post(':id/regenerate')
  @HttpCode(202)
  regenerate(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.regenerate(user.organization_id, user.user_id, id);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: UserSession, @Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(user.organization_id, id);
  }

  @Post(':id/import')
  @HttpCode(200)
  importItems(
    @CurrentUser() user: UserSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { item_ids: string[] },
  ) {
    if (!Array.isArray(body?.item_ids) || !body.item_ids.length) {
      throw new BadRequestException('Debes seleccionar al menos un ítem');
    }
    return this.svc.importItems(user.organization_id, user.user_id, id, body.item_ids);
  }
}
