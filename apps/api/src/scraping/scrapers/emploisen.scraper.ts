import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourcePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';

/**
 * EmploiSenScraper
 *
 * Target : https://www.emploi-sen.com/offres-emploi/
 * Pagination : /offres-emploi/page/N (1-indexed, N > 1)
 * Max pages   : 3
 */
@Injectable()
export class EmploiSenScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.EMPLOI_SEN;
  protected readonly baseUrl = 'https://www.emploi-sen.com';
  protected readonly logger = new Logger(EmploiSenScraper.name);

  protected readonly MAX_PAGES = 3;

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  // ─── fetchJobUrls ────────────────────────────────────────────────────────────

  protected async fetchJobUrls(page: number): Promise<string[]> {
    if (page >= this.MAX_PAGES) {
      return [];
    }

    const pageParam = page + 1;
    const listUrl =
      pageParam === 1
        ? `${this.baseUrl}/offres-emploi/`
        : `${this.baseUrl}/offres-emploi/page/${pageParam}/`;

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

    // Primary selectors for emploi-sen.com (WordPress-style listing)
    $(
      '.job-listing a[href], article.emploi a[href], .job-title a[href], h2 a[href], h3 a[href], .entry-title a[href]',
    ).each((_i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      if (!urls.includes(absolute)) urls.push(absolute);
    });

    // Fallback: links that look like individual job posts
    if (urls.length === 0) {
      $('a[href]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (
          href.startsWith(this.baseUrl) &&
          href !== `${this.baseUrl}/offres-emploi/` &&
          href !== `${this.baseUrl}/offres-emploi` &&
          href.length > this.baseUrl.length + 5
        ) {
          if (!urls.includes(href)) urls.push(href);
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
      $('h1.job-title, h1.entry-title, h1.titre, h1').first().text().trim();

    const company =
      $(
        '.company-name, .employeur, .entreprise, .employer, .nom-societe',
      )
        .first()
        .text()
        .trim();

    const description =
      $(
        '.job-description, .entry-content, .description, .contenu-offre, .job-content',
      )
        .first()
        .text()
        .trim() ||
      $('article, main').first().text().trim();

    const locationText =
      $('.location, .lieu, .ville, .city, .localisation').first().text().trim();

    const contractTypeText =
      $('.contract-type, .type-contrat, .contrat, .job-type').first().text().trim();

    const dateText =
      $('time, .date, .date-publication, .published-date, .entry-date')
        .first()
        .text()
        .trim();

    const sectorText =
      $('.sector, .secteur, .domaine, .categorie').first().text().trim();

    const salaryText =
      $('.salary, .salaire, .remuneration').first().text().trim();

    const logoEl = $('img.company-logo, .employer-logo img, img.logo').first();
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
