import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class SelectCvDto {
  @ApiProperty({
    description: "ID de l'offre pour laquelle sélectionner le meilleur CV",
    example: 'clxyz789ghi',
  })
  @IsString()
  jobId!: string;
}
