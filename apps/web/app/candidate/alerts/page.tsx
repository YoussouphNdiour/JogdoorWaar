'use client';

import { useState, useEffect } from 'react';
import { Bell, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { apiFetch } from '../../../lib/api/client';

interface Alert {
  id: string;
  name: string;
  keywords: string[];
  locations: string[];
  jobTypes: string[];
  notifyByEmail: boolean;
  notifyByWhatsapp: boolean;
  frequency: 'INSTANT' | 'DAILY' | 'WEEKLY';
  isActive: boolean;
  createdAt: string;
}

const FREQUENCY_LABEL: Record<Alert['frequency'], string> = {
  INSTANT: 'Immédiate',
  DAILY: 'Quotidienne',
  WEEKLY: 'Hebdomadaire',
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    keywords: '',
    city: '',
    jobType: '',
    frequency: 'DAILY' as Alert['frequency'],
    notifyByEmail: true,
    notifyByWhatsapp: false,
  });

  useEffect(() => {
    apiFetch<Alert[]>('/alerts')
      .then(setAlerts)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        keywords: form.keywords.split(',').map((k) => k.trim()).filter(Boolean),
        locations: form.city ? [form.city.trim()] : [],
        jobTypes: form.jobType ? [form.jobType] : [],
        notifyByEmail: form.notifyByEmail,
        notifyByWhatsapp: form.notifyByWhatsapp,
        frequency: form.frequency,
      };
      const created = await apiFetch<Alert>('/alerts', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setAlerts((prev) => [created, ...prev]);
      setShowForm(false);
      setForm({ name: '', keywords: '', city: '', jobType: '', frequency: 'DAILY', notifyByEmail: true, notifyByWhatsapp: false });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la création.');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(alert: Alert) {
    const updated = await apiFetch<Alert>(`/alerts/${alert.id}/toggle`, {
      method: 'PATCH',
    }).catch(() => null);
    if (updated) {
      setAlerts((prev) => prev.map((a) => (a.id === alert.id ? updated : a)));
    }
  }

  async function handleDelete(id: string) {
    await apiFetch(`/alerts/${id}`, { method: 'DELETE' }).catch(() => {});
    setAlerts((prev) => prev.filter((a) => a.id !== id));
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-syne text-2xl font-bold text-savane">Mes alertes emploi</h1>
          <p className="font-dm text-sm text-savane/60 mt-1">
            Soyez notifié dès qu&apos;une offre correspond à vos critères.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 bg-terracotta text-white px-4 py-2.5 rounded-xl font-dm text-sm font-semibold hover:bg-terracotta/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nouvelle alerte
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-sand-dark p-6 mb-6">
          <h2 className="font-syne font-bold text-savane mb-5">Créer une alerte</h2>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">
                Nom de l&apos;alerte <span className="text-terracotta">*</span>
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: Dev React Dakar"
                required
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>

            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">
                Mots-clés <span className="text-terracotta">*</span>
              </label>
              <input
                type="text"
                value={form.keywords}
                onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                placeholder="ex: développeur React, data analyst, comptable (séparés par des virgules)"
                required
                className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="font-dm text-sm text-savane/70 mb-1.5 block">Ville</label>
                <input
                  type="text"
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                  placeholder="ex: Dakar"
                  className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane placeholder:text-savane/40 focus:outline-none focus:ring-2 focus:ring-terracotta/30 focus:border-terracotta"
                />
              </div>
              <div>
                <label className="font-dm text-sm text-savane/70 mb-1.5 block">Type de contrat</label>
                <select
                  value={form.jobType}
                  onChange={(e) => setForm({ ...form, jobType: e.target.value })}
                  className="w-full px-4 py-3 bg-sand-dark border border-sand-dark rounded-xl font-dm text-savane focus:outline-none focus:ring-2 focus:ring-terracotta/30"
                >
                  <option value="">Tous</option>
                  <option value="CDI">CDI</option>
                  <option value="CDD">CDD</option>
                  <option value="STAGE">Stage</option>
                  <option value="FREELANCE">Freelance</option>
                  <option value="ALTERNANCE">Alternance</option>
                </select>
              </div>
            </div>

            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Fréquence</label>
              <div className="flex gap-2">
                {(['IMMEDIATE', 'DAILY', 'WEEKLY'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setForm({ ...form, frequency: f })}
                    className={`px-4 py-2 rounded-xl font-dm text-sm transition-colors ${
                      form.frequency === f
                        ? 'bg-terracotta text-white'
                        : 'bg-sand-dark text-savane hover:bg-sand-dark/80'
                    }`}
                  >
                    {FREQUENCY_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="font-dm text-sm text-savane/70 mb-1.5 block">Canaux de notification</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, notifyByEmail: !prev.notifyByEmail }))}
                  className={`px-4 py-2 rounded-xl font-dm text-sm transition-colors ${
                    form.notifyByEmail ? 'bg-savane text-white' : 'bg-sand-dark text-savane hover:bg-sand-dark/80'
                  }`}
                >
                  ✉️ Email
                </button>
                <button
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, notifyByWhatsapp: !prev.notifyByWhatsapp }))}
                  className={`px-4 py-2 rounded-xl font-dm text-sm transition-colors ${
                    form.notifyByWhatsapp ? 'bg-savane text-white' : 'bg-sand-dark text-savane hover:bg-sand-dark/80'
                  }`}
                >
                  💬 WhatsApp
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 font-dm text-sm">
                {error}
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving || (!form.notifyByEmail && !form.notifyByWhatsapp)}
                className="bg-terracotta text-white px-6 py-2.5 rounded-xl font-dm font-semibold hover:bg-terracotta/90 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {saving && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                Créer l&apos;alerte
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-6 py-2.5 rounded-xl font-dm text-sm text-savane/60 hover:bg-sand-dark transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Alert list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="bg-white rounded-2xl border border-sand-dark p-5 animate-pulse">
              <div className="h-4 bg-sand-dark rounded w-1/2 mb-2" />
              <div className="h-3 bg-sand-dark rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : alerts.length === 0 ? (
        <div className="border-2 border-dashed border-sand-dark rounded-2xl p-12 text-center">
          <Bell className="h-10 w-10 text-savane/20 mx-auto mb-3" />
          <p className="font-dm text-savane/50 text-sm">Aucune alerte configurée.</p>
          <p className="font-dm text-savane/40 text-xs mt-1">
            Créez votre première alerte pour recevoir les offres qui vous correspondent.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`bg-white rounded-2xl border p-5 transition-all ${
                alert.isActive ? 'border-sand-dark' : 'border-sand-dark opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-dm font-semibold text-savane truncate">{alert.name}</p>
                  <p className="font-dm text-xs text-savane/50 mt-0.5 truncate">{alert.keywords.join(', ')}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {alert.locations[0] && (
                      <span className="text-xs font-dm bg-sand-dark text-savane/60 px-2 py-0.5 rounded-lg">
                        📍 {alert.locations[0]}
                      </span>
                    )}
                    {alert.jobTypes[0] && (
                      <span className="text-xs font-dm bg-sand-dark text-savane/60 px-2 py-0.5 rounded-lg">
                        {alert.jobTypes[0]}
                      </span>
                    )}
                    <span className="text-xs font-dm bg-sand-dark text-savane/60 px-2 py-0.5 rounded-lg">
                      {FREQUENCY_LABEL[alert.frequency]}
                    </span>
                    {alert.notifyByEmail && (
                      <span className="text-xs font-dm bg-sand-dark text-savane/60 px-2 py-0.5 rounded-lg">
                        ✉️ Email
                      </span>
                    )}
                    {alert.notifyByWhatsapp && (
                      <span className="text-xs font-dm bg-sand-dark text-savane/60 px-2 py-0.5 rounded-lg">
                        💬 WhatsApp
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => handleToggle(alert)}
                    className="p-1.5 rounded-lg hover:bg-sand-dark transition-colors"
                    title={alert.isActive ? 'Désactiver' : 'Activer'}
                  >
                    {alert.isActive ? (
                      <ToggleRight className="h-5 w-5 text-terracotta" />
                    ) : (
                      <ToggleLeft className="h-5 w-5 text-savane/30" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(alert.id)}
                    className="p-1.5 rounded-lg text-savane/30 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
