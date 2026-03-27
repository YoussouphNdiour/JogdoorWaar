'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '../../../lib/api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApplicationStatus =
  | 'TO_APPLY'
  | 'APPLIED'
  | 'INTERVIEW_SCHEDULED'
  | 'INTERVIEW_DONE'
  | 'OFFER_RECEIVED'
  | 'REJECTED'
  | 'WITHDRAWN';

type Channel = 'WEB' | 'WHATSAPP';

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  city: string;
  appliedAt: string;
  status: ApplicationStatus;
  channel: Channel;
  cvUsed: string;
  notes?: string;
  interviewDate?: string;
  offerAmount?: number;
}

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  ApplicationStatus,
  { label: string; color: string; bg: string; dot: string; border: string }
> = {
  TO_APPLY: {
    label: 'À postuler',
    color: 'text-gray-500',
    bg: 'bg-gray-100',
    dot: 'bg-gray-400',
    border: 'border-gray-200',
  },
  APPLIED: {
    label: 'Postulé',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    dot: 'bg-blue-500',
    border: 'border-blue-200',
  },
  INTERVIEW_SCHEDULED: {
    label: 'Entretien prévu',
    color: 'text-[#92700A]',
    bg: 'bg-[#FEF9C3]',
    dot: 'bg-[#F5C842]',
    border: 'border-[#F5C842]/40',
  },
  INTERVIEW_DONE: {
    label: 'Entretien passé',
    color: 'text-[#E8580A]',
    bg: 'bg-[#E8580A]/10',
    dot: 'bg-[#E8580A]',
    border: 'border-[#E8580A]/30',
  },
  OFFER_RECEIVED: {
    label: 'Offre reçue',
    color: 'text-[#1B4332]',
    bg: 'bg-[#1B4332]/10',
    dot: 'bg-[#1B4332]',
    border: 'border-[#1B4332]/30',
  },
  REJECTED: {
    label: 'Refusé',
    color: 'text-red-600',
    bg: 'bg-red-50',
    dot: 'bg-red-500',
    border: 'border-red-200',
  },
  WITHDRAWN: {
    label: 'Retiré',
    color: 'text-gray-400',
    bg: 'bg-gray-50',
    dot: 'bg-gray-300',
    border: 'border-gray-200',
  },
};

const COLUMN_ORDER: ApplicationStatus[] = [
  'TO_APPLY',
  'APPLIED',
  'INTERVIEW_SCHEDULED',
  'INTERVIEW_DONE',
  'OFFER_RECEIVED',
  'REJECTED',
  'WITHDRAWN',
];


// ─── Sub-components ───────────────────────────────────────────────────────────

function ChannelBadge({ channel }: { channel: Channel }) {
  if (channel === 'WHATSAPP') {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
        </svg>
        WhatsApp
      </span>
    );
  }
  return (
    <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-600">
      Web
    </span>
  );
}

function ApplicationCard({
  app,
  expanded,
  onToggle,
  onDelete,
}: {
  app: Application;
  expanded: boolean;
  onToggle: () => void;
  onDelete: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[app.status];

  const formattedDate = new Date(app.appliedAt).toLocaleDateString('fr-SN', {
    day: 'numeric',
    month: 'short',
  });

  return (
    <div
      className={`bg-white rounded-2xl border ${cfg.border} shadow-sm hover:shadow-md transition-all cursor-pointer select-none`}
      onClick={onToggle}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-dm font-semibold text-[#1B4332] text-sm leading-tight">
            {app.jobTitle}
          </h3>
          <svg
            className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>

        <p className="font-dm text-xs text-[#1B4332]/60 mb-3">
          {app.company} · {app.city}
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <ChannelBadge channel={app.channel} />
          <span className="text-[10px] font-dm text-gray-400">{formattedDate}</span>
        </div>

        <div className="mt-2 pt-2 border-t border-gray-50">
          <p className="text-[10px] font-dm text-gray-400 truncate">
            <span className="font-medium">CV :</span> {app.cvUsed}
          </p>
        </div>
      </div>

      {/* Expanded panel */}
      {expanded && (
        <div
          className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          {app.interviewDate && (
            <div className="flex items-center gap-2 text-xs font-dm text-[#1B4332]/70">
              <svg className="w-3.5 h-3.5 text-[#F5C842]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <span>Entretien :</span>
              <span className="font-semibold">
                {new Date(app.interviewDate).toLocaleDateString('fr-SN', {
                  weekday: 'short',
                  day: 'numeric',
                  month: 'long',
                })}
              </span>
            </div>
          )}

          {app.offerAmount !== undefined && (
            <div className="flex items-center gap-2 text-xs font-dm text-[#1B4332]">
              <svg className="w-3.5 h-3.5 text-[#1B4332]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Offre :</span>
              <span className="font-bold text-[#1B4332]">
                {app.offerAmount.toLocaleString('fr-FR')} FCFA/mois
              </span>
            </div>
          )}

          {app.notes && (
            <div className="bg-[#FDFAF6] rounded-xl p-3 text-xs font-dm text-[#1B4332]/70 italic">
              {app.notes}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onDelete(app.id)}
              className="flex-1 text-xs font-dm font-medium py-1.5 px-3 rounded-xl bg-gray-100 text-gray-500 hover:bg-red-50 hover:text-red-500 transition-colors"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanColumn({
  status,
  apps,
  expandedId,
  onToggle,
  onDelete,
}: {
  status: ApplicationStatus;
  apps: Application[];
  expandedId: string | null;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className="min-w-[280px] flex-shrink-0 flex flex-col gap-3">
      {/* Column header */}
      <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${cfg.bg}`}>
        <span className={`w-2 h-2 rounded-full ${cfg.dot} flex-shrink-0`} />
        <span className={`font-dm font-semibold text-sm ${cfg.color} flex-1`}>{cfg.label}</span>
        <span className={`font-syne text-xs font-bold px-2 py-0.5 rounded-full bg-white/60 ${cfg.color}`}>
          {apps.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 flex-1">
        {apps.length === 0 ? (
          <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center">
            <p className="font-dm text-xs text-gray-400">Aucune candidature</p>
          </div>
        ) : (
          apps.map((app) => (
            <ApplicationCard
              key={app.id}
              app={app}
              expanded={expandedId === app.id}
              onToggle={() => onToggle(app.id)}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ApplicationsPage() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<Application[]>('/applications')
      .then(setApplications)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function handleToggle(id: string) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  async function handleDelete(id: string) {
    await apiFetch(`/applications/${id}`, { method: 'DELETE' }).catch(() => {});
    setApplications((prev) => prev.filter((a) => a.id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  const filtered = applications.filter(
    (a) =>
      a.jobTitle.toLowerCase().includes(search.toLowerCase()) ||
      a.company.toLowerCase().includes(search.toLowerCase()),
  );

  const grouped = COLUMN_ORDER.reduce<Record<ApplicationStatus, Application[]>>(
    (acc, status) => {
      acc[status] = filtered.filter((a) => a.status === status);
      return acc;
    },
    {} as Record<ApplicationStatus, Application[]>,
  );

  const totalActive = filtered.filter(
    (a) => !['REJECTED', 'WITHDRAWN'].includes(a.status),
  ).length;
  const totalInterviews = filtered.filter(
    (a) => a.status === 'INTERVIEW_SCHEDULED' || a.status === 'INTERVIEW_DONE',
  ).length;

  if (loading) {
    return (
      <div className="flex flex-col h-full min-h-screen bg-[#FDFAF6] animate-pulse p-6 space-y-4">
        <div className="h-8 bg-sand-dark rounded w-1/3" />
        <div className="h-64 bg-sand-dark rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full min-h-screen bg-[#FDFAF6]">
      {/* Top bar */}
      <div className="px-6 py-5 bg-white border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="font-syne text-2xl font-bold text-[#1B4332]">Mes Candidatures</h1>
          <span className="font-syne text-sm font-bold px-2.5 py-0.5 bg-[#E8580A] text-white rounded-full">
            {applications.length}
          </span>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="font-dm text-xs text-gray-500">Total</span>
            <span className="font-syne font-bold text-[#1B4332] text-sm">{filtered.length}</span>
          </div>
          <span className="text-gray-200 text-lg font-light">|</span>
          <div className="flex items-center gap-2">
            <span className="font-dm text-xs text-gray-500">En cours</span>
            <span className="font-syne font-bold text-blue-600 text-sm">{totalActive}</span>
          </div>
          <span className="text-gray-200 text-lg font-light">|</span>
          <div className="flex items-center gap-2">
            <span className="font-dm text-xs text-gray-500">Entretiens</span>
            <span className="font-syne font-bold text-[#E8580A] text-sm">{totalInterviews}</span>
          </div>
          <span className="text-gray-200 text-lg font-light hidden sm:block">|</span>
          <div className="hidden sm:flex items-center gap-2">
            <span className="font-dm text-xs text-gray-500">Offres reçues</span>
            <span className="font-syne font-bold text-[#1B4332] text-sm">
              {filtered.filter((a) => a.status === 'OFFER_RECEIVED').length}
            </span>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 bg-[#E8580A] hover:bg-[#c94a07] text-white text-sm font-dm font-medium px-4 py-2 rounded-xl transition-colors flex-shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Ajouter
          </button>
          <div className="relative flex-1 max-w-xs">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm font-dm bg-[#FDFAF6] border border-gray-200 rounded-xl focus:outline-none focus:border-[#E8580A] focus:ring-1 focus:ring-[#E8580A]/20 transition-all placeholder-gray-400"
            />
          </div>
        </div>
      </div>

      {/* Kanban board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 p-6 min-w-max">
          {COLUMN_ORDER.map((status) => (
            <KanbanColumn
              key={status}
              status={status}
              apps={grouped[status]}
              expandedId={expandedId}
              onToggle={handleToggle}
              onDelete={handleDelete}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
