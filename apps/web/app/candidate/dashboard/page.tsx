'use client';

import { useEffect, useState } from 'react';
import { Bell, Briefcase, FileText, TrendingUp, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '../../../lib/api/client';
import { PLAN_PRICES_DISPLAY } from '../../../lib/constants';
import type { JobListItem } from '@jdw/shared-types';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  title?: string;
  city?: string;
  plan: string;
}

interface Alert {
  id: string;
  isActive: boolean;
}

interface CvFile {
  id: string;
}

interface Application {
  id: string;
}

interface DashboardData {
  profile: UserProfile;
  jobs: JobListItem[];
  jobsTotal: number;
  applications: Application[];
  alerts: Alert[];
  cvs: CvFile[];
}

function computeProfileCompletion(profile: UserProfile, cvCount: number): number {
  let score = 30; // firstName + lastName always set at registration
  if (profile.phone) score += 15;
  if (profile.title) score += 20;
  if (profile.city) score += 15;
  if (cvCount > 0) score += 20;
  return score;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<UserProfile>('/auth/me'),
      apiFetch<{ data: JobListItem[]; total: number }>('/jobs?sortBy=matchScore&limit=3'),
      apiFetch<Application[]>('/applications'),
      apiFetch<Alert[]>('/alerts'),
      apiFetch<CvFile[]>('/cvs'),
    ])
      .then(([profile, jobsRes, applications, alerts, cvs]) => {
        setData({
          profile,
          jobs: jobsRes.data,
          jobsTotal: jobsRes.total,
          applications,
          alerts,
          cvs,
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const activeAlerts = data?.alerts.filter((a) => a.isActive).length ?? 0;
  const profileCompletion = data
    ? computeProfileCompletion(data.profile, data.cvs.length)
    : 0;

  const stats = [
    {
      label: 'Offres recommandées',
      value: loading ? '…' : String(data?.jobsTotal ?? 0),
      icon: TrendingUp,
      color: 'text-terracotta',
      bg: 'bg-terracotta/10',
    },
    {
      label: 'Candidatures',
      value: loading ? '…' : String(data?.applications.length ?? 0),
      icon: Briefcase,
      color: 'text-savane',
      bg: 'bg-savane/10',
    },
    {
      label: 'Alertes actives',
      value: loading ? '…' : String(activeAlerts),
      icon: Bell,
      color: 'text-gold-600',
      bg: 'bg-gold/20',
    },
    {
      label: 'CVs uploadés',
      value: loading ? '…' : String(data?.cvs.length ?? 0),
      icon: FileText,
      color: 'text-savane',
      bg: 'bg-sand-dark',
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-syne text-2xl font-bold text-savane">
          Bonjour {data?.profile.firstName ?? ''} 👋
        </h1>
        <p className="font-dm text-savane/60 mt-1">
          Aujourd&apos;hui il y a du travail — voici vos recommandations.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
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
            <Link
              href="/candidate/jobs"
              className="font-dm text-sm text-terracotta hover:underline flex items-center gap-1"
            >
              Voir tout <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-sand-dark p-4 animate-pulse">
                  <div className="h-4 bg-sand-dark rounded w-3/4 mb-2" />
                  <div className="h-3 bg-sand-dark rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : data?.jobs.length === 0 ? (
            <div className="border-2 border-dashed border-sand-dark rounded-2xl p-10 text-center">
              <p className="font-dm text-savane/50 text-sm">
                Uploadez un CV pour obtenir des recommandations.
              </p>
              <Link
                href="/candidate/profile"
                className="inline-block mt-3 text-sm font-dm text-terracotta hover:underline"
              >
                Uploader un CV →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {data?.jobs.map((job) => (
                <div
                  key={job.id}
                  className="bg-white rounded-2xl border border-sand-dark p-4 flex items-center justify-between gap-4 hover:border-terracotta/20 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <Link href={`/candidate/jobs/${job.id}`}>
                      <h3 className="font-dm font-medium text-savane hover:text-terracotta transition-colors truncate">
                        {job.title}
                      </h3>
                    </Link>
                    <p className="font-dm text-xs text-savane/50 mt-0.5">
                      {job.company} · {job.city}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {job.matchScore != null && (
                      <span className="text-xs font-dm font-semibold bg-terracotta/10 text-terracotta px-2.5 py-1 rounded-full">
                        {Math.round(job.matchScore * 100)}%
                      </span>
                    )}
                    <span className="text-xs font-dm bg-sand-dark text-savane/60 px-2.5 py-1 rounded-lg">
                      {job.jobType}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
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
              <div
                className="bg-gold rounded-full h-2 transition-all"
                style={{ width: `${profileCompletion}%` }}
              />
            </div>
            <p className="font-dm text-xs text-white/60 mb-4">{profileCompletion}% complété</p>
            <Link
              href="/candidate/profile"
              className="block text-center bg-white text-savane py-2 rounded-xl font-dm text-sm font-medium hover:bg-sand transition-colors"
            >
              Compléter →
            </Link>
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-2xl border border-sand-dark p-5 space-y-3">
            <h3 className="font-syne font-bold text-savane text-sm">Actions rapides</h3>
            {[
              { label: 'Uploader un CV', href: '/candidate/profile', icon: FileText },
              { label: 'Créer une alerte', href: '/candidate/alerts', icon: Bell },
              { label: 'Mes candidatures', href: '/candidate/applications', icon: Briefcase },
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

          {/* Upsell Premium — only for FREE plan */}
          {data?.profile.plan === 'FREE' && (
            <div className="bg-terracotta/10 border border-terracotta/20 rounded-2xl p-5">
              <div className="text-terracotta font-syne font-bold text-sm mb-1">✨ Premium</div>
              <p className="font-dm text-xs text-savane/70 mb-3">
                Candidatures WhatsApp, CVs illimités, coach entretien IA.
              </p>
              <Link
                href="/candidate/billing"
                className="block text-center bg-terracotta text-white py-2 rounded-xl font-dm text-sm font-medium hover:bg-terracotta/90 transition-colors"
              >
                {PLAN_PRICES_DISPLAY.PREMIUM} FCFA/mois →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
