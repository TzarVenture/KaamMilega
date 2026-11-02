// Shapes of the feed API (km-backend/internal/features/feed/domain.go), kept in its snake_case

export const REACTIONS = ['like', 'celebrate', 'support', 'insightful'] as const;
export type ReactionType = (typeof REACTIONS)[number];

export const POST_CATEGORIES = ['general', 'jobs', 'skills', 'mentors'] as const;
export type PostCategory = (typeof POST_CATEGORIES)[number];

/** What the feed is showing: everything, the member's saved posts or their own posts */
export type FeedView = 'all' | 'saved' | 'mine';

export const REPORT_REASONS = ['spam', 'harassment', 'misleading', 'inappropriate', 'other'] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

// Mirrors of the server's limits, so people hear about them before sending
export const MAX_POST_LENGTH = 3000;
export const MAX_COMMENT_LENGTH = 1250;
export const MAX_POST_IMAGES = 4;

export interface FeedAuthor {
  id: string;
  name: string;
  headline?: string;
  avatar?: string;
  is_verified: boolean;
  role: 'user' | 'recruiter' | 'expert';
}

export interface FeedMedia {
  url: string;
  width?: number;
  height?: number;
}

export interface FeedPost {
  id: string;
  author: FeedAuthor;
  content: string;
  category: PostCategory;
  media: FeedMedia[];
  reaction_counts: Partial<Record<ReactionType, number>>;
  reactions_total: number;
  comments_count: number;
  user_reaction?: ReactionType;
  is_saved: boolean;
  is_owner: boolean;
  /** Only sent to the author: other members who saw the post, once a day each */
  impressions?: number;
  created_at: string;
  edited_at?: string;
}

export interface TrendingTag {
  tag: string;
  posts: number;
}

export interface FeedPage {
  posts: FeedPost[];
  next_cursor?: string;
}

export interface FeedComment {
  id: string;
  post_id: string;
  author: FeedAuthor;
  content: string;
  can_delete: boolean;
  created_at: string;
}

export interface CommentPage {
  comments: FeedComment[];
  next_cursor?: string;
}

export interface ReactionState {
  reaction_counts: Partial<Record<ReactionType, number>>;
  reactions_total: number;
  user_reaction?: ReactionType;
}
