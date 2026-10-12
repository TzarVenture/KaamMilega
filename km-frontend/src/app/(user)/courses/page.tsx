"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { 
    Video, 
    Upload, 
    CheckCircle2, 
    AlertCircle, 
    Sparkles, 
    ArrowRight, 
    GraduationCap, 
    Play, 
    ChevronRight,
    ChevronLeft,
    Loader2,
    ExternalLink
} from "lucide-react";
import { toast } from "react-toastify";
import api from "@/lib/axios";
import { getCurrentUser } from "@/lib/auth";
import { 
    extractYouTubeVideoId, 
    getYouTubeThumbnail, 
    openYouTubeVideo 
} from "@/lib/youtube";
import CourseCard, { CourseData } from "@/components/km/CourseCard";

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

export default function CoursesExpertStudioPage() {
    const router = useRouter();
    const user = getCurrentUser();

    // Check if user is an Expert
    const roles = Array.isArray(user?.roles)
        ? user.roles
        : user?.role
        ? [user.role]
        : [];
    const isExpert = roles.includes("expert");

    // Form state
    const [title, setTitle] = useState("");
    const [youtubeUrl, setYoutubeUrl] = useState("");
    const [duration, setDuration] = useState("");
    const [category, setCategory] = useState(CATEGORIES[0]);
    const [customCategory, setCustomCategory] = useState("");
    const [description, setDescription] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // YouTube preview state
    const [extractedVideoId, setExtractedVideoId] = useState<string | null>(null);

    // Expert's own courses state
    const [myCourses, setMyCourses] = useState<CourseData[]>([]);
    const [loadingCourses, setLoadingCourses] = useState(true);
    const [totalCourses, setTotalCourses] = useState(0);

    // Horizontal Scroll ref & handlers
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const handleScrollLeft = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: -360, behavior: "smooth" });
        }
    };

    const handleScrollRight = () => {
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollBy({ left: 360, behavior: "smooth" });
        }
    };

    // Live YouTube link parsing
    useEffect(() => {
        if (!youtubeUrl.trim()) {
            setExtractedVideoId(null);
            return;
        }
        const id = extractYouTubeVideoId(youtubeUrl);
        setExtractedVideoId(id);
    }, [youtubeUrl]);

    // Fetch Expert's own uploaded courses
    const fetchMyCourses = async () => {
        try {
            setLoadingCourses(true);
            const res: any = await api.get("/courses/my?limit=5");
            setMyCourses(res.data || []);
            setTotalCourses(res.total || (res.data ? res.data.length : 0));
        } catch (error: any) {
            console.error("Failed to load courses:", error);
        } finally {
            setLoadingCourses(false);
        }
    };

    useEffect(() => {
        if (isExpert) {
            fetchMyCourses();
        }
    }, [isExpert]);

    // Word count helpers
    const countWords = (text: string) => text.trim().split(/\s+/).filter(Boolean).length;
    const titleWordCount = countWords(title);
    const descWordCount = countWords(description);

    // Handle course creation
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!title.trim()) {
            toast.error("Please enter a course title");
            return;
        }

        if (titleWordCount > 10) {
            toast.error("Course title cannot exceed 10 words");
            return;
        }

        if (descWordCount > 50) {
            toast.error("Course description cannot exceed 50 words");
            return;
        }

        if (!extractedVideoId) {
            toast.error("Please provide a valid YouTube video URL");
            return;
        }

        if (!duration.trim()) {
            toast.error("Please enter the video duration (e.g. 30 Min)");
            return;
        }

        const finalCategory = category === "Others" 
            ? (customCategory.trim() || "General") 
            : category;

        setSubmitting(true);
        try {
            const payload = {
                title: title.trim(),
                youtube_url: youtubeUrl.trim(),
                duration: duration.trim(),
                category: finalCategory,
                description: description.trim(),
            };

            const created: any = await api.post("/courses", payload);
            toast.success("Course published successfully!");

            // Reset form
            setTitle("");
            setYoutubeUrl("");
            setDuration("");
            setDescription("");
            setCategory(CATEGORIES[0]);
            setCustomCategory("");
            setExtractedVideoId(null);

            // Prepend new course to list
            if (created && created.id) {
                setMyCourses((prev) => [created, ...prev.slice(0, 4)]);
                setTotalCourses((prev) => prev + 1);
            } else {
                fetchMyCourses();
            }
        } catch (error: any) {
            toast.error(error.message || "Failed to publish course");
        } finally {
            setSubmitting(false);
        }
    };

    // If logged-in user is NOT an expert, show branded gateway card
    if (!isExpert) {
        return (
            <div className="min-h-screen bg-[#F4F7FB] py-16 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-[#D9E0EA] shadow-lg text-center space-y-5">
                    <div className="w-16 h-16 bg-[#FAF5FF] text-[#7C3AED] rounded-2xl flex items-center justify-center mx-auto border border-[#7C3AED]/20 shadow-xs">
                        <GraduationCap size={32} />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-black text-[#071A4D]">
                            Expert Portal Only
                        </h2>
                        <p className="text-sm text-[#5B6472] leading-relaxed">
                            Only verified Kaammilega Experts can upload and publish video training courses.
                        </p>
                    </div>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={() => router.push("/expert/apply")}
                            className="w-full bg-[#071A4D] hover:bg-[#0B1F52] text-white font-semibold py-3.5 px-6 rounded-xl shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
                        >
                            <span>Apply to Become an Expert</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F4F7FB] py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto space-y-8">

                {/* ─── Top Header ─── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#D9E0EA] pb-6">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-medium text-[#071A4D] tracking-tight">
                            Create & Manage Courses
                        </h1>
                        <p className="text-xs sm:text-sm text-[#5B6472] mt-1">
                            Publish training video sessions from YouTube directly to the Kaammilega Learning Marketplace.
                        </p>
                    </div>

                    <div className="flex items-center gap-2.5">
                        <Link
                            href="/courses/manage"
                            className="text-xs sm:text-sm font-semibold text-[#071A4D] hover:text-[#0B5ED7] bg-white border border-[#D9E0EA] hover:border-[#0B5ED7]/50 px-4 py-2.5 rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
                        >
                            <span>Manage My Courses</span>
                        </Link>
                        <Link
                            href="/resources"
                            className="text-xs sm:text-sm font-semibold text-[#0B5ED7] hover:text-[#071A4D] bg-white border border-[#D9E0EA] px-4 py-2.5 rounded-xl shadow-2xs transition-all flex items-center gap-1.5"
                        >
                            <span>Public Marketplace</span>
                            <ExternalLink size={13} />
                        </Link>
                    </div>
                </div>

                {/* ─── Top Half: Create New Course Form ─── */}
                <div className="bg-white rounded-3xl p-6 sm:p-8 border border-[#D9E0EA] shadow-xs space-y-6">
                    <div className="flex items-center gap-2.5 border-b border-[#D9E0EA]/60 pb-4">
                        <div className="w-9 h-9 rounded-xl bg-[#FFF7ED] text-[#FF6B00] flex items-center justify-center font-bold">
                            <Video size={18} />
                        </div>
                        <div>
                            <h2 className="text-base sm:text-lg font-bold text-[#111827]">
                                Publish a New Course Video
                            </h2>
                            <p className="text-xs text-[#5B6472]">
                                Enter the YouTube URL — your high-res thumbnail will be extracted automatically.
                            </p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5">
                            {/* Course Title with 10-word limit counter */}
                            <div className="md:col-span-2 space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-semibold text-[#071A4D]">
                                        Course Title <span className="text-[#FF6B00]">*</span>
                                    </label>
                                    <span className={`text-[11px] ${titleWordCount > 10 ? "text-red-500 font-semibold" : "text-[#5B6472]"}`}>
                                        {titleWordCount} / 10 words
                                    </span>
                                </div>
                                <input
                                    type="text"
                                    required
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="e.g. Complete Domestic House Wiring & Safety Guide"
                                    className={`w-full px-4 py-2.5 sm:py-3 bg-white border rounded-xl focus:outline-hidden transition-all text-sm text-[#111827] font-medium placeholder:text-[#5B6472]/60 ${
                                        titleWordCount > 10
                                            ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                            : "border-[#D9E0EA] focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10"
                                    }`}
                                />
                                {titleWordCount > 10 && (
                                    <p className="text-[11px] text-red-500">
                                        Title cannot exceed 10 words. Please shorten your title.
                                    </p>
                                )}
                            </div>

                            {/* YouTube URL */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-[#071A4D]">
                                    YouTube Video URL <span className="text-[#FF6B00]">*</span>
                                </label>
                                <input
                                    type="url"
                                    required
                                    value={youtubeUrl}
                                    onChange={(e) => setYoutubeUrl(e.target.value)}
                                    placeholder="https://www.youtube.com/watch?v=..."
                                    className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#D9E0EA] rounded-xl focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10 transition-all text-sm text-[#111827] font-medium placeholder:text-[#5B6472]/60"
                                />
                                <p className="text-[11px] text-[#5B6472]">
                                    Supports standard watch links, youtu.be, or shorts.
                                </p>
                            </div>

                            {/* Video Duration */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-[#071A4D]">
                                    Video Duration <span className="text-[#FF6B00]">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={duration}
                                    onChange={(e) => setDuration(e.target.value)}
                                    placeholder="e.g. 45 Min or 1 Hr 20 Min"
                                    className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#D9E0EA] rounded-xl focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10 transition-all text-sm text-[#111827] font-medium placeholder:text-[#5B6472]/60"
                                />
                            </div>

                            {/* Category Dropdown */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-[#071A4D]">
                                    Category / Trade <span className="text-[#FF6B00]">*</span>
                                </label>
                                <select
                                    value={category}
                                    onChange={(e) => setCategory(e.target.value)}
                                    className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#D9E0EA] rounded-xl focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10 transition-all text-sm text-[#111827] font-medium cursor-pointer"
                                >
                                    {CATEGORIES.map((cat) => (
                                        <option key={cat} value={cat}>
                                            {cat}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {/* If "Others" is selected: Custom Category Text Field */}
                            {category === "Others" && (
                                <div className="space-y-1.5 animate-in fade-in duration-200">
                                    <label className="block text-xs font-semibold text-[#071A4D]">
                                        Enter Custom Category Name <span className="text-[#FF6B00]">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={customCategory}
                                        onChange={(e) => setCustomCategory(e.target.value)}
                                        placeholder="e.g. Solar Panel Technician, CNC Operator..."
                                        className="w-full px-4 py-2.5 sm:py-3 bg-white border border-[#D9E0EA] rounded-xl focus:outline-hidden focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10 transition-all text-sm text-[#111827] font-medium placeholder:text-[#5B6472]/60"
                                    />
                                </div>
                            )}

                            {/* Short Description with 50-word limit counter */}
                            <div className={`space-y-1.5 ${category === "Others" ? "md:col-span-2" : "md:col-span-2"}`}>
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-semibold text-[#071A4D]">
                                        Course Description & Highlights
                                    </label>
                                    <span className={`text-[11px] ${descWordCount > 50 ? "text-red-500 font-semibold" : "text-[#5B6472]"}`}>
                                        {descWordCount} / 50 words
                                    </span>
                                </div>
                                <textarea
                                    rows={3}
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Briefly describe what students will learn from this video session..."
                                    className={`w-full px-4 py-2.5 sm:py-3 bg-white border rounded-xl focus:outline-hidden transition-all text-sm text-[#111827] font-medium placeholder:text-[#5B6472]/60 resize-none ${
                                        descWordCount > 50
                                            ? "border-red-400 focus:border-red-500 focus:ring-2 focus:ring-red-100"
                                            : "border-[#D9E0EA] focus:border-[#0B5ED7] focus:ring-2 focus:ring-[#0B5ED7]/10"
                                    }`}
                                />
                                {descWordCount > 50 && (
                                    <p className="text-[11px] text-red-500">
                                        Description cannot exceed 50 words. Please shorten your description.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* Real-Time Thumbnail Preview Box */}
                        {extractedVideoId ? (
                            <div className="p-4 bg-[#F0FDF4] border border-[#16A34A]/30 rounded-2xl flex flex-col sm:flex-row items-center gap-4">
                                <div className="relative w-full sm:w-44 h-26 rounded-xl overflow-hidden bg-slate-200 shrink-0 shadow-xs">
                                    <img
                                        src={getYouTubeThumbnail(extractedVideoId)}
                                        alt="Extracted Thumbnail"
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                                        <Play size={20} className="text-white fill-white" />
                                    </div>
                                </div>
                                <div className="flex-1 space-y-1 text-center sm:text-left">
                                    <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs font-bold text-[#16A34A]">
                                        <CheckCircle2 size={16} />
                                        <span>Verified YouTube Video ID: {extractedVideoId}</span>
                                    </div>
                                    <p className="text-xs text-[#5B6472]">
                                        Thumbnail confirmed. This high-resolution image will be visible across the Kaammilega platform.
                                    </p>
                                </div>
                            </div>
                        ) : youtubeUrl.trim() ? (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-700">
                                <AlertCircle size={16} className="shrink-0" />
                                <span>Checking YouTube link... Please ensure it is a valid YouTube video URL.</span>
                            </div>
                        ) : null}

                        {/* Submit Button */}
                        <div className="flex justify-end pt-1">
                            <button
                                type="submit"
                                disabled={submitting || !extractedVideoId}
                                className={`w-full sm:w-auto px-7 py-3 rounded-xl font-bold text-sm transition-all shadow-md flex items-center justify-center gap-2 ${
                                    submitting || !extractedVideoId
                                        ? "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                                        : "bg-[#071A4D] hover:bg-[#0B1F52] text-white shadow-[#071A4D]/20 active:scale-[0.98] cursor-pointer"
                                }`}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" />
                                        <span>Publishing Course...</span>
                                    </>
                                ) : (
                                    <>
                                        <Upload size={16} />
                                        <span>Publish Course to Marketplace</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>

                {/* ─── Bottom Half: My Uploaded Courses (Horizontal Scroll of Rectangle Cards) ─── */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2 px-1">
                        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0">
                            <h2 className="text-sm sm:text-base md:text-xl font-medium text-[#071A4D] truncate">
                                My Uploaded Courses
                            </h2>
                            <span className="bg-[#F4F7FB] border border-[#D9E0EA] text-[#071A4D] font-medium text-[11px] sm:text-xs px-2 py-0.5 rounded-full shrink-0">
                                {totalCourses}
                            </span>
                        </div>

                        {/* View All Course Button */}
                        <Link
                            href="/courses/manage"
                            className="inline-flex items-center justify-center gap-1 sm:gap-1.5 text-[11px] sm:text-xs md:text-sm font-semibold text-white bg-[#071A4D] hover:bg-[#0B1F52] px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-xl shadow-xs transition-all cursor-pointer active:scale-[0.98] shrink-0 whitespace-nowrap"
                        >
                            <span>View All Course</span>
                            <ArrowRight size={12} className="shrink-0" />
                        </Link>
                    </div>

                    {loadingCourses ? (
                        <div className="py-12 flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-[#0B5ED7]"></div>
                        </div>
                    ) : myCourses.length === 0 ? (
                        <div className="bg-white rounded-2xl border border-dashed border-[#D9E0EA] p-8 text-center space-y-2">
                            <div className="w-12 h-12 rounded-full bg-[#F4F7FB] text-[#5B6472] flex items-center justify-center mx-auto">
                                <Video size={20} />
                            </div>
                            <h3 className="text-sm font-bold text-[#111827]">
                                No Courses Published Yet
                            </h3>
                            <p className="text-xs text-[#5B6472] max-w-sm mx-auto">
                                Use the form above to add your first YouTube video training course to share with learners.
                            </p>
                        </div>
                    ) : (
                        <div className="relative group/carousel">
                            {/* Left Chevron Floating Button */}
                            <button
                                type="button"
                                onClick={handleScrollLeft}
                                aria-label="Scroll left"
                                className="hidden md:flex absolute -left-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white text-[#071A4D] hover:bg-[#071A4D] hover:text-white border border-[#D9E0EA] shadow-md items-center justify-center transition-all cursor-pointer opacity-90 hover:opacity-100"
                                title="Scroll left"
                            >
                                <ChevronLeft size={18} />
                            </button>

                            {/* Horizontal scroll container with custom Navy Blue scrollbar */}
                            <div 
                                ref={scrollContainerRef}
                                className="flex gap-4 overflow-x-auto pb-4 pt-1 px-1 scroll-smooth snap-x snap-mandatory km-horizontal-scrollbar"
                            >
                                {myCourses.map((c, idx) => (
                                    <CourseCard
                                        key={c.id}
                                        course={c}
                                        compact={true}
                                        isOwner={true}
                                        orderNumber={idx + 1}
                                    />
                                ))}
                            </div>

                            {/* Right Chevron Floating Button */}
                            <button
                                type="button"
                                onClick={handleScrollRight}
                                aria-label="Scroll right"
                                className="hidden md:flex absolute -right-4 top-1/2 -translate-y-1/2 z-20 w-9 h-9 rounded-full bg-white text-[#071A4D] hover:bg-[#071A4D] hover:text-white border border-[#D9E0EA] shadow-md items-center justify-center transition-all cursor-pointer opacity-90 hover:opacity-100"
                                title="Scroll right"
                            >
                                <ChevronRight size={18} />
                            </button>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
