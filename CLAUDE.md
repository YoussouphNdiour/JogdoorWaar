# CLAUDE.md — Jog Door Waar
> **"Aujourd'hui il y a du travail"** — Agrégateur IA d'offres d'emploi, marché sénégalais.

## SETUP IMMÉDIAT (lire en premier)

```bash
# 1. Installer les plugins Claude Code
/plugin marketplace add wshobson/agents
/plugin marketplace add nextlevelbuilder/ui-ux-pro-max-skill

# 2. Installer les agents essentiels
/plugin install backend-development@claude-code-workflows
/plugin install javascript-typescript@claude-code-workflows
/plugin install full-stack-orchestration@claude-code-workflows
/plugin install security-scanning@claude-code-workflows
/plugin install python-development@claude-code-workflows
/plugin install ui-ux-pro-max@ui-ux-pro-max-skill

# 3. Initialiser le design system (direction "Afro-Digital Warmth")
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "job board africa senegal mobile" \
  --design-system -p "JogDoorWaar" --persist
```

## SOUS-DOCUMENTS (utiliser @ pour les charger)

| Fichier | Contenu |
|---|---|
| `@docs/SCHEMA.md` | Schéma Prisma complet (User, Job, CV, WhatsApp, etc.) |
| `@docs/MODULES.md` | Routes API, guards, DTOs NestJS |
| `@docs/AI.md` | Matching IA, bot WhatsApp, multi-CV |
| `@docs/SCRAPING.md` | Architecture scrapers, déduplication |
| `@docs/DESIGN.md` | Design tokens, composants, UX flows |
| `@docs/DEPLOY.md` | render.yaml, CI/CD, variables d'env |

---

## STACK

```
Frontend  : Next.js 14 (App Router) · TypeScript · Tailwind · Shadcn/UI · Framer Motion
Backend   : NestJS · TypeScript · REST + GraphQL · BullMQ · Socket.IO
DB        : PostgreSQL 16 + pgvector · Redis (Render Key Value) · Meilisearch
Storage   : Supabase Storage (CVs multiples, logos)
IA        : Anthropic claude-sonnet-4-20250514 · OpenAI text-embedding-3-small
Notifs    : Resend (email) · WaSender API (WhatsApp bot interactif)
Paiements : Wave · Orange Money · Stripe (fallback)
Infra     : Render.com (Web + Worker + Postgres + KeyValue)
Monitoring: Sentry · PostHog
```

---

## STRUCTURE MONOREPO

```
jog-door-waar/
├── CLAUDE.md                    ← Ce fichier
├── docs/
│   ├── SCHEMA.md               ← Prisma schema complet
│   ├── MODULES.md              ← API routes & modules NestJS
│   ├── AI.md                   ← IA matching + bot WhatsApp
│   ├── SCRAPING.md             ← Scrapers + déduplication
│   ├── DESIGN.md               ← Design system + UX
│   └── DEPLOY.md               ← Render.yaml + CI/CD + env
├── render.yaml                 ← IaC Render.com
├── .claude/
│   └── skills/ui-ux-pro-max/  ← Skill UI/UX Pro Max (auto-install)
├── apps/
│   ├── web/                    ← Next.js 14
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── (candidate)/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── jobs/
│   │   │   │   ├── applications/
│   │   │   │   ├── alerts/
│   │   │   │   └── profile/cvs/
│   │   │   ├── (recruiter)/
│   │   │   ├── (admin)/
│   │   │   │   └── admin/
│   │   │   └── api/           ← Next.js API routes (auth callbacks)
│   │   └── components/
│   │       ├── jobs/
│   │       ├── cvs/
│   │       ├── alerts/
│   │       ├── applications/
│   │       ├── ai/
│   │       └── shared/
│   └── api/                    ← NestJS backend
│       ├── src/
│       │   ├── auth/
│       │   ├── jobs/
│       │   ├── cvs/
│       │   ├── ai/
│       │   ├── scraping/
│       │   ├── notifications/
│       │   ├── whatsapp/
│       │   ├── payments/
│       │   └── admin/
│       └── prisma/
├── packages/
│   ├── shared-types/
│   ├── ui/
│   └── config/
├── docker-compose.yml
└── turbo.json
```

---

## AGENTS ACTIFS (wshobson/agents)

Utiliser ces agents selon la tâche :

| Agent | Tâche |
|---|---|
| `backend-architect` | Architecture NestJS, modules, guards |
| `typescript-pro` | Types stricts, DTOs, interfaces |
| `python-pro` | Scripts de scraping Playwright/Cheerio |
| `security-auditor` | Vérification auth, injection, secrets |
| `database-architect` | Schéma Prisma, index, requêtes pgvector |
| `full-stack-orchestration` | Feature complète end-to-end |
| `code-reviewer` | Revue avant commit |

Commande orchestration complète :
```
/full-stack-orchestration:full-stack-feature "module X de Jog Door Waar"
```

---

## UI/UX PRO MAX (design rules)

Le skill UI/UX Pro Max s'active automatiquement pour toute tâche frontend.

**Direction artistique fixée : "Afro-Digital Warmth"**
- Style : Soft UI Evolution + Bento Grid
- Couleurs : Terre cuite `#E8580A` · Vert savane `#1B4332` · Or `#F5C842` · Sable `#FDFAF6`
- Typo : Syne (titres) + DM Sans (corps)
- Anti-patterns : JAMAIS de gradients purple/AI, JAMAIS Inter/Roboto

Générer le design system complet pour une page :
```
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "job board senegal" \
  --design-system -f markdown --page "dashboard"
```

---

## RÈGLES DE DÉVELOPPEMENT

```
1. TypeScript strict mode — pas de `any`
2. Toute route API → guard JWT + validation Zod
3. Toutes les clés API → variables d'env, JAMAIS dans le code
4. Chaque scraper → délai 2-5s entre requêtes, respecter robots.txt
5. Réponse WhatsApp bot → max 200ms (webhook async, répondre 200 immédiatement)
6. Toute feature IA → logger l'usage (tokens input/output) dans AiUsageLog
7. Upload CV → extraire texte + générer embedding automatiquement
8. Test unitaire minimum avant PR (80% coverage requis)
9. Données sensibles (téléphone, WhatsApp) → chiffrées AES-256 en base
10. Mode anonyme → masquer identité dans logs et métadonnées d'accès
```

---

## PLANS & PRICING

| Fonctionnalité | FREE | PREMIUM | RECRUTEUR |
|---|:---:|:---:|:---:|
| Offres illimitées | ✅ | ✅ | ✅ |
| Alertes email | 2 max | ✅ | ✅ |
| Alertes WhatsApp | ✅ | ✅ | ✅ |
| CVs uploadables | 2 max | Illimité | Illimité |
| Candidature WhatsApp | ✅ | ✅ | ✅ |
| CVs générés par IA | 1/mois | 10/mois | Illimité |
| Score matching détaillé | Aperçu | ✅ | ✅ |
| Lettre de motivation IA | 2/mois | 10/mois | ✅ |
| Coach entretien IA | ❌ | 5/mois | ✅ |
| Mode anonyme | ❌ | ✅ | — |
| CRM candidatures | 10 max | Illimité | — |
| Publication offres | ❌ | ❌ | 10/mois |
| **Prix** | **Gratuit** | **3 500 FCFA/mois** | **15 000 FCFA/mois** |

---

## SPRINTS

```
Sprint 1 (S1-S2) — Fondations
  → Monorepo Turborepo + Prisma schema (voir @docs/SCHEMA.md)
  → Auth JWT + Google OAuth
  → 3 scrapers MVP : emploisenegal, emploidakar, senjob
  → API /jobs + /search Meilisearch
  → Design system + Landing + Dashboard squelette

Sprint 2 (S3-S4) — IA & Multi-CV
  → Module /cvs : upload PDF, extraction, embedding, analyse IA
  → CVSelectorService : sélection intelligente + génération adaptée
  → Matching vectoriel pgvector
  → Alertes email (Resend)
  → Résumé automatique des offres

Sprint 3 (S5-S6) — Bot WhatsApp
  → Webhook WaSender sécurisé (HMAC)
  → Machine à états WhatsApp (Redis + PostgreSQL)
  → Notifications avec boutons interactifs [Postuler] [Sauvegarder]
  → Flux candidature complet depuis WhatsApp
  → Génération CV adapté depuis WhatsApp

Sprint 4 (S7-S8) — Premium & Admin
  → Générateur lettre + Coach entretien (PREMIUM)
  → CRM Kanban candidatures
  → Paiements Wave + Orange Money
  → SuperAdmin backoffice complet
  → Tests E2E + déploiement Render.com production
  → Scrapers restants (10 sources)
```

---

## SOURCES À SCRAPER

| Site | URL | Méthode |
|---|---|---|
| Emploi Sénégal | emploisenegal.com | Cheerio |
| Emploi Dakar | emploidakar.com | Cheerio |
| SenJob | senjob.com | Cheerio |
| Expat Dakar | expat-dakar.com/emploi | Cheerio |
| SeneJobs | senejobs.com | Cheerio |
| AfriRH | afrirh.com | Cheerio |
| Emploi-Sen | emploi-sen.com | Cheerio |
| SenInterim | seninterim.sn | Playwright |
| SenRH | senrh.sn | Cheerio |
| LinkedIn | linkedin.com/jobs?location=senegal | Playwright |
| Facebook Groups | Emploi Sénégal groups | Playwright + Vision IA |

---

## RÉFÉRENCES CLÉS

- WaSender API : https://wasenderapi.com/api-docs
- Anthropic : https://docs.anthropic.com
- Resend : https://resend.com/docs
- Meilisearch : https://www.meilisearch.com/docs
- Render.com : https://render.com/docs
- pgvector : https://github.com/pgvector/pgvector
- UI/UX Pro Max : https://github.com/nextlevelbuilder/ui-ux-pro-max-skill
- Agents : https://github.com/wshobson/agents
