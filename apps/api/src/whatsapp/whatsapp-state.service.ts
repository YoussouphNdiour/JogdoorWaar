import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { WhatsAppBotState } from '@prisma/client';
import { SessionData, BotContext } from './interfaces/bot-context.interface';
import * as Redis from 'ioredis';

const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24h Redis TTL
const INACTIVITY_TIMEOUT_MS = 60 * 60 * 1000; // 1h → reset to IDLE

function redisKey(phone: string) {
  return `whatsapp:session:${phone}`;
}

@Injectable()
export class WhatsAppStateService implements OnModuleInit {
  private readonly logger = new Logger(WhatsAppStateService.name);
  private redis!: Redis.Redis;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    this.redis = new Redis.default(
      this.config.get<string>('REDIS_URL', 'redis://localhost:6379'),
    );
    this.redis.on('error', (err) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
  }

  // ─── Load session (Redis → Prisma fallback) ───────────────────────
  async getSession(phone: string): Promise<SessionData | null> {
    const cached = await this.redis.get(redisKey(phone));
    if (cached) {
      const data = JSON.parse(cached) as SessionData;
      // Auto-expire inactive sessions to IDLE
      if (Date.now() - data.lastMessageAt > INACTIVITY_TIMEOUT_MS) {
        data.state = WhatsAppBotState.IDLE;
        data.context = {};
        await this.saveSession(data);
      }
      return data;
    }

    // Fallback: load from Prisma
    const session = await this.prisma.whatsAppSession.findFirst({
      where: { phone, expiresAt: { gt: new Date() } },
      include: { user: true },
      orderBy: { updatedAt: 'desc' },
    });

    if (!session) return null;

    const data: SessionData = {
      userId: session.userId,
      phone: session.phone,
      state: session.state,
      context: (session.context as BotContext) ?? {},
      lastMessageAt: session.lastMessageAt.getTime(),
    };
    await this.redis.setex(redisKey(phone), SESSION_TTL_SECONDS, JSON.stringify(data));
    return data;
  }

  // ─── Resolve or create session for a verified WhatsApp user ───────
  async getOrCreateSession(
    phone: string,
    userId: string,
  ): Promise<SessionData> {
    const existing = await this.getSession(phone);
    if (existing) return existing;

    const data: SessionData = {
      userId,
      phone,
      state: WhatsAppBotState.IDLE,
      context: {},
      lastMessageAt: Date.now(),
    };

    await this.saveSession(data);
    return data;
  }

  // ─── Persist session to Redis + Prisma ────────────────────────────
  async saveSession(data: SessionData): Promise<void> {
    data.lastMessageAt = Date.now();
    await this.redis.setex(redisKey(data.phone), SESSION_TTL_SECONDS, JSON.stringify(data));

    await this.prisma.whatsAppSession.upsert({
      where: { userId_phone: { userId: data.userId, phone: data.phone } },
      create: {
        userId: data.userId,
        phone: data.phone,
        state: data.state as WhatsAppBotState,
        context: data.context,
        lastMessageAt: new Date(data.lastMessageAt),
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      },
      update: {
        state: data.state as WhatsAppBotState,
        context: data.context,
        lastMessageAt: new Date(data.lastMessageAt),
        expiresAt: new Date(Date.now() + SESSION_TTL_SECONDS * 1000),
      },
    });
  }

  // ─── Reset session to IDLE ─────────────────────────────────────────
  async resetSession(data: SessionData): Promise<SessionData> {
    data.state = WhatsAppBotState.IDLE;
    data.context = {};
    await this.saveSession(data);
    return data;
  }

  // ─── Transition state ─────────────────────────────────────────────
  async transition(
    data: SessionData,
    newState: WhatsAppBotState,
    contextPatch?: Partial<BotContext>,
  ): Promise<SessionData> {
    data.state = newState;
    if (contextPatch) {
      data.context = { ...data.context, ...contextPatch };
    }
    await this.saveSession(data);
    return data;
  }
}
