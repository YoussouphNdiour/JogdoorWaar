# SCHEMA.md — Modèle de Données Jog Door Waar

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

// ─── UTILISATEURS ─────────────────────────────────────────────────

model User {
  id               String    @id @default(cuid())
  email            String    @unique
  phone            String?   @unique
  whatsappNumber   String?
  passwordHash     String?
  firstName        String
  lastName         String
  avatarUrl        String?
  isAnonymousMode  Boolean   @default(false)
  plan             Plan      @default(FREE)
  planExpiresAt    DateTime?
  emailVerified    Boolean   @default(false)
  whatsappVerified Boolean   @default(false)
  isActive         Boolean   @default(true)
  role             UserRole  @default(CANDIDATE)
  createdAt        DateTime  @default(now())
  updatedAt        DateTime  @updatedAt

  profile          UserProfile?
  cvs              UserCV[]
  alerts           Alert[]
  applications     Application[]
  savedJobs        SavedJob[]
  notifications    Notification[]
  subscription     Subscription?
  oauthAccounts    OAuthAccount[]
  sessions         Session[]
  aiUsageLogs      AiUsageLog[]
  whatsappSessions WhatsAppSession[]
}

model UserProfile {
  id                String     @id @default(cuid())
  userId            String     @unique
  user              User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  headline          String?
  summary           String?
  currentJobTitle   String?
  yearsOfExperience Int?
  currentSalary     Int?
  expectedSalary    Int?
  availabilityDate  DateTime?
  isOpenToWork      Boolean    @default(true)
  preferredWorkMode WorkMode[]
  preferredJobTypes JobType[]
  city              String?    @default("Dakar")
  country           String?    @default("Sénégal")
  isWillingToRelocate Boolean  @default(false)
  defaultCvId       String?
  skills            String[]
  languages         Json?
  education         Json?
  experience        Json?
  targetSectors     String[]
  targetJobTitles   String[]
  updatedAt         DateTime   @updatedAt
}

// ─── MULTI-CV ──────────────────────────────────────────────────────

model UserCV {
  id               String   @id @default(cuid())
  userId           String
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name             String
  label            String?  // max 24 chars — boutons WhatsApp
  description      String?
  fileUrl          String
  fileName         String
  fileSize         Int?
  textContent      String   @db.Text
  embedding        Unsupported("vector(1536)")?
  detectedSkills   String[]
  detectedJobTypes String[]
  sectorFit        String[]
  isDefault        Boolean  @default(false)
  isGenerated      Boolean  @default(false)
  parentCvId       String?
  parentCv         UserCV?  @relation("CVVariants", fields: [parentCvId], references: [id])
  variants         UserCV[] @relation("CVVariants")
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  applications     Application[]

  @@index([userId])
  @@index([userId, isDefault])
}

// ─── SESSION BOT WHATSAPP ─────────────────────────────────────────

model WhatsAppSession {
  id              String            @id @default(cuid())
  userId          String
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  phone           String
  state           WhatsAppBotState  @default(IDLE)
  context         Json?
  lastMessageAt   DateTime          @default(now())
  lastMessageText String?
  expiresAt       DateTime
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt

  @@unique([userId, phone])
  @@index([phone])
  @@index([state])
}

// ─── OFFRES D'EMPLOI ──────────────────────────────────────────────

model Job {
  id                 String         @id @default(cuid())
  fingerprint        String         @unique  // SHA-256(title|company|date)
  title              String
  company            String
  companyLogoUrl     String?
  description        String         @db.Text
  descriptionShort   String?        // Résumé IA 150 mots max
  city               String?
  country            String         @default("Sénégal")
  isRemote           Boolean        @default(false)
  workMode           WorkMode       @default(ON_SITE)
  jobType            JobType        @default(CDI)
  sector             String?
  category           String?
  salaryMin          Int?
  salaryMax          Int?
  salaryRaw          String?
  yearsExperienceMin Int?
  yearsExperienceMax Int?
  requiredSkills     String[]
  preferredSkills    String[]
  educationLevel     String?
  sourceUrl          String         @unique
  sourcePlatform     SourcePlatform
  sourceId           String?
  publishedAt        DateTime
  expiresAt          DateTime?
  scrapedAt          DateTime       @default(now())
  isActive           Boolean        @default(true)
  isVerified         Boolean        @default(false)
  isPremium          Boolean        @default(false)
  viewCount          Int            @default(0)
  clickCount         Int            @default(0)
  embedding          Unsupported("vector(1536)")?
  applications       Application[]
  savedBy            SavedJob[]
  matchScores        MatchScore[]
  createdAt          DateTime       @default(now())
  updatedAt          DateTime       @updatedAt

  @@index([publishedAt(sort: Desc)])
  @@index([sourcePlatform])
  @@index([city])
  @@index([jobType])
  @@index([isActive])
}

// ─── ALERTES ─────────────────────────────────────────────────────

model Alert {
  id               String         @id @default(cuid())
  userId           String
  user             User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  name             String
  keywords         String[]
  excludeKeywords  String[]
  locations        String[]
  jobTypes         JobType[]
  workModes        WorkMode[]
  sectors          String[]
  salaryMin        Int?
  salaryMax        Int?
  notifyByEmail    Boolean        @default(true)
  notifyByWhatsapp Boolean        @default(false)
  frequency        AlertFrequency @default(DAILY)
  isActive         Boolean        @default(true)
  lastTriggeredAt  DateTime?
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
}

model MatchScore {
  id        String   @id @default(cuid())
  userId    String
  jobId     String
  job       Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
  score     Float
  reasoning String?  @db.Text
  createdAt DateTime @default(now())

  @@unique([userId, jobId])
  @@index([userId, score(sort: Desc)])
}

// ─── CANDIDATURES CRM ─────────────────────────────────────────────

model Application {
  id                   String             @id @default(cuid())
  userId               String
  user                 User               @relation(fields: [userId], references: [id], onDelete: Cascade)
  jobId                String
  job                  Job                @relation(fields: [jobId], references: [id])
  cvId                 String?
  cv                   UserCV?            @relation(fields: [cvId], references: [id])
  cvWasGenerated       Boolean            @default(false)
  cvGenerationLog      String?            @db.Text
  status               ApplicationStatus  @default(TO_APPLY)
  appliedAt            DateTime?
  appliedVia           ApplicationChannel @default(WEB)
  notes                String?            @db.Text
  generatedCoverLetter String?            @db.Text
  interviewDate        DateTime?
  interviewNotes       String?
  offerReceived        Boolean            @default(false)
  offerAmount          Int?
  createdAt            DateTime           @default(now())
  updatedAt            DateTime           @updatedAt

  @@unique([userId, jobId])
}

model SavedJob {
  id        String   @id @default(cuid())
  userId    String
  jobId     String
  job       Job      @relation(fields: [jobId], references: [id])
  createdAt DateTime @default(now())

  @@unique([userId, jobId])
}

model AiUsageLog {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  feature      String   // COVER_LETTER, CV_GENERATION, MATCHING, SUMMARY
  inputTokens  Int
  outputTokens Int
  model        String
  createdAt    DateTime @default(now())

  @@index([userId, feature])
  @@index([createdAt])
}

model Notification {
  id        String           @id @default(cuid())
  userId    String
  user      User             @relation(fields: [userId], references: [id])
  type      NotificationType
  title     String
  body      String
  isRead    Boolean          @default(false)
  channel   String           // EMAIL, WHATSAPP, IN_APP
  createdAt DateTime         @default(now())

  @@index([userId, isRead])
}

model Subscription {
  id                String   @id @default(cuid())
  userId            String   @unique
  user              User     @relation(fields: [userId], references: [id])
  plan              Plan
  status            String   // active, cancelled, expired
  paymentMethod     String   // WAVE, ORANGE_MONEY, STRIPE
  externalPaymentId String?
  amount            Int      // FCFA
  startedAt         DateTime
  expiresAt         DateTime
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

model OAuthAccount {
  id           String @id @default(cuid())
  userId       String
  user         User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider     String // google, linkedin
  providerId   String
  accessToken  String?
  refreshToken String?

  @@unique([provider, providerId])
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken String   @unique
  userAgent    String?
  ipAddress    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())
}

// ─── ENUMS ───────────────────────────────────────────────────────

enum Plan { FREE PREMIUM RECRUITER }
enum UserRole { CANDIDATE RECRUITER ADMIN SUPERADMIN }
enum WorkMode { REMOTE HYBRID ON_SITE }
enum JobType { CDI CDD STAGE ALTERNANCE FREELANCE TEMPS_PARTIEL BÉNÉVOLAT }
enum AlertFrequency { INSTANT DAILY WEEKLY }
enum ApplicationStatus { TO_APPLY APPLIED INTERVIEW_SCHEDULED INTERVIEW_DONE OFFER_RECEIVED REJECTED WITHDRAWN }
enum ApplicationChannel { WEB WHATSAPP }
enum NotificationType { JOB_ALERT MATCH_SCORE SYSTEM PAYMENT }
enum WhatsAppBotState { IDLE SELECTING_CV GENERATING_CV CONFIRMING_CV GENERATING_COVER_LETTER REVIEWING_COVER_LETTER APPLYING DONE }
enum SourcePlatform { LINKEDIN EMPLOI_SENEGAL EMPLOI_DAKAR SENJOB EXPAT_DAKAR SENEJOBS AFRIRH EMPLOI_SEN SENINTERIM SENRH FACEBOOK TWITTER DIRECT }
```
