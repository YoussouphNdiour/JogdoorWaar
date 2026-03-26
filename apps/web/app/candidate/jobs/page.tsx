import { Search, SlidersHorizontal } from 'lucide-react';
import { JobCard } from '../../../components/jobs/JobCard';
import type { JobListItem } from '@jdw/shared-types';
import { WorkMode, JobType, SourcePlatform } from '@jdw/shared-types';

// Placeholder — à remplacer par fetch API
const MOCK_JOBS: JobListItem[] = [
  {
    id: '1',
    title: 'Développeur React Senior',
    company: 'Orange Sénégal',
    city: 'Dakar',
    country: 'Sénégal',
    workMode: WorkMode.HYBRID,
    jobType: JobType.CDI,
    sector: 'Télécommunications',
    salaryMin: 600000,
    salaryMax: 900000,
    publishedAt: new Date().toISOString(),
    sourcePlatform: SourcePlatform.EMPLOI_SENEGAL,
    sourceUrl: '#',
    descriptionShort: '• React 18, TypeScript, Node.js\n• 5+ ans d\'expérience\n• CDI – Dakar',
    requiredSkills: ['React', 'TypeScript', 'Node.js'],
    matchScore: 92,
    isActive: true,
    isPremium: false,
  },
  {
    id: '2',
    title: 'Product Manager',
    company: 'Wave',
    city: 'Dakar',
    country: 'Sénégal',
    workMode: WorkMode.ON_SITE,
    jobType: JobType.CDI,
    sector: 'Fintech',
    salaryMin: 800000,
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    sourcePlatform: SourcePlatform.LINKEDIN,
    sourceUrl: '#',
    descriptionShort: '• Roadmap produit mobile money\n• 3+ ans PM expérience\n• Anglais courant requis',
    requiredSkills: ['Product Management', 'Agile', 'Mobile'],
    matchScore: 85,
    isActive: true,
    isPremium: false,
  },
];

const JOB_TYPES = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'STAGE', label: 'Stage' },
  { value: 'FREELANCE', label: 'Freelance' },
];

export default function JobsPage() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header + Search */}
      <div className="mb-8">
        <h1 className="font-syne text-2xl font-bold text-savane mb-4">Offres d'emploi</h1>
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-savane/40" />
            <input
              type="text"
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
                      value={value}
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
                {['Présentiel', 'Hybride', 'Télétravail'].map((label) => (
                  <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="checkbox" className="accent-terracotta w-4 h-4 rounded" />
                    <span className="font-dm text-sm text-savane/70 group-hover:text-savane">
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-dm font-semibold text-savane text-sm mb-3">Date de publication</h3>
              <div className="space-y-2">
                {["Aujourd'hui", '7 derniers jours', '30 derniers jours'].map((label) => (
                  <label key={label} className="flex items-center gap-2.5 cursor-pointer group">
                    <input type="radio" name="date" className="accent-terracotta w-4 h-4" />
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
              <span className="font-semibold text-savane">{MOCK_JOBS.length}</span> offres trouvées
            </p>
            <select className="font-dm text-sm bg-white border border-sand-dark rounded-xl px-3 py-2 text-savane focus:outline-none focus:ring-2 focus:ring-terracotta/30">
              <option value="matchScore">Par matching</option>
              <option value="date">Plus récentes</option>
              <option value="salary">Par salaire</option>
            </select>
          </div>

          <div className="space-y-3">
            {MOCK_JOBS.map((job) => (
              <JobCard key={job.id} job={job} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
