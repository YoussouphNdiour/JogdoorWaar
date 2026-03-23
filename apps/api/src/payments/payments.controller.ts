import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Subscription } from '@prisma/client';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { JwtPayload } from '../auth/interfaces/jwt-payload.interface';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { PaymentsService } from './payments.service';

@ApiTags('payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ---------------------------------------------------------------------------
  // Authenticated routes
  // ---------------------------------------------------------------------------

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate a subscription payment' })
  @ApiResponse({
    status: 201,
    description: 'Returns the provider redirect URL',
    schema: { example: { redirectUrl: 'https://pay.wave.com/...' } },
  })
  async initiatePayment(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InitiatePaymentDto,
  ): Promise<{ redirectUrl: string }> {
    return this.paymentsService.initiatePayment(user.sub, dto);
  }

  @Get('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current subscription' })
  @ApiResponse({ status: 200, description: 'Current subscription or null' })
  async getSubscription(
    @CurrentUser() user: JwtPayload,
  ): Promise<Subscription | null> {
    return this.paymentsService.getSubscription(user.sub);
  }

  @Delete('subscription')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Cancel current subscription' })
  @ApiResponse({ status: 204, description: 'Subscription cancelled' })
  async cancelSubscription(@CurrentUser() user: JwtPayload): Promise<void> {
    return this.paymentsService.cancelSubscription(user.sub);
  }

  // ---------------------------------------------------------------------------
  // Webhook routes — public, verified by HMAC signature inside service
  // ---------------------------------------------------------------------------

  @Post('webhook/wave')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Wave payment webhook',
    description:
      'Receives Wave checkout events. Signature verified via HMAC-SHA256.',
  })
  async waveWebhook(
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody;
    const signature = req.headers['wave-signature'];

    if (!rawBody) {
      throw new UnauthorizedException('Missing raw body');
    }

    if (typeof signature !== 'string' || !signature) {
      throw new UnauthorizedException('Missing Wave-Signature header');
    }

    const payload = req.body as Record<string, unknown>;

    await this.paymentsService.handleWaveWebhook(rawBody, signature, payload);

    return { received: true };
  }

  @Post('webhook/orange')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Orange Money payment webhook',
    description:
      'Receives Orange Money payment events. Signature verified via HMAC-SHA256.',
  })
  async orangeWebhook(
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody;
    const signature = req.headers['x-orange-signature'];

    if (!rawBody) {
      throw new UnauthorizedException('Missing raw body');
    }

    if (typeof signature !== 'string' || !signature) {
      throw new UnauthorizedException('Missing X-Orange-Signature header');
    }

    const payload = req.body as Record<string, unknown>;

    await this.paymentsService.handleOrangeWebhook(rawBody, signature, payload);

    return { received: true };
  }

  @Post('webhook/stripe')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Stripe payment webhook',
    description:
      'Receives Stripe checkout events. Signature verified by Stripe SDK.',
  })
  async stripeWebhook(
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const rawBody = req.rawBody;
    const signature = req.headers['stripe-signature'];

    if (!rawBody) {
      throw new UnauthorizedException('Missing raw body');
    }

    if (typeof signature !== 'string' || !signature) {
      throw new UnauthorizedException('Missing Stripe-Signature header');
    }

    await this.paymentsService.handleStripeWebhook(rawBody, signature);

    return { received: true };
  }
}
