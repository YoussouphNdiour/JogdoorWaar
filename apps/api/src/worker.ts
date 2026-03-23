/**
 * worker.ts — Standalone Scraping Worker
 *
 * Bootstraps only the modules needed for BullMQ processing and
 * CRON-scheduled scraping, without starting an HTTP server.
 * Used by the `jdw-scrapers` Render.com worker service.
 *
 * Start command:  node dist/worker.js
 */

import { NestFactory } from '@nestjs/core';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { ScrapingModule } from './scraping/scraping.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    ScheduleModule.forRoot(),

    BullModule.forRootAsync({
      useFactory: () => ({
        redis: process.env.REDIS_URL ?? 'redis://localhost:6379',
      }),
    }),

    PrismaModule,

    // Registers: BullMQ processor, CRON scheduler, all scrapers, deduplication
    ScrapingModule,
  ],
})
class WorkerModule {}

async function bootstrap() {
  // ApplicationContext = no HTTP listener, just DI container + lifecycle hooks
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['log', 'warn', 'error'],
  });

  app.enableShutdownHooks();

  console.log('[JDW Worker] Scraping worker started — BullMQ + CRON active');
}

bootstrap().catch((err) => {
  console.error('[JDW Worker] Failed to start:', err);
  process.exit(1);
});
