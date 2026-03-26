'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Mail } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-sand flex items-center justify-center px-6">
      <div className="w-full max-w-md">
        <Link
          href="/auth/login"
          className="inline-flex items-center gap-2 text-sm font-dm text-savane/60 hover:text-savane mb-8 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Retour à la connexion
        </Link>

        <div className="bg-white rounded-3xl p-8 shadow-soft border border-sand-dark">
          <div className="mb-8">
            <div className="w-12 h-12 rounded-2xl bg-terracotta/10 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-terracotta" />
            </div>
            <h1 className="font-syne text-2xl font-bold text-savane">Mot de passe oublié</h1>
            <p className="font-dm text-sm text-savane/60 mt-1">
              Entrez votre email pour recevoir un lien de réinitialisation.
            </p>
          </div>

          {sent ? (
            <div className="bg-savane/10 border border-savane/20 rounded-2xl p-6 text-center">
              <div className="text-2xl mb-2">✉️</div>
              <p className="font-dm font-semibold text-savane">Email envoyé !</p>
              <p className="font-dm text-sm text-savane/60 mt-1">
                Vérifiez votre boîte mail et cliquez sur le lien pour réinitialiser votre mot de passe.
              </p>
              <Link
                href="/auth/login"
                className="mt-4 inline-block font-dm text-sm text-terracotta hover:underline"
              >
                Retour à la connexion
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="font-dm text-sm text-savane/70 mb-1.5 block">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.com"
                  required
                  className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-terracotta text-white py-3.5 rounded-xl font-dm font-semibold hover:bg-terracotta/90 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                Envoyer le lien
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
