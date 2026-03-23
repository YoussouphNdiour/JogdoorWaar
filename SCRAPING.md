# SCRAPING.md — Architecture Scrapers Jog Door Waar

## Architecture

Chaque scraper = **BullMQ Worker** isolé. Le CRON trigger BullMQ, BullMQ trigger les workers.

```
CRON (@nestjs/schedule)
  → BullMQ Queue "scraping"
    → Worker emploisenegal (toutes les 2h)
    → Worker emploidakar (toutes les 2h)
    → Worker senjob (toutes les 2h)
    → Worker linkedin (toutes les 4h)
    → Worker facebook (toutes les 6h)
    → ... (10 workers au total)
  → DeduplicationService (hash + vector)
  → NormalizationService (IA résumé + embedding)
  → MeilisearchService (index full-text)
  → MatchingQueueService (calculer scores pour alertes actives)
```

## Base Scraper

```typescript
// src/scraping/scrapers/base.scraper.ts
export abstract class BaseScraper {
  abstract readonly platform: SourcePlatform;
  abstract readonly baseUrl: string;
  abstract readonly cronSchedule: string;

  abstract fetchJobUrls(page: number): Promise<string[]>;
  abstract parseJobDetail(html: string, url: string): Promise<RawJob | null>;

  protected async scrapeAll(): Promise<void> {
    let page = 1;
    let consecutiveOldPages = 0;

    while (consecutiveOldPages < 2) {
      const urls = await this.fetchJobUrls(page);
      if (!urls.length) break;

      const jobs: RawJob[] = [];
      for (const url of urls) {
        try {
          await sleep(randomBetween(2000, 5000)); // respecter le serveur
          const html = await this.fetchHtml(url);
          const job = await this.parseJobDetail(html, url);
          if (job) jobs.push(job);
        } catch (e) { this.logger.warn(`Failed ${url}: ${e}`); }
      }

      // Vérifier fraîcheur
      const oldCount = jobs.filter(j => dayjs().diff(j.publishedAt, 'day') > 7).length;
      if (oldCount > jobs.length * 0.7) consecutiveOldPages++;
      else consecutiveOldPages = 0;

      await this.processJobs(jobs);
      page++;
    }
  }

  private async processJobs(rawJobs: RawJob[]): Promise<void> {
    for (const raw of rawJobs) {
      const isDup = await this.deduplicationService.isDuplicate(raw);
      if (isDup) continue;

      const descriptionShort = await this.aiService.summarizeJob('new', raw.description);
      const embedding = await this.embeddingService.embed(`${raw.title} ${raw.description}`);
      const fingerprint = this.generateFingerprint(raw);

      await this.prisma.job.create({
        data: { ...raw, descriptionShort, embedding, fingerprint }
      });

      await this.meilisearch.addDocuments([{ id: raw.sourceUrl, ...raw, descriptionShort }]);
    }
  }

  protected generateFingerprint(job: RawJob): string {
    return createHash('sha256').update(`${job.title}|${job.company}|${dayjs(job.publishedAt).format('YYYY-MM-DD')}`).digest('hex');
  }

  protected async fetchHtml(url: string): Promise<string> {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'JogDoorWaar-Bot/1.0 (+https://jogdoorwaar.com/bot)' }
    });
    return res.text();
  }
}
```

## Déduplication à 3 niveaux

```typescript
// src/scraping/deduplication.service.ts
async isDuplicate(job: RawJob): Promise<boolean> {
  // Niveau 1 : URL exacte
  const byUrl = await this.prisma.job.findUnique({ where: { sourceUrl: job.sourceUrl } });
  if (byUrl) return true;

  // Niveau 2 : Fingerprint (titre + entreprise + date)
  const byFingerprint = await this.prisma.job.findUnique({ where: { fingerprint: job.fingerprint } });
  if (byFingerprint) return true;

  // Niveau 3 : Similarité vectorielle > 95% (même offre reformulée)
  if (job.embedding) {
    const similar = await this.prisma.$queryRaw<[{id:string}]>`
      SELECT id FROM jobs
      WHERE embedding <=> ${job.embedding}::vector < 0.05
      AND "publishedAt" > NOW() - INTERVAL '30 days'
      LIMIT 1
    `;
    if (similar.length > 0) return true;
  }

  return false;
}
```

## Implémentation : emploisenegal.com

```typescript
// src/scraping/scrapers/emploisenegal.scraper.ts
@Injectable()
export class EmploiSenegalScraper extends BaseScraper {
  readonly platform = SourcePlatform.EMPLOI_SENEGAL;
  readonly baseUrl = 'https://www.emploisenegal.com';
  readonly cronSchedule = '0 */2 * * *';

  async fetchJobUrls(page: number): Promise<string[]> {
    const html = await this.fetchHtml(`${this.baseUrl}/offres?page=${page}`);
    const $ = cheerio.load(html);
    const urls: string[] = [];
    $('.job-listing a[href]').each((_, el) => {
      const href = $(el).attr('href');
      if (href) urls.push(href.startsWith('http') ? href : `${this.baseUrl}${href}`);
    });
    return urls;
  }

  async parseJobDetail(html: string, url: string): Promise<RawJob | null> {
    const $ = cheerio.load(html);
    const title = $('.job-title, h1.title').first().text().trim();
    const company = $('.company-name, .employer').first().text().trim();
    if (!title || !company) return null;

    return {
      title, company,
      description: $('.job-description, .description').text().trim(),
      city: $('.location, .ville').first().text().trim() || 'Dakar',
      jobType: this.detectJobType($('.contract-type').text()),
      publishedAt: parseDate($('.date-publication, .date').first().text()),
      sourceUrl: url,
      sourcePlatform: this.platform,
    };
  }
}
```

## Implémentation : LinkedIn (Playwright)

```typescript
// src/scraping/scrapers/linkedin.scraper.ts
@Injectable()
export class LinkedInScraper extends BaseScraper {
  readonly platform = SourcePlatform.LINKEDIN;
  readonly baseUrl = 'https://www.linkedin.com/jobs/search';
  readonly cronSchedule = '0 */4 * * *';

  async fetchJobUrls(page: number): Promise<string[]> {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ userAgent: 'Mozilla/5.0...' });
    const p = await context.newPage();

    await p.goto(`${this.baseUrl}/?location=senegal&start=${page * 25}`);
    await p.waitForSelector('.job-card-container', { timeout: 10000 });

    const urls = await p.$$eval('.job-card-container a', els => els.map(el => el.href));
    await browser.close();
    return urls;
  }

  async parseJobDetail(html: string, url: string): Promise<RawJob | null> {
    const $ = cheerio.load(html);
    return {
      title: $('h1.job-title').text().trim(),
      company: $('a.topcard__org-name-link').text().trim(),
      description: $('.show-more-less-html__markup').text().trim(),
      city: $('.topcard__flavor--bullet').first().text().trim(),
      jobType: this.detectJobType($('.job-criteria-item__text').eq(0).text()),
      publishedAt: new Date(),
      sourceUrl: url,
      sourcePlatform: this.platform,
    };
  }
}
```

## Tableau des scrapers

| Plateforme | Méthode | Fréquence | Priorité |
|---|---|---|---|
| emploisenegal.com | Cheerio | 2h | 1 |
| emploidakar.com | Cheerio | 2h | 1 |
| senjob.com | Cheerio | 2h | 1 |
| expat-dakar.com | Cheerio | 3h | 2 |
| senejobs.com | Cheerio | 2h | 2 |
| afrirh.com | Cheerio | 3h | 2 |
| emploi-sen.com | Cheerio | 3h | 2 |
| seninterim.sn | Playwright | 4h | 3 |
| senrh.sn | Cheerio | 3h | 3 |
| linkedin.com | Playwright | 4h | 1 |
| facebook groups | Playwright + Vision IA | 6h | 4 |

## Éthique du scraping

```
✅ User-Agent identifiable : "JogDoorWaar-Bot/1.0 (+https://jogdoorwaar.com/bot)"
✅ Vérifier robots.txt avant scraping
✅ Délai aléatoire 2-5 secondes entre requêtes
✅ Données publiques uniquement
✅ Proposer partenariat API officiel à chaque plateforme
✅ Rotation IP si nécessaire (proxy résidentiel Bright Data)
✅ Logs d'accès transparents, arrêt immédiat si plainte reçue
```

## CRON configuration

```typescript
// src/scraping/scraping.module.ts
@Module({})
export class ScrapingModule {
  @Cron('0 */2 * * *') async runFastScrapers() {
    await this.queue.addBulk([
      { name: 'scrape', data: { platform: 'EMPLOI_SENEGAL' } },
      { name: 'scrape', data: { platform: 'EMPLOI_DAKAR' } },
      { name: 'scrape', data: { platform: 'SENJOB' } },
      { name: 'scrape', data: { platform: 'SENEJOBS' } },
    ]);
  }

  @Cron('0 */3 * * *') async runMediumScrapers() {
    await this.queue.addBulk([
      { name: 'scrape', data: { platform: 'EXPAT_DAKAR' } },
      { name: 'scrape', data: { platform: 'AFRIRH' } },
      { name: 'scrape', data: { platform: 'EMPLOI_SEN' } },
      { name: 'scrape', data: { platform: 'SENRH' } },
    ]);
  }

  @Cron('0 */4 * * *') async runSlowScrapers() {
    await this.queue.addBulk([
      { name: 'scrape', data: { platform: 'LINKEDIN' } },
      { name: 'scrape', data: { platform: 'SENINTERIM' } },
    ]);
  }

  @Cron('0 */6 * * *') async runSocialScrapers() {
    await this.queue.add('scrape', { platform: 'FACEBOOK' });
  }
}
```
