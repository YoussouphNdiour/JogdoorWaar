import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { ApplicationStatus } from '@prisma/client';

export class UpdateApplicationDto {
  @ApiPropertyOptional({ enum: ApplicationStatus })
  @IsEnum(ApplicationStatus)
  @IsOptional()
  status?: ApplicationStatus;

  @ApiPropertyOptional({ example: 'Relance à faire la semaine prochaine' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({ example: '2025-04-15T10:00:00.000Z' })
  @IsDateString()
  @IsOptional()
  interviewDate?: string;
}
