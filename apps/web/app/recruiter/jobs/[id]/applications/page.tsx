'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Download, Mail, MessageCircle, Eye } from 'lucide-react';
import {
  getRecruiterJob,
  getJobApplications,
  updateApplicationStatus,
  type RecruiterJob,
  type RecruiterApplication,
} from '../../../../../lib/api/recruiter';

const STATUS_CONFIG: Record<
  RecruiterApplication['status'],
  { label: string; color: string; bg: string; border: string }
> = {
  PENDING: { label: 'Nouveau', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  REVIEWED: { label: 'Vu', color: 'text-savane/60', bg: 'bg-sand-dark', border: 'border-sand-dark' },
  SHORTLISTED: { label: 'Sélectionné', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200' },
  REJECTED: { label: 'Refusé', color: 'text-red-500', bg: 'bg-red-50', border: 'border-red-200' },
};

const STATUS_ORDER: RecruiterApplication['status'][] = ['PENDING', 'REVIEWED', 'SHORTLISTED', 'REJECTED'];

export default function JobApplicationsPage() {
  const { id } = useParams<{ id: string }>();
  const [job, setJob] = useState<RecruiterJob | null>(null);
  const [applications, setApplications] = useState<RecruiterApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<RecruiterApplication['status'] | 'ALL'>('ALL');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getRecruiterJob(id), getJobApplications(id)])
      .then(([j, apps]) => {
        setJob(j);
        setApplications(apps);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function handleStatusChange(app: RecruiterApplication, status: RecruiterApplication['status']) {
    const updated = await updateApplicationStatus(id, app.id, status).catch(() => null);
    if (updated) {
      setApplications((prev) => prev.map((a) => (a.id === app.id ? updated : a)));
    }
  }

  const filtered = filter === 'ALL' ? applications : applications.filter((a) => a.status === filter);

  const counts = STATUS_ORDER.reduce<Record<string, number>>(
    (acc, s) => ({ ...acc, [s]: applications.filter((a) => a.status === s).length }),
    {},
  );

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 animate-pulse space-y-4">
        <div className="h-8 bg-sand-dark rounded w-1/3" />
        <div className="h-64 bg-sand-dark rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      {/* Back */}
      <Link
        href="/recruiter/jobs"
        className="inline-flex items-center gap-2 text-sm font-dm text-savane/60 hover:text-savane mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux offres
      </Link>

      {/* Header */}
      {job && (
        <div className="mb-6">
          <h1 className="font-syne text-2xl font-bold text-savane">{job.title}</h1>
          <p className="font-dm text-savane/60 mt-1">
            {job.company} · {job.city} ·{' '}
            <span className="font-semibold text-savane">{applications.length}</span> candidature
            {applications.length !== 1 ? 's' : ''}
          </p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setFilter('ALL')}
          className={`px-4 py-2 rounded-xl font-dm text-sm transition-colors ${filter === 'ALL' ? 'bg-savane text-white' : 'bg-white border border-sand-dark text-savane/60 hover:text-savane'}`}
        >
          Tous ({applications.length})
        </button>
        {STATUS_ORDER.map((s) => {
          const cfg = STATUS_CONFIG[s];
          return (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl font-dm text-sm transition-colors ${filter === s ? `${cfg.bg} ${cfg.color} border ${cfg.border}` : 'bg-white border border-sand-dark text-savane/60 hover:text-savane'}`}
            >
              {cfg.label} ({counts[s] ?? 0})
            </button>
          );
        })}
      </div>

      {/* Applications list */}
      {filtered.length === 0 ? (
        <div className="border-2 border-dashed border-sand-dark rounded-2xl p-12 text-center">
          <p className="font-dm text-savane/50 text-sm">Aucune candidature dans cette catégorie.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((app) => {
            const cfg = STATUS_CONFIG[app.status];
            const isExpanded = expandedId === app.id;
            return (
              <div
                key={app.id}
                className={`bg-white rounded-2xl border ${cfg.border} overflow-hidden transition-all`}
              >
                <div
                  className="p-5 flex items-start gap-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : app.id)}
                >
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-savane/10 flex items-center justify-center flex-shrink-0">
                    <span className="font-syne text-sm font-bold text-savane">
                      {app.candidateName
                        .split(' ')
                        .map((w) => w[0]?.toUpperCase() ?? '')
                        .slice(0, 2)
                        .join('')}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-dm font-semibold text-savane">{app.candidateName}</p>
                      <span className={`text-[10px] font-dm font-bold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                      {app.matchScore !== undefined && (
                        <span className="text-[10px] font-dm font-semibold px-2 py-0.5 rounded-full bg-terracotta/10 text-terracotta">
                          {app.matchScore}% match
                        </span>
                      )}
                    </div>
                    <p className="font-dm text-xs text-savane/50">{app.candidateEmail}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className={`text-[10px] font-dm font-semibold px-2 py-0.5 rounded-full ${app.channel === 'WHATSAPP' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-600'}`}>
                        {app.channel === 'WHATSAPP' ? '💬 WhatsApp' : '🌐 Web'}
                      </span>
                      <span className="text-xs font-dm text-savane/40">
                        {new Date(app.appliedAt).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long' })}
                      </span>
                    </div>
                  </div>

                  {/* Quick actions */}
                  <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    {app.cvUrl && (
                      <a
                        href={app.cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-lg hover:bg-sand-dark text-savane/40 hover:text-savane transition-colors"
                        title="Voir le CV"
                      >
                        <Eye className="h-4 w-4" />
                      </a>
                    )}
                    <a
                      href={`mailto:${app.candidateEmail}`}
                      className="p-2 rounded-lg hover:bg-sand-dark text-savane/40 hover:text-savane transition-colors"
                      title="Envoyer un email"
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                  </div>
                </div>

                {/* Expanded panel */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-sand-dark pt-4 space-y-4">
                    {/* Cover letter */}
                    {app.coverLetter && (
                      <div>
                        <p className="font-dm text-xs font-semibold text-savane/50 mb-2">Lettre de motivation</p>
                        <div className="bg-sand-dark rounded-xl p-4 font-dm text-sm text-savane/80 leading-relaxed whitespace-pre-wrap">
                          {app.coverLetter}
                        </div>
                      </div>
                    )}

                    {/* Status actions */}
                    <div>
                      <p className="font-dm text-xs font-semibold text-savane/50 mb-2">Changer le statut</p>
                      <div className="flex flex-wrap gap-2">
                        {STATUS_ORDER.map((s) => {
                          const c = STATUS_CONFIG[s];
                          return (
                            <button
                              key={s}
                              onClick={() => handleStatusChange(app, s)}
                              disabled={app.status === s}
                              className={`px-3 py-1.5 rounded-xl font-dm text-xs font-medium transition-colors ${
                                app.status === s
                                  ? `${c.bg} ${c.color} cursor-default border ${c.border}`
                                  : 'bg-sand-dark text-savane/60 hover:bg-sand-dark/80'
                              }`}
                            >
                              {c.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* CV download */}
                    {app.cvUrl && (
                      <a
                        href={app.cvUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-xs font-dm text-terracotta hover:underline"
                      >
                        <Download className="h-3.5 w-3.5" />
                        Télécharger le CV
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
