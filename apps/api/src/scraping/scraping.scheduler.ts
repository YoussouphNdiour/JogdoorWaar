import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { SourcePlatform } from '@prisma/client';

/**
 * ScrapingScheduler
 *
 * Enqueues scraping jobs into the BullMQ 'scraping' queue on a tiered schedule.
 *
 *   Fast   — every 2 hours : EMPLOI_SENEGAL, EMPLOI_DAKAR, SENJOB, SENEJOBS
 *   Medium — every 3 hours : EXPAT_DAKAR, AFRIRH, EMPLOI_SEN, SENRH
 *   Slow   — every 4 hours : LINKEDIN, SENINTERIM, FACEBOOK
 */
@Injectable()
export class ScrapingScheduler {
  private readonly logger = new Logger(ScrapingScheduler.name);

  constructor(
    @InjectQueue('scraping') private readonly scrapingQueue: Queue,
  ) {}

  // ─── Fast scrapers — every 2 hours ──────────────────────────────────────────

  @Cron('0 */2 * * *')
  async runFastScrapers(): Promise<void> {
    const platforms: SourcePlatform[] = [
      SourcePlatform.EMPLOI_SENEGAL,
      SourcePlatform.EMPLOI_DAKAR,
      SourcePlatform.SENJOB,
      SourcePlatform.SENEJOBS,
    ];

    this.logger.log(`Scheduling fast scrapers: ${platforms.join(', ')}`);
    await this.enqueuePlatforms(platforms);
  }

  // ─── Medium scrapers — every 3 hours ────────────────────────────────────────

  @Cron('0 */3 * * *')
  async runMediumScrapers(): Promise<void> {
    // Reserved for future medium-frequency scrapers.
    // EXPAT_DAKAR, AFRIRH, EMPLOI_SEN, SENEJOBS and SENRH have been moved to
    // the slow group (*/4 h) to reduce load on those smaller sites.
    const platforms: SourcePlatform[] = [];

    if (platforms.length === 0) return;

    this.logger.log(`Scheduling medium scrapers: ${platforms.join(', ')}`);
    await this.enqueuePlatforms(platforms);
  }

  // ─── Slow scrapers — every 4 hours ──────────────────────────────────────────

  @Cron('0 */4 * * *')
  async runSlowScrapers(): Promise<void> {
    const platforms: SourcePlatform[] = [
      // Cheerio scrapers — smaller Senegalese job sites
      SourcePlatform.EXPAT_DAKAR,
      SourcePlatform.SENEJOBS,
      SourcePlatform.AFRIRH,
      SourcePlatform.EMPLOI_SEN,
      SourcePlatform.SENRH,
      // Playwright / AI-assisted scrapers
      SourcePlatform.LINKEDIN,
      SourcePlatform.SENINTERIM,
      SourcePlatform.FACEBOOK,
    ];

    this.logger.log(`Scheduling slow scrapers: ${platforms.join(', ')}`);
    await this.enqueuePlatforms(platforms);
  }

  // ─── Public helper — allows manual dispatch from admin endpoints ────────────

  async enqueuePlatform(platform: SourcePlatform): Promise<void> {
    await this.scrapingQueue.add(
      'scrape',
      { platform },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 60_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );
    this.logger.log(`Enqueued scrape job for ${platform}`);
  }

  // ─── Private ─────────────────────────────────────────────────────────────────

  private async enqueuePlatforms(platforms: SourcePlatform[]): Promise<void> {
    await Promise.all(platforms.map((p) => this.enqueuePlatform(p)));
  }
}
