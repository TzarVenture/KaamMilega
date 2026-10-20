'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Image as ImageIcon, Hash, Globe, Users, Sparkles, Check, AlertCircle } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { getCurrentUser } from '@/lib/auth';
import { FeedCategory } from './feedTypes';

interface CreatePostModalProps {
  isOpen: boolean;
  initialCategory?: FeedCategory;
  onClose: () => void;
  onSubmit: (postData: {
    content: string;
    category: FeedCategory;
    mediaUrl?: string;
    tags: string[];
  }) => void;
}

const POPULAR_HASHTAGS = [
  '#KaamMilega',
  '#HiringNow',
  '#ImmediateJoining',
  '#SkillsDevelopment',
  '#ElectricianGigs',
  '#DelhiJobs',
  '#WarehouseTeam',
];

export const CreatePostModal: React.FC<CreatePostModalProps> = ({
  isOpen,
  initialCategory = 'all',
  onClose,
  onSubmit,
}) => {
  const user = getCurrentUser();
  const userName = user?.name || (user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Guest Member');
  const userHeadline = user?.headline || 'Member on KaamMilega™';
  const userAvatar = user?.profile_image || user?.avatar || null;

  const [content, setContent] = useState('');
  const [category, setCategory] = useState<FeedCategory>(initialCategory);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'connections'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync category when initialCategory changes
  React.useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        setImagePreview(result);
        setMediaUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddHashtag = (tag: string) => {
    setContent((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${tag}` : tag;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !mediaUrl) return;

    setIsSubmitting(true);

    // Extract tags from text or default
    const extractedTags = (content.match(/#[a-zA-Z0-9_]+/g) || []) as string[];

    onSubmit({
      content: content.trim(),
      category,
      mediaUrl: mediaUrl || undefined,
      tags: extractedTags,
    });

    // Reset and close
    setContent('');
    setMediaUrl(null);
    setImagePreview(null);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-[#071A4D]/50 backdrop-blur-xs transition-opacity"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-white border border-[#D9E0EA] rounded-2xl shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#D9E0EA]">
            <h2 className="text-base font-poppins font-bold text-[#111827]">Create a Post</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-[#5B6472] hover:text-[#111827] hover:bg-[#F4F7FB] rounded-full transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Author Details & Visibility */}
          <div className="px-6 pt-4 pb-2 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-[#D9E0EA] overflow-hidden bg-[#F4F7FB] shrink-0">
              <UserAvatar src={userAvatar} name={userName} className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-poppins font-bold text-sm text-[#111827] leading-tight">{userName}</h3>
              <p className="text-xs text-[#5B6472] truncate max-w-xs">{userHeadline}</p>
              
              <div className="flex items-center gap-2 mt-1">
                {/* Visibility Selector */}
                <button
                  type="button"
                  onClick={() => setVisibility((v) => (v === 'public' ? 'connections' : 'public'))}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-poppins font-semibold border border-[#D9E0EA] text-[#5B6472] bg-[#F4F7FB] hover:bg-[#EBF1FA] transition-colors"
                >
                  {visibility === 'public' ? (
                    <>
                      <Globe size={11} className="text-[#0B5ED7]" /> Anyone (Public)
                    </>
                  ) : (
                    <>
                      <Users size={11} className="text-[#16A34A]" /> Connections Only
                    </>
                  )}
                </button>

                {/* Category Pill Selector */}
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedCategory)}
                  aria-label="Post category"
                  className="px-2 py-0.5 rounded-full text-[11px] font-poppins font-semibold border border-[#D9E0EA] text-[#071A4D] bg-[#F4F7FB] focus:outline-none focus:border-[#0B5ED7]"
                >
                  <option value="all">General Post</option>
                  <option value="jobs">Jobs & Hiring</option>
                  <option value="skills">Skills & Milestone</option>
                  <option value="mentors">Mentorship & Tips</option>
                </select>
              </div>
            </div>
          </div>

          {/* Body Textarea */}
          <div className="px-6 py-2 flex-1 overflow-y-auto space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What would you like to share with the KaamMilega community? Mention jobs, learnings, or spot work updates..."
              className="w-full min-h-[140px] text-sm font-poppins text-[#111827] placeholder:text-[#5B6472]/60 border-none outline-none resize-none leading-relaxed"
              autoFocus
            />

            {/* Image Preview with Remove */}
            {imagePreview && (
              <div className="relative rounded-xl border border-[#D9E0EA] overflow-hidden max-h-60 bg-[#F4F7FB]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Upload preview" className="w-full h-full object-cover max-h-60" />
                <button
                  type="button"
                  onClick={() => {
                    setImagePreview(null);
                    setMediaUrl(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="absolute top-2 right-2 p-1.5 bg-black/60 hover:bg-black/80 text-white rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            )}

            {/* Hashtag Suggestions */}
            <div className="pt-2 border-t border-[#D9E0EA]/60">
              <p className="text-[11px] font-poppins font-semibold text-[#5B6472] mb-1.5 flex items-center gap-1">
                <Sparkles size={12} className="text-[#FF6B00]" /> Suggested Hashtags:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_HASHTAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddHashtag(tag)}
                    className="px-2.5 py-1 rounded-lg text-xs font-poppins font-medium bg-[#EFF6FF] text-[#0B5ED7] hover:bg-[#DBEAFE] transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Hidden File Input */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-[#D9E0EA] bg-[#F4F7FB]/50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-[#5B6472] hover:text-[#0B5ED7] hover:bg-white rounded-xl border border-transparent hover:border-[#D9E0EA] transition-all"
                title="Add photo"
              >
                <ImageIcon size={20} />
              </button>
              <button
                type="button"
                onClick={() => handleAddHashtag('#KaamMilega')}
                className="p-2 text-[#5B6472] hover:text-[#FF6B00] hover:bg-white rounded-xl border border-transparent hover:border-[#D9E0EA] transition-all"
                title="Add hashtag"
              >
                <Hash size={20} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-poppins font-semibold text-[#5B6472] hover:bg-white hover:text-[#111827] transition-all"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={(!content.trim() && !mediaUrl) || isSubmitting}
                onClick={handleSubmit}
                className={`px-5 py-2 rounded-xl text-xs font-poppins font-semibold transition-all ${
                  (!content.trim() && !mediaUrl) || isSubmitting
                    ? 'bg-[#D9E0EA] text-[#5B6472] cursor-not-allowed opacity-60'
                    : 'bg-[#071A4D] hover:bg-[#0B1F52] text-white shadow-xs hover:shadow-md'
                }`}
              >
                {isSubmitting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default CreatePostModal;
