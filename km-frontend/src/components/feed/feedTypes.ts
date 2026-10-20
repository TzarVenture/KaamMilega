export type ReactionType = 'like' | 'celebrate' | 'support' | 'love' | 'insightful';

export type FeedCategory = 'all' | 'jobs' | 'skills' | 'mentors';

export interface FeedAuthor {
  id: string;
  name: string;
  headline: string;
  avatar?: string;
  isVerified?: boolean;
  role?: string;
  badge?: string;
}

export interface FeedComment {
  id: string;
  author: FeedAuthor;
  createdAt: string;
  content: string;
  likesCount: number;
  isLiked?: boolean;
}

export interface FeedPost {
  id: string;
  author: FeedAuthor;
  createdAt: string;
  timestampMs: number;
  content: string;
  tags?: string[];
  category: FeedCategory;
  mediaUrl?: string;
  mediaType?: 'image';
  likesCount: number;
  repostsCount: number;
  isLiked: boolean;
  userReaction?: ReactionType;
  isReposted: boolean;
  isSaved: boolean;
  comments: FeedComment[];
}
