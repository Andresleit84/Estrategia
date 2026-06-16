import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

const TIMEZONES = [
  'America/Bogota', 'America/Lima', 'America/Santiago', 'America/Buenos_Aires',
  'America/Mexico_City', 'America/Caracas', 'America/La_Paz', 'America/Asuncion',
  'America/Guayaquil', 'America/Montevideo', 'America/Panama', 'America/Costa_Rica',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/Madrid', 'Europe/London', 'Europe/Paris', 'UTC',
];

export class UpdateProfileDto {
  @IsOptional() @IsString() @IsIn(TIMEZONES)
  timezone?: string;

  @IsOptional() @IsString() @MaxLength(10)
  locale?: string;

  @IsOptional() @IsBoolean()
  notify_at_risk?: boolean;

  @IsOptional() @IsBoolean()
  notify_checkin_reminder?: boolean;

  @IsOptional() @IsBoolean()
  notify_weekly_briefing?: boolean;
}
