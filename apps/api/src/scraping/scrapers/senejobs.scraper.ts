import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourcePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';

/**
 * SeneJobsScraper
 *
 * ⚠️  senejobs.com is offline (HTTP 404 on root) as of 2026-03-27.
 *     Scraper is disabled until the domain comes back.
 */
@Injectable()
export class SeneJobsScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.SENEJOBS;
  protected readonly baseUrl = 'https://www.senejobs.com';
  protected readonly logger = new Logger(SeneJobsScraper.name);

  protected readonly MAX_PAGES = 3;

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  // ─── fetchJobUrls ────────────────────────────────────────────────────────────

  protected async fetchJobUrls(page: number): Promise<string[]> {
    // senejobs.com is currently offline — skip silently
    if (page === 0) {
      this.logger.warn('[SENEJOBS] Site offline — scraping skipped');
    }
    return [];

    // Dead code preserved for when the site comes back:
    if (page >= this.MAX_PAGES) {
      return [];
    }

    const pageParam = page + 1;
    const listUrl = `${this.baseUrl}/offres-d-emploi?page=${pageParam}`;

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

    // Primary selectors for senejobs.com
    $(
      '.job-card a[href], .job-listing-item a[href], .job-listing a[href], h3 a[href], .job-title a[href]',
    ).each((_i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      if (!urls.includes(absolute)) urls.push(absolute);
    });

    // Fallback: any anchor containing /offre or /emploi in the path
    if (urls.length === 0) {
      $('a[href]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (
          (href.includes('/offre') || href.includes('/emploi/')) &&
          href !== `${this.baseUrl}/offres-d-emploi`
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
      $('h1.job-title, h1.titre-poste, h1.entry-title, h1').first().text().trim();

    const company =
      $(
        '.company-name, .company, .nom-entreprise, .employer, .recruteur',
      )
        .first()
        .text()
        .trim();

    const description =
      $('.job-description, .description, .contenu-offre, .entry-content, .detail-description')
        .first()
        .text()
        .trim() ||
      $('article, main').first().text().trim();

    const locationText =
      $('.location, .city, .lieu, .ville, .localisation').first().text().trim();

    const contractTypeText =
      $('.contract-type, .job-type, .type-contrat, .contrat').first().text().trim();

    const dateText =
      $('time, .date, .date-publication, .posted-date, .publication-date')
        .first()
        .text()
        .trim();

    const sectorText =
      $('.sector, .secteur, .domaine, .categorie').first().text().trim();

    const salaryText =
      $('.salary, .salaire, .remuneration').first().text().trim();

    const logoEl = $('img.company-logo, .company-logo img, img.logo').first();
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
