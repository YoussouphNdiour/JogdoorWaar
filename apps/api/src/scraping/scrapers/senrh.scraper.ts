import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourcePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';

/**
 * SenRhScraper
 *
 * Target : https://www.senrh.sn/offres-emploi
 * Pagination : query param ?page=N (1-indexed)
 * Max pages   : 2
 */
@Injectable()
export class SenRhScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.SENRH;
  protected readonly baseUrl = 'https://www.senrh.sn';
  protected readonly logger = new Logger(SenRhScraper.name);

  protected readonly MAX_PAGES = 2;

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

    // Primary selectors for senrh.sn
    $(
      '.offre a[href], .job-card a[href], .job-listing a[href], .titre a[href], h3 a[href]',
    ).each((_i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      if (!urls.includes(absolute)) urls.push(absolute);
    });

    // Fallback: any internal link that looks like a job detail
    if (urls.length === 0) {
      $('a[href]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (
          (href.includes('/offre') || href.includes('/emploi/')) &&
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
      $('h1.titre, h1.job-title, h1.titre-poste, h1').first().text().trim();

    const company =
      $(
        '.societe, .company, .entreprise, .nom-entreprise, .employer',
      )
        .first()
        .text()
        .trim();

    const description =
      $(
        '.description-poste, .job-description, .description, .contenu, .entry-content',
      )
        .first()
        .text()
        .trim() ||
      $('article, main').first().text().trim();

    const locationText =
      $('.localisation, .location, .lieu, .ville, .city').first().text().trim();

    const contractTypeText =
      $('.type-contrat, .contract-type, .contrat, .job-type').first().text().trim();

    const dateText =
      $('time, .date, .date-publication, .published-date').first().text().trim();

    const sectorText =
      $('.secteur, .sector, .domaine, .categorie').first().text().trim();

    const salaryText =
      $('.salaire, .salary, .remuneration').first().text().trim();

    const logoEl = $('img.logo-societe, .company-logo img, img.logo').first();
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
