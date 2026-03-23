import { Logger } from '@nestjs/common';
import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { SourcePlatform } from '@prisma/client';
import { EmploiSenegalScraper } from './scrapers/emploisenegal.scraper';
import { EmploiDakarScraper } from './scrapers/emploidakar.scraper';
import { SenjobScraper } from './scrapers/senjob.scraper';
import { ExpatDakarScraper } from './scrapers/expatdakar.scraper';
import { SeneJobsScraper } from './scrapers/senejobs.scraper';
import { AfriRhScraper } from './scrapers/afrirh.scraper';
import { EmploiSenScraper } from './scrapers/emploisen.scraper';
import { SenRhScraper } from './scrapers/senrh.scraper';
import { ScrapingResult } from './dto/scraping-log.dto';

interface ScrapeJobPayload {
  platform: SourcePlatform;
}

@Processor('scraping')
export class ScrapingWorker {
  private readonly logger = new Logger(ScrapingWorker.name);

  constructor(
    private readonly emploiSenegalScraper: EmploiSenegalScraper,
    private readonly emploiDakarScraper: EmploiDakarScraper,
    private readonly senjobScraper: SenjobScraper,
    private readonly expatDakarScraper: ExpatDakarScraper,
    private readonly seneJobsScraper: SeneJobsScraper,
    private readonly afriRhScraper: AfriRhScraper,
    private readonly emploiSenScraper: EmploiSenScraper,
    private readonly senRhScraper: SenRhScraper,
  ) {}

  @Process('scrape')
  async handleScrape(job: Job<ScrapeJobPayload>): Promise<ScrapingResult> {
    const { platform } = job.data;

    this.logger.log(`Worker received scraping job for platform: ${platform}`);

    switch (platform) {
      case SourcePlatform.EMPLOI_SENEGAL:
        return this.emploiSenegalScraper.scrapeAll();

      case SourcePlatform.EMPLOI_DAKAR:
        return this.emploiDakarScraper.scrapeAll();

      case SourcePlatform.SENJOB:
        return this.senjobScraper.scrapeAll();

      case SourcePlatform.EXPAT_DAKAR:
        return this.expatDakarScraper.scrapeAll();

      case SourcePlatform.SENEJOBS:
        return this.seneJobsScraper.scrapeAll();

      case SourcePlatform.AFRIRH:
        return this.afriRhScraper.scrapeAll();

      case SourcePlatform.EMPLOI_SEN:
        return this.emploiSenScraper.scrapeAll();

      case SourcePlatform.SENRH:
        return this.senRhScraper.scrapeAll();

      default:
        this.logger.warn(`No scraper registered for platform: ${platform}`);
        return {
          platform,
          processed: 0,
          skipped: 0,
          errors: 0,
          durationMs: 0,
          startedAt: new Date(),
        };
    }
  }
}
