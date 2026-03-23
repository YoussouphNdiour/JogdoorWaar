import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Code OTP à 6 chiffres reçu par email', example: '123456' })
  @IsString()
  @Length(6, 6)
  otp: string;
}
