# DEPLOY.md — Déploiement Render.com + CI/CD

## render.yaml (Infrastructure as Code)

```yaml
services:
  # ─── FRONTEND Next.js ───────────────────────────────────────────
  - type: web
    name: jdw-web
    runtime: node
    plan: standard          # 2 GB RAM, 1 CPU — $25/mois
    buildCommand: cd apps/web && npm install && npm run build
    startCommand: cd apps/web && npm run start
    healthCheckPath: /api/health
    envVars:
      - key: NODE_ENV
        value: production
      - key: NEXT_PUBLIC_API_URL
        fromService:
          name: jdw-api
          type: web
          property: host
      - key: NEXT_PUBLIC_APP_URL
        value: https://jogdoorwaar.com
      - key: NEXT_PUBLIC_POSTHOG_KEY
        sync: false

  # ─── BACKEND NestJS ─────────────────────────────────────────────
  - type: web
    name: jdw-api
    runtime: node
    plan: standard          # 2 GB RAM, 1 CPU — $25/mois
    buildCommand: cd apps/api && npm install && npm run build && npx prisma migrate deploy
    startCommand: cd apps/api && node dist/main.js
    healthCheckPath: /health
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: jdw-postgres
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: jdw-redis
          type: keyvalue
          property: connectionString
      - key: JWT_SECRET
        generateValue: true
      - key: JWT_REFRESH_SECRET
        generateValue: true
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: WASENDER_API_KEY
        sync: false
      - key: WASENDER_WEBHOOK_SECRET
        generateValue: true
      - key: WAVE_API_KEY
        sync: false
      - key: ORANGE_MONEY_CLIENT_ID
        sync: false
      - key: ORANGE_MONEY_CLIENT_SECRET
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_SERVICE_KEY
        sync: false
      - key: MEILISEARCH_URL
        sync: false
      - key: MEILISEARCH_API_KEY
        sync: false
      - key: SENTRY_DSN
        sync: false
      - key: APP_URL
        value: https://jogdoorwaar.com
      - key: NODE_ENV
        value: production

  # ─── SCRAPER WORKER ─────────────────────────────────────────────
  - type: worker
    name: jdw-scrapers
    runtime: node
    plan: starter           # 512 MB RAM — $7/mois
    buildCommand: cd apps/api && npm install && npm run build
    startCommand: cd apps/api && node dist/scraping/worker-entry.js
    envVars:
      - key: DATABASE_URL
        fromDatabase:
          name: jdw-postgres
          property: connectionString
      - key: REDIS_URL
        fromService:
          name: jdw-redis
          type: keyvalue
          property: connectionString
      - key: ANTHROPIC_API_KEY
        sync: false
      - key: OPENAI_API_KEY
        sync: false
      - key: MEILISEARCH_URL
        sync: false
      - key: MEILISEARCH_API_KEY
        sync: false

databases:
  # ─── POSTGRESQL + pgvector ──────────────────────────────────────
  - name: jdw-postgres
    plan: standard          # 4 GB stockage, 2 GB RAM — $20/mois
    databaseName: jogdoorwaar
    postgresMajorVersion: 16

  # ─── REDIS ──────────────────────────────────────────────────────
  - name: jdw-redis
    type: keyvalue
    plan: starter           # 100 MB — $10/mois
    ipAllowList: []         # Réseau privé Render uniquement
```

---

## Variables d'environnement complètes

```env
# ── Application ──────────────────────────────────────────────────
NODE_ENV=production
APP_URL=https://jogdoorwaar.com
PORT=3001

# ── Base de données ──────────────────────────────────────────────
DATABASE_URL=postgresql://user:pass@host:5432/jogdoorwaar
REDIS_URL=redis://default:pass@host:6379

# ── Search ───────────────────────────────────────────────────────
MEILISEARCH_URL=https://ms-xxx.meilisearch.io
MEILISEARCH_API_KEY=masterKey123

# ── Auth ─────────────────────────────────────────────────────────
JWT_SECRET=<généré automatiquement par Render>
JWT_REFRESH_SECRET=<généré automatiquement par Render>
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
LINKEDIN_CLIENT_ID=xxxxx
LINKEDIN_CLIENT_SECRET=xxxxx

# ── IA ───────────────────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-api03-xxx
OPENAI_API_KEY=sk-proj-xxx    # Pour embeddings text-embedding-3-small

# ── Notifications ────────────────────────────────────────────────
RESEND_API_KEY=re_xxx
WASENDER_API_KEY=<votre clé WaSender>
WASENDER_WEBHOOK_SECRET=<généré automatiquement par Render>
NOTIFICATION_FROM_EMAIL=alertes@jogdoorwaar.sn

# ── Paiements ────────────────────────────────────────────────────
WAVE_API_KEY=wave_sn_prod_xxx
ORANGE_MONEY_CLIENT_ID=<votre ID>
ORANGE_MONEY_CLIENT_SECRET=<votre secret>

# ── Storage ──────────────────────────────────────────────────────
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_KEY=eyJxxx
SUPABASE_STORAGE_BUCKET=jogdoorwaar-files

# ── Monitoring ───────────────────────────────────────────────────
SENTRY_DSN=https://xxx@sentry.io/xxx
POSTHOG_API_KEY=phc_xxx
```

---

## Pipeline GitHub Actions

```yaml
# .github/workflows/ci.yml
name: CI/CD Jog Door Waar

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: pgvector/pgvector:pg16
        env: { POSTGRES_DB: test, POSTGRES_USER: postgres, POSTGRES_PASSWORD: postgres }
        ports: ['5432:5432']
      redis:
        image: redis:7-alpine
        ports: ['6379:6379']
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20', cache: 'npm' }
      - run: npm ci
      - run: npx turbo run build --filter=shared-types
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test:coverage
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test
          REDIS_URL: redis://localhost:6379
      - uses: codecov/codecov-action@v3

  deploy-staging:
    needs: test
    if: github.ref == 'refs/heads/develop'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Staging
        run: |
          curl -X POST "${{ secrets.RENDER_STAGING_DEPLOY_HOOK_API }}"
          curl -X POST "${{ secrets.RENDER_STAGING_DEPLOY_HOOK_WEB }}"
          curl -X POST "${{ secrets.RENDER_STAGING_DEPLOY_HOOK_WORKER }}"

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - name: Deploy Production
        run: |
          curl -X POST "${{ secrets.RENDER_PROD_DEPLOY_HOOK_API }}"
          curl -X POST "${{ secrets.RENDER_PROD_DEPLOY_HOOK_WEB }}"
          curl -X POST "${{ secrets.RENDER_PROD_DEPLOY_HOOK_WORKER }}"
      - name: Notify Sentry Release
        run: |
          curl -sL https://sentry.io/get-cli/ | bash
          sentry-cli releases new ${{ github.sha }}
          sentry-cli releases finalize ${{ github.sha }}
```

---

## Estimation coûts Render.com

| Service | Plan | Prix/mois |
|---|---|---|
| Web (Next.js) | Standard 2GB | $25 |
| API (NestJS) | Standard 2GB | $25 |
| Worker (Scrapers) | Starter 512MB | $7 |
| PostgreSQL | Standard 4GB | $20 |
| Redis Key Value | Starter 100MB | $10 |
| Workspace | Professional 1 user | $19 |
| **TOTAL** | | **~$106/mois** |

---

## Post-déploiement : Activer pgvector

```sql
-- Se connecter au Render Postgres et exécuter :
CREATE EXTENSION IF NOT EXISTS vector;

-- Vérifier
SELECT * FROM pg_extension WHERE extname = 'vector';
```

## Prisma Seed (SuperAdmin initial)

```typescript
// apps/api/prisma/seed.ts
async function main() {
  const hash = await bcrypt.hash(process.env.SUPERADMIN_PASSWORD!, 12);
  await prisma.user.upsert({
    where: { email: process.env.SUPERADMIN_EMAIL! },
    create: {
      email: process.env.SUPERADMIN_EMAIL!,
      passwordHash: hash,
      firstName: 'Super',
      lastName: 'Admin',
      role: 'SUPERADMIN',
      emailVerified: true,
      isActive: true,
    },
    update: {}
  });
  console.log('✅ SuperAdmin créé');
}
main().catch(console.error).finally(() => prisma.$disconnect());
```

```bash
# Exécuter le seed
npx prisma db seed

# Variables à ajouter :
SUPERADMIN_EMAIL=admin@jogdoorwaar.sn
SUPERADMIN_PASSWORD=<mot de passe fort>
```

## Configurer WaSender Webhook

Dans le dashboard WaSender :
```
Webhook URL    : https://api.jogdoorwaar.com/webhook/whatsapp
Events         : messages.upsert
Secret         : valeur de WASENDER_WEBHOOK_SECRET
```

## Configurer Meilisearch Index

```typescript
// Script à exécuter une fois au démarrage
await meilisearch.createIndex('jobs', { primaryKey: 'id' });
await meilisearch.index('jobs').updateSettings({
  searchableAttributes: ['title', 'company', 'description', 'city', 'requiredSkills'],
  filterableAttributes: ['jobType', 'workMode', 'city', 'sector', 'sourcePlatform', 'isActive', 'publishedAt'],
  sortableAttributes: ['publishedAt', 'salaryMin', 'viewCount'],
  rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
});
```
