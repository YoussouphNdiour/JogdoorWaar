export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  // Don't set Content-Type for FormData — browser must set it (with multipart boundary)
  const headers: Record<string, string> =
    init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' };
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token');
    if (token && token !== 'undefined' && token !== 'null') {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      window.location.href = '/auth/login';
      throw new Error('Session expirée. Reconnectez-vous.');
    }
    const err = await res.json().catch(() => ({ message: `Erreur ${res.status}` }));
    throw new Error(err.message || `HTTP ${res.status}`);
  }
  return res.json();
}
