'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api/client';
import { PLAN_PRICES, PLAN_PRICES_DISPLAY } from '../../../lib/constants';

// ─── Types ────────────────────────────────────────────────────────────────────

type Plan = 'FREE' | 'PREMIUM' | 'RECRUITER';
type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'STRIPE';

interface Invoice {
  id: string;
  date: string;
  plan: Plan;
  amount: number;
  method: PaymentMethod;
  status: 'PAID' | 'PENDING' | 'FAILED';
}

// ─── Feature list (from CLAUDE.md) ───────────────────────────────────────────

interface Feature {
  label: string;
  free: string | boolean;
  premium: string | boolean;
  recruiter: string | boolean;
}

const FEATURES: Feature[] = [
  { label: 'Offres illimitées', free: true, premium: true, recruiter: true },
  { label: 'Alertes email', free: '2 max', premium: true, recruiter: true },
  { label: 'Alertes WhatsApp', free: true, premium: true, recruiter: true },
  { label: 'CVs uploadables', free: '2 max', premium: 'Illimité', recruiter: 'Illimité' },
  { label: 'Candidature WhatsApp', free: true, premium: true, recruiter: true },
  { label: 'CVs générés par IA', free: '1/mois', premium: '10/mois', recruiter: 'Illimité' },
  { label: 'Score matching détaillé', free: 'Aperçu', premium: true, recruiter: true },
  { label: 'Lettre de motivation IA', free: '2/mois', premium: '10/mois', recruiter: true },
  { label: "Coach entretien IA", free: false, premium: '5/mois', recruiter: true },
  { label: 'Mode anonyme', free: false, premium: true, recruiter: false },
  { label: 'CRM candidatures', free: '10 max', premium: 'Illimité', recruiter: false },
  { label: "Publication d'offres", free: false, premium: false, recruiter: '10/mois' },
];


// ─── Helpers ──────────────────────────────────────────────────────────────────

function FeatureValue({ value }: { value: string | boolean }) {
  if (value === true) {
    return <span className="text-[#1B4332] font-semibold text-sm">✅</span>;
  }
  if (value === false) {
    return <span className="text-gray-300 text-sm">❌</span>;
  }
  return <span className="font-dm text-xs text-gray-600 font-medium">{value as string}</span>;
}

function StatusBadge({ status }: { status: Invoice['status'] }) {
  const map = {
    PAID: 'bg-green-100 text-green-700',
    PENDING: 'bg-yellow-100 text-yellow-700',
    FAILED: 'bg-red-100 text-red-600',
  } as const;
  const labels = { PAID: 'Payé', PENDING: 'En attente', FAILED: 'Échoué' } as const;
  return (
    <span className={`text-[10px] font-dm font-semibold px-2 py-0.5 rounded-full ${map[status]}`}>
      {labels[status]}
    </span>
  );
}

function MethodLabel({ method }: { method: PaymentMethod }) {
  const map = {
    WAVE: { label: 'Wave', color: 'text-blue-600' },
    ORANGE_MONEY: { label: 'Orange Money', color: 'text-orange-500' },
    STRIPE: { label: 'Carte bancaire', color: 'text-gray-600' },
  };
  return (
    <span className={`font-dm text-xs font-medium ${map[method].color}`}>
      {map[method].label}
    </span>
  );
}

// ─── Payment modal ────────────────────────────────────────────────────────────

function PaymentModal({
  plan,
  onClose,
}: {
  plan: 'PREMIUM' | 'RECRUITER';
  onClose: () => void;
}) {
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [payError, setPayError] = useState('');

  const price = plan === 'PREMIUM' ? PLAN_PRICES.PREMIUM : PLAN_PRICES.RECRUITER;
  const planLabel = plan === 'PREMIUM' ? 'Premium' : 'Recruteur';

  async function handleConfirm() {
    if (!method) return;
    setPayError('');
    setLoading(true);
    try {
      const result = await apiFetch<{ redirectUrl?: string; status: string }>('/payments/initiate', {
        method: 'POST',
        body: JSON.stringify({ plan, paymentMethod: method, phone: phone || undefined }),
      });
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
      } else {
        onClose();
      }
    } catch (err: unknown) {
      setPayError(err instanceof Error ? err.message : 'Erreur de paiement.');
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
        {/* Header */}
        <div className="bg-[#1B4332] px-6 py-5 flex items-center justify-between">
          <div>
            <h2 className="font-syne text-white font-bold text-lg">
              Passer {planLabel}
            </h2>
            <p className="font-dm text-white/60 text-sm">
              {price.toLocaleString('fr-FR')} FCFA / mois
            </p>
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

        {/* Payment options */}
        <div className="p-6 space-y-3">
          <p className="font-dm text-sm text-gray-500 mb-4">Choisissez votre mode de paiement :</p>

          {/* Wave */}
          <button
            onClick={() => setMethod('WAVE')}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
              method === 'WAVE'
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-100 hover:border-blue-200 bg-gray-50'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
              <span className="font-syne font-black text-blue-600 text-xs">W</span>
            </div>
            <div className="flex-1">
              <p className="font-dm font-semibold text-[#1B4332] text-sm">Payer avec Wave</p>
              <p className="font-dm text-xs text-gray-400">Paiement mobile instantané</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${method === 'WAVE' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'}`} />
          </button>

          {/* Orange Money */}
          <button
            onClick={() => setMethod('ORANGE_MONEY')}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
              method === 'ORANGE_MONEY'
                ? 'border-orange-400 bg-orange-50'
                : 'border-gray-100 hover:border-orange-200 bg-gray-50'
            }`}
          >
            <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center flex-shrink-0">
              <span className="font-syne font-black text-orange-500 text-xs">OM</span>
            </div>
            <div className="flex-1">
              <p className="font-dm font-semibold text-[#1B4332] text-sm">Payer avec Orange Money</p>
              <p className="font-dm text-xs text-gray-400">Entrez votre numéro ci-dessous</p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${method === 'ORANGE_MONEY' ? 'border-orange-400 bg-orange-400' : 'border-gray-300'}`} />
          </button>

          {/* Orange Money phone input */}
          {method === 'ORANGE_MONEY' && (
            <input
              type="tel"
              placeholder="+221 77 000 00 00"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-2.5 text-sm font-dm border border-orange-200 rounded-xl focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-200 bg-orange-50 placeholder-gray-400 transition-all"
            />
          )}

          {/* Stripe */}
          <button
            onClick={() => setMethod('STRIPE')}
            className={`w-full flex items-center gap-4 p-4 rounded-2xl border-2 transition-all text-left ${
              method === 'STRIPE'
                ? 'border-gray-700 bg-gray-900'
                : 'border-gray-100 hover:border-gray-300 bg-gray-50'
            }`}
          >
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${method === 'STRIPE' ? 'bg-white/10' : 'bg-gray-200'}`}>
              <svg className={`w-5 h-5 ${method === 'STRIPE' ? 'text-white' : 'text-gray-600'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className={`font-dm font-semibold text-sm ${method === 'STRIPE' ? 'text-white' : 'text-[#1B4332]'}`}>
                Carte internationale
              </p>
              <p className={`font-dm text-xs ${method === 'STRIPE' ? 'text-white/50' : 'text-gray-400'}`}>
                Visa, Mastercard — via Stripe
              </p>
            </div>
            <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 ${method === 'STRIPE' ? 'border-white bg-white' : 'border-gray-300'}`} />
          </button>

          {/* Payment error */}
          {payError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">
              {payError}
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleConfirm}
            disabled={!method || loading || (method === 'ORANGE_MONEY' && !phone)}
            className={`w-full mt-2 py-3 rounded-2xl font-dm font-semibold text-sm transition-all ${
              !method || loading || (method === 'ORANGE_MONEY' && !phone)
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-[#E8580A] hover:bg-[#c94a07] text-white shadow-sm hover:shadow-md'
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
              `Confirmer — ${price.toLocaleString('fr-FR')} FCFA`
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Plan card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  currentPlan,
  onUpgrade,
}: {
  plan: Plan;
  currentPlan: Plan;
  onUpgrade: (p: 'PREMIUM' | 'RECRUITER') => void;
}) {
  const isCurrent = plan === currentPlan;

  const config = {
    FREE: {
      label: 'Gratuit',
      price: null,
      description: 'Essayez les fonctionnalités essentielles',
      ctaLabel: 'Plan actuel',
      ctaDisabled: true,
      border: isCurrent ? 'border-[#E8580A]' : 'border-gray-100',
      badge: null,
    },
    PREMIUM: {
      label: 'Premium',
      price: PLAN_PRICES_DISPLAY.PREMIUM,
      description: 'Pour les candidats sérieux',
      ctaLabel: isCurrent ? 'Plan actuel' : 'Passer à Premium',
      ctaDisabled: isCurrent,
      border: isCurrent ? 'border-[#E8580A]' : 'border-gray-100',
      badge: 'Populaire',
    },
    RECRUITER: {
      label: 'Recruteur',
      price: PLAN_PRICES_DISPLAY.RECRUITER,
      description: 'Pour publier des offres et recruter',
      ctaLabel: isCurrent ? 'Plan actuel' : 'Passer Recruteur',
      ctaDisabled: isCurrent,
      border: isCurrent ? 'border-[#E8580A]' : 'border-gray-100',
      badge: null,
    },
  };

  const c = config[plan];

  const featureValue = (f: Feature) => {
    if (plan === 'FREE') return f.free;
    if (plan === 'PREMIUM') return f.premium;
    return f.recruiter;
  };

  return (
    <div
      className={`relative bg-white rounded-3xl border-2 ${c.border} p-6 flex flex-col ${
        isCurrent ? 'shadow-lg shadow-[#E8580A]/10' : 'shadow-sm'
      }`}
    >
      {isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#E8580A] text-white text-[10px] font-dm font-bold px-3 py-1 rounded-full">
            VOTRE PLAN
          </span>
        </div>
      )}
      {c.badge && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <span className="bg-[#F5C842] text-[#1B4332] text-[10px] font-dm font-bold px-3 py-1 rounded-full">
            {c.badge}
          </span>
        </div>
      )}

      <div className="mb-4">
        <h3 className="font-syne text-lg font-bold text-[#1B4332]">{c.label}</h3>
        <div className="mt-1 mb-1">
          {c.price ? (
            <div className="flex items-baseline gap-1">
              <span className="font-syne text-3xl font-black text-[#E8580A]">{c.price}</span>
              <span className="font-dm text-sm text-gray-400">FCFA/mois</span>
            </div>
          ) : (
            <span className="font-syne text-3xl font-black text-[#1B4332]">Gratuit</span>
          )}
        </div>
        <p className="font-dm text-xs text-gray-500">{c.description}</p>
      </div>

      {/* Feature list */}
      <ul className="space-y-2 flex-1 mb-6">
        {FEATURES.map((f) => {
          const val = featureValue(f);
          if (val === false) return null;
          return (
            <li key={f.label} className="flex items-center gap-2">
              <FeatureValue value={val} />
              <span className="font-dm text-xs text-gray-600">{f.label}</span>
            </li>
          );
        })}
        {/* Show crossed-out unavailable features */}
        {FEATURES.map((f) => {
          const val = featureValue(f);
          if (val !== false) return null;
          return (
            <li key={f.label} className="flex items-center gap-2 opacity-40">
              <span className="text-gray-300 text-sm">❌</span>
              <span className="font-dm text-xs text-gray-400 line-through">{f.label}</span>
            </li>
          );
        })}
      </ul>

      <button
        disabled={c.ctaDisabled}
        onClick={() => !c.ctaDisabled && plan !== 'FREE' && onUpgrade(plan as 'PREMIUM' | 'RECRUITER')}
        className={`w-full py-3 rounded-2xl font-dm font-semibold text-sm transition-all ${
          c.ctaDisabled
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : plan === 'PREMIUM'
            ? 'bg-[#E8580A] hover:bg-[#c94a07] text-white shadow-sm hover:shadow-md'
            : 'bg-[#1B4332] hover:bg-[#143326] text-white shadow-sm hover:shadow-md'
        }`}
      >
        {c.ctaLabel}
      </button>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function BillingPage() {
  const [upgradeTarget, setUpgradeTarget] = useState<'PREMIUM' | 'RECRUITER' | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan>('FREE');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [billingLoading, setBillingLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiFetch<{ plan: Plan }>('/auth/me').then((u) => setCurrentPlan(u.plan)),
      apiFetch<Invoice[]>('/payments/invoices').then(setInvoices),
    ])
      .catch(() => {})
      .finally(() => setBillingLoading(false));
  }, []);

  const planLabels: Record<Plan, string> = {
    FREE: 'Gratuit',
    PREMIUM: 'Premium',
    RECRUITER: 'Recruteur',
  };

  const methodLabels: Record<PaymentMethod, string> = {
    WAVE: 'Wave',
    ORANGE_MONEY: 'Orange Money',
    STRIPE: 'Carte bancaire',
  };

  if (billingLoading) {
    return (
      <div className="max-w-5xl mx-auto px-6 py-8 animate-pulse space-y-4">
        <div className="h-8 bg-sand-dark rounded w-1/3" />
        <div className="h-32 bg-sand-dark rounded-3xl" />
        <div className="h-64 bg-sand-dark rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-8 space-y-10">
      {/* Header */}
      <div>
        <h1 className="font-syne text-2xl font-bold text-[#1B4332]">Abonnement &amp; Facturation</h1>
        <p className="font-dm text-sm text-gray-500 mt-1">
          Gérez votre plan et vos moyens de paiement.
        </p>
      </div>

      {/* Current plan card */}
      <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FDFAF6] border border-gray-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-[#E8580A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
              </svg>
            </div>
            <div>
              <p className="font-dm text-xs text-gray-400">Plan actuel</p>
              <p className="font-syne font-bold text-[#1B4332] text-xl">
                {planLabels[currentPlan]}
              </p>
              {currentPlan === 'FREE' && (
                <p className="font-dm text-xs text-gray-400 mt-0.5">Aucune date d&apos;expiration</p>
              )}
            </div>
          </div>
          <button
            onClick={() => setUpgradeTarget('PREMIUM')}
            className="flex items-center gap-2 bg-[#E8580A] hover:bg-[#c94a07] text-white text-sm font-dm font-semibold px-5 py-2.5 rounded-xl transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18" />
            </svg>
            Passer Premium
          </button>
        </div>
      </div>

      {/* Plans comparison */}
      <div>
        <h2 className="font-syne text-lg font-bold text-[#1B4332] mb-6">Comparer les plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {(['FREE', 'PREMIUM', 'RECRUITER'] as Plan[]).map((plan) => (
            <PlanCard
              key={plan}
              plan={plan}
              currentPlan={currentPlan}
              onUpgrade={setUpgradeTarget}
            />
          ))}
        </div>
      </div>

      {/* Invoice history */}
      <div>
        <h2 className="font-syne text-lg font-bold text-[#1B4332] mb-4">Historique des paiements</h2>
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          {invoices.length === 0 ? (
            <div className="p-8 text-center">
              <p className="font-dm text-sm text-gray-400">Aucun paiement enregistré.</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-[#FDFAF6] border-b border-gray-100">
                  <th className="text-left font-dm text-xs font-semibold text-gray-500 px-6 py-3">
                    Référence
                  </th>
                  <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">
                    Date
                  </th>
                  <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">
                    Plan
                  </th>
                  <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">
                    Montant
                  </th>
                  <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">
                    Méthode
                  </th>
                  <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">
                    Statut
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#FDFAF6] transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-dm text-xs text-gray-500 font-mono">{inv.id}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-dm text-sm text-[#1B4332]">
                        {new Date(inv.date).toLocaleDateString('fr-SN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-dm text-sm font-medium text-[#1B4332]">
                        {planLabels[inv.plan]}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-syne font-bold text-[#E8580A] text-sm">
                        {inv.amount.toLocaleString('fr-FR')} FCFA
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <MethodLabel method={inv.method} />
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {upgradeTarget && (
        <PaymentModal plan={upgradeTarget} onClose={() => setUpgradeTarget(null)} />
      )}
    </div>
  );
}
