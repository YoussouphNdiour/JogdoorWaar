'use client';

import { useState, useEffect } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { JobCard } from '../../../components/jobs/JobCard';
import type { JobListItem } from '@jdw/shared-types';
import { apiFetch } from '../../../lib/api/client';

export default function JobsPage() {
  const [jobs, setJobs] = useState<JobListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('matchScore');
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedModes, setSelectedModes] = useState<string[]>([]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (search) params.set('q', search);
    if (sortBy) params.set('sort', sortBy);
    if (selectedTypes.length) params.set('jobType', selectedTypes.join(','));
    if (selectedModes.length) params.set('workMode', selectedModes.join(','));

    setLoading(true);
    apiFetch<{ data: JobListItem[]; total: number }>(`/jobs?${params.toString()}`)
      .then((res) => setJobs(res.data))
      .catch(() => setJobs([]))
      .finally(() => setLoading(false));
  }, [search, sortBy, selectedTypes, selectedModes]);

  function toggleType(value: string) {
    setSelectedTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function toggleMode(value: string) {
    setSelectedModes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  const JOB_TYPES = [
    { value: 'CDI', label: 'CDI' },
    { value: 'CDD', label: 'CDD' },
    { value: 'STAGE', label: 'Stage' },
    { value: 'FREELANCE', label: 'Freelance' },
  ];

  const WORK_MODES = [
    { value: 'ON_SITE', label: 'Présentiel' },
    { value: 'HYBRID', label: 'Hybride' },
    { value: 'REMOTE', label: 'Télétravail' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header + Search */}
      <div className="mb-8">
        <h1 className="font-syne text-2xl font-bold text-savane mb-4">Offres d&apos;emploi</h1>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-savane/40" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Titre, compétence, entreprise…"
              className="w-full pl-11 pr-4 py-3 bg-white rounded-xl border border-sand-dark font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-3 bg-white border border-sand-dark rounded-xl font-dm text-sm text-savane hover:border-terracotta/30 transition-colors">
            <SlidersHorizontal className="h-4 w-4" />
            Filtres
          </button>
        </div>
      </div>

      <div className="flex gap-6">
        {/* Sidebar Filters */}
        <aside className="hidden md:block w-56 flex-shrink-0">
          <div className="bg-white rounded-2xl border border-sand-dark p-5 space-y-6">
            <div>
              <h3 className="font-dm font-semibold text-savane text-sm mb-3">Type de contrat</h3>
              <div className="space-y-2">
                {JOB_TYPES.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(value)}
                      onChange={() => toggleType(value)}
                      className="accent-terracotta w-4 h-4 rounded"
                    />
                    <span className="font-dm text-sm text-savane/70 group-hover:text-savane">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-dm font-semibold text-savane text-sm mb-3">Mode de travail</h3>
              <div className="space-y-2">
                {WORK_MODES.map(({ value, label }) => (
                  <label key={value} className="flex items-center gap-2.5 cursor-pointer group">
                    <input
                      type="checkbox"
                      checked={selectedModes.includes(value)}
                      onChange={() => toggleMode(value)}
                      className="accent-terracotta w-4 h-4 rounded"
                    />
                    <span className="font-dm text-sm text-savane/70 group-hover:text-savane">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </aside>

        {/* Job List */}
        <div className="flex-1">
          <div className="flex items-center justify-between mb-4">
            <p className="font-dm text-sm text-savane/60">
              {loading ? (
                'Chargement…'
              ) : (
                <>
                  <span className="font-semibold text-savane">{jobs.length}</span> offres trouvées
                </>
              )}
            </p>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="font-dm text-sm bg-white border border-sand-dark rounded-xl px-3 py-2 text-savane focus:outline-none focus:ring-2 focus:ring-terracotta/30"
            >
              <option value="matchScore">Par matching</option>
              <option value="date">Plus récentes</option>
              <option value="salary">Par salaire</option>
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-sand-dark p-5 animate-pulse">
                  <div className="h-4 bg-sand-dark rounded w-3/4 mb-2" />
                  <div className="h-3 bg-sand-dark rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <div className="text-center py-20">
              <p className="font-dm text-savane/50">Aucune offre trouvée.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
