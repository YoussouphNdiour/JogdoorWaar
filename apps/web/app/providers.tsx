'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { PostHogProvider as PHProvider } from 'posthog-js/react';

// ─── Constantes ────────────────────────────────────────────────────────────────

const POSTHOG_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const POSTHOG_HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.posthog.com';

// PostHog est désactivé en dehors de la production pour ne pas polluer
// les métriques avec du trafic de développement ou de test.
const isEnabled =
  typeof window !== 'undefined' &&
  Boolean(POSTHOG_KEY) &&
  process.env.NODE_ENV === 'production';

// ─── Initialisation (une seule fois côté client) ────────────────────────────

if (isEnabled && POSTHOG_KEY && !posthog.__loaded) {
  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,

    // Capturer les page views manuellement pour les SPA Next.js (App Router)
    // afin d'avoir un suivi précis des navigations client-side.
    capture_pageview: false,

    // Respecter le Do Not Track du navigateur
    respect_dnt: true,

    // Ne jamais capturer de données sensibles dans les propriétés automatiques
    sanitize_properties(properties) {
      // Supprimer les paramètres UTM potentiellement porteurs de tokens
      const sensitiveKeys = ['token', 'secret', 'password', 'key', 'auth'];
      const sanitized = { ...properties };
      for (const key of Object.keys(sanitized)) {
        if (sensitiveKeys.some((s) => key.toLowerCase().includes(s))) {
          delete sanitized[key];
        }
      }
      return sanitized;
    },

    // Charger en différé pour ne pas bloquer le rendu initial
    loaded(ph) {
      // En cas de besoin de debug local (ne jamais activer en prod sans condition)
      if (process.env.NODE_ENV === 'development') {
        ph.opt_out_capturing();
      }
    },
  });
}

// ─── Tracker de navigation (page views App Router) ─────────────────────────

function PostHogPageView(): null {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isEnabled) return;

    // Reconstruire l'URL complète de la page
    const url = searchParams.size > 0 ? `${pathname}?${searchParams.toString()}` : pathname;

    posthog.capture('$pageview', { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

// ─── Provider principal ─────────────────────────────────────────────────────

interface PostHogProviderProps {
  children: React.ReactNode;
}

export function PostHogProvider({ children }: PostHogProviderProps) {
  // Si PostHog n'est pas activé (dev, test, ou clé manquante), on rend
  // directement les enfants sans wrapper inutile.
  if (!isEnabled || !POSTHOG_KEY) {
    return <>{children}</>;
  }

  return (
    <PHProvider client={posthog}>
      <PostHogPageView />
      {children}
    </PHProvider>
  );
}
