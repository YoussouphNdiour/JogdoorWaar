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

/** Maximum listing pages to crawl per run. */
const MAX_PAGES = 10;

/** Playwright navigation timeout (30 s). */
const NAV_TIMEOUT_MS = 30_000;

/**
 * SenInterimScraper
 *
 * Target  : https://seninterim.sn/offres-emploi/
 * Method  : Playwright (headless Chromium) — the site relies on JavaScript rendering.
 * Schedule: Every 4 h (slow scraper group).
 *
 * The scraper:
 *   1. Opens the listing page with Playwright.
 *   2. Collects all job-detail URLs from the current page.
 *   3. Visits each detail page to extract structured job data.
 *   4. Handles pagination via "next page" links.
 *   5. De-duplicates and persists via the inherited BaseScraper pipeline.
 */
@Injectable()
export class SenInterimScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.SENINTERIM;
  protected readonly baseUrl = 'https://seninterim.sn';
  protected readonly logger = new Logger(SenInterimScraper.name);

  /** BullMQ cron schedule — every 4 hours */
  static readonly cronSchedule = '0 */4 * * *';

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  // ─── Playwright overrides ─────────────────────────────────────────────────────
  //
  // BaseScraper.scrapeAll() uses fetchHtml() (raw HTTP) which cannot render JS.
  // We override scrapeAll() entirely to manage a Playwright browser lifecycle,
  // while still delegating deduplication and persistence to the base class helpers.

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
          'JogDoorWaar-Bot/1.0 (+https://jogdoorwaar.com/bot)',
        locale: 'fr-FR',
      });

      const page = await context.newPage();
      page.setDefaultNavigationTimeout(NAV_TIMEOUT_MS);

      let currentPage = 0;
      let hasMore = true;

      while (hasMore && currentPage < MAX_PAGES) {
        // ── Fetch listing page URLs ──────────────────────────────────────────
        let jobUrls: string[];
        try {
          jobUrls = await this.fetchJobUrlsPlaywright(page, currentPage);
        } catch (err) {
          this.logger.error(
            `[${this.platform}] fetchJobUrlsPlaywright(page=${currentPage}) failed`,
            err instanceof Error ? err.stack : String(err),
          );
          break;
        }

        if (jobUrls.length === 0) {
          hasMore = false;
          break;
        }

        // ── Process each detail page ─────────────────────────────────────────
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

        if (currentPage >= MAX_PAGES) {
          this.logger.warn(`[${this.platform}] Reached page cap (${MAX_PAGES}). Stopping.`);
          hasMore = false;
        }
      }

      await context.close();
    } catch (err) {
      this.logger.error(
        `[${this.platform}] Fatal scraping error`,
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      if (browser) {
        await browser.close();
      }
    }

    const durationMs = Date.now() - startedAt.getTime();

    this.logger.log(
      `[${this.platform}] Done — processed: ${processed}, skipped: ${skipped}, errors: ${errors}, duration: ${durationMs}ms`,
    );

    return { platform: this.platform, processed, skipped, errors, durationMs, startedAt };
  }

  // ─── Playwright: fetch listing URLs ────────────────────────────────────────────

  private async fetchJobUrlsPlaywright(page: Page, pageIndex: number): Promise<string[]> {
    // SenInterim typically paginates via /offres-emploi/page/N/ (1-indexed) or query params.
    const pageNum = pageIndex + 1;
    const listUrl =
      pageIndex === 0
        ? `${this.baseUrl}/offres-emploi/`
        : `${this.baseUrl}/offres-emploi/page/${pageNum}/`;

    this.logger.debug(`Fetching listing page ${pageNum}: ${listUrl}`);

    await page.goto(listUrl, { waitUntil: 'networkidle' });

    // Wait briefly for any lazy-loaded content to appear.
    await page.waitForTimeout(1_500);

    // Extract all job-detail links from the listing page.
    // We try multiple selector strategies to be resilient to markup changes.
    const urls = await page.evaluate((baseUrl: string) => {
      const links: string[] = [];
      const seen = new Set<string>();

      // Strategy 1: anchor tags within common job listing containers
      const selectors = [
        '.job-listing a[href]',
        '.job_listings a[href]',
        '.job-list a[href]',
        'article a[href]',
        '.listing a[href]',
        '.offre a[href]',
        '.post a[href]',
        'a.job-title[href]',
        'a.job_listing-clickbox[href]',
        'h2 a[href]',
        'h3 a[href]',
      ];

      for (const selector of selectors) {
        const anchors = document.querySelectorAll<HTMLAnchorElement>(selector);
        for (const a of anchors) {
          const href = a.href;
          if (!href) continue;

          // Only keep links that look like individual job detail pages
          // (contain /offre/, /emploi/, /job/, or the slug pattern on the domain).
          const isJobLink =
            href.includes('/offre') ||
            href.includes('/emploi') ||
            href.includes('/job') ||
            (href.startsWith(baseUrl) && !href.endsWith('/offres-emploi/') && href !== baseUrl + '/');

          if (isJobLink && !seen.has(href)) {
            seen.add(href);
            links.push(href);
          }
        }
      }

      // Strategy 2 (fallback): any link on the domain that is not a listing/nav page
      if (links.length === 0) {
        const allAnchors = document.querySelectorAll<HTMLAnchorElement>('a[href]');
        for (const a of allAnchors) {
          const href = a.href;
          if (
            href.startsWith(baseUrl) &&
            !href.endsWith('/offres-emploi/') &&
            !href.includes('/page/') &&
            !href.includes('#') &&
            !href.includes('/category/') &&
            !href.includes('/tag/') &&
            href !== baseUrl &&
            href !== baseUrl + '/' &&
            !seen.has(href)
          ) {
            // Heuristic: path depth >= 2 usually means a detail page
            const path = new URL(href).pathname;
            const segments = path.split('/').filter(Boolean);
            if (segments.length >= 1) {
              seen.add(href);
              links.push(href);
            }
          }
        }
      }

      return links;
    }, this.baseUrl);

    this.logger.debug(`[${this.platform}] Page ${pageNum} — found ${urls.length} URLs`);
    return urls;
  }

  // ─── Playwright: parse job detail ──────────────────────────────────────────────

  private async parseJobDetailPlaywright(page: Page, url: string): Promise<RawJob | null> {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1_000);

    const data = await page.evaluate(() => {
      /** Helper: get trimmed text from the first matching selector, or empty string. */
      const txt = (...selectors: string[]): string => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) {
            return el.textContent.trim();
          }
        }
        return '';
      };

      /** Helper: get full text content from description containers. */
      const descTxt = (...selectors: string[]): string => {
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el?.textContent?.trim()) {
            return el.textContent.trim();
          }
        }
        return '';
      };

      const title = txt(
        'h1.job-title',
        'h1.entry-title',
        'h1.job_listing-title',
        '.job-title h1',
        'h1',
      );

      const company = txt(
        '.company-name',
        '.job-company',
        '.company',
        '.employer',
        '.job_listing-company strong',
        '.job_listing-company',
      );

      const description = descTxt(
        '.job-description',
        '.job_listing-description',
        '.entry-content',
        '.job-content',
        '.description',
        'article .content',
        'article',
      );

      const city = txt(
        '.job-location',
        '.location',
        '.job_listing-location',
        '.ville',
      );

      const contractType = txt(
        '.job-type',
        '.contract-type',
        '.type-contrat',
        '.job_listing-type',
      );

      const dateText = txt(
        '.job-date',
        '.date-publication',
        '.date-posted',
        'time',
        '.job_listing-date',
        '.published-date',
      );

      const logoEl =
        document.querySelector<HTMLImageElement>('img.company-logo') ??
        document.querySelector<HTMLImageElement>('.company-logo img') ??
        document.querySelector<HTMLImageElement>('.job-company img') ??
        document.querySelector<HTMLImageElement>('.employer img');
      const logoSrc = logoEl?.src ?? logoEl?.dataset?.src ?? '';

      return { title, company, description, city, contractType, dateText, logoSrc };
    });

    // Minimum required fields
    if (!data.title) {
      this.logger.warn(`[${this.platform}] Skipping ${url} — missing title`);
      return null;
    }

    const company = data.company || 'SenInterim';
    const jobType = this.detectJobType(data.contractType || data.title || data.description);
    const publishedAt = this.parseDate(data.dateText);
    const companyLogoUrl = data.logoSrc
      ? data.logoSrc.startsWith('http')
        ? data.logoSrc
        : `${this.baseUrl}${data.logoSrc}`
      : undefined;

    return {
      title: data.title,
      company,
      description: data.description || `Offre d'emploi: ${data.title} chez ${company}`,
      city: data.city || 'Dakar',
      country: 'Sénégal',
      jobType,
      publishedAt,
      sourceUrl: url,
      sourcePlatform: this.platform,
      companyLogoUrl,
    };
  }

  // ─── Persistence helper (mirrors BaseScraper.persistJob which is private) ──────

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

  // ─── Random delay ──────────────────────────────────────────────────────────────

  private randomPlaywrightDelay(): Promise<void> {
    const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Unused abstract implementations (required by BaseScraper) ─────────────────
  //
  // Since we override scrapeAll() entirely, these are never called.
  // They exist solely to satisfy the abstract contract.

  protected async fetchJobUrls(_page: number): Promise<string[]> {
    return [];
  }

  protected async parseJobDetail(_html: string, _url: string): Promise<RawJob | null> {
    return null;
  }
}
