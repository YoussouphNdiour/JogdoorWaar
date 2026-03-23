import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Token de réinitialisation reçu par email' })
  @IsString()
  token: string;

  @ApiProperty({ example: 'NouveauMotDePasse123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword: string;
}
