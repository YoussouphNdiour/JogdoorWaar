import { apiFetch } from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RecruiterJobStatus = 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'DRAFT';

export interface RecruiterJob {
  id: string;
  title: string;
  company: string;
  city: string;
  country: string;
  workMode: string;
  jobType: string;
  sector?: string;
  salaryMin?: number;
  salaryMax?: number;
  descriptionFull: string;
  requiredSkills: string[];
  status: RecruiterJobStatus;
  publishedAt: string;
  expiresAt?: string;
  viewCount: number;
  clickCount: number;
  applicationCount: number;
  isBoosted: boolean;
}

export interface RecruiterJobInput {
  title: string;
  company: string;
  city: string;
  country?: string;
  workMode: string;
  jobType: string;
  sector?: string;
  salaryMin?: number;
  salaryMax?: number;
  descriptionFull: string;
  requiredSkills: string[];
}

export interface RecruiterApplication {
  id: string;
  candidateName: string;
  candidateEmail: string;
  cvUrl?: string;
  coverLetter?: string;
  channel: 'WEB' | 'WHATSAPP';
  appliedAt: string;
  status: 'PENDING' | 'REVIEWED' | 'SHORTLISTED' | 'REJECTED';
  matchScore?: number;
}

export interface RecruiterStats {
  totalJobs: number;
  activeJobs: number;
  totalApplications: number;
  totalViews: number;
  totalClicks: number;
  plan: string;
  jobsRemaining: number;
}

// ─── API functions ────────────────────────────────────────────────────────────

export function getRecruiterStats(): Promise<RecruiterStats> {
  return apiFetch<RecruiterStats>('/recruiter/stats');
}

export function getRecruiterJobs(): Promise<RecruiterJob[]> {
  return apiFetch<RecruiterJob[]>('/recruiter/jobs');
}

export function getRecruiterJob(id: string): Promise<RecruiterJob> {
  return apiFetch<RecruiterJob>(`/recruiter/jobs/${id}`);
}

export function createRecruiterJob(data: RecruiterJobInput): Promise<RecruiterJob> {
  return apiFetch<RecruiterJob>('/recruiter/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function updateRecruiterJob(id: string, data: Partial<RecruiterJobInput> & { status?: RecruiterJobStatus }): Promise<RecruiterJob> {
  return apiFetch<RecruiterJob>(`/recruiter/jobs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export function deleteRecruiterJob(id: string): Promise<void> {
  return apiFetch<void>(`/recruiter/jobs/${id}`, { method: 'DELETE' });
}

export function getJobApplications(jobId: string): Promise<RecruiterApplication[]> {
  return apiFetch<RecruiterApplication[]>(`/recruiter/jobs/${jobId}/applications`);
}

export function updateApplicationStatus(
  jobId: string,
  applicationId: string,
  status: RecruiterApplication['status'],
): Promise<RecruiterApplication> {
  return apiFetch<RecruiterApplication>(`/recruiter/jobs/${jobId}/applications/${applicationId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
