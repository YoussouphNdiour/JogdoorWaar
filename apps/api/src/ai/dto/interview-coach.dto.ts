import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class InterviewCoachDto {
  @ApiProperty({
    description: "ID de l'offre d'emploi pour préparer l'entretien",
    example: 'clxyz789ghi',
  })
  @IsString()
  jobId!: string;
}
