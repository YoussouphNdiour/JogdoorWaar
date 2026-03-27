'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Star, CheckCircle, User, Phone, Mail } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';

interface CvFile {
  id: string;
  label: string;
  fileUrl: string;
  isPrimary: boolean;
  createdAt: string;
  extractedText?: string;
}

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

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [cvs, setCvs] = useState<CvFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    title: '',
    city: '',
  });

  useEffect(() => {
    Promise.all([
      apiFetch<UserProfile>('/auth/me'),
      apiFetch<CvFile[]>('/cvs'),
    ]).then(([prof, cvList]) => {
      setProfile(prof);
      setCvs(cvList);
      setForm({
        firstName: prof.firstName,
        lastName: prof.lastName,
        phone: prof.phone ?? '',
        title: prof.title ?? '',
        city: prof.city ?? '',
      });
    }).catch(() => {});
  }, []);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      setUploadError('Seuls les fichiers PDF sont acceptés.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('Le fichier ne doit pas dépasser 5 Mo.');
      return;
    }
    setUploadError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name.replace('.pdf', ''));
      formData.append('label', file.name.replace('.pdf', ''));
      const newCv = await apiFetch<CvFile>('/cvs/upload', {
        method: 'POST',
        body: formData,
      });
      setCvs((prev) => [...prev, newCv]);
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : 'Erreur lors de l\'upload.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSetPrimary(cvId: string) {
    await apiFetch(`/cvs/${cvId}/set-default`, { method: 'PATCH' }).catch(() => {});
    setCvs((prev) => prev.map((c) => ({ ...c, isPrimary: c.id === cvId })));
  }

  async function handleDelete(cvId: string) {
    await apiFetch(`/cvs/${cvId}`, { method: 'DELETE' }).catch(() => {});
    setCvs((prev) => prev.filter((c) => c.id !== cvId));
  }

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      // Only include non-empty fields to avoid validation errors on blank phone
      const patch: Record<string, string> = {};
      if (form.firstName) patch.firstName = form.firstName;
      if (form.lastName) patch.lastName = form.lastName;
      if (form.phone) patch.phone = form.phone;
      if (form.title !== undefined) patch.title = form.title;
      if (form.city !== undefined) patch.city = form.city;
      await apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify(patch) });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }

  const MAX_CVS = profile?.plan === 'FREE' ? 2 : 99;
  const canUpload = cvs.length < MAX_CVS;

  return (
    <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
      <h1 className="font-syne text-2xl font-bold text-savane">Mon profil</h1>

      {/* Profile form */}
      <div className="bg-white rounded-2xl border border-sand-dark p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
            <User className="h-5 w-5 text-terracotta" />
          </div>
          <h2 className="font-syne font-bold text-savane">Informations personnelles</h2>
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Prénom</label>
              <input
                type="text"
                value={form.firstName}
                onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Nom</label>
              <input
                type="text"
                value={form.lastName}
                onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Email
              </label>
              <input
                type="email"
                value={profile?.email ?? ''}
                disabled
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane/50 cursor-not-allowed"
              />
            </div>
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Téléphone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+221 7X XXX XX XX"
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Titre professionnel</label>
              <input
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="ex: Développeur Full Stack"
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Ville</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                placeholder="ex: Dakar"
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="bg-terracotta text-white px-6 py-2.5 rounded-xl font-dm font-semibold hover:bg-terracotta/90 disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {saving && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Enregistrer
            </button>
            {saveSuccess && (
              <span className="flex items-center gap-1.5 text-sm font-dm text-savane">
                <CheckCircle className="h-4 w-4 text-green-500" />
                Profil mis à jour
              </span>
            )}
          </div>
        </form>
      </div>

      {/* CVs section */}
      <div className="bg-white rounded-2xl border border-sand-dark p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-terracotta/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-terracotta" />
            </div>
            <div>
              <h2 className="font-syne font-bold text-savane">Mes CVs</h2>
              <p className="font-dm text-xs text-savane/50">
                {cvs.length}/{profile?.plan === 'FREE' ? '2' : '∞'} utilisés
              </p>
            </div>
          </div>

          {canUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/pdf"
                onChange={handleUpload}
                className="hidden"
                id="cv-upload"
              />
              <label
                htmlFor="cv-upload"
                className={`flex items-center gap-2 px-4 py-2.5 bg-terracotta text-white rounded-xl font-dm text-sm font-semibold cursor-pointer hover:bg-terracotta/90 transition-colors ${uploading ? 'opacity-50 pointer-events-none' : ''}`}
              >
                {uploading ? (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                Uploader un CV
              </label>
            </>
          )}
        </div>

        {uploadError && (
          <div className="mb-4 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">
            {uploadError}
          </div>
        )}

        {!canUpload && profile?.plan === 'FREE' && (
          <div className="mb-4 bg-terracotta/10 border border-terracotta/20 rounded-xl px-4 py-3 font-dm text-sm text-terracotta">
            Limite de 2 CVs atteinte. Passez Premium pour en uploader plus.
          </div>
        )}

        {cvs.length === 0 ? (
          <div className="border-2 border-dashed border-sand-dark rounded-2xl p-12 text-center">
            <FileText className="h-10 w-10 text-savane/20 mx-auto mb-3" />
            <p className="font-dm text-savane/50 text-sm">Aucun CV uploadé.</p>
            <p className="font-dm text-savane/40 text-xs mt-1">
              Uploadez un PDF pour activer le matching IA.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {cvs.map((cv) => (
              <div
                key={cv.id}
                className={`flex items-center gap-4 p-4 rounded-xl border ${cv.isPrimary ? 'border-terracotta/30 bg-terracotta/5' : 'border-sand-dark bg-sand-dark/30'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-sand-dark">
                  <FileText className={`h-5 w-5 ${cv.isPrimary ? 'text-terracotta' : 'text-savane/40'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-dm font-medium text-savane text-sm truncate">{cv.label}</p>
                    {cv.isPrimary && (
                      <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-terracotta/20 text-terracotta">
                        <Star className="h-2.5 w-2.5" fill="currentColor" /> Principal
                      </span>
                    )}
                  </div>
                  <p className="font-dm text-xs text-savane/40 mt-0.5">
                    {new Date(cv.createdAt).toLocaleDateString('fr-SN', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0">
                  {!cv.isPrimary && (
                    <button
                      onClick={() => handleSetPrimary(cv.id)}
                      className="text-xs font-dm text-savane/50 hover:text-terracotta transition-colors px-3 py-1.5 rounded-lg hover:bg-terracotta/10"
                    >
                      Principal
                    </button>
                  )}
                  <a
                    href={cv.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-dm text-savane/50 hover:text-savane transition-colors px-3 py-1.5 rounded-lg hover:bg-sand-dark"
                  >
                    Voir
                  </a>
                  <button
                    onClick={() => handleDelete(cv.id)}
                    className="p-1.5 rounded-lg text-savane/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
