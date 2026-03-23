import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RawJob } from './interfaces/raw-job.interface';

/**
 * DeduplicationService
 *
 * Three-level deduplication strategy:
 *   1. Exact URL match  — sourceUrl is unique in the Job table
 *   2. SHA-256 fingerprint — title|company|publishedAt
 *   3. Vector cosine similarity > 0.95 via pgvector (only when embedding is provided)
 */
@Injectable()
export class DeduplicationService {
  private readonly logger = new Logger(DeduplicationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns true when the job already exists in the database by any dedup level.
   */
  async isDuplicate(job: RawJob, fingerprint: string, embedding?: number[]): Promise<boolean> {
    // Level 1 — exact URL
    const byUrl = await this.prisma.job.findUnique({
      where: { sourceUrl: job.sourceUrl },
      select: { id: true },
    });

    if (byUrl) {
      this.logger.debug(`[L1-URL] Duplicate detected for ${job.sourceUrl}`);
      return true;
    }

    // Level 2 — SHA-256 fingerprint
    const byFingerprint = await this.prisma.job.findUnique({
      where: { fingerprint },
      select: { id: true },
    });

    if (byFingerprint) {
      this.logger.debug(`[L2-FP] Duplicate fingerprint ${fingerprint}`);
      return true;
    }

    // Level 3 — vector cosine similarity (only when caller provides an embedding)
    if (embedding && embedding.length > 0) {
      const vectorLiteral = `[${embedding.join(',')}]`;

      type VectorRow = { id: string };

      const rows = await this.prisma.$queryRaw<VectorRow[]>`
        SELECT id
        FROM "Job"
        WHERE embedding IS NOT NULL
          AND 1 - (embedding <=> ${vectorLiteral}::vector) > 0.95
        LIMIT 1
      `;

      if (rows.length > 0) {
        this.logger.debug(`[L3-VEC] Near-duplicate vector match for "${job.title}" @ ${job.company}`);
        return true;
      }
    }

    return false;
  }
}
