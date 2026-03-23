import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const nextConfig: NextConfig = {
  transpilePackages: ['@jdw/ui', '@jdw/shared-types'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.supabase.co' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
    ],
  },
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
};

// Envelopper avec withSentryConfig uniquement si le DSN est défini.
// En l'absence de SENTRY_DSN côté build, on exporte la config brute.
const hasSentryDsn = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export default hasSentryDsn
  ? withSentryConfig(nextConfig, {
      // Organisation et projet Sentry (injectés par les secrets CI)
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,

      // Token pour uploader les source maps en production
      authToken: process.env.SENTRY_AUTH_TOKEN,

      // Supprimer les logs Sentry du build output
      silent: true,

      // Uploader les source maps uniquement en production
      widenClientFileUpload: true,

      // Désactiver le tunnelRoute (optionnel, évite les bloqueurs de pub)
      // tunnelRoute: '/monitoring',

      // Cacher les source maps côté client pour ne pas exposer le code source
      hideSourceMaps: true,

      // Désactiver le tree-shaking du SDK Sentry (recommandé pour éviter les surprises)
      disableLogger: true,

      // Compatibilité Next.js 14 App Router
      automaticVercelMonitors: false,
    })
  : nextConfig;
