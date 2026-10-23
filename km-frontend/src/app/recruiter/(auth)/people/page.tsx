"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import {
    ArrowUpRightIcon,
    ChatCircleIcon,
    MagnifyingGlassIcon,
    MapPinIcon,
    ShieldCheckIcon,
    UsersIcon,
} from "@phosphor-icons/react";

interface Candidate {
    id: string;
    _id?: string;
    name?: string;
    headline?: string;
    location?: string;
    city?: string;
    skills?: string[];
    avatar?: string;
    experience?: any[];
}

export default function CandidateDirectoryPage() {
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let isMounted = true;
        const fetchCandidates = async () => {
            setLoading(true);
            try {
                let data: Candidate[] = [];
                if (searchTerm.trim()) {
                    data = await api.get(`/user/search?q=${encodeURIComponent(searchTerm.trim())}`) as Candidate[];
                } else {
                    const res = await api.get("/community/users?limit=18").catch(() => null);
                    data = (res?.data || res || []) as Candidate[];
                }
                if (isMounted) {
                    setCandidates(Array.isArray(data) ? data : []);
                }
            } catch (error) {
                console.error("Failed to fetch candidates:", error);
                if (isMounted) setCandidates([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        const timer = setTimeout(fetchCandidates, 300);
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [searchTerm]);

    return (
        <div className="space-y-6 font-sans text-km-text-primary pb-16">
            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-km-text-primary font-poppins">Candidate Directory</h1>
                    <p className="text-xs text-km-text-secondary mt-0.5">
                        Discover qualified professionals, verified talent, and skilled workers
                    </p>
                </div>
            </header>

            {/* Search Bar */}
            <div className="bg-km-surface-card p-3 rounded-2xl border border-km-border shadow-xs flex items-center gap-3">
                <div className="flex-1 relative">
                    <MagnifyingGlassIcon size={16} weight="regular" className="absolute left-3 top-2.5 text-km-text-secondary" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Search candidates by name, job role, or skill..."
                        className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 outline-none focus:border-km-primary transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-xs text-km-text-secondary font-medium px-2 py-1 bg-km-surface rounded-lg border border-km-border/70 shrink-0">
                    {candidates.length} {candidates.length === 1 ? "Candidate" : "Candidates"}
                </div>
            </div>

            {/* Candidate Grid */}
            {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                        <div key={n} className="bg-km-surface-card p-5 rounded-2xl border border-km-border shadow-xs h-48 animate-pulse" />
                    ))}
                </div>
            ) : candidates.length === 0 ? (
                <div className="bg-km-surface-card p-12 rounded-2xl shadow-xs border border-km-border text-center">
                    <UsersIcon size={36} weight="duotone" className="text-km-text-secondary mx-auto mb-3" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-km-text-primary font-poppins">No candidates found</h3>
                    <p className="text-xs text-km-text-secondary mt-1 max-w-sm mx-auto">
                        Try searching for another job title, skill keyword, or candidate name.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {candidates.map((candidate) => {
                        const candidateId = candidate.id || candidate._id || "";
                        const displayName = candidate.name || "Candidate Profile";
                        const headline = candidate.headline || "Open to opportunities";
                        const location = candidate.city || candidate.location || "India";

                        return (
                            <div
                                key={candidateId}
                                className="bg-km-surface-card p-4 rounded-2xl border border-km-border shadow-xs hover:border-km-primary transition-colors flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-xl bg-km-surface border border-km-border text-km-primary font-bold text-sm flex items-center justify-center uppercase shrink-0">
                                            {displayName.charAt(0)}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                <h3 className="font-semibold text-xs text-km-text-primary truncate font-poppins">
                                                    {displayName}
                                                </h3>
                                                <ShieldCheckIcon weight="bold" size={13} className="text-emerald-600 shrink-0" aria-hidden="true" />
                                            </div>
                                            <p className="text-[11px] text-km-text-secondary truncate mt-0.5">{headline}</p>
                                            <p className="text-[11px] text-km-text-secondary flex items-center gap-1 mt-1">
                                                <MapPinIcon size={12} weight="regular" aria-hidden="true" />
                                                <span>{location}</span>
                                            </p>
                                        </div>
                                    </div>

                                    {/* Skills Pills */}
                                    {candidate.skills && candidate.skills.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5 my-2">
                                            {candidate.skills.slice(0, 3).map((skill, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-2 py-0.5 bg-km-surface rounded-md border border-km-border/60 text-[10px] text-km-text-secondary font-medium"
                                                >
                                                    {skill}
                                                </span>
                                            ))}
                                            {candidate.skills.length > 3 && (
                                                <span className="px-1.5 py-0.5 text-[10px] text-km-text-secondary">
                                                    +{candidate.skills.length - 3}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                <div className="mt-4 pt-3 border-t border-km-border/70 flex items-center gap-2">
                                    <Link
                                        href={`/profile/${candidateId}`}
                                        className="flex-1 py-1.5 px-3 rounded-lg border border-km-border text-km-text-primary hover:bg-km-surface text-xs font-medium text-center flex items-center justify-center gap-1 transition-colors"
                                    >
                                        <span>View Profile</span>
                                        <ArrowUpRightIcon size={12} weight="bold" aria-hidden="true" />
                                    </Link>
                                    <Link
                                        href={`/chat?user=${candidateId}`}
                                        className="py-1.5 px-3 rounded-lg bg-km-primary hover:bg-km-primary-dark text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-xs"
                                        title="Direct Message"
                                        aria-label="Direct Message"
                                    >
                                        <ChatCircleIcon size={14} weight="regular" aria-hidden="true" />
                                        <span>Chat</span>
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}