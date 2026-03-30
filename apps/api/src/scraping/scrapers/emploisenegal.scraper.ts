import { Injectable, Logger } from '@nestjs/common';
import { SourcePlatform } from '@prisma/client';
import { chromium, Browser, Page } from 'playwright';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';
import { ScrapingResult } from '../dto/scraping-log.dto';

/** Milliseconds delay range between page navigations (2 – 5 s). */
const MIN_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5_000;
const MAX_PAGES = 10;
const NAV_TIMEOUT_MS = 30_000;

/**
 * EmploiSenegalScraper
 *
 * Target  : https://www.emploisenegal.com/offres-emploi
 * Method  : Playwright (headless Chromium) — site is protected by Cloudflare.
 * Schedule: Every 2 h.
 */
@Injectable()
export class EmploiSenegalScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.EMPLOI_SENEGAL;
  protected readonly baseUrl = 'https://www.emploisenegal.com';
  protected readonly logger = new Logger(EmploiSenegalScraper.name);

  static readonly cronSchedule = '0 */2 * * *';

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  override async scrapeAll(): Promise<ScrapingResult> {
    const startedAt = new Date();
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let browser: Browser | null = null;

    this.logger.log(`[${this.platform}] Scraping started (Playwright)`);

    try {
      browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      const context = await browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        locale: 'fr-FR',
      });

      const page = await context.newPage();
      page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

      let currentPage = 0;
      let hasMore = true;

      while (hasMore && currentPage < MAX_PAGES) {
        let jobUrls: string[];
        try {
          jobUrls = await this.fetchJobUrlsPlaywright(page, currentPage);
        } catch (err) {
          this.logger.error(
            `[${this.platform}] fetchJobUrls(page=${currentPage}) failed`,
            err instanceof Error ? err.message : String(err),
          );
          break;
        }

        if (jobUrls.length === 0) {
          hasMore = false;
          break;
        }

        for (const url of jobUrls) {
          try {
            await this.randomPlaywrightDelay();
            const rawJob = await this.parseJobDetailPlaywright(page, url);

            if (!rawJob) {
              skipped++;
              continue;
            }

            const fingerprint = this.generateFingerprint(rawJob);
            const isDup = await this.deduplication.isDuplicate(rawJob, fingerprint);

            if (isDup) {
              skipped++;
              continue;
            }

            await this.persistJobFromRaw(rawJob, fingerprint);
            processed++;
          } catch (err) {
            errors++;
            this.logger.warn(
              `[${this.platform}] Error processing ${url}: ${err instanceof Error ? err.message : String(err)}`,
            );
          }
        }

        currentPage++;
      }

      await context.close();
    } catch (err) {
      this.logger.error(
        `[${this.platform}] Fatal error`,
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      if (browser) await browser.close();
    }

    const durationMs = Date.now() - startedAt.getTime();
    this.logger.log(
      `[${this.platform}] Done — processed: ${processed}, skipped: ${skipped}, errors: ${errors}, duration: ${durationMs}ms`,
    );
    return { platform: this.platform, processed, skipped, errors, durationMs, startedAt };
  }

  private async fetchJobUrlsPlaywright(page: Page, pageIndex: number): Promise<string[]> {
    const pageNum = pageIndex + 1;
    const listUrl = `${this.baseUrl}/offres-emploi?page=${pageNum}`;
    this.logger.debug(`Fetching listing page ${pageNum}: ${listUrl}`);

    await page.goto(listUrl, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2_000);

    const urls = await page.evaluate((baseUrl: string) => {
      const links: string[] = [];
      const seen = new Set<string>();

      const anchors = document.querySelectorAll<HTMLAnchorElement>(
        '.job-listing a[href], .job-list a[href], article a[href], h2 a[href], h3 a[href]',
      );

      for (const a of anchors) {
        const href = a.href;
        if (!href || seen.has(href)) continue;
        if (
          href.startsWith(baseUrl) &&
          !href.includes('/offres-emploi') &&
          !href.includes('#')
        ) {
          seen.add(href);
          links.push(href);
        }
      }

      return links;
    }, this.baseUrl);

    this.logger.debug(`[${this.platform}] Page ${pageNum} — found ${urls.length} URLs`);
    return urls;
  }

  private async parseJobDetailPlaywright(page: Page, url: string): Promise<RawJob | null> {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);

    const data = await page.evaluate(() => {
      const txt = (...selectors: string[]): string => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) return el.textContent.trim();
        }
        return '';
      };

      const title = txt('.job-title', 'h1.entry-title', 'h1');
      const company = txt('.company-name', '.company', '.employer', '.recruteur');
      const description = txt('.job-description', '.entry-content', '.description', 'article');
      const city = txt('.location', '.ville', '.job-location');
      const contractType = txt('.contract-type', '.type-contrat', '.job-type');
      const dateText = txt('.date-publication', 'time', '.date');
      const logoEl = document.querySelector<HTMLImageElement>('img.company-logo, .company-logo img');
      const logoSrc = logoEl?.src ?? logoEl?.dataset?.src ?? '';

      return { title, company, description, city, contractType, dateText, logoSrc };
    });

    if (!data.title) {
      this.logger.warn(`[${this.platform}] Skipping ${url} — missing title`);
      return null;
    }

    const company = data.company || 'Emploi Sénégal';
    return {
      title: data.title,
      company,
      description: data.description || `Offre d'emploi: ${data.title} chez ${company}`,
      city: data.city || 'Dakar',
      country: 'Sénégal',
      jobType: this.detectJobType(data.contractType || data.title),
      publishedAt: this.parseDate(data.dateText),
      sourceUrl: url,
      sourcePlatform: this.platform,
      companyLogoUrl: data.logoSrc
        ? data.logoSrc.startsWith('http')
          ? data.logoSrc
          : `${this.baseUrl}${data.logoSrc}`
        : undefined,
    };
  }

  private async persistJobFromRaw(job: RawJob, fingerprint: string): Promise<void> {
    await this.prisma.job.create({
      data: {
        fingerprint,
        title: job.title,
        company: job.company,
        description: job.description,
        city: job.city ?? 'Dakar',
        country: job.country ?? 'Sénégal',
        jobType: job.jobType ?? 'CDI',
        sector: job.sector,
        salaryRaw: job.salaryRaw,
        publishedAt: job.publishedAt,
        sourceUrl: job.sourceUrl,
        sourcePlatform: job.sourcePlatform,
        sourceId: job.sourceId,
        companyLogoUrl: job.companyLogoUrl,
        scrapedAt: new Date(),
        isActive: true,
      },
    });
  }

  private randomPlaywrightDelay(): Promise<void> {
    const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  protected async fetchJobUrls(_page: number): Promise<string[]> {
    return [];
  }

  protected async parseJobDetail(_html: string, _url: string): Promise<RawJob | null> {
    return null;
  }
}
