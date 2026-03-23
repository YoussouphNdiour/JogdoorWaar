import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { MeilisearchService } from './meilisearch.service';

/**
 * JobsModule
 *
 * Owns all job-listing functionality:
 *  - Paginated browse + filtering (Prisma / PostgreSQL)
 *  - Full-text search (Meilisearch)
 *  - Semantic similarity search (pgvector)
 *  - AI-based recommendations (MatchScore table)
 *  - Bookmark (SavedJob) management
 *  - Click-through tracking
 *
 * Dependencies:
 *  - PrismaModule  → global, no import needed
 *  - ConfigModule  → global, no import needed
 *  - BullModule    → registers the 'scraping' queue (used by scrapers to
 *                    trigger Meilisearch re-indexing after each scrape run)
 */
@Module({
  imports: [
    // ConfigModule is global — listed here for explicitness and testability
    ConfigModule,
    // Register the scraping queue so scrapers can emit index-refresh tasks
    BullModule.registerQueue({
      name: 'scraping',
    }),
  ],
  controllers: [JobsController],
  providers: [JobsService, MeilisearchService],
  exports: [JobsService],
})
export class JobsModule {}
