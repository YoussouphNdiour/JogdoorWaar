import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as https from 'https';
import { Plan } from '@prisma/client';

interface WaveCheckoutRequest {
  amount: string;
  currency: 'XOF';
  error_url: string;
  success_url: string;
  client_reference: string;
}

interface WaveCheckoutResponse {
  id: string;
  wave_launch_url: string;
}

interface WaveCheckoutResult {
  sessionId: string;
  redirectUrl: string;
}

/**
 * WaveService wraps the Wave checkout API for Senegal.
 * Uses native https to avoid an axios dependency.
 */
@Injectable()
export class WaveService {
  private readonly logger = new Logger(WaveService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Create a Wave checkout session and return the session id and redirect URL.
   */
  async createCheckoutSession(
    userId: string,
    amount: number,
    plan: Plan,
    clientRef: string,
  ): Promise<WaveCheckoutResult> {
    const apiSecret = this.config.getOrThrow<string>('WAVE_API_SECRET');
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');

    const body: WaveCheckoutRequest = {
      amount: amount.toString(),
      currency: 'XOF',
      success_url: `${frontendUrl}/payments/success?ref=${clientRef}&plan=${plan}`,
      error_url: `${frontendUrl}/payments/error?ref=${clientRef}`,
      client_reference: clientRef,
    };

    const bodyString = JSON.stringify(body);

    const data = await this.postJson<WaveCheckoutResponse>(
      'api.wave.com',
      '/v1/checkout/sessions',
      bodyString,
      {
        Authorization: `Bearer ${apiSecret}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString).toString(),
      },
    );

    this.logger.log(
      `Wave session created: ${data.id} for user ${userId} plan ${plan}`,
    );

    return {
      sessionId: data.id,
      redirectUrl: data.wave_launch_url,
    };
  }

  /**
   * Verify the HMAC-SHA256 signature sent by Wave on webhook delivery.
   * Uses timing-safe comparison to prevent timing attacks.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const webhookSecret = this.config.getOrThrow<string>('WAVE_WEBHOOK_SECRET');

    const expected = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'utf8');
    const receivedBuffer = Buffer.from(signature, 'utf8');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  /**
   * Thin wrapper around https.request for JSON POST calls.
   */
  private postJson<T>(
    hostname: string,
    path: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const req = https.request(
        {
          hostname,
          path,
          method: 'POST',
          headers,
        },
        (res) => {
          const chunks: Buffer[] = [];

          res.on('data', (chunk: Buffer) => chunks.push(chunk));

          res.on('end', () => {
            const raw = Buffer.concat(chunks).toString('utf8');

            if (
              res.statusCode === undefined ||
              res.statusCode < 200 ||
              res.statusCode >= 300
            ) {
              this.logger.error(
                `Wave API error ${res.statusCode ?? 'unknown'}: ${raw}`,
              );
              reject(
                new InternalServerErrorException(
                  `Wave API returned status ${res.statusCode ?? 'unknown'}`,
                ),
              );
              return;
            }

            try {
              resolve(JSON.parse(raw) as T);
            } catch {
              reject(
                new InternalServerErrorException(
                  'Failed to parse Wave API response',
                ),
              );
            }
          });
        },
      );

      req.on('error', (err: Error) => {
        this.logger.error(`Wave API request failed: ${err.message}`);
        reject(new InternalServerErrorException('Wave API request failed'));
      });

      req.write(body);
      req.end();
    });
  }
}
