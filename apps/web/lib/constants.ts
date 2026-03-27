/** Pricing — single source of truth for all plan prices (in FCFA). */
export const PLAN_PRICES = {
  PREMIUM: 3_500,
  RECRUITER: 15_000,
} as const;

/** Formatted prices ready for display. */
export const PLAN_PRICES_DISPLAY = {
  PREMIUM: '3 500',
  RECRUITER: '15 000',
} as const;
