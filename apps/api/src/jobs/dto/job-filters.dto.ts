import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JobType, WorkMode, SourcePlatform } from '@prisma/client';

export class JobFiltersDto {
  @ApiPropertyOptional({ description: 'Full-text search query' })
  @IsString()
  @IsOptional()
  q?: string;

  @ApiPropertyOptional({ description: 'City or region filter' })
  @IsString()
  @IsOptional()
  location?: string;

  @ApiPropertyOptional({
    enum: JobType,
    isArray: true,
    description: 'Filter by contract type(s)',
  })
  @IsArray()
  @IsEnum(JobType, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : [value],
  )
  jobType?: JobType[];

  @ApiPropertyOptional({
    enum: WorkMode,
    isArray: true,
    description: 'Filter by work mode(s)',
  })
  @IsArray()
  @IsEnum(WorkMode, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : [value],
  )
  workMode?: WorkMode[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Filter by sector(s)',
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : [value],
  )
  sector?: string[];

  @ApiPropertyOptional({ description: 'Minimum salary (FCFA)' })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  salaryMin?: number;

  @ApiPropertyOptional({ description: 'Maximum salary (FCFA)' })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  salaryMax?: number;

  @ApiPropertyOptional({ description: 'Required years of experience' })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  yearsExp?: number;

  @ApiPropertyOptional({
    enum: ['last24h', 'lastWeek', 'lastMonth'],
    description: 'Filter by publication date range',
  })
  @IsEnum(['last24h', 'lastWeek', 'lastMonth'])
  @IsOptional()
  publishedAfter?: 'last24h' | 'lastWeek' | 'lastMonth';

  @ApiPropertyOptional({
    enum: SourcePlatform,
    isArray: true,
    description: 'Filter by source platform(s)',
  })
  @IsArray()
  @IsEnum(SourcePlatform, { each: true })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value : [value],
  )
  source?: SourcePlatform[];

  @ApiPropertyOptional({
    enum: ['relevance', 'date', 'salary', 'matchScore'],
    description: 'Sort order',
  })
  @IsEnum(['relevance', 'date', 'salary', 'matchScore'])
  @IsOptional()
  sortBy?: 'relevance' | 'date' | 'salary' | 'matchScore';

  @ApiPropertyOptional({ description: 'Page number (1-based)', default: 1 })
  @IsNumber()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => Number(value))
  page?: number;

  @ApiPropertyOptional({
    description: 'Results per page (1–50)',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsNumber()
  @Min(1)
  @Max(50)
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }: { value: unknown }) => Number(value))
  limit?: number;
}
