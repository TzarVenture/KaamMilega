'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlobeIcon, HashIcon, ImageIcon, UsersIcon, XIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import UserAvatar from '@/components/ui/UserAvatar';
import { getCurrentUser } from '@/lib/auth';
import { FeedCategory } from './feedTypes';
import { uploadFile, UPLOAD_LIMITS } from '@/lib/upload';
import { notify } from '@/lib/notify';

interface CreatePostModalProps {
  isOpen: boolean;
  initialCategory?: FeedCategory;
  onClose: () => void;
  onSubmit: (postData: {
    content: string;
    category: FeedCategory;
    mediaUrl?: string;
    tags: string[];
  }) => Promise<void> | void;
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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [visibility, setVisibility] = useState<'public' | 'connections'>('public');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync category when initialCategory changes
  useEffect(() => {
    if (initialCategory) setCategory(initialCategory);
  }, [initialCategory]);

  // Clean up any blob preview when closing
  const cleanupPreview = () => {
    if (imagePreview && imagePreview.startsWith('blob:')) {
      URL.revokeObjectURL(imagePreview);
    }
    setImagePreview(null);
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClose = () => {
    cleanupPreview();
    setContent('');
    onClose();
  };

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > UPLOAD_LIMITS.feed_image) {
      notify.error('Photo is too large. Feed images can be up to 5 MB.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (!file.type.startsWith('image/')) {
      notify.error('Please upload an image (JPG, PNG, WebP, GIF).');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    cleanupPreview();
    setSelectedFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleAddHashtag = (tag: string) => {
    setContent((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${trimmed} ${tag}` : tag;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !selectedFile) return;

    setIsSubmitting(true);
    try {
      let uploadedMediaUrl: string | undefined = undefined;

      if (selectedFile) {
        const uploadResult = await uploadFile(selectedFile, 'feed_image', { moduleName: 'feed' });
        uploadedMediaUrl = uploadResult.url;
      }

      // Extract hashtags
      const extractedTags = (content.match(/#[a-zA-Z0-9_]+/g) || []) as string[];

      await onSubmit({
        content: content.trim(),
        category,
        mediaUrl: uploadedMediaUrl,
        tags: extractedTags,
      });

      cleanupPreview();
      setContent('');
      onClose();
    } catch (err: any) {
      notify.error(err?.message || 'Failed to post update. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop (Solid Dim Overlay - No Glassmorphism per design.md) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleClose}
          className="fixed inset-0 bg-black/50 transition-opacity"
        />

        {/* Modal Card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="relative w-full max-w-xl bg-km-surface-card border border-km-border rounded-2xl shadow-xl overflow-hidden z-10 flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-km-border">
            <h2 className="text-base font-poppins font-bold text-km-text-primary">Create a Post</h2>
            <button
              type="button"
              onClick={handleClose}
              className="p-1.5 text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface rounded-full transition-colors"
            >
              <XIcon size={20} />
            </button>
          </div>

          {/* Author Details & Visibility */}
          <div className="px-6 pt-4 pb-2 flex items-center gap-3">
            <div className="w-12 h-12 rounded-full border border-km-border overflow-hidden bg-km-surface shrink-0">
              <UserAvatar src={userAvatar} name={userName} className="w-full h-full object-cover" />
            </div>
            <div>
              <h3 className="font-poppins font-bold text-sm text-km-text-primary leading-tight">{userName}</h3>
              <p className="text-xs text-km-text-secondary truncate max-w-xs">{userHeadline}</p>

              <div className="flex items-center gap-2 mt-1">
                {/* Visibility Selector */}
                <button
                  type="button"
                  onClick={() => setVisibility((v) => (v === 'public' ? 'connections' : 'public'))}
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-poppins font-semibold border border-km-border text-km-text-secondary bg-km-surface hover:bg-[#EBF1FA] transition-colors dark:hover:bg-[#1D253D]"
                >
                  {visibility === 'public' ? (
                    <>
                      <GlobeIcon weight="bold" size={11} className="text-km-link" /> Anyone (Public)
                    </>
                  ) : (
                    <>
                      <UsersIcon weight="bold" size={11} className="text-[#16A34A]" /> Connections Only
                    </>
                  )}
                </button>

                {/* Category Pill Selector */}
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as FeedCategory)}
                  aria-label="Post category"
                  className="px-2 py-0.5 rounded-full text-[11px] font-poppins font-semibold border border-km-border text-km-heading bg-km-surface focus:outline-none focus:border-[#0B5ED7]"
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
              className="w-full min-h-[140px] text-sm font-poppins text-km-text-primary placeholder:text-km-text-secondary/60 border-none outline-none resize-none leading-relaxed bg-transparent"
              autoFocus
            />

            {/* Image Preview with Remove */}
            {imagePreview && (
              <div className="relative rounded-xl border border-km-border overflow-hidden max-h-60 bg-km-surface">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagePreview} alt="Upload preview" className="w-full h-full object-cover max-h-60" />
                <button
                  type="button"
                  onClick={cleanupPreview}
                  className="absolute top-2 right-2 p-1.5 bg-black/70 hover:bg-black/90 text-white rounded-full transition-colors"
                  aria-label="Remove image"
                >
                  <XIcon weight="bold" size={16} />
                </button>
              </div>
            )}

            {/* Hashtag Suggestions */}
            <div className="pt-2 border-t border-km-border/60">
              <p className="text-[11px] font-poppins font-semibold text-km-text-secondary mb-1.5 flex items-center gap-1">
                <HashIcon weight="bold" size={12} aria-hidden="true" /> Suggested Hashtags:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_HASHTAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => handleAddHashtag(tag)}
                    className="px-2.5 py-1 rounded-lg text-xs font-poppins font-medium bg-[#EFF6FF] text-km-link hover:bg-[#DBEAFE] transition-colors dark:bg-[#1D253D] dark:hover:bg-[#172A50]"
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
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
          />

          {/* Footer Bar */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-km-border bg-km-surface/50">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-km-text-secondary hover:text-km-link hover:bg-km-surface-card rounded-xl border border-transparent hover:border-km-border transition-all"
                title="Add photo"
              >
                <ImageIcon size={20} />
              </button>
              <button
                type="button"
                onClick={() => handleAddHashtag('#KaamMilega')}
                className="p-2 text-km-text-secondary hover:text-[#FF6B00] hover:bg-km-surface-card rounded-xl border border-transparent hover:border-km-border transition-all"
                title="Add hashtag"
              >
                <HashIcon size={20} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-poppins font-semibold text-km-text-secondary hover:bg-km-surface-card hover:text-km-text-primary transition-all disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={(!content.trim() && !selectedFile) || isSubmitting}
                onClick={handleSubmit}
                className={`px-5 py-2 rounded-xl text-xs font-poppins font-semibold transition-all inline-flex items-center gap-2 ${
                  (!content.trim() && !selectedFile) || isSubmitting
                    ? 'bg-[#D9E0EA] text-km-text-secondary cursor-not-allowed opacity-60 dark:bg-[#293147]'
                    : 'bg-[#071A4D] hover:bg-[#0B1F52] text-white shadow-xs hover:shadow-md dark:bg-km-primary dark:hover:bg-km-primary-dark'
                }`}
              >
                {isSubmitting && <SpinnerGapIcon size={14} className="animate-spin" />}
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
