'use client';

import { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Trash2, Star, CheckCircle, User, Phone, Mail, MessageCircle, Send } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface CvFile {
  id: string;
  name: string;
  label?: string;
  fileName: string;
  fileUrl: string;
  fileSize?: number;
  isDefault: boolean;
  isGenerated: boolean;
  detectedSkills: string[];
  createdAt: string;
}

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  whatsappNumber?: string;
  whatsappVerified: boolean;
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

  const [gmailConnected, setGmailConnected] = useState(false);
  const [disconnectingGmail, setDisconnectingGmail] = useState(false);

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    phone: '',
    whatsappNumber: '',
    title: '',
    city: '',
  });

  useEffect(() => {
    // Check for Gmail connect/error redirect param
    const params = new URLSearchParams(window.location.search);
    if (params.get('gmailConnected') === '1') {
      setGmailConnected(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    Promise.all([
      apiFetch<UserProfile>('/auth/me'),
      apiFetch<CvFile[]>('/cvs'),
      apiFetch<{ connected: boolean }>('/auth/gmail/status').catch(() => ({ connected: false })),
    ]).then(([prof, cvList, gmailStatus]) => {
      setProfile(prof);
      setCvs(cvList);
      setGmailConnected(gmailStatus.connected);
      setForm({
        firstName: prof.firstName,
        lastName: prof.lastName,
        phone: prof.phone ?? '',
        whatsappNumber: prof.whatsappNumber ?? '',
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
    setCvs((prev) => prev.map((c) => ({ ...c, isDefault: c.id === cvId })));
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
      if (form.whatsappNumber) patch.whatsappNumber = form.whatsappNumber;
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
              <label className="font-dm text-sm text-savane/70 mb-1.5 block flex items-center gap-2">
                <MessageCircle className="h-3.5 w-3.5 text-green-600" />
                Numéro WhatsApp
                {profile?.whatsappVerified && (
                  <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    Lié ✓
                  </span>
                )}
              </label>
              <input
                type="tel"
                value={form.whatsappNumber}
                onChange={(e) => setForm({ ...form, whatsappNumber: e.target.value })}
                placeholder="221771234567"
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
              <p className="font-dm text-[11px] text-savane/40 mt-1">
                Format international sans + ni espaces. Ex: 221771234567
              </p>
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

      {/* Gmail connect */}
      <div className="bg-white rounded-2xl border border-sand-dark p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Send className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h2 className="font-syne font-bold text-savane">Envoi depuis votre Gmail</h2>
            <p className="font-dm text-xs text-savane/50">
              Vos candidatures seront envoyées depuis votre propre boîte Gmail
            </p>
          </div>
        </div>

        {gmailConnected ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <div>
                <p className="font-dm text-sm font-semibold text-green-800">Gmail connecté</p>
                <p className="font-dm text-xs text-green-600">
                  Les emails de candidature sont envoyés depuis votre compte Google
                </p>
              </div>
            </div>
            <button
              onClick={async () => {
                setDisconnectingGmail(true);
                await apiFetch('/auth/gmail/disconnect', { method: 'GET' }).catch(() => {});
                setGmailConnected(false);
                setDisconnectingGmail(false);
              }}
              disabled={disconnectingGmail}
              className="font-dm text-xs text-red-500 hover:text-red-700 transition-colors disabled:opacity-50"
            >
              Déconnecter
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-[#FDFAF6] border border-sand-dark rounded-xl px-4 py-3">
            <div>
              <p className="font-dm text-sm text-savane/70">
                Par défaut, les emails sont envoyés par Jog Door Waar au nom de votre candidature.
              </p>
              <p className="font-dm text-xs text-savane/50 mt-0.5">
                Connecter Gmail permet d&apos;envoyer depuis votre propre adresse — plus personnel, meilleur taux de réponse.
              </p>
            </div>
            <a
              href={`${API_URL}/auth/gmail/connect`}
              className="ml-4 flex-shrink-0 flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 font-dm text-sm font-medium text-savane hover:border-savane/40 transition-colors shadow-sm"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Connecter Gmail
            </a>
          </div>
        )}
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
                className={`flex items-center gap-4 p-4 rounded-xl border ${cv.isDefault ? 'border-terracotta/30 bg-terracotta/5' : 'border-sand-dark bg-sand-dark/30'}`}
              >
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center flex-shrink-0 border border-sand-dark">
                  <FileText className={`h-5 w-5 ${cv.isDefault ? 'text-terracotta' : 'text-savane/40'}`} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-dm font-medium text-savane text-sm truncate">{cv.label}</p>
                    {cv.isDefault && (
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
                  {!cv.isDefault && (
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
