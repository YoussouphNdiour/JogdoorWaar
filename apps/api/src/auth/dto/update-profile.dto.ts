import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { JobType, WorkMode } from '@prisma/client';

export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Amadou' })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiPropertyOptional({ example: 'Diallo' })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiPropertyOptional({ example: '+221771234567' })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ example: '221771234567' })
  @IsString()
  @IsOptional()
  whatsappNumber?: string;

  @ApiPropertyOptional({ example: 'https://storage.supabase.co/avatars/user.png' })
  @IsString()
  @IsOptional()
  avatarUrl?: string;

  @ApiPropertyOptional({ example: 'Développeur Full Stack' })
  @IsString()
  @IsOptional()
  title?: string;

  @ApiPropertyOptional({ example: 'Dakar' })
  @IsString()
  @IsOptional()
  city?: string;

  @ApiPropertyOptional({ example: 'Développeur passionné par les produits IA' })
  @IsString()
  @IsOptional()
  headline?: string;

  @ApiPropertyOptional({ example: "5 ans d'expérience en développement web full stack..." })
  @IsString()
  @IsOptional()
  summary?: string;

  @ApiPropertyOptional({ example: 3 })
  @IsInt()
  @Min(0)
  @Max(50)
  @IsOptional()
  yearsOfExperience?: number;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isOpenToWork?: boolean;

  @ApiPropertyOptional({ enum: WorkMode, isArray: true })
  @IsArray()
  @IsEnum(WorkMode, { each: true })
  @IsOptional()
  preferredWorkMode?: WorkMode[];

  @ApiPropertyOptional({ enum: JobType, isArray: true })
  @IsArray()
  @IsEnum(JobType, { each: true })
  @IsOptional()
  preferredJobTypes?: JobType[];
}
