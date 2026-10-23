"use client";

import React, { useState, useEffect } from "react";
import { 
    ChatCircleIcon, 
    CheckCircleIcon, 
    DotsThreeVerticalIcon, 
    ImageSquareIcon, 
    LinkSimpleIcon, 
    PaperPlaneRightIcon, 
    ShareNetworkIcon, 
    ShieldCheckIcon, 
    ThumbsUpIcon,
    MegaphoneIcon,
    SparkleIcon
} from "@phosphor-icons/react";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";

interface Post {
    id: number;
    author: string;
    company: string;
    designation: string;
    timeAgo: string;
    content: string;
    tags: string[];
    likes: number;
    comments: number;
    shares: number;
    hasLiked?: boolean;
}

export default function RecruiterPostsPage() {
    const [user, setUser] = useState<any>(null);
    const [postContent, setPostContent] = useState("");
    const [selectedTag, setSelectedTag] = useState<string | null>(null);
    const [isPublishing, setIsPublishing] = useState(false);

    const [posts, setPosts] = useState<Post[]>([
        {
            id: 1,
            author: "Talent Acquisition Team",
            company: "QuickCare Logistics",
            designation: "Verified Employer",
            timeAgo: "2 hours ago",
            content: "We are aggressively expanding our last-mile delivery and warehouse operations across Delhi NCR! Looking for 50+ Delivery Associates and 10 Warehouse Supervisors. Competitive compensation with on-time payouts, ESIC, and PF benefits. Direct walk-in interviews this Saturday.",
            tags: ["#WeAreHiring", "#DelhiJobs", "#Logistics", "#WalkInDrive"],
            likes: 42,
            comments: 8,
            shares: 12,
            hasLiked: false
        },
        {
            id: 2,
            author: "Operations Head",
            company: "QuickCare Logistics",
            designation: "Recruiter Admin",
            timeAgo: "1 day ago",
            content: "Excited to welcome 28 new team members onboarded through Kaam Milega this month! Our candidate turnaround time dropped from 7 days to under 48 hours thanks to the automated pipeline and verified profiles.",
            tags: ["#HiringMilestone", "#TeamGrowth", "#KaamMilega"],
            likes: 89,
            comments: 14,
            shares: 6,
            hasLiked: true
        }
    ]);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const res: any = await api.get("/user/profile");
                setUser(res);
            } catch (err) {
                console.error("Failed to load recruiter profile", err);
            }
        };
        fetchProfile();
    }, []);

    const companyName = user?.company_name || user?.name || "Your Company";
    const authorName = user?.name || "Hiring Team";

    const handleCreatePost = (e: React.FormEvent) => {
        e.preventDefault();
        if (!postContent.trim()) {
            notify.warning("Please write some content for your update");
            return;
        }

        setIsPublishing(true);
        setTimeout(() => {
            const newPost: Post = {
                id: Date.now(),
                author: authorName,
                company: companyName,
                designation: "Verified Recruiter",
                timeAgo: "Just now",
                content: postContent.trim(),
                tags: selectedTag ? [selectedTag] : ["#WeAreHiring"],
                likes: 0,
                comments: 0,
                shares: 0,
                hasLiked: false
            };

            setPosts([newPost, ...posts]);
            setPostContent("");
            setSelectedTag(null);
            setIsPublishing(false);
            notify.success("Hiring update published to candidate community!");
        }, 500);
    };

    const handleLike = (id: number) => {
        setPosts(prev => prev.map(p => {
            if (p.id === id) {
                return {
                    ...p,
                    likes: p.hasLiked ? p.likes - 1 : p.likes + 1,
                    hasLiked: !p.hasLiked
                };
            }
            return p;
        }));
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans text-km-text-primary">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-km-border pb-5">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold font-poppins text-km-text-primary flex items-center gap-2">
                        <MegaphoneIcon size={24} weight="duotone" className="text-km-primary dark:text-km-link" aria-hidden="true" />
                        Company Hiring Updates
                    </h1>
                    <p className="text-xs text-km-text-secondary mt-1">
                        Broadcast hiring drives, culture stories, and company announcements to job seekers across Kaam Milega.
                    </p>
                </div>
            </div>

            {/* Post Composer Card */}
            <div className="bg-km-surface-card border border-km-border rounded-2xl p-5 shadow-xs">
                <form onSubmit={handleCreatePost} className="space-y-4">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-xl bg-km-primary text-white flex items-center justify-center font-bold text-sm shrink-0">
                            {companyName.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1.5">
                                <span className="text-xs font-semibold text-km-text-primary">{companyName}</span>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/60">
                                    <ShieldCheckIcon size={12} weight="bold" aria-hidden="true" /> Verified Employer
                                </span>
                            </div>
                            <textarea
                                value={postContent}
                                onChange={(e) => setPostContent(e.target.value)}
                                placeholder="Share an update on active openings, walk-in drives, or team milestones..."
                                rows={3}
                                className="w-full text-xs text-km-text-primary placeholder:text-km-text-secondary/70 bg-km-surface border border-km-border rounded-xl p-3 focus:border-km-primary outline-none transition-colors resize-none"
                            />
                        </div>
                    </div>

                    {/* Pre-set Topic Tags */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                        <span className="text-[11px] text-km-text-secondary font-medium mr-1">Quick Tags:</span>
                        {["#WeAreHiring", "#UrgentRequirement", "#WalkInDrive", "#CompanyCulture"].map(tag => (
                            <button
                                key={tag}
                                type="button"
                                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                                className={`text-[11px] px-2.5 py-1 rounded-lg border transition-colors ${
                                    selectedTag === tag
                                        ? "bg-km-primary text-white border-km-primary"
                                        : "bg-km-surface text-km-text-secondary border-km-border hover:bg-km-border/30"
                                }`}
                            >
                                {tag}
                            </button>
                        ))}
                    </div>

                    {/* Composer Footer Actions */}
                    <div className="flex items-center justify-between border-t border-km-border/70 pt-3">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => notify.info("Attaching media will be available in the next release.")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface rounded-lg transition-colors border border-transparent hover:border-km-border"
                            >
                                <ImageSquareIcon size={16} weight="regular" aria-hidden="true" />
                                <span>Media</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => notify.info("Link active jobs from your Manage Jobs portal.")}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface rounded-lg transition-colors border border-transparent hover:border-km-border"
                            >
                                <LinkSimpleIcon size={16} weight="regular" aria-hidden="true" />
                                <span>Link Job</span>
                            </button>
                        </div>

                        <button
                            type="submit"
                            disabled={isPublishing || !postContent.trim()}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 shadow-xs"
                        >
                            <PaperPlaneRightIcon size={14} weight="bold" aria-hidden="true" />
                            <span>{isPublishing ? "Publishing..." : "Publish Update"}</span>
                        </button>
                    </div>
                </form>
            </div>

            {/* Posts Feed */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold font-poppins text-km-text-primary">Recent Community Broadcasts</h2>
                    <span className="text-xs text-km-text-secondary font-mono">{posts.length} Posts</span>
                </div>

                {posts.map((post) => (
                    <article key={post.id} className="bg-km-surface-card border border-km-border rounded-2xl p-5 shadow-xs space-y-4">
                        {/* Header */}
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-km-surface border border-km-border flex items-center justify-center font-bold text-xs text-km-primary shrink-0">
                                    {post.company.charAt(0)}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-xs font-bold text-km-text-primary leading-tight font-poppins">{post.company}</h3>
                                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                                            <ShieldCheckIcon size={11} weight="bold" aria-hidden="true" />
                                            Verified
                                        </span>
                                    </div>
                                    <p className="text-[11px] text-km-text-secondary mt-0.5">
                                        {post.author} • <span className="font-mono text-[10px]">{post.timeAgo}</span>
                                    </p>
                                </div>
                            </div>

                            <button 
                                className="p-1.5 text-km-text-secondary hover:text-km-text-primary rounded-lg hover:bg-km-surface transition-colors"
                                aria-label="More options"
                            >
                                <DotsThreeVerticalIcon size={16} weight="bold" aria-hidden="true" />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="space-y-2.5">
                            <p className="text-xs text-km-text-primary leading-relaxed whitespace-pre-line">
                                {post.content}
                            </p>

                            {post.tags.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {post.tags.map((tag, idx) => (
                                        <span key={idx} className="text-[11px] font-medium text-km-link bg-blue-50 dark:bg-blue-950/40 px-2 py-0.5 rounded-md border border-blue-100 dark:border-blue-900/50">
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Engagement Bar */}
                        <div className="flex items-center justify-between text-xs text-km-text-secondary pt-3 border-t border-km-border/70 font-mono">
                            <span>{post.likes} reactions</span>
                            <div className="flex items-center gap-3">
                                <span>{post.comments} comments</span>
                                <span>•</span>
                                <span>{post.shares} reshares</span>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-km-border/70">
                            <button
                                type="button"
                                onClick={() => handleLike(post.id)}
                                className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                                    post.hasLiked
                                        ? "text-km-primary bg-blue-50 dark:bg-blue-950/40"
                                        : "text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface"
                                }`}
                            >
                                <ThumbsUpIcon size={16} weight={post.hasLiked ? "fill" : "regular"} aria-hidden="true" />
                                <span>{post.hasLiked ? "Liked" : "Like"}</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => notify.info("Opening comments...")}
                                className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface transition-colors"
                            >
                                <ChatCircleIcon size={16} weight="regular" aria-hidden="true" />
                                <span>Comment</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => notify.success("Link copied to clipboard!")}
                                className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface transition-colors"
                            >
                                <ShareNetworkIcon size={16} weight="regular" aria-hidden="true" />
                                <span>Share</span>
                            </button>
                        </div>
                    </article>
                ))}
            </div>
        </div>
    );
}
