import { JobType, SourcePlatform } from '@prisma/client';

export interface RawJob {
  title: string;
  company: string;
  description: string;
  city?: string;
  country?: string;
  jobType?: JobType;
  sector?: string;
  salaryRaw?: string;
  publishedAt: Date;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  sourceId?: string;
  companyLogoUrl?: string;
}
