'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LayoutDashboard, Briefcase, Users, CreditCard, LogOut, Zap } from 'lucide-react';
import { cn } from '@jdw/ui';

const NAV_ITEMS = [
  { href: '/recruiter/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/recruiter/jobs', label: 'Mes offres', icon: Briefcase },
  { href: '/recruiter/billing', label: 'Abonnement', icon: CreditCard },
];

export default function RecruiterLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-sand flex">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-sand-dark flex-shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-sand-dark">
          <Link href="/recruiter/dashboard">
            <span className="font-syne text-lg font-bold text-savane">Jog Door Waar</span>
          </Link>
          <span className="block font-dm text-xs text-terracotta mt-0.5">Espace Recruteur</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/');
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-xl font-dm text-sm transition-colors',
                  active
                    ? 'bg-terracotta/10 text-terracotta font-medium'
                    : 'text-savane/60 hover:bg-sand-dark hover:text-savane',
                )}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-4 space-y-2">
          <Link
            href="/recruiter/jobs/new"
            className="flex items-center gap-2 px-3 py-2.5 bg-terracotta text-white rounded-xl font-dm text-sm font-semibold hover:bg-terracotta/90 transition-colors"
          >
            <Zap className="h-4 w-4" />
            Publier une offre
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 w-full rounded-xl font-dm text-sm text-savane/50 hover:bg-sand-dark hover:text-savane transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {/* Mobile header */}
        <header className="md:hidden sticky top-0 z-40 bg-white border-b border-sand-dark px-4 py-3 flex items-center justify-between">
          <div>
            <span className="font-syne text-base font-bold text-savane">Jog Door Waar</span>
            <span className="block font-dm text-xs text-terracotta">Recruteur</span>
          </div>
          <button className="p-2 rounded-lg hover:bg-sand-dark text-savane/60">
            <Users className="h-5 w-5" />
          </button>
        </header>

        <main>{children}</main>
      </div>
    </div>
  );
}
