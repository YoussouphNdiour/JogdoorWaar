import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UploadCvDto {
  @ApiProperty({
    description: 'Nom du CV (2–80 caractères)',
    example: 'CV Développeur Full-Stack 2024',
    minLength: 2,
    maxLength: 80,
  })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({
    description: 'Étiquette courte pour boutons WhatsApp (max 24 caractères)',
    example: 'Dev FullStack',
    maxLength: 24,
  })
  @IsString()
  @IsOptional()
  @MaxLength(24)
  label?: string;

  @ApiPropertyOptional({
    description: 'Description libre du CV',
    example: 'CV orienté startups tech sénégalaises',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
