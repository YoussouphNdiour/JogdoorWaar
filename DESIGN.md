# DESIGN.md — Design System Jog Door Waar

## Skill UI/UX Pro Max — Usage

```bash
# Générer design system pour une page spécifique
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "job board africa senegal" \
  --design-system -p "JogDoorWaar" -f markdown --page "dashboard" --persist

# Rechercher un style spécifique
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "soft ui evolution" --domain style

# Stack Next.js spécifique
python3 .claude/skills/ui-ux-pro-max/scripts/search.py "responsive layout" --stack react
```

Après génération, le fichier `design-system/MASTER.md` fait autorité.
Pages avec override : `design-system/pages/[page-name].md`.

---

## Direction artistique : "Afro-Digital Warmth"

Une interface qui respire l'Afrique de l'Ouest moderne — chaleureuse, professionnelle, mobile-first.

**Style catégorie :** Soft UI Evolution + Bento Grid  
**Anti-patterns STRICTS :** Jamais de gradients purple/pink/AI, jamais Inter/Roboto/Arial, jamais de dark mode par défaut.

---

## Design Tokens CSS

```css
:root {
  /* Couleurs principales */
  --color-primary:        #E8580A;  /* Terre cuite sénégalaise */
  --color-primary-dark:   #BF4507;
  --color-primary-light:  #F4834A;
  --color-secondary:      #1B4332;  /* Vert savane */
  --color-secondary-light:#2D6A4F;
  --color-accent:         #F5C842;  /* Or baobab */
  --color-accent-dark:    #D4A017;

  /* Surfaces */
  --color-surface:        #FDFAF6;  /* Blanc sable */
  --color-surface-alt:    #F2EDE6;
  --color-surface-hover:  #EDE5D8;
  --color-border:         #E0D5C5;

  /* Texte */
  --color-text-primary:   #1A1208;
  --color-text-secondary: #6B5E4A;
  --color-text-muted:     #9C8E7D;
  --color-text-inverse:   #FDFAF6;

  /* Sémantique */
  --color-success:        #16A34A;
  --color-warning:        #D97706;
  --color-error:          #DC2626;
  --color-info:           #2563EB;

  /* Match score */
  --color-match-high:     #16A34A;  /* ≥ 80% */
  --color-match-medium:   #D97706;  /* 50-79% */
  --color-match-low:      #DC2626;  /* < 50% */

  /* Typographie */
  --font-display:         'Syne', sans-serif;
  --font-body:            'DM Sans', sans-serif;
  --font-mono:            'JetBrains Mono', monospace;

  /* Tailles typo */
  --text-xs:   0.75rem;
  --text-sm:   0.875rem;
  --text-base: 1rem;
  --text-lg:   1.125rem;
  --text-xl:   1.25rem;
  --text-2xl:  1.5rem;
  --text-3xl:  1.875rem;
  --text-4xl:  2.25rem;

  /* Espacement */
  --radius-sm:  6px;
  --radius-md:  12px;
  --radius-lg:  20px;
  --radius-xl:  32px;
  --radius-full: 9999px;

  /* Ombres */
  --shadow-sm:  0 1px 3px rgba(26,18,8,0.08);
  --shadow-md:  0 4px 12px rgba(26,18,8,0.10);
  --shadow-lg:  0 8px 24px rgba(26,18,8,0.12);
  --shadow-xl:  0 16px 48px rgba(26,18,8,0.15);

  /* Animations */
  --transition-fast:   150ms ease;
  --transition-base:   250ms ease;
  --transition-slow:   400ms ease;
}
```

## Google Fonts Import

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;500;600;700;800&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
```

---

## Pages & Routes Frontend

| Page | Route | Layout | Accès |
|---|---|---|---|
| Landing | `/` | Public | Tous |
| Inscription multi-step | `/register` | Auth | Non connecté |
| Dashboard | `/dashboard` | Candidate | Connecté |
| Offres | `/jobs` | Candidate | Tous |
| Fiche offre | `/jobs/[id]` | Candidate | Tous |
| Alertes | `/alerts` | Candidate | Connecté |
| Mes CVs | `/profile/cvs` | Candidate | Connecté |
| CRM Candidatures | `/applications` | Candidate | Connecté |
| Profil | `/profile` | Candidate | Connecté |
| Premium | `/premium` | Public | Tous |
| Espace recruteur | `/recruiter` | Recruiter | RECRUITER |
| SuperAdmin | `/admin` | Admin | SUPERADMIN |

---

## Onboarding (4 étapes)

```
1. Infos de base     → Nom, ville, poste recherché, type contrat
2. Upload CV         → Drag & drop PDF (optionnel, mais +30% matching quality)
3. Première alerte   → Mots-clés, ville, type, fréquence
4. WhatsApp          → Numéro + OTP (optionnel, débloque alertes WA)
   → Dashboard avec premières recommandations IA
```

---

## Composants par module

### Jobs
```
JobCard         → Carte avec score matching badge, source, résumé court, actions rapides
JobList         → Liste virtualisée (react-window) pour grandes listes
JobFilter       → Panneau filtres sidebar (mobile: drawer)
JobDetail       → Fiche complète : résumé IA, score détaillé, boutons action
JobMatchBadge   → Anneau SVG animé avec score coloré
JobSummaryAI    → Résumé bullet points avec skeleton loading
SourceBadge     → Badge plateforme source (logo + nom)
```

### CVs (Multi-CV)
```
CVCard          → Carte CV : miniature PDF, compétences détectées, score vs offre en cours, badge défaut
CVGrid          → Grille responsive de tous les CVs
CVUploader      → Drag & drop PDF avec progress bar upload
CVAnalysisPanel → Compétences IA détectées + secteurs + types de postes
CVGeneratorModal→ Modal: choisir CV de base + offre → générer → voir diff
CVAdaptedBadge  → Badge "Généré par IA" avec info modifications
CVDefaultBadge  → Badge étoile "CV par défaut"
```

### Dashboard
```
RecommendedJobs    → Carousel top 5 offres matchées du jour
ApplicationKanban  → Board DnD (react-beautiful-dnd) avec colonnes par status
AlertsSummary      → Cartes alertes actives + derniers résultats
StatsCards         → Métriques : offres vues, postulé, entretiens, taux réponse
WhatsAppStatus     → Statut connexion WA + lien vérification
```

### Admin Backoffice
```
MetricsDashboard   → Grid KPIs temps réel (WebSocket) + graphiques Recharts
ScraperMonitor     → Table scrapers avec statut, dernière exécution, logs, bouton run
UsersTable         → DataTable avec search, filter, actions bulk
JobsManager        → Table offres avec modération (verify, boost, delete)
SubscriptionChart  → Revenue chart (Wave + OM) par mois
AnalyticsFunnel    → Funnel conversion Inscription→Alerte→Premium
```

---

## Checklist UI pré-livraison (UI/UX Pro Max rules)

```
□ Aucun emoji utilisé comme icône → SVG Lucide/Heroicons uniquement
□ cursor-pointer sur tous les éléments cliquables
□ Hover states avec transition 150-250ms
□ Contraste texte minimum 4.5:1 (WCAG AA)
□ Focus states visibles (keyboard navigation)
□ prefers-reduced-motion respecté
□ Responsive testé : 375px / 768px / 1024px / 1440px
□ Skeleton loading sur tous les composants async
□ États vides (empty states) avec illustration + CTA
□ Formulaires : validation inline Zod + messages d'erreur clairs
□ Images : alt text descriptif, lazy loading, formats WebP
□ Aucune donnée mockée en production
```

---

## Animations Framer Motion

```typescript
// Constantes réutilisables
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }
};

export const staggerChildren = {
  animate: { transition: { staggerChildren: 0.07 } }
};

export const scoreRingVariants = {
  initial: { pathLength: 0 },
  animate: (score: number) => ({
    pathLength: score / 100,
    transition: { duration: 1.2, ease: 'easeOut', delay: 0.3 }
  })
};
```

---

## UX Parcours quotidien (retention loop)

```
Notification WhatsApp reçue (boutons interactifs)
  ↓
[✅ Postuler] → Bot WhatsApp guide jusqu'à candidature
  ↓
CRM mis à jour automatiquement (status "Postulé via WhatsApp")
  ↓
Dashboard → Email hebdomadaire "Votre semaine en chiffres"
  ↓
Relance : "Vous avez 3 candidatures sans suivi depuis 7 jours"
```
