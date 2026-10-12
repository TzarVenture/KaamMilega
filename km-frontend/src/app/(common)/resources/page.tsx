"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ChevronDown, Video, Loader2 } from "lucide-react";
import { toast } from "react-toastify";
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
            toast.error(error.message || "Failed to load courses");
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
        <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 flex flex-col lg:flex-row gap-8 bg-[#F4F7FB] min-h-screen">
            {/* Left: Video Feed */}
            <div className="flex-1 space-y-6">
                {/* Header Section */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-medium text-[#071A4D] tracking-tight">
                            Learn With <span className="text-[#FF6B00]">Kaammilega</span>
                        </h1>
                        <p className="text-xs sm:text-sm text-[#5B6472] mt-1">
                            Explore verified trade courses, technical modules, and skill certifications taught by industry experts.
                        </p>
                    </div>
                </div>

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
                        <Loader2 size={32} className="animate-spin text-[#0B5ED7]" />
                        <p className="text-xs text-[#5B6472] font-medium">Loading training courses...</p>
                    </div>
                ) : courses.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-dashed border-[#D9E0EA] p-12 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-[#F4F7FB] text-[#5B6472] flex items-center justify-center mx-auto">
                            <Video size={24} />
                        </div>
                        <h3 className="text-base font-bold text-[#111827]">
                            No Courses Found
                        </h3>
                        <p className="text-xs text-[#5B6472] max-w-sm mx-auto">
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
                                className="text-xs font-bold text-[#0B5ED7] hover:underline pt-2"
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
                <div className="sticky top-6 bg-white rounded-3xl p-6 h-100 border border-[#D9E0EA] shadow-xs flex items-center justify-center text-[#5B6472] font-bold text-lg">
                    Ad Banner
                </div>
            </div>
        </div>
    );
}