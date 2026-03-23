# DEPLOY.md — Jog Door Waar — Guide de déploiement Render.com

## Architecture production

```
jogdoorwaar.sn        →  jdw-web      (Next.js 14, Render Web, standard)
api.jogdoorwaar.sn    →  jdw-api      (NestJS, Render Web, standard)
                         jdw-scrapers (BullMQ Worker, Render Worker, starter)
                         jdw-meilisearch (Meilisearch v1.7, Render Private, standard)
                         jdw-postgres (PostgreSQL 16 + pgvector, standard)
                         jdw-redis    (Redis 7, Render Key Value, starter)
```

---

## Premier déploiement

### 1. Pré-requis
- Compte Render.com avec billing activé
- Repository GitHub connecté à Render
- Clés API prêtes : Anthropic, OpenAI, Resend, WaSender, Wave, Orange Money, Stripe, Supabase, Google OAuth

### 2. Déployer via render.yaml (Blueprint)

```bash
# Dans le dashboard Render.com → "New Blueprint"
# Pointer sur le repository GitHub → Render lit render.yaml
# Render crée automatiquement les 6 services
```

### 3. Variables d'environnement manuelles (sync: false)

Après la création des services, renseigner dans Render Dashboard → Environment :

#### jdw-api
| Variable | Valeur |
|---|---|
| `ENCRYPTION_KEY` | `openssl rand -hex 32` (64 chars hex) |
| `GOOGLE_CLIENT_ID` | Console Google Cloud |
| `GOOGLE_CLIENT_SECRET` | Console Google Cloud |
| `GOOGLE_CALLBACK_URL` | `https://jdw-api.onrender.com/auth/google/callback` |
| `FRONTEND_URL` | `https://jdw-web.onrender.com` |
| `API_URL` | `https://jdw-api.onrender.com` |
| `APP_URL` | `https://jdw-web.onrender.com` |
| `ANTHROPIC_API_KEY` | sk-ant-... |
| `OPENAI_API_KEY` | sk-proj-... |
| `MEILISEARCH_URL` | `http://jdw-meilisearch:7700` |
| `MEILISEARCH_API_KEY` | Copier depuis jdw-meilisearch → `MEILI_MASTER_KEY` |
| `RESEND_API_KEY` | re_... |
| `WASENDER_API_KEY` | Clé WaSender |
| `WAVE_API_SECRET` | wave_sn_prod_... |
| `ORANGE_MONEY_API_KEY` | Clé Orange Money |
| `ORANGE_MONEY_MERCHANT_KEY` | Merchant key Orange Money |
| `STRIPE_SECRET_KEY` | sk_live_... |
| `STRIPE_WEBHOOK_SECRET` | whsec_... (après création webhook Stripe) |
| `SUPABASE_URL` | https://xxx.supabase.co |
| `SUPABASE_SERVICE_KEY` | eyJ... |
| `SUPABASE_SERVICE_ROLE_KEY` | eyJ... |
| `SENTRY_DSN` | https://xxx@sentry.io/xxx |
| `SUPERADMIN_PASSWORD` | Mot de passe fort |

#### jdw-web
| Variable | Valeur |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://jdw-api.onrender.com` |
| `NEXT_PUBLIC_POSTHOG_KEY` | phc_... |

#### jdw-scrapers
| Variable | Valeur |
|---|---|
| `MEILISEARCH_URL` | `http://jdw-meilisearch:7700` |
| `MEILISEARCH_API_KEY` | (même que jdw-api) |
| `ANTHROPIC_API_KEY` | (même que jdw-api) |
| `OPENAI_API_KEY` | (même que jdw-api) |

### 4. Seeder SuperAdmin

```bash
# Après le premier migrate deploy, lancer depuis un terminal Render Shell
# ou en ajoutant comme préCommande dans le buildCommand (une seule fois) :
cd apps/api && npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
```

### 5. Webhooks à configurer

#### Stripe
- Dashboard Stripe → Webhooks → Ajouter endpoint
- URL : `https://jdw-api.onrender.com/payments/webhook/stripe`
- Événements : `checkout.session.completed`, `invoice.payment_succeeded`
- Copier `Signing secret` → `STRIPE_WEBHOOK_SECRET` sur jdw-api

#### Wave
- Dashboard Wave → Webhooks
- URL : `https://jdw-api.onrender.com/payments/webhook/wave`
- Copier secret → `WAVE_WEBHOOK_SECRET` (ou est `generateValue: true` dans Render)

#### WaSender
- Dashboard WaSender → Webhook URL
- URL : `https://jdw-api.onrender.com/whatsapp/webhook`
- Le secret `WASENDER_WEBHOOK_SECRET` est auto-généré par Render — copier vers WaSender

### 6. DNS (domaines personnalisés)

```
jogdoorwaar.sn        CNAME  jdw-web.onrender.com
api.jogdoorwaar.sn    CNAME  jdw-api.onrender.com
```

---

## Déploiements continus (CI/CD)

Le fichier `.github/workflows/ci.yml` gère :
1. **Tests unitaires + lint** (toutes les branches)
2. **Tests E2E Playwright** (chromium + mobile-safari)
3. **Deploy staging** (`develop` → deploy hooks staging)
4. **Deploy production** (`main` → deploy hooks prod + Sentry release)

### GitHub Secrets à configurer

| Secret | Description |
|---|---|
| `RENDER_PROD_DEPLOY_HOOK_API` | URL hook deploy jdw-api prod |
| `RENDER_PROD_DEPLOY_HOOK_WEB` | URL hook deploy jdw-web prod |
| `RENDER_PROD_DEPLOY_HOOK_WORKER` | URL hook deploy jdw-scrapers prod |
| `RENDER_STAGING_DEPLOY_HOOK_API` | Idem staging |
| `RENDER_STAGING_DEPLOY_HOOK_WEB` | Idem staging |
| `RENDER_STAGING_DEPLOY_HOOK_WORKER` | Idem staging |
| `CODECOV_TOKEN` | Token Codecov (optionnel) |
| `SENTRY_AUTH_TOKEN` | Token Sentry CLI |
| `SENTRY_ORG` | Slug organisation Sentry |
| `SENTRY_PROJECT` | Nom projet Sentry |

---

## Commandes utiles

```bash
# Développement local
docker compose up -d              # PostgreSQL 16+pgvector, Redis, Meilisearch
npm run dev                       # Lance tous les apps en parallèle (Turborepo)

# Base de données
cd apps/api
npx prisma migrate dev            # Nouvelle migration
npx prisma migrate deploy         # Appliquer en prod
npx prisma studio                 # Interface graphique
npx prisma db seed                # Créer SUPERADMIN

# Build production local
npx turbo run build

# Tests
npm run test                      # Unit tests
npx playwright test               # E2E tests
npx playwright test --ui          # Interface Playwright
```

---

## Estimation coûts Render.com (production)

| Service | Plan | $/mois |
|---|---|---|
| jdw-web | Standard | ~25$ |
| jdw-api | Standard | ~25$ |
| jdw-scrapers | Starter | ~7$ |
| jdw-meilisearch | Standard | ~25$ |
| jdw-postgres | Standard | ~20$ |
| jdw-redis | Starter | ~3$ |
| **Total** | | **~105$/mois** |
