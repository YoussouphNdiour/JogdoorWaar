import { Bell, Briefcase, FileText, TrendingUp, ArrowRight, Clock } from 'lucide-react';
import Link from 'next/link';

// Données placeholder — à remplacer par fetch API
const STATS = [
  { label: 'Offres recommandées', value: '12', icon: TrendingUp, color: 'text-terracotta', bg: 'bg-terracotta/10' },
  { label: 'Candidatures', value: '4', icon: Briefcase, color: 'text-savane', bg: 'bg-savane/10' },
  { label: 'Alertes actives', value: '2', icon: Bell, color: 'text-gold-600', bg: 'bg-gold/20' },
  { label: 'CVs uploadés', value: '1', icon: FileText, color: 'text-savane', bg: 'bg-sand-dark' },
];

const RECENT_JOBS = [
  { id: '1', title: 'Développeur React Senior', company: 'Orange Sénégal', city: 'Dakar', jobType: 'CDI', matchScore: 92, publishedAt: new Date().toISOString() },
  { id: '2', title: 'Product Manager', company: 'Wave', city: 'Dakar', jobType: 'CDI', matchScore: 85, publishedAt: new Date().toISOString() },
  { id: '3', title: 'Data Analyst', company: 'SenBank', city: 'Dakar', jobType: 'CDD', matchScore: 76, publishedAt: new Date().toISOString() },
];

export default function DashboardPage() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-syne text-2xl font-bold text-savane">Bonjour 👋</h1>
        <p className="font-dm text-savane/60 mt-1">
          Aujourd'hui il y a du travail — voici vos recommandations.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {STATS.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-sand-dark">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className="font-syne text-2xl font-bold text-savane">{value}</div>
            <div className="font-dm text-xs text-savane/50 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Offres recommandées */}
        <div className="md:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-syne text-lg font-bold text-savane">Recommandées pour vous</h2>
            <Link href="/jobs" className="font-dm text-sm text-terracotta hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {RECENT_JOBS.map((job) => (
              <div key={job.id} className="bg-white rounded-2xl border border-sand-dark p-4 flex items-center justify-between gap-4 hover:border-terracotta/20 transition-colors">
                <div className="flex-1 min-w-0">
                  <Link href={`/jobs/${job.id}`}>
                    <h3 className="font-dm font-medium text-savane hover:text-terracotta transition-colors truncate">
                      {job.title}
                    </h3>
                  </Link>
                  <p className="font-dm text-xs text-savane/50 mt-0.5">{job.company} · {job.city}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs font-dm font-semibold bg-terracotta/10 text-terracotta px-2.5 py-1 rounded-full">
                    {job.matchScore}%
                  </span>
                  <span className="text-xs font-dm bg-sand-dark text-savane/60 px-2.5 py-1 rounded-lg">
                    {job.jobType}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Complétion profil */}
          <div className="bg-savane text-white rounded-2xl p-5">
            <h3 className="font-syne font-bold mb-1">Complétez votre profil</h3>
            <p className="font-dm text-xs text-white/70 mb-4">
              Un profil complet améliore vos recommandations
            </p>
            <div className="bg-white/20 rounded-full h-2 mb-1">
              <div className="bg-gold rounded-full h-2 w-3/5" />
            </div>
            <p className="font-dm text-xs text-white/60 mb-4">60% complété</p>
            <Link
              href="/profile"
              className="block text-center bg-white text-savane py-2 rounded-xl font-dm text-sm font-medium hover:bg-sand transition-colors"
            >
              Compléter →
            </Link>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-sand-dark p-5 space-y-3">
            <h3 className="font-syne font-bold text-savane text-sm">Actions rapides</h3>
            {[
              { label: 'Uploader un CV', href: '/profile/cvs', icon: FileText },
              { label: 'Créer une alerte', href: '/alerts', icon: Bell },
              { label: 'Mes candidatures', href: '/applications', icon: Briefcase },
            ].map(({ label, href, icon: Icon }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center gap-3 text-sm font-dm text-savane/70 hover:text-terracotta transition-colors"
              >
                <div className="w-8 h-8 bg-sand-dark rounded-lg flex items-center justify-center">
                  <Icon className="h-4 w-4" />
                </div>
                {label}
                <ArrowRight className="h-3 w-3 ml-auto" />
              </Link>
            ))}
          </div>

          {/* Upsell Premium */}
          <div className="bg-terracotta/10 border border-terracotta/20 rounded-2xl p-5">
            <div className="text-terracotta font-syne font-bold text-sm mb-1">✨ Premium</div>
            <p className="font-dm text-xs text-savane/70 mb-3">
              Candidatures WhatsApp, CVs illimités, coach entretien IA.
            </p>
            <Link
              href="/upgrade"
              className="block text-center bg-terracotta text-white py-2 rounded-xl font-dm text-sm font-medium hover:bg-terracotta-600 transition-colors"
            >
              3 500 FCFA/mois →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
