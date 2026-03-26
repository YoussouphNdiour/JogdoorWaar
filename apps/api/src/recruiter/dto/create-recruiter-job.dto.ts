import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateRecruiterJobDto {
  @ApiProperty({ example: 'Développeur Full-Stack React/Node.js' })
  @IsString()
  @MinLength(3)
  title: string;

  @ApiProperty({ example: 'Acme Corp Sénégal' })
  @IsString()
  @MinLength(2)
  company: string;

  @ApiProperty({ example: 'Dakar' })
  @IsString()
  city: string;

  @ApiPropertyOptional({ example: 'Sénégal' })
  @IsString()
  @IsOptional()
  country?: string;

  @ApiPropertyOptional({ example: 'HYBRID', description: 'REMOTE | HYBRID | ON_SITE' })
  @IsString()
  @IsOptional()
  workMode?: string;

  @ApiPropertyOptional({ example: 'CDI', description: 'CDI | CDD | STAGE | ALTERNANCE | FREELANCE' })
  @IsString()
  @IsOptional()
  jobType?: string;

  @ApiPropertyOptional({ example: 'Informatique & Numérique' })
  @IsString()
  @IsOptional()
  sector?: string;

  @ApiPropertyOptional({ example: 400000 })
  @IsNumber()
  @IsOptional()
  salaryMin?: number;

  @ApiPropertyOptional({ example: 700000 })
  @IsNumber()
  @IsOptional()
  salaryMax?: number;

  @ApiProperty({ example: 'Nous recherchons un développeur Full-Stack expérimenté pour rejoindre notre équipe...', minLength: 50 })
  @IsString()
  @MinLength(50)
  descriptionFull: string;

  @ApiPropertyOptional({ example: ['React', 'Node.js', 'TypeScript'] })
  @IsString({ each: true })
  @IsOptional()
  requiredSkills?: string[];
}
