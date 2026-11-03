import api from '@/lib/axios';

// Shapes of the policies API (km-backend/internal/features/policies/domain.go)

export type PolicySlug = 'terms' | 'employer-terms' | 'privacy' | 'community-guidelines';

export const POLICY_SLUGS: PolicySlug[] = ['terms', 'employer-terms', 'privacy', 'community-guidelines'];

export interface Policy {
  slug: PolicySlug;
  title: string;
  /** Markdown: headings, lists, bold and links */
  content: string;
  /** 0 when it has never been published */
  version: number;
  published_at?: string;
}

export interface AdminPolicy {
  slug: PolicySlug;
  title: string;
  audience: string;
  published: boolean;
  version: number;
  published_at?: string;
}

export interface PolicyVersion {
  slug: PolicySlug;
  version: number;
  title: string;
  content?: string;
  published_at: string;
}

/** Where a policy is shown on the site */
export const policyPath = (slug: PolicySlug) => `/policies/${slug}`;

// The axios instance resolves to the response body
export const policiesAdminApi = {
  list: () => api.get<unknown, AdminPolicy[]>('/admin/policies'),
  get: (slug: PolicySlug) => api.get<unknown, Policy>(`/admin/policies/${slug}`),
  publish: (slug: PolicySlug, body: { title: string; content: string; base_version: number }) =>
    api.put<unknown, Policy>(`/admin/policies/${slug}`, body),
  versions: (slug: PolicySlug) => api.get<unknown, PolicyVersion[]>(`/admin/policies/${slug}/versions`),
  version: (slug: PolicySlug, version: number) => api.get<unknown, PolicyVersion>(`/admin/policies/${slug}/versions/${version}`),
};
