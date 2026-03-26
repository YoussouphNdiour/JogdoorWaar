# Variables d'environnement — Jog Door Waar

> Générées automatiquement en scannant tous les `getOrThrow` et `process.env` du code source.

## Légende
- 🔴 **CRITIQUE** — `getOrThrow` → crash au démarrage si manquante
- 🟡 **IMPORTANTE** — `get()` avec fallback → app démarre mais feature cassée
- 🟢 **OPTIONNELLE** — monitoring, fallback codé en dur

---

## Service : `jdw-api-ubi5` (NestJS)

### 🔴 CRITIQUE — crash au démarrage si manquante

| Variable | Valeur Render production | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` (auto-fournie par Render Postgres) | Connexion PostgreSQL |
| `REDIS_URL` | `redis://...` (auto-fournie par Render Key Value) | Connexion Redis / BullMQ |
| `JWT_SECRET` | ex: `openssl rand -hex 32` | Signer les access tokens JWT |
| `GOOGLE_CLIENT_ID` | `xxx.apps.googleusercontent.com` | OAuth Google |
| `GOOGLE_CLIENT_SECRET` | `GOCSPX-xxx` | OAuth Google |
| `GOOGLE_CALLBACK_URL` | `https://jdw-api-ubi5.onrender.com/auth/google/callback` | ⚠️ URL de retour OAuth — doit pointer vers l'API, pas le frontend |
| `ANTHROPIC_API_KEY` | `sk-ant-api03-xxx` | Claude AI — matching, analyse CV, coach |
| `OPENAI_API_KEY` | `sk-proj-xxx` (ou `OPENAI_NOT_CONFIGURED` si pas de clé) | Embeddings OpenAI pour pgvector |
| `SUPABASE_URL` | `https://llbyiocfytpgzshwojon.supabase.co` | ⚠️ L'URL Supabase, PAS la clé |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` (Service Role Key dans Supabase > API) | Upload CVs, accès admin Supabase |
| `STRIPE_SECRET_KEY` | `sk_live_xxx` ou `sk_test_xxx` | Paiements Stripe |
| `STRIPE_WEBHOOK_SECRET` | `whsec_xxx` | Vérification webhooks Stripe |
| `FRONTEND_URL` | `https://jdw-web-ubi5.onrender.com` | Redirect OAuth, CORS |
| `API_URL` | `https://jdw-api-ubi5.onrender.com` | URLs absolues API (Orange Money callbacks) |
| `ORANGE_MONEY_CLIENT_ID` | `xxx` | `client_id` OAuth2 Orange Sonatel (depuis Developer Portal) |
| `ORANGE_MONEY_CLIENT_SECRET` | `xxx` | `client_secret` OAuth2 Orange Sonatel |
| `ORANGE_MONEY_MERCHANT_CODE` | `123456` | Code marchand 6 chiffres (QR code paiement) |
| `ORANGE_MONEY_MERCHANT_NAME` | `Jog Door Waar` | Nom affiché au client lors du scan QR |
| `ORANGE_MONEY_WEBHOOK_SECRET` | Secret à générer | apiKey configuré via `/api/notification/v1/merchantcallback` |
| `WAVE_API_SECRET` | `wave_sn_prod_xxx` | Initiation paiements Wave |
| `WAVE_WEBHOOK_SECRET` | Secret Wave dashboard | Vérification webhooks Wave |

### 🟡 IMPORTANTE — app démarre mais feature cassée

| Variable | Valeur Render production | Description |
|---|---|---|
| `ENCRYPTION_KEY` | `openssl rand -hex 32` (64 chars hex) | Chiffrement AES-256 téléphones/WhatsApp |
| `MEILISEARCH_URL` | `http://localhost:7700` (ou URL externe) | Moteur de recherche — fallback localhost |
| `MEILISEARCH_API_KEY` | `masterKey_dev` (ou vraie clé) | Auth Meilisearch — fallback masterKey_dev |
| `RESEND_API_KEY` | `re_xxx` | Envoi emails alertes — silencieux si absent |
| `WASENDER_API_KEY` | `xxx` | Bot WhatsApp — warning log si absent |
| `WASENDER_WEBHOOK_SECRET` | Secret WaSender | HMAC webhook WhatsApp — skippé si absent |
| `NOTIFICATION_FROM_EMAIL` | `alertes@jogdoorwaar.sn` | Expéditeur emails — fallback codé |
| `JWT_EXPIRES_IN` | `900s` | Durée access token — fallback 900s |

### 🟢 OPTIONNELLE

| Variable | Valeur | Description |
|---|---|---|
| `NODE_ENV` | `production` | Mode production |
| `PORT` | `3001` (Render override auto) | Port d'écoute |
| `SENTRY_DSN` | `https://xxx@sentry.io/xxx` | Monitoring erreurs — ignoré si absent |
| `POSTHOG_API_KEY` | `phc_xxx` | Analytics — non utilisé côté API |
| `SUPABASE_STORAGE_BUCKET` | `jogdoorwaar-files` | Nom bucket Supabase |
| `SUPERADMIN_EMAIL` | `admin@jogdoorwaar.sn` | Seed SuperAdmin |
| `SUPERADMIN_PASSWORD` | Mot de passe fort | Seed SuperAdmin |
| `LINKEDIN_CLIENT_ID` | `xxx` | OAuth LinkedIn (non implémenté) |
| `LINKEDIN_CLIENT_SECRET` | `xxx` | OAuth LinkedIn (non implémenté) |

---

## Service : `jdw-web-ubi5` (Next.js)

> Ces variables sont préfixées `NEXT_PUBLIC_` pour le client browser.

| Variable | Valeur | Description |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://jdw-api-ubi5.onrender.com` | URL de l'API backend |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://llbyiocfytpgzshwojon.supabase.co` | URL Supabase pour le client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` (Anon Key dans Supabase > API) | Clé publique Supabase |
| `NEXT_PUBLIC_POSTHOG_KEY` | `phc_xxx` | Analytics PostHog |
| `NEXT_PUBLIC_POSTHOG_HOST` | `https://eu.posthog.com` | Host PostHog |

---

## Service : `jdw-scrapers-ubi5` (Worker BullMQ)

Hérite de la même image Docker que l'API. Même variables que l'API sauf :

| Variable | Valeur | Description |
|---|---|---|
| `DATABASE_URL` | identique API | |
| `REDIS_URL` | identique API | |
| `ANTHROPIC_API_KEY` | identique API | Pour résumé auto des offres |

---

## Checklist Render — ordre de saisie recommandé

```
1. DATABASE_URL          ← auto si Postgres Render lié
2. REDIS_URL             ← auto si Key Value Render lié
3. JWT_SECRET            ← openssl rand -hex 32
4. ENCRYPTION_KEY        ← openssl rand -hex 32
5. ANTHROPIC_API_KEY     ← console.anthropic.com
6. OPENAI_API_KEY        ← platform.openai.com (ou placeholder)
7. SUPABASE_URL          ← https://llbyiocfytpgzshwojon.supabase.co
8. SUPABASE_SERVICE_ROLE_KEY ← Supabase > Project Settings > API > service_role
9. GOOGLE_CLIENT_ID      ← console.cloud.google.com
10. GOOGLE_CLIENT_SECRET ← console.cloud.google.com
11. GOOGLE_CALLBACK_URL  ← https://jdw-api-ubi5.onrender.com/auth/google/callback
12. FRONTEND_URL         ← https://jdw-web-ubi5.onrender.com
13. API_URL              ← https://jdw-api-ubi5.onrender.com
14. WAVE_API_SECRET      ← dashboard Wave
15. WAVE_WEBHOOK_SECRET  ← à générer + configurer dans Wave
16. STRIPE_SECRET_KEY    ← dashboard Stripe
17. STRIPE_WEBHOOK_SECRET ← dashboard Stripe
18. RESEND_API_KEY       ← resend.com
19. WASENDER_API_KEY     ← wasenderapi.com
20. NODE_ENV             ← production
```

---

## Générer des secrets forts (macOS/Linux)

```bash
# JWT_SECRET et ENCRYPTION_KEY
openssl rand -hex 32

# WASENDER_WEBHOOK_SECRET / WAVE_WEBHOOK_SECRET
openssl rand -base64 32
```
