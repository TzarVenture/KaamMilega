"use client";

import React from "react";
import Link from "next/link";
import { CalendarBlankIcon, ClockIcon, EyeIcon, PencilSimpleIcon, PlayIcon, TrashIcon, UserIcon } from '@phosphor-icons/react';
import { openYouTubeVideo, getYouTubeThumbnail } from "@/lib/youtube";

export interface CourseData {
    id: string;
    title: string;
    description?: string;
    youtube_url: string;
    youtube_video_id: string;
    thumbnail_url: string;
    duration: string;
    category?: string;
    expert_id: string;
    expert_name: string;
    expert_avatar?: string;
    views: number;
    created_at?: string;
}

interface CourseCardProps {
    course: CourseData;
    onViewClick?: (course: CourseData) => void;
    compact?: boolean;
    isOwner?: boolean;
    onDelete?: (courseId: string) => void;
    onEdit?: (course: CourseData) => void;
    orderNumber?: number;
}

export default function CourseCard({
    course,
    onViewClick,
    compact = false,
    isOwner = false,
    onDelete,
    onEdit,
    orderNumber,
}: CourseCardProps) {
    const handleWatch = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        if (onViewClick) {
            onViewClick(course);
        } else {
            openYouTubeVideo(course.youtube_video_id, course.youtube_url);
        }
    };

    const formattedDate = React.useMemo(() => {
        if (!course.created_at) return "Recently";
        try {
            const d = new Date(course.created_at);
            return d.toLocaleDateString("en-IN", {
                month: "short",
                day: "numeric",
                year: "numeric",
            });
        } catch {
            return "Recently";
        }
    }, [course.created_at]);

    const formattedViews = React.useMemo(() => {
        const v = course.views || 0;
        if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M Viewers`;
        if (v >= 1000) return `${(v / 1000).toFixed(1)}K Viewers`;
        return `${v} Viewers`;
    }, [course.views]);

    const thumbnailSrc =
        course.thumbnail_url || getYouTubeThumbnail(course.youtube_video_id);

    const expertProfileUrl = course.expert_id ? `/profile/${course.expert_id}` : "#";

    // ─────────────────────────────────────────────────────────────────────────────
    // Compact Horizontal Rectangle Card (Used in horizontal carousels on /courses)
    // ─────────────────────────────────────────────────────────────────────────────
    if (compact) {
        return (
            <div className="w-84 sm:w-96 shrink-0 snap-start bg-km-surface-card rounded-2xl border border-km-border p-3 flex gap-3.5 hover:border-[#0B5ED7]/30 transition-all duration-150">
                {/* Thumbnail Section (Clickable) */}
                <div
                    onClick={handleWatch}
                    className="relative w-38 sm:w-42 h-26 rounded-xl overflow-hidden bg-slate-100 shrink-0 cursor-pointer group"
                >
                    <img
                        src={thumbnailSrc}
                        alt={course.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                            (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${course.youtube_video_id}/hqdefault.jpg`;
                        }}
                    />

                    {/* Category Badge on Top-Left matching reference screenshot */}
                    {course.category && (
                        <span className="absolute top-0 left-0 bg-[#071A4D] text-white text-[10px] font-semibold px-2.5 py-1 rounded-tl-xl rounded-br-xl shadow-xs z-10">
                            {course.category}
                        </span>
                    )}

                    {/* Minimalist Play Icon in Center */}
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <div className="w-8 h-8 bg-km-surface-card text-km-heading rounded-full flex items-center justify-center shadow-xs">
                            <PlayIcon weight="fill" size={12} className="ml-0.5" />
                        </div>
                    </div>
                </div>

                {/* Info Section */}
                <div className="flex-1 flex flex-col justify-between overflow-hidden py-0.5">
                    <div>
                        {/* Views Count */}
                        <div className="flex items-center justify-end mb-1">
                            <span className="text-[11px] font-semibold text-km-heading flex items-center gap-1">
                                <EyeIcon weight="bold" size={11} className="text-km-link" />
                                {formattedViews}
                            </span>
                        </div>

                        {/* Title (Clickable) */}
                        <h4
                            onClick={handleWatch}
                            className="text-xs sm:text-sm font-semibold text-km-text-primary line-clamp-2 leading-snug cursor-pointer hover:text-km-link transition-colors"
                        >
                            {course.title}
                        </h4>
                    </div>

                    {/* Bottom Metadata & Duration */}
                    <div className="flex items-center justify-between pt-1 border-t border-km-border/60 text-[11px] text-km-text-secondary">
                        <span className="flex items-center gap-1 font-medium text-km-text-primary">
                            <ClockIcon weight="bold" size={11} className="text-km-link" />
                            {course.duration || "30 Min"}
                        </span>
                    </div>
                </div>
            </div>
        );
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Full Standard Card (Used on /resources marketplace & /courses/manage)
    // ONLY Thumbnail and Video Title are clickable for redirection.
    // ─────────────────────────────────────────────────────────────────────────────
    return (
        <div className="bg-km-surface-card rounded-2xl border border-km-border p-4 sm:p-5 shadow-xs hover:border-[#0B5ED7]/30 transition-all duration-150 flex flex-col md:flex-row gap-5 items-start">
            {/* ─── 1. Thumbnail Section (Clickable) ─── */}
            <div
                onClick={handleWatch}
                className="relative w-full md:w-64 lg:w-72 h-44 sm:h-40 rounded-xl overflow-hidden bg-slate-100 shrink-0 cursor-pointer group"
                title="Click to watch video on YouTube"
            >
                <img
                    src={thumbnailSrc}
                    alt={course.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${course.youtube_video_id}/hqdefault.jpg`;
                    }}
                />

                {/* Category Badge on Top-Left matching reference screenshot */}
                {course.category && (
                    <span className="absolute top-0 left-0 bg-[#071A4D] text-white text-xs font-semibold px-3.5 py-1.5 rounded-tl-xl rounded-br-2xl shadow-xs z-10">
                        {course.category}
                    </span>
                )}

                {/* Duration Badge on bottom-right of thumbnail */}
                <span className="absolute bottom-2.5 right-2.5 bg-[#071A4D]/80 text-white text-[10px] font-medium px-2 py-0.5 rounded-md flex items-center gap-1">
                    <ClockIcon weight="bold" size={11} /> {course.duration || "30 Min"}
                </span>

                {/* Minimalist Play Icon in Center */}
                <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                    <div className="w-11 h-11 bg-km-surface-card text-km-heading rounded-full flex items-center justify-center shadow-xs">
                        <PlayIcon weight="fill" size={16} className="ml-0.5" />
                    </div>
                </div>
            </div>

            {/* ─── 2. Content Details Section ─── */}
            <div className="flex-1 w-full flex flex-col justify-between py-0.5 min-h-40">
                <div>
                    {/* Header Row: Video Title & Owner Controls */}
                    <div className="flex items-start justify-between gap-3">
                        {/* Video Title (Clickable) */}
                        <h2
                            onClick={handleWatch}
                            className="text-base sm:text-lg font-semibold text-km-text-primary leading-snug cursor-pointer hover:text-km-link transition-colors flex-1"
                            title="Click to watch video on YouTube"
                        >
                            {course.title}
                        </h2>

                        {/* Owner Controls (Edit / Delete) if applicable */}
                        {isOwner && (
                            <div className="flex items-center gap-1 shrink-0">
                                {onEdit && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEdit(course);
                                        }}
                                        className="p-1.5 text-km-link hover:bg-blue-50 rounded-lg transition"
                                        title="Edit Course"
                                    >
                                        <PencilSimpleIcon weight="bold" size={15} />
                                    </button>
                                )}
                                {onDelete && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onDelete(course.id);
                                        }}
                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition"
                                        title="Delete Course"
                                    >
                                        <TrashIcon weight="bold" size={15} />
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Course Description */}
                    {course.description && (
                        <p className="text-xs sm:text-sm text-km-text-secondary mt-2 line-clamp-2 leading-relaxed">
                            {course.description}
                        </p>
                    )}
                </div>

                {/* ─── 3. Metadata Grid ─── */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-2.5 gap-x-4 pt-3.5 mt-4 border-t border-km-border">
                    {/* (A) Video Duration (Replaced Watch Video area) */}
                    <div className="flex items-center gap-1.5 text-xs text-km-text-secondary">
                        <ClockIcon weight="bold" size={14} className="text-km-link shrink-0" />
                        <span>Duration: <strong className="text-km-text-primary">{course.duration || "30 Min"}</strong></span>
                    </div>

                    {/* (B) Real Expert Name with Link to Profile */}
                    <div className="flex items-center gap-1.5 text-xs text-km-text-secondary truncate">
                        <Link
                            href={expertProfileUrl}
                            onClick={(e) => e.stopPropagation()}
                            className="inline-flex items-center gap-1.5 hover:text-km-link font-semibold truncate group/profile"
                            title={`View ${course.expert_name || "Expert"}'s Profile`}
                        >
                            <div className="w-5 h-5 rounded-full bg-km-surface border border-km-border flex items-center justify-center shrink-0 overflow-hidden">
                                {course.expert_avatar ? (
                                    <img
                                        src={course.expert_avatar}
                                        alt={course.expert_name}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <UserIcon weight="bold" size={12} className="text-km-heading" />
                                )}
                            </div>
                            <span className="truncate group-hover/profile:underline">
                                By {course.expert_name || "Expert"}
                            </span>
                        </Link>
                    </div>

                    {/* (C) Live Viewers Count */}
                    <div className="flex items-center gap-1.5 text-xs text-km-heading font-bold">
                        <EyeIcon weight="bold" size={14} className="text-km-link shrink-0" />
                        <span>{formattedViews}</span>
                    </div>

                    {/* (D) Release Date */}
                    <div className="flex items-center gap-1.5 text-xs text-km-text-secondary">
                        <CalendarBlankIcon weight="bold" size={14} className="text-km-text-secondary/70 shrink-0" />
                        <span>Released {formattedDate}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
