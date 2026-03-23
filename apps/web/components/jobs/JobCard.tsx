import Link from 'next/link';
import { MapPin, Briefcase, Clock, Bookmark, TrendingUp } from 'lucide-react';
import { cn } from '@jdw/ui';
import type { JobListItem, WorkMode, JobType } from '@jdw/shared-types';

interface JobCardProps {
  job: JobListItem;
  isSaved?: boolean;
  onSave?: (jobId: string) => void;
  className?: string;
}

const WORK_MODE_LABEL: Record<WorkMode, string> = {
  REMOTE: 'Télétravail',
  HYBRID: 'Hybride',
  ON_SITE: 'Présentiel',
};

const JOB_TYPE_LABEL: Record<JobType, string> = {
  CDI: 'CDI',
  CDD: 'CDD',
  STAGE: 'Stage',
  ALTERNANCE: 'Alternance',
  FREELANCE: 'Freelance',
  TEMPS_PARTIEL: 'Temps partiel',
  BENEVOLAT: 'Bénévolat',
};

function formatSalary(min?: number, max?: number): string | null {
  if (!min && !max) return null;
  const fmt = (n: number) =>
    n >= 1000000
      ? `${(n / 1000000).toFixed(1)}M FCFA`
      : `${(n / 1000).toFixed(0)}k FCFA`;
  if (min && max) return `${fmt(min)} – ${fmt(max)}`;
  if (min) return `Dès ${fmt(min)}`;
  return `Jusqu'à ${fmt(max!)}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "Aujourd'hui";
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days}j`;
  if (days < 30) return `Il y a ${Math.floor(days / 7)}sem`;
  return `Il y a ${Math.floor(days / 30)}mois`;
}

export function JobCard({ job, isSaved, onSave, className }: JobCardProps) {
  const salary = formatSalary(job.salaryMin, job.salaryMax);
  const hasHighScore = job.matchScore !== undefined && job.matchScore >= 80;
  const hasMediumScore = job.matchScore !== undefined && job.matchScore >= 60;

  return (
    <article
      className={cn(
        'group bg-white rounded-2xl border border-sand-dark p-5 hover:shadow-soft transition-all duration-200 hover:border-terracotta/20',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        {/* Left: Logo + Info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          {/* Company Logo */}
          <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-sand-dark flex items-center justify-center overflow-hidden">
            {job.companyLogoUrl ? (
              <img
                src={job.companyLogoUrl}
                alt={job.company}
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="font-syne text-sm font-bold text-savane/40">
                {job.company[0]}
              </span>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <Link href={`/jobs/${job.id}`}>
              <h3 className="font-dm font-semibold text-savane line-clamp-2 group-hover:text-terracotta transition-colors">
                {job.title}
              </h3>
            </Link>
            <p className="font-dm text-sm text-savane/60 mt-0.5 truncate">{job.company}</p>
          </div>
        </div>

        {/* Right: Save + Score */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {job.matchScore !== undefined && (
            <div
              className={cn(
                'flex items-center gap-1 text-xs font-dm font-semibold px-2.5 py-1 rounded-full',
                hasHighScore
                  ? 'bg-terracotta/10 text-terracotta'
                  : hasMediumScore
                    ? 'bg-gold/20 text-savane-700'
                    : 'bg-sand-dark text-savane/50',
              )}
            >
              <TrendingUp className="h-3 w-3" />
              {job.matchScore}%
            </div>
          )}

          {onSave && (
            <button
              onClick={() => onSave(job.id)}
              className={cn(
                'p-1.5 rounded-lg transition-colors',
                isSaved
                  ? 'text-terracotta bg-terracotta/10'
                  : 'text-savane/30 hover:text-terracotta hover:bg-terracotta/10',
              )}
            >
              <Bookmark className="h-4 w-4" fill={isSaved ? 'currentColor' : 'none'} />
            </button>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="inline-flex items-center gap-1 text-xs font-dm bg-sand-dark text-savane/60 px-2.5 py-1 rounded-lg">
          <Briefcase className="h-3 w-3" />
          {JOB_TYPE_LABEL[job.jobType] ?? job.jobType}
        </span>
        <span className="inline-flex items-center gap-1 text-xs font-dm bg-sand-dark text-savane/60 px-2.5 py-1 rounded-lg">
          {WORK_MODE_LABEL[job.workMode] ?? job.workMode}
        </span>
        {job.city && (
          <span className="inline-flex items-center gap-1 text-xs font-dm bg-sand-dark text-savane/60 px-2.5 py-1 rounded-lg">
            <MapPin className="h-3 w-3" />
            {job.city}
          </span>
        )}
        {salary && (
          <span className="inline-flex items-center text-xs font-dm bg-gold/20 text-savane font-medium px-2.5 py-1 rounded-lg">
            {salary}
          </span>
        )}
      </div>

      {/* Description courte */}
      {job.descriptionShort && (
        <p className="font-dm text-xs text-savane/50 mt-3 line-clamp-2 leading-relaxed">
          {job.descriptionShort}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-sand-dark">
        <span className="inline-flex items-center gap-1 text-xs font-dm text-savane/40">
          <Clock className="h-3 w-3" />
          {timeAgo(job.publishedAt)}
        </span>
        <Link
          href={`/jobs/${job.id}`}
          className="text-xs font-dm font-medium text-terracotta hover:underline"
        >
          Voir l'offre →
        </Link>
      </div>
    </article>
  );
}
