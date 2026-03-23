import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class UpdateCvDto {
  @ApiPropertyOptional({
    description: 'Nom du CV (2–80 caractères)',
    example: 'CV Développeur Full-Stack — version recruteur',
    minLength: 2,
    maxLength: 80,
  })
  @IsString()
  @IsOptional()
  @MinLength(2)
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({
    description: 'Étiquette courte pour boutons WhatsApp (max 24 caractères)',
    example: 'Dev FS v2',
    maxLength: 24,
  })
  @IsString()
  @IsOptional()
  @MaxLength(24)
  label?: string;

  @ApiPropertyOptional({
    description: 'Description libre du CV',
    example: 'Adapté pour les annonces RH',
  })
  @IsString()
  @IsOptional()
  description?: string;
}
