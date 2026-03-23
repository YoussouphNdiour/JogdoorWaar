import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourcePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';

@Injectable()
export class EmploiDakarScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.EMPLOI_DAKAR;
  protected readonly baseUrl = 'https://www.emploidakar.com';
  protected readonly logger = new Logger(EmploiDakarScraper.name);

  /** BullMQ cron schedule — every 2 hours */
  static readonly cronSchedule = '0 */2 * * *';

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  // ─── fetchJobUrls ────────────────────────────────────────────────────────────

  protected async fetchJobUrls(page: number): Promise<string[]> {
    // emploidakar.com uses /offres-demploi/page/N path convention
    const pageParam = page + 1;
    const listUrl =
      pageParam === 1
        ? `${this.baseUrl}/offres-demploi`
        : `${this.baseUrl}/offres-demploi/page/${pageParam}`;

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

    // Common patterns on emploidakar.com:
    //   - h2.title > a, .job-title > a, article a.job-link
    $('h2.title a[href], .job-title a[href], article a.job-link[href], .offre-emploi a[href]').each(
      (_i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        if (!urls.includes(absolute)) urls.push(absolute);
      },
    );

    // Fallback: any anchor whose href starts with baseUrl and looks like a job detail
    if (urls.length === 0) {
      $('a[href]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (
          href.includes('/offre') &&
          !href.endsWith('/offres-demploi') &&
          href.length > this.baseUrl.length + 5
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

    // Try multiple selector patterns to be resilient to template changes
    const title =
      $('h1.job-title, h1.titre-offre, h1.entry-title, .job-title h1, h2.title').first().text().trim() ||
      $('h1').first().text().trim();

    const company =
      $('.entreprise, .company-name, .nom-entreprise, .employer-name').first().text().trim();

    const description =
      $('.description, .job-description, .contenu-offre, .entry-content').first().text().trim() ||
      $('article').first().text().trim();

    const locationText =
      $('.lieu, .location, .ville, .localisation').first().text().trim();

    const contractTypeText =
      $('.type-contrat, .contract-type, .contrat').first().text().trim();

    const dateText =
      $('.date, .date-publication, .date-offre, time').first().text().trim();

    const logoEl = $('img.logo-entreprise, .company-logo img, .logo img').first();
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
      publishedAt,
      sourceUrl: url,
      sourcePlatform: this.platform,
      companyLogoUrl,
    };
  }
}
