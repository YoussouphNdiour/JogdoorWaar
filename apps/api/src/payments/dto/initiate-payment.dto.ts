import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsIn, IsOptional, IsString, Matches } from 'class-validator';
import { Plan } from '@prisma/client';

export const PAYMENT_METHODS = ['WAVE', 'ORANGE_MONEY', 'STRIPE'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/**
 * DTO for initiating a subscription payment.
 * phone is required when paymentMethod is ORANGE_MONEY.
 */
export class InitiatePaymentDto {
  @ApiProperty({
    enum: Plan,
    description: 'Subscription plan to activate (FREE cannot be purchased)',
    example: Plan.PREMIUM,
  })
  @IsEnum(Plan)
  plan!: Plan;

  @ApiProperty({
    enum: PAYMENT_METHODS,
    description: 'Payment provider',
    example: 'WAVE',
  })
  @IsIn(PAYMENT_METHODS)
  paymentMethod!: PaymentMethod;

  @ApiPropertyOptional({
    description:
      'Phone number in international format — required for ORANGE_MONEY',
    example: '+221771234567',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[1-9]\d{7,14}$/, {
    message: 'phone must be a valid international phone number',
  })
  phone?: string;
}
