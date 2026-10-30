import api from '@/lib/axios';
import { FeedPost, FeedComment, FeedCategory, ReactionType } from '@/components/feed/feedTypes';

export interface FeedListResponse {
  posts: FeedPost[];
  nextCursor?: string;
  hasMore: boolean;
}

export function mapBackendPostToFeedPost(p: any): FeedPost {
  return {
    id: p.id,
    author: {
      id: p.author?.id || '',
      name: p.author?.name || 'KaamMilega Member',
      headline: p.author?.headline || 'Member on KaamMilega™',
      avatar: p.author?.avatar || undefined,
      isVerified: p.author?.is_verified ?? false,
      role: p.author?.role || 'user',
      badge: p.author?.badge || '',
    },
    createdAt: p.created_at || 'Just now',
    timestampMs: p.timestamp_ms || Date.now(),
    content: p.content || '',
    tags: p.tags || [],
    category: (p.category as FeedCategory) || 'all',
    mediaUrl: p.media_url || p.mediaUrl || undefined,
    mediaType: p.media_type || p.mediaType || undefined,
    likesCount: p.likes_count ?? p.likesCount ?? 0,
    repostsCount: p.reposts_count ?? p.repostsCount ?? 0,
    isLiked: p.is_liked ?? p.isLiked ?? false,
    userReaction: (p.user_reaction || p.userReaction || undefined) as ReactionType | undefined,
    isReposted: p.is_reposted ?? p.isReposted ?? false,
    isSaved: p.is_saved ?? p.isSaved ?? false,
    comments: (p.comments || []).map((c: any): FeedComment => ({
      id: c.id,
      author: {
        id: c.author?.id || '',
        name: c.author?.name || 'Member',
        headline: c.author?.headline || '',
        avatar: c.author?.avatar || undefined,
        isVerified: c.author?.is_verified ?? false,
      },
      createdAt: c.created_at || 'Just now',
      content: c.content || '',
      likesCount: c.likes_count ?? c.likesCount ?? 0,
      isLiked: c.is_liked ?? c.isLiked ?? false,
    })),
  };
}

export const feedApi = {
  async getFeed(params?: {
    category?: FeedCategory;
    before?: string;
    limit?: number;
    authorId?: string;
    saved?: boolean;
  }): Promise<FeedListResponse> {
    const query = new URLSearchParams();
    if (params?.category && params.category !== 'all') {
      query.set('category', params.category);
    }
    if (params?.before) {
      query.set('before', params.before);
    }
    if (params?.limit) {
      query.set('limit', String(params.limit));
    }
    if (params?.authorId) {
      query.set('author_id', params.authorId);
    }
    if (params?.saved) {
      query.set('saved', 'true');
    }

    const queryString = query.toString();
    const url = `/feed${queryString ? `?${queryString}` : ''}`;
    const data: any = await api.get(url);

    return {
      posts: (data?.posts || []).map(mapBackendPostToFeedPost),
      nextCursor: data?.next_cursor,
      hasMore: Boolean(data?.has_more),
    };
  },

  async getPost(id: string): Promise<FeedPost> {
    const data: any = await api.get(`/feed/${id}`);
    return mapBackendPostToFeedPost(data);
  },

  async createPost(payload: {
    content: string;
    category?: string;
    mediaUrl?: string;
    tags?: string[];
  }): Promise<FeedPost> {
    const data: any = await api.post('/feed', {
      content: payload.content,
      category: payload.category || 'all',
      media_url: payload.mediaUrl || undefined,
      tags: payload.tags || [],
    });
    return mapBackendPostToFeedPost(data);
  },

  async deletePost(id: string): Promise<{ message: string }> {
    return (await api.delete(`/feed/${id}`)) as unknown as { message: string };
  },

  async reactToPost(id: string, reaction: ReactionType | ''): Promise<FeedPost> {
    const data: any = await api.post(`/feed/${id}/reactions`, { reaction });
    return mapBackendPostToFeedPost(data);
  },

  async toggleSavePost(id: string): Promise<{ saved: boolean }> {
    return (await api.post(`/feed/${id}/save`)) as unknown as { saved: boolean };
  },

  async toggleRepostPost(id: string): Promise<{ reposted: boolean; reposts_count: number }> {
    return (await api.post(`/feed/${id}/repost`)) as unknown as {
      reposted: boolean;
      reposts_count: number;
    };
  },

  async getComments(postId: string, limit = 50): Promise<FeedComment[]> {
    const data: any = await api.get(`/feed/${postId}/comments?limit=${limit}`);
    return (data || []).map((c: any): FeedComment => ({
      id: c.id,
      author: {
        id: c.author?.id || '',
        name: c.author?.name || 'Member',
        headline: c.author?.headline || '',
        avatar: c.author?.avatar || undefined,
        isVerified: c.author?.is_verified ?? false,
      },
      createdAt: c.created_at || 'Just now',
      content: c.content || '',
      likesCount: c.likes_count ?? c.likesCount ?? 0,
      isLiked: c.is_liked ?? c.isLiked ?? false,
    }));
  },

  async addComment(postId: string, content: string): Promise<FeedComment> {
    const c: any = await api.post(`/feed/${postId}/comments`, { content });
    return {
      id: c.id,
      author: {
        id: c.author?.id || '',
        name: c.author?.name || 'Member',
        headline: c.author?.headline || '',
        avatar: c.author?.avatar || undefined,
        isVerified: c.author?.is_verified ?? false,
      },
      createdAt: c.created_at || 'Just now',
      content: c.content || '',
      likesCount: c.likes_count ?? c.likesCount ?? 0,
      isLiked: c.is_liked ?? c.isLiked ?? false,
    };
  },

  async deleteComment(postId: string, commentId: string): Promise<{ message: string }> {
    return (await api.delete(`/feed/${postId}/comments/${commentId}`)) as unknown as {
      message: string;
    };
  },

  async reportPost(postId: string, reason: string): Promise<{ message: string }> {
    return (await api.post(`/feed/${postId}/report`, { reason })) as unknown as {
      message: string;
    };
  },
};

