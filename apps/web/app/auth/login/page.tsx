'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';

export default function LoginPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ email: '', password: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch<{ access_token: string; user: unknown }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      localStorage.setItem('access_token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      router.push('/candidate/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Email ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        {/* Back */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm font-dm text-savane/60 hover:text-savane mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour
        </Link>

        <div className="bg-white rounded-3xl p-8 shadow-soft border border-sand-dark">
          <div className="mb-8">
            <h1 className="font-syne text-2xl font-bold text-savane">Connexion</h1>
            <p className="font-dm text-sm text-savane/60 mt-1">
              Pas encore de compte ?{' '}
              <Link href="/auth/register" className="text-terracotta hover:underline">
                S'inscrire
              </Link>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="vous@exemple.com"
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
                  placeholder="••••••••"
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
              <div className="text-right mt-1.5">
                <Link
                  href="/auth/forgot-password"
                  className="font-dm text-xs text-terracotta hover:underline"
                >
                  Mot de passe oublié ?
                </Link>
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
              className="w-full bg-terracotta text-white py-3.5 rounded-xl font-dm font-semibold hover:bg-terracotta-600 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {loading && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              Se connecter
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-sand-dark" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-3 font-dm text-xs text-savane/40">ou</span>
            </div>
          </div>

          <a
            href={`${process.env.NEXT_PUBLIC_API_URL ?? 'https://jdw-api-ubi5.onrender.com'}/auth/google`}
            className="w-full flex items-center justify-center gap-3 border border-sand-dark py-3 rounded-xl font-dm text-sm text-savane hover:bg-sand-dark transition-colors"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continuer avec Google
          </a>
        </div>
      </div>
    </div>
  );
}
