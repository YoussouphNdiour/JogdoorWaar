// apps/web/sentry.server.config.ts
// Ce fichier est chargé automatiquement par @sentry/nextjs (côté serveur Node.js / Edge).
// Il doit rester à la racine de apps/web/.
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,

    // 10 % des transactions serveur en production (RSC, Server Actions, API routes)
    tracesSampleRate: 0.1,

    environment: process.env.NODE_ENV ?? 'development',

    // Filtrer les erreurs non critiques côté serveur
    beforeSend(event, hint) {
      const err = hint?.originalException;

      // Ne pas capturer les erreurs 404 (Not Found) — elles sont attendues
      if (event.tags?.['http.status_code'] === 404) {
        return null;
      }

      // Ne jamais logger de données sensibles dans Sentry
      if (err instanceof Error && err.message?.match(/password|token|secret|bearer/i)) {
        event.message = '[REDACTED — sensitive data]';
        event.exception = undefined;
        return event;
      }

      return event;
    },
  });
}
