'use client';

import { useState } from 'react';
import { apiFetch } from '../../../lib/api/client';
import { PLAN_PRICES_DISPLAY } from '../../../lib/constants';

type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'STRIPE';

const FEATURES = [
  { label: "Publication d'offres", value: '10/mois' },
  { label: 'Offres boostées', value: '3 incluses' },
  { label: 'Candidatures reçues', value: 'Illimitées' },
  { label: 'Accès aux CVs candidats', value: '✅' },
  { label: 'Matching IA automatique', value: '✅' },
  { label: 'Notifications candidatures', value: 'Email + WhatsApp' },
  { label: 'Statistiques de vues', value: '✅' },
  { label: 'Support prioritaire', value: '✅' },
];

function PaymentModal({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    if (!method) return;
    setError('');
    setLoading(true);
    try {
      const result = await apiFetch<{ redirectUrl?: string; status: string }>('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({ plan: 'RECRUITER', paymentMethod: method, phone: phone || undefined }),
      });
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de paiement.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="bg-savane px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="font-syne text-white font-bold text-lg">Abonnement Recruteur</h2>
            <p className="font-dm text-white/60 text-sm">{PLAN_PRICES_DISPLAY.RECRUITER} FCFA / mois</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="font-dm text-sm text-gray-500 mb-4">Choisissez votre mode de paiement :</p>

          {/* Wave */}
          <button
            onClick={() => setMethod('WAVE')}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${method === 'WAVE' ? 'border-blue-500 bg-blue-50' : 'border-gray-100 hover:border-blue-200 bg-gray-50'}`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="font-syne font-black text-blue-600 text-xs">W</span>
            </div>
            <div className="flex-1">
              <p className="font-dm font-semibold text-savane text-sm">Payer avec Wave</p>
              <p className="font-dm text-xs text-gray-400">Paiement mobile instantané</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${method === 'WAVE' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`} />
          </button>

          {/* Orange Money */}
          <button
            onClick={() => setMethod('ORANGE_MONEY')}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${method === 'ORANGE_MONEY' ? 'border-orange-400 bg-orange-50' : 'border-gray-100 hover:border-orange-200 bg-gray-50'}`}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <span className="font-syne font-black text-orange-500 text-xs">OM</span>
            </div>
            <div className="flex-1">
              <p className="font-dm font-semibold text-savane text-sm">Orange Money</p>
              <p className="font-dm text-xs text-gray-400">Entrez votre numéro ci-dessous</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${method === 'ORANGE_MONEY' ? 'border-orange-400 bg-orange-400' : 'border-gray-300'}`} />
          </button>

          {method === 'ORANGE_MONEY' && (
            <input
              type="tel"
              placeholder="+221 77 000 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 text-sm font-dm border border-orange-200 rounded-xl focus:outline-none focus:border-orange-400 bg-orange-50 placeholder-gray-400 transition-all"
            />
          )}

          {/* Stripe */}
          <button
            onClick={() => setMethod('STRIPE')}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${method === 'STRIPE' ? 'border-gray-700 bg-gray-900' : 'border-gray-100 hover:border-gray-300 bg-gray-50'}`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${method === 'STRIPE' ? 'bg-white/10' : 'bg-gray-200'}`}>
              <svg className={`w-5 h-5 ${method === 'STRIPE' ? 'text-white' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className={`font-dm font-semibold text-sm ${method === 'STRIPE' ? 'text-white' : 'text-savane'}`}>Carte internationale</p>
              <p className={`font-dm text-xs ${method === 'STRIPE' ? 'text-white/50' : 'text-gray-400'}`}>Visa, Mastercard — via Stripe</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${method === 'STRIPE' ? 'border-white bg-white' : 'border-gray-300'}`} />
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">{error}</div>
          )}

          <button
            onClick={handleConfirm}
            disabled={!method || loading || (method === 'ORANGE_MONEY' && !phone)}
            className={`w-full mt-2 py-3 rounded-2xl font-dm font-semibold text-sm transition-all ${
              !method || loading || (method === 'ORANGE_MONEY' && !phone)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-savane hover:bg-savane/90 text-white'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Traitement...
              </span>
            ) : (
              `Confirmer — ${PLAN_PRICES_DISPLAY.RECRUITER} FCFA`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function RecruiterBillingPage() {
  const [showModal, setShowModal] = useState(false);

  return (
    <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
      <div>
        <h1 className="font-syne text-2xl font-bold text-savane">Abonnement Recruteur</h1>
        <p className="font-dm text-sm text-savane/60 mt-1">Gérez votre plan et publiez des offres.</p>
      </div>

      {/* Current plan */}
      <div className="bg-white rounded-2xl border border-sand-dark p-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-dm text-xs text-savane/50">Plan actuel</p>
          <p className="font-syne text-xl font-bold text-savane mt-0.5">Recruteur</p>
          <p className="font-dm text-xs text-savane/50 mt-0.5">{PLAN_PRICES_DISPLAY.RECRUITER} FCFA / mois</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="bg-terracotta text-white px-5 py-2.5 rounded-xl font-dm text-sm font-semibold hover:bg-terracotta/90 transition-colors"
        >
          Renouveler
        </button>
      </div>

      {/* Features */}
      <div className="bg-white rounded-2xl border border-sand-dark p-6">
        <h2 className="font-syne font-bold text-savane mb-5">Ce qui est inclus</h2>
        <ul className="space-y-3">
          {FEATURES.map(({ label, value }) => (
            <li key={label} className="flex items-center justify-between">
              <span className="font-dm text-sm text-savane/70">{label}</span>
              <span className="font-dm text-sm font-semibold text-savane">{value}</span>
            </li>
          ))}
        </ul>
      </div>

      {showModal && <PaymentModal onClose={() => setShowModal(false)} />}
    </div>
  );
}
