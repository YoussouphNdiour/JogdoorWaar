import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Plan, Subscription } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { OrangeMoneyService, OrangeWebhookPayload } from './orange-money.service';
import { StripeService } from './stripe.service';
import { WaveService } from './wave.service';

/** Amount in FCFA keyed by plan. FREE is not purchasable. */
const PLAN_AMOUNTS: Partial<Record<Plan, number>> = {
  [Plan.PREMIUM]: 3500,
  [Plan.RECRUITER]: 15000,
};

/** Duration of one subscription cycle: 31 days in milliseconds. */
const CYCLE_MS = 31 * 24 * 60 * 60 * 1000;

interface WaveWebhookPayload {
  id?: string;
  client_reference?: string;
  status?: string;
  [key: string]: unknown;
}

// OrangeWebhookPayload is imported from orange-money.service

/**
 * PaymentsService orchestrates subscription lifecycle:
 * initiation, webhook handling (Wave / Orange Money / Stripe),
 * activation, and cancellation.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly waveService: WaveService,
    private readonly orangeMoneyService: OrangeMoneyService,
    private readonly stripeService: StripeService,
  ) {}

  // ---------------------------------------------------------------------------
  // Initiation
  // ---------------------------------------------------------------------------

  /**
   * Initiate a payment for a given plan and return the provider redirect URL.
   * Stores a pending subscription record so webhook callbacks can resolve it.
   */
  async initiatePayment(
    userId: string,
    dto: InitiatePaymentDto,
  ): Promise<{ redirectUrl?: string; qrCode?: string }> {
    if (dto.plan === Plan.FREE) {
      throw new BadRequestException('The FREE plan cannot be purchased.');
    }

    if (dto.paymentMethod === 'ORANGE_MONEY' && !dto.phone) {
      throw new BadRequestException(
        'phone is required when using ORANGE_MONEY.',
      );
    }

    const amount = PLAN_AMOUNTS[dto.plan];
    if (amount === undefined) {
      throw new BadRequestException(`No price defined for plan ${dto.plan}.`);
    }

    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { id: true, email: true },
    });

    // Use a unique reference for this payment attempt so we can match it in the webhook.
    const clientRef = `${userId}_${dto.plan}_${randomUUID()}`;

    // Persist pending subscription so webhooks can find it by clientRef.
    await this.prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: dto.plan,
        status: 'pending',
        paymentMethod: dto.paymentMethod,
        externalPaymentId: clientRef,
        amount,
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + CYCLE_MS),
      },
      update: {
        plan: dto.plan,
        status: 'pending',
        paymentMethod: dto.paymentMethod,
        externalPaymentId: clientRef,
        amount,
      },
    });

    let redirectUrl: string | undefined;
    let qrCode: string | undefined;

    if (dto.paymentMethod === 'WAVE') {
      const result = await this.waveService.createCheckoutSession(
        userId,
        amount,
        dto.plan,
        clientRef,
      );
      redirectUrl = result.redirectUrl;
    } else if (dto.paymentMethod === 'ORANGE_MONEY') {
      const result = await this.orangeMoneyService.initiatePayment(
        userId,
        amount,
        clientRef,
      );
      qrCode = result.qrCode;
    } else {
      const result = await this.stripeService.createCheckoutSession(
        userId,
        amount,
        dto.plan,
        user.email,
      );
      redirectUrl = result.redirectUrl;
    }

    this.logger.log(
      `Payment initiated: user=${userId} plan=${dto.plan} method=${dto.paymentMethod} ref=${clientRef}`,
    );

    return { redirectUrl, qrCode };
  }

  // ---------------------------------------------------------------------------
  // Webhook handlers
  // ---------------------------------------------------------------------------

  /**
   * Handle an incoming Wave webhook.
   * Verifies HMAC-SHA256 signature then activates subscription on success status.
   */
  async handleWaveWebhook(
    rawBody: Buffer,
    signature: string,
    payload: WaveWebhookPayload,
  ): Promise<void> {
    const valid = this.waveService.verifyWebhookSignature(rawBody, signature);
    if (!valid) {
      this.logger.warn('Wave webhook signature verification failed');
      throw new UnauthorizedException('Invalid Wave webhook signature');
    }

    // Wave sends status 'succeeded' on completed payment.
    if (payload.status !== 'succeeded') {
      this.logger.log(`Wave webhook ignored — status: ${payload.status}`);
      return;
    }

    const clientRef = payload.client_reference ?? payload.id;
    if (!clientRef) {
      this.logger.warn('Wave webhook missing client_reference and id');
      return;
    }

    await this.activateSubscriptionByRef(
      clientRef,
      'WAVE',
      payload.id ?? clientRef,
    );
  }

  /**
   * Handle an incoming Orange Money webhook (Orange Sonatel QR code callback).
   * Verifies the shared apiKey then activates subscription on SUCCESS status.
   * Docs: POST /api/eWallet/v4/qrcode → X-Callback-Url
   */
  async handleOrangeWebhook(
    apiKey: string,
    payload: OrangeWebhookPayload,
  ): Promise<void> {
    const valid = this.orangeMoneyService.verifyWebhookApiKey(apiKey);
    if (!valid) {
      this.logger.warn('Orange Money webhook apiKey verification failed');
      throw new UnauthorizedException('Invalid Orange Money webhook apiKey');
    }

    if (payload.status !== 'SUCCESS') {
      this.logger.log(`Orange Money webhook ignored — status: ${payload.status}`);
      return;
    }

    const ref = payload.reference;
    if (!ref) {
      this.logger.warn('Orange Money webhook missing reference');
      return;
    }

    await this.activateSubscriptionByRef(ref, 'ORANGE_MONEY', payload.transactionId ?? ref);
  }

  /**
   * Handle an incoming Stripe webhook.
   * Uses Stripe SDK signature verification then activates subscription on
   * checkout.session.completed events.
   */
  async handleStripeWebhook(
    rawBody: Buffer,
    signature: string,
  ): Promise<void> {
    const event = this.stripeService.constructWebhookEvent(rawBody, signature);

    if (event.type !== 'checkout.session.completed') {
      this.logger.log(`Stripe webhook ignored — type: ${event.type}`);
      return;
    }

    // The Stripe SDK types checkout.session.completed data as Stripe.Checkout.Session.
    const session = event.data.object as {
      metadata?: Record<string, string>;
      id?: string;
      payment_status?: string;
    };

    if (session.payment_status !== 'paid') {
      this.logger.log(
        `Stripe session not paid yet — status: ${session.payment_status}`,
      );
      return;
    }

    const userId = session.metadata?.userId;
    const planRaw = session.metadata?.plan;

    if (!userId || !planRaw) {
      this.logger.warn('Stripe webhook missing userId or plan in metadata');
      return;
    }

    const plan = planRaw as Plan;
    const amount = PLAN_AMOUNTS[plan] ?? 0;

    await this.activateSubscription(
      userId,
      plan,
      'STRIPE',
      session.id ?? 'stripe_unknown',
      amount,
    );
  }

  // ---------------------------------------------------------------------------
  // Core subscription management
  // ---------------------------------------------------------------------------

  /**
   * Activate a subscription identified by the externalPaymentId (clientRef / orderId).
   * Looks up the pending subscription then delegates to activateSubscription.
   */
  private async activateSubscriptionByRef(
    ref: string,
    paymentMethod: string,
    externalId: string,
  ): Promise<void> {
    const subscription = await this.prisma.subscription.findFirst({
      where: { externalPaymentId: ref },
    });

    if (!subscription) {
      this.logger.warn(
        `No subscription found for ref=${ref} — possible duplicate or unknown webhook`,
      );
      return;
    }

    await this.activateSubscription(
      subscription.userId,
      subscription.plan,
      paymentMethod,
      externalId,
      subscription.amount,
    );
  }

  /**
   * Upsert the Subscription record to active and update the User's plan and
   * planExpiresAt to now + 31 days.
   */
  async activateSubscription(
    userId: string,
    plan: Plan,
    paymentMethod: string,
    externalId: string,
    amount: number,
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + CYCLE_MS);

    await this.prisma.$transaction([
      this.prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          plan,
          status: 'active',
          paymentMethod,
          externalPaymentId: externalId,
          amount,
          startedAt: now,
          expiresAt,
        },
        update: {
          plan,
          status: 'active',
          paymentMethod,
          externalPaymentId: externalId,
          amount,
          startedAt: now,
          expiresAt,
        },
      }),
      this.prisma.user.update({
        where: { id: userId },
        data: {
          plan,
          planExpiresAt: expiresAt,
        },
      }),
    ]);

    this.logger.log(
      `Subscription activated: user=${userId} plan=${plan} method=${paymentMethod} expires=${expiresAt.toISOString()}`,
    );
  }

  // ---------------------------------------------------------------------------
  // Query & mutation
  // ---------------------------------------------------------------------------

  /** Retrieve the current subscription for a user, or null if none exists. */
  async getSubscription(userId: string): Promise<Subscription | null> {
    return this.prisma.subscription.findUnique({ where: { userId } });
  }

  /**
   * Cancel the current subscription.
   * Sets status to 'cancelled' but preserves access until expiresAt.
   */
  async cancelSubscription(userId: string): Promise<void> {
    await this.prisma.subscription.update({
      where: { userId },
      data: { status: 'cancelled' },
    });

    this.logger.log(`Subscription cancelled for user=${userId}`);
  }

  /**
   * Retrieve all subscriptions (invoices) for a user, ordered by most recent.
   */
  async getInvoices(userId: string): Promise<Subscription[]> {
    return this.prisma.subscription.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
