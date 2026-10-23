'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
    ArrowSquareOutIcon, 
    ArrowsClockwiseIcon, 
    CircleNotchIcon, 
    ClockIcon, 
    EyeIcon, 
    MagnifyingGlassIcon, 
    PencilSimpleIcon, 
    PlayIcon, 
    PlusIcon, 
    StackIcon, 
    TrashIcon, 
    UserIcon, 
    VideoCameraIcon, 
    WarningIcon, 
    XIcon 
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import api from '@/lib/axios';
import LearnVideoModal, { CourseVideo } from '@/components/modals/admin/LearnVideoModal';
import Pagination from '@/components/ui/Pagination';
import { openYouTubeVideo, getYouTubeThumbnail } from '@/lib/youtube';

export default function LearnVideosPage() {
    // Catalog state
    const [videos, setVideos] = useState<CourseVideo[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters and Search
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [sortBy, setSortBy] = useState<'recent' | 'views' | 'title'>('recent');

    // Pagination state - Fixed 6 per page matching /courses/manage
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 6;

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

    // Reset page on filter changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, selectedCategory, sortBy, pageSize]);

    // Paginated subset
    const totalItems = filteredVideos.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const paginatedVideos = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        return filteredVideos.slice(start, start + pageSize);
    }, [filteredVideos, currentPage, pageSize]);

    // Handle Create or Update with Admin privileges across platform
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
            // Update across platform
            const updated: any = await api.put(`/courses/${formData.id}`, {
                title: formData.title,
                youtube_url: formData.youtube_url,
                category: formData.category,
                duration: formData.duration,
                thumbnail_url: formData.thumbnail_url,
                description: formData.description
            });
            toast.success('Course updated platform-wide!');
            setVideos(prev => prev.map(v => v.id === formData.id ? { ...v, ...updated } : v));
        } else {
            // Create across platform
            const created: any = await api.post('/courses', {
                title: formData.title,
                youtube_url: formData.youtube_url,
                category: formData.category,
                duration: formData.duration,
                thumbnail_url: formData.thumbnail_url,
                description: formData.description
            });
            toast.success('New course added platform-wide!');
            setVideos(prev => [created, ...prev]);
        }
        setIsAddEditModalOpen(false);
        setEditingVideo(null);
    };

    // Handle Delete Confirmation with Admin privileges across platform
    const handleConfirmDelete = async () => {
        if (!deleteModalVideo) return;
        setIsDeleting(true);
        try {
            await api.delete(`/courses/${deleteModalVideo.id}`);
            toast.success('Course permanently deleted platform-wide!');
            setVideos(prev => prev.filter(v => v.id !== deleteModalVideo.id));
            if (paginatedVideos.length === 1 && currentPage > 1) {
                setCurrentPage(prev => prev - 1);
            }
            setDeleteModalVideo(null);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to delete course');
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
            {/* ─── Top Bar / Admin Banner ─── */}
            <div className="bg-km-surface-card rounded-2xl p-4 sm:p-5 border border-km-border shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#071A4D]/10 text-[#071A4D] rounded-xl dark:bg-km-primary/10 dark:text-km-primary">
                            <VideoCameraIcon size={20} weight="bold" />
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-km-heading">
                            Admin Learn Videos Management
                        </h1>
                    </div>
                    <p className="text-xs text-km-text-secondary">
                        Manage, edit, or remove any learning video across Kaammilega.
                    </p>
                </div>

                {/* Stats Chips & Add Button */}
                <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-km-surface border border-km-border rounded-xl text-xs font-semibold text-km-heading">
                        <StackIcon size={14} className="text-[#0B5ED7]" />
                        <span>{videos.length} Courses</span>
                    </div>

                    <div className="flex items-center gap-1.5 px-3 py-1.5 bg-km-surface border border-km-border rounded-xl text-xs font-semibold text-km-heading">
                        <EyeIcon size={14} className="text-emerald-600" />
                        <span>{totalViews.toLocaleString()} Views</span>
                    </div>

                    <button
                        onClick={() => fetchVideos(false)}
                        disabled={refreshing}
                        title="Refresh Catalog"
                        className="p-2 bg-km-surface hover:bg-km-surface-card text-km-text-secondary hover:text-km-heading rounded-xl border border-km-border transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                        <ArrowsClockwiseIcon size={15} className={refreshing ? 'animate-spin' : ''} />
                    </button>

                    <button
                        onClick={() => {
                            setEditingVideo(null);
                            setIsAddEditModalOpen(true);
                        }}
                        className="flex items-center gap-1.5 px-4 py-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                    >
                        <PlusIcon weight="bold" size={14} />
                        <span>Add New Course</span>
                    </button>
                </div>
            </div>

            {/* ─── Filter and Search Controls ─── */}
            <div className="bg-km-surface-card p-3.5 sm:p-4 rounded-2xl border border-km-border shadow-xs space-y-3">
                <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
                    {/* Search Input */}
                    <div className="relative flex-1">
                        <MagnifyingGlassIcon weight="bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary" size={16} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search courses by title, category, expert name or description..."
                            className="w-full pl-9 pr-9 py-2 bg-km-surface hover:bg-km-surface/80 focus:bg-km-surface-card border border-km-border rounded-xl text-xs sm:text-sm text-km-text-primary focus:outline-hidden focus:ring-2 focus:ring-[#0B5ED7]/20 focus:border-[#0B5ED7] transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-km-text-secondary hover:text-km-text-primary p-0.5"
                            >
                                <XIcon weight="bold" size={13} />
                            </button>
                        )}
                    </div>

                    {/* Sort Options */}
                    <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs font-semibold text-km-text-secondary">Sort:</span>
                        <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="bg-km-surface border border-km-border rounded-xl px-3 py-1.5 text-xs font-semibold text-km-heading focus:outline-hidden focus:border-[#0B5ED7] transition-all cursor-pointer"
                        >
                            <option value="recent">Recently Added</option>
                            <option value="views">Most Viewed</option>
                            <option value="title">Title (A-Z)</option>
                        </select>
                    </div>
                </div>

                {/* Category Pills */}
                {categories.length > 1 && (
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none">
                        {categories.map((cat) => {
                            const isSelected = selectedCategory === cat;
                            return (
                                <button
                                    key={cat}
                                    onClick={() => setSelectedCategory(cat)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all border cursor-pointer ${
                                        isSelected
                                            ? 'bg-[#071A4D] text-white border-[#071A4D] shadow-2xs dark:bg-km-primary dark:border-km-primary'
                                            : 'bg-km-surface hover:bg-km-surface-card text-km-text-secondary border-km-border hover:border-[#0B5ED7]/40'
                                    }`}
                                >
                                    {cat}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── Video Cards Grid (Exact Card Layout from /courses/manage) ─── */}
            {loading ? (
                <div className="flex flex-col items-center justify-center py-20 bg-km-surface-card rounded-2xl border border-km-border shadow-xs">
                    <CircleNotchIcon size={32} className="text-km-link animate-spin mb-2.5" />
                    <p className="text-xs font-semibold text-km-text-secondary">Loading courses catalog...</p>
                </div>
            ) : filteredVideos.length === 0 ? (
                <div className="bg-km-surface-card rounded-2xl p-10 text-center border border-km-border shadow-xs space-y-3">
                    <div className="w-14 h-14 bg-km-surface text-km-text-secondary rounded-full flex items-center justify-center mx-auto">
                        <VideoCameraIcon size={26} />
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-base font-bold text-km-heading">No Learning Courses Found</h3>
                        <p className="text-xs text-km-text-secondary max-w-sm mx-auto">
                            {searchTerm || selectedCategory !== 'All'
                                ? 'No courses match your active search or category filters. Try clearing filters.'
                                : 'The catalog is empty. Add a new course to make it available platform-wide.'}
                        </p>
                    </div>
                    {searchTerm || selectedCategory !== 'All' ? (
                        <button
                            onClick={() => {
                                setSearchTerm('');
                                setSelectedCategory('All');
                            }}
                            className="px-3.5 py-1.5 bg-km-surface hover:bg-km-surface/80 text-km-heading text-xs font-bold rounded-xl transition-all cursor-pointer border border-km-border"
                        >
                            Reset Filters
                        </button>
                    ) : (
                        <button
                            onClick={() => {
                                setEditingVideo(null);
                                setIsAddEditModalOpen(true);
                            }}
                            className="px-5 py-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white text-xs font-bold rounded-xl shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                        >
                            <PlusIcon weight="bold" size={14} /> Add First Course
                        </button>
                    )}
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Exact Card Grid from /courses/manage - Mobile, Tablet, Laptop, Monitor friendly */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
                        {paginatedVideos.map((video) => {
                            const formattedViews = (video.views || 0) >= 1000 
                                ? `${((video.views || 0) / 1000).toFixed(1)}K` 
                                : String(video.views || 0);

                            return (
                                <div
                                    key={video.id}
                                    className="bg-km-surface-card rounded-2xl border border-km-border overflow-hidden shadow-xs hover:border-[#0B5ED7]/40 hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Thumbnail Box */}
                                        <div 
                                            className="relative w-full aspect-video sm:h-44 bg-slate-100 overflow-hidden cursor-pointer"
                                            onClick={() => setPreviewVideo(video)}
                                        >
                                            <img
                                                src={video.thumbnail_url || getYouTubeThumbnail(video.youtube_video_id || '')}
                                                alt={video.title}
                                                className="w-full h-full object-cover"
                                                onError={(e) => {
                                                    if (video.youtube_video_id) {
                                                        (e.target as HTMLImageElement).src = getYouTubeThumbnail(video.youtube_video_id);
                                                    }
                                                }}
                                            />

                                            {/* Category Badge on Top-Left matching reference screenshot */}
                                            {video.category && (
                                                <span className="absolute top-0 left-0 bg-[#071A4D] text-white text-xs font-semibold px-3.5 py-1.5 rounded-tl-xl rounded-br-2xl shadow-xs z-10 dark:bg-km-primary">
                                                    {video.category}
                                                </span>
                                            )}

                                            {/* Minimalist Play Icon in Center */}
                                            <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                                                <div className="w-10 h-10 bg-km-surface-card text-km-heading rounded-full flex items-center justify-center shadow-xs">
                                                    <PlayIcon weight="fill" size={15} className="ml-0.5" />
                                                </div>
                                            </div>

                                            {/* Duration */}
                                            <span className="absolute bottom-2.5 right-2.5 bg-[#071A4D]/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1 dark:bg-km-primary">
                                                <ClockIcon weight="bold" size={11} /> {video.duration || "30 Min"}
                                            </span>
                                        </div>

                                        {/* Info */}
                                        <div className="p-4 space-y-2">
                                            <h3 
                                                onClick={() => setPreviewVideo(video)}
                                                className="text-sm font-bold text-km-text-primary line-clamp-2 leading-snug cursor-pointer hover:text-km-link transition-colors"
                                                title={video.title}
                                            >
                                                {video.title}
                                            </h3>

                                            {/* Full description without trimming */}
                                            {video.description && (
                                                <p className="text-xs text-km-text-secondary leading-relaxed break-words whitespace-pre-line line-clamp-3">
                                                    {video.description}
                                                </p>
                                            )}

                                            <div className="pt-2 border-t border-km-border/60 flex flex-col gap-2 text-xs text-km-text-secondary">
                                                {/* Expert Profile Redirection - Clicking redirects to expert's profile */}
                                                <div className="flex items-center justify-between gap-2">
                                                    {video.expert_id ? (
                                                        <Link 
                                                            href={`/profile/${video.expert_id}`}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="flex items-center gap-1.5 font-bold text-km-heading hover:text-km-link hover:underline truncate max-w-[170px] transition-colors"
                                                            title={`View ${video.expert_name || 'Expert'}'s Profile`}
                                                        >
                                                            <UserIcon weight="bold" size={14} className="text-km-link shrink-0" />
                                                            <span className="truncate">{video.expert_name || 'Expert'}</span>
                                                        </Link>
                                                    ) : (
                                                        <div className="flex items-center gap-1.5 font-bold text-km-text-secondary truncate max-w-[170px]">
                                                            <UserIcon weight="bold" size={14} className="shrink-0" />
                                                            <span className="truncate">{video.expert_name || 'Admin'}</span>
                                                        </div>
                                                    )}

                                                    <span className="text-[11px] text-km-text-secondary">
                                                        {formatDate(video.created_at)}
                                                    </span>
                                                </div>

                                                {/* Views and Watch button */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-1 font-bold text-km-heading">
                                                        <EyeIcon weight="bold" size={13} className="text-km-link" />
                                                        <span>{formattedViews} Viewers</span>
                                                    </div>

                                                    <button
                                                        type="button"
                                                        onClick={() => openYouTubeVideo(video.youtube_video_id || '', video.youtube_url)}
                                                        className="text-[#FF6B00] hover:underline flex items-center gap-1 font-semibold cursor-pointer"
                                                    >
                                                        <span>Watch</span>
                                                        <ArrowSquareOutIcon weight="bold" size={11} />
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Edit and Delete with Admin Privileges */}
                                    <div className="p-3 bg-km-surface/70 border-t border-km-border flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setEditingVideo(video);
                                                setIsAddEditModalOpen(true);
                                            }}
                                            className="flex-1 py-2 px-3 bg-km-surface-card hover:bg-blue-50 border border-km-border hover:border-[#0B5ED7]/50 text-km-heading hover:text-km-link rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                                        >
                                            <PencilSimpleIcon weight="bold" size={13} />
                                            <span>Edit</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDeleteModalVideo(video)}
                                            className="flex-1 py-2 px-3 bg-km-surface-card hover:bg-red-50 border border-km-border hover:border-red-300 text-red-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs dark:text-red-400 cursor-pointer"
                                        >
                                            <TrashIcon weight="bold" size={13} />
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* ─── Pagination Controls (Centered matching /courses/manage) ─── */}
                    {totalPages > 1 && (
                        <div className="flex justify-center pt-8 pb-4">
                            <Pagination
                                current={currentPage}
                                total={totalPages}
                                onPageChange={(p) => {
                                    setCurrentPage(p);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* ─── Add / Edit Video Modal (Admin Power Across Platform) ─── */}
            <LearnVideoModal
                isOpen={isAddEditModalOpen}
                onClose={() => {
                    setIsAddEditModalOpen(false);
                    setEditingVideo(null);
                }}
                onSave={handleSaveVideo}
                initialData={editingVideo}
            />

            {/* ─── Delete Confirmation Modal (Admin Power Across Platform) ─── */}
            <AnimatePresence>
                {deleteModalVideo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-md bg-km-surface-card rounded-2xl p-6 shadow-2xl border border-red-100 space-y-4"
                        >
                            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mx-auto">
                                <WarningIcon weight="bold" size={24} />
                            </div>

                            <div className="text-center space-y-1.5">
                                <h3 className="text-base font-bold text-km-heading">
                                    Delete Course Platform-Wide?
                                </h3>
                                <p className="text-xs text-km-text-secondary leading-relaxed">
                                    Are you sure you want to delete <span className="font-semibold text-km-heading">"{deleteModalVideo.title}"</span>? As an admin, this will permanently remove it from the catalog across the entire platform, including candidate search and the creator's course studio.
                                </p>
                            </div>

                            <div className="flex items-center justify-center gap-2.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setDeleteModalVideo(null)}
                                    disabled={isDeleting}
                                    className="px-4 py-2 text-xs font-semibold text-km-text-secondary hover:text-km-heading hover:bg-km-surface rounded-xl transition-all cursor-pointer border border-km-border"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={isDeleting}
                                    className="flex items-center gap-1.5 px-5 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded-xl shadow-md shadow-red-600/20 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                                >
                                    {isDeleting && <CircleNotchIcon size={14} className="animate-spin" />}
                                    Delete Platform-Wide
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            {/* ─── Embedded Video Player Modal ─── */}
            <AnimatePresence>
                {previewVideo && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="w-full max-w-3xl bg-km-surface-card rounded-2xl overflow-hidden shadow-2xl border border-km-border"
                        >
                            <div className="flex items-center justify-between px-5 py-3.5 border-b border-km-border">
                                <div className="truncate pr-4">
                                    <h3 className="font-bold text-km-heading text-sm truncate">
                                        {previewVideo.title}
                                    </h3>
                                    <div className="flex items-center gap-2 text-[11px] text-km-text-secondary mt-0.5">
                                        <span className="text-[#0B5ED7] font-semibold">{previewVideo.category}</span>
                                        <span>•</span>
                                        <span>{previewVideo.duration}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setPreviewVideo(null)}
                                    className="p-1.5 text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface rounded-lg transition-all cursor-pointer"
                                >
                                    <XIcon size={18} />
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
                                    <div className="w-full h-full flex items-center justify-center text-white text-xs">
                                        <p>No valid YouTube video ID found.</p>
                                    </div>
                                )}
                            </div>

                            <div className="p-3 bg-km-surface flex items-center justify-between border-t border-km-border">
                                <p className="text-xs text-km-text-secondary">
                                    Uploaded by{' '}
                                    {previewVideo.expert_id ? (
                                        <Link 
                                            href={`/profile/${previewVideo.expert_id}`}
                                            className="font-semibold text-km-heading hover:text-[#0B5ED7] hover:underline"
                                            title="View Expert Profile"
                                        >
                                            {previewVideo.expert_name || 'Admin'}
                                        </Link>
                                    ) : (
                                        <span className="font-semibold text-km-heading">{previewVideo.expert_name || 'Admin'}</span>
                                    )}
                                </p>
                                <button
                                    onClick={() => openYouTubeVideo(previewVideo.youtube_video_id || '', previewVideo.youtube_url)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-[#FF6B00] hover:underline cursor-pointer"
                                >
                                    <ArrowSquareOutIcon size={14} /> Open in YouTube App/Tab
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
