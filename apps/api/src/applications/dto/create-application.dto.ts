import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApplicationChannel } from '@prisma/client';

export class CreateApplicationDto {
  @ApiProperty({ example: 'clxyz123abc' })
  @IsString()
  jobId: string;

  @ApiPropertyOptional({ example: 'clcv456def' })
  @IsString()
  @IsOptional()
  cvId?: string;

  @ApiPropertyOptional({ enum: ApplicationChannel, default: ApplicationChannel.WEB })
  @IsEnum(ApplicationChannel)
  @IsOptional()
  channel?: ApplicationChannel;

  @ApiPropertyOptional({ example: 'Je suis très motivé par ce poste...' })
  @IsString()
  @IsOptional()
  coverLetter?: string;
}
