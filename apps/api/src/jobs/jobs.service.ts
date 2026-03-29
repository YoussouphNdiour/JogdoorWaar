import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MeilisearchService } from './meilisearch.service';
import { JobFiltersDto } from './dto/job-filters.dto';
import { PaginatedResponse } from './interfaces/paginated-response.interface';
import { JobListItem } from './interfaces/job-list-item.interface';
import { JobDetail } from './interfaces/job-detail.interface';
import { Prisma } from '@prisma/client';

// ─── Prisma result types (inlined to avoid circular references) ───────────────

/** Columns returned for list views — avoids fetching the large description + embedding */
const JOB_LIST_SELECT = {
  id: true,
  title: true,
  company: true,
  companyLogoUrl: true,
  descriptionShort: true,
  city: true,
  country: true,
  isRemote: true,
  workMode: true,
  jobType: true,
  sector: true,
  salaryMin: true,
  salaryMax: true,
  salaryRaw: true,
  yearsExperienceMin: true,
  requiredSkills: true,
  sourcePlatform: true,
  sourceUrl: true,
  publishedAt: true,
  isActive: true,
  isPremium: true,
  viewCount: true,
} satisfies Prisma.JobSelect;

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly meilisearch: MeilisearchService,
  ) {}

  // ─── findAll ──────────────────────────────────────────────────────────────

  async findAll(
    filters: JobFiltersDto,
    userId?: string,
  ): Promise<PaginatedResponse<JobListItem>> {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(filters);

    const orderBy = this.buildOrderBy(filters.sortBy, userId);

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        select: JOB_LIST_SELECT,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.job.count({ where }),
    ]);

    let savedJobIds = new Set<string>();
    let matchScoreMap = new Map<string, number>();

    if (userId) {
      const jobIds = jobs.map((j) => j.id);

      const [savedJobs, matchScores] = await Promise.all([
        this.prisma.savedJob.findMany({
          where: { userId, jobId: { in: jobIds } },
          select: { jobId: true },
        }),
        this.prisma.matchScore.findMany({
          where: { userId, jobId: { in: jobIds } },
          select: { jobId: true, score: true },
        }),
      ]);

      savedJobIds = new Set(savedJobs.map((s) => s.jobId));
      matchScoreMap = new Map(matchScores.map((m) => [m.jobId, m.score]));
    }

    const data: JobListItem[] = jobs.map((job) => ({
      ...job,
      ...(userId !== undefined && {
        isSaved: savedJobIds.has(job.id),
        matchScore: matchScoreMap.get(job.id) ?? null,
      }),
    }));

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── findRecommended ──────────────────────────────────────────────────────

  async findRecommended(userId: string): Promise<JobListItem[]> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const topScores = await this.prisma.matchScore.findMany({
      where: {
        userId,
        job: {
          isActive: true,
          publishedAt: { gte: cutoff },
        },
      },
      orderBy: { score: 'desc' },
      take: 10,
      select: {
        score: true,
        jobId: true,
        job: { select: JOB_LIST_SELECT },
      },
    });

    if (!topScores.length) return [];

    const savedJobIds = new Set(
      (
        await this.prisma.savedJob.findMany({
          where: {
            userId,
            jobId: { in: topScores.map((s) => s.jobId) },
          },
          select: { jobId: true },
        })
      ).map((s) => s.jobId),
    );

    return topScores.map(({ job, score, jobId }) => ({
      ...job,
      isSaved: savedJobIds.has(jobId),
      matchScore: score,
    }));
  }

  // ─── search ───────────────────────────────────────────────────────────────

  async search(
    q: string,
    filters?: Partial<JobFiltersDto>,
  ): Promise<JobListItem[]> {
    const hits = await this.meilisearch.search(q, filters);
    // Hits already contain the projection we configured during index setup
    return hits as JobListItem[];
  }

  // ─── findById ─────────────────────────────────────────────────────────────

  async findById(id: string, userId?: string): Promise<JobDetail> {
    const job = await this.prisma.job.findUnique({
      where: { id },
    });

    if (!job) {
      throw new NotFoundException(`Job ${id} not found`);
    }

    // Atomically increment viewCount
    await this.prisma.job.update({
      where: { id },
      data: { viewCount: { increment: 1 } },
    });

    let isSaved: boolean | undefined;
    let matchScore: number | null | undefined;

    if (userId) {
      const [savedJob, match] = await Promise.all([
        this.prisma.savedJob.findUnique({
          where: { userId_jobId: { userId, jobId: id } },
          select: { id: true },
        }),
        this.prisma.matchScore.findUnique({
          where: { userId_jobId: { userId, jobId: id } },
          select: { score: true },
        }),
      ]);

      isSaved = !!savedJob;
      matchScore = match?.score ?? null;
    }

    // Strip the pgvector field Prisma omits from generated types (Unsupported)
    const { embedding: _embedding, ...rest } = job as typeof job & { embedding?: unknown };

    return {
      ...rest,
      ...(userId !== undefined && { isSaved, matchScore }),
    };
  }

  // ─── findSimilar ──────────────────────────────────────────────────────────

  async findSimilar(jobId: string): Promise<JobListItem[]> {
    // Verify the job exists first
    const exists = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true },
    });

    if (!exists) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // pgvector cosine similarity — finds 5 nearest neighbours
    const rows = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        company: string;
        company_logo_url: string | null;
        description_short: string | null;
        city: string | null;
        country: string;
        is_remote: boolean;
        work_mode: string;
        job_type: string;
        sector: string | null;
        salary_min: number | null;
        salary_max: number | null;
        salary_raw: string | null;
        years_experience_min: number | null;
        required_skills: string[];
        source_platform: string;
        source_url: string;
        published_at: Date;
        is_active: boolean;
        is_premium: boolean;
        view_count: number;
      }>
    >`
      SELECT
        j.id,
        j.title,
        j.company,
        j."companyLogoUrl"     AS company_logo_url,
        j."descriptionShort"   AS description_short,
        j.city,
        j.country,
        j."isRemote"           AS is_remote,
        j."workMode"           AS work_mode,
        j."jobType"            AS job_type,
        j.sector,
        j."salaryMin"          AS salary_min,
        j."salaryMax"          AS salary_max,
        j."salaryRaw"          AS salary_raw,
        j."yearsExperienceMin" AS years_experience_min,
        j."requiredSkills"     AS required_skills,
        j."sourcePlatform"     AS source_platform,
        j."sourceUrl"          AS source_url,
        j."publishedAt"        AS published_at,
        j."isActive"           AS is_active,
        j."isPremium"          AS is_premium,
        j."viewCount"          AS view_count
      FROM "Job" j
      WHERE
        j.id != ${jobId}
        AND j."isActive" = true
        AND j.embedding IS NOT NULL
      ORDER BY
        j.embedding <=> (
          SELECT embedding FROM "Job" WHERE id = ${jobId}
        )
      LIMIT 5
    `;

    // Map snake_case raw columns back to camelCase interface
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      company: r.company,
      companyLogoUrl: r.company_logo_url,
      descriptionShort: r.description_short,
      city: r.city,
      country: r.country,
      isRemote: r.is_remote,
      workMode: r.work_mode as JobListItem['workMode'],
      jobType: r.job_type as JobListItem['jobType'],
      sector: r.sector,
      salaryMin: r.salary_min,
      salaryMax: r.salary_max,
      salaryRaw: r.salary_raw,
      yearsExperienceMin: r.years_experience_min,
      requiredSkills: r.required_skills,
      sourcePlatform: r.source_platform as JobListItem['sourcePlatform'],
      sourceUrl: r.source_url,
      publishedAt: r.published_at,
      isActive: r.is_active,
      isPremium: r.is_premium,
      viewCount: r.view_count,
    }));
  }

  // ─── saveJob / unsaveJob / findSaved ─────────────────────────────────────

  async saveJob(userId: string, jobId: string): Promise<void> {
    await this.prisma.savedJob.upsert({
      where: { userId_jobId: { userId, jobId } },
      create: { userId, jobId },
      update: {}, // Already saved — no-op
    });
  }

  async unsaveJob(userId: string, jobId: string): Promise<void> {
    await this.prisma.savedJob
      .delete({
        where: { userId_jobId: { userId, jobId } },
      })
      .catch(() => {
        // Record may not exist — treat as idempotent success
      });
  }

  async findSaved(userId: string): Promise<JobListItem[]> {
    const savedJobs = await this.prisma.savedJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        jobId: true,
        job: { select: JOB_LIST_SELECT },
      },
    });

    return savedJobs.map(({ job, jobId }) => ({
      ...job,
      isSaved: true,
      matchScore: undefined,
      // jobId unused beyond lookup — omitted from return type intentionally
    }));
  }

  // ─── trackClick ───────────────────────────────────────────────────────────

  async trackClick(jobId: string): Promise<{ sourceUrl: string }> {
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { sourceUrl: true },
    });

    if (!job) {
      throw new NotFoundException(`Job ${jobId} not found`);
    }

    // Fire-and-forget atomic increment — do not await to keep response fast
    this.prisma.job
      .update({
        where: { id: jobId },
        data: { clickCount: { increment: 1 } },
      })
      .catch((err: Error) =>
        this.logger.warn(`clickCount increment failed for ${jobId}: ${err.message}`),
      );

    return { sourceUrl: job.sourceUrl };
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private buildWhereClause(filters: JobFiltersDto): Prisma.JobWhereInput {
    const where: Prisma.JobWhereInput = { isActive: true };

    if (filters.q) {
      where.OR = [
        { title: { contains: filters.q, mode: 'insensitive' } },
        { company: { contains: filters.q, mode: 'insensitive' } },
        { descriptionShort: { contains: filters.q, mode: 'insensitive' } },
        { sector: { contains: filters.q, mode: 'insensitive' } },
      ];
    }

    if (filters.location) {
      where.city = { contains: filters.location, mode: 'insensitive' };
    }

    if (filters.jobType?.length) {
      where.jobType = { in: filters.jobType };
    }

    if (filters.workMode?.length) {
      where.workMode = { in: filters.workMode };
    }

    if (filters.sector?.length) {
      where.sector = { in: filters.sector };
    }

    if (filters.source?.length) {
      where.sourcePlatform = { in: filters.source };
    }

    if (filters.salaryMin != null) {
      where.salaryMax = { gte: filters.salaryMin };
    }

    if (filters.salaryMax != null) {
      where.salaryMin = { lte: filters.salaryMax };
    }

    if (filters.yearsExp != null) {
      where.yearsExperienceMin = { lte: filters.yearsExp };
    }

    if (filters.publishedAfter) {
      const cutoff = new Date();
      const offsets: Record<NonNullable<typeof filters.publishedAfter>, number> = {
        last24h: 1,
        lastWeek: 7,
        lastMonth: 30,
      };
      cutoff.setDate(cutoff.getDate() - offsets[filters.publishedAfter]);
      where.publishedAt = { gte: cutoff };
    }

    return where;
  }

  private buildOrderBy(
    sortBy?: string,
    userId?: string,
  ): Prisma.JobOrderByWithRelationInput | Prisma.JobOrderByWithRelationInput[] {
    switch (sortBy) {
      case 'date':
        return { publishedAt: 'desc' };
      case 'salary':
        return [{ salaryMax: 'desc' }, { publishedAt: 'desc' }];
      case 'matchScore':
        // When userId is present, bias the DB fetch toward jobs that already
        // have a MatchScore record (highest count proxy). The real score-based
        // sort is applied in memory after the MatchScore map is built.
        if (userId) {
          return [
            { matchScores: { _count: 'desc' } },
            { publishedAt: 'desc' },
          ];
        }
        return { publishedAt: 'desc' };
      case 'relevance':
      default:
        return { publishedAt: 'desc' };
    }
  }

  // ─── findRecent ───────────────────────────────────────────────────────────

  private async findRecent(take: number): Promise<JobListItem[]> {
    const jobs = await this.prisma.job.findMany({
      where: { isActive: true },
      select: JOB_LIST_SELECT,
      orderBy: { publishedAt: 'desc' },
      take,
    });

    return jobs.map((job) => ({ ...job }));
  }

  // ─── findFeed ─────────────────────────────────────────────────────────────

  async findFeed(userId?: string): Promise<JobListItem[]> {
    // Anonymous visitors → 20 most recent active jobs
    if (!userId) {
      return this.findRecent(20);
    }

    // 1. Resolve the user's default CV (or first CV with an embedding).
    //    `embedding` is Unsupported("vector(512)") — Prisma omits it from WhereInput,
    //    so we filter for a non-null embedding in the pgvector query below instead.
    const cv = await this.prisma.userCV.findFirst({
      where: { userId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });

    // No CV with embedding → fall back to most recent jobs
    if (!cv) {
      this.logger.debug(
        `findFeed: user ${userId} has no CV with embedding — falling back to recent`,
      );
      return this.findRecent(20);
    }

    // 2. pgvector cosine similarity: compare CV embedding to Job embeddings.
    //    We fetch 50 candidates so we have enough to merge with MatchScore rows.
    type VectorRow = {
      id: string;
      title: string;
      company: string;
      company_logo_url: string | null;
      description_short: string | null;
      city: string | null;
      country: string;
      is_remote: boolean;
      work_mode: string;
      job_type: string;
      sector: string | null;
      salary_min: number | null;
      salary_max: number | null;
      salary_raw: string | null;
      years_experience_min: number | null;
      required_skills: string[];
      source_platform: string;
      source_url: string;
      published_at: Date;
      is_active: boolean;
      is_premium: boolean;
      view_count: number;
      vector_score: number;
    };

    // Guard: ensure the selected CV actually has an embedding (pgvector would error otherwise)
    const cvHasEmbedding = await this.prisma.$queryRaw<[{ has_embedding: boolean }]>`
      SELECT embedding IS NOT NULL AS has_embedding FROM "UserCV" WHERE id = ${cv.id}
    `;
    if (!cvHasEmbedding[0]?.has_embedding) {
      this.logger.debug(`findFeed: CV ${cv.id} has no embedding — falling back to recent`);
      return this.findRecent(20);
    }

    const vectorRows = await this.prisma.$queryRaw<VectorRow[]>`
      SELECT
        j.id,
        j.title,
        j.company,
        j."companyLogoUrl"     AS company_logo_url,
        j."descriptionShort"   AS description_short,
        j.city,
        j.country,
        j."isRemote"           AS is_remote,
        j."workMode"           AS work_mode,
        j."jobType"            AS job_type,
        j.sector,
        j."salaryMin"          AS salary_min,
        j."salaryMax"          AS salary_max,
        j."salaryRaw"          AS salary_raw,
        j."yearsExperienceMin" AS years_experience_min,
        j."requiredSkills"     AS required_skills,
        j."sourcePlatform"     AS source_platform,
        j."sourceUrl"          AS source_url,
        j."publishedAt"        AS published_at,
        j."isActive"           AS is_active,
        j."isPremium"          AS is_premium,
        j."viewCount"          AS view_count,
        1 - (j.embedding <=> (
          SELECT embedding FROM "UserCV" WHERE id = ${cv.id}
        ))                     AS vector_score
      FROM "Job" j
      WHERE
        j."isActive" = true
        AND j.embedding IS NOT NULL
      ORDER BY
        j.embedding <=> (
          SELECT embedding FROM "UserCV" WHERE id = ${cv.id}
        )
      LIMIT 50
    `;

    // 3. Fetch existing AI MatchScore records for this user (covers the same candidates)
    const jobIds = vectorRows.map((r) => r.id);

    const [matchScores, savedJobs] = await Promise.all([
      this.prisma.matchScore.findMany({
        where: { userId, jobId: { in: jobIds } },
        select: { jobId: true, score: true },
      }),
      this.prisma.savedJob.findMany({
        where: { userId, jobId: { in: jobIds } },
        select: { jobId: true },
      }),
    ]);

    const matchScoreMap = new Map(matchScores.map((m) => [m.jobId, m.score]));
    const savedJobIds = new Set(savedJobs.map((s) => s.jobId));

    // 4. Merge: AI MatchScore is authoritative when present; otherwise use
    //    the raw cosine similarity as a floating-point proxy score.
    const merged: JobListItem[] = vectorRows.map((r) => ({
      id: r.id,
      title: r.title,
      company: r.company,
      companyLogoUrl: r.company_logo_url,
      descriptionShort: r.description_short,
      city: r.city,
      country: r.country,
      isRemote: r.is_remote,
      workMode: r.work_mode as JobListItem['workMode'],
      jobType: r.job_type as JobListItem['jobType'],
      sector: r.sector,
      salaryMin: r.salary_min,
      salaryMax: r.salary_max,
      salaryRaw: r.salary_raw,
      yearsExperienceMin: r.years_experience_min,
      requiredSkills: r.required_skills,
      sourcePlatform: r.source_platform as JobListItem['sourcePlatform'],
      sourceUrl: r.source_url,
      publishedAt: r.published_at,
      isActive: r.is_active,
      isPremium: r.is_premium,
      viewCount: r.view_count,
      isSaved: savedJobIds.has(r.id),
      // AI MatchScore (0–100 range) is prioritised over raw cosine score (0–1)
      matchScore: matchScoreMap.get(r.id) ?? r.vector_score,
    }));

    // 5. Sort descending by effective score, return top 30
    merged.sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));

    return merged.slice(0, 30);
  }
}
