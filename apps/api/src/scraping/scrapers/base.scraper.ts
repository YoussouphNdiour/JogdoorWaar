import { Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';
import { JobType, SourcePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { ScrapingResult } from '../dto/scraping-log.dto';

/** Milliseconds to wait between individual HTTP requests (2 – 5 s). */
const MIN_DELAY_MS = 2_000;
const MAX_DELAY_MS = 5_000;

const BOT_USER_AGENT = 'JogDoorWaar-Bot/1.0 (+https://jogdoorwaar.com/bot)';

/** Simple regex patterns used to classify job contract type. */
const JOB_TYPE_PATTERNS: Array<{ pattern: RegExp; type: JobType }> = [
  { pattern: /\bCDI\b/i, type: JobType.CDI },
  { pattern: /\bCDD\b/i, type: JobType.CDD },
  { pattern: /\bstage\b/i, type: JobType.STAGE },
  { pattern: /\balterman(ce|at)/i, type: JobType.ALTERNANCE },
  { pattern: /\bfreelance\b/i, type: JobType.FREELANCE },
  { pattern: /\btemps.partiel\b/i, type: JobType.TEMPS_PARTIEL },
  { pattern: /\bb[eé]n[eé]volat\b/i, type: JobType.BENEVOLAT },
];

/** French date fragments used by dayjs-style manual parsing. */
const FR_MONTHS: Record<string, number> = {
  janvier: 1, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
  juillet: 7, août: 8, septembre: 9, octobre: 10, novembre: 11, décembre: 12,
  jan: 1, fév: 2, avr: 4, juil: 7, aoû: 8, sep: 9, oct: 10, nov: 11, déc: 12,
};

export abstract class BaseScraper {
  protected abstract readonly platform: SourcePlatform;
  protected abstract readonly baseUrl: string;
  protected abstract readonly logger: Logger;

  constructor(
    protected readonly prisma: PrismaService,
    protected readonly deduplication: DeduplicationService,
  ) {}

  // ─── Abstract contract ──────────────────────────────────────────────────────

  /** Returns paginated list of job-detail URLs for the given page index (0-based). */
  protected abstract fetchJobUrls(page: number): Promise<string[]>;

  /** Parses a job-detail HTML page and returns a RawJob, or null if unparseable. */
  protected abstract parseJobDetail(html: string, url: string): Promise<RawJob | null>;

  // ─── Public entry-point ─────────────────────────────────────────────────────

  /** Subclasses can override to limit pages per run (default: 50). */
  protected readonly MAX_PAGES: number = 50;

  /** Full scrape run — called by the BullMQ worker or the scheduler. */
  async scrapeAll(): Promise<ScrapingResult> {
    const startedAt = new Date();
    let processed = 0;
    let skipped = 0;
    let errors = 0;
    let page = 0;
    let hasMore = true;
    let consecutiveAllDupPages = 0;

    this.logger.log(`[${this.platform}] Scraping started`);

    while (hasMore) {
      let urls: string[];

      try {
        urls = await this.fetchJobUrls(page);
      } catch (err) {
        this.logger.error(`[${this.platform}] fetchJobUrls(page=${page}) failed`, err);
        break;
      }

      if (urls.length === 0) {
        hasMore = false;
        break;
      }

      let pageNew = 0;

      for (const url of urls) {
        try {
          await this.randomDelay();

          const html = await this.fetchHtml(url);
          const rawJob = await this.parseJobDetail(html, url);

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

          await this.persistJob(rawJob, fingerprint);
          processed++;
          pageNew++;
        } catch (err) {
          errors++;
          this.logger.error(`[${this.platform}] Error processing ${url}`, err);
        }
      }

      // Stop early if 2 consecutive pages had zero new jobs (all duplicates)
      if (pageNew === 0) {
        consecutiveAllDupPages++;
        if (consecutiveAllDupPages >= 2) {
          this.logger.log(
            `[${this.platform}] 2 consecutive all-duplicate pages — stopping early at page ${page + 1}`,
          );
          hasMore = false;
          break;
        }
      } else {
        consecutiveAllDupPages = 0;
      }

      page++;

      // Safety cap — never exceed MAX_PAGES per run.
      if (page >= this.MAX_PAGES) {
        this.logger.warn(`[${this.platform}] Reached page cap (${this.MAX_PAGES}). Stopping.`);
        hasMore = false;
      }
    }

    const durationMs = Date.now() - startedAt.getTime();

    this.logger.log(
      `[${this.platform}] Done — processed: ${processed}, skipped: ${skipped}, errors: ${errors}, duration: ${durationMs}ms`,
    );

    return { platform: this.platform, processed, skipped, errors, durationMs, startedAt };
  }

  // ─── Persistence ────────────────────────────────────────────────────────────

  private async persistJob(job: RawJob, fingerprint: string): Promise<void> {
    await this.prisma.job.create({
      data: {
        fingerprint,
        title: job.title,
        company: job.company,
        description: job.description,
        city: job.city ?? 'Dakar',
        country: job.country ?? 'Sénégal',
        jobType: job.jobType ?? JobType.CDI,
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

  // ─── Helpers ────────────────────────────────────────────────────────────────

  /**
   * Generates a SHA-256 fingerprint from title, company and publication date.
   * Normalises strings to lower-case and trims whitespace before hashing.
   */
  protected generateFingerprint(job: RawJob): string {
    const raw = [
      job.title.toLowerCase().trim(),
      job.company.toLowerCase().trim(),
      job.publishedAt.toISOString().split('T')[0], // YYYY-MM-DD
    ].join('|');

    return crypto.createHash('sha256').update(raw, 'utf8').digest('hex');
  }

  /**
   * Fetches a URL and returns its body as a UTF-8 string.
   * Respects the bot User-Agent header and follows HTTP 301/302 redirects.
   */
  protected fetchHtml(url: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const lib = url.startsWith('https') ? https : http;

      const options = {
        headers: {
          'User-Agent': BOT_USER_AGENT,
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
          Connection: 'keep-alive',
        },
      };

      const req = lib.get(url, options, (res) => {
        // Follow one level of redirects
        if (
          (res.statusCode === 301 || res.statusCode === 302) &&
          res.headers.location
        ) {
          this.fetchHtml(res.headers.location).then(resolve).catch(reject);
          return;
        }

        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          return;
        }

        res.setEncoding('utf8');
        const chunks: string[] = [];
        res.on('data', (chunk: string) => chunks.push(chunk));
        res.on('end', () => resolve(chunks.join('')));
        res.on('error', reject);
      });

      req.on('error', reject);
      req.setTimeout(15_000, () => {
        req.destroy();
        reject(new Error(`Timeout fetching ${url}`));
      });
    });
  }

  /**
   * Detects job contract type from free text using simple regex matching.
   * Returns CDI as the default when no pattern matches.
   */
  protected detectJobType(text: string): JobType {
    for (const { pattern, type } of JOB_TYPE_PATTERNS) {
      if (pattern.test(text)) {
        return type;
      }
    }
    return JobType.CDI;
  }

  /**
   * Attempts to parse a French-formatted date string into a JS Date.
   * Tries ISO 8601, DD/MM/YYYY, "DD mois YYYY", and relative expressions.
   * Falls back to the current date when no format matches.
   */
  protected parseDate(text: string): Date {
    if (!text || text.trim() === '') return new Date();

    const clean = text.trim();

    // ISO 8601 — 2024-06-15 or 2024-06-15T12:00:00Z
    if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
      const d = new Date(clean);
      if (!isNaN(d.getTime())) return d;
    }

    // DD/MM/YYYY or DD-MM-YYYY
    const dmy = clean.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmy) {
      const d = new Date(
        parseInt(dmy[3]),
        parseInt(dmy[2]) - 1,
        parseInt(dmy[1]),
      );
      if (!isNaN(d.getTime())) return d;
    }

    // DD mois YYYY  e.g. "15 juin 2024"
    const frl = clean.toLowerCase().match(/^(\d{1,2})\s+([a-zéûôâî]+)\s+(\d{4})$/);
    if (frl) {
      const month = FR_MONTHS[frl[2]];
      if (month) {
        const d = new Date(parseInt(frl[3]), month - 1, parseInt(frl[1]));
        if (!isNaN(d.getTime())) return d;
      }
    }

    // Relative — "il y a X jours/semaines"
    const relative = clean.toLowerCase().match(/il y a\s+(\d+)\s+(jour|semaine|mois)/);
    if (relative) {
      const n = parseInt(relative[1]);
      const unit = relative[2];
      const now = new Date();
      if (unit === 'jour') now.setDate(now.getDate() - n);
      else if (unit === 'semaine') now.setDate(now.getDate() - n * 7);
      else if (unit === 'mois') now.setMonth(now.getMonth() - n);
      return now;
    }

    // Fallback
    this.logger.warn(`Could not parse date: "${text}"`);
    return new Date();
  }

  // ─── Private utilities ──────────────────────────────────────────────────────

  private randomDelay(): Promise<void> {
    const ms = Math.floor(Math.random() * (MAX_DELAY_MS - MIN_DELAY_MS + 1)) + MIN_DELAY_MS;
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
