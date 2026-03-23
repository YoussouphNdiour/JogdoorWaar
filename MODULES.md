# MODULES.md — API NestJS Routes & Modules

## Structure des modules

```
src/
├── app.module.ts
├── auth/           → Authentification JWT + OAuth
├── jobs/           → Offres d'emploi + recherche
├── cvs/            → Multi-CV upload + analyse IA
├── ai/             → Matching, résumé, lettre, coach
├── alerts/         → Alertes et préférences
├── applications/   → CRM candidatures
├── scraping/       → Workers BullMQ + CRON
├── notifications/  → Email + WhatsApp dispatch
├── whatsapp/       → Bot WhatsApp (state machine)
├── payments/       → Wave + Orange Money
├── recruiter/      → Espace recruteur
└── admin/          → SuperAdmin backoffice
```

---

## Module AUTH `/auth`

```
POST /auth/register           → Inscription email/password
POST /auth/login              → Connexion → {accessToken, refreshToken}
POST /auth/logout             → Invalider refresh token
POST /auth/refresh            → Renouveler access token (cookie httpOnly)
POST /auth/forgot-password    → Envoyer lien reset par email
POST /auth/reset-password     → Réinitialiser avec token
GET  /auth/google             → Redirect OAuth Google
GET  /auth/google/callback    → Callback Google
GET  /auth/linkedin           → Redirect OAuth LinkedIn
GET  /auth/linkedin/callback  → Callback LinkedIn
POST /auth/verify-email       → Vérifier OTP email (6 chiffres)
POST /auth/verify-whatsapp    → Vérifier OTP WhatsApp (via WaSender)
GET  /auth/me                 → Profil utilisateur connecté
```

**Guards :** `JwtAuthGuard`, `RolesGuard`, `ThrottlerGuard`
**Sécurité :** Rate limiting 5 req/heure/IP sur login. JWT 15min + Refresh 30j (httpOnly cookie).

---

## Module JOBS `/jobs`

```
GET    /jobs                  → Liste paginée + filtres
GET    /jobs/recommended      → Top 10 offres matchées (JWT requis)
GET    /jobs/search           → Full-text Meilisearch
GET    /jobs/:id              → Détail offre
GET    /jobs/:id/similar      → Offres similaires (pgvector)
POST   /jobs/:id/save         → Sauvegarder
DELETE /jobs/:id/save         → Retirer favoris
POST   /jobs/:id/click        → Tracker clic + redirect source
GET    /jobs/saved            → Mes offres sauvegardées
```

**Filtres GET /jobs :**
```typescript
interface JobFilters {
  q?: string;
  location?: string;
  jobType?: JobType[];
  workMode?: WorkMode[];
  sector?: string[];
  salaryMin?: number;
  salaryMax?: number;
  yearsExp?: number;
  publishedAfter?: 'last24h' | 'lastWeek' | 'lastMonth';
  source?: SourcePlatform[];
  sortBy?: 'relevance' | 'date' | 'salary' | 'matchScore';
  page?: number;
  limit?: number; // max 50
}
```

---

## Module CVS `/cvs`

```
GET    /cvs                   → Liste mes CVs (avec scores par défaut)
POST   /cvs/upload            → Upload PDF → extraction + embedding + analyse IA auto
PUT    /cvs/:id               → Renommer / modifier métadonnées
DELETE /cvs/:id               → Supprimer (interdit si dernier CV)
PATCH  /cvs/:id/set-default   → Définir CV par défaut
GET    /cvs/:id/analysis      → Compétences détectées, score, secteurs
POST   /cvs/:id/adapt-for-job → Générer version adaptée pour une offre (PREMIUM)
GET    /cvs/:id/download      → Télécharger PDF
GET    /cvs/:id/match/:jobId  → Score de ce CV spécifique vs cette offre
```

**Middleware upload :** `multer` avec filtre `.pdf` uniquement, limite 5MB.
**Logique :** Upload → `pdf-parse` → embedding OpenAI → analyse Claude → save Prisma.

---

## Module AI `/ai`

```
GET  /ai/match/:jobId         → Score matching utilisateur ↔ offre
GET  /ai/recommendations      → Top 10 recommandations du jour (cache Redis 1h)
POST /ai/cover-letter         → Lettre de motivation { jobId, cvId? } (PREMIUM)
POST /ai/cv-analysis          → Analyse + conseils amélioration CV (PREMIUM)
GET  /ai/job-summary/:jobId   → Résumé IA d'une offre (cache Redis 24h)
POST /ai/interview-coach      → Kit entretien { jobId } (PREMIUM)
POST /ai/select-cv            → Recommander meilleur CV pour une offre { jobId }
POST /ai/generate-adapted-cv  → Générer CV adapté { jobId, baseCvId } (PREMIUM)
```

**Rate limiting :**
- FREE : 20 req IA/heure
- PREMIUM : 100 req IA/heure

---

## Module ALERTS `/alerts`

```
GET    /alerts                → Mes alertes actives
POST   /alerts                → Créer alerte
PUT    /alerts/:id            → Modifier alerte
DELETE /alerts/:id            → Supprimer
PATCH  /alerts/:id/toggle     → Activer / Désactiver
POST   /alerts/:id/test       → Envoyer notification test (email + WhatsApp si actif)
GET    /alerts/stats          → Stats : offres trouvées par alerte cette semaine
```

---

## Module APPLICATIONS `/applications`

```
GET    /applications          → Mon CRM : toutes candidatures avec statut
POST   /applications          → Créer candidature manuelle
PUT    /applications/:id      → Changer statut / notes
DELETE /applications/:id      → Supprimer
GET    /applications/stats    → Métriques : nb par statut, taux réponse, délai moyen
GET    /applications/kanban   → Vue Kanban (groupé par ApplicationStatus)
```

---

## Module WHATSAPP `/webhook/whatsapp`

```
POST /webhook/whatsapp        → Webhook WaSender (vérification HMAC + dispatch async)
```

Le bot est une **machine à états** (voir @docs/AI.md). Configuration WaSender :
- URL webhook : `https://api.jogdoorwaar.com/webhook/whatsapp`
- Secret HMAC : `process.env.WASENDER_WEBHOOK_SECRET`

---

## Module PAYMENTS `/payments`

```
POST /payments/wave/create    → Créer lien paiement Wave { plan, userId }
POST /payments/wave/webhook   → Webhook Wave (confirmation paiement)
POST /payments/orange/create  → Créer lien paiement Orange Money
POST /payments/orange/webhook → Webhook Orange Money
GET  /payments/status         → Statut abonnement actuel
POST /payments/cancel         → Annuler abonnement
```

---

## Module RECRUITER `/recruiter`

Accessible uniquement avec `role = RECRUITER`.

```
GET  /recruiter/jobs          → Mes offres publiées
POST /recruiter/jobs          → Publier offre directe
PUT  /recruiter/jobs/:id      → Modifier offre
DEL  /recruiter/jobs/:id      → Supprimer / archiver
POST /recruiter/jobs/:id/boost→ Mettre en avant { days: 7|14|30 } → paiement Wave
GET  /recruiter/jobs/:id/stats→ Vues, clics, candidatures reçues
```

---

## Module ADMIN `/admin`

Accessible uniquement avec `role = SUPERADMIN`. Utiliser `SuperAdminGuard`.

```
# Dashboard
GET /admin/dashboard/metrics  → Métriques temps réel (WebSocket disponible)
GET /admin/dashboard/charts   → Données graphiques (inscriptions, offres, revenus)

# Offres
GET    /admin/jobs            → Toutes offres (filtres avancés)
PATCH  /admin/jobs/:id        → Modifier (verify, archive, boost, delete)
POST   /admin/jobs/:id/rescrape → Forcer re-scraping source

# Scrapers
GET    /admin/scrapers        → Statut + dernière exécution de chaque scraper
POST   /admin/scrapers/:platform/run → Exécuter maintenant
PATCH  /admin/scrapers/:platform/toggle → Activer / Désactiver
GET    /admin/scrapers/:platform/logs   → Logs des 50 dernières exécutions

# Utilisateurs
GET    /admin/users           → Liste (search, filter par plan/role)
GET    /admin/users/:id       → Profil complet + logs d'activité
PATCH  /admin/users/:id/plan  → Changer plan
PATCH  /admin/users/:id/status→ Activer / Désactiver compte
POST   /admin/users/:id/message → Envoyer email ou WhatsApp
GET    /admin/users/export    → Export CSV

# Abonnements
GET /admin/subscriptions      → Tous abonnements actifs
GET /admin/subscriptions/revenue → Revenus par mois (Wave + Orange Money)

# Configuration
GET  /admin/settings          → Config système
PUT  /admin/settings          → Modifier paramètres scrapers, quotas IA, templates

# Analytics
GET /admin/analytics/funnel   → Funnel acquisition (Inscription → Alerte → Premium)
GET /admin/analytics/jobs     → Offres les plus consultées
GET /admin/analytics/keywords → Mots-clés recherche populaires
GET /admin/analytics/retention→ Cohortes rétention (30/60/90j)
GET /admin/analytics/whatsapp → Taux conversion bot WhatsApp
```

---

## DTOs principaux (TypeScript)

```typescript
// Créer une alerte
export class CreateAlertDto {
  @IsString() name: string;
  @IsArray() @IsString({ each: true }) keywords: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() excludeKeywords?: string[];
  @IsArray() @IsString({ each: true }) @IsOptional() locations?: string[];
  @IsArray() @IsEnum(JobType, { each: true }) @IsOptional() jobTypes?: JobType[];
  @IsBoolean() @IsOptional() notifyByEmail?: boolean;
  @IsBoolean() @IsOptional() notifyByWhatsapp?: boolean;
  @IsEnum(AlertFrequency) @IsOptional() frequency?: AlertFrequency;
}

// Upload CV
export class UploadCVDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsString() @MaxLength(24) @IsOptional() label?: string;
  @IsString() @IsOptional() description?: string;
}

// Candidature
export class CreateApplicationDto {
  @IsString() jobId: string;
  @IsString() @IsOptional() cvId?: string;
  @IsEnum(ApplicationStatus) @IsOptional() status?: ApplicationStatus;
  @IsString() @IsOptional() notes?: string;
}
```
