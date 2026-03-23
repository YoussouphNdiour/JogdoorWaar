// ─── Constantes partagées ─────────────────────────────────────────

export const APP_NAME = 'Jog Door Waar';
export const APP_TAGLINE = "Aujourd'hui il y a du travail";
export const APP_DOMAIN = 'jogdoorwaar.com';
export const APP_EMAIL_FROM = 'alertes@jogdoorwaar.sn';

// ─── Pagination ───────────────────────────────────────────────────
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 50;

// ─── Rate limits ──────────────────────────────────────────────────
export const RATE_LIMITS = {
  login: { ttl: 3600, max: 5 },           // 5 tentatives/heure
  aiFreePlan: { ttl: 3600, max: 20 },     // 20 req IA/heure FREE
  aiPremiumPlan: { ttl: 3600, max: 100 }, // 100 req IA/heure PREMIUM
} as const;

// ─── JWT ──────────────────────────────────────────────────────────
export const JWT_ACCESS_EXPIRES = '15m';
export const JWT_REFRESH_EXPIRES = '30d';

// ─── Cache TTLs (secondes) ────────────────────────────────────────
export const CACHE_TTL = {
  jobSummary: 86400,      // 24h
  aiRecommendations: 3600, // 1h
  jobList: 300,           // 5min
  searchResults: 60,      // 1min
} as const;

// ─── BullMQ queues ────────────────────────────────────────────────
export const QUEUE_NAMES = {
  scraping: 'scraping',
  aiProcessing: 'ai-processing',
  notifications: 'notifications',
  emailAlert: 'email-alert',
  whatsappAlert: 'whatsapp-alert',
} as const;

// ─── Scraping config ──────────────────────────────────────────────
export const SCRAPING_CONFIG = {
  minDelayMs: 2000,
  maxDelayMs: 5000,
  maxConcurrentJobs: 2,
  userAgent: 'Mozilla/5.0 (compatible; JogDoorWaar/1.0; +https://jogdoorwaar.com/bot)',
} as const;

// ─── Upload limits ────────────────────────────────────────────────
export const UPLOAD_LIMITS = {
  cvMaxSizeBytes: 5 * 1024 * 1024,   // 5 MB
  cvAllowedMimeTypes: ['application/pdf'],
  logoMaxSizeBytes: 2 * 1024 * 1024, // 2 MB
} as const;
