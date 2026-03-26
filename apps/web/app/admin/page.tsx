'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getAdminStats,
  getAdminUsers,
  getAdminJobs,
  getAdminScrapingStats,
  triggerScraper,
  updateAdminUser,
  updateAdminJob,
  type AdminUser,
  type AdminJob,
  type ScrapingStats,
  type PlatformStats,
  type UserPlan,
  type UserRole,
} from '@/lib/api/admin';

// ─── Types ────────────────────────────────────────────────────────────────────

type AdminTab = 'dashboard' | 'users' | 'jobs' | 'scraping' | 'revenue';

interface ScrapingSource {
  id: string;
  name: string;
  url: string;
  totalJobs: number;
  lastScraped: string | null;
  status: 'active' | 'idle' | 'running' | 'error';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function PlanBadge({ plan }: { plan: UserPlan }) {
  const map: Record<UserPlan, string> = {
    FREE: 'bg-gray-100 text-gray-500',
    PREMIUM: 'bg-[#E8580A]/10 text-[#E8580A]',
    RECRUITER: 'bg-[#1B4332]/10 text-[#1B4332]',
  };
  const labels: Record<UserPlan, string> = {
    FREE: 'Gratuit',
    PREMIUM: 'Premium',
    RECRUITER: 'Recruteur',
  };
  return (
    <span className={`text-[10px] font-dm font-bold px-2 py-0.5 rounded-full ${map[plan]}`}>
      {labels[plan]}
    </span>
  );
}

function RoleBadge({ role }: { role: UserRole }) {
  const map: Record<UserRole, string> = {
    CANDIDATE: 'bg-blue-50 text-blue-600',
    RECRUITER: 'bg-yellow-50 text-yellow-700',
    ADMIN: 'bg-red-50 text-red-600',
    SUPERADMIN: 'bg-purple-50 text-purple-700',
  };
  const labels: Record<UserRole, string> = {
    CANDIDATE: 'Candidat',
    RECRUITER: 'Recruteur',
    ADMIN: 'Admin',
    SUPERADMIN: 'Super Admin',
  };
  return (
    <span className={`text-[10px] font-dm font-semibold px-2 py-0.5 rounded-full ${map[role]}`}>
      {labels[role]}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const colorMap: Record<string, string> = {
    emploisenegal: 'bg-blue-100 text-blue-700',
    emploidakar: 'bg-indigo-100 text-indigo-700',
    senjob: 'bg-teal-100 text-teal-700',
    senejobs: 'bg-cyan-100 text-cyan-700',
    LinkedIn: 'bg-[#0A66C2]/10 text-[#0A66C2]',
    afrirh: 'bg-orange-100 text-orange-700',
    'expat-dakar': 'bg-pink-100 text-pink-700',
    senrh: 'bg-purple-100 text-purple-700',
  };
  const cls = colorMap[source] ?? 'bg-gray-100 text-gray-600';
  return (
    <span className={`text-[10px] font-dm font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {source}
    </span>
  );
}

function StatusDot({ status }: { status: ScrapingSource['status'] }) {
  const map = {
    active: 'bg-green-400',
    idle: 'bg-gray-300',
    running: 'bg-[#F5C842] animate-pulse',
    error: 'bg-red-400',
  };
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${map[status]}`} />;
}

// ─── Tab components ───────────────────────────────────────────────────────────

function userDisplayName(u: AdminUser): string {
  if (u.firstName || u.lastName) return `${u.firstName ?? ''} ${u.lastName ?? ''}`.trim();
  return u.email.split('@')[0] ?? u.email;
}

function userInitials(u: AdminUser): string {
  const name = userDisplayName(u);
  return name
    .split(' ')
    .map((w) => w[0]?.toUpperCase() ?? '')
    .slice(0, 2)
    .join('');
}

function DashboardTab() {
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);

  useEffect(() => {
    getAdminStats().then(setPlatformStats).catch(console.error);
    getAdminUsers({ page: 1, limit: 5 }).then((r) => setRecentUsers(r?.data ?? [])).catch(console.error);
  }, []);

  const stats = [
    { label: 'Total utilisateurs', value: platformStats ? platformStats.totalUsers.toLocaleString('fr-FR') : '…', icon: '👥', trend: `+${platformStats?.newUsersThisMonth ?? 0} ce mois`, color: 'text-[#1B4332]', bg: 'bg-[#1B4332]/10' },
    { label: 'Utilisateurs Premium', value: platformStats ? platformStats.premiumUsers.toLocaleString('fr-FR') : '…', icon: '⭐', trend: `+${platformStats?.recruiterUsers ?? 0} recruteurs`, color: 'text-[#E8580A]', bg: 'bg-[#E8580A]/10' },
    { label: 'Offres actives', value: platformStats ? platformStats.activeJobs.toLocaleString('fr-FR') : '…', icon: '💼', trend: `+${platformStats?.jobsThisWeek ?? 0} cette semaine`, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Candidatures', value: platformStats ? platformStats.totalApplications.toLocaleString('fr-FR') : '…', icon: '📋', trend: `${platformStats?.activeSubscriptions ?? 0} abonnés actifs`, color: 'text-[#92700A]', bg: 'bg-[#FEF9C3]' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className={`w-10 h-10 ${s.bg} rounded-xl flex items-center justify-center text-lg mb-3`}>
              {s.icon}
            </div>
            <div className={`font-syne text-2xl font-black ${s.color}`}>{s.value}</div>
            <div className="font-dm text-xs text-gray-500 mt-0.5">{s.label}</div>
            <div className="font-dm text-[10px] text-green-600 font-semibold mt-1">{s.trend} ce mois</div>
          </div>
        ))}
      </div>

      {/* Revenue + Recent signups */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Revenue chart */}
        <div className="xl:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-syne font-bold text-[#1B4332]">Revenu mensuel</h3>
              <p className="font-dm text-xs text-gray-400">6 derniers mois</p>
            </div>
            <div className="text-right">
              <p className="font-syne text-2xl font-black text-[#E8580A]">
                {platformStats ? platformStats.monthlyRevenueFcfa.toLocaleString('fr-FR') : '…'}
              </p>
              <p className="font-dm text-xs text-gray-400">FCFA ce mois</p>
            </div>
          </div>
          {/* Bar chart — static illustration until revenue history API exists */}
          <div className="flex items-end gap-2 h-32">
            {[
              { month: 'Oct', amount: 45000 },
              { month: 'Nov', amount: 87500 },
              { month: 'Déc', amount: 122000 },
              { month: 'Jan', amount: 98000 },
              { month: 'Fév', amount: 143500 },
              { month: 'Mar', amount: platformStats?.monthlyRevenueFcfa ?? 189000 },
            ].map((bar) => {
              const maxAmount = Math.max(45000, 87500, 122000, 98000, 143500, platformStats?.monthlyRevenueFcfa ?? 189000);
              const heightPct = (bar.amount / maxAmount) * 100;
              const isCurrent = bar.month === 'Mar';
              return (
                <div key={bar.month} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative group" style={{ height: '112px' }}>
                    <div
                      className={`absolute bottom-0 w-full rounded-t-lg transition-all ${
                        isCurrent ? 'bg-[#E8580A]' : 'bg-[#1B4332]/20 group-hover:bg-[#1B4332]/40'
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 opacity-0 group-hover:opacity-100 bg-[#1B4332] text-white text-[9px] font-dm px-2 py-0.5 rounded-lg whitespace-nowrap pointer-events-none transition-opacity z-10">
                      {bar.amount.toLocaleString('fr-FR')} FCFA
                    </div>
                  </div>
                  <span className={`font-dm text-[10px] ${isCurrent ? 'text-[#E8580A] font-bold' : 'text-gray-400'}`}>
                    {bar.month}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent signups */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-syne font-bold text-[#1B4332] mb-4">Inscriptions récentes</h3>
          <div className="space-y-3">
            {recentUsers.length === 0 && (
              <p className="font-dm text-xs text-gray-400">Chargement...</p>
            )}
            {recentUsers.map((u) => (
              <div key={u.id} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
                  <span className="font-syne text-[10px] font-bold text-[#1B4332]">{userInitials(u)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-dm text-sm font-medium text-[#1B4332] truncate">{userDisplayName(u)}</p>
                  <p className="font-dm text-[10px] text-gray-400 truncate">{u.email}</p>
                </div>
                <PlanBadge plan={u.plan} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState<UserPlan | 'ALL'>('ALL');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'ALL'>('ALL');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    getAdminUsers({ search, plan: planFilter, role: roleFilter, limit: 50 })
      .then((r) => setUsers(r?.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [search, planFilter, roleFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchUsers, 300);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  async function handleBan(u: AdminUser) {
    try {
      await updateAdminUser(u.id, { isActive: !u.isActive });
      fetchUsers();
    } catch (e) {
      console.error(e);
    }
  }

  const filtered = users;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher un utilisateur..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm font-dm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-[#E8580A] focus:ring-1 focus:ring-[#E8580A]/20 transition-all placeholder-gray-400"
          />
        </div>
        <select
          value={planFilter}
          onChange={(e) => setPlanFilter(e.target.value as UserPlan | 'ALL')}
          className="text-sm font-dm bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#E8580A] text-[#1B4332] cursor-pointer"
        >
          <option value="ALL">Tous les plans</option>
          <option value="FREE">Gratuit</option>
          <option value="PREMIUM">Premium</option>
          <option value="RECRUITER">Recruteur</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value as UserRole | 'ALL')}
          className="text-sm font-dm bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#E8580A] text-[#1B4332] cursor-pointer"
        >
          <option value="ALL">Tous les rôles</option>
          <option value="CANDIDATE">Candidat</option>
          <option value="RECRUITER">Recruteur</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="bg-[#FDFAF6] border-b border-gray-100">
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-5 py-3">Utilisateur</th>
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">Plan</th>
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">Rôle</th>
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">Inscrit le</th>
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-[#FDFAF6] transition-colors">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-[#1B4332]/10 flex items-center justify-center flex-shrink-0">
                      <span className="font-syne text-[10px] font-bold text-[#1B4332]">{userInitials(u)}</span>
                    </div>
                    <div>
                      <p className="font-dm text-sm font-medium text-[#1B4332]">{userDisplayName(u)}</p>
                      <p className="font-dm text-[10px] text-gray-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PlanBadge plan={u.plan} />
                </td>
                <td className="px-4 py-3">
                  <RoleBadge role={u.role as 'CANDIDATE' | 'RECRUITER' | 'ADMIN'} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-dm text-xs text-gray-500">
                    {new Date(u.createdAt).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => handleBan(u)}
                    className={`text-xs font-dm font-medium transition-colors ${u.isActive ? 'text-red-500 hover:text-red-700' : 'text-green-600 hover:text-green-800'}`}
                  >
                    {u.isActive ? 'Bannir' : 'Réactiver'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="font-dm text-sm text-gray-400">Aucun utilisateur trouvé.</p>
          </div>
        )}
        {loading && (
          <div className="py-10 text-center">
            <p className="font-dm text-sm text-gray-400">Chargement...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function JobsTab() {
  const [sourceFilter, setSourceFilter] = useState('ALL');
  const [verifiedFilter, setVerifiedFilter] = useState<boolean | 'ALL'>('ALL');
  const [jobs, setJobs] = useState<AdminJob[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchJobs = useCallback(() => {
    setLoading(true);
    getAdminJobs({
      sourcePlatform: sourceFilter !== 'ALL' ? sourceFilter : undefined,
      isVerified: verifiedFilter !== 'ALL' ? verifiedFilter : undefined,
      limit: 50,
    })
      .then((r) => setJobs(r?.data ?? []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sourceFilter, verifiedFilter]);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  async function handleVerify(j: AdminJob) {
    try {
      await updateAdminJob(j.id, { isVerified: true });
      fetchJobs();
    } catch (e) { console.error(e); }
  }

  async function handleToggleActive(j: AdminJob) {
    try {
      await updateAdminJob(j.id, { isActive: !j.isActive });
      fetchJobs();
    } catch (e) { console.error(e); }
  }

  const sources = ['ALL', ...Array.from(new Set(jobs.map((j) => j.sourcePlatform)))];
  const filtered = jobs;

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="text-sm font-dm bg-white border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-[#E8580A] text-[#1B4332] cursor-pointer"
        >
          {sources.map((s) => (
            <option key={s} value={s}>
              {s === 'ALL' ? 'Toutes les sources' : s}
            </option>
          ))}
        </select>

        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2">
          <span className="font-dm text-sm text-gray-500">Vérifié :</span>
          <button
            onClick={() => setVerifiedFilter('ALL')}
            className={`text-xs font-dm px-2 py-0.5 rounded-lg transition-colors ${verifiedFilter === 'ALL' ? 'bg-[#E8580A] text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Tous
          </button>
          <button
            onClick={() => setVerifiedFilter(true)}
            className={`text-xs font-dm px-2 py-0.5 rounded-lg transition-colors ${verifiedFilter === true ? 'bg-[#E8580A] text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Oui
          </button>
          <button
            onClick={() => setVerifiedFilter(false)}
            className={`text-xs font-dm px-2 py-0.5 rounded-lg transition-colors ${verifiedFilter === false ? 'bg-[#E8580A] text-white' : 'text-gray-400 hover:text-gray-600'}`}
          >
            Non
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="bg-[#FDFAF6] border-b border-gray-100">
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-5 py-3">Offre</th>
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">Source</th>
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">Ville</th>
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">Publié</th>
              <th className="text-center font-dm text-xs font-semibold text-gray-500 px-4 py-3">Vérifié</th>
              <th className="text-center font-dm text-xs font-semibold text-gray-500 px-4 py-3">Actif</th>
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((j) => (
              <tr key={j.id} className="hover:bg-[#FDFAF6] transition-colors">
                <td className="px-5 py-3">
                  <p className="font-dm text-sm font-medium text-[#1B4332]">{j.title}</p>
                  <p className="font-dm text-[10px] text-gray-400">{j.company}</p>
                </td>
                <td className="px-4 py-3">
                  <SourceBadge source={j.sourcePlatform} />
                </td>
                <td className="px-4 py-3">
                  <span className="font-dm text-xs text-gray-600">{j.city ?? '—'}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="font-dm text-xs text-gray-500">
                    {new Date(j.publishedAt).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span>{j.isVerified ? '✅' : '❌'}</span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[10px] font-dm font-semibold px-2 py-0.5 rounded-full ${j.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'}`}>
                    {j.isActive ? 'Actif' : 'Inactif'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {!j.isVerified && (
                      <button
                        onClick={() => handleVerify(j)}
                        className="text-xs font-dm font-medium text-[#1B4332] hover:text-[#E8580A] transition-colors"
                      >
                        Vérifier
                      </button>
                    )}
                    {!j.isVerified && <span className="text-gray-200">·</span>}
                    <button
                      onClick={() => handleToggleActive(j)}
                      className="text-xs font-dm font-medium text-red-500 hover:text-red-700 transition-colors"
                    >
                      {j.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && filtered.length === 0 && (
          <div className="py-10 text-center">
            <p className="font-dm text-sm text-gray-400">Aucune offre trouvée.</p>
          </div>
        )}
        {loading && (
          <div className="py-10 text-center">
            <p className="font-dm text-sm text-gray-400">Chargement...</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ScrapingTab() {
  const [sources, setSources] = useState<ScrapingSource[]>([]);
  const [running, setRunning] = useState<Set<string>>(new Set());

  useEffect(() => {
    getAdminScrapingStats()
      .then((stats) =>
        setSources(
          stats.map((s) => ({
            id: s.platform,
            name: s.platform,
            url: `${s.platform}.sn`,
            totalJobs: s.total,
            lastScraped: s.lastScraped,
            status: 'active' as const,
          })),
        ),
      )
      .catch(console.error);
  }, []);

  async function triggerScraping(id: string) {
    setRunning((prev) => new Set(prev).add(id));
    try {
      await triggerScraper(id);
    } catch (e) {
      console.error(e);
    } finally {
      setRunning((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  const statusLabels: Record<ScrapingSource['status'], string> = {
    active: 'Actif',
    idle: 'En attente',
    running: 'En cours...',
    error: 'Erreur',
  };

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {sources.length === 0 && (
          <p className="font-dm text-sm text-gray-400 col-span-full py-6 text-center">Chargement des sources...</p>
        )}
        {sources.map((src) => {
          const isRunning = running.has(src.id) || src.status === 'running';
          return (
            <div key={src.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-syne font-bold text-[#1B4332] text-sm">{src.name}</h3>
                  <p className="font-dm text-[10px] text-gray-400 mt-0.5">{src.url}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <StatusDot status={isRunning ? 'running' : src.status} />
                  <span className={`text-[10px] font-dm font-semibold ${
                    src.status === 'error' ? 'text-red-500' :
                    isRunning ? 'text-[#92700A]' :
                    src.status === 'active' ? 'text-green-600' : 'text-gray-400'
                  }`}>
                    {isRunning ? 'En cours...' : statusLabels[src.status]}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div>
                  <p className="font-syne text-xl font-black text-[#1B4332]">
                    {src.totalJobs.toLocaleString('fr-FR')}
                  </p>
                  <p className="font-dm text-[10px] text-gray-400">offres indexées</p>
                </div>
                <div className="border-l border-gray-100 pl-4">
                  <p className="font-dm text-xs text-gray-500">
                    {src.lastScraped
                      ? new Date(src.lastScraped).toLocaleDateString('fr-SN', { day: 'numeric', month: 'short' })
                      : '—'}
                  </p>
                  <p className="font-dm text-[10px] text-gray-400">
                    {src.lastScraped
                      ? new Date(src.lastScraped).toLocaleTimeString('fr-SN', { hour: '2-digit', minute: '2-digit' })
                      : ''}
                  </p>
                </div>
              </div>

              <button
                onClick={() => triggerScraping(src.id)}
                disabled={isRunning || src.status === 'error'}
                className={`w-full py-2 rounded-xl text-xs font-dm font-semibold transition-all flex items-center justify-center gap-2 ${
                  src.status === 'error'
                    ? 'bg-red-50 text-red-400 cursor-not-allowed'
                    : isRunning
                    ? 'bg-[#F5C842]/20 text-[#92700A] cursor-wait'
                    : 'bg-[#1B4332]/10 text-[#1B4332] hover:bg-[#1B4332]/20'
                }`}
              >
                {isRunning ? (
                  <>
                    <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Scraping en cours...
                  </>
                ) : src.status === 'error' ? (
                  'Source indisponible'
                ) : (
                  <>
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Déclencher scraping
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Sidebar nav ──────────────────────────────────────────────────────────────

const NAV_ITEMS: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
      </svg>
    ),
  },
  {
    id: 'users',
    label: 'Utilisateurs',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    ),
  },
  {
    id: 'jobs',
    label: 'Offres',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'scraping',
    label: 'Scrapers',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    id: 'revenue',
    label: 'Revenus',
    icon: (
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

// ─── Revenue tab (simple) ─────────────────────────────────────────────────────

function RevenueTab() {
  const monthlyRevenue = [
    { month: 'Octobre 2025', premium: 28, recruiter: 4, total: 45000 },
    { month: 'Novembre 2025', premium: 41, recruiter: 8, total: 87500 },
    { month: 'Décembre 2025', premium: 58, recruiter: 11, total: 122000 },
    { month: 'Janvier 2026', premium: 47, recruiter: 9, total: 98000 },
    { month: 'Février 2026', premium: 68, recruiter: 13, total: 143500 },
    { month: 'Mars 2026', premium: 89, recruiter: 16, total: 189000 },
  ];

  const totalRevenue = monthlyRevenue.reduce((s, m) => s + m.total, 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="font-dm text-xs text-gray-400 mb-1">Revenu total (6 mois)</p>
          <p className="font-syne text-2xl font-black text-[#E8580A]">
            {totalRevenue.toLocaleString('fr-FR')} FCFA
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="font-dm text-xs text-gray-400 mb-1">Abonnés Premium actifs</p>
          <p className="font-syne text-2xl font-black text-[#1B4332]">89</p>
          <p className="font-dm text-[10px] text-green-600 font-semibold mt-1">+21 ce mois</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <p className="font-dm text-xs text-gray-400 mb-1">Abonnés Recruteur actifs</p>
          <p className="font-syne text-2xl font-black text-[#1B4332]">16</p>
          <p className="font-dm text-[10px] text-green-600 font-semibold mt-1">+3 ce mois</p>
        </div>
      </div>

      {/* Monthly breakdown table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="font-syne font-bold text-[#1B4332]">Détail mensuel</h3>
        </div>
        <table className="w-full">
          <thead>
            <tr className="bg-[#FDFAF6] border-b border-gray-100">
              <th className="text-left font-dm text-xs font-semibold text-gray-500 px-5 py-3">Mois</th>
              <th className="text-right font-dm text-xs font-semibold text-gray-500 px-4 py-3">Premium</th>
              <th className="text-right font-dm text-xs font-semibold text-gray-500 px-4 py-3">Recruteur</th>
              <th className="text-right font-dm text-xs font-semibold text-gray-500 px-5 py-3">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {monthlyRevenue.map((row, i) => (
              <tr key={i} className={`hover:bg-[#FDFAF6] transition-colors ${i === monthlyRevenue.length - 1 ? 'bg-[#E8580A]/5' : ''}`}>
                <td className="px-5 py-3 font-dm text-sm text-[#1B4332] font-medium">{row.month}</td>
                <td className="px-4 py-3 text-right font-dm text-sm text-gray-600">{row.premium} abonnés</td>
                <td className="px-4 py-3 text-right font-dm text-sm text-gray-600">{row.recruiter} abonnés</td>
                <td className="px-5 py-3 text-right font-syne font-black text-[#E8580A] text-sm">
                  {row.total.toLocaleString('fr-FR')} FCFA
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function useAdminUser() {
  if (typeof window === 'undefined') return { name: 'Admin', initials: 'A' };
  try {
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email?.split('@')[0] || 'Admin';
    const initials = name.split(' ').map((w: string) => w[0]?.toUpperCase() ?? '').slice(0, 2).join('');
    return { name, initials };
  } catch {
    return { name: 'Admin', initials: 'A' };
  }
}

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('dashboard');
  const adminUser = useAdminUser();

  const TAB_TITLES: Record<AdminTab, string> = {
    dashboard: 'Vue d\'ensemble',
    users: 'Gestion des utilisateurs',
    jobs: 'Gestion des offres',
    scraping: 'Scrapers',
    revenue: 'Revenus',
  };

  return (
    <div className="min-h-screen bg-[#FDFAF6] flex">
      {/* Admin sidebar */}
      <aside className="hidden md:flex flex-col w-56 bg-[#1B4332] flex-shrink-0 min-h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-white/10">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#E8580A] flex items-center justify-center flex-shrink-0">
              <span className="font-syne text-white font-black text-[10px]">JDW</span>
            </div>
            <div>
              <p className="font-syne text-white font-bold text-sm leading-none">Jog Door Waar</p>
              <p className="font-dm text-white/40 text-[10px] mt-0.5">SuperAdmin</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-dm text-sm transition-colors text-left ${
                activeTab === id
                  ? 'bg-white/10 text-white font-medium'
                  : 'text-white/50 hover:bg-white/5 hover:text-white/80'
              }`}
            >
              <span className="flex-shrink-0">{icon}</span>
              {label}
            </button>
          ))}
        </nav>

        {/* Admin badge */}
        <div className="px-3 pb-4">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-white/5">
            <div className="w-7 h-7 rounded-full bg-[#E8580A]/30 flex items-center justify-center flex-shrink-0">
              <span className="font-syne text-[10px] font-bold text-[#E8580A]">{adminUser.initials}</span>
            </div>
            <div className="min-w-0">
              <p className="font-dm text-white text-xs font-medium truncate">{adminUser.name}</p>
              <p className="font-dm text-white/40 text-[9px]">Super Admin</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-syne text-lg font-bold text-[#1B4332]">{TAB_TITLES[activeTab]}</h1>
            <p className="font-dm text-xs text-gray-400 mt-0.5">
              {new Date().toLocaleDateString('fr-SN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative p-2 rounded-xl hover:bg-[#FDFAF6] transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#E8580A] rounded-full" />
            </button>
          </div>
        </header>

        {/* Tab content */}
        <main className="p-6">
          {activeTab === 'dashboard' && <DashboardTab />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'jobs' && <JobsTab />}
          {activeTab === 'scraping' && <ScrapingTab />}
          {activeTab === 'revenue' && <RevenueTab />}
        </main>
      </div>
    </div>
  );
}
