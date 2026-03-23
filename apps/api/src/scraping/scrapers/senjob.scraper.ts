import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourcePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';

@Injectable()
export class SenjobScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.SENJOB;
  protected readonly baseUrl = 'https://www.senjob.com';
  protected readonly logger = new Logger(SenjobScraper.name);

  /** BullMQ cron schedule — every 2 hours */
  static readonly cronSchedule = '0 */2 * * *';

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  // ─── fetchJobUrls ────────────────────────────────────────────────────────────

  protected async fetchJobUrls(page: number): Promise<string[]> {
    // senjob.com uses ?page=N query param (1-indexed)
    const pageParam = page + 1;
    const listUrl = `${this.baseUrl}/emploi?page=${pageParam}`;

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

    // senjob.com patterns: .job-item a, .job-list-item a, article.job a
    $('.job-item a[href], .job-list-item a[href], article.job a[href], .offre a[href]').each(
      (_i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        if (!urls.includes(absolute)) urls.push(absolute);
      },
    );

    // Fallback: anchors whose href contains /emploi/ or /offre/
    if (urls.length === 0) {
      $('a[href]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (
          (href.includes('/emploi/') || href.includes('/offre/')) &&
          href !== `${this.baseUrl}/emploi`
        ) {
          const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (!urls.includes(absolute)) urls.push(absolute);
        }
      });
    }

    this.logger.debug(`[${this.platform}] Page ${pageParam} — found ${urls.length} URLs`);
    return urls;
  }

  // ─── parseJobDetail ──────────────────────────────────────────────────────────

  protected async parseJobDetail(html: string, url: string): Promise<RawJob | null> {
    const $ = cheerio.load(html);

    const title =
      $('h1.job-title, h1.titre, h1.entry-title, .job-title').first().text().trim() ||
      $('h1').first().text().trim();

    const company =
      $('.company, .entreprise, .employer, .recruteur').first().text().trim();

    const description =
      $('.description, .job-description, .content, .entry-content').first().text().trim() ||
      $('article, main').first().text().trim();

    const locationText =
      $('.location, .lieu, .ville, .localisation, .city').first().text().trim();

    const contractTypeText =
      $('.contract, .type-contrat, .contrat, .job-type').first().text().trim();

    const dateText =
      $('time, .date, .publication-date, .posted-date').first().text().trim();

    const sectorText =
      $('.sector, .secteur, .domaine').first().text().trim();

    const salaryText =
      $('.salary, .salaire, .remuneration').first().text().trim();

    const logoEl = $('img.logo, .company-logo img, .employer-logo img').first();
    const logoSrc = logoEl.attr('src') ?? logoEl.attr('data-src');

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
      sector: sectorText || undefined,
      salaryRaw: salaryText || undefined,
      publishedAt,
      sourceUrl: url,
      sourcePlatform: this.platform,
      companyLogoUrl,
    };
  }
}
