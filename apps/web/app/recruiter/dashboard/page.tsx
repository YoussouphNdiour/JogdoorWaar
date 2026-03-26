'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Eye, MousePointer, Users, ArrowRight, Plus, TrendingUp } from 'lucide-react';
import { getRecruiterStats, getRecruiterJobs, type RecruiterStats, type RecruiterJob } from '../../../lib/api/recruiter';

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'text-green-600', bg: 'bg-green-100' },
  PAUSED: { label: 'En pause', color: 'text-yellow-600', bg: 'bg-yellow-100' },
  EXPIRED: { label: 'Expirée', color: 'text-gray-400', bg: 'bg-gray-100' },
  DRAFT: { label: 'Brouillon', color: 'text-savane/50', bg: 'bg-sand-dark' },
};

export default function RecruiterDashboardPage() {
  const [stats, setStats] = useState<RecruiterStats | null>(null);
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);

  useEffect(() => {
    getRecruiterStats().then(setStats).catch(() => {});
    getRecruiterJobs().then((list) => setJobs(list.slice(0, 5))).catch(() => {});
  }, []);

  const statCards = [
    { label: 'Offres actives', value: stats?.activeJobs ?? '—', icon: Briefcase, color: 'text-terracotta', bg: 'bg-terracotta/10' },
    { label: 'Candidatures reçues', value: stats?.totalApplications ?? '—', icon: Users, color: 'text-savane', bg: 'bg-savane/10' },
    { label: 'Vues totales', value: stats?.totalViews ?? '—', icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Clics vers source', value: stats?.totalClicks ?? '—', icon: MousePointer, color: 'text-gold-600', bg: 'bg-gold/20' },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-syne text-2xl font-bold text-savane">Tableau de bord recruteur</h1>
          <p className="font-dm text-savane/60 mt-1">Gérez vos offres et suivez les candidatures.</p>
        </div>
        <Link
          href="/recruiter/jobs/new"
          className="flex items-center gap-2 bg-terracotta text-white px-4 py-2.5 rounded-xl font-dm text-sm font-semibold hover:bg-terracotta/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvelle offre
        </Link>
      </div>

      {/* Plan info */}
      {stats && (
        <div className="bg-savane/5 border border-savane/20 rounded-2xl px-5 py-3 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-savane/60" />
            <span className="font-dm text-sm text-savane/70">
              Plan <span className="font-semibold text-savane">{stats.plan}</span> —{' '}
              <span className="text-terracotta font-semibold">{stats.jobsRemaining} offres restantes</span> ce mois
            </span>
          </div>
          <Link href="/recruiter/billing" className="font-dm text-xs text-terracotta hover:underline">
            Gérer l&apos;abonnement →
          </Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-sand-dark">
            <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center mb-3`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className="font-syne text-2xl font-bold text-savane">{value}</div>
            <div className="font-dm text-xs text-savane/50 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      {/* Recent jobs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-syne text-lg font-bold text-savane">Mes offres récentes</h2>
          <Link href="/recruiter/jobs" className="font-dm text-sm text-terracotta hover:underline flex items-center gap-1">
            Voir tout <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {jobs.length === 0 ? (
          <div className="border-2 border-dashed border-sand-dark rounded-2xl p-12 text-center">
            <Briefcase className="h-10 w-10 text-savane/20 mx-auto mb-3" />
            <p className="font-dm text-savane/50 text-sm">Aucune offre publiée.</p>
            <Link
              href="/recruiter/jobs/new"
              className="inline-flex items-center gap-2 mt-4 bg-terracotta text-white px-4 py-2 rounded-xl font-dm text-sm font-semibold hover:bg-terracotta/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Publier une offre
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const cfg = STATUS_CONFIG[job.status];
              return (
                <div
                  key={job.id}
                  className="bg-white rounded-2xl border border-sand-dark p-4 flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/recruiter/jobs/${job.id}/applications`}>
                        <h3 className="font-dm font-medium text-savane hover:text-terracotta transition-colors">
                          {job.title}
                        </h3>
                      </Link>
                      <span className={`text-[10px] font-dm font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs font-dm text-savane/50">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" /> {job.viewCount}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {job.applicationCount} candidatures</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Link
                      href={`/recruiter/jobs/${job.id}/applications`}
                      className="text-xs font-dm text-terracotta hover:underline"
                    >
                      Candidatures →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
