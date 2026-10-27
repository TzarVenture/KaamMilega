"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CircleNotchIcon, VideoCameraIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import api from "@/lib/axios";
import { getCurrentUser } from "@/lib/auth";
import { openYouTubeVideo } from "@/lib/youtube";
import CourseCard, { CourseData } from "@/components/km/CourseCard";
import CourseSearchBar from "@/components/km/CourseSearchBar";
import Pagination from "@/components/ui/Pagination";

export default function ResourcePage() {
    const user = getCurrentUser();
    const currentUserId = user?.id || (user as any)?._id || "";

    const [courses, setCourses] = useState<CourseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState("All");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Fetch courses from backend (limit=6)
    const fetchCourses = useCallback(async (pageNum: number, search: string, cat: string) => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            params.set("page", String(pageNum));
            params.set("limit", "6");
            if (search.trim()) {
                params.set("search", search.trim());
            }
            if (cat && cat !== "All") {
                params.set("category", cat);
            }

            const res: any = await api.get(`/courses?${params.toString()}`);
            const fetched: CourseData[] = res.data || [];
            const total = res.total || 0;
            setTotalCount(total);
            setTotalPages(res.total_pages || Math.ceil(total / 6) || 1);
            setCourses(fetched);
        } catch (error: any) {
            console.error("Failed to load courses:", error);
            notify.error(error.message || "Failed to load courses");
        } finally {
            setLoading(false);
        }
    }, []);

    // Initial load and filter change with debounce
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            fetchCourses(1, searchQuery, selectedCategory);
        }, 300);

        return () => clearTimeout(timer);
    }, [searchQuery, selectedCategory, fetchCourses]);

    // Handle Page Change
    const handlePageChange = (newPage: number) => {
        setPage(newPage);
        fetchCourses(newPage, searchQuery, selectedCategory);
        window.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Handle course click: Record view on server, open YouTube app/browser, optimistically update UI
    const handleWatchCourse = async (course: CourseData) => {
        // Optimistically check if viewer is NOT the uploader
        const isUploader = currentUserId && String(course.expert_id) === String(currentUserId);

        // Call backend view endpoint (backend enforces anti-self-count verification)
        api.post(`/courses/${course.id}/view`)
            .then((res: any) => {
                if (res && typeof res.views === "number") {
                    setCourses((prev) =>
                        prev.map((c) => (c.id === course.id ? { ...c, views: res.views } : c))
                    );
                }
            })
            .catch((err) => {
                console.error("View count increment error:", err);
            });

        // Optimistic UI update if viewer is not the uploader
        if (!isUploader) {
            setCourses((prev) =>
                prev.map((c) => (c.id === course.id ? { ...c, views: (c.views || 0) + 1 } : c))
            );
        }

        // Open YouTube app on mobile (deep-link) or browser tab on desktop
        openYouTubeVideo(course.youtube_video_id, course.youtube_url);
    };

    return (
        <main className="min-h-screen bg-km-surface pb-20 font-sans">
            {/* ─── Hero Section with Resources Art & Rounded Bottom ─── */}
            <section className="bg-[#071A4D] border-b border-[#0B1F52] text-white pt-8 sm:pt-10 lg:pt-12 pb-6 sm:pb-8 lg:pb-10 rounded-b-[32px] sm:rounded-b-[44px] lg:rounded-b-[52px] relative overflow-hidden dark:border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-8 lg:gap-10 items-center">
                        {/* Left Column: Headlines & Description */}
                        <div className="md:col-span-7 xl:col-span-7 text-left py-2 sm:py-4">
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-[1.15]">
                                Learn With <span className="text-[#FF6B00]">Kaammilega</span>
                            </h1>
                            <p className="mt-3.5 text-sm sm:text-base text-white/80 max-w-xl font-normal leading-relaxed">
                                Explore verified trade courses, technical modules, and skill certifications taught by industry experts.
                            </p>
                        </div>

                        {/* Right Column: Hero Artwork */}
                        <div className="md:col-span-5 xl:col-span-5 flex items-center justify-center md:justify-end">
                            <div className="relative flex items-center justify-center md:justify-end w-full max-w-[360px] md:max-w-[440px] lg:max-w-[500px]">
                                <img
                                    src="/resources-page.png"
                                    alt="Learn With Kaammilega"
                                    className="w-full h-auto max-h-[260px] md:max-h-[300px] lg:max-h-[340px] object-contain select-none pointer-events-none drop-shadow-xl block"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Main Content Area: Video Feed + Sidebar ─── */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 flex flex-col lg:flex-row gap-8">
                {/* Left: Video Feed */}
                <div className="flex-1 space-y-6">
                    {/* Top Search Bar (Categories Row Removed) */}
                    <CourseSearchBar
                        value={searchQuery}
                        onChange={setSearchQuery}
                        onClear={() => setSearchQuery("")}
                        selectedCategory={selectedCategory}
                        onSelectCategory={setSelectedCategory}
                        showCategories={false}
                    />

                {/* Courses Feed */}
                {loading ? (
                    <div className="py-20 flex flex-col justify-center items-center space-y-3">
                        <CircleNotchIcon size={32} className="animate-spin text-km-link" />
                        <p className="text-xs text-km-text-secondary font-medium">Loading training courses...</p>
                    </div>
                ) : courses.length === 0 ? (
                    <div className="bg-km-surface-card rounded-2xl border border-dashed border-km-border p-12 text-center space-y-3">
                        <VideoCameraIcon size={32} weight="duotone" className="text-km-text-secondary mx-auto" aria-hidden="true" />
                        <h3 className="text-base font-bold text-km-text-primary">
                            No Courses Found
                        </h3>
                        <p className="text-xs text-km-text-secondary max-w-sm mx-auto">
                            {searchQuery || selectedCategory !== "All"
                                ? "No courses matched your search query. Try clearing your search."
                                : "No courses have been published yet. Check back soon for new training sessions."}
                        </p>
                        {(searchQuery || selectedCategory !== "All") && (
                            <button
                                type="button"
                                onClick={() => {
                                    setSearchQuery("");
                                    setSelectedCategory("All");
                                }}
                                className="text-xs font-bold text-km-link hover:underline pt-2"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        {courses.map((course) => (
                            <CourseCard
                                key={course.id}
                                course={course}
                                onViewClick={handleWatchCourse}
                                isOwner={currentUserId === String(course.expert_id)}
                            />
                        ))}
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="flex justify-center pt-8 pb-10">
                        <Pagination
                            current={page}
                            total={totalPages}
                            onPageChange={handlePageChange}
                        />
                    </div>
                )}
            </div>

            {/* Right: Sidebar Ad Banner (Preserved 100% as requested) */}
            <div className="hidden lg:block w-80 shrink-0">
                <div className="sticky top-6 bg-km-surface-card rounded-3xl p-6 h-100 border border-km-border shadow-xs flex items-center justify-center text-km-text-secondary font-bold text-lg">
                    Ad Banner
                </div>
            </div>
        </div>
    </main>
);
}