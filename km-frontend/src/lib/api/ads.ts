import api from '@/lib/axios';

/** Where on the site an ad shows. Keep in step with Placements in km-backend/internal/features/ads/domain.go. */
export type AdPlacement =
  | 'feed_sidebar'
  | 'feed_inline'
  | 'post_sidebar'
  | 'jobs_inline'
  | 'job_detail_sidebar'
  | 'events_inline'
  | 'event_detail_sidebar'
  | 'mentorship_inline'
  | 'network_sidebar'
  | 'resources_inline'
  | 'resources_sidebar'
  | 'resource_detail_sidebar'
  | 'events_sidebar'
  | 'company_sidebar'
  | 'notifications_sidebar';

/** An ad as the site gets it */
export interface Ad {
  id: string;
  advertiser: string;
  headline: string;
  body?: string;
  cta_label?: string;
  creative_type: 'image' | 'video';
  creative_url: string;
  domain: string;
}

export type AdAudience = 'guest' | 'user' | 'recruiter' | 'expert';
export type AdState = 'active' | 'paused' | 'scheduled' | 'ended';

/** A campaign as the admin panel sees it */
export interface AdCampaign {
  id: string;
  name: string;
  advertiser: string;
  headline: string;
  body?: string;
  cta_label?: string;
  creative_type: 'image' | 'video';
  creative_url: string;
  link_url: string;
  placements: AdPlacement[];
  cities: string[];
  audiences: AdAudience[];
  start_at: string;
  end_at?: string;
  priority: number;
  frequency_cap: number;
  status: 'active' | 'paused';
  state: AdState;
  impressions: number;
  clicks: number;
  ctr: number;
  created_at: string;
  updated_at: string;
}

export interface AdPlacementInfo {
  id: AdPlacement;
  label: string;
  format: 'rail' | 'inline';
}

export type AdCampaignInput = Omit<AdCampaign, 'id' | 'state' | 'impressions' | 'clicks' | 'ctr' | 'created_at' | 'updated_at' | 'end_at' | 'start_at'> & {
  start_at?: string;
  end_at?: string | null;
};

export interface AdDay {
  day: string;
  impressions: number;
  reach: number;
  clicks: number;
}

const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export const adsApi = {
  serve: (placement: AdPlacement, count = 1) =>
    api.get<unknown, { ads: Ad[] }>('/ads', { params: { placement, count } }),
  impression: (id: string) => api.post(`/ads/${id}/impression`),
  /** The link an ad opens: it counts the click, then redirects to the advertiser */
  clickUrl: (id: string) => `${apiUrl}/api/ads/${id}/click`,

  list: (search = '') =>
    api.get<unknown, { campaigns: AdCampaign[]; placements: AdPlacementInfo[]; audiences: AdAudience[] }>('/admin/ads', {
      params: search ? { search } : undefined,
    }),
  create: (input: AdCampaignInput) => api.post<unknown, AdCampaign>('/admin/ads', input),
  update: (id: string, input: AdCampaignInput) => api.put<unknown, AdCampaign>(`/admin/ads/${id}`, input),
  setStatus: (id: string, status: 'active' | 'paused') => api.patch(`/admin/ads/${id}/status`, { status }),
  remove: (id: string) => api.delete(`/admin/ads/${id}`),
  stats: (id: string, days: 7 | 30 | 90) => api.get<unknown, { days: AdDay[] }>(`/admin/ads/${id}/stats`, { params: { days } }),
};
