// ─── Enums (miroir du schéma Prisma) ─────────────────────────────

export enum Plan {
  FREE = 'FREE',
  PREMIUM = 'PREMIUM',
  RECRUITER = 'RECRUITER',
}

export enum UserRole {
  CANDIDATE = 'CANDIDATE',
  RECRUITER = 'RECRUITER',
  ADMIN = 'ADMIN',
  SUPERADMIN = 'SUPERADMIN',
}

export enum WorkMode {
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
  ON_SITE = 'ON_SITE',
}

export enum JobType {
  CDI = 'CDI',
  CDD = 'CDD',
  STAGE = 'STAGE',
  ALTERNANCE = 'ALTERNANCE',
  FREELANCE = 'FREELANCE',
  TEMPS_PARTIEL = 'TEMPS_PARTIEL',
  BENEVOLAT = 'BENEVOLAT',
}

export enum AlertFrequency {
  INSTANT = 'INSTANT',
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
}

export enum ApplicationStatus {
  TO_APPLY = 'TO_APPLY',
  APPLIED = 'APPLIED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  INTERVIEW_DONE = 'INTERVIEW_DONE',
  OFFER_RECEIVED = 'OFFER_RECEIVED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

export enum ApplicationChannel {
  WEB = 'WEB',
  WHATSAPP = 'WHATSAPP',
}

export enum SourcePlatform {
  LINKEDIN = 'LINKEDIN',
  EMPLOI_SENEGAL = 'EMPLOI_SENEGAL',
  EMPLOI_DAKAR = 'EMPLOI_DAKAR',
  SENJOB = 'SENJOB',
  EXPAT_DAKAR = 'EXPAT_DAKAR',
  SENEJOBS = 'SENEJOBS',
  AFRIRH = 'AFRIRH',
  EMPLOI_SEN = 'EMPLOI_SEN',
  SENINTERIM = 'SENINTERIM',
  SENRH = 'SENRH',
  FACEBOOK = 'FACEBOOK',
  TWITTER = 'TWITTER',
  DIRECT = 'DIRECT',
}

// ─── Response types ───────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  timestamp: string;
}

// ─── User types ───────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string;
  plan: Plan;
  role: UserRole;
  emailVerified: boolean;
  whatsappVerified: boolean;
  isAnonymousMode: boolean;
}

export interface AuthTokens {
  accessToken: string;
  expiresIn: number;
}

// ─── Job types ────────────────────────────────────────────────────

export interface JobListItem {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  city?: string;
  country: string;
  workMode: WorkMode;
  jobType: JobType;
  sector?: string;
  salaryMin?: number;
  salaryMax?: number;
  publishedAt: string;
  sourcePlatform: SourcePlatform;
  sourceUrl: string;
  descriptionShort?: string;
  requiredSkills: string[];
  matchScore?: number | null;
  isSaved?: boolean;
  isActive: boolean;
  isPremium: boolean;
}

export interface JobDetail extends JobListItem {
  description: string;
  preferredSkills: string[];
  educationLevel?: string;
  yearsExperienceMin?: number;
  yearsExperienceMax?: number;
  salaryRaw?: string;
  expiresAt?: string;
  viewCount: number;
}

export interface JobFilters {
  q?: string;
  location?: string;
  jobType?: JobType[];
  workMode?: WorkMode[];
  sector?: string[];
  salaryMin?: number;
  salaryMax?: number;
  yearsExp?: number;
  publishedAfter?: 'last24h' | 'lastWeek' | 'lastMonth';
  source?: SourcePlatform[];
  sortBy?: 'relevance' | 'date' | 'salary' | 'matchScore';
  page?: number;
  limit?: number;
}

// ─── CV types ─────────────────────────────────────────────────────

export interface CVItem {
  id: string;
  name: string;
  label?: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileSize?: number;
  detectedSkills: string[];
  detectedJobTypes: string[];
  sectorFit: string[];
  isDefault: boolean;
  isGenerated: boolean;
  parentCvId?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Alert types ──────────────────────────────────────────────────

export interface AlertItem {
  id: string;
  name: string;
  keywords: string[];
  excludeKeywords: string[];
  locations: string[];
  jobTypes: JobType[];
  workModes: WorkMode[];
  sectors: string[];
  salaryMin?: number;
  salaryMax?: number;
  notifyByEmail: boolean;
  notifyByWhatsapp: boolean;
  frequency: AlertFrequency;
  isActive: boolean;
  lastTriggeredAt?: string;
  createdAt: string;
}

// ─── Application types ────────────────────────────────────────────

export interface ApplicationItem {
  id: string;
  jobId: string;
  job: JobListItem;
  cvId?: string;
  status: ApplicationStatus;
  appliedAt?: string;
  appliedVia: ApplicationChannel;
  notes?: string;
  interviewDate?: string;
  offerReceived: boolean;
  offerAmount?: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Plan limits ──────────────────────────────────────────────────

export const PLAN_LIMITS = {
  [Plan.FREE]: {
    maxCvs: 2,
    maxAlerts: 2,
    maxApplicationsCrm: 10,
    aiCvGenerationsPerMonth: 1,
    aiCoverLettersPerMonth: 2,
    aiInterviewCoachPerMonth: 0,
    matchingDetailed: false,
    anonymousMode: false,
  },
  [Plan.PREMIUM]: {
    maxCvs: Infinity,
    maxAlerts: Infinity,
    maxApplicationsCrm: Infinity,
    aiCvGenerationsPerMonth: 10,
    aiCoverLettersPerMonth: 10,
    aiInterviewCoachPerMonth: 5,
    matchingDetailed: true,
    anonymousMode: true,
  },
  [Plan.RECRUITER]: {
    maxCvs: Infinity,
    maxAlerts: Infinity,
    maxApplicationsCrm: Infinity,
    aiCvGenerationsPerMonth: Infinity,
    aiCoverLettersPerMonth: Infinity,
    aiInterviewCoachPerMonth: Infinity,
    matchingDetailed: true,
    anonymousMode: false,
    jobPostingsPerMonth: 10,
  },
} as const;

export const PLAN_PRICES_FCFA = {
  [Plan.FREE]: 0,
  [Plan.PREMIUM]: 15,
  [Plan.RECRUITER]: 15,
} as const;
