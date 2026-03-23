import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DM_Sans, Syne } from 'next/font/google';
import './globals.css';
import { PostHogProvider } from './providers';

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
});

const syne = Syne({
  subsets: ['latin'],
  variable: '--font-syne',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: "Jog Door Waar — Offres d'emploi au Sénégal",
    template: "%s | Jog Door Waar",
  },
  description:
    "Agrégateur IA d'offres d'emploi. Trouvez votre prochain emploi au Sénégal grâce à l'intelligence artificielle.",
  keywords: ['emploi sénégal', 'offre emploi dakar', 'recrutement sénégal', 'job sénégal'],
  openGraph: {
    siteName: 'Jog Door Waar',
    locale: 'fr_SN',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${dmSans.variable} ${syne.variable}`}>
      <body className="font-dm bg-sand antialiased">
        {/* PostHogPageView utilise useSearchParams → doit être dans une Suspense boundary */}
        <Suspense fallback={null}>
          <PostHogProvider>{children}</PostHogProvider>
        </Suspense>
      </body>
    </html>
  );
}
