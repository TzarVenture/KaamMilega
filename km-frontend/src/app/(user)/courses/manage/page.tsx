"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ArrowLeftIcon, ArrowSquareOutIcon, ClockIcon, EyeIcon, GraduationCapIcon, PencilSimpleIcon, PlayIcon, PlusIcon, TrashIcon, VideoCameraIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import api from "@/lib/axios";
import { openYouTubeVideo, getYouTubeThumbnail } from "@/lib/youtube";
import { COURSE_CATEGORIES, COURSE_LIMITS, countWords, courseId, type MyCoursesPage } from "@/lib/courses";
import { useIsExpert } from "@/lib/useIsExpert";
import { CourseData } from "@/components/km/CourseCard";
import Pagination from "@/components/ui/Pagination";
import { AdminModal, ConfirmDialog, EmptyState, btn, cx, field } from "@/components/admin/ui";

const PAGE_SIZE = 6;

/** 1,234 views reads "1.2K views" */
function views(n = 0): string {
    const count = n >= 1000 ? `${(n / 1000).toFixed(1)}K` : String(n);
    return `${count} ${n === 1 ? "view" : "views"}`;
}

export default function ManageCoursesPage() {
    const isExpert = useIsExpert();
    const [courses, setCourses] = useState<CourseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);
    const [editing, setEditing] = useState<CourseData | null>(null);
    const [deleting, setDeleting] = useState<CourseData | null>(null);
    const [busy, setBusy] = useState(false);

    const fetchMyCourses = useCallback(async (pageNum: number) => {
        try {
            setLoading(true);
            const res = await api.get<unknown, MyCoursesPage>(`/courses/my?page=${pageNum}&limit=${PAGE_SIZE}`);
            setCourses(res.data || []);
            setTotalCount(res.total || 0);
            setTotalPages(res.total_pages || Math.ceil((res.total || 0) / PAGE_SIZE) || 1);
        } catch (err) {
            notify.error(err, "Your courses couldn’t be loaded.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isExpert) fetchMyCourses(page);
    }, [isExpert, page, fetchMyCourses]);

    const confirmDelete = async () => {
        if (!deleting) return;
        setBusy(true);
        try {
            await api.delete(`/courses/${courseId(deleting)}`);
            notify.success("Course deleted.");
            setDeleting(null);
            if (courses.length === 1 && page > 1) setPage((p) => p - 1);
            else fetchMyCourses(page);
        } catch (err) {
            notify.error(err, "The course couldn’t be deleted.");
        } finally {
            setBusy(false);
        }
    };

    if (isExpert === null) {
        return <main className="min-h-screen bg-km-surface" aria-busy="true" />;
    }

    if (!isExpert) {
        return (
            <main className="min-h-screen bg-km-surface pb-20">
                <div className="max-w-3xl mx-auto px-4 pt-16">
                    <div className="km-card">
                        <EmptyState
                            icon={GraduationCapIcon}
                            title="Managing courses is for approved Experts"
                            description="Apply as an Expert to share training videos with learners on KaamMilega."
                            action={<Link href="/expert/apply" className={btn.primary}>Apply as an Expert</Link>}
                        />
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-km-surface py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-8">
                <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-km-border pb-6">
                    <div>
                        <Link href="/courses" className="inline-flex items-center gap-1.5 text-sm font-semibold text-km-link hover:underline mb-3">
                            <ArrowLeftIcon weight="bold" size={14} aria-hidden="true" /> Back to course studio
                        </Link>
                        <p className="flex items-center gap-2 text-[13px] font-semibold text-km-mentors-text mb-1.5">
                            <GraduationCapIcon size={16} weight="bold" aria-hidden="true" /> Expert Portal
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-bold text-km-heading">
                            My courses <span className="text-base font-normal text-km-text-secondary tabular-nums">({totalCount})</span>
                        </h1>
                        <p className="mt-1 text-sm text-km-text-secondary">Edit the details of your training videos or remove ones you no longer want listed.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Link href="/resources" className={btn.secondary}>
                            See them as learners do <ArrowSquareOutIcon size={14} aria-hidden="true" />
                        </Link>
                        <Link href="/courses" className={btn.primary}>
                            <PlusIcon weight="bold" size={16} aria-hidden="true" /> Add a course
                        </Link>
                    </div>
                </header>

                {loading ? (
                    <div className="py-20 flex justify-center items-center" role="status">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-km-link border-t-transparent" aria-hidden="true" />
                        <span className="sr-only">Loading your courses</span>
                    </div>
                ) : courses.length === 0 ? (
                    <div className="km-card">
                        <EmptyState
                            icon={VideoCameraIcon}
                            title="No courses yet"
                            description="Add a YouTube training video and it will show up here."
                            action={<Link href="/courses" className={btn.primary}><PlusIcon weight="bold" size={16} aria-hidden="true" /> Add your first course</Link>}
                        />
                    </div>
                ) : (
                    <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        {courses.map((course) => (
                            <li key={courseId(course)} className="km-card overflow-hidden flex flex-col">
                                <div className="relative w-full aspect-video bg-km-surface overflow-hidden">
                                    <img
                                        src={course.thumbnail_url || getYouTubeThumbnail(course.youtube_video_id)}
                                        alt=""
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                                        <span className="w-10 h-10 bg-white text-[#071A4D] rounded-full flex items-center justify-center shadow-sm">
                                            <PlayIcon weight="fill" size={15} className="ml-0.5" />
                                        </span>
                                    </div>
                                    <span className="absolute bottom-2.5 right-2.5 bg-[#071A4D] text-white text-xs font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                                        <ClockIcon weight="bold" size={12} aria-hidden="true" /> {course.duration || "Length not set"}
                                    </span>
                                </div>

                                <div className="p-4 flex-1 flex flex-col gap-2">
                                    {course.category && <p className="text-xs font-semibold text-km-mentors-text">{course.category}</p>}
                                    <h2 className="text-base font-semibold text-km-heading line-clamp-2 leading-snug">{course.title}</h2>
                                    {course.description && <p className="text-sm text-km-text-secondary line-clamp-2">{course.description}</p>}
                                    <div className="mt-auto pt-2 flex items-center justify-between text-sm text-km-text-secondary">
                                        <span className="flex items-center gap-1.5">
                                            <EyeIcon size={16} aria-hidden="true" /> {views(course.views)}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => openYouTubeVideo(course.youtube_video_id, course.youtube_url)}
                                            className="flex items-center gap-1 font-semibold text-km-link hover:underline"
                                        >
                                            Watch <ArrowSquareOutIcon weight="bold" size={14} aria-hidden="true" />
                                            <span className="sr-only"> {course.title} on YouTube</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="px-4 py-3 border-t border-km-border-subtle flex items-center gap-1">
                                    <button type="button" onClick={() => setEditing(course)} className={btn.ghost}>
                                        <PencilSimpleIcon size={16} aria-hidden="true" /> Edit
                                    </button>
                                    <button type="button" onClick={() => setDeleting(course)} className={cx(btn.ghost, "ml-auto hover:text-red-600")}>
                                        <TrashIcon size={16} aria-hidden="true" /> Delete
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-center pt-4 pb-4">
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

            {editing && (
                <EditCourse
                    course={editing}
                    onClose={() => setEditing(null)}
                    onSaved={(changes) => {
                        setCourses((prev) => prev.map((c) => (courseId(c) === courseId(editing) ? { ...c, ...changes } : c)));
                        setEditing(null);
                    }}
                />
            )}

            {deleting && (
                <ConfirmDialog
                    title="Delete this course?"
                    description={<>“{deleting.title}” will no longer be listed for learners. The video stays on your YouTube channel.</>}
                    confirmLabel="Delete course"
                    busy={busy}
                    onCancel={() => setDeleting(null)}
                    onConfirm={confirmDelete}
                />
            )}
        </main>
    );
}

function EditCourse({ course, onClose, onSaved }: { course: CourseData; onClose: () => void; onSaved: (changes: Partial<CourseData>) => void }) {
    const known = !!course.category && COURSE_CATEGORIES.includes(course.category);
    const [title, setTitle] = useState(course.title);
    const [duration, setDuration] = useState(course.duration || "");
    const [category, setCategory] = useState(known ? course.category! : "Others");
    const [customCategory, setCustomCategory] = useState(known ? "" : course.category || "");
    const [description, setDescription] = useState(course.description || "");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const titleWords = countWords(title);
    const descWords = countWords(description);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        let problem = "";
        if (!title.trim()) problem = "Enter a course title.";
        else if (titleWords > COURSE_LIMITS.titleWords) problem = `Keep the title to ${COURSE_LIMITS.titleWords} words.`;
        else if (!duration.trim()) problem = "Enter how long the video is, for example 45 min.";
        else if (category === "Others" && !customCategory.trim()) problem = "Type the trade this course is for.";
        else if (descWords > COURSE_LIMITS.descriptionWords) problem = `Keep the description to ${COURSE_LIMITS.descriptionWords} words.`;
        setError(problem);
        if (problem) return;

        const changes = {
            title: title.trim(),
            duration: duration.trim(),
            category: category === "Others" ? customCategory.trim() : category,
            description: description.trim(),
        };
        setSaving(true);
        try {
            const updated = await api.put<unknown, Partial<CourseData> | null>(`/courses/${courseId(course)}`, changes);
            notify.success("Course updated.");
            onSaved({ ...changes, ...(updated && typeof updated === "object" ? updated : {}) });
        } catch (err) {
            notify.error(err, "The course couldn’t be updated.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <AdminModal isOpen onClose={() => !saving && onClose()} title="Edit course">
            <form onSubmit={submit} noValidate className="space-y-4">
                <div>
                    <div className="flex items-center justify-between">
                        <label htmlFor="edit-title" className={field.label}>Course title</label>
                        <span className={cx("text-xs", titleWords > COURSE_LIMITS.titleWords ? "text-red-600 font-semibold" : "text-km-text-secondary")}>
                            {titleWords} / {COURSE_LIMITS.titleWords} words
                        </span>
                    </div>
                    <input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} className={field.input} aria-invalid={titleWords > COURSE_LIMITS.titleWords} required autoFocus />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="edit-duration" className={field.label}>Video length</label>
                        <input id="edit-duration" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="45 min" className={field.input} required />
                    </div>
                    <div>
                        <label htmlFor="edit-category" className={field.label}>Trade</label>
                        <select id="edit-category" value={category} onChange={(e) => setCategory(e.target.value)} className={field.input}>
                            {COURSE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                    </div>
                </div>

                {category === "Others" && (
                    <div>
                        <label htmlFor="edit-custom-category" className={field.label}>Your trade</label>
                        <input id="edit-custom-category" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} placeholder="Solar panel technician" className={field.input} required />
                    </div>
                )}

                <div>
                    <div className="flex items-center justify-between">
                        <label htmlFor="edit-description" className={field.label}>
                            What learners will get <span className="font-normal text-km-text-secondary">(optional)</span>
                        </label>
                        <span className={cx("text-xs", descWords > COURSE_LIMITS.descriptionWords ? "text-red-600 font-semibold" : "text-km-text-secondary")}>
                            {descWords} / {COURSE_LIMITS.descriptionWords} words
                        </span>
                    </div>
                    <textarea id="edit-description" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className={cx(field.textarea, "resize-none")} aria-invalid={descWords > COURSE_LIMITS.descriptionWords} />
                </div>

                {error && <p role="alert" className={field.error}>{error}</p>}

                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} disabled={saving} className={btn.secondary}>Cancel</button>
                    <button type="submit" disabled={saving} className={btn.primary}>{saving ? "Saving…" : "Save changes"}</button>
                </div>
            </form>
        </AdminModal>
    );
}
