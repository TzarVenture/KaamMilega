'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { ArrowSquareOutIcon, ArrowsClockwiseIcon, EyeIcon, PencilSimpleIcon, PlayIcon, PlusIcon, StackIcon, TrashIcon, VideoCameraIcon, XIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import api from '@/lib/axios';
import LearnVideoModal, { CourseVideo } from '@/components/modals/admin/LearnVideoModal';
import Pagination from '@/components/ui/Pagination';
import { AdminPageHeader, AdminPanel, ConfirmDialog, EmptyState, FilterTabs, SearchInput, SkeletonRows, StatCard, btn, field } from '@/components/admin/ui';
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
            notify.error(err, "Couldn't load courses");
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
            notify.success('Course updated');
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
            notify.success('Course added');
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
            notify.success('Course deleted');
            setVideos(prev => prev.filter(v => v.id !== deleteModalVideo.id));
            if (paginatedVideos.length === 1 && currentPage > 1) {
                setCurrentPage(prev => prev - 1);
            }
            setDeleteModalVideo(null);
        } catch (err: any) {
            notify.error(err, "Couldn't delete the course");
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

    const openCreate = () => {
        setEditingVideo(null);
        setIsAddEditModalOpen(true);
    };
    const filtersActive = searchTerm !== '' || selectedCategory !== 'All';

    return (
        <div>
            <AdminPageHeader
                title="Learn videos"
                description="Courses shown on the Learn page, from experts and the Kaammilega team"
                actions={
                    <>
                        <button type="button" onClick={() => fetchVideos(false)} disabled={refreshing} className={btn.icon} aria-label="Refresh">
                            <ArrowsClockwiseIcon size={18} className={refreshing ? 'animate-spin' : ''} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={openCreate} className={btn.primary}>
                            <PlusIcon size={16} weight="bold" aria-hidden="true" />
                            Add course
                        </button>
                    </>
                }
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                <StatCard label="Courses" value={loading ? '–' : videos.length} icon={StackIcon} />
                <StatCard label="Total views" value={loading ? '–' : totalViews.toLocaleString('en-IN')} icon={EyeIcon} iconClassName="text-km-jobs-text" />
            </div>

            <AdminPanel>
                <div className="flex flex-col gap-3 px-5 py-4 border-b border-km-border-subtle">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search title, category or expert" className="w-full sm:max-w-sm" />
                        <label className="flex items-center gap-2 shrink-0 whitespace-nowrap text-sm text-km-text-secondary">
                            Sort by
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as 'recent' | 'views' | 'title')}
                                className={`${field.input} w-auto cursor-pointer`}
                            >
                                <option value="recent">Recently added</option>
                                <option value="views">Most viewed</option>
                                <option value="title">Title, A to Z</option>
                            </select>
                        </label>
                    </div>
                    {categories.length > 1 && (
                        <div className="overflow-x-auto -mx-1 px-1">
                            <FilterTabs
                                value={selectedCategory}
                                onChange={setSelectedCategory}
                                options={categories.map((cat) => ({ value: cat, label: cat }))}
                            />
                        </div>
                    )}
                </div>

                {loading ? (
                    <SkeletonRows rows={6} />
                ) : filteredVideos.length === 0 ? (
                    <EmptyState
                        icon={VideoCameraIcon}
                        title={filtersActive ? 'No matching courses' : 'No courses yet'}
                        description={filtersActive ? 'Try a different search or category.' : 'Add a course to show it on the Learn page.'}
                        action={filtersActive ? (
                            <button type="button" onClick={() => { setSearchTerm(''); setSelectedCategory('All'); }} className={btn.secondary}>
                                Clear filters
                            </button>
                        ) : (
                            <button type="button" onClick={openCreate} className={btn.primary}>
                                <PlusIcon size={16} weight="bold" aria-hidden="true" />
                                Add course
                            </button>
                        )}
                    />
                ) : (
                    <div className="p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                            {paginatedVideos.map((video) => (
                                <article key={video.id} className="flex flex-col bg-km-surface-card rounded-2xl border border-km-border overflow-hidden">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewVideo(video)}
                                        className="relative block w-full aspect-video bg-km-surface overflow-hidden cursor-pointer"
                                        aria-label={`Play ${video.title}`}
                                    >
                                        <img
                                            src={video.thumbnail_url || getYouTubeThumbnail(video.youtube_video_id || '')}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                if (video.youtube_video_id) {
                                                    (e.target as HTMLImageElement).src = getYouTubeThumbnail(video.youtube_video_id);
                                                }
                                            }}
                                        />
                                        <span className="absolute inset-0 flex items-center justify-center bg-black/10">
                                            <span className="w-10 h-10 rounded-full bg-white text-[#071A4D] flex items-center justify-center shadow-sm">
                                                <PlayIcon weight="fill" size={16} className="ml-0.5" aria-hidden="true" />
                                            </span>
                                        </span>
                                        {video.duration && (
                                            <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/70 text-white text-xs font-medium font-inter">
                                                {video.duration}
                                            </span>
                                        )}
                                    </button>

                                    <div className="flex-1 p-4">
                                        {video.category && <p className="text-xs font-medium text-km-link mb-1">{video.category}</p>}
                                        <h3 className="text-sm font-semibold text-km-heading line-clamp-2 leading-snug" title={video.title}>
                                            {video.title}
                                        </h3>
                                        {video.description && (
                                            <p className="mt-1.5 text-xs text-km-text-secondary leading-relaxed line-clamp-2">{video.description}</p>
                                        )}
                                        <div className="mt-3 flex items-center justify-between gap-2 text-xs text-km-text-secondary">
                                            {video.expert_id ? (
                                                <Link href={`/profile/${video.expert_id}`} className="font-medium text-km-heading hover:text-km-link hover:underline truncate">
                                                    {video.expert_name || 'Expert'}
                                                </Link>
                                            ) : (
                                                <span className="font-medium truncate">{video.expert_name || 'Kaammilega team'}</span>
                                            )}
                                            <span className="shrink-0 font-inter">
                                                {(video.views || 0).toLocaleString('en-IN')} views · {formatDate(video.created_at)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-1 px-3 py-2 border-t border-km-border-subtle">
                                        <button
                                            type="button"
                                            onClick={() => { setEditingVideo(video); setIsAddEditModalOpen(true); }}
                                            className={`${btn.ghost} h-9 px-3`}
                                        >
                                            <PencilSimpleIcon size={16} aria-hidden="true" />
                                            Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => openYouTubeVideo(video.youtube_video_id || '', video.youtube_url)}
                                            className={`${btn.ghost} h-9 px-3`}
                                        >
                                            <ArrowSquareOutIcon size={16} aria-hidden="true" />
                                            YouTube
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteModalVideo(video)}
                                            className={`${btn.icon} ml-auto hover:text-red-600`}
                                            aria-label={`Delete ${video.title}`}
                                        >
                                            <TrashIcon size={18} aria-hidden="true" />
                                        </button>
                                    </div>
                                </article>
                            ))}
                        </div>

                        {totalPages > 1 && (
                            <div className="flex justify-center pt-6">
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
            </AdminPanel>

            <LearnVideoModal
                isOpen={isAddEditModalOpen}
                onClose={() => {
                    setIsAddEditModalOpen(false);
                    setEditingVideo(null);
                }}
                onSave={handleSaveVideo}
                initialData={editingVideo}
            />

            {deleteModalVideo && (
                <ConfirmDialog
                    title={`Delete "${deleteModalVideo.title}"?`}
                    description="It's removed from the Learn page and from the expert's course list. This can't be undone."
                    confirmLabel="Delete course"
                    busy={isDeleting}
                    onCancel={() => setDeleteModalVideo(null)}
                    onConfirm={handleConfirmDelete}
                />
            )}

            {previewVideo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewVideo(null)}>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="preview-title"
                        className="w-full max-w-3xl bg-km-surface-raised rounded-2xl overflow-hidden shadow-lg border border-km-border"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between gap-4 px-5 py-3.5 border-b border-km-border-subtle">
                            <div className="min-w-0">
                                <h2 id="preview-title" className="text-sm font-semibold text-km-heading truncate">{previewVideo.title}</h2>
                                <p className="text-xs text-km-text-secondary mt-0.5">
                                    {[previewVideo.category, previewVideo.duration].filter(Boolean).join(' · ')}
                                </p>
                            </div>
                            <button type="button" onClick={() => setPreviewVideo(null)} className={btn.icon} aria-label="Close">
                                <XIcon size={18} aria-hidden="true" />
                            </button>
                        </div>

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
                                <div className="w-full h-full flex items-center justify-center text-white text-sm">
                                    This course has no YouTube video.
                                </div>
                            )}
                        </div>

                        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-km-border-subtle">
                            <p className="text-xs text-km-text-secondary">
                                Added by{' '}
                                {previewVideo.expert_id ? (
                                    <Link href={`/profile/${previewVideo.expert_id}`} className="font-medium text-km-heading hover:text-km-link hover:underline">
                                        {previewVideo.expert_name || 'Expert'}
                                    </Link>
                                ) : (
                                    <span className="font-medium text-km-heading">{previewVideo.expert_name || 'Kaammilega team'}</span>
                                )}
                            </p>
                            <button
                                type="button"
                                onClick={() => openYouTubeVideo(previewVideo.youtube_video_id || '', previewVideo.youtube_url)}
                                className="inline-flex items-center gap-1.5 text-sm font-medium text-km-link hover:underline cursor-pointer"
                            >
                                <ArrowSquareOutIcon size={16} aria-hidden="true" />
                                Open in YouTube
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
