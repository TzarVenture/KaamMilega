'use client';

import React, { useState, useEffect } from 'react';
import { AdminModal, btn, field } from '@/components/admin/ui';
import { extractYouTubeVideoId, getYouTubeThumbnail } from '@/lib/youtube';
import { CircleNotchIcon, ImageIcon, PlayIcon, WarningCircleIcon, YoutubeLogoIcon } from '@phosphor-icons/react';
import { errorText } from "@/lib/notify";

export interface CourseVideo {
    id: string;
    title: string;
    description?: string;
    youtube_url: string;
    youtube_video_id?: string;
    thumbnail_url: string;
    duration: string;
    category: string;
    expert_id?: string;
    expert_name?: string;
    expert_avatar?: string;
    views?: number;
    is_published?: boolean;
    created_at?: string;
    updated_at?: string;
}

interface LearnVideoModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: {
        id?: string;
        title: string;
        youtube_url: string;
        category: string;
        duration: string;
        thumbnail_url: string;
        description?: string;
    }) => Promise<void> | void;
    initialData?: CourseVideo | null;
}

const CATEGORY_PRESETS = [
    'Technical Skills',
    'Vocational Skills',
    'Interview Prep',
    'Soft Skills',
    'Career Guidance',
    'Technology',
    'Design',
    'Safety & Compliance'
];

const DURATION_PRESETS = [
    '5 Min',
    '10 Min',
    '15 Min',
    '30 Min',
    '45 Min',
    '1 Hour'
];

const LearnVideoModal: React.FC<LearnVideoModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialData
}) => {
    const isEdit = Boolean(initialData?.id);

    const [title, setTitle] = useState('');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [category, setCategory] = useState('Technical Skills');
    const [duration, setDuration] = useState('15 Min');
    const [thumbnailUrl, setThumbnailUrl] = useState('');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Detected video ID
    const detectedVideoId = extractYouTubeVideoId(youtubeUrl);

    // Sync state when modal opens or initialData changes
    useEffect(() => {
        if (isOpen) {
            setError(null);
            if (initialData) {
                setTitle(initialData.title || '');
                setYoutubeUrl(initialData.youtube_url || '');
                setCategory(initialData.category || 'Technical Skills');
                setDuration(initialData.duration || '15 Min');
                setThumbnailUrl(initialData.thumbnail_url || '');
                setDescription(initialData.description || '');
            } else {
                setTitle('');
                setYoutubeUrl('');
                setCategory('Technical Skills');
                setDuration('15 Min');
                setThumbnailUrl('');
                setDescription('');
            }
        }
    }, [isOpen, initialData]);

    // Auto-update thumbnail when YouTube URL changes if not manually set
    const handleUrlChange = (val: string) => {
        setYoutubeUrl(val);
        const vidId = extractYouTubeVideoId(val);
        if (vidId) {
            // Auto fill thumbnail if empty or previously auto-generated
            if (!thumbnailUrl || thumbnailUrl.includes('img.youtube.com')) {
                setThumbnailUrl(getYouTubeThumbnail(vidId));
            }
        }
    };

    const handleResetThumbnail = () => {
        if (detectedVideoId) {
            setThumbnailUrl(getYouTubeThumbnail(detectedVideoId));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const cleanTitle = title.trim();
        const cleanUrl = youtubeUrl.trim();
        const cleanCat = category.trim();
        const cleanDur = duration.trim();
        let cleanThumb = thumbnailUrl.trim();

        if (!cleanTitle) {
            setError('Enter a title.');
            return;
        }

        if (!cleanUrl) {
            setError('Enter a YouTube link.');
            return;
        }

        const vidId = extractYouTubeVideoId(cleanUrl);
        if (!vidId) {
            setError("That isn't a YouTube link. Paste a watch, Shorts or share link.");
            return;
        }

        if (!cleanThumb && vidId) {
            cleanThumb = getYouTubeThumbnail(vidId);
        }

        setIsSubmitting(true);
        try {
            await onSave({
                id: initialData?.id,
                title: cleanTitle,
                youtube_url: cleanUrl,
                category: cleanCat || 'General',
                duration: cleanDur || '15 Min',
                thumbnail_url: cleanThumb,
                description: description.trim()
            });
            onClose();
        } catch (err: any) {
            setError(errorText(err, 'Failed to save video'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? 'Edit course' : 'Add course'}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
                        <WarningCircleIcon weight="bold" size={16} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Video URL */}
                <div className="space-y-1.5">
                    <label className="flex items-center justify-between text-sm font-medium text-km-heading mb-1.5">
                        <span>Video URL <span className="text-red-500">*</span></span>
                        {detectedVideoId && (
                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                YouTube video {detectedVideoId}
                            </span>
                        )}
                    </label>
                    <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        required
                        className={field.input}
                    />
                    <p className="text-xs text-km-text-muted">
                        Paste standard YouTube watch links, youtu.be, or YouTube shorts.
                    </p>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                    <label className={field.label}>
                        Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="For example: Electrical safety basics"
                        required
                        maxLength={150}
                        className={field.input}
                    />
                </div>

                {/* Category & Duration Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category */}
                    <div className="space-y-1.5">
                        <label className={field.label}>
                            Category <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Type or pick category below"
                            required
                            className={field.input}
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {CATEGORY_PRESETS.map((cat) => (
                                <button
                                    type="button"
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
 category === cat
 ?'bg-km-primary text-white border-km-blue shadow-sm'
                                            : 'bg-km-surface-card text-km-text-secondary border-km-border hover:border-km-border hover:bg-km-surface'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1.5">
                        <label className={field.label}>
                            Duration <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="e.g. 15 Min, 30 Min"
                            required
                            className={field.input}
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {DURATION_PRESETS.map((dur) => (
                                <button
                                    type="button"
                                    key={dur}
                                    onClick={() => setDuration(dur)}
                                    className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all ${
 duration === dur
 ?'bg-km-primary text-white border-km-blue shadow-sm'
                                            : 'bg-km-surface-card text-km-text-secondary border-km-border hover:border-km-border hover:bg-km-surface'
                                    }`}
                                >
                                    {dur}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Thumbnail Preview & URL */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                            <ImageIcon weight="bold" size={16} className="text-km-link" />
                            Thumbnail
                        </label>
                        {detectedVideoId && (
                            <button
                                type="button"
                                onClick={handleResetThumbnail}
                                className="text-xs text-km-link hover:text-km-link font-semibold flex items-center gap-1 hover:underline"
                            >
                                <YoutubeLogoIcon weight="bold" size={12} /> Auto-fill from YouTube
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                        {/* Live Thumbnail Preview */}
                        <div className="relative w-full sm:w-48 aspect-video rounded-xl overflow-hidden bg-km-surface border border-km-border shrink-0 shadow-sm group">
                            {thumbnailUrl ? (
                                <img
                                    src={thumbnailUrl}
                                    alt="Video thumbnail preview"
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400&auto=format&fit=crop';
                                    }}
                                />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-km-text-muted p-2 text-center text-xs">
                                    <PlayIcon size={24} className="mb-1 text-km-text-muted" />
                                    <span>Thumbnail preview</span>
                                </div>
                            )}
                            <div className="absolute bottom-1.5 right-1.5 bg-black/75 text-white text-xs font-bold px-1.5 py-0.5 rounded">
                                {duration || '15 Min'}
                            </div>
                        </div>

                        {/* Thumbnail URL Input */}
                        <div className="flex-1 w-full space-y-1">
                            <input
                                type="url"
                                value={thumbnailUrl}
                                onChange={(e) => setThumbnailUrl(e.target.value)}
                                placeholder="https://img.youtube.com/vi/... or custom image URL"
                                className={field.input}
                            />
                            <p className="text-xs text-km-text-muted">
                                Automatically generated from YouTube. You can override with a custom image link if needed.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Optional Description */}
                <div className="space-y-1.5">
                    <label className={field.label}>
                        Description <span className="text-xs text-km-text-muted font-normal">(optional)</span>
                    </label>
                    <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="What people learn from this video"
                        className={`${field.textarea} resize-none`}
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-km-border-subtle">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className={btn.secondary}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={btn.primary}
                    >
                        {isSubmitting && <CircleNotchIcon weight="bold" size={16} className="animate-spin" />}
                        {isEdit ? 'Save' : 'Add course'}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
};

export default LearnVideoModal;
