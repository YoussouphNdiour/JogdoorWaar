import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { PrismaModule } from '../prisma/prisma.module';
import { ScrapingScheduler } from './scraping.scheduler';
import { ScrapingWorker } from './scraping.worker';
import { DeduplicationService } from './deduplication.service';
import { EmploiSenegalScraper } from './scrapers/emploisenegal.scraper';
import { EmploiDakarScraper } from './scrapers/emploidakar.scraper';
import { SenjobScraper } from './scrapers/senjob.scraper';
import { ExpatDakarScraper } from './scrapers/expatdakar.scraper';
import { SeneJobsScraper } from './scrapers/senejobs.scraper';
import { AfriRhScraper } from './scrapers/afrirh.scraper';
import { EmploiSenScraper } from './scrapers/emploisen.scraper';
import { SenRhScraper } from './scrapers/senrh.scraper';
import { SenInterimScraper } from './scrapers/seninterim.scraper';
import { LinkedInScraper } from './scrapers/linkedin.scraper';

/**
 * ScrapingModule
 *
 * Self-contained module for all web scraping concerns:
 *   - BullMQ 'scraping' queue registration
 *   - Cron scheduler (uses ScheduleModule registered globally in AppModule)
 *   - BullMQ worker processor
 *   - Deduplication service (3-level: URL, fingerprint, vector)
 *   - Individual site scrapers (Cheerio-based)
 *
 * NOTE: ScheduleModule.forRoot() must be called in AppModule (or another root module).
 *       This module does NOT call forRoot() again to avoid duplicate scheduler instances.
 */
@Module({
  imports: [
    BullModule.registerQueue({ name: 'scraping' }),
    PrismaModule,
  ],
  providers: [
    DeduplicationService,
    // Fast scrapers (every 2 h)
    EmploiSenegalScraper,
    EmploiDakarScraper,
    SenjobScraper,
    // Slow scrapers (every 4 h) — Cheerio-based Senegalese job sites
    ExpatDakarScraper,
    SeneJobsScraper,
    AfriRhScraper,
    EmploiSenScraper,
    SenRhScraper,
    // Playwright-based scrapers — JS-heavy sites
    SenInterimScraper,
    LinkedInScraper, // every 6 h — LinkedIn is strict on rate limiting
    ScrapingWorker,
    ScrapingScheduler,
  ],
  exports: [ScrapingScheduler],
})
export class ScrapingModule {}
