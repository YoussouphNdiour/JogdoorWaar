import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
} from 'class-validator';
import { JobType, WorkMode, SourcePlatform } from '@prisma/client';

/**
 * DTO for manual job creation by recruiters or admin ingestion.
 * Fields mirror the Prisma Job model (excluding auto-generated fields).
 */
export class CreateJobDto {
  @ApiProperty({ description: 'Job title', example: 'Développeur Backend NestJS' })
  @IsString()
  @MaxLength(255)
  title!: string;

  @ApiProperty({ description: 'Company name', example: 'InnovateSN' })
  @IsString()
  @MaxLength(255)
  company!: string;

  @ApiPropertyOptional({ description: 'Public URL of company logo' })
  @IsUrl()
  @IsOptional()
  companyLogoUrl?: string;

  @ApiProperty({ description: 'Full job description (HTML or Markdown allowed)' })
  @IsString()
  description!: string;

  @ApiPropertyOptional({
    description: 'Short AI-generated summary (max 150 words)',
    maxLength: 1000,
  })
  @IsString()
  @MaxLength(1000)
  @IsOptional()
  descriptionShort?: string;

  @ApiPropertyOptional({ description: 'City', example: 'Dakar' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ description: 'Country', default: 'Sénégal' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ description: 'Whether the role is fully remote' })
  @IsBoolean()
  @IsOptional()
  isRemote?: boolean;

  @ApiPropertyOptional({ enum: WorkMode, description: 'Work mode', default: WorkMode.ON_SITE })
  @IsEnum(WorkMode)
  @IsOptional()
  workMode?: WorkMode;

  @ApiPropertyOptional({ enum: JobType, description: 'Contract type', default: JobType.CDI })
  @IsEnum(JobType)
  @IsOptional()
  jobType?: JobType;

  @ApiPropertyOptional({ description: 'Business sector', example: 'Finance' })
  @IsString()
  @IsOptional()
  sector?: string;

  @ApiPropertyOptional({ description: 'Job category', example: 'Engineering' })
  @IsString()
  @IsOptional()
  category?: string;

  @ApiPropertyOptional({ description: 'Minimum salary in FCFA', example: 500000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMin?: number;

  @ApiPropertyOptional({ description: 'Maximum salary in FCFA', example: 1000000 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  salaryMax?: number;

  @ApiPropertyOptional({
    description: 'Salary as raw text from source',
    example: '500k – 1M FCFA',
  })
  @IsString()
  @IsOptional()
  salaryRaw?: string;

  @ApiPropertyOptional({ description: 'Minimum years of experience required', example: 2 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  yearsExperienceMin?: number;

  @ApiPropertyOptional({ description: 'Maximum years of experience accepted', example: 5 })
  @IsNumber()
  @Min(0)
  @IsOptional()
  yearsExperienceMax?: number;

  @ApiPropertyOptional({
    type: [String],
    description: 'Required skills list',
    example: ['NestJS', 'PostgreSQL', 'TypeScript'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  requiredSkills?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Preferred (nice-to-have) skills',
    example: ['Redis', 'Docker'],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  preferredSkills?: string[];

  @ApiPropertyOptional({ description: 'Required education level', example: 'Bac+3' })
  @IsString()
  @IsOptional()
  educationLevel?: string;

  @ApiProperty({
    description: 'Canonical URL of the original job posting',
    example: 'https://emploisenegal.com/jobs/123',
  })
  @IsUrl()
  sourceUrl!: string;

  @ApiProperty({ enum: SourcePlatform, description: 'Platform this job was sourced from' })
  @IsEnum(SourcePlatform)
  sourcePlatform!: SourcePlatform;

  @ApiPropertyOptional({ description: 'Original ID on the source platform' })
  @IsString()
  @IsOptional()
  sourceId?: string;

  @ApiProperty({ description: 'Original publication date (ISO 8601)', example: '2025-03-20T10:00:00Z' })
  @IsDateString()
  publishedAt!: string;

  @ApiPropertyOptional({ description: 'Expiry date of the offer (ISO 8601)' })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({ description: 'Whether this is a premium/featured listing' })
  @IsBoolean()
  @IsOptional()
  isPremium?: boolean;
}
