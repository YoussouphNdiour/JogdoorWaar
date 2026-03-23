import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { BullModule } from '@nestjs/bull';
import { memoryStorage } from 'multer';
import { CvsController } from './cvs.controller';
import { CvsService } from './cvs.service';
import { PdfExtractorService } from './pdf-extractor.service';
import { EmbeddingService } from './embedding.service';
import { StorageService } from './storage.service';
import { AiModule } from '../ai/ai.module';

@Module({
  imports: [
    /**
     * Memory storage so that file.buffer is populated and available to
     * PdfExtractorService and StorageService without writing to disk.
     */
    MulterModule.register({
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
    }),
    BullModule.registerQueue({
      name: 'ai-processing',
    }),
    /**
     * AiModule is imported to give CvsController access to AiService
     * (used by the POST /cvs/:id/adapt-for-job endpoint).
     */
    AiModule,
  ],
  controllers: [CvsController],
  providers: [
    CvsService,
    PdfExtractorService,
    EmbeddingService,
    StorageService,
  ],
  exports: [CvsService, EmbeddingService],
})
export class CvsModule {}
