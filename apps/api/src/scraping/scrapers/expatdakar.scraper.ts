import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { SourcePlatform } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DeduplicationService } from '../deduplication.service';
import { RawJob } from '../interfaces/raw-job.interface';
import { BaseScraper } from './base.scraper';

/**
 * ExpatDakarScraper
 *
 * Target : https://www.expat-dakar.com/emploi
 * Pagination : query param ?o=0, ?o=20, ?o=40 … (20 results per page)
 * Max pages   : 3
 */
@Injectable()
export class ExpatDakarScraper extends BaseScraper {
  protected readonly platform = SourcePlatform.EXPAT_DAKAR;
  protected readonly baseUrl = 'https://www.expat-dakar.com';
  protected readonly logger = new Logger(ExpatDakarScraper.name);

  protected readonly MAX_PAGES = 3;

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  // ─── fetchJobUrls ────────────────────────────────────────────────────────────

  protected async fetchJobUrls(page: number): Promise<string[]> {
    if (page >= this.MAX_PAGES) {
      return [];
    }

    const listUrl = `${this.baseUrl}/emploi?page=${page + 1}`;

    this.logger.debug(`Fetching listing page ${page + 1}: ${listUrl}`);

    let html: string;
    try {
      html = await this.fetchHtml(listUrl);
    } catch (err) {
      this.logger.error(`Failed to fetch listing page ${page + 1}`, err);
      return [];
    }

    const $ = cheerio.load(html);
    const urls: string[] = [];

    // Primary selectors for expat-dakar.com listing cards
    $('a.listing-card[href], .ann-desc a[href], .listing-card__title a[href]').each(
      (_i, el) => {
        const href = $(el).attr('href');
        if (!href) return;
        const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
        if (!urls.includes(absolute)) urls.push(absolute);
      },
    );

    // Fallback: anchors that look like individual listings (/annonce/...)
    if (urls.length === 0) {
      $('a[href]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (href.includes('/annonce/')) {
          const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          if (!urls.includes(absolute)) urls.push(absolute);
        }
      });
    }

    this.logger.debug(`[${this.platform}] Page ${page + 1} — found ${urls.length} URLs`);
    return urls;
  }

  // ─── parseJobDetail ──────────────────────────────────────────────────────────

  protected async parseJobDetail(html: string, url: string): Promise<RawJob | null> {
    const $ = cheerio.load(html);

    const title =
      $('h1.ann-title, h1.listing-card__title, h1.detail-title, h1').first().text().trim();

    const company =
      $(
        '.listing-card__info .company, .ann-info .company, .detail-info .company, .ann-owner, .owner',
      )
        .first()
        .text()
        .trim() ||
      $('.listing-card__info').first().text().trim().split('\n')[0];

    const description =
      $('.ann-desc .content, .listing-description, .detail-desc, .description, .ann-content')
        .first()
        .text()
        .trim() ||
      $('article, .content-detail').first().text().trim();

    const locationText =
      $('.ann-location, .listing-card__location, .location, .ville').first().text().trim();

    const contractTypeText =
      $('.contract-type, .ann-contract, .type-contrat, .contrat').first().text().trim();

    const dateText =
      $('time, .ann-date, .listing-card__date, .date-publication, .date')
        .first()
        .text()
        .trim();

    const logoEl = $(
      'img.company-logo, .ann-logo img, .listing-card__logo img, img.logo',
    ).first();
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
