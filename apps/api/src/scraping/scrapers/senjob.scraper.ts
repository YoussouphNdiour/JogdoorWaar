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
  // Site migrated from www.senjob.com/emploi → senjob.com/sn/offres-d-emploi.php
  protected readonly baseUrl = 'https://senjob.com/sn';
  protected readonly logger = new Logger(SenjobScraper.name);

  /** BullMQ cron schedule — every 2 hours */
  static readonly cronSchedule = '0 */2 * * *';

  protected readonly MAX_PAGES = 8;

  constructor(prisma: PrismaService, deduplication: DeduplicationService) {
    super(prisma, deduplication);
  }

  // ─── fetchJobUrls ────────────────────────────────────────────────────────────

  protected async fetchJobUrls(page: number): Promise<string[]> {
    if (page >= this.MAX_PAGES) return [];

    const pageParam = page + 1;
    const listUrl = `${this.baseUrl}/offres-d-emploi.php?page=${pageParam}`;

    this.logger.debug(`Fetching listing page ${pageParam}: ${listUrl}`);

    let html: string;
    try {
      html = await this.fetchHtml(listUrl);
    } catch (err) {
      this.logger.error(`Failed to fetch listing page ${pageParam}`);
      return [];
    }

    const $ = cheerio.load(html);
    const urls: string[] = [];

    // senjob.com/sn: job links follow pattern /sn/jobseekers/slug_e_ID.html
    $('a[href*="/jobseekers/"]').each((_i, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const absolute = href.startsWith('http') ? href : `https://senjob.com${href}`;
      if (!urls.includes(absolute)) urls.push(absolute);
    });

    this.logger.debug(`[${this.platform}] Page ${pageParam} — found ${urls.length} URLs`);
    return urls;
  }

  // ─── parseJobDetail ──────────────────────────────────────────────────────────

  protected async parseJobDetail(html: string, url: string): Promise<RawJob | null> {
    const $ = cheerio.load(html);

    // senjob.com/sn uses a table-based detail page
    const title =
      $('h1, h2.titre-offre, .titre-poste, td:contains("Intitulé") + td').first().text().trim() ||
      $('title').text().replace(' - Senjob', '').trim();

    const company =
      $('td:contains("Entreprise") + td, .nom-entreprise, .company-name').first().text().trim() ||
      $('.recruteur, .employer').first().text().trim();

    const description =
      $('.description-offre, .contenu-offre, td.description, #description').first().text().trim() ||
      $('table').last().text().trim();

    const locationText =
      $('td:contains("Lieu") + td, td:contains("Ville") + td, .ville, .location').first().text().trim();

    const contractTypeText =
      $('td:contains("Type de contrat") + td, td:contains("Contrat") + td, .type-contrat').first().text().trim();

    const dateText =
      $('td:contains("Date") + td, .date-publication, time').first().text().trim();

    const sectorText =
      $('td:contains("Secteur") + td, td:contains("Domaine") + td, .secteur').first().text().trim();

    const salaryText =
      $('td:contains("Salaire") + td, .salaire, .remuneration').first().text().trim();

    const logoEl = $('img.logo, .company-logo img, .employer-logo img, img[src*="logo"]').first();
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
        : `https://senjob.com${logoSrc}`
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
