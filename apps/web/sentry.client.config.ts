// apps/web/sentry.client.config.ts
// Ce fichier est chargé automatiquement par @sentry/nextjs (côté navigateur).
// Il doit rester à la racine de apps/web/.
import * as Sentry from '@sentry/nextjs';

const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (SENTRY_DSN) {
  const isProd = process.env.NODE_ENV === 'production';

  Sentry.init({
    dsn: SENTRY_DSN,

    // Traces de performance : 10 % en prod, 100 % en dev pour faciliter le débogage
    tracesSampleRate: isProd ? 0.1 : 1.0,

    // Session Replay : 10 % des sessions en prod
    replaysSessionSampleRate: 0.1,
    // 100 % des sessions avec erreur, toujours
    replaysOnErrorSampleRate: 1.0,

    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        // Ne jamais capturer les champs sensibles (tokens, mots de passe, numéros de téléphone)
        maskAllText: false,
        maskAllInputs: true,
        blockAllMedia: false,
      }),
    ],

    environment: process.env.NODE_ENV ?? 'development',

    // Filtrer les erreurs non actionnables (extensions navigateur, réseaux flaky…)
    beforeSend(event, hint) {
      const err = hint?.originalException;
      if (err instanceof Error) {
        // Ignorer les erreurs de réseau transitoires
        if (err.message?.match(/network request failed/i)) {
          return null;
        }
      }
      return event;
    },

    // Ne jamais inclure de données sensibles dans les breadcrumbs
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.category === 'xhr' || breadcrumb.category === 'fetch') {
        // Supprimer les headers d'autorisation des breadcrumbs réseau
        if (breadcrumb.data?.['request_headers']) {
          delete breadcrumb.data['request_headers']['Authorization'];
          delete breadcrumb.data['request_headers']['authorization'];
        }
      }
      return breadcrumb;
    },
  });
}
