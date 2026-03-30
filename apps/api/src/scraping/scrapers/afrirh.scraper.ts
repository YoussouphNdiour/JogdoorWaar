import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourcePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';

/**
 * AfriRhScraper
 *
 * Target : https://www.afrirh.com/offres-emploi
 * Pagination : query param ?page=N (1-indexed)
 * Max pages   : 3
 */
@Injectable()
export class AfriRhScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.AFRIRH;
  protected readonly baseUrl = 'https://www.afrirh.com';
  protected readonly logger = new Logger(AfriRhScraper.name);

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
        ? `${this.baseUrl}/offres-emploi`
        : `${this.baseUrl}/offres-emploi?page=${pageParam}`;

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

    // Primary selectors for afrirh.com
    $(
      '.offre-emploi a[href], .job-item a[href], .job-listing a[href], h3.titre-poste a[href], h3.job-title a[href]',
    ).each((_i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      if (!urls.includes(absolute)) urls.push(absolute);
    });

    // Fallback: anchors containing /offre-emploi/ or /offre/
    if (urls.length === 0) {
      $('a[href]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (
          (href.includes('/offre-emploi/') || href.includes('/offre/')) &&
          href !== `${this.baseUrl}/offres-emploi`
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
      $('h1.titre-poste, h1.job-title, h1.titre, h1').first().text().trim();

    const company =
      $(
        '.entreprise, .company, .nom-entreprise, .employer-name, .recruteur',
      )
        .first()
        .text()
        .trim();

    const description =
      $(
        '.description-poste, .job-description, .description, .contenu-offre, .entry-content',
      )
        .first()
        .text()
        .trim() ||
      $('article, .content').first().text().trim();

    const locationText =
      $('.localisation, .location, .lieu, .ville, .city').first().text().trim();

    const contractTypeText =
      $('.type-contrat, .contract-type, .contrat, .job-type').first().text().trim();

    const dateText =
      $('time, .date-publication, .date, .posted-date').first().text().trim();

    const sectorText =
      $('.secteur, .sector, .domaine, .categorie').first().text().trim();

    const salaryText =
      $('.salaire, .salary, .remuneration').first().text().trim();

    const logoEl = $('img.logo-entreprise, .company-logo img, img.logo').first();
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
