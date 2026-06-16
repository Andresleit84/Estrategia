import { Controller, Post, Body, HttpCode } from '@nestjs/common';
import { IsArray, IsBoolean, IsObject, IsOptional, IsUUID, IsString, MaxLength, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { UserSession } from '../auth/types/auth.types';
import { ImportService, ImportData } from './import.service';

class ImportSourceDto {
  @IsString() @MaxLength(200) label!: string;
  @IsString() @MaxLength(80000) content!: string;
}

class AnalyzeImportDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(5)
  @ValidateNested({ each: true })
  @Type(() => ImportSourceDto)
  sources!: ImportSourceDto[];
}

class LoadImportDto {
  @IsUUID() organizationId!: string;
  @IsObject() data!: ImportData;
  @IsOptional() @IsBoolean() clearFirst?: boolean;
}

@Controller('import')
export class ImportController {
  constructor(private readonly svc: ImportService) {}

  @Post('analyze')
  @HttpCode(200)
  analyze(@Body() dto: AnalyzeImportDto) {
    return this.svc.analyzeContent(dto.sources);
  }

  @Post('load')
  @HttpCode(200)
  load(@Body() dto: LoadImportDto, @CurrentUser() user: UserSession) {
    return this.svc.loadImport(dto.organizationId, user.email, dto.data, dto.clearFirst ?? false);
  }
}
