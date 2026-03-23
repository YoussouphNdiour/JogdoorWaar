import { ApiProperty } from '@nestjs/swagger';
import { IsEmail } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ example: 'amadou.diallo@example.sn' })
  @IsEmail()
  email: string;
}
