import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { Plan } from '@prisma/client';

const PLAN_PRICE_LABELS: Record<Plan, string> = {
  [Plan.FREE]: 'Free',
  [Plan.PREMIUM]: 'Premium — 3 500 FCFA/mois',
  [Plan.RECRUITER]: 'Recruteur — 15 000 FCFA/mois',
};

interface StripeCheckoutResult {
  sessionId: string;
  redirectUrl: string;
}

/**
 * StripeService wraps Stripe Checkout for international card fallback payments.
 * Amount is passed in FCFA (minor unit already for XOF, which has no subunit).
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;

  constructor(private readonly config: ConfigService) {
    const secretKey = this.config.getOrThrow<string>('STRIPE_SECRET_KEY');
    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
    });
  }

  /**
   * Create a Stripe Checkout Session (redirect-based).
   * XOF is a zero-decimal currency so amount is passed as-is.
   */
  async createCheckoutSession(
    userId: string,
    amount: number,
    plan: Plan,
    email: string,
  ): Promise<StripeCheckoutResult> {
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    try {
      const session = await this.stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment',
        customer_email: email,
        line_items: [
          {
            price_data: {
              currency: 'xof',
              unit_amount: amount, // XOF has no subunit
              product_data: {
                name: PLAN_PRICE_LABELS[plan],
                description: `Abonnement Jog Door Waar — plan ${plan}`,
              },
            },
            quantity: 1,
          },
        ],
        metadata: {
          userId,
          plan,
        },
        success_url: `${frontendUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${frontendUrl}/payments/error`,
      });

      if (!session.url) {
        throw new InternalServerErrorException(
          'Stripe did not return a checkout URL',
        );
      }

      this.logger.log(
        `Stripe session created: ${session.id} for user ${userId} plan ${plan}`,
      );

      return {
        sessionId: session.id,
        redirectUrl: session.url,
      };
    } catch (err: unknown) {
      if (err instanceof Stripe.errors.StripeError) {
        this.logger.error(`Stripe error: ${err.message}`);
        throw new InternalServerErrorException(
          `Stripe checkout failed: ${err.message}`,
        );
      }
      throw err;
    }
  }

  /**
   * Construct and verify a Stripe webhook event from the raw request body
   * and the Stripe-Signature header value.
   * Throws if the signature is invalid.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.config.getOrThrow<string>(
      'STRIPE_WEBHOOK_SECRET',
    );

    try {
      return this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err: unknown) {
      if (err instanceof Stripe.errors.StripeSignatureVerificationError) {
        this.logger.warn(`Stripe webhook signature verification failed`);
        throw err;
      }
      throw err;
    }
  }
}
