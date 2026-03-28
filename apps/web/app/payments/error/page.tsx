'use client';

import Link from 'next/link';

export default function PaymentErrorPage() {
  return (
    <div className="min-h-screen bg-[#FDFAF6] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="font-syne text-2xl font-bold text-savane mb-2">
          Paiement échoué
        </h1>
        <p className="font-dm text-savane/60 mb-8">
          Le paiement n&apos;a pas pu être complété. Aucun montant n&apos;a été débité.
          <br />
          Veuillez réessayer ou choisir un autre moyen de paiement.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/candidate/dashboard"
            className="inline-flex items-center justify-center gap-2 bg-[#E8580A] text-white font-dm font-medium px-6 py-3 rounded-xl hover:bg-[#E8580A]/90 transition-colors"
          >
            Réessayer
          </Link>
          <Link
            href="/candidate/dashboard"
            className="inline-flex items-center justify-center gap-2 border border-savane/20 text-savane font-dm font-medium px-6 py-3 rounded-xl hover:border-savane/40 transition-colors"
          >
            Retour au tableau de bord
          </Link>
        </div>
      </div>
    </div>
  );
}
