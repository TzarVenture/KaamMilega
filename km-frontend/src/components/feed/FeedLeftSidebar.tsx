'use client';

import React from 'react';
import Link from 'next/link';
import { BookmarkSimpleIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import UserAvatar from '@/components/ui/UserAvatar';
import { getCurrentUser } from '@/lib/auth';

interface FeedLeftSidebarProps {
  activeFilter?: 'all' | 'saved' | 'my-posts';
  onFilterChange?: (filter: 'all' | 'saved' | 'my-posts') => void;
  savedCount?: number;
}

export const FeedLeftSidebar: React.FC<FeedLeftSidebarProps> = ({
  activeFilter = 'all',
  onFilterChange,
  savedCount = 0,
}) => {
  const user = getCurrentUser();

  const userName = user?.name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Guest Member');
  const userHeadline = user?.headline || user?.job_title || 'Exploring opportunities on KaamMilega™';
  const userAvatar = user?.profile_image || user?.avatar || null;
  const isVerified = user?.is_email_verified || true;

  return (
    <aside className="w-full space-y-4">
      {/* 1. Universal Profile Card */}
      <div className="bg-km-surface-card border border-km-border rounded-2xl shadow-xs overflow-hidden">
        {/* Banner with Digital Primary Gradient */}
        <div className="h-18 w-full bg-gradient-to-r from-[#071A4D] to-[#0B5ED7] relative">
          <div className="absolute inset-0 opacity-15 bg-[radial-gradient(#FFFFFF_1px,transparent_1px)] [background-size:12px_12px]" />
        </div>

        {/* Avatar & Identity Info */}
        <div className="px-5 pb-5 text-center relative pt-0">
          <div className="relative -mt-9 inline-block mb-3">
            <div className="w-18 h-18 rounded-full border-2 border-white shadow-sm overflow-hidden bg-km-surface dark:border-km-surface-card">
              <UserAvatar src={userAvatar} name={userName} className="w-full h-full object-cover" />
            </div>
            {/* Online indicator per design.md */}
            <span
              className="absolute bottom-1 right-1 w-3.5 h-3.5 bg-[#10B981] border-2 border-white rounded-full dark:border-km-surface-card"
              title="Online now"
            />
          </div>

          <div className="flex items-center justify-center gap-1.5">
            <Link
              href="/profile"
              className="font-poppins font-bold text-[15px] text-km-text-primary hover:text-km-link transition-colors leading-snug"
            >
              {userName}
            </Link>
            {isVerified && (
              <span title="Verified Member" className="inline-flex">
                <ShieldCheckIcon weight="bold" size={16} className="text-km-link shrink-0" />
              </span>
            )}
          </div>
          <p className="text-xs text-km-text-secondary mt-1 line-clamp-2 px-1 font-poppins font-normal leading-relaxed">
            {userHeadline}
          </p>
        </div>

        {/* Analytics Section (Using Inter for clean data display per design.md) */}
        <div className="border-t border-km-border px-5 py-3.5 space-y-2.5 text-xs font-inter bg-km-surface/40">
          <Link
            href="/profile"
            className="flex items-center justify-between text-km-text-secondary hover:text-km-heading group transition-colors"
          >
            <span className="font-medium group-hover:underline">Profile Viewers</span>
            <span className="font-semibold text-km-link">342</span>
          </Link>
          <div className="flex items-center justify-between text-km-text-secondary">
            <span className="font-medium">Post Impressions</span>
            <span className="font-semibold text-km-link">1,280</span>
          </div>
        </div>

        {/* Shortcuts & Saved Items */}
        <div className="border-t border-km-border p-3 space-y-1">
          <button
            type="button"
            onClick={() => onFilterChange?.('all')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-poppins font-semibold transition-all ${
              activeFilter === 'all'
                ? 'bg-[#071A4D] text-white shadow-xs dark:bg-km-primary'
                : 'text-km-text-secondary hover:bg-km-surface hover:text-km-heading'
            }`}
          >
            <span>All Posts & Feed</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterChange?.('saved')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-poppins font-semibold transition-all ${
              activeFilter === 'saved'
                ? 'bg-[#071A4D] text-white shadow-xs dark:bg-km-primary'
                : 'text-km-text-secondary hover:bg-km-surface hover:text-km-heading'
            }`}
          >
            <span className="flex items-center gap-2">
              <BookmarkSimpleIcon weight="bold" size={14} className={activeFilter === 'saved' ? 'text-[#FF6B00]' : 'text-km-text-secondary'} />
              Saved Items
            </span>
            {savedCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-inter ${
                  activeFilter === 'saved' ? 'bg-km-surface-card/20 text-white' : 'bg-[#D9E0EA] text-km-text-primary dark:bg-[#293147]'
                }`}
              >
                {savedCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => onFilterChange?.('my-posts')}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-poppins font-semibold transition-all ${
              activeFilter === 'my-posts'
                ? 'bg-[#071A4D] text-white shadow-xs dark:bg-km-primary'
                : 'text-km-text-secondary hover:bg-km-surface hover:text-km-heading'
            }`}
          >
            <span>My Posts</span>
          </button>
        </div>
      </div>

      {/* 2. Footer Copyright & Brand Micro Tag */}

      {/* 3. Footer Copyright & Brand Micro Tag */}
      <div className="px-3 text-center text-[11px] text-km-text-secondary font-poppins space-y-1">
        <p>
          <span className="font-bold text-km-heading">Kaammi</span>
          <span className="font-bold text-[#FF6B00]">lega</span>
          <span className="text-km-heading">™</span> • Har Kaam, Har Mauka
        </p>
        <p className="opacity-80">© {new Date().getFullYear()} KaamMilega. All rights reserved.</p>
      </div>
    </aside>
  );
};

export default FeedLeftSidebar;
