import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { MatchingService } from './matching.service';
import { CvSelectorService } from './cv-selector.service';
// EmbeddingService and StorageService are needed by CvSelectorService.
// They are imported from CvsModule via explicit provider re-declaration
// to avoid a circular module dependency (CvsModule imports AiModule for
// the adapt-for-job endpoint on CvsController).
import { EmbeddingService } from '../cvs/embedding.service';
import { StorageService } from '../cvs/storage.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    MatchingService,
    CvSelectorService,
    // Provide EmbeddingService and StorageService directly so that
    // CvSelectorService can be fully satisfied without importing CvsModule
    // (which would create a circular dependency).
    EmbeddingService,
    StorageService,
  ],
  exports: [AiService, MatchingService, CvSelectorService],
})
export class AiModule {}
