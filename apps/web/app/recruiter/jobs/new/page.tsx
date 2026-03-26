'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { createRecruiterJob, type RecruiterJobInput } from '../../../../lib/api/recruiter';

const WORK_MODES = [
  { value: 'ON_SITE', label: 'Présentiel' },
  { value: 'HYBRID', label: 'Hybride' },
  { value: 'REMOTE', label: 'Télétravail' },
];

const JOB_TYPES = [
  { value: 'CDI', label: 'CDI' },
  { value: 'CDD', label: 'CDD' },
  { value: 'STAGE', label: 'Stage' },
  { value: 'ALTERNANCE', label: 'Alternance' },
  { value: 'FREELANCE', label: 'Freelance' },
];

export default function NewJobPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [skillInput, setSkillInput] = useState('');

  const [form, setForm] = useState<RecruiterJobInput>({
    title: '',
    company: '',
    city: '',
    country: 'Sénégal',
    workMode: 'ON_SITE',
    jobType: 'CDI',
    sector: '',
    salaryMin: undefined,
    salaryMax: undefined,
    descriptionFull: '',
    requiredSkills: [],
  });

  function addSkill() {
    const skill = skillInput.trim();
    if (!skill || form.requiredSkills.includes(skill)) return;
    setForm((prev) => ({ ...prev, requiredSkills: [...prev.requiredSkills, skill] }));
    setSkillInput('');
  }

  function removeSkill(skill: string) {
    setForm((prev) => ({ ...prev, requiredSkills: prev.requiredSkills.filter((s) => s !== skill) }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (form.descriptionFull.length < 50) {
      setError('La description doit contenir au moins 50 caractères.');
      return;
    }
    setLoading(true);
    try {
      const job = await createRecruiterJob({
        ...form,
        salaryMin: form.salaryMin || undefined,
        salaryMax: form.salaryMax || undefined,
        sector: form.sector || undefined,
      });
      router.push(`/recruiter/jobs/${job.id}/applications`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la publication.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <Link
        href="/recruiter/jobs"
        className="inline-flex items-center gap-2 text-sm font-dm text-savane/60 hover:text-savane mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Retour aux offres
      </Link>

      <h1 className="font-syne text-2xl font-bold text-savane mb-8">Publier une offre d&apos;emploi</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-2xl border border-sand-dark p-6 space-y-4">
          <h2 className="font-syne font-bold text-savane">Informations générales</h2>

          <div>
            <label className="font-dm text-sm text-savane/70 mb-1.5 block">
              Titre du poste <span className="text-terracotta">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="ex: Développeur React Senior"
              required
              className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">
                Entreprise <span className="text-terracotta">*</span>
              </label>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="ex: Orange Sénégal"
                required
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Secteur</label>
              <input
                type="text"
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
                placeholder="ex: Télécommunications"
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">
                Ville <span className="text-terracotta">*</span>
              </label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="ex: Dakar"
                required
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Pays</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
          </div>
        </div>

        {/* Contract & mode */}
        <div className="bg-white rounded-2xl border border-sand-dark p-6 space-y-4">
          <h2 className="font-syne font-bold text-savane">Type de contrat</h2>

          <div>
            <label className="font-dm text-sm text-savane/70 mb-2 block">Type de contrat</label>
            <div className="flex flex-wrap gap-2">
              {JOB_TYPES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, jobType: value })}
                  className={`px-4 py-2 rounded-xl font-dm text-sm transition-colors ${
                    form.jobType === value
                      ? 'bg-terracotta text-white'
                      : 'bg-sand-dark text-savane hover:bg-sand-dark/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="font-dm text-sm text-savane/70 mb-2 block">Mode de travail</label>
            <div className="flex flex-wrap gap-2">
              {WORK_MODES.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setForm({ ...form, workMode: value })}
                  className={`px-4 py-2 rounded-xl font-dm text-sm transition-colors ${
                    form.workMode === value
                      ? 'bg-savane text-white'
                      : 'bg-sand-dark text-savane hover:bg-sand-dark/80'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Salaire min (FCFA/mois)</label>
              <input
                type="number"
                value={form.salaryMin ?? ''}
                onChange={(e) => setForm({ ...form, salaryMin: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="ex: 400000"
                min={0}
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Salaire max (FCFA/mois)</label>
              <input
                type="number"
                value={form.salaryMax ?? ''}
                onChange={(e) => setForm({ ...form, salaryMax: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="ex: 700000"
                min={0}
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="bg-white rounded-2xl border border-sand-dark p-6 space-y-4">
          <h2 className="font-syne font-bold text-savane">Description du poste</h2>
          <div>
            <label className="font-dm text-sm text-savane/70 mb-1.5 block">
              Description complète <span className="text-terracotta">*</span>
            </label>
            <textarea
              value={form.descriptionFull}
              onChange={(e) => setForm({ ...form, descriptionFull: e.target.value })}
              placeholder="Décrivez le poste, les missions, le profil recherché, les avantages..."
              required
              rows={10}
              className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta resize-none"
            />
            <p className="font-dm text-xs text-savane/40 mt-1">{form.descriptionFull.length} caractères (min. 50)</p>
          </div>
        </div>

        {/* Skills */}
        <div className="bg-white rounded-2xl border border-sand-dark p-6 space-y-4">
          <h2 className="font-syne font-bold text-savane">Compétences requises</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={skillInput}
              onChange={(e) => setSkillInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              placeholder="ex: React, TypeScript, Node.js…"
              className="flex-1 px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
            />
            <button
              type="button"
              onClick={addSkill}
              className="px-4 py-3 bg-savane text-white rounded-xl font-dm text-sm hover:bg-savane/90 transition-colors"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>
          {form.requiredSkills.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {form.requiredSkills.map((skill) => (
                <span
                  key={skill}
                  className="inline-flex items-center gap-1.5 bg-savane/10 text-savane text-sm font-dm px-3 py-1.5 rounded-xl"
                >
                  {skill}
                  <button
                    type="button"
                    onClick={() => removeSkill(skill)}
                    className="hover:text-red-500 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={loading}
            className="bg-terracotta text-white px-8 py-3 rounded-xl font-dm font-semibold hover:bg-terracotta/90 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            {loading && (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            Publier l&apos;offre
          </button>
          <Link
            href="/recruiter/jobs"
            className="px-8 py-3 rounded-xl font-dm text-sm text-savane/60 hover:bg-sand-dark transition-colors flex items-center"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
