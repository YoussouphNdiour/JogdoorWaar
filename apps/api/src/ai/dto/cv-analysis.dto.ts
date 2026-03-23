import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CvAnalysisDto {
  @ApiProperty({
    description: 'ID du CV à analyser',
    example: 'clxyz456def',
  })
  @IsString()
  cvId!: string;
}
