import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { Plan, UserRole } from '@jdw/shared-types';

export class UpdateUserDto {
  @IsOptional()
  @IsEnum(Plan)
  plan?: Plan;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
