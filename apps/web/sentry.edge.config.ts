// apps/web/sentry.edge.config.ts
// Chargé par @sentry/nextjs pour les Edge Runtime routes (middleware, Edge API routes).
// Il doit rester à la racine de apps/web/.
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    tracesSampleRate: 0.1,
    environment: process.env.NODE_ENV ?? 'development',
  });
}
