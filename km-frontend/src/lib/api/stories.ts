import api from '@/lib/axios';
import type { FeedAuthor, ReportReason } from '@/components/feed/feedTypes';

// Mirrors of the server's limits (km-backend/internal/features/story/domain.go)
export const STORY_MAX_CAPTION = 200;
export const STORY_MAX_PER_DAY = 10;

export interface StoryMedia {
  type: 'image' | 'video';
  url: string;
  width?: number;
  height?: number;
  poster_url?: string;
  /** Seconds, for a video */
  duration?: number;
}

export interface Story {
  id: string;
  media: StoryMedia;
  caption?: string;
  created_at: string;
  expires_at: string;
  /** The viewer has opened it */
  seen: boolean;
  /** Only on your own stories */
  views?: number;
}

/** One member's stories in the bar, oldest first */
export interface StoryGroup {
  owner: FeedAuthor;
  stories: Story[];
  all_seen: boolean;
  is_own: boolean;
}

export interface StoryViewer {
  viewer: FeedAuthor;
  viewed_at: string;
}

export interface NewStory {
  media: { file_id: string; width?: number; height?: number; poster_file_id?: string; duration?: number };
  caption?: string;
}

/** A reported story, for moderators */
export interface StoryModerationItem {
  id: string;
  owner?: FeedAuthor;
  media: StoryMedia;
  caption?: string;
  status: 'active' | 'hidden' | 'removed';
  created_at: string;
  expires_at: string;
  views: number;
  reports: number;
  reasons: Record<string, number>;
  notes?: string[];
  last_report: string;
  /** The owner deleted it while reported: it goes whatever the decision */
  deleted_by_owner?: boolean;
}

// The axios instance resolves to the response body
const get = <T>(url: string, params?: Record<string, string | number | undefined>) =>
  api.get(url, { params }) as unknown as Promise<T>;
const post = <T>(url: string, body?: unknown) => api.post(url, body) as unknown as Promise<T>;

export const storiesApi = {
  bar: () => get<StoryGroup[]>('/stories'),
  create: (s: NewStory) => post<Story>('/stories', s),
  view: (id: string) => post<void>(`/stories/${id}/view`),
  viewers: (id: string) => get<StoryViewer[]>(`/stories/${id}/viewers`),
  remove: (id: string) => api.delete(`/stories/${id}`) as unknown as Promise<void>,
  report: (id: string, reason: ReportReason, details?: string) => post<void>(`/stories/${id}/report`, { reason, details }),
  /** A reply is a chat message to the story's owner that quotes the story */
  reply: (ownerId: string, storyId: string, content: string) =>
    post<unknown>('/chats/messages', { receiver_id: ownerId, content, story_id: storyId }),

  reports: (page = 1) => get<{ items: StoryModerationItem[]; total: number }>('/admin/stories/reports', { page }),
  decide: (id: string, action: 'keep' | 'remove') => post<void>(`/admin/stories/${id}/decision`, { action }),
};
