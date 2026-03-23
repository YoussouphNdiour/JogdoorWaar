import Link from 'next/link';
import { Search, Zap, Bell, MessageCircle, ArrowRight, CheckCircle } from 'lucide-react';

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-sand">
      {/* ─── Nav ──────────────────────────────────────────────── */}
      <nav className="sticky top-0 z-50 bg-sand/80 backdrop-blur-md border-b border-sand-dark">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <span className="font-syne text-xl font-bold text-savane">Jog Door Waar</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auth/login"
              className="font-dm text-sm text-savane hover:text-terracotta transition-colors"
            >
              Connexion
            </Link>
            <Link
              href="/auth/register"
              className="font-dm text-sm bg-terracotta text-white px-4 py-2 rounded-xl hover:bg-terracotta-600 transition-colors"
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>
      </nav>

      {/* ─── Hero ─────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 bg-terracotta/10 text-terracotta px-4 py-1.5 rounded-full text-sm font-dm mb-8">
            <Zap className="h-3.5 w-3.5" />
            Propulsé par l'IA · Marché sénégalais
          </div>

          <h1 className="font-syne text-5xl md:text-6xl font-bold text-savane leading-tight mb-6 text-balance">
            Aujourd'hui{' '}
            <span className="text-terracotta">il y a du travail</span>
          </h1>

          <p className="font-dm text-lg text-savane/70 mb-10 text-balance">
            Agrégateur intelligent des meilleures offres d'emploi au Sénégal.
            Matching par IA, alertes WhatsApp, candidatures en 1 clic.
          </p>

          {/* Search Bar */}
          <div className="flex gap-3 max-w-2xl mx-auto">
            <div className="flex-1 relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-savane/40" />
              <input
                type="text"
                placeholder="Titre de poste, compétence, entreprise…"
                className="w-full pl-11 pr-4 py-3.5 bg-white rounded-xl border border-sand-dark font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
            <button className="bg-terracotta text-white px-6 py-3.5 rounded-xl font-dm font-semibold hover:bg-terracotta-600 transition-colors whitespace-nowrap">
              Chercher
            </button>
          </div>

          <p className="font-dm text-sm text-savane/50 mt-4">
            +10 sources · emploisenegal.com · emploidakar.com · LinkedIn · et plus
          </p>
        </div>
      </section>

      {/* ─── Stats ────────────────────────────────────────────── */}
      <section className="bg-savane text-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-3 gap-8 text-center">
            {[
              { value: '2 000+', label: 'Offres actives' },
              { value: '10', label: 'Sources scrappées' },
              { value: '<1min', label: 'Temps moyen candidature' },
            ].map(({ value, label }) => (
              <div key={label}>
                <div className="font-syne text-3xl font-bold text-gold">{value}</div>
                <div className="font-dm text-sm text-white/70 mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Features Bento ───────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-14">
          <h2 className="font-syne text-3xl font-bold text-savane mb-3">
            Tout ce dont vous avez besoin
          </h2>
          <p className="font-dm text-savane/60">
            Du scraping temps réel à la candidature WhatsApp, en passant par le matching IA.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Feature 1 */}
          <div className="bg-white rounded-3xl p-8 shadow-soft border border-sand-dark md:col-span-2">
            <div className="w-12 h-12 bg-terracotta/10 rounded-2xl flex items-center justify-center mb-6">
              <Zap className="h-6 w-6 text-terracotta" />
            </div>
            <h3 className="font-syne text-xl font-bold text-savane mb-3">
              Matching IA personnalisé
            </h3>
            <p className="font-dm text-savane/60 leading-relaxed">
              Notre IA analyse votre CV et calcule un score de compatibilité pour chaque offre.
              Algorithme hybride : similarité vectorielle + analyse Claude Sonnet.
            </p>
            <div className="mt-6 flex gap-2 flex-wrap">
              {['pgvector', 'Anthropic Claude', 'OpenAI Embeddings'].map((tag) => (
                <span
                  key={tag}
                  className="text-xs font-dm bg-terracotta/10 text-terracotta px-3 py-1 rounded-full"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Feature 2 */}
          <div className="bg-terracotta rounded-3xl p-8 text-white">
            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
              <MessageCircle className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-syne text-xl font-bold mb-3">Bot WhatsApp</h3>
            <p className="font-dm text-white/80 text-sm leading-relaxed">
              Recevez des alertes et postulez directement depuis WhatsApp. Zéro friction.
            </p>
          </div>

          {/* Feature 3 */}
          <div className="bg-gold/20 rounded-3xl p-8 border border-gold/30">
            <div className="w-12 h-12 bg-gold/30 rounded-2xl flex items-center justify-center mb-6">
              <Bell className="h-6 w-6 text-savane" />
            </div>
            <h3 className="font-syne text-xl font-bold text-savane mb-3">
              Alertes intelligentes
            </h3>
            <p className="font-dm text-savane/60 text-sm leading-relaxed">
              Configurez vos critères une fois. Recevez les meilleures offres par email ou WhatsApp.
            </p>
          </div>

          {/* Feature 4 */}
          <div className="bg-savane rounded-3xl p-8 text-white md:col-span-2">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
              <ArrowRight className="h-6 w-6 text-white" />
            </div>
            <h3 className="font-syne text-xl font-bold mb-3">Multi-CV intelligent</h3>
            <p className="font-dm text-white/70 leading-relaxed">
              Uploadez plusieurs CVs. L'IA sélectionne et adapte automatiquement le meilleur pour chaque offre.
              Génération de lettre de motivation personnalisée incluse.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────────────────── */}
      <section className="bg-sand-dark py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <h2 className="font-syne text-3xl font-bold text-savane mb-3">Tarifs simples</h2>
            <p className="font-dm text-savane/60">Commencez gratuitement. Passez Premium quand vous êtes prêt.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {[
              {
                name: 'Gratuit',
                price: '0',
                period: 'toujours',
                features: ['Offres illimitées', '2 alertes email', '2 CVs max', 'Alertes WhatsApp', 'Score matching (aperçu)'],
                cta: 'Commencer',
                highlight: false,
              },
              {
                name: 'Premium',
                price: '3 500',
                period: 'FCFA/mois',
                features: ['Tout le gratuit', 'Alertes illimitées', 'CVs illimités', 'Score matching détaillé', '10 CVs IA/mois', '10 lettres/mois', 'Mode anonyme', 'Coach entretien (5/mois)'],
                cta: 'Passer Premium',
                highlight: true,
              },
              {
                name: 'Recruteur',
                price: '15 000',
                period: 'FCFA/mois',
                features: ['10 offres/mois', 'Analytics candidatures', 'Accès candidats', 'Boost offres', 'Support prioritaire'],
                cta: 'Recruter maintenant',
                highlight: false,
              },
            ].map(({ name, price, period, features, cta, highlight }) => (
              <div
                key={name}
                className={`rounded-3xl p-8 ${
                  highlight
                    ? 'bg-terracotta text-white ring-4 ring-terracotta/30 scale-[1.02]'
                    : 'bg-white border border-sand-dark'
                }`}
              >
                <div className={`font-dm text-sm mb-1 ${highlight ? 'text-white/70' : 'text-savane/50'}`}>
                  {name}
                </div>
                <div className="mb-6">
                  <span className={`font-syne text-4xl font-bold ${highlight ? 'text-white' : 'text-savane'}`}>
                    {price}
                  </span>
                  <span className={`font-dm text-sm ml-1 ${highlight ? 'text-white/70' : 'text-savane/50'}`}>
                    {period}
                  </span>
                </div>
                <ul className="space-y-3 mb-8">
                  {features.map((f) => (
                    <li key={f} className="flex items-center gap-2 font-dm text-sm">
                      <CheckCircle
                        className={`h-4 w-4 flex-shrink-0 ${highlight ? 'text-white/80' : 'text-terracotta'}`}
                      />
                      <span className={highlight ? 'text-white/90' : 'text-savane/70'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/auth/register"
                  className={`block text-center py-3 rounded-xl font-dm font-semibold transition-colors ${
                    highlight
                      ? 'bg-white text-terracotta hover:bg-sand'
                      : 'bg-savane text-white hover:bg-savane-600'
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Footer ───────────────────────────────────────────── */}
      <footer className="bg-savane text-white py-12">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <div className="font-syne text-xl font-bold">Jog Door Waar</div>
              <div className="font-dm text-sm text-white/50 mt-1">
                Aujourd'hui il y a du travail — Dakar, Sénégal
              </div>
            </div>
            <div className="flex gap-6 font-dm text-sm text-white/60">
              <Link href="/jobs" className="hover:text-white transition-colors">Offres</Link>
              <Link href="/auth/login" className="hover:text-white transition-colors">Connexion</Link>
              <Link href="/auth/register" className="hover:text-white transition-colors">Inscription</Link>
            </div>
          </div>
          <div className="border-t border-white/10 mt-8 pt-8 text-center font-dm text-xs text-white/30">
            © {new Date().getFullYear()} Jog Door Waar. Tous droits réservés.
          </div>
        </div>
      </footer>
    </main>
  );
}
