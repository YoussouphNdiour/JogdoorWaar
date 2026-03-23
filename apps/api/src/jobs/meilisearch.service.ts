import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import MeiliSearch, { Index, SearchParams } from 'meilisearch';
import { JobFiltersDto } from './dto/job-filters.dto';

/**
 * Thin wrapper around the Meilisearch 'jobs' index.
 *
 * Responsible for:
 *  - Index configuration (searchable/filterable/sortable attributes)
 *  - Full-text search with optional Prisma-style filters
 *  - Document ingestion and deletion (called by the scraping pipeline)
 */
@Injectable()
export class MeilisearchService implements OnModuleInit {
  private readonly logger = new Logger(MeilisearchService.name);
  private readonly client: MeiliSearch;
  private readonly index: Index;

  constructor(private readonly config: ConfigService) {
    this.client = new MeiliSearch({
      host: this.config.get<string>('MEILISEARCH_URL', 'http://localhost:7700'),
      apiKey: this.config.get<string>('MEILISEARCH_API_KEY', 'masterKey_dev'),
    });
    this.index = this.client.index('jobs');
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.setupIndex();
    } catch (err) {
      // Non-fatal: Meilisearch may be unavailable during cold start
      this.logger.warn(
        `Meilisearch index setup skipped: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Configure the 'jobs' index with the correct attribute policies.
   * This is idempotent — safe to call on every startup.
   */
  async setupIndex(): Promise<void> {
    // Ensure the index exists with the correct primary key
    await this.client.createIndex('jobs', { primaryKey: 'id' }).catch(() => {
      // Index already exists — ignore the conflict error
    });

    const tasks = await Promise.all([
      this.index.updateSearchableAttributes([
        'title',
        'company',
        'description',
        'descriptionShort',
        'requiredSkills',
        'preferredSkills',
        'sector',
        'category',
        'city',
      ]),
      this.index.updateFilterableAttributes([
        'isActive',
        'jobType',
        'workMode',
        'sector',
        'city',
        'country',
        'sourcePlatform',
        'isPremium',
        'salaryMin',
        'salaryMax',
        'yearsExperienceMin',
        'publishedAtTimestamp', // Unix timestamp for date range filters
      ]),
      this.index.updateSortableAttributes([
        'publishedAtTimestamp',
        'salaryMin',
        'salaryMax',
        'viewCount',
      ]),
      this.index.updateRankingRules([
        'words',
        'typo',
        'proximity',
        'attribute',
        'sort',
        'exactness',
      ]),
    ]);

    this.logger.log(
      `Meilisearch index configured (taskUids: ${tasks.map((t) => t.taskUid).join(', ')})`,
    );
  }

  /**
   * Full-text search against the jobs index.
   * Converts JobFiltersDto into a Meilisearch filter string.
   */
  async search(q: string, filters?: Partial<JobFiltersDto>): Promise<unknown[]> {
    const filterClauses: string[] = ['isActive = true'];

    if (filters?.jobType?.length) {
      const quoted = filters.jobType.map((t) => `"${t}"`).join(', ');
      filterClauses.push(`jobType IN [${quoted}]`);
    }

    if (filters?.workMode?.length) {
      const quoted = filters.workMode.map((m) => `"${m}"`).join(', ');
      filterClauses.push(`workMode IN [${quoted}]`);
    }

    if (filters?.sector?.length) {
      const quoted = filters.sector.map((s) => `"${s}"`).join(', ');
      filterClauses.push(`sector IN [${quoted}]`);
    }

    if (filters?.source?.length) {
      const quoted = filters.source.map((s) => `"${s}"`).join(', ');
      filterClauses.push(`sourcePlatform IN [${quoted}]`);
    }

    if (filters?.location) {
      filterClauses.push(`city = "${filters.location}"`);
    }

    if (filters?.salaryMin != null) {
      filterClauses.push(`salaryMax >= ${filters.salaryMin}`);
    }

    if (filters?.salaryMax != null) {
      filterClauses.push(`salaryMin <= ${filters.salaryMax}`);
    }

    if (filters?.yearsExp != null) {
      filterClauses.push(`yearsExperienceMin <= ${filters.yearsExp}`);
    }

    if (filters?.publishedAfter) {
      const cutoff = this.publishedAfterToTimestamp(filters.publishedAfter);
      filterClauses.push(`publishedAtTimestamp >= ${cutoff}`);
    }

    const sort = this.buildSort(filters?.sortBy);

    const params: SearchParams = {
      filter: filterClauses.join(' AND '),
      limit: filters?.limit ?? 20,
      offset: ((filters?.page ?? 1) - 1) * (filters?.limit ?? 20),
      sort,
    };

    const result = await this.index.search(q, params);
    return result.hits;
  }

  /**
   * Index (or update) a batch of job documents.
   * Each document must include a numeric/string `id` (primaryKey) and
   * a `publishedAtTimestamp` (Unix seconds) for date-range filters.
   */
  async addDocuments(jobs: Record<string, unknown>[]): Promise<void> {
    if (!jobs.length) return;
    const task = await this.index.addDocuments(jobs, { primaryKey: 'id' });
    this.logger.debug(`Indexed ${jobs.length} job(s) — taskUid: ${task.taskUid}`);
  }

  /**
   * Remove a single job document from the index by its id.
   */
  async deleteDocument(id: string): Promise<void> {
    const task = await this.index.deleteDocument(id);
    this.logger.debug(`Deleted job ${id} from index — taskUid: ${task.taskUid}`);
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private publishedAfterToTimestamp(
    range: 'last24h' | 'lastWeek' | 'lastMonth',
  ): number {
    const now = Date.now();
    const offsets: Record<typeof range, number> = {
      last24h: 24 * 60 * 60 * 1000,
      lastWeek: 7 * 24 * 60 * 60 * 1000,
      lastMonth: 30 * 24 * 60 * 60 * 1000,
    };
    return Math.floor((now - offsets[range]) / 1000);
  }

  private buildSort(
    sortBy?: 'relevance' | 'date' | 'salary' | 'matchScore',
  ): string[] | undefined {
    switch (sortBy) {
      case 'date':
        return ['publishedAtTimestamp:desc'];
      case 'salary':
        return ['salaryMax:desc'];
      default:
        return undefined; // Meilisearch default relevance ranking
    }
  }
}
