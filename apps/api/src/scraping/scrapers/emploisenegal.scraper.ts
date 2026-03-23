import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourcePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';

@Injectable()
export class EmploiSenegalScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.EMPLOI_SENEGAL;
  protected readonly baseUrl = 'https://www.emploisenegal.com';
  protected readonly logger = new Logger(EmploiSenegalScraper.name);

  /** BullMQ cron schedule — every 2 hours */
  static readonly cronSchedule = '0 */2 * * *';

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  // ─── fetchJobUrls ────────────────────────────────────────────────────────────

  protected async fetchJobUrls(page: number): Promise<string[]> {
    // emploisenegal.com uses query-param pagination: ?page=N (1-indexed)
    const pageParam = page + 1;
    const listUrl = `${this.baseUrl}/offres-emploi?page=${pageParam}`;

    this.logger.debug(`Fetching listing page ${pageParam}: ${listUrl}`);

    let html: string;
    try {
      html = await this.fetchHtml(listUrl);
    } catch (err) {
      this.logger.error(`Failed to fetch listing page ${pageParam}`, err);
      return [];
    }

    const $ = cheerio.load(html);
    const urls: string[] = [];

    // The job listing uses anchor tags inside the .job-listing wrapper.
    $('.job-listing a[href]').each((_i, el) => {
      const href = $(el).attr('href');
      if (!href) return;

      // Resolve relative URLs
      const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;

      // Avoid duplicates within the same page batch
      if (!urls.includes(absolute)) {
        urls.push(absolute);
      }
    });

    this.logger.debug(`[${this.platform}] Page ${pageParam} — found ${urls.length} URLs`);
    return urls;
  }

  // ─── parseJobDetail ──────────────────────────────────────────────────────────

  protected async parseJobDetail(html: string, url: string): Promise<RawJob | null> {
    const $ = cheerio.load(html);

    const title = $('.job-title').first().text().trim();
    const company = $('.company-name').first().text().trim();
    const description = $('.job-description').first().text().trim();
    const locationText = $('.location').first().text().trim();
    const contractTypeText = $('.contract-type').first().text().trim();
    const dateText = $('.date-publication').first().text().trim();
    const logoEl = $('img.company-logo, .company-logo img').first();
    const logoSrc = logoEl.attr('src') ?? logoEl.attr('data-src');

    // Minimum required fields
    if (!title || !company) {
      this.logger.warn(`[${this.platform}] Skipping ${url} — missing title or company`);
      return null;
    }

    const jobType = this.detectJobType(contractTypeText || title || description);
    const publishedAt = this.parseDate(dateText);
    const companyLogoUrl = logoSrc
      ? logoSrc.startsWith('http')
        ? logoSrc
        : `${this.baseUrl}${logoSrc}`
      : undefined;

    return {
      title,
      company,
      description: description || `Offre d'emploi: ${title} chez ${company}`,
      city: locationText || 'Dakar',
      country: 'Sénégal',
      jobType,
      publishedAt,
      sourceUrl: url,
      sourcePlatform: this.platform,
      companyLogoUrl,
    };
  }
}
