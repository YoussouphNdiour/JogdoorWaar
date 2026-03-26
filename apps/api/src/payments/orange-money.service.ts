import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as https from 'https';

// ─── API types ────────────────────────────────────────────────────────────────

interface OrangeTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface OrangeQRCodeRequest {
  amount: { unit: 'XOF'; value: number };
  code: string;       // 6-digit merchant code
  name: string;       // merchant display name
  callbackSuccessUrl: string;
  callbackCancelUrl: string;
  reference?: string;
  validity?: number;  // seconds — max 86400
}

interface OrangeQRCodeResponse {
  qrCode?: string;
  reference?: string;
  status?: string;
}

export interface OrangeMoneyPaymentResult {
  reference: string;
  qrCode?: string;
}

export interface OrangeWebhookPayload {
  reference: string;
  status: string;     // "SUCCESS" | "FAILED" | "CANCELLED" | …
  type?: string;      // "MERCHANT_PAYMENT"
  transactionId?: string;
  paymentMethod?: string;
  amount?: { value: number; unit: string };
  customer?: { idType: string; id: number };
  [key: string]: unknown;
}

/**
 * OrangeMoneyService — integrates the Orange Sonatel API.
 *
 * Flow:
 *  1. Obtain OAuth2 token via client_credentials (cached until near-expiry).
 *  2. Generate a QR code for merchant payment.
 *  3. Orange calls back our webhook with the payment result.
 *  4. Webhook is authenticated by comparing the shared apiKey.
 *
 * Sandbox: https://api.sandbox.orange-sonatel.com
 * Live:    https://api.orange-sonatel.com
 */
@Injectable()
export class OrangeMoneyService {
  private readonly logger = new Logger(OrangeMoneyService.name);

  // Token cache — reused until 60 s before expiry
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(private readonly config: ConfigService) {}

  // ─── Private helpers ──────────────────────────────────────────────────────

  private get baseUrl(): string {
    return this.config.get<string>('NODE_ENV') === 'production'
      ? 'https://api.orange-sonatel.com'
      : 'https://api.sandbox.orange-sonatel.com';
  }

  /**
   * Obtain (or return cached) OAuth2 access token.
   * Docs: POST /oauth/v1/token  (application/x-www-form-urlencoded)
   */
  private async getAccessToken(): Promise<string> {
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }

    const clientId = this.config.getOrThrow<string>('ORANGE_MONEY_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('ORANGE_MONEY_CLIENT_SECRET');

    const body = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }).toString();

    const url = new URL(`${this.baseUrl}/oauth/v1/token`);

    const data = await this.httpRequest<OrangeTokenResponse>(
      url.hostname,
      url.pathname,
      'POST',
      body,
      {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body).toString(),
      },
    );

    // Cache with 60 s safety buffer
    this.cachedToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

    return data.access_token;
  }

  // ─── Public API ───────────────────────────────────────────────────────────

  /**
   * Initiate a merchant QR code payment.
   * Docs: POST /api/eWallet/v4/qrcode
   */
  async initiatePayment(
    userId: string,
    amount: number,
    reference: string,
  ): Promise<OrangeMoneyPaymentResult> {
    const token = await this.getAccessToken();
    const merchantCode = this.config.getOrThrow<string>('ORANGE_MONEY_MERCHANT_CODE');
    const merchantName = this.config.get<string>('ORANGE_MONEY_MERCHANT_NAME', 'Jog Door Waar');
    const frontendUrl = this.config.getOrThrow<string>('FRONTEND_URL');
    const apiUrl = this.config.getOrThrow<string>('API_URL');

    const requestBody: OrangeQRCodeRequest = {
      amount: { unit: 'XOF', value: amount },
      code: merchantCode,
      name: merchantName,
      callbackSuccessUrl: `${frontendUrl}/payments/success?ref=${reference}`,
      callbackCancelUrl: `${frontendUrl}/payments/error?ref=${reference}`,
      reference,
      validity: 3600, // 1 hour
    };

    const bodyString = JSON.stringify(requestBody);
    const url = new URL(`${this.baseUrl}/api/eWallet/v4/qrcode`);

    const data = await this.httpRequest<OrangeQRCodeResponse>(
      url.hostname,
      url.pathname,
      'POST',
      bodyString,
      {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(bodyString).toString(),
        'X-Callback-Url': `${apiUrl}/payments/webhook/orange`,
      },
    );

    this.logger.log(`Orange Money QR code created: ref=${reference} user=${userId}`);

    return {
      reference: data.reference ?? reference,
      qrCode: data.qrCode,
    };
  }

  /**
   * Verify the apiKey sent by Orange in the webhook callback.
   * The expected key must match the value set via POST /api/notification/v1/merchantcallback
   * (stored as ORANGE_MONEY_WEBHOOK_SECRET env var).
   * Uses timing-safe comparison to prevent timing attacks.
   */
  verifyWebhookApiKey(receivedApiKey: string): boolean {
    const expected = this.config.getOrThrow<string>('ORANGE_MONEY_WEBHOOK_SECRET');

    try {
      const a = Buffer.from(expected, 'utf8');
      const b = Buffer.from(receivedApiKey, 'utf8');
      if (a.length !== b.length) return false;
      return crypto.timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  // ─── HTTP helper ──────────────────────────────────────────────────────────

  private httpRequest<T>(
    hostname: string,
    path: string,
    method: string,
    body: string,
    headers: Record<string, string>,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const req = https.request({ hostname, path, method, headers }, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk: Buffer) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');

          if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
            this.logger.error(`Orange Money API error ${res.statusCode ?? 'unknown'}: ${raw}`);
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
              new InternalServerErrorException('Failed to parse Orange Money API response'),
            );
          }
        });
      });

      req.on('error', (err: Error) => {
        this.logger.error(`Orange Money API request failed: ${err.message}`);
        reject(new InternalServerErrorException('Orange Money API request failed'));
      });

      req.write(body);
      req.end();
    });
  }
}
