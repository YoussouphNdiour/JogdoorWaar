'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, MapPin, Briefcase, Clock, ExternalLink, Bookmark, Send } from 'lucide-react';
import { apiFetch } from '../../../../lib/api/client';

interface JobDetail {
  id: string;
  title: string;
  company: string;
  companyLogoUrl?: string;
  city: string;
  country: string;
  workMode: string;
  jobType: string;
  sector?: string;
  salaryMin?: number;
  salaryMax?: number;
  publishedAt: string;
  sourceUrl: string;
  sourcePlatform: string;
  descriptionShort?: string;
  description?: string;
  requiredSkills: string[];
  matchScore?: number;
}

function formatSalary(min?: number, max?: number) {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M FCFA`
      : `${(n / 1000).toFixed(0)}k FCFA`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}/mois`;
  if (min) return `Dès ${fmt(min)}/mois`;
  return `Jusqu'à ${fmt(max!)}/mois`;
}

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch<JobDetail>(`/jobs/${id}`)
      .then(setJob)
      .catch(() => setError('Offre introuvable.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleToggleSave = async () => {
    setSaving(true);
    try {
      if (saved) {
        await apiFetch(`/jobs/${id}/save`, { method: 'DELETE' });
        setSaved(false);
      } else {
        await apiFetch(`/jobs/${id}/save`, { method: 'POST' });
        setSaved(true);
      }
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await apiFetch('/applications', {
        method: 'POST',
        body: JSON.stringify({ jobId: id, channel: 'WEB' }),
      });
      setApplied(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la candidature.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-sand-dark rounded w-1/2" />
          <div className="h-4 bg-sand-dark rounded w-1/3" />
          <div className="h-64 bg-sand-dark rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-12 text-center">
        <p className="font-dm text-savane/60 mb-4">{error || 'Offre introuvable.'}</p>
        <Link href="/candidate/jobs" className="text-terracotta hover:underline font-dm text-sm">
          ← Retour aux offres
        </Link>
      </div>
    );
  }

  const salary = formatSalary(job.salaryMin, job.salaryMax);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Back */}
      <Link
        href="/candidate/jobs"
        className="inline-flex items-center gap-2 text-sm font-dm text-savane/60 hover:text-savane mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux offres
      </Link>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="md:col-span-2 space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-sand-dark p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-sand-dark flex items-center justify-center overflow-hidden flex-shrink-0">
                {job.companyLogoUrl ? (
                  <img src={job.companyLogoUrl} alt={job.company} className="w-full h-full object-contain" />
                ) : (
                  <span className="font-syne text-lg font-bold text-savane/40">{job.company[0]}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h1 className="font-syne text-xl font-bold text-savane leading-snug">{job.title}</h1>
                <p className="font-dm text-savane/60 mt-1">{job.company}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {job.city && (
                    <span className="inline-flex items-center gap-1 text-xs font-dm bg-sand-dark text-savane/60 px-2.5 py-1 rounded-lg">
                      <MapPin className="h-3 w-3" />
                      {job.city}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-xs font-dm bg-sand-dark text-savane/60 px-2.5 py-1 rounded-lg">
                    <Briefcase className="h-3 w-3" />
                    {job.jobType}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-dm bg-sand-dark text-savane/60 px-2.5 py-1 rounded-lg">
                    {job.workMode}
                  </span>
                  {salary && (
                    <span className="inline-flex items-center text-xs font-dm bg-gold/20 text-savane font-medium px-2.5 py-1 rounded-lg">
                      {salary}
                    </span>
                  )}
                </div>
              </div>
              {job.matchScore !== undefined && (
                <div className="flex-shrink-0 text-center bg-terracotta/10 rounded-2xl px-4 py-3">
                  <div className="font-syne text-2xl font-bold text-terracotta">{job.matchScore}%</div>
                  <div className="font-dm text-[10px] text-terracotta/70">matching</div>
                </div>
              )}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white rounded-2xl border border-sand-dark p-6">
            <h2 className="font-syne font-bold text-savane mb-4">Description du poste</h2>
            {job.description ? (
              <div className="font-dm text-sm text-savane/80 leading-relaxed whitespace-pre-wrap">
                {job.description}
              </div>
            ) : job.descriptionShort ? (
              <p className="font-dm text-sm text-savane/80 leading-relaxed">{job.descriptionShort}</p>
            ) : (
              <p className="font-dm text-sm text-savane/40 italic">Description non disponible.</p>
            )}
          </div>

          {/* Skills */}
          {job.requiredSkills.length > 0 && (
            <div className="bg-white rounded-2xl border border-sand-dark p-6">
              <h2 className="font-syne font-bold text-savane mb-4">Compétences requises</h2>
              <div className="flex flex-wrap gap-2">
                {job.requiredSkills.map((skill) => (
                  <span
                    key={skill}
                    className="text-sm font-dm bg-savane/10 text-savane px-3 py-1.5 rounded-xl"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Apply card */}
          <div className="bg-white rounded-2xl border border-sand-dark p-5 space-y-3">
            <div className="flex items-center gap-2 text-xs font-dm text-savane/40">
              <Clock className="h-3.5 w-3.5" />
              Publiée le{' '}
              {new Date(job.publishedAt).toLocaleDateString('fr-SN', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </div>

            {error && (
              <div className="bg-red-50 text-red-700 border border-red-200 rounded-xl px-3 py-2 text-xs font-dm">
                {error}
              </div>
            )}

            {applied ? (
              <div className="bg-savane/10 text-savane border border-savane/20 rounded-xl px-4 py-3 text-sm font-dm font-medium text-center">
                Candidature envoyée ✓
              </div>
            ) : (
              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full bg-terracotta text-white py-3 rounded-xl font-dm font-semibold hover:bg-terracotta/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {applying ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Postuler
              </button>
            )}

            <a
              href={job.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 border border-sand-dark py-2.5 rounded-xl font-dm text-sm text-savane hover:bg-sand-dark transition-colors"
            >
              <ExternalLink className="h-4 w-4" />
              Voir l&apos;offre originale
            </a>

            <button
              onClick={handleToggleSave}
              disabled={saving}
              className={`w-full flex items-center justify-center gap-2 border py-2.5 rounded-xl font-dm text-sm transition-colors disabled:opacity-50 ${
                saved
                  ? 'border-terracotta bg-terracotta/10 text-terracotta'
                  : 'border-sand-dark text-savane hover:bg-sand-dark'
              }`}
            >
              <Bookmark className={`h-4 w-4 ${saved ? 'fill-terracotta' : ''}`} />
              {saved ? 'Sauvegardé' : 'Sauvegarder'}
            </button>
          </div>

          {/* Source info */}
          <div className="bg-white rounded-2xl border border-sand-dark p-5">
            <h3 className="font-dm font-semibold text-savane text-sm mb-3">Informations</h3>
            <dl className="space-y-2">
              {job.sector && (
                <div>
                  <dt className="font-dm text-xs text-savane/40">Secteur</dt>
                  <dd className="font-dm text-sm text-savane">{job.sector}</dd>
                </div>
              )}
              <div>
                <dt className="font-dm text-xs text-savane/40">Source</dt>
                <dd className="font-dm text-sm text-savane">{job.sourcePlatform}</dd>
              </div>
              <div>
                <dt className="font-dm text-xs text-savane/40">Pays</dt>
                <dd className="font-dm text-sm text-savane">{job.country}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
