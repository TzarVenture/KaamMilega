"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ArrowRightIcon, ArrowSquareOutIcon, CircleNotchIcon, ClockIcon, EyeIcon, GraduationCapIcon, PencilSimpleIcon, PlayIcon, PlusIcon, TrashIcon, VideoCameraIcon, WarningIcon, XIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import api from "@/lib/axios";
import { getCurrentUser } from "@/lib/auth";
import { openYouTubeVideo, getYouTubeThumbnail } from "@/lib/youtube";
import { CourseData } from "@/components/km/CourseCard";
import Pagination from "@/components/ui/Pagination";

const CATEGORIES = [
    "Vocational Skills",
    "Technology",
    "Electrician & Electrical",
    "Plumbing & Sanitation",
    "Construction & Carpentry",
    "Hospitality & Culinary",
    "Automotive & Mechanics",
    "Business & Sales",
    "Others",
];

export default function ManageCoursesPage() {
    const router = useRouter();
    const user = getCurrentUser();

    // Check if user is an Expert
    const roles = Array.isArray(user?.roles)
        ? user.roles
        : user?.role
        ? [user.role]
        : [];
    const isExpert = roles.includes("expert");

    const [courses, setCourses] = useState<CourseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Edit Modal State
    const [editingCourse, setEditingCourse] = useState<CourseData | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDuration, setEditDuration] = useState("");
    const [editCategory, setEditCategory] = useState("");
    const [editCustomCategory, setEditCustomCategory] = useState("");
    const [editDescription, setEditDescription] = useState("");
    const [saving, setSaving] = useState(false);

    // Delete Modal State
    const [deletingCourse, setDeletingCourse] = useState<CourseData | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchMyCourses = async (pageNum = 1) => {
        try {
            setLoading(true);
            const res: any = await api.get(`/courses/my?page=${pageNum}&limit=6`);
            setCourses(res.data || []);
            setTotalCount(res.total || 0);
            setTotalPages(res.total_pages || Math.ceil((res.total || 0) / 6) || 1);
        } catch (error: any) {
            console.error("Failed to load courses:", error);
            notify.error(error.message || "Failed to load courses");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isExpert) {
            fetchMyCourses(page);
        }
    }, [isExpert, page]);

    // Open Edit Modal
    const handleOpenEdit = (course: CourseData) => {
        setEditingCourse(course);
        setEditTitle(course.title);
        setEditDuration(course.duration);
        const cat = course.category || "";
        if (cat && CATEGORIES.includes(cat)) {
            setEditCategory(cat);
            setEditCustomCategory("");
        } else {
            setEditCategory("Others");
            setEditCustomCategory(cat);
        }
        setEditDescription(course.description || "");
    };

    // Save Updates
    const handleSaveEdit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCourse) return;

        const courseId = editingCourse.id || (editingCourse as any)._id;
        if (!courseId) {
            notify.error("Course ID not found");
            return;
        }

        if (!editTitle.trim()) {
            notify.error("Course title cannot be empty");
            return;
        }

        const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
        if (countWords(editTitle) > 10) {
            notify.error("Course title cannot exceed 10 words");
            return;
        }

        if (countWords(editDescription) > 50) {
            notify.error("Course description cannot exceed 50 words");
            return;
        }

        const finalCategory = editCategory === "Others" ? editCustomCategory.trim() || "Others" : editCategory;

        setSaving(true);
        try {
            const payload = {
                title: editTitle.trim(),
                duration: editDuration.trim(),
                category: finalCategory,
                description: editDescription.trim(),
            };

            const updated: any = await api.put(`/courses/${courseId}`, payload);
            notify.success("Course updated successfully!");

            setCourses((prev) =>
                prev.map((c) => {
                    const cId = c.id || (c as any)._id;
                    return cId === courseId ? { ...c, ...payload, ...updated } : c;
                })
            );
            setEditingCourse(null);
        } catch (error: any) {
            console.error("Update error:", error);
            notify.error(error.message || "Failed to update course");
        } finally {
            setSaving(false);
        }
    };

    // Delete Confirmation
    const handleConfirmDelete = async () => {
        if (!deletingCourse) return;

        const courseId = deletingCourse.id || (deletingCourse as any)._id;
        if (!courseId) return;

        setDeleting(true);
        try {
            await api.delete(`/courses/${courseId}`);
            notify.success("Course deleted successfully!");
            setDeletingCourse(null);
            if (courses.length === 1 && page > 1) {
                setPage((prev) => prev - 1);
            } else {
                fetchMyCourses(page);
            }
        } catch (error: any) {
            console.error("Delete error:", error);
            notify.error(error.message || "Failed to delete course");
        } finally {
            setDeleting(false);
        }
    };

    if (!isExpert) {
        return (
            <div className="min-h-screen bg-km-surface py-12 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
                <div className="max-w-md w-full bg-km-surface-card rounded-3xl p-8 border border-km-border shadow-lg text-center space-y-5">
                    <GraduationCapIcon size={36} weight="duotone" className="text-[#7C3AED] mx-auto dark:text-violet-400" aria-hidden="true" />
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-km-heading">
                            Expert Portal Only
                        </h2>
                        <p className="text-sm text-km-text-secondary leading-relaxed">
                            Only verified Kaammilega Experts can manage video training courses.
                        </p>
                    </div>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => router.push("/expert/apply")}
                            className="w-full bg-[#071A4D] hover:bg-[#0B1F52] text-white font-semibold py-3.5 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm dark:bg-km-primary dark:hover:bg-km-primary-dark"
                        >
                            <span>Apply to Become an Expert</span>
                            <ArrowRightIcon weight="bold" size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-km-surface py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* ─── Top Bar ─── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-km-border pb-6">
                    <div className="space-y-1">
                        <button
                            type="button"
                            onClick={() => router.push("/courses")}
                            className="text-xs font-bold text-km-link hover:underline flex items-center gap-1.5 mb-1"
                        >
                            <ArrowLeftIcon weight="bold" size={14} /> Back to Course Studio
                        </button>
                        <h1 className="text-2xl sm:text-3xl font-medium text-km-heading tracking-tight">
                            Manage All My Courses
                        </h1>
                        <p className="text-xs sm:text-sm text-km-text-secondary">
                            Edit titles, durations, categories, or remove your uploaded training sessions.
                        </p>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            onClick={() => router.push("/courses")}
                            className="bg-[#071A4D] hover:bg-[#0B1F52] text-white font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-1.5 active:scale-[0.98] dark:bg-km-primary dark:hover:bg-km-primary-dark"
                        >
                            <PlusIcon weight="bold" size={16} />
                            <span>Add New Course</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => router.push("/resources")}
                            className="bg-km-surface-card border border-km-border hover:border-[#0B5ED7]/50 text-km-heading font-bold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-xs transition-all"
                        >
                            <span>Public View</span>
                        </button>
                    </div>
                </div>

                {/* ─── Courses List ─── */}
                {loading ? (
                    <div className="py-20 flex flex-col justify-center items-center space-y-3">
                        <CircleNotchIcon size={32} className="animate-spin text-km-link" />
                        <p className="text-xs text-km-text-secondary font-medium">Loading your courses...</p>
                    </div>
                ) : courses.length === 0 ? (
                    <div className="bg-km-surface-card rounded-3xl border border-dashed border-km-border p-12 text-center space-y-4">
                        <VideoCameraIcon size={36} weight="duotone" className="text-km-text-secondary mx-auto" aria-hidden="true" />
                        <div className="space-y-1">
                            <h3 className="text-lg font-bold text-km-text-primary">
                                No Courses Published Yet
                            </h3>
                            <p className="text-xs text-km-text-secondary max-w-sm mx-auto">
                                You haven't added any video courses yet. Click the button below to add your first YouTube video training.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => router.push("/courses")}
                            className="inline-flex items-center gap-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white font-bold text-xs px-5 py-2.5 rounded-xl shadow-xs transition-all dark:bg-km-primary dark:hover:bg-km-primary-dark"
                        >
                            <PlusIcon weight="bold" size={16} /> Add Your First Course
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {courses.map((course, idx) => {
                            const formattedViews = (course.views || 0) >= 1000 
                                ? `${((course.views || 0) / 1000).toFixed(1)}K` 
                                : String(course.views || 0);

                            return (
                                <div
                                    key={course.id}
                                    className="bg-km-surface-card rounded-2xl border border-km-border overflow-hidden shadow-xs hover:border-[#0B5ED7]/40 hover:shadow-md transition-all flex flex-col justify-between"
                                >
                                    <div>
                                        {/* Thumbnail Box */}
                                        <div className="relative w-full h-44 bg-slate-100 overflow-hidden">
                                            <img
                                                src={course.thumbnail_url || getYouTubeThumbnail(course.youtube_video_id)}
                                                alt={course.title}
                                                className="w-full h-full object-cover"
                                            />

                                            {/* Category Badge on Top-Left matching reference screenshot */}
                                            {course.category && (
                                                <span className="absolute top-0 left-0 bg-[#071A4D] text-white text-xs font-semibold px-3.5 py-1.5 rounded-tl-xl rounded-br-2xl shadow-xs z-10 dark:bg-km-primary">
                                                    {course.category}
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
                                                <ClockIcon weight="bold" size={11} /> {course.duration || "30 Min"}
                                            </span>
                                        </div>

                                        {/* Info */}
                                        <div className="p-4 space-y-2">
                                            <h3 className="text-sm font-bold text-km-text-primary line-clamp-2 leading-snug">
                                                {course.title}
                                            </h3>

                                            {course.description && (
                                                <p className="text-xs text-km-text-secondary line-clamp-2 leading-relaxed">
                                                    {course.description}
                                                </p>
                                            )}

                                            <div className="flex items-center justify-between pt-2 border-t border-km-border/60 text-xs text-km-text-secondary">
                                                <div className="flex items-center gap-1 font-bold text-km-heading">
                                                    <EyeIcon weight="bold" size={13} className="text-km-link" />
                                                    <span>{formattedViews} Viewers</span>
                                                </div>

                                                <button
                                                    type="button"
                                                    onClick={() => openYouTubeVideo(course.youtube_video_id, course.youtube_url)}
                                                    className="text-[#FF6B00] hover:underline flex items-center gap-1 font-semibold"
                                                >
                                                    <span>Watch</span>
                                                    <ArrowSquareOutIcon weight="bold" size={11} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action Buttons: Edit and Delete */}
                                    <div className="p-3 bg-km-surface/70 border-t border-km-border flex items-center justify-between gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleOpenEdit(course)}
                                            className="flex-1 py-2 px-3 bg-km-surface-card hover:bg-blue-50 border border-km-border hover:border-[#0B5ED7]/50 text-km-heading hover:text-km-link rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs"
                                        >
                                            <PencilSimpleIcon weight="bold" size={13} />
                                            <span>Edit</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setDeletingCourse(course)}
                                            className="flex-1 py-2 px-3 bg-km-surface-card hover:bg-red-50 border border-km-border hover:border-red-300 text-red-600 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-2xs dark:text-red-400"
                                        >
                                            <TrashIcon weight="bold" size={13} />
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center pt-8 pb-4">
                        <Pagination
                            current={page}
                            total={totalPages}
                            onPageChange={(p) => {
                                setPage(p);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                        />
                    </div>
                )}

            </div>

            {/* ─── Edit Course Modal ─── */}
            {editingCourse && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-km-surface-card rounded-3xl max-w-lg w-full p-6 sm:p-8 border border-km-border shadow-2xl space-y-5 animate-in fade-in zoom-in duration-150">
                        <div className="flex items-center justify-between border-b border-km-border pb-4">
                            <div className="flex items-center gap-2">
                                <PencilSimpleIcon size={20} className="text-km-link" aria-hidden="true" />
                                <h3 className="text-lg font-bold text-km-heading">
                                    Update Course Details
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setEditingCourse(null)}
                                className="p-1.5 text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface rounded-full transition"
                            >
                                <XIcon weight="bold" size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSaveEdit} className="space-y-4">
                            {/* Course Title with word counter */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-semibold text-km-heading">
                                        Course Title <span className="text-[#FF6B00]">*</span>
                                    </label>
                                    <span className={`text-[11px] ${editTitle.trim().split(/\s+/).filter(Boolean).length > 10 ? "text-red-500 font-semibold dark:text-red-400" : "text-km-text-secondary"}`}>
                                        {editTitle.trim().split(/\s+/).filter(Boolean).length} / 10 words
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={editTitle}
                                    onChange={(e) => setEditTitle(e.target.value)}
                                    className={`w-full px-4 py-2.5 bg-km-surface-card border rounded-xl text-sm text-km-text-primary focus:outline-hidden ${
                                        editTitle.trim().split(/\s+/).filter(Boolean).length > 10
                                            ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                            : "border-km-border focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10"
                                    }`}
                                />
                                {editTitle.trim().split(/\s+/).filter(Boolean).length > 10 && (
                                    <p className="text-[11px] text-red-500 dark:text-red-400">
                                        Title cannot exceed 10 words.
                                    </p>
                                )}
                            </div>

                            {/* Video Duration */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-km-heading">
                                    Video Duration <span className="text-[#FF6B00]">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={editDuration}
                                    onChange={(e) => setEditDuration(e.target.value)}
                                    placeholder="e.g. 45 Min"
                                    className="w-full px-4 py-2.5 bg-km-surface-card border border-km-border rounded-xl text-sm text-km-text-primary focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10"
                                />
                            </div>

                            {/* Category / Trade */}
                            <div className="space-y-1">
                                <label className="block text-xs font-semibold text-km-heading">
                                    Category / Trade <span className="text-[#FF6B00]">*</span>
                                </label>
                                <select
                                    value={editCategory}
                                    onChange={(e) => setEditCategory(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-km-surface-card border border-km-border rounded-xl text-sm text-km-text-primary focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10 cursor-pointer"
                                >
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                                {editCategory === "Others" && (
                                    <div className="pt-2 animate-in fade-in duration-200">
                                        <input
                                            type="text"
                                            value={editCustomCategory}
                                            onChange={(e) => setEditCustomCategory(e.target.value)}
                                            placeholder="Write your custom trade / category..."
                                            required
                                            className="w-full px-4 py-2.5 bg-km-surface-card border border-[#0B5ED7]/40 rounded-xl text-sm text-km-text-primary placeholder:text-gray-400 focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10"
                                        />
                                    </div>
                                )}
                            </div>

                            {/* Description & Highlights with word counter */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-semibold text-km-heading">
                                        Course Description & Highlights
                                    </label>
                                    <span className={`text-[11px] ${editDescription.trim().split(/\s+/).filter(Boolean).length > 50 ? "text-red-500 font-semibold dark:text-red-400" : "text-km-text-secondary"}`}>
                                        {editDescription.trim().split(/\s+/).filter(Boolean).length} / 50 words
                                    </span>
                                </div>
                                <textarea
                                    rows={3}
                                    value={editDescription}
                                    onChange={(e) => setEditDescription(e.target.value)}
                                    className={`w-full px-4 py-2.5 bg-km-surface-card border rounded-xl text-sm text-km-text-primary focus:outline-hidden resize-none ${
                                        editDescription.trim().split(/\s+/).filter(Boolean).length > 50
                                            ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                            : "border-km-border focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10"
                                    }`}
                                />
                                {editDescription.trim().split(/\s+/).filter(Boolean).length > 50 && (
                                    <p className="text-[11px] text-red-500 dark:text-red-400">
                                        Description cannot exceed 50 words.
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-km-border">
                                <button
                                    type="button"
                                    onClick={() => setEditingCourse(null)}
                                    className="px-4 py-2.5 text-xs font-bold text-km-text-secondary hover:bg-km-surface rounded-xl transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2.5 bg-[#071A4D] hover:bg-[#0B1F52] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                >
                                    {saving && <CircleNotchIcon weight="bold" size={14} className="animate-spin" />}
                                    <span>{saving ? "Saving Changes..." : "Save Updates"}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ─── Delete Confirmation Modal ─── */}
            {deletingCourse && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-km-surface-card rounded-3xl max-w-sm w-full p-6 border border-km-border shadow-2xl text-center space-y-4">
                        <WarningIcon size={28} weight="duotone" className="text-red-600 mx-auto dark:text-red-400" aria-hidden="true" />
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-km-text-primary">
                                Delete This Course?
                            </h3>
                            <p className="text-xs text-km-text-secondary leading-relaxed">
                                Are you sure you want to remove <span className="font-semibold text-km-text-primary">"{deletingCourse.title}"</span>? This video will no longer appear in the Kaammilega Marketplace.
                            </p>
                        </div>
                        <div className="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeletingCourse(null)}
                                className="flex-1 py-2.5 px-4 text-xs font-bold text-km-text-secondary bg-km-surface hover:bg-gray-200 rounded-xl transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                                className="flex-1 py-2.5 px-4 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition flex items-center justify-center gap-1.5"
                            >
                                {deleting && <CircleNotchIcon weight="bold" size={13} className="animate-spin" />}
                                <span>{deleting ? "Deleting..." : "Yes, Delete"}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
