'use client';

import React, { useState, useRef, useEffect } from 'react';
import {
  ThumbsUp,
  MessageSquare,
  Repeat2,
  Send,
  MoreHorizontal,
  Bookmark,
  Share2,
  Trash2,
  ShieldCheck,
  Check,
  Globe,
  Heart,
  Lightbulb,
  PartyPopper,
} from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { FeedPost, FeedAuthor, ReactionType } from './feedTypes';
import { getCurrentUser } from '@/lib/auth';
import { toast } from 'react-toastify';

interface PostCardProps {
  post: FeedPost;
  onLike: (postId: string, reaction?: ReactionType) => void;
  onSave: (postId: string) => void;
  onRepost: (postId: string) => void;
  onComment: (postId: string, content: string) => void;
  onDelete?: (postId: string) => void;
}

const REACTION_CONFIG: Record<
  ReactionType,
  { label: string; icon: React.ReactNode; color: string; badgeBg: string }
> = {
  like: {
    label: 'Like',
    icon: <ThumbsUp size={15} className="fill-[#0B5ED7] text-[#0B5ED7]" />,
    color: 'text-[#0B5ED7]',
    badgeBg: 'bg-[#0B5ED7]',
  },
  celebrate: {
    label: 'Celebrate',
    icon: <PartyPopper size={15} className="fill-[#16A34A] text-[#16A34A]" />,
    color: 'text-[#16A34A]',
    badgeBg: 'bg-[#16A34A]',
  },
  support: {
    label: 'Support',
    icon: <Heart size={15} className="fill-[#EF4444] text-[#EF4444]" />,
    color: 'text-[#EF4444]',
    badgeBg: 'bg-[#EF4444]',
  },
  love: {
    label: 'Love',
    icon: <Heart size={15} className="fill-[#EF4444] text-[#EF4444]" />,
    color: 'text-[#EF4444]',
    badgeBg: 'bg-[#EF4444]',
  },
  insightful: {
    label: 'Insightful',
    icon: <Lightbulb size={15} className="fill-[#F59E0B] text-[#F59E0B]" />,
    color: 'text-[#F59E0B]',
    badgeBg: 'bg-[#F59E0B]',
  },
};

export const PostCard: React.FC<PostCardProps> = ({
  post,
  onLike,
  onSave,
  onRepost,
  onComment,
  onDelete,
}) => {
  const currentUser = getCurrentUser();
  const currentUserId = currentUser?.id || currentUser?._id;

  const [isExpanded, setIsExpanded] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const reactionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Close 3-dots dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const isOwner = currentUserId && post.author.id === currentUserId;

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(`${window.location.origin}/feed#${post.id}`);
      toast.success('Post link copied to clipboard!');
      setMenuOpen(false);
    }
  };

  const handleCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    onComment(post.id, commentText.trim());
    setCommentText('');
  };

  // Format content text with highlighted hashtags
  const renderFormattedText = (text: string) => {
    const maxLength = 240;
    const shouldTruncate = text.length > maxLength && !isExpanded;
    const displayText = shouldTruncate ? `${text.slice(0, maxLength)}...` : text;

    // Split words to highlight hashtags
    const parts = displayText.split(/(#[a-zA-Z0-9_]+)/g);

    return (
      <div className="text-sm font-poppins text-[#111827] leading-relaxed whitespace-pre-line">
        {parts.map((part, index) => {
          if (part.startsWith('#')) {
            return (
              <span key={index} className="text-[#0B5ED7] font-medium hover:underline cursor-pointer">
                {part}
              </span>
            );
          }
          return <span key={index}>{part}</span>;
        })}
        {shouldTruncate && (
          <button
            type="button"
            onClick={() => setIsExpanded(true)}
            className="text-xs font-semibold text-[#0B5ED7] hover:underline ml-1 inline-block"
          >
            see more
          </button>
        )}
      </div>
    );
  };

  const currentReaction = post.userReaction ? REACTION_CONFIG[post.userReaction] : null;

  return (
    <article
      id={post.id}
      className="bg-white border border-[#D9E0EA] rounded-2xl shadow-xs transition-all duration-200 hover:border-[#0B5ED7]/40 hover:shadow-md overflow-hidden"
    >
      {/* 1. Header: Author Identity & 3-Dots Menu */}
      <div className="p-4 sm:p-5 pb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-12 h-12 rounded-full border border-[#D9E0EA] overflow-hidden bg-[#F4F7FB] shrink-0">
            <UserAvatar src={post.author.avatar} name={post.author.name} className="w-full h-full object-cover" />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 className="font-poppins font-bold text-sm text-[#111827] hover:text-[#0B5ED7] cursor-pointer transition-colors leading-snug">
                {post.author.name}
              </h3>
              {post.author.isVerified && (
                <ShieldCheck size={15} className="text-[#0B5ED7] shrink-0" title="Verified Member" />
              )}
            </div>

            <p className="text-xs text-[#5B6472] font-poppins line-clamp-1 mt-0.5">
              {post.author.headline}
            </p>

            <div className="flex items-center gap-1 text-[11px] text-[#5B6472] mt-0.5 font-poppins">
              <span>{post.createdAt}</span>
              <span>•</span>
              <Globe size={11} className="text-[#5B6472]" />
            </div>
          </div>
        </div>

        {/* 3-Dots Action Menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen(!menuOpen)}
            className="p-1.5 text-[#5B6472] hover:text-[#111827] hover:bg-[#F4F7FB] rounded-full transition-colors"
            aria-label="Post actions"
          >
            <MoreHorizontal size={20} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 w-48 bg-white border border-[#D9E0EA] rounded-2xl shadow-lg py-1.5 z-20 text-xs font-poppins font-medium animate-in fade-in zoom-in-95 duration-100">
              <button
                type="button"
                onClick={() => {
                  onSave(post.id);
                  setMenuOpen(false);
                  toast.info(post.isSaved ? 'Removed from saved items' : 'Post saved to bookmarks');
                }}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[#111827] hover:bg-[#F4F7FB] transition-colors"
              >
                <Bookmark size={15} className={post.isSaved ? 'text-[#FF6B00] fill-[#FF6B00]' : 'text-[#5B6472]'} />
                <span>{post.isSaved ? 'Unsave Post' : 'Save Post'}</span>
              </button>

              <button
                type="button"
                onClick={handleCopyLink}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[#111827] hover:bg-[#F4F7FB] transition-colors"
              >
                <Share2 size={15} className="text-[#5B6472]" />
                <span>Copy Link to Post</span>
              </button>

              {isOwner && onDelete && (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(post.id);
                    setMenuOpen(false);
                    toast.success('Post deleted');
                  }}
                  className="w-full flex items-center gap-2.5 px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors border-t border-[#D9E0EA]"
                >
                  <Trash2 size={15} />
                  <span>Delete Post</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 2. Post Content Body */}
      <div className="px-4 sm:px-5 pb-3">
        {renderFormattedText(post.content)}
      </div>

      {/* 3. Media Preview Frame */}
      {post.mediaUrl && (
        <div className="border-y border-[#D9E0EA] bg-[#F4F7FB] overflow-hidden max-h-[500px] flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={post.mediaUrl}
            alt="Post attachment"
            className="w-full h-auto max-h-[500px] object-cover"
            loading="lazy"
          />
        </div>
      )}

      {/* 4. Engagement Counters Summary */}
      <div className="px-4 sm:px-5 py-2.5 flex items-center justify-between text-xs font-inter text-[#5B6472] border-b border-[#D9E0EA]/60">
        <div className="flex items-center gap-1.5">
          {post.likesCount > 0 ? (
            <>
              <div className="flex -space-x-1 items-center">
                <span className="w-4 h-4 rounded-full bg-[#0B5ED7] flex items-center justify-center text-white text-[9px] shadow-xs">
                  👍
                </span>
                <span className="w-4 h-4 rounded-full bg-[#16A34A] flex items-center justify-center text-white text-[9px] shadow-xs">
                  👏
                </span>
                <span className="w-4 h-4 rounded-full bg-[#EF4444] flex items-center justify-center text-white text-[9px] shadow-xs">
                  ❤️
                </span>
              </div>
              <span className="font-medium text-[#111827]">{post.likesCount}</span>
            </>
          ) : (
            <span className="text-[11px] text-[#5B6472]">Be the first to react</span>
          )}
        </div>

        <div className="flex items-center gap-3 text-[11px]">
          {post.comments.length > 0 && (
            <button
              type="button"
              onClick={() => setShowComments(!showComments)}
              className="hover:underline hover:text-[#0B5ED7]"
            >
              {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
            </button>
          )}
          {post.repostsCount > 0 && (
            <>
              <span>•</span>
              <span>
                {post.repostsCount} {post.repostsCount === 1 ? 'repost' : 'reposts'}
              </span>
            </>
          )}
        </div>
      </div>

      {/* 5. LinkedIn Interactive Action Bar */}
      <div className="px-2 py-1 flex items-center justify-between relative">
        {/* Reaction Hover Picker Drawer */}
        {showReactionPicker && (
          <div
            onMouseEnter={() => {
              if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
              setShowReactionPicker(true);
            }}
            onMouseLeave={() => setShowReactionPicker(false)}
            className="absolute left-4 -top-11 bg-white border border-[#D9E0EA] shadow-xl rounded-full px-3 py-1.5 flex items-center gap-3 z-30 animate-in fade-in slide-in-from-bottom-2 duration-150"
          >
            {(['like', 'celebrate', 'support', 'insightful'] as ReactionType[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => {
                  onLike(post.id, r);
                  setShowReactionPicker(false);
                }}
                className="transform hover:scale-130 transition-transform duration-150 p-1 text-lg"
                title={REACTION_CONFIG[r].label}
              >
                {r === 'like' && '👍'}
                {r === 'celebrate' && '👏'}
                {r === 'support' && '❤️'}
                {r === 'insightful' && '💡'}
              </button>
            ))}
          </div>
        )}

        {/* 1. Like Button */}
        <button
          type="button"
          onMouseEnter={() => {
            if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
            reactionTimeoutRef.current = setTimeout(() => setShowReactionPicker(true), 350);
          }}
          onMouseLeave={() => {
            if (reactionTimeoutRef.current) clearTimeout(reactionTimeoutRef.current);
            reactionTimeoutRef.current = setTimeout(() => setShowReactionPicker(false), 400);
          }}
          onClick={() => onLike(post.id, 'like')}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl text-xs font-poppins font-semibold transition-all hover:bg-[#F4F7FB] ${
            post.isLiked
              ? currentReaction?.color || 'text-[#0B5ED7]'
              : 'text-[#5B6472] hover:text-[#071A4D]'
          }`}
        >
          {post.isLiked && currentReaction ? (
            currentReaction.icon
          ) : (
            <ThumbsUp size={16} />
          )}
          <span>{post.isLiked && currentReaction ? currentReaction.label : 'Like'}</span>
        </button>

        {/* 2. Comment Button */}
        <button
          type="button"
          onClick={() => setShowComments(!showComments)}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl text-xs font-poppins font-semibold transition-all hover:bg-[#F4F7FB] ${
            showComments ? 'text-[#0B5ED7]' : 'text-[#5B6472] hover:text-[#071A4D]'
          }`}
        >
          <MessageSquare size={16} />
          <span>Comment</span>
        </button>

        {/* 3. Repost Button */}
        <button
          type="button"
          onClick={() => {
            onRepost(post.id);
            toast.success(post.isReposted ? 'Repost removed' : 'Reposted to your network!');
          }}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl text-xs font-poppins font-semibold transition-all hover:bg-[#F4F7FB] ${
            post.isReposted ? 'text-[#16A34A]' : 'text-[#5B6472] hover:text-[#071A4D]'
          }`}
        >
          <Repeat2 size={17} />
          <span>Repost</span>
        </button>

        {/* 4. Send / Share Button */}
        <button
          type="button"
          onClick={handleCopyLink}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-1 rounded-xl text-xs font-poppins font-semibold text-[#5B6472] hover:text-[#071A4D] hover:bg-[#F4F7FB] transition-all"
        >
          <Send size={15} />
          <span>Share</span>
        </button>
      </div>

      {/* 6. Inline Expandable Comments Section */}
      {showComments && (
        <div className="border-t border-[#D9E0EA] bg-[#F4F7FB]/40 p-4 sm:p-5 space-y-4 animate-in fade-in duration-200">
          {/* New Comment Input Box */}
          <form onSubmit={handleCommentSubmit} className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full border border-[#D9E0EA] overflow-hidden bg-white shrink-0 mt-0.5">
              <UserAvatar
                src={currentUser?.profile_image || currentUser?.avatar}
                name={currentUser?.name || 'You'}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex-1 space-y-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Add a constructive comment..."
                className="w-full px-4 py-2.5 text-xs sm:text-sm font-poppins bg-white border border-[#D9E0EA] rounded-full focus:outline-none focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/15 transition-all text-[#111827] placeholder:text-[#5B6472]/60"
              />

              {commentText.trim() && (
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl text-xs font-poppins font-semibold shadow-xs transition-all"
                  >
                    Post Comment
                  </button>
                </div>
              )}
            </div>
          </form>

          {/* List of Comments */}
          {post.comments.length > 0 && (
            <div className="space-y-3 pt-2">
              {post.comments.map((comm) => (
                <div key={comm.id} className="flex items-start gap-2.5 text-xs font-poppins">
                  <div className="w-8 h-8 rounded-full border border-[#D9E0EA] overflow-hidden bg-white shrink-0 mt-0.5">
                    <UserAvatar src={comm.author.avatar} name={comm.author.name} className="w-full h-full object-cover" />
                  </div>

                  <div className="flex-1 bg-white border border-[#D9E0EA] rounded-2xl p-3 shadow-xs">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-bold text-[#111827]">{comm.author.name}</h4>
                      <span className="text-[10px] text-[#5B6472]">{comm.createdAt}</span>
                    </div>
                    {comm.author.headline && (
                      <p className="text-[11px] text-[#5B6472] truncate">{comm.author.headline}</p>
                    )}
                    <p className="text-xs text-[#111827] mt-1.5 leading-relaxed">{comm.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </article>
  );
};

export default PostCard;
