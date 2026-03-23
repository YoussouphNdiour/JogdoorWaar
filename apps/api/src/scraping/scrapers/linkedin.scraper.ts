import { Injectable, Logger } from '@nestjs/common';
import { SourcePlatform } from '@prisma/client';
import { chromium, Browser, Page } from 'playwright';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';
import { ScrapingResult } from '../dto/scraping-log.dto';

// ─── Configuration ───────────────────────────────────────────────────────────

/** Maximum number of job offers to process per scraping run. */
const MAX_JOBS_PER_RUN = 20;

/** LinkedIn public job search URL — recent offers in Senegal (past 24 h). */
const SEARCH_URL =
  'https://www.linkedin.com/jobs/search/?location=S%C3%A9n%C3%A9gal&f_TPR=r86400';

/** Delay range between processing individual offers (ms). */
const MIN_DELAY_MS = 3_000;
const MAX_DELAY_MS = 7_000;

/** Pool of realistic desktop user-agent strings for rotation. */
const USER_AGENTS: readonly string[] = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14.4; rv:125.0) Gecko/20100101 Firefox/125.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_4_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0',
] as const;

// ─── Helper types ────────────────────────────────────────────────────────────

interface LinkedInJobCard {
  title: string;
  company: string;
  location: string;
  dateText: string;
  detailUrl: string;
  logoUrl: string | undefined;
}

// ─── Scraper ─────────────────────────────────────────────────────────────────

/**
 * LinkedInScraper
 *
 * Scrapes **public** LinkedIn job search pages (no authentication required).
 * Uses Playwright headless Chromium because LinkedIn is heavily JS-rendered
 * and actively blocks simple HTTP fetchers.
 *
 * Overrides `scrapeAll()` entirely because the BaseScraper loop relies on
 * `fetchHtml()` + `fetchJobUrls()` which are inappropriate for a browser-based
 * workflow where the same Page instance must be reused across navigation.
 *
 * Constraints:
 * - Max 20 offers per run (rate-limit safety)
 * - 3–7 s random delay between offers
 * - User-agent rotation per run
 * - Graceful degradation: returns `[]` if LinkedIn blocks
 */
@Injectable()
export class LinkedInScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.LINKEDIN;
  protected readonly baseUrl = 'https://www.linkedin.com';
  protected readonly logger = new Logger(LinkedInScraper.name);

  /** BullMQ cron schedule — every 6 hours (gentle on LinkedIn). */
  static readonly cronSchedule = '0 */6 * * *';

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  // ─── Abstract implementations (not used directly, but required) ────────────

  /**
   * Not used — LinkedIn scraping is fully handled in `scrapeAll()`.
   * Provided to satisfy the abstract contract of BaseScraper.
   */
  protected async fetchJobUrls(_page: number): Promise<string[]> {
    return [];
  }

  /**
   * Not used — parsing is done via Playwright selectors in `scrapeAll()`.
   * Provided to satisfy the abstract contract of BaseScraper.
   */
  protected async parseJobDetail(_html: string, _url: string): Promise<RawJob | null> {
    return null;
  }

  // ─── Main entry point (overrides base loop) ───────────────────────────────

  override async scrapeAll(): Promise<ScrapingResult> {
    const startedAt = new Date();
    let processed = 0;
    let skipped = 0;
    let errors = 0;

    this.logger.log(`[${this.platform}] Scraping started`);

    let browser: Browser | undefined;

    try {
      browser = await this.launchBrowser();
      const page = await this.createStealthPage(browser);

      // Navigate to search results
      const loaded = await this.navigateToSearch(page);
      if (!loaded) {
        this.logger.warn(`[${this.platform}] Could not load search page — LinkedIn may be blocking`);
        return this.buildResult(startedAt, 0, 0, 0);
      }

      // Scroll to load more job cards (LinkedIn lazy-loads them)
      await this.scrollToLoadCards(page);

      // Extract job cards from the listing
      const cards = await this.extractJobCards(page);
      this.logger.log(`[${this.platform}] Found ${cards.length} job cards on listing page`);

      const toProcess = cards.slice(0, MAX_JOBS_PER_RUN);

      for (const card of toProcess) {
        try {
          await this.randomDelayLinkedIn();

          // Fetch the full description by navigating to the job detail page
          const description = await this.fetchJobDescription(page, card.detailUrl);

          if (!description) {
            this.logger.warn(`[${this.platform}] No description found for: ${card.title}`);
            skipped++;
            continue;
          }

          const rawJob = this.buildRawJob(card, description);
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
          this.logger.error(
            `[${this.platform}] Error processing "${card.title}" at ${card.detailUrl}`,
            err instanceof Error ? err.stack : String(err),
          );
        }
      }
    } catch (err) {
      this.logger.error(
        `[${this.platform}] Fatal error during scraping run`,
        err instanceof Error ? err.stack : String(err),
      );
    } finally {
      if (browser) {
        await browser.close().catch((err: unknown) => {
          this.logger.warn(
            `[${this.platform}] Failed to close browser`,
            err instanceof Error ? err.message : String(err),
          );
        });
      }
    }

    const result = this.buildResult(startedAt, processed, skipped, errors);

    this.logger.log(
      `[${this.platform}] Done — processed: ${processed}, skipped: ${skipped}, errors: ${errors}, duration: ${result.durationMs}ms`,
    );

    return result;
  }

  // ─── Browser setup ─────────────────────────────────────────────────────────

  private async launchBrowser(): Promise<Browser> {
    return chromium.launch({
      headless: true,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-gpu',
      ],
    });
  }

  private async createStealthPage(browser: Browser): Promise<Page> {
    const userAgent = USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

    const context = await browser.newContext({
      userAgent,
      locale: 'fr-FR',
      timezoneId: 'Africa/Dakar',
      viewport: { width: 1366, height: 768 },
      extraHTTPHeaders: {
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
      },
    });

    const page = await context.newPage();

    // Remove the webdriver flag that reveals headless automation
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });

    return page;
  }

  // ─── Navigation & extraction ───────────────────────────────────────────────

  private async navigateToSearch(page: Page): Promise<boolean> {
    try {
      await page.goto(SEARCH_URL, {
        waitUntil: 'domcontentloaded',
        timeout: 30_000,
      });

      // Wait for job cards to appear (public LinkedIn uses these selectors)
      await page.waitForSelector(
        '.jobs-search__results-list li, .base-search-card',
        { timeout: 15_000 },
      );

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Scrolls the page progressively to trigger LinkedIn's lazy-loading
   * of additional job cards.
   */
  private async scrollToLoadCards(page: Page): Promise<void> {
    const scrollAttempts = 3;

    for (let i = 0; i < scrollAttempts; i++) {
      await page.evaluate(() => {
        window.scrollBy(0, window.innerHeight);
      });
      // Small wait after each scroll for content to load
      await page.waitForTimeout(1_500);
    }

    // Scroll back to top before interacting with cards
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
  }

  /**
   * Extracts job card metadata from the LinkedIn search results listing.
   * Uses public-facing selectors that work without authentication.
   */
  private async extractJobCards(page: Page): Promise<LinkedInJobCard[]> {
    return page.evaluate(() => {
      const cards: Array<{
        title: string;
        company: string;
        location: string;
        dateText: string;
        detailUrl: string;
        logoUrl: string | undefined;
      }> = [];

      // LinkedIn public search uses .base-search-card or .jobs-search__results-list li
      const cardElements = document.querySelectorAll(
        '.base-search-card, .jobs-search__results-list li',
      );

      for (const el of cardElements) {
        const titleEl = el.querySelector(
          '.base-search-card__title, .sr-only, h3',
        );
        const companyEl = el.querySelector(
          '.base-search-card__subtitle a, .base-search-card__subtitle, h4 a, h4',
        );
        const locationEl = el.querySelector(
          '.job-search-card__location, .base-search-card__metadata span',
        );
        const dateEl = el.querySelector(
          'time, .job-search-card__listdate, .base-search-card__metadata time',
        );
        const linkEl = el.querySelector('a.base-card__full-link, a[href*="/jobs/view/"]');
        const logoEl = el.querySelector(
          'img.artdeco-entity-image, img[data-delayed-url], img.base-search-card__image',
        ) as HTMLImageElement | null;

        const title = titleEl?.textContent?.trim() ?? '';
        const company = companyEl?.textContent?.trim() ?? '';
        const href = linkEl?.getAttribute('href') ?? '';

        if (!title || !company || !href) continue;

        // Clean up the URL — remove tracking query params
        let detailUrl = href.startsWith('http') ? href : `https://www.linkedin.com${href}`;
        const questionMark = detailUrl.indexOf('?');
        if (questionMark !== -1) {
          detailUrl = detailUrl.substring(0, questionMark);
        }

        cards.push({
          title,
          company,
          location: locationEl?.textContent?.trim() ?? '',
          dateText:
            dateEl?.getAttribute('datetime') ??
            dateEl?.textContent?.trim() ??
            '',
          detailUrl,
          logoUrl: logoEl?.src ?? logoEl?.getAttribute('data-delayed-url') ?? undefined,
        });
      }

      return cards;
    });
  }

  /**
   * Navigates to a LinkedIn job detail page and extracts the description text.
   * Returns null if the page cannot be loaded or the description is empty.
   */
  private async fetchJobDescription(page: Page, url: string): Promise<string | null> {
    try {
      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: 20_000,
      });

      // Wait for the description section
      await page.waitForSelector(
        '.description__text, .show-more-less-html__markup, .decorated-job-posting__details',
        { timeout: 10_000 },
      );

      const description = await page.evaluate(() => {
        const descEl =
          document.querySelector('.show-more-less-html__markup') ??
          document.querySelector('.description__text') ??
          document.querySelector('.decorated-job-posting__details');

        return descEl?.textContent?.trim() ?? null;
      });

      return description && description.length > 0 ? description : null;
    } catch {
      this.logger.warn(`[${this.platform}] Could not load detail page: ${url}`);
      return null;
    }
  }

  // ─── Data transformation ───────────────────────────────────────────────────

  /**
   * Builds a RawJob from a LinkedIn card and its fetched description.
   */
  private buildRawJob(card: LinkedInJobCard, description: string): RawJob {
    const city = this.extractCity(card.location);
    const publishedAt = this.parseLinkedInDate(card.dateText);
    const jobType = this.detectJobType(`${card.title} ${description}`);

    return {
      title: card.title,
      company: card.company,
      description,
      city,
      country: 'Sénégal',
      jobType,
      publishedAt,
      sourceUrl: card.detailUrl,
      sourcePlatform: SourcePlatform.LINKEDIN,
      sourceId: this.extractLinkedInJobId(card.detailUrl),
      companyLogoUrl: card.logoUrl,
    };
  }

  /**
   * Extracts the city name from LinkedIn's location field.
   * LinkedIn formats it as "City, Region, Country" or just "City, Country".
   */
  private extractCity(location: string): string {
    if (!location) return 'Dakar';

    const parts = location.split(',').map((s) => s.trim());

    // First part is typically the city
    const city = parts[0];

    if (!city || city.length === 0) return 'Dakar';

    // Check for common Senegalese city names
    const senegalCities = [
      'Dakar', 'Thiès', 'Saint-Louis', 'Ziguinchor', 'Kaolack',
      'Mbour', 'Rufisque', 'Tambacounda', 'Kolda', 'Matam',
      'Kaffrine', 'Kédougou', 'Sédhiou', 'Fatick', 'Diourbel',
      'Louga', 'Richard-Toll', 'Touba', 'Saly',
    ];

    // Return the matched city or the raw first part
    const matched = senegalCities.find(
      (c) => city.toLowerCase().includes(c.toLowerCase()),
    );

    return matched ?? city;
  }

  /**
   * Parses LinkedIn's date format.
   * LinkedIn public pages use ISO datetime attributes on `<time>` elements,
   * or relative text like "il y a 2 jours" / "2 days ago".
   */
  private parseLinkedInDate(dateText: string): Date {
    if (!dateText) return new Date();

    // ISO datetime — e.g. "2024-06-15"
    if (/^\d{4}-\d{2}-\d{2}/.test(dateText.trim())) {
      const d = new Date(dateText.trim());
      if (!isNaN(d.getTime())) return d;
    }

    // Relative English — "X days/weeks/months ago"
    const enRelative = dateText.toLowerCase().match(/(\d+)\s+(day|week|month|hour|minute)s?\s+ago/);
    if (enRelative) {
      const n = parseInt(enRelative[1], 10);
      const unit = enRelative[2];
      const now = new Date();
      if (unit === 'day') now.setDate(now.getDate() - n);
      else if (unit === 'week') now.setDate(now.getDate() - n * 7);
      else if (unit === 'month') now.setMonth(now.getMonth() - n);
      else if (unit === 'hour') now.setHours(now.getHours() - n);
      else if (unit === 'minute') now.setMinutes(now.getMinutes() - n);
      return now;
    }

    // Fall back to base class parser (handles French relative dates)
    return this.parseDate(dateText);
  }

  /**
   * Extracts the numeric LinkedIn job ID from a detail URL.
   * URL format: https://www.linkedin.com/jobs/view/1234567890
   */
  private extractLinkedInJobId(url: string): string | undefined {
    const match = url.match(/\/jobs\/view\/(\d+)/);
    return match?.[1];
  }

  // ─── Persistence (delegates to Prisma) ─────────────────────────────────────

  /**
   * Persists a RawJob to the database.
   * Mirrors the private `persistJob` from BaseScraper (which is not accessible).
   */
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

  // ─── Utilities ─────────────────────────────────────────────────────────────

  /**
   * Returns a random delay between 3000ms and 7000ms.
   * More conservative than the base class (2-5s) because LinkedIn
   * is stricter about rate limiting.
   */
  private randomDelayLinkedIn(): Promise<void> {
    const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private buildResult(
    startedAt: Date,
    processed: number,
    skipped: number,
    errors: number,
  ): ScrapingResult {
    return {
      platform: this.platform,
      processed,
      skipped,
      errors,
      durationMs: Date.now() - startedAt.getTime(),
      startedAt,
    };
  }
}
