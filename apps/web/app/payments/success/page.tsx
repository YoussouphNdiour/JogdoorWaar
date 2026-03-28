'use client';

import { useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function PaymentSuccessPage() {
  const params = useSearchParams();
  const router = useRouter();
  const plan = params.get('plan') ?? 'PREMIUM';
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(timer);
          router.replace('/candidate/dashboard');
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-[#FDFAF6] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Icon */}
        <div className="w-20 h-20 rounded-full bg-[#1B4332]/10 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h1 className="font-syne text-2xl font-bold text-savane mb-2">
          Paiement réussi !
        </h1>
        <p className="font-dm text-savane/60 mb-1">
          Votre abonnement <span className="font-semibold text-[#E8580A]">{plan}</span> est maintenant actif.
        </p>
        <p className="font-dm text-sm text-savane/40 mb-8">
          Redirection dans {countdown}s…
        </p>

        <Link
          href="/candidate/dashboard"
          className="inline-flex items-center gap-2 bg-[#E8580A] text-white font-dm font-medium px-6 py-3 rounded-xl hover:bg-[#E8580A]/90 transition-colors"
        >
          Accéder au tableau de bord
        </Link>
      </div>
    </div>
  );
}
