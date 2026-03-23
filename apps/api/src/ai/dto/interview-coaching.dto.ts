import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConversationMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'], example: 'user' })
  @IsString()
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ example: 'Pouvez-vous me poser une question sur ma gestion du stress ?' })
  @IsString()
  @MaxLength(4_000)
  content!: string;
}

export class InterviewCoachingDto {
  @ApiPropertyOptional({ description: "ID de l'offre (optionnel — adapte les questions au poste)" })
  @IsString()
  @IsOptional()
  jobId?: string;

  @ApiProperty({ description: "Dernier message de l'utilisateur", maxLength: 2_000 })
  @IsString()
  @MaxLength(2_000)
  userMessage!: string;

  @ApiProperty({ type: [ConversationMessageDto], default: [] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConversationMessageDto)
  conversationHistory!: ConversationMessageDto[];

  @ApiPropertyOptional({ description: 'ID de session (pour continuer une session existante)' })
  @IsString()
  @IsOptional()
  sessionId?: string;
}
