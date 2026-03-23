// Context stored in Redis + Prisma WhatsAppSession.context (JSON)

export interface BotContext {
  // Job being applied to
  jobId?: string;
  jobTitle?: string;
  jobCompany?: string;

  // CV flow
  selectedCvId?: string;
  selectedCvLabel?: string;
  adaptCvRequested?: boolean;
  generatedCvId?: string;

  // Cover letter flow
  coverLetterDraft?: string;
  useCoverLetter?: boolean;

  // Final application
  applicationId?: string;

  // Source (alert vs direct)
  sourceAlertId?: string;

  // Retry tracking
  coverLetterRegen?: number; // how many times user regenerated (max 3 for FREE)
}

export interface SessionData {
  userId: string;
  phone: string;
  state: string; // WhatsAppBotState
  context: BotContext;
  lastMessageAt: number; // unix ms
}
