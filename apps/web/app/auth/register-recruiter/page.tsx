'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';

export default function RegisterRecruiterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    company: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    setLoading(true);
    try {
      const data = await apiFetch<{ access_token: string; user: unknown }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...form, role: 'RECRUITER' }),
      });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/recruiter/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de l\'inscription.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-dm text-savane/60 hover:text-savane mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>

        <div className="bg-white rounded-3xl p-8 shadow-soft border border-sand-dark">
          <div className="mb-8">
            <div className="inline-flex items-center gap-2 bg-savane/10 text-savane px-3 py-1 rounded-full font-dm text-xs font-semibold mb-3">
              Espace Recruteur
            </div>
            <h1 className="font-syne text-2xl font-bold text-savane">Créer un compte recruteur</h1>
            <p className="font-dm text-sm text-savane/60 mt-1">
              Déjà inscrit ?{' '}
              <Link href="/auth/login" className="text-terracotta hover:underline">
                Se connecter
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-dm text-sm text-savane/70 mb-1.5 block">Prénom</label>
                <input
                  type="text"
                  value={form.firstName}
                  onChange={(e) => setForm({ ...form, firstName: e.target.value })}
                  placeholder="Aminata"
                  required
                  className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
                />
              </div>
              <div>
                <label className="font-dm text-sm text-savane/70 mb-1.5 block">Nom</label>
                <input
                  type="text"
                  value={form.lastName}
                  onChange={(e) => setForm({ ...form, lastName: e.target.value })}
                  placeholder="Diallo"
                  required
                  className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
                />
              </div>
            </div>

            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Entreprise</label>
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
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Email professionnel</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="vous@entreprise.com"
                required
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>

            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="Minimum 8 caractères"
                  minLength={8}
                  required
                  className="w-full px-4 py-3 pr-12 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-savane/40 hover:text-savane transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-savane text-white py-3.5 rounded-xl font-dm font-semibold hover:bg-savane/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2 mt-2"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Créer mon compte recruteur
            </button>

            <p className="text-xs font-dm text-savane/40 text-center">
              En vous inscrivant, vous acceptez nos{' '}
              <Link href="/legal/terms" className="underline hover:text-terracotta">CGU</Link>
              {' '}et notre{' '}
              <Link href="/legal/privacy" className="underline hover:text-terracotta">politique de confidentialité</Link>.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
