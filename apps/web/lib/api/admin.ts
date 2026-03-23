const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserPlan = 'FREE' | 'PREMIUM' | 'RECRUITER';
export type UserRole = 'CANDIDATE' | 'RECRUITER' | 'ADMIN' | 'SUPERADMIN';

export interface AdminUser {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  plan: UserPlan;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface AdminJob {
  id: string;
  title: string;
  company: string;
  sourcePlatform: string;
  city: string | null;
  publishedAt: string;
  isVerified: boolean;
  isActive: boolean;
}

export interface ScrapingStats {
  platform: string;
  total: number;
  lastScraped: string | null;
}

export interface PlatformStats {
  totalUsers: number;
  newUsersThisMonth: number;
  premiumUsers: number;
  recruiterUsers: number;
  totalJobs: number;
  activeJobs: number;
  jobsThisWeek: number;
  totalApplications: number;
  activeSubscriptions: number;
  monthlyRevenueFcfa: number;
  jobsPerSource: Record<string, number>;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getToken(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('access_token') ?? '';
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getToken()}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Admin API error ${res.status}: ${text}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export function getAdminStats(): Promise<PlatformStats> {
  return apiFetch<PlatformStats>('/admin/stats');
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function getAdminUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  plan?: string;
  role?: string;
}): Promise<PaginatedResponse<AdminUser>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.search) qs.set('search', params.search);
  if (params?.plan && params.plan !== 'ALL') qs.set('plan', params.plan);
  if (params?.role && params.role !== 'ALL') qs.set('role', params.role);
  return apiFetch<PaginatedResponse<AdminUser>>(`/admin/users?${qs}`);
}

export function updateAdminUser(
  id: string,
  data: { plan?: UserPlan; role?: UserRole; isActive?: boolean },
): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

// ─── Jobs ─────────────────────────────────────────────────────────────────────

export function getAdminJobs(params?: {
  page?: number;
  limit?: number;
  sourcePlatform?: string;
  isVerified?: boolean;
  isActive?: boolean;
}): Promise<PaginatedResponse<AdminJob>> {
  const qs = new URLSearchParams();
  if (params?.page) qs.set('page', String(params.page));
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.sourcePlatform && params.sourcePlatform !== 'ALL')
    qs.set('sourcePlatform', params.sourcePlatform);
  if (params?.isVerified !== undefined)
    qs.set('isVerified', String(params.isVerified));
  if (params?.isActive !== undefined)
    qs.set('isActive', String(params.isActive));
  return apiFetch<PaginatedResponse<AdminJob>>(`/admin/jobs?${qs}`);
}

export function updateAdminJob(
  id: string,
  data: { isVerified?: boolean; isActive?: boolean; isPremium?: boolean },
): Promise<AdminJob> {
  return apiFetch<AdminJob>(`/admin/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function deleteAdminJob(id: string): Promise<void> {
  return apiFetch<void>(`/admin/jobs/${id}`, { method: 'DELETE' });
}

// ─── Scraping ─────────────────────────────────────────────────────────────────

export function getAdminScrapingStats(): Promise<ScrapingStats[]> {
  return apiFetch<ScrapingStats[]>('/admin/scraping/stats');
}
