'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

/**
 * Landing page after Google OAuth.
 * The API redirects here with ?token=<jwt>&userId=<id>
 * We store the token and forward the user to the dashboard.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get('token');

    if (token) {
      localStorage.setItem('access_token', token);
      router.replace('/candidate/dashboard');
    } else {
      // No token — something went wrong, send back to login
      router.replace('/auth/login?error=oauth');
    }
  }, [params, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFAF6]">
      <div className="text-center">
        <div className="w-10 h-10 border-2 border-[#E8580A] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="font-dm text-sm text-savane/60">Connexion en cours…</p>
      </div>
    </div>
  );
}
