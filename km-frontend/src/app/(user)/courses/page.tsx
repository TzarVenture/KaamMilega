"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ArrowRightIcon, ArrowSquareOutIcon, CaretLeftIcon, CaretRightIcon, CheckCircleIcon, GraduationCapIcon, PlayIcon, UploadSimpleIcon, VideoCameraIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import api from "@/lib/axios";
import { extractYouTubeVideoId, getYouTubeThumbnail } from "@/lib/youtube";
import { COURSE_CATEGORIES, COURSE_LIMITS, countWords, type MyCoursesPage } from "@/lib/courses";
import { useIsExpert } from "@/lib/useIsExpert";
import CourseCard, { CourseData } from "@/components/km/CourseCard";
import PageHero, { HeroAccent } from '@/components/km/PageHero';
import { EmptyState, btn, cx, field } from "@/components/admin/ui";

export default function CoursesExpertStudioPage() {
    const isExpert = useIsExpert();

    // Form state
    const [title, setTitle] = useState("");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [duration, setDuration] = useState("");
    const [category, setCategory] = useState(COURSE_CATEGORIES[0]);
    const [customCategory, setCustomCategory] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    // Expert's own courses
    const [myCourses, setMyCourses] = useState<CourseData[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [totalCourses, setTotalCourses] = useState(0);

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const scrollBy = (left: number) => scrollContainerRef.current?.scrollBy({ left, behavior: "smooth" });

    const videoId = youtubeUrl.trim() ? extractYouTubeVideoId(youtubeUrl) : null;
    const titleWords = countWords(title);
    const descWords = countWords(description);

    const fetchMyCourses = useCallback(async () => {
        try {
            setLoadingCourses(true);
            const res = await api.get<unknown, MyCoursesPage>("/courses/my?limit=5");
            setMyCourses(res.data || []);
            setTotalCourses(res.total || (res.data ? res.data.length : 0));
        } catch (err) {
            notify.error(err, "Your courses couldn’t be loaded.");
        } finally {
            setLoadingCourses(false);
        }
    }, []);

    useEffect(() => {
        if (isExpert) fetchMyCourses();
    }, [isExpert, fetchMyCourses]);

    const check = (): string => {
        if (!title.trim()) return "Enter a course title.";
        if (titleWords > COURSE_LIMITS.titleWords) return `Keep the title to ${COURSE_LIMITS.titleWords} words.`;
        if (!videoId) return "Paste a YouTube video link.";
        if (!duration.trim()) return "Enter how long the video is, for example 45 min.";
        if (category === "Others" && !customCategory.trim()) return "Type the trade this course is for.";
        if (descWords > COURSE_LIMITS.descriptionWords) return `Keep the description to ${COURSE_LIMITS.descriptionWords} words.`;
        return "";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const problem = check();
        setError(problem);
        if (problem) return;

        setSubmitting(true);
        try {
            const created = await api.post<unknown, CourseData | null>("/courses", {
                title: title.trim(),
                youtube_url: youtubeUrl.trim(),
                duration: duration.trim(),
                category: category === "Others" ? customCategory.trim() : category,
                description: description.trim(),
            });
            notify.success("Course published. Learners can watch it now.");

            setTitle("");
            setYoutubeUrl("");
            setDuration("");
            setDescription("");
            setCategory(COURSE_CATEGORIES[0]);
            setCustomCategory("");

            if (created && created.id) {
                setMyCourses((prev) => [created, ...prev.slice(0, 4)]);
                setTotalCourses((prev) => prev + 1);
            } else {
                fetchMyCourses();
            }
        } catch (err) {
            notify.error(err, "The course couldn’t be published. Please try again.");
        } finally {
            setSubmitting(false);
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
                            title="Publishing courses is for approved Experts"
                            description="Apply as an Expert to share training videos with learners on KaamMilega."
                            action={<Link href="/expert/apply" className={btn.primary}>Apply as an Expert</Link>}
                        />
                    </div>
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-km-surface pb-20 font-sans">
            <PageHero
                width="max-w-6xl"
                kicker={{ label: "Expert Portal", Icon: GraduationCapIcon, tone: "experts" }}
                title={<>Share your skills as <HeroAccent>courses</HeroAccent></>}
                description="Add your YouTube training videos so learners can find them on KaamMilega."
                aside={
                    <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                        <Link href="/courses/manage" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-white text-sm font-semibold text-white hover:bg-[#0B1F52] transition-colors">
                            Manage my courses
                        </Link>
                        <Link href="/resources" className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl bg-white text-sm font-semibold text-[#071A4D] hover:bg-[#F4F7FB] transition-colors">
                            See them as learners do
                            <ArrowSquareOutIcon weight="bold" size={14} aria-hidden="true" />
                        </Link>
                    </div>
                }
            />

            <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 sm:pt-10 space-y-8">
                <section aria-labelledby="new-course-title" className="km-card p-6 sm:p-8 space-y-6">
                    <div className="flex items-center gap-3 border-b border-km-border-subtle pb-4">
                        <span className="w-10 h-10 rounded-xl bg-km-surface flex items-center justify-center shrink-0" aria-hidden="true">
                            <VideoCameraIcon size={20} className="text-km-mentors-text" />
                        </span>
                        <div>
                            <h2 id="new-course-title" className="text-lg font-semibold text-km-heading">Add a course video</h2>
                            <p className="text-sm text-km-text-secondary">Paste the YouTube link and we’ll use the video’s own thumbnail.</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} noValidate className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            <div className="md:col-span-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="course-title" className={field.label}>Course title</label>
                                    <span className={cx("text-xs", titleWords > COURSE_LIMITS.titleWords ? "text-red-600 font-semibold" : "text-km-text-secondary")}>
                                        {titleWords} / {COURSE_LIMITS.titleWords} words
                                    </span>
                                </div>
                                <input
                                    id="course-title"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="House wiring and safety for beginners"
                                    className={field.input}
                                    aria-invalid={titleWords > COURSE_LIMITS.titleWords}
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="course-url" className={field.label}>YouTube link</label>
                                <input
                                    id="course-url"
                                    type="url"
                                    inputMode="url"
                                    value={youtubeUrl}
                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=…"
                                    className={field.input}
                                    aria-describedby="course-url-hint"
                                    required
                                />
                                <p id="course-url-hint" className={field.hint}>Watch links, youtu.be links and Shorts all work.</p>
                            </div>

                            <div>
                                <label htmlFor="course-duration" className={field.label}>Video length</label>
                                <input
                                    id="course-duration"
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    placeholder="45 min"
                                    className={field.input}
                                    required
                                />
                            </div>

                            <div>
                                <label htmlFor="course-category" className={field.label}>Trade</label>
                                <select id="course-category" value={category} onChange={(e) => setCategory(e.target.value)} className={field.input}>
                                    {COURSE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                                </select>
                            </div>

                            {category === "Others" && (
                                <div>
                                    <label htmlFor="course-custom-category" className={field.label}>Your trade</label>
                                    <input
                                        id="course-custom-category"
                                        value={customCategory}
                                        onChange={(e) => setCustomCategory(e.target.value)}
                                        placeholder="Solar panel technician"
                                        className={field.input}
                                        required
                                    />
                                </div>
                            )}

                            <div className="md:col-span-2">
                                <div className="flex items-center justify-between">
                                    <label htmlFor="course-description" className={field.label}>
                                        What learners will get <span className="font-normal text-km-text-secondary">(optional)</span>
                                    </label>
                                    <span className={cx("text-xs", descWords > COURSE_LIMITS.descriptionWords ? "text-red-600 font-semibold" : "text-km-text-secondary")}>
                                        {descWords} / {COURSE_LIMITS.descriptionWords} words
                                    </span>
                                </div>
                                <textarea
                                    id="course-description"
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Which tools you need, the steps covered and the safety checks."
                                    className={cx(field.textarea, "resize-none")}
                                    aria-invalid={descWords > COURSE_LIMITS.descriptionWords}
                                />
                            </div>
                        </div>

                        {videoId ? (
                            <div className="p-4 rounded-2xl border border-km-border bg-km-surface flex flex-col sm:flex-row items-center gap-4">
                                <div className="relative w-full sm:w-44 aspect-video rounded-xl overflow-hidden bg-km-border shrink-0">
                                    <img src={getYouTubeThumbnail(videoId)} alt="Thumbnail of the linked video" className="w-full h-full object-cover" />
                                    <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
                                        <span className="w-9 h-9 rounded-full bg-black/60 flex items-center justify-center">
                                            <PlayIcon weight="fill" size={16} className="text-white" />
                                        </span>
                                    </div>
                                </div>
                                <p className="flex items-center gap-2 text-sm text-km-heading">
                                    <CheckCircleIcon weight="bold" size={16} className="text-emerald-600 shrink-0" aria-hidden="true" />
                                    Video found. This thumbnail is what learners will see.
                                </p>
                            </div>
                        ) : youtubeUrl.trim() ? (
                            <p className="flex items-center gap-2 text-sm text-red-600" role="status">
                                <WarningCircleIcon weight="bold" size={16} className="shrink-0" aria-hidden="true" />
                                This doesn’t look like a YouTube video link. Copy it from the video’s Share button.
                            </p>
                        ) : null}

                        {error && <p role="alert" className={field.error}>{error}</p>}

                        <div className="flex justify-end pt-1">
                            <button type="submit" disabled={submitting} className={cx(btn.primary, "w-full sm:w-auto")}>
                                <UploadSimpleIcon weight="bold" size={16} aria-hidden="true" />
                                {submitting ? "Publishing…" : "Publish course"}
                            </button>
                        </div>
                    </form>
                </section>

                <section aria-labelledby="my-courses-title" className="space-y-4">
                    <div className="flex items-center justify-between gap-2 px-1">
                        <h2 id="my-courses-title" className="text-lg md:text-xl font-semibold text-km-heading truncate">
                            My courses <span className="text-sm font-normal text-km-text-secondary tabular-nums">({totalCourses})</span>
                        </h2>
                        <Link href="/courses/manage" className={cx(btn.secondary, "shrink-0")}>
                            See all <ArrowRightIcon weight="bold" size={14} aria-hidden="true" />
                        </Link>
                    </div>

                    {loadingCourses ? (
                        <div className="py-12 flex justify-center items-center" role="status">
                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-km-link border-t-transparent" aria-hidden="true" />
                            <span className="sr-only">Loading your courses</span>
                        </div>
                    ) : myCourses.length === 0 ? (
                        <div className="km-card">
                            <EmptyState
                                icon={VideoCameraIcon}
                                title="No courses yet"
                                description="Use the form above to add your first training video."
                            />
                        </div>
                    ) : (
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => scrollBy(-360)}
                                aria-label="Scroll left"
                                className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-km-surface-card text-km-heading hover:bg-km-surface border border-km-border shadow-md items-center justify-center transition-colors"
                            >
                                <CaretLeftIcon weight="bold" size={18} aria-hidden="true" />
                            </button>

                            <div ref={scrollContainerRef} className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory km-horizontal-scrollbar">
                                {myCourses.map((c, idx) => (
                                    <CourseCard key={c.id} course={c} compact isOwner orderNumber={idx + 1} />
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={() => scrollBy(360)}
                                aria-label="Scroll right"
                                className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-km-surface-card text-km-heading hover:bg-km-surface border border-km-border shadow-md items-center justify-center transition-colors"
                            >
                                <CaretRightIcon weight="bold" size={18} aria-hidden="true" />
                            </button>
                        </div>
                    )}
                </section>
            </div>
        </main>
    );
}
