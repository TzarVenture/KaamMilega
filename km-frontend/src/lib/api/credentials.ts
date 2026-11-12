import api from '@/lib/axios';

/** Who endorsed a skill, as shown on a byline */
export interface Byline {
  id: string;
  name: string;
  headline?: string;
  avatar?: string;
  is_verified: boolean;
  role: string;
}

export interface SkillView {
  name: string;
  endorsements: number;
  endorsed_by_me: boolean;
  /** The newest few endorsers */
  endorsers: Byline[];
  /** A verified, unexpired certificate covers this skill */
  certified: boolean;
}

/** unverified: nothing to check; pending: waiting for an admin; rejected: only the owner sees it */
export type CertStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Certification {
  id: string;
  name: string;
  issuer: string;
  /** "2024-05" */
  issued_on: string;
  expires_on?: string;
  expired: boolean;
  credential_id?: string;
  credential_url?: string;
  skills: string[];
  status: CertStatus;
  /** Owner and admins only */
  file_id?: string;
  file_url?: string;
  review_note?: string;
  reviewed_at?: string;
  created_at: string;
}

export interface ProfileCredentials {
  skills: SkillView[];
  certifications: Certification[];
  is_owner: boolean;
  can_endorse: boolean;
}

export interface CertificationInput {
  name: string;
  issuer: string;
  issued_on: string;
  expires_on: string;
  credential_id: string;
  credential_url: string;
  file_id: string;
  skills: string[];
}

export interface ReviewItem extends Certification {
  owner: Byline;
}

// The axios instance resolves to the response body
const body = <T>(p: Promise<unknown>) => p as Promise<T>;

export const credentialsApi = {
  profile: (userId: string) => body<ProfileCredentials>(api.get(`/credentials/users/${userId}`)),
  endorsers: (userId: string, skill: string) =>
    body<{ skill: string; endorsers: Byline[] }>(api.get(`/credentials/users/${userId}/endorsers`, { params: { skill } })),
  endorse: (userId: string, skill: string) => body<void>(api.post(`/credentials/users/${userId}/endorsements`, { skill })),
  unendorse: (userId: string, skill: string) =>
    body<void>(api.delete(`/credentials/users/${userId}/endorsements`, { params: { skill } })),

  addCertification: (input: CertificationInput) => body<Certification>(api.post('/credentials/certifications', input)),
  updateCertification: (id: string, input: CertificationInput) => body<Certification>(api.patch(`/credentials/certifications/${id}`, input)),
  deleteCertification: (id: string) => body<void>(api.delete(`/credentials/certifications/${id}`)),

  reviewQueue: (status: string) => body<{ certifications: ReviewItem[] }>(api.get('/admin/certifications', { params: { status } })),
  review: (id: string, decision: 'verify' | 'reject', note: string) =>
    body<Certification>(api.post(`/admin/certifications/${id}/review`, { decision, note })),
};

/** "2024-05" → "May 2024" */
export function monthLabel(month?: string): string {
  if (!month) return '';
  const [y, m] = month.split('-').map(Number);
  if (!y || !m) return month;
  return new Date(y, m - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}
