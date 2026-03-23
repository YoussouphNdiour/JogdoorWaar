import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { JobType, WorkMode, AlertFrequency } from '@prisma/client';

export class CreateAlertDto {
  @ApiProperty({ example: 'Dev React Dakar' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name: string;

  @ApiProperty({ example: ['react', 'frontend', 'javascript'] })
  @IsArray()
  @IsString({ each: true })
  keywords: string[];

  @ApiPropertyOptional({ example: ['stage', 'bénévolat'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  excludeKeywords?: string[];

  @ApiPropertyOptional({ example: ['Dakar', 'Thiès'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  locations?: string[];

  @ApiPropertyOptional({ enum: JobType, isArray: true })
  @IsArray()
  @IsEnum(JobType, { each: true })
  @IsOptional()
  jobTypes?: JobType[];

  @ApiPropertyOptional({ enum: WorkMode, isArray: true })
  @IsArray()
  @IsEnum(WorkMode, { each: true })
  @IsOptional()
  workModes?: WorkMode[];

  @ApiPropertyOptional({ example: ['tech', 'finance'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  sectors?: string[];

  @ApiPropertyOptional({ example: 300000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => Number(value))
  salaryMin?: number;

  @ApiPropertyOptional({ example: 800000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  @Transform(({ value }) => Number(value))
  salaryMax?: number;

  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  @IsOptional()
  notifyByEmail?: boolean;

  @ApiPropertyOptional({ default: false })
  @IsBoolean()
  @IsOptional()
  notifyByWhatsapp?: boolean;

  @ApiPropertyOptional({ enum: AlertFrequency, default: AlertFrequency.DAILY })
  @IsEnum(AlertFrequency)
  @IsOptional()
  frequency?: AlertFrequency;
}
