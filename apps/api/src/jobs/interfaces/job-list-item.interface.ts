import { JobType, WorkMode, SourcePlatform } from '@prisma/client';

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  companyLogoUrl: string | null;
  descriptionShort: string | null;
  city: string | null;
  country: string;
  isRemote: boolean;
  workMode: WorkMode;
  jobType: JobType;
  sector: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryRaw: string | null;
  yearsExperienceMin: number | null;
  requiredSkills: string[];
  sourcePlatform: SourcePlatform;
  sourceUrl: string;
  publishedAt: Date;
  isActive: boolean;
  isPremium: boolean;
  viewCount: number;
  /** Present only when authenticated and a MatchScore record exists */
  matchScore?: number | null;
  /** Present only when authenticated */
  isSaved?: boolean;
}
