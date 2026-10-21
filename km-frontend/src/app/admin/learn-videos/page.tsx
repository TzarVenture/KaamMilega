'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowSquareOutIcon, ArrowsClockwiseIcon, CalendarBlankIcon, CircleNotchIcon, ClockIcon, EyeIcon, MagnifyingGlassIcon, PencilSimpleIcon, PlayCircleIcon, PlusIcon, StackIcon, TrashIcon, UserIcon, VideoCameraIcon, WarningIcon, XIcon } from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '@/lib/axios';
import LearnVideoModal, { CourseVideo } from '@/components/modals/admin/LearnVideoModal';
import { openYouTubeVideo } from '@/lib/youtube';

export default function LearnVideosPage() {
    // Catalog state
    const [videos, setVideos] = useState<CourseVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters and Search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [sortBy, setSortBy] = useState<'recent' | 'views' | 'title'>('recent');

    // Modals
    const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
    const [editingVideo, setEditingVideo] = useState<CourseVideo | null>(null);

    // Delete Modal
    const [deleteModalVideo, setDeleteModalVideo] = useState<CourseVideo | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Video Player Preview Modal
    const [previewVideo, setPreviewVideo] = useState<CourseVideo | null>(null);

    // Fetch catalog from backend
    const fetchVideos = async (showLoading = true) => {
        if (showLoading) setLoading(true);
        else setRefreshing(true);

        try {
            const res: any = await api.get('/courses?limit=100');
            const data = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : []);
            setVideos(data);
        } catch (err: any) {
            console.error('Failed to fetch videos:', err);
            toast.error(err?.message || 'Failed to load learn videos catalog');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchVideos(true);
    }, []);

    // Extract unique categories for filter tabs
    const categories = useMemo(() => {
        const set = new Set<string>();
        videos.forEach(v => {
            if (v.category && v.category.trim()) {
                set.add(v.category.trim());
            }
        });
        return ['All', ...Array.from(set)];
    }, [videos]);

    // Filter and Sort
    const filteredVideos = useMemo(() => {
        let result = [...videos];

        // Search query
        if (searchTerm.trim()) {
            const query = searchTerm.toLowerCase().trim();
            result = result.filter(v => 
                v.title?.toLowerCase().includes(query) ||
                v.category?.toLowerCase().includes(query) ||
                v.expert_name?.toLowerCase().includes(query) ||
                v.description?.toLowerCase().includes(query)
            );
        }

        // Category filter
        if (selectedCategory !== 'All') {
            result = result.filter(v => v.category?.toLowerCase() === selectedCategory.toLowerCase());
        }

        // Sorting
        if (sortBy === 'recent') {
            result.sort((a, b) => {
                const timeA = a.created_at ? new Date(a.created_at).getTime() : 0;
                const timeB = b.created_at ? new Date(b.created_at).getTime() : 0;
                return timeB - timeA;
            });
        } else if (sortBy === 'views') {
            result.sort((a, b) => (b.views || 0) - (a.views || 0));
        } else if (sortBy === 'title') {
            result.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        }

        return result;
    }, [videos, searchTerm, selectedCategory, sortBy]);

    // Handle Create or Update
    const handleSaveVideo = async (formData: {
        id?: string;
        title: string;
        youtube_url: string;
        category: string;
        duration: string;
        thumbnail_url: string;
        description?: string;
    }) => {
        if (formData.id) {
            // Update
            const updated: any = await api.put(`/courses/${formData.id}`, {
                title: formData.title,
                youtube_url: formData.youtube_url,
                category: formData.category,
                duration: formData.duration,
                thumbnail_url: formData.thumbnail_url,
                description: formData.description
            });
            toast.success('Video updated successfully');
            setVideos(prev => prev.map(v => v.id === formData.id ? { ...v, ...updated } : v));
        } else {
            // Create
            const created: any = await api.post('/courses', {
                title: formData.title,
                youtube_url: formData.youtube_url,
                category: formData.category,
                duration: formData.duration,
                thumbnail_url: formData.thumbnail_url,
                description: formData.description
            });
            toast.success('New video added to catalog');
            setVideos(prev => [created, ...prev]);
        }
        setIsAddEditModalOpen(false);
        setEditingVideo(null);
    };

    // Handle Delete Confirmation
    const handleConfirmDelete = async () => {
        if (!deleteModalVideo) return;
        setIsDeleting(true);
        try {
            await api.delete(`/courses/${deleteModalVideo.id}`);
            toast.success('Video deleted from catalog');
            setVideos(prev => prev.filter(v => v.id !== deleteModalVideo.id));
            setDeleteModalVideo(null);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete video');
        } finally {
            setIsDeleting(false);
        }
    };

    // Quick helpers
    const totalViews = useMemo(() => {
        return videos.reduce((acc, curr) => acc + (curr.views || 0), 0);
    }, [videos]);

    const formatDate = (dateString?: string) => {
        if (!dateString) return 'Recently';
        try {
            return new Date(dateString).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric'
            });
        } catch {
            return 'Recently';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header & Stats Banner */}
            <div className="bg-km-surface-card rounded-3xl p-6 border border-purple-50 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                            <VideoCameraIcon size={22} />
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            Learn Videos Catalog
                        </h1>
                    </div>
                    <p className="text-sm text-gray-500">
                        Manage skill training courses and tutorials for candidates and blue-collar job seekers.
                    </p>
                </div>

                {/* Stats Chips & Add Button */}
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-700">
                        <StackIcon weight="bold" size={14} className="text-purple-600" />
                        <span>{videos.length} Videos</span>
                    </div>

                    <div className="flex items-center gap-2 px-3.5 py-2 bg-slate-50 border border-slate-100 rounded-2xl text-xs font-semibold text-slate-700">
                        <EyeIcon weight="bold" size={14} className="text-emerald-600" />
                        <span>{totalViews.toLocaleString()} Total Views</span>
                    </div>

                    <button
                        onClick={() => fetchVideos(false)}
                        disabled={refreshing}
                        title="Refresh Catalog"
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 transition-all disabled:opacity-50"
                    >
                        <ArrowsClockwiseIcon weight="bold" size={16} className={refreshing ? 'animate-spin' : ''} />
                    </button>

                    <button
                        onClick={() => {
                            setEditingVideo(null);
                            setIsAddEditModalOpen(true);
                        }}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-sm font-bold shadow-lg shadow-purple-600/20 active:scale-95 transition-all"
                    >
                        <PlusIcon weight="bold" size={16} />
                        <span>Add Video</span>
                    </button>
                </div>
            </div>

            {/* Filter and Search Controls */}
            <div className="bg-km-surface-card p-5 rounded-3xl border border-purple-50 shadow-sm space-y-4">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by title, category, author or keywords..."
                            className="w-full pl-11 pr-10 py-2.5 bg-slate-50 hover:bg-slate-50/80 focus:bg-km-surface-card border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/10 focus:border-purple-300 transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                            >
                                <XIcon weight="bold" size={14} />
                            </button>
                        )}
                    </div>

                    {/* Sort Options */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-gray-500">Sort:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-semibold text-gray-700 focus:outline-none focus:border-purple-300 transition-all cursor-pointer"
                        >
                            <option value="recent">Recently Added</option>
                            <option value="views">Most Viewed</option>
                            <option value="title">Title (A-Z)</option>
                        </select>
                    </div>
                </div>

                {/* Category Pills */}
                {categories.length > 1 && (
                    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none pt-1">
                        {categories.map((cat) => {
                            const isSelected = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all border ${
                                        isSelected
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                            : 'bg-slate-50 hover:bg-purple-50/60 text-gray-600 border-slate-200 hover:border-purple-200'
                                    }`}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Video Cards Grid */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-km-surface-card rounded-3xl border border-purple-50 shadow-sm">
                    <CircleNotchIcon size={36} className="text-purple-600 animate-spin mb-3" />
                    <p className="text-sm font-semibold text-gray-500">Loading videos catalog...</p>
                </div>
            ) : filteredVideos.length === 0 ? (
                <div className="bg-km-surface-card rounded-3xl p-12 text-center border border-purple-50 shadow-sm space-y-4">
                    <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mx-auto">
                        <VideoCameraIcon size={30} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-gray-800">No Learning Videos Found</h3>
                        <p className="text-sm text-gray-500 max-w-sm mx-auto">
                            {searchTerm || selectedCategory !== 'All'
                                ? 'No videos match your active search or category filters. Try clearing filters.'
                                : 'Your catalog is empty. Add your first learning video to help candidates upskill!'}
                        </p>
                    </div>
                    {searchTerm || selectedCategory !== 'All' ? (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('All');
                            }}
                            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all"
                        >
                            Reset Filters
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setEditingVideo(null);
                                setIsAddEditModalOpen(true);
                            }}
                            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/20 transition-all inline-flex items-center gap-2"
                        >
                            <PlusIcon weight="bold" size={14} /> Add First Video
                        </button>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {filteredVideos.map((video) => (
                        <motion.div
                            key={video.id}
                            layout
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="bg-km-surface-card rounded-3xl border border-purple-50 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group"
                        >
                            {/* Thumbnail & Badges */}
                            <div className="relative aspect-video w-full bg-slate-100 overflow-hidden cursor-pointer"
                                onClick={() => setPreviewVideo(video)}
                            >
                                <img
                                    src={video.thumbnail_url || 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400&auto=format&fit=crop'}
                                    alt={video.title}
                                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400&auto=format&fit=crop';
                                    }}
                                />

                                {/* Duration Badge */}
                                <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 bg-black/80 backdrop-blur-sm text-white text-[11px] font-bold rounded-md flex items-center gap-1">
                                    <ClockIcon weight="bold" size={11} />
                                    <span>{video.duration || '15 Min'}</span>
                                </div>

                                {/* Category Badge */}
                                <div className="absolute top-2.5 left-2.5 px-2.5 py-1 bg-purple-600/90 backdrop-blur-sm text-white text-[10px] font-extrabold uppercase tracking-wider rounded-lg shadow-sm">
                                    {video.category || 'General'}
                                </div>

                                {/* Play Overlay */}
                                <div className="absolute inset-0 bg-black/20 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                                    <div className="w-12 h-12 rounded-full bg-km-surface-card/90 backdrop-blur-sm flex items-center justify-center text-purple-600 shadow-lg group-hover:scale-110 transition-transform">
                                        <PlayCircleIcon size={28} />
                                    </div>
                                </div>
                            </div>

                            {/* Video Information */}
                            <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                                <div className="space-y-2">
                                    <h3 
                                        onClick={() => setPreviewVideo(video)}
                                        className="text-base font-bold text-gray-900 group-hover:text-purple-600 transition-colors line-clamp-2 cursor-pointer leading-snug"
                                        title={video.title}
                                    >
                                        {video.title}
                                    </h3>

                                    {video.description && (
                                        <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                                            {video.description}
                                        </p>
                                    )}
                                </div>

                                {/* Metadata row */}
                                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-gray-500">
                                    <div className="flex items-center gap-1 font-medium truncate max-w-[130px]">
                                        <UserIcon weight="bold" size={13} className="text-purple-500 shrink-0" />
                                        <span className="truncate">{video.expert_name || 'Admin'}</span>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1 text-slate-600 font-semibold">
                                            <EyeIcon weight="bold" size={13} className="text-emerald-500" />
                                            {video.views || 0}
                                        </span>
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <CalendarBlankIcon weight="bold" size={13} />
                                            {formatDate(video.created_at)}
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                    <button
                                        onClick={() => openYouTubeVideo(video.youtube_video_id || '', video.youtube_url)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                                        title="Open on YouTube"
                                    >
                                        <ArrowSquareOutIcon weight="bold" size={13} />
                                        <span>YouTube</span>
                                    </button>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => {
                                                setEditingVideo(video);
                                                setIsAddEditModalOpen(true);
                                            }}
                                            className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all"
                                            title="Edit Video"
                                        >
                                            <PencilSimpleIcon weight="bold" size={15} />
                                        </button>
                                        <button
                                            onClick={() => setDeleteModalVideo(video)}
                                            className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                                            title="Delete Video"
                                        >
                                            <TrashIcon weight="bold" size={15} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Add / Edit Video Modal */}
            <LearnVideoModal
                isOpen={isAddEditModalOpen}
                onClose={() => {
                    setIsAddEditModalOpen(false);
                    setEditingVideo(null);
                }}
                onSave={handleSaveVideo}
                initialData={editingVideo}
            />

            {/* Delete Confirmation Modal */}
            <AnimatePresence>
                {deleteModalVideo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-km-surface-card rounded-3xl p-6 shadow-2xl border border-red-50 space-y-5"
                        >
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto">
                                <WarningIcon size={24} />
                            </div>

                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-bold text-gray-900">
                                    Delete Learning Video?
                                </h3>
                                <p className="text-sm text-gray-500">
                                    Are you sure you want to delete <span className="font-semibold text-gray-800">"{deleteModalVideo.title}"</span>? This action cannot be undone.
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteModalVideo(null)}
                                    disabled={isDeleting}
                                    className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-bold rounded-xl shadow-lg shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isDeleting && <CircleNotchIcon weight="bold" size={16} className="animate-spin" />}
                                    Delete Video
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* Embedded Video Player Modal */}
            <AnimatePresence>
                {previewVideo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-3xl bg-km-surface-card rounded-3xl overflow-hidden shadow-2xl"
                        >
                            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                                <div className="truncate pr-4">
                                    <h3 className="font-bold text-gray-900 truncate">
                                        {previewVideo.title}
                                    </h3>
                                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                                        <span className="text-purple-600 font-semibold">{previewVideo.category}</span>
                                        <span>•</span>
                                        <span>{previewVideo.duration}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPreviewVideo(null)}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    <XIcon size={20} />
                                </button>
                            </div>

                            {/* Player */}
                            <div className="relative aspect-video bg-black">
                                {previewVideo.youtube_video_id ? (
                                    <iframe
                                        src={`https://www.youtube.com/embed/${previewVideo.youtube_video_id}?autoplay=1&rel=0`}
                                        title={previewVideo.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                        className="w-full h-full border-0"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-white">
                                        <p>No valid YouTube video ID found.</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-4 bg-slate-50 flex items-center justify-between">
                                <p className="text-xs text-gray-500">
                                    By <span className="font-semibold text-gray-700">{previewVideo.expert_name || 'Admin'}</span>
                                </p>
                                <button
                                    onClick={() => openYouTubeVideo(previewVideo.youtube_video_id || '', previewVideo.youtube_url)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-purple-600 hover:text-purple-700"
                                >
                                    <ArrowSquareOutIcon weight="bold" size={14} /> Open in YouTube App/Tab
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
