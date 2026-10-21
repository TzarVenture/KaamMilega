'use client';

import React, { useState, useEffect, useMemo } from 'react';
import FeedLeftSidebar from '@/components/feed/FeedLeftSidebar';
import CreatePostCard from '@/components/feed/CreatePostCard';
import CreatePostModal from '@/components/feed/CreatePostModal';
import PostCard from '@/components/feed/PostCard';
import FeedHeaderFilters from '@/components/feed/FeedHeaderFilters';
import {
  FeedPost,
  FeedCategory,
  ReactionType,
} from '@/components/feed/feedTypes';
import {
  getFeedPosts,
  createPost,
  toggleLikePost,
  toggleSavePost,
  toggleRepostPost,
  addCommentToPost,
  deletePost,
} from '@/components/feed/feedStorage';
import { getCurrentUser } from '@/lib/auth';
import { BookmarkSimpleIcon, TrayIcon } from '@phosphor-icons/react';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

export default function FeedPage() {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<FeedCategory>('all');
  const [sidebarFilter, setSidebarFilter] = useState<'all' | 'saved' | 'my-posts'>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<FeedCategory>('all');
  const [mounted, setMounted] = useState(false);

  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id || currentUser?._id;

  // Hydrate feed from storage
  useEffect(() => {
    setPosts(getFeedPosts());
    setMounted(true);
  }, []);

  const savedCount = useMemo(() => {
    return posts.filter((p) => p.isSaved).length;
  }, [posts]);

  // Filter posts based on sidebar filter & category pill
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      // 1. Sidebar filter check
      if (sidebarFilter === 'saved' && !post.isSaved) return false;
      if (sidebarFilter === 'my-posts' && post.author.id !== currentUserId) return false;

      // 2. Category pill check
      if (selectedCategory !== 'all' && post.category !== selectedCategory) return false;

      return true;
    });
  }, [posts, sidebarFilter, selectedCategory, currentUserId]);

  // Handlers
  const handleOpenModal = (category: FeedCategory = 'all') => {
    setModalCategory(category);
    setIsModalOpen(true);
  };

  const handleCreatePost = (newPostData: {
    content: string;
    category: FeedCategory;
    mediaUrl?: string;
    tags: string[];
  }) => {
    const authorName =
      currentUser?.name ||
      (currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : 'Guest Member');

    const created = createPost({
      author: {
        id: currentUserId || `user-${Date.now()}`,
        name: authorName,
        headline: currentUser?.headline || 'Member on KaamMilega™',
        avatar: currentUser?.profile_image || currentUser?.avatar || undefined,
        isVerified: currentUser?.is_email_verified || true,
        role: currentUser?.role || 'user',
        badge: currentUser?.role === 'recruiter' ? 'Recruiter' : 'Member',
      },
      content: newPostData.content,
      category: newPostData.category,
      mediaUrl: newPostData.mediaUrl,
      tags: newPostData.tags,
    });

    setPosts(getFeedPosts());
    toast.success('Your post has been published to the feed!');
  };

  const handleLikePost = (postId: string, reaction: ReactionType = 'like') => {
    const updated = toggleLikePost(postId, reaction);
    setPosts(updated);
  };

  const handleSavePost = (postId: string) => {
    const updated = toggleSavePost(postId);
    setPosts(updated);
  };

  const handleRepostPost = (postId: string) => {
    const updated = toggleRepostPost(postId);
    setPosts(updated);
  };

  const handleCommentPost = (postId: string, content: string) => {
    const authorName =
      currentUser?.name ||
      (currentUser?.first_name ? `${currentUser.first_name} ${currentUser.last_name || ''}`.trim() : 'Guest Member');

    const updated = addCommentToPost(postId, {
      author: {
        id: currentUserId || `user-${Date.now()}`,
        name: authorName,
        headline: currentUser?.headline || 'KaamMilega Member',
        avatar: currentUser?.profile_image || currentUser?.avatar || undefined,
      },
      content,
    });

    setPosts(updated);
    toast.success('Comment added!');
  };

  const handleDeletePost = (postId: string) => {
    const updated = deletePost(postId);
    setPosts(updated);
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-km-surface py-8 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#071A4D] dark:border-km-link" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-km-surface py-5 sm:py-7 px-4 sm:px-6 lg:px-8 font-poppins">
      <ToastContainer position="top-right" autoClose={3000} hideProgressBar />

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* 1. Left Sidebar (4 cols on lg, sticky) */}
        <div className="lg:col-span-4 xl:col-span-4 space-y-4 lg:sticky lg:top-20">
          <FeedLeftSidebar
            activeFilter={sidebarFilter}
            onFilterChange={(f) => {
              setSidebarFilter(f);
              if (f !== 'all') setSelectedCategory('all');
            }}
            savedCount={savedCount}
          />
        </div>

        {/* 2. Main Feed Stream (8 cols on lg, focused & clean) */}
        <main className="lg:col-span-8 xl:col-span-8 space-y-4 min-w-0">
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
          {filteredPosts.length > 0 ? (
            <div className="space-y-4">
              {filteredPosts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleLikePost}
                  onSave={handleSavePost}
                  onRepost={handleRepostPost}
                  onComment={handleCommentPost}
                  onDelete={handleDeletePost}
                />
              ))}
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
