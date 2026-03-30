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

  /** Stop after this many listing pages per run. */
  protected readonly MAX_PAGES = 15;

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
        try {
          const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          const u = new URL(absolute);
          if (!['www.emploidakar.com', 'emploidakar.com'].includes(u.hostname)) return;
          if (!urls.includes(absolute)) urls.push(absolute);
        } catch {
          // skip malformed hrefs
        }
      },
    );

    // Fallback: scan all anchors for job-detail URLs only
    // Job detail pattern: /offre-demploi/<slug>/ (singular, no query params)
    if (urls.length === 0) {
      $('a[href]').each((_i, el) => {
        const href = $(el).attr('href') ?? '';
        if (!href.includes('/offre-demploi/')) return; // must be detail page (singular)
        if (href.includes('?') || href.includes('#')) return; // skip share buttons / anchors
        try {
          const absolute = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
          const u = new URL(absolute);
          // Only emploidakar.com URLs
          if (!['www.emploidakar.com', 'emploidakar.com'].includes(u.hostname)) return;
          if (!urls.includes(absolute)) urls.push(absolute);
        } catch {
          // skip malformed hrefs (e.g. whatsapp:// concatenated with baseUrl)
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
      $('h1.job-title, h1.titre-offre, h1.entry-title, .job-title h1, h2.title, h1.entry-title, .job_listing-title h1').first().text().trim() ||
      $('h1').first().text().trim();

    const company =
      $('.entreprise, .company-name, .nom-entreprise, .employer-name, .job-company, .company, .listing-company, [itemprop="hiringOrganization"]').first().text().trim();

    const description =
      $('.description, .job-description, .contenu-offre, .entry-content, .job_listing-description, .single-job-content').first().text().trim() ||
      $('article').first().text().trim();

    const locationText =
      $('.lieu, .location, .ville, .localisation, .job-location, [itemprop="jobLocation"]').first().text().trim();

    const contractTypeText =
      $('.type-contrat, .contract-type, .contrat, .job-type').first().text().trim();

    const dateText =
      $('.date, .date-publication, .date-offre, time[datetime], time').first().attr('datetime') ||
      $('.date, .date-publication, .date-offre, time').first().text().trim();

    const logoEl = $('img.logo-entreprise, .company-logo img, .logo img').first();
    const logoSrc = logoEl.attr('src') ?? logoEl.attr('data-src');

    // URL-based fallback: slug format is /offre-demploi/company-city-contract-jobtitle/
    // e.g. /offre-demploi/orange-senegal-dakar-cdi-developpeur-react/
    let resolvedTitle = title;
    let resolvedCompany = company;

    if (!resolvedTitle || !resolvedCompany) {
      const slug = url.split('/offre-demploi/')[1]?.replace(/\/$/, '') ?? '';
      const parts = slug.split('-');
      if (parts.length >= 4) {
        // Heuristic: detect contract type position to split company from job title
        const contractIndex = parts.findIndex((p) =>
          /^(cdi|cdd|stage|freelance|alternance|interim|prestation)$/i.test(p),
        );
        if (contractIndex > 0) {
          if (!resolvedCompany) {
            resolvedCompany = parts
              .slice(0, contractIndex - 1) // skip city (last part before contract)
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' ');
          }
          if (!resolvedTitle) {
            resolvedTitle = parts
              .slice(contractIndex + 1)
              .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
              .join(' ');
          }
        } else if (!resolvedTitle) {
          resolvedTitle = parts
            .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
            .join(' ');
        }
      }
    }

    if (!resolvedTitle || !resolvedCompany) {
      this.logger.warn(`[${this.platform}] Skipping ${url} — missing title or company`);
      return null;
    }

    const jobType = this.detectJobType(contractTypeText || resolvedTitle || description);
    const publishedAt = this.parseDate(dateText);
    const companyLogoUrl = logoSrc
      ? logoSrc.startsWith('http')
        ? logoSrc
        : `${this.baseUrl}${logoSrc}`
      : undefined;

    return {
      title: resolvedTitle,
      company: resolvedCompany,
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
