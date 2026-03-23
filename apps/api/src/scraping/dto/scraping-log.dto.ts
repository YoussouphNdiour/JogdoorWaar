export interface ScrapingResult {
  platform: string;
  processed: number;
  skipped: number;
  errors: number;
  durationMs: number;
  startedAt: Date;
}
