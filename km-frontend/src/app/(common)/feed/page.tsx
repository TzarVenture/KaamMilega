'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import FeedLeftSidebar from '@/components/feed/FeedLeftSidebar';
import FeedRightSidebar from '@/components/feed/FeedRightSidebar';
import CreatePostCard from '@/components/feed/CreatePostCard';
import CreatePostModal from '@/components/feed/CreatePostModal';
import PostCard from '@/components/feed/PostCard';
import FeedHeaderFilters from '@/components/feed/FeedHeaderFilters';
import { FeedPost, FeedCategory, ReactionType } from '@/components/feed/feedTypes';
import { feedApi } from '@/lib/api/feed';
import { getCurrentUser } from '@/lib/auth';
import { BookmarkSimpleIcon, TrayIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<FeedCategory>('all');
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'saved' | 'my-posts'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<FeedCategory>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);

  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id || currentUser?._id;

  // Fetch feed posts from the API
  const fetchPosts = useCallback(
    async (category: FeedCategory, filter: 'all' | 'saved' | 'my-posts', cursor?: string) => {
      try {
        if (!cursor) {
          setIsLoading(true);
        } else {
          setIsLoadingMore(true);
        }

        const res = await feedApi.getFeed({
          category,
          saved: filter === 'saved',
          authorId: filter === 'my-posts' ? currentUserId : undefined,
          before: cursor,
          limit: 15,
        });

        if (cursor) {
          setPosts((prev) => [...prev, ...res.posts]);
        } else {
          setPosts(res.posts);
        }
        setNextCursor(res.nextCursor);
        setHasMore(res.hasMore);
      } catch (err: any) {
        notify.error(err?.message || 'Failed to load feed. Please check your connection.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [currentUserId]
  );

  // Trigger fetch when category or sidebarFilter changes
  useEffect(() => {
    fetchPosts(selectedCategory, sidebarFilter);
  }, [selectedCategory, sidebarFilter, fetchPosts]);

  // Count saved posts present in current memory
  const savedCount = useMemo(() => {
    return posts.filter((p) => p.isSaved).length;
  }, [posts]);

  // Load next page
  const handleLoadMore = () => {
    if (!isLoadingMore && hasMore && nextCursor) {
      fetchPosts(selectedCategory, sidebarFilter, nextCursor);
    }
  };

  // Modal Handlers
  const handleOpenModal = (category: FeedCategory = 'all') => {
    if (!currentUserId) {
      notify.error('Please sign in to share a post on the feed.');
      return;
    }
    setModalCategory(category);
    setIsModalOpen(true);
  };

  const handleCreatePost = async (newPostData: {
    content: string;
    category: FeedCategory;
    mediaUrl?: string;
    tags: string[];
  }) => {
    try {
      const created = await feedApi.createPost(newPostData);
      setPosts((prev) => [created, ...prev]);
      notify.success('Your post has been published to the feed!');
    } catch (err: any) {
      notify.error(err?.message || 'Failed to create post.');
      throw err;
    }
  };

  const handleLikePost = async (postId: string, reaction?: ReactionType) => {
    if (!currentUserId) {
      notify.error('Please sign in to react to posts.');
      return;
    }

    try {
      const updated = await feedApi.reactToPost(postId, reaction || '');
      setPosts((prev) => prev.map((p) => (p.id === postId ? updated : p)));
    } catch (err: any) {
      notify.error(err?.message || 'Failed to react to post.');
    }
  };

  const handleSavePost = async (postId: string) => {
    if (!currentUserId) {
      notify.error('Please sign in to save posts.');
      return;
    }

    try {
      const res = await feedApi.toggleSavePost(postId);
      setPosts((prev) =>
        prev.map((p) => (p.id === postId ? { ...p, isSaved: res.saved } : p))
      );
      notify.info(res.saved ? 'Post saved to bookmarks' : 'Post removed from saved items');
    } catch (err: any) {
      notify.error(err?.message || 'Failed to save post.');
    }
  };

  const handleRepostPost = async (postId: string) => {
    if (!currentUserId) {
      notify.error('Please sign in to repost updates.');
      return;
    }

    try {
      const res = await feedApi.toggleRepostPost(postId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? { ...p, isReposted: res.reposted, repostsCount: res.reposts_count }
            : p
        )
      );
      notify.success(res.reposted ? 'Reposted to your network!' : 'Repost removed');
    } catch (err: any) {
      notify.error(err?.message || 'Failed to repost.');
    }
  };

  const handleCommentPost = async (postId: string, content: string) => {
    if (!currentUserId) {
      notify.error('Please sign in to comment.');
      return;
    }

    try {
      const newComment = await feedApi.addComment(postId, content);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: [...(p.comments || []), newComment],
              }
            : p
        )
      );
      notify.success('Comment added!');
    } catch (err: any) {
      notify.error(err?.message || 'Failed to add comment.');
    }
  };

  const handleDeleteComment = async (postId: string, commentId: string) => {
    try {
      await feedApi.deleteComment(postId, commentId);
      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                comments: (p.comments || []).filter((c) => c.id !== commentId),
              }
            : p
        )
      );
      notify.success('Comment deleted');
    } catch (err: any) {
      notify.error(err?.message || 'Failed to delete comment.');
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      await feedApi.deletePost(postId);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      notify.success('Post deleted successfully');
    } catch (err: any) {
      notify.error(err?.message || 'Failed to delete post.');
    }
  };

  const handleReportPost = async (postId: string, reason: string) => {
    if (!currentUserId) {
      notify.error('Please sign in to report posts.');
      return;
    }

    try {
      await feedApi.reportPost(postId, reason);
      notify.success('Post reported. Our moderation team will review it.');
    } catch (err: any) {
      notify.error(err?.message || 'Failed to report post.');
    }
  };

  return (
    <div className="min-h-screen bg-km-surface py-5 sm:py-7 px-4 sm:px-6 lg:px-8 font-poppins">
      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 1. Left Sidebar (3 cols on lg, sticky) */}
        <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-20">
          <FeedLeftSidebar
            activeFilter={sidebarFilter}
            onFilterChange={(f) => {
              setSidebarFilter(f);
              if (f !== 'all') setSelectedCategory('all');
            }}
            savedCount={savedCount}
          />
        </div>

        {/* 2. Main Feed Stream (6 cols on lg) */}
        <main className="lg:col-span-6 space-y-4 min-w-0">
          {/* Post Creation Card */}
          <CreatePostCard onOpenModal={handleOpenModal} />

          {/* Active Filter Indicator & Category Bar */}
          <div className="space-y-2">
            {sidebarFilter !== 'all' && (
              <div className="bg-km-surface-card border border-km-border rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
                <span className="font-semibold text-km-text-primary flex items-center gap-1.5">
                  <BookmarkSimpleIcon weight="bold" size={14} className="text-[#FF6B00]" />
                  Showing: {sidebarFilter === 'saved' ? 'Your Saved Posts' : 'Your Authored Posts'}
                </span>
                <button
                  type="button"
                  onClick={() => setSidebarFilter('all')}
                  className="text-km-link hover:underline font-semibold"
                >
                  View All Feed
                </button>
              </div>
            )}

            <FeedHeaderFilters
              selectedCategory={selectedCategory}
              onSelectCategory={setSelectedCategory}
            />
          </div>

          {/* Feed Post List */}
          {isLoading ? (
            <div className="bg-km-surface-card border border-km-border rounded-2xl p-12 text-center shadow-xs flex flex-col items-center justify-center space-y-3">
              <SpinnerGapIcon size={32} className="animate-spin text-km-link" />
              <p className="text-xs text-km-text-secondary">Loading latest updates...</p>
            </div>
          ) : posts.length > 0 ? (
            <div className="space-y-4">
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleLikePost}
                  onSave={handleSavePost}
                  onRepost={handleRepostPost}
                  onComment={handleCommentPost}
                  onDelete={handleDeletePost}
                  onDeleteComment={handleDeleteComment}
                  onReport={handleReportPost}
                />
              ))}

              {/* Load More Button */}
              {hasMore && (
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="px-6 py-2.5 bg-km-surface-card border border-km-border hover:border-km-link text-km-text-primary rounded-xl text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-2 disabled:opacity-60"
                  >
                    {isLoadingMore && <SpinnerGapIcon size={14} className="animate-spin text-km-link" />}
                    {isLoadingMore ? 'Loading older posts...' : 'Load more updates'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Empty State */
            <div className="bg-km-surface-card border border-km-border rounded-2xl p-10 text-center shadow-xs space-y-3">
              <TrayIcon size={32} weight="duotone" className="text-km-text-secondary mx-auto" aria-hidden="true" />
              <h3 className="text-base font-bold text-km-text-primary">No updates found in this category</h3>
              <p className="text-xs text-km-text-secondary max-w-sm mx-auto">
                {sidebarFilter === 'saved'
                  ? 'You haven’t saved any posts yet. Click the 3-dots on any post to save it for later.'
                  : 'Be the first one in your network to share an update, job opening, or milestone!'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setSidebarFilter('all');
                  setSelectedCategory('all');
                }}
                className="mt-2 px-5 py-2.5 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl text-xs font-semibold shadow-xs transition-all dark:bg-km-primary dark:hover:bg-km-primary-dark"
              >
                Reset Filters & View All
              </button>
            </div>
          )}
        </main>

        {/* 3. Right Sidebar / Rectangular Banner Section (3 cols on lg, sticky) */}
        <div className="hidden lg:block lg:col-span-3 space-y-4 lg:sticky lg:top-20">
          <FeedRightSidebar />
        </div>
      </div>

      {/* Post Creation Modal */}
      <CreatePostModal
        isOpen={isModalOpen}
        initialCategory={modalCategory}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreatePost}
      />
    </div>
  );
}
