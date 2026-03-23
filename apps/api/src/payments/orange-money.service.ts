import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as https from 'https';

interface OrangeMoneyRequest {
  merchant_key: string;
  currency: 'OUV';
  order_id: string;
  amount: number;
  return_url: string;
  cancel_url: string;
  notif_url: string;
  lang: 'fr';
}

interface OrangeMoneyResponse {
  payment_url: string;
  pay_token: string;
}

interface OrangeMoneyResult {
  paymentUrl: string;
  payToken: string;
}

/**
 * OrangeMoneyService wraps the Orange Money West Africa MoMo WebPay API.
 * Uses native https to avoid an axios dependency.
 */
@Injectable()
export class OrangeMoneyService {
  private readonly logger = new Logger(OrangeMoneyService.name);

  constructor(private readonly config: ConfigService) {}

  /**
   * Initiate an Orange Money payment session.
   * orderId should be unique per payment attempt (e.g. cuid or uuid).
   */
  async initiatePayment(
    userId: string,
    amount: number,
    orderId: string,
  ): Promise<OrangeMoneyResult> {
    const apiKey = this.config.getOrThrow<string>('ORANGE_MONEY_API_KEY');
    const merchantKey = this.config.getOrThrow<string>(
      'ORANGE_MONEY_MERCHANT_KEY',
    );
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const apiUrl = this.config.getOrThrow<string>('API_URL');

    const requestBody: OrangeMoneyRequest = {
      merchant_key: merchantKey,
      currency: 'OUV',
      order_id: orderId,
      amount,
      return_url: `${frontendUrl}/payments/success?ref=${orderId}`,
      cancel_url: `${frontendUrl}/payments/error?ref=${orderId}`,
      notif_url: `${apiUrl}/payments/webhook/orange`,
      lang: 'fr',
    };

    const bodyString = JSON.stringify(requestBody);

    const data = await this.postJson<OrangeMoneyResponse>(
      'api.orange.com',
      '/orange-money-webpay/dev/v1/webpayment',
      bodyString,
      {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString).toString(),
      },
    );

    this.logger.log(
      `Orange Money payment initiated: order ${orderId} for user ${userId}`,
    );

    return {
      paymentUrl: data.payment_url,
      payToken: data.pay_token,
    };
  }

  /**
   * Verify the HMAC-SHA256 signature sent by Orange Money on webhook delivery.
   * Uses timing-safe comparison to prevent timing attacks.
   */
  verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
    const webhookSecret = this.config.getOrThrow<string>(
      'ORANGE_MONEY_WEBHOOK_SECRET',
    );

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
                `Orange Money API error ${res.statusCode ?? 'unknown'}: ${raw}`,
              );
              reject(
                new InternalServerErrorException(
                  `Orange Money API returned status ${res.statusCode ?? 'unknown'}`,
                ),
              );
              return;
            }

            try {
              resolve(JSON.parse(raw) as T);
            } catch {
              reject(
                new InternalServerErrorException(
                  'Failed to parse Orange Money API response',
                ),
              );
            }
          });
        },
      );

      req.on('error', (err: Error) => {
        this.logger.error(`Orange Money API request failed: ${err.message}`);
        reject(
          new InternalServerErrorException('Orange Money API request failed'),
        );
      });

      req.write(body);
      req.end();
    });
  }
}
