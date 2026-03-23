import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class CoverLetterDto {
  @ApiProperty({
    description: "ID de l'offre d'emploi cible",
    example: 'clxyz123abc',
  })
  @IsString()
  jobId!: string;

  @ApiPropertyOptional({
    description: 'ID du CV à utiliser (optionnel — utilise le CV par défaut si absent)',
    example: 'clxyz456def',
  })
  @IsString()
  @IsOptional()
  cvId?: string;
}
