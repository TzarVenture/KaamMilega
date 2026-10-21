'use client';

import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { extractYouTubeVideoId, getYouTubeThumbnail } from '@/lib/youtube';
import { Play, Image as ImageIcon, Sparkles, AlertCircle, Loader2 } from 'lucide-react';

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
            setError('Please enter a video title');
            return;
        }

        if (!cleanUrl) {
            setError('Please enter a YouTube video URL');
            return;
        }

        const vidId = extractYouTubeVideoId(cleanUrl);
        if (!vidId) {
            setError('Invalid YouTube link. Please provide a valid YouTube watch, shorts, or share URL.');
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
            setError(err?.response?.data?.error || err?.message || 'Failed to save video');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={isEdit ? 'Edit Learning Video' : 'Add New Learning Video'}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl">
                        <AlertCircle size={16} className="shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Video URL */}
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-800 flex items-center justify-between">
                        <span>Video URL <span className="text-red-500">*</span></span>
                        {detectedVideoId && (
                            <span className="text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                ✓ YouTube ID: {detectedVideoId}
                            </span>
                        )}
                    </label>
                    <input
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => handleUrlChange(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        required
                        className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all"
                    />
                    <p className="text-xs text-gray-400">
                        Paste standard YouTube watch links, youtu.be, or YouTube shorts.
                    </p>
                </div>

                {/* Title */}
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-800">
                        Video Title <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="e.g. Electrical Safety Fundamentals & Tools Guide"
                        required
                        maxLength={150}
                        className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all font-medium text-gray-900"
                    />
                </div>

                {/* Category & Duration Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Category */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-800">
                            Category <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            placeholder="Type or pick category below"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all font-medium"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {CATEGORY_PRESETS.map((cat) => (
                                <button
                                    type="button"
                                    key={cat}
                                    onClick={() => setCategory(cat)}
                                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                                        category === cat
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
                                    }`}
                                >
                                    {cat}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Duration */}
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-800">
                            Duration <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={duration}
                            onChange={(e) => setDuration(e.target.value)}
                            placeholder="e.g. 15 Min, 30 Min"
                            required
                            className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all font-medium"
                        />
                        <div className="flex flex-wrap gap-1.5 pt-1">
                            {DURATION_PRESETS.map((dur) => (
                                <button
                                    type="button"
                                    key={dur}
                                    onClick={() => setDuration(dur)}
                                    className={`text-[11px] font-semibold px-2.5 py-1 rounded-lg border transition-all ${
                                        duration === dur
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-purple-300 hover:bg-purple-50/50'
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
                        <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                            <ImageIcon size={16} className="text-purple-600" />
                            Thumbnail
                        </label>
                        {detectedVideoId && (
                            <button
                                type="button"
                                onClick={handleResetThumbnail}
                                className="text-xs text-purple-600 hover:text-purple-700 font-semibold flex items-center gap-1 hover:underline"
                            >
                                <Sparkles size={12} /> Auto-fill from YouTube
                            </button>
                        )}
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 items-start">
                        {/* Live Thumbnail Preview */}
                        <div className="relative w-full sm:w-48 aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0 shadow-sm group">
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
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-400 p-2 text-center text-xs">
                                    <Play size={24} className="mb-1 text-gray-300" />
                                    <span>Thumbnail Preview</span>
                                </div>
                            )}
                            <div className="absolute bottom-1.5 right-1.5 bg-black/75 backdrop-blur-sm text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
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
                                className="w-full px-4 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-gray-200 rounded-xl text-xs focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all"
                            />
                            <p className="text-[11px] text-gray-400">
                                Automatically generated from YouTube. You can override with a custom image link if needed.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Optional Description */}
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-800">
                        Description <span className="text-xs text-gray-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                        rows={2}
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Brief summary of skills or key takeaways covered in this video..."
                        className="w-full px-4 py-2 bg-slate-50 hover:bg-slate-50/80 focus:bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-400 transition-all resize-none"
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-gray-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-7 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-purple-600/20 active:scale-95 transition-all disabled:opacity-50"
                    >
                        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
                        {isEdit ? 'Update Video' : 'Add Video'}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default LearnVideoModal;
