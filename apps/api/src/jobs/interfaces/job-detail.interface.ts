import { JobType, WorkMode, SourcePlatform } from '@prisma/client';

export interface JobDetail {
  id: string;
  fingerprint: string;
  title: string;
  company: string;
  companyLogoUrl: string | null;
  description: string;
  descriptionShort: string | null;
  city: string | null;
  country: string;
  isRemote: boolean;
  workMode: WorkMode;
  jobType: JobType;
  sector: string | null;
  category: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryRaw: string | null;
  yearsExperienceMin: number | null;
  yearsExperienceMax: number | null;
  requiredSkills: string[];
  preferredSkills: string[];
  educationLevel: string | null;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  publishedAt: Date;
  expiresAt: Date | null;
  isActive: boolean;
  isVerified: boolean;
  isPremium: boolean;
  viewCount: number;
  clickCount: number;
  createdAt: Date;
  updatedAt: Date;
  /** Present only when authenticated */
  isSaved?: boolean;
  /** Present only when authenticated and a MatchScore record exists */
  matchScore?: number | null;
}
