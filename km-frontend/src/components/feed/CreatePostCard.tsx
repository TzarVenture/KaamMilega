'use client';

import React from 'react';
import { BriefcaseIcon, ImageIcon, MedalIcon } from '@phosphor-icons/react';
import UserAvatar from '@/components/ui/UserAvatar';
import { getCurrentUser } from '@/lib/auth';
import { FeedCategory } from './feedTypes';

interface CreatePostCardProps {
  onOpenModal: (initialCategory?: FeedCategory) => void;
}

export const CreatePostCard: React.FC<CreatePostCardProps> = ({ onOpenModal }) => {
  const user = getCurrentUser();
  const userName = user?.name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Guest');
  const userAvatar = user?.profile_image || user?.avatar || null;

  return (
    <div className="bg-km-surface-card border border-km-border rounded-2xl p-4 sm:p-5 shadow-xs transition-all duration-200 hover:border-[#0B5ED7]/40 hover:shadow-md">
      {/* Top Input Trigger */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full border border-km-border overflow-hidden bg-km-surface shrink-0">
          <UserAvatar src={userAvatar} name={userName} className="w-full h-full object-cover" />
        </div>

        <button
          type="button"
          onClick={() => onOpenModal('all')}
          className="flex-1 text-left px-4 py-3 bg-km-surface hover:bg-[#EBF1FA] border border-km-border rounded-full text-xs sm:text-sm font-poppins text-km-text-secondary transition-colors focus:outline-none focus:ring-2 focus:ring-[#0B5ED7]/20"
        >
          Start a post, share an opportunity or milestone...
        </button>
      </div>

      {/* Quick Action Category Triggers */}
      <div className="flex items-center justify-between border-t border-km-border mt-4 pt-3 gap-1 sm:gap-2">
        <button
          type="button"
          onClick={() => onOpenModal('all')}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-2 sm:px-3 rounded-xl text-xs font-poppins font-semibold text-km-text-secondary hover:bg-[#EFF6FF] hover:text-km-link transition-all"
        >
          <ImageIcon weight="bold" size={18} className="text-km-link" />
          <span className="hidden sm:inline">Photo / Media</span>
          <span className="sm:hidden">Photo</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('jobs')}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-2 sm:px-3 rounded-xl text-xs font-poppins font-semibold text-km-text-secondary hover:bg-[#FFF7ED] hover:text-[#FF6B00] transition-all"
        >
          <BriefcaseIcon weight="bold" size={18} className="text-[#FF6B00]" />
          <span className="hidden sm:inline">Hiring / Job</span>
          <span className="sm:hidden">Job</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenModal('skills')}
          className="flex-1 flex items-center justify-center gap-2 py-2 px-2 sm:px-3 rounded-xl text-xs font-poppins font-semibold text-km-text-secondary hover:bg-[#F0FDF4] hover:text-[#16A34A] transition-all"
        >
          <MedalIcon weight="bold" size={18} className="text-[#16A34A]" />
          <span className="hidden sm:inline">Celebration</span>
          <span className="sm:hidden">Milestone</span>
        </button>
      </div>
    </div>
  );
};

export default CreatePostCard;
