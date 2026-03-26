'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Eye, Users, Pencil, Trash2, Pause, Play } from 'lucide-react';
import {
  getRecruiterJobs,
  updateRecruiterJob,
  deleteRecruiterJob,
  type RecruiterJob,
} from '../../../lib/api/recruiter';

const STATUS_CONFIG = {
  ACTIVE: { label: 'Active', color: 'text-green-600', bg: 'bg-green-100', dot: 'bg-green-500' },
  PAUSED: { label: 'En pause', color: 'text-yellow-600', bg: 'bg-yellow-100', dot: 'bg-yellow-500' },
  EXPIRED: { label: 'Expirée', color: 'text-gray-400', bg: 'bg-gray-100', dot: 'bg-gray-400' },
  DRAFT: { label: 'Brouillon', color: 'text-savane/50', bg: 'bg-sand-dark', dot: 'bg-savane/30' },
};

export default function RecruiterJobsPage() {
  const [jobs, setJobs] = useState<RecruiterJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    getRecruiterJobs()
      .then(setJobs)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleTogglePause(job: RecruiterJob) {
    const newStatus = job.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    const updated = await updateRecruiterJob(job.id, { status: newStatus }).catch(() => null);
    if (updated) setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)));
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette offre définitivement ?')) return;
    setDeletingId(id);
    await deleteRecruiterJob(id).catch(() => {});
    setJobs((prev) => prev.filter((j) => j.id !== id));
    setDeletingId(null);
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-syne text-2xl font-bold text-savane">Mes offres d&apos;emploi</h1>
          <p className="font-dm text-sm text-savane/60 mt-1">
            {jobs.length} offre{jobs.length !== 1 ? 's' : ''} publiée{jobs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link
          href="/recruiter/jobs/new"
          className="flex items-center gap-2 bg-terracotta text-white px-4 py-2.5 rounded-xl font-dm text-sm font-semibold hover:bg-terracotta/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvelle offre
        </Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-sand-dark p-5 animate-pulse">
              <div className="h-4 bg-sand-dark rounded w-1/2 mb-2" />
              <div className="h-3 bg-sand-dark rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : jobs.length === 0 ? (
        <div className="border-2 border-dashed border-sand-dark rounded-2xl p-12 text-center">
          <p className="font-dm text-savane/50 text-sm mb-4">Aucune offre publiée pour le moment.</p>
          <Link
            href="/recruiter/jobs/new"
            className="inline-flex items-center gap-2 bg-terracotta text-white px-4 py-2 rounded-xl font-dm text-sm font-semibold hover:bg-terracotta/90 transition-colors"
          >
            <Plus className="h-4 w-4" /> Publier ma première offre
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const cfg = STATUS_CONFIG[job.status];
            return (
              <div
                key={job.id}
                className="bg-white rounded-2xl border border-sand-dark p-5 flex items-start gap-4"
              >
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-2 ${cfg.dot}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-3 flex-wrap">
                    <Link href={`/recruiter/jobs/${job.id}/applications`}>
                      <h3 className="font-dm font-semibold text-savane hover:text-terracotta transition-colors">
                        {job.title}
                      </h3>
                    </Link>
                    <span className={`text-[10px] font-dm font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                      {cfg.label}
                    </span>
                    {job.isBoosted && (
                      <span className="text-[10px] font-dm font-semibold px-2 py-0.5 rounded-full bg-gold/30 text-savane">
                        ⚡ Boostée
                      </span>
                    )}
                  </div>
                  <p className="font-dm text-xs text-savane/50 mt-1">
                    {job.company} · {job.city} · {job.jobType}
                  </p>
                  <div className="flex items-center gap-4 mt-2">
                    <span className="flex items-center gap-1 text-xs font-dm text-savane/50">
                      <Eye className="h-3 w-3" /> {job.viewCount} vues
                    </span>
                    <span className="flex items-center gap-1 text-xs font-dm text-savane/50">
                      <Users className="h-3 w-3" /> {job.applicationCount} candidatures
                    </span>
                    <span className="text-xs font-dm text-savane/40">
                      Publiée le {new Date(job.publishedAt).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  <Link
                    href={`/recruiter/jobs/${job.id}/applications`}
                    className="p-2 rounded-lg hover:bg-sand-dark text-savane/50 hover:text-savane transition-colors"
                    title="Candidatures"
                  >
                    <Users className="h-4 w-4" />
                  </Link>
                  <Link
                    href={`/recruiter/jobs/${job.id}/edit`}
                    className="p-2 rounded-lg hover:bg-sand-dark text-savane/50 hover:text-savane transition-colors"
                    title="Modifier"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  {(job.status === 'ACTIVE' || job.status === 'PAUSED') && (
                    <button
                      onClick={() => handleTogglePause(job)}
                      className="p-2 rounded-lg hover:bg-sand-dark text-savane/50 hover:text-savane transition-colors"
                      title={job.status === 'ACTIVE' ? 'Mettre en pause' : 'Réactiver'}
                    >
                      {job.status === 'ACTIVE' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={deletingId === job.id}
                    className="p-2 rounded-lg hover:bg-red-50 text-savane/30 hover:text-red-500 transition-colors disabled:opacity-50"
                    title="Supprimer"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
