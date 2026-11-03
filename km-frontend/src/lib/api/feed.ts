import api from '@/lib/axios';
import type {
  CommentPage,
  FeedComment,
  FeedPage,
  FeedPost,
  PostCategory,
  ReactionState,
  ReactionType,
  ReportReason,
  TrendingTag,
} from '@/components/feed/feedTypes';

// The axios instance resolves to the response body
const get = <T>(url: string, params?: Record<string, string | number | undefined>) =>
  api.get(url, { params }) as unknown as Promise<T>;
const send = <T>(method: 'post' | 'put' | 'patch' | 'delete', url: string, body?: unknown) =>
  (method === 'delete' ? api.delete(url) : api[method](url, body)) as unknown as Promise<T>;

export interface ListParams {
  category?: PostCategory;
  tag?: string;
  authorId?: string;
  before?: string;
  limit?: number;
}

export interface NewPost {
  content: string;
  category: PostCategory;
  media: { file_id: string; width?: number; height?: number }[];
}

export const feedApi = {
  list: (p: ListParams = {}) =>
    get<FeedPage>('/feed', { category: p.category, tag: p.tag, author_id: p.authorId, before: p.before, limit: p.limit }),
  saved: (before?: string) => get<FeedPage>('/feed/saved', { before }),
  get: (id: string) => get<FeedPost>(`/feed/${id}`),
  trending: () => get<{ tags: TrendingTag[] }>('/feed/trending'),

  create: (post: NewPost) => send<FeedPost>('post', '/feed', post),
  update: (id: string, changes: { content: string; category: PostCategory }) => send<FeedPost>('patch', `/feed/${id}`, changes),
  remove: (id: string) => send<void>('delete', `/feed/${id}`),

  react: (id: string, type: ReactionType) => send<ReactionState>('put', `/feed/${id}/reaction`, { type }),
  unreact: (id: string) => send<ReactionState>('delete', `/feed/${id}/reaction`),
  save: (id: string) => send<void>('put', `/feed/${id}/save`),
  unsave: (id: string) => send<void>('delete', `/feed/${id}/save`),

  comments: (id: string, before?: string) => get<CommentPage>(`/feed/${id}/comments`, { before }),
  addComment: (id: string, content: string) => send<FeedComment>('post', `/feed/${id}/comments`, { content }),
  deleteComment: (id: string, commentId: string) => send<void>('delete', `/feed/${id}/comments/${commentId}`),

  report: (id: string, reason: ReportReason, details?: string) => send<void>('post', `/feed/${id}/report`, { reason, details }),
};

/** The shareable address of a post */
export function postUrl(id: string): string {
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return `${origin}/feed/${id}`;
}
