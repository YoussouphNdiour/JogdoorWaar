import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional } from 'class-validator';

export class GenerateAdaptedCvDto {
  @ApiProperty({
    description: "ID de l'offre cible",
    example: 'clxyz789ghi',
  })
  @IsString()
  jobId!: string;

  @ApiPropertyOptional({
    description: 'ID du CV de base (utilise le CV par défaut si absent)',
    example: 'clxyz456def',
  })
  @IsString()
  @IsOptional()
  baseCvId?: string;
}
