import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JobsModule } from './jobs/jobs.module';
import { CvsModule } from './cvs/cvs.module';
import { AiModule } from './ai/ai.module';
import { AlertsModule } from './alerts/alerts.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ScrapingModule } from './scraping/scraping.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { PaymentsModule } from './payments/payments.module';
import { AdminModule } from './admin/admin.module';

@Module({
  imports: [
    // ─── Config globale ──────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    // ─── Rate limiting ────────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
      { name: 'login', ttl: 3600000, limit: 5 },
    ]),

    // ─── Scheduler (CRON) ─────────────────────────────────────
    ScheduleModule.forRoot(),

    // ─── Redis / BullMQ ──────────────────────────────────────
    BullModule.forRootAsync({
      useFactory: () => ({
        redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
      }),
    }),

    // ─── Database ─────────────────────────────────────────────
    PrismaModule,

    // ─── Feature modules ─────────────────────────────────────
    AuthModule,
    JobsModule,
    CvsModule,
    AiModule,
    AlertsModule,
    NotificationsModule,
    ScrapingModule,
    WhatsAppModule,
    PaymentsModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
