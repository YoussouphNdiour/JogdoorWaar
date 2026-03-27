import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsPhoneNumber,
  IsString,
  MinLength,
} from 'class-validator';
import { UserRole } from '@jdw/shared-types';

export class RegisterDto {
  @ApiProperty({ example: 'amadou.diallo@example.sn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Amadou', minLength: 2 })
  @IsString()
  @MinLength(2)
  firstName: string;

  @ApiProperty({ example: 'Diallo', minLength: 2 })
  @IsString()
  @MinLength(2)
  lastName: string;

  @ApiProperty({ example: 'MotDePasse123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;

  @ApiPropertyOptional({ example: '+221771234567' })
  @IsPhoneNumber()
  @IsOptional()
  phone?: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.CANDIDATE })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiPropertyOptional({ example: 'Orange Sénégal' })
  @IsString()
  @IsOptional()
  company?: string;
}
