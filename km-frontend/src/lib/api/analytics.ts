import api from '@/lib/axios';

export type AnalyticsRange = 7 | 28 | 90;
export const ANALYTICS_RANGES: AnalyticsRange[] = [7, 28, 90];

export interface DayCount {
  date: string; // YYYY-MM-DD, Indian time
  count: number;
}

export interface AnalyticsMetric {
  total: number;
  previous: number;
  series: DayCount[];
}

/** How a member appears when they view someone's profile, as on LinkedIn */
export type ProfileViewingMode = 'name' | 'characteristics' | 'private';

export type MemberRole = 'user' | 'recruiter' | 'expert';

/** One entry of "Who viewed your profile"; what's in it depends on how the viewer browses */
export type AnalyticsViewer =
  | {
      mode: 'name';
      id: string;
      name: string;
      headline?: string;
      avatar?: string;
      is_verified: boolean;
      role: MemberRole;
      viewed_at: string;
    }
  | { mode: 'characteristics'; traits: { role: MemberRole; title?: string; city?: string }; viewed_at: string }
  | { mode: 'private'; viewed_at: string };

export interface Analytics {
  days: AnalyticsRange;
  /** Different people who viewed the profile; each day of the series counts that day's viewers */
  profile_viewers: AnalyticsMetric;
  post_impressions: AnalyticsMetric;
  search_appearances: AnalyticsMetric;
  /** The latest people to view the profile in the past 90 days, newest first */
  recent_viewers: AnalyticsViewer[];
  /** How this member appears when they view profiles */
  viewing_mode: ProfileViewingMode;
  /** True while they browse privately: like LinkedIn, that hides who viewed them */
  viewers_hidden: boolean;
}

export type AnalyticsMetricKey = 'profile_viewers' | 'post_impressions' | 'search_appearances';

// The feed sidebar and the profile page can ask for the same range at once; share one request
// and keep the answer for a short while. Keyed by member, so switching accounts never shows
// someone else's numbers.
const CACHE_MS = 30_000;
const cache = new Map<string, { at: number; promise: Promise<Analytics> }>();

export function getAnalytics(userId: string, days: AnalyticsRange): Promise<Analytics> {
  const key = `${userId}:${days}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.promise;
  const promise = (api.get('/user/analytics', { params: { days } }) as unknown as Promise<Analytics>).catch((err) => {
    cache.delete(key);
    throw err;
  });
  cache.set(key, { at: Date.now(), promise });
  return promise;
}

/** Forgets cached numbers, for when a setting that changes them (how you browse) is saved */
export function clearAnalyticsCache(): void {
  cache.clear();
}
