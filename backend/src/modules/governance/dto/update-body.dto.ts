import { PartialType } from '@nestjs/mapped-types';
import { CreateBodyDto } from './create-body.dto';
export class UpdateBodyDto extends PartialType(CreateBodyDto) {}
