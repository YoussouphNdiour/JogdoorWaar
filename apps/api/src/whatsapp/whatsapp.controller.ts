import {
  Controller,
  Post,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  HttpCode,
  HttpStatus,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import * as crypto from 'crypto';
import { WhatsAppBotService } from './whatsapp-bot.service';
import { WaSenderWebhookPayload } from './dto/wasender-webhook.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('whatsapp')
export class WhatsAppController {
  private readonly logger = new Logger(WhatsAppController.name);
  private readonly webhookSecret: string;

  constructor(
    private readonly botService: WhatsAppBotService,
    private readonly config: ConfigService,
  ) {
    this.webhookSecret = this.config.get<string>('WASENDER_WEBHOOK_SECRET', '');
  }

  // ─── Webhook WaSender ─────────────────────────────────────────────
  // RULE: respond 200 immediately, process async to stay under 200ms
  @Public()
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-wasender-signature') signature: string,
    @Body() payload: WaSenderWebhookPayload,
  ) {
    // ─── HMAC verification ─────────────────────────────────────────
    this.verifySignature(req.rawBody, signature);

    // ─── Only process incoming messages ───────────────────────────
    if (payload.event !== 'messages.upsert' || !payload.data?.messages?.length) {
      return { ok: true };
    }

    // ─── Fire-and-forget (non-blocking) ───────────────────────────
    for (const msg of payload.data.messages) {
      if (!msg.message) continue; // skip delivery receipts
      this.botService.handleMessage(msg).catch((err) =>
        this.logger.error(`handleMessage error: ${err?.message}`),
      );
    }

    return { ok: true };
  }

  // ─── HMAC-SHA256 signature check ──────────────────────────────────
  private verifySignature(rawBody: Buffer | undefined, signature: string) {
    if (!this.webhookSecret) {
      this.logger.warn('WASENDER_WEBHOOK_SECRET not set — skipping HMAC check');
      return;
    }

    if (!signature) {
      throw new UnauthorizedException('Missing X-WaSender-Signature header');
    }

    const expected = 'sha256=' +
      crypto
        .createHmac('sha256', this.webhookSecret)
        .update(rawBody ?? Buffer.alloc(0))
        .digest('hex');

    const sigBuffer = Buffer.from(signature);
    const expBuffer = Buffer.from(expected);

    if (
      sigBuffer.length !== expBuffer.length ||
      !crypto.timingSafeEqual(sigBuffer, expBuffer)
    ) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
  }
}
