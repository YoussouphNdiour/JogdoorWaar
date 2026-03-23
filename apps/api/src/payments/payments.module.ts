import { Module } from '@nestjs/common';
import { OrangeMoneyService } from './orange-money.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';
import { WaveService } from './wave.service';

/**
 * PaymentsModule wires together the three payment provider services (Wave,
 * Orange Money, Stripe) with the orchestrating PaymentsService and the
 * PaymentsController that exposes REST endpoints.
 *
 * PrismaModule is @Global() so PrismaService is already available project-wide
 * without being listed here. ConfigModule is also global.
 */
@Module({
  controllers: [PaymentsController],
  providers: [PaymentsService, WaveService, OrangeMoneyService, StripeService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
