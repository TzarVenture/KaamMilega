"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { 
    ArrowSquareOutIcon, 
    BriefcaseIcon, 
    CalendarBlankIcon, 
    CheckCircleIcon, 
    ClockIcon, 
    CopyIcon, 
    EnvelopeSimpleIcon, 
    FileTextIcon, 
    MapPinIcon, 
    PhoneIcon, 
    UserIcon, 
    XIcon 
} from '@phosphor-icons/react';
import { notify } from "@/lib/notify";

interface CandidateDetailDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    application: any | null;
    onStatusUpdate: (id: string, newStatus: string) => Promise<void>;
    onScheduleInterview: (appId: string) => void;
}

export default function CandidateDetailDrawer({
    isOpen,
    onClose,
    application,
    onStatusUpdate,
    onScheduleInterview
}: CandidateDetailDrawerProps) {
    const [copiedEmail, setCopiedEmail] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen || !application) return null;

    const candidate = application.candidate;
    const job = application.job;

    const copyEmail = () => {
        if (!candidate?.email) return;
        navigator.clipboard.writeText(candidate.email);
        setCopiedEmail(true);
        notify.success("Email copied to clipboard");
        setTimeout(() => setCopiedEmail(false), 2000);
    };

    const handleStageChange = async (newStatus: string) => {
        if (newStatus === application.status) return;
        setUpdatingStatus(true);
        try {
            await onStatusUpdate(application.id, newStatus);
        } finally {
            setUpdatingStatus(false);
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "Applied":
                return "bg-blue-50 text-km-blue border-blue-200 dark:bg-[#131D3D] dark:border-blue-900/40 dark:text-km-link";
            case "Shortlisted":
                return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#211A25] dark:border-amber-900/40 dark:text-amber-400";
            case "Interviewing":
            case "Interview":
                return "bg-purple-50 text-purple-700 border-purple-200 dark:bg-[#1E1442] dark:border-purple-900/40 dark:text-purple-400";
            case "Hired":
                return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#0C1F2E] dark:border-emerald-900/40 dark:text-emerald-400";
            case "Rejected":
                return "bg-rose-50 text-rose-700 border-rose-200 dark:bg-[#23142B] dark:border-rose-900/40 dark:text-rose-400";
            default:
                return "bg-km-surface text-km-text-secondary border-km-border";
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 overflow-hidden bg-black/50 flex justify-end animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
            aria-labelledby="candidate-drawer-title"
        >
            <div className="w-full max-w-xl bg-km-surface-card h-full shadow-2xl flex flex-col border-l border-km-border text-km-text-primary overflow-hidden animate-in slide-in-from-right duration-200">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-km-border/70 flex items-center justify-between bg-km-surface/40 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <UserIcon size={18} weight="regular" className="text-km-primary" aria-hidden="true" />
                        <h2 id="candidate-drawer-title" className="text-base font-bold text-km-text-primary font-poppins">
                            Candidate Application
                        </h2>
                        <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${getStatusBadge(application.status)}`}>
                            {application.status}
                        </span>
                    </div>

                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface rounded-lg transition-colors cursor-pointer"
                        aria-label="Close candidate details"
                    >
                        <XIcon size={18} weight="regular" aria-hidden="true" />
                    </button>
                </div>

                {/* Scrollable Content Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    {/* Candidate Identity Card */}
                    <div className="p-5 rounded-2xl border border-km-border bg-km-surface/30 space-y-4">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3.5">
                                {candidate?.profile_image ? (
                                    <img
                                        src={candidate.profile_image}
                                        alt={candidate.name || "Candidate"}
                                        className="w-14 h-14 rounded-2xl object-cover border border-km-border"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-2xl bg-km-primary text-white font-bold text-xl flex items-center justify-center uppercase shrink-0">
                                        {candidate?.name ? candidate.name.charAt(0) : "C"}
                                    </div>
                                )}
                                <div>
                                    <h3 className="text-lg font-bold text-km-text-primary font-poppins">
                                        {candidate?.name || `Candidate #${application.candidate_id?.substring(0, 6) || "ID"}`}
                                    </h3>
                                    <p className="text-xs text-km-text-secondary mt-0.5 font-medium">
                                        {candidate?.headline || "Registered Candidate"}
                                    </p>
                                </div>
                            </div>

                            {/* Public Profile Link */}
                            <Link
                                href={`/profile/${application.candidate_id}`}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-km-border bg-km-surface-card hover:bg-km-surface text-xs font-semibold text-km-blue transition-colors shadow-2xs shrink-0"
                            >
                                <span>Profile</span>
                                <ArrowSquareOutIcon size={14} weight="bold" aria-hidden="true" />
                            </Link>
                        </div>

                        {/* Contact Meta Grid */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-km-border/60 text-xs">
                            {candidate?.email && (
                                <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-km-surface-card border border-km-border/60">
                                    <div className="flex items-center gap-2 truncate">
                                        <EnvelopeSimpleIcon size={15} weight="regular" className="text-km-text-secondary shrink-0" aria-hidden="true" />
                                        <span className="truncate text-km-text-primary font-medium">{candidate.email}</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={copyEmail}
                                        title="Copy email address"
                                        aria-label="Copy email address"
                                        className="text-km-text-secondary hover:text-km-primary transition-colors cursor-pointer shrink-0"
                                    >
                                        {copiedEmail ? (
                                            <CheckCircleIcon size={14} weight="fill" className="text-emerald-600" aria-hidden="true" />
                                        ) : (
                                            <CopyIcon size={14} weight="regular" aria-hidden="true" />
                                        )}
                                    </button>
                                </div>
                            )}

                            {candidate?.mobile && (
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-km-surface-card border border-km-border/60">
                                    <PhoneIcon size={15} weight="regular" className="text-km-text-secondary shrink-0" aria-hidden="true" />
                                    <span className="text-km-text-primary font-medium">{candidate.mobile}</span>
                                </div>
                            )}

                            {candidate?.city && (
                                <div className="flex items-center gap-2 p-2 rounded-xl bg-km-surface-card border border-km-border/60">
                                    <MapPinIcon size={15} weight="regular" className="text-km-text-secondary shrink-0" aria-hidden="true" />
                                    <span className="text-km-text-primary font-medium">{candidate.city}</span>
                                </div>
                            )}

                            <div className="flex items-center gap-2 p-2 rounded-xl bg-km-surface-card border border-km-border/60">
                                <ClockIcon size={15} weight="regular" className="text-km-text-secondary shrink-0" aria-hidden="true" />
                                <span className="text-km-text-secondary">
                                    Applied: <span className="font-semibold text-km-text-primary">{new Date(application.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</span>
                                </span>
                            </div>
                        </div>

                        {/* Candidate Skills */}
                        {candidate?.skills && candidate.skills.length > 0 && (
                            <div className="pt-2 border-t border-km-border/60">
                                <p className="text-[11px] font-semibold uppercase tracking-wider text-km-text-secondary mb-2">
                                    Candidate Skills
                                </p>
                                <div className="flex flex-wrap gap-1.5">
                                    {candidate.skills.map((skill: string, idx: number) => (
                                        <span
                                            key={idx}
                                            className="px-2.5 py-0.5 rounded-lg text-xs font-medium bg-km-surface-card border border-km-border text-km-text-primary"
                                        >
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Applied Position Card */}
                    <div className="p-4 rounded-2xl border border-km-border bg-km-surface-card space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-km-text-secondary">
                            <BriefcaseIcon size={16} weight="regular" className="text-km-blue" aria-hidden="true" />
                            <span>Target Position</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                            <div>
                                <h4 className="text-sm font-bold text-km-text-primary font-poppins">
                                    {job?.title || "Job Posting"}
                                </h4>
                                <p className="text-xs text-km-text-secondary mt-0.5">
                                    {job?.company || "Company"} • {job?.city_name || job?.location || "Location"}
                                </p>
                            </div>
                            {job?.salary_min && job?.salary_max && (
                                <span className="text-xs font-bold text-km-text-primary bg-km-surface px-2.5 py-1 rounded-lg border border-km-border/70 self-start sm:self-auto">
                                    ₹{job.salary_min} – ₹{job.salary_max}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Unabridged Cover Letter */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-km-text-primary font-poppins uppercase tracking-wider">
                            Cover Letter / Candidate Note
                        </h4>
                        {application.cover_letter ? (
                            <div className="p-4 rounded-2xl border border-km-border bg-km-surface/30 text-xs text-km-text-primary leading-relaxed whitespace-pre-wrap font-sans">
                                {application.cover_letter}
                            </div>
                        ) : (
                            <p className="text-xs text-km-text-secondary italic p-4 rounded-2xl border border-dashed border-km-border text-center">
                                No cover letter note was provided with this application.
                            </p>
                        )}
                    </div>

                    {/* Resume Document */}
                    <div className="space-y-2">
                        <h4 className="text-xs font-bold text-km-text-primary font-poppins uppercase tracking-wider">
                            Submitted Resume / CV
                        </h4>
                        {application.resume_url ? (
                            <div className="p-4 rounded-2xl border border-km-border bg-km-surface-card flex items-center justify-between gap-3 shadow-2xs">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-km-blue border border-blue-200 flex items-center justify-center shrink-0">
                                        <FileTextIcon size={20} weight="regular" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-xs font-semibold text-km-text-primary truncate">
                                            Candidate Resume Document
                                        </p>
                                        <p className="text-[11px] text-km-text-secondary mt-0.5">
                                            PDF / Document attachment
                                        </p>
                                    </div>
                                </div>
                                <a
                                    href={application.resume_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-3.5 py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 shrink-0 shadow-2xs"
                                >
                                    <span>View Resume</span>
                                    <ArrowSquareOutIcon size={14} weight="bold" aria-hidden="true" />
                                </a>
                            </div>
                        ) : (
                            <div className="p-4 rounded-2xl border border-dashed border-km-border text-center text-xs text-km-text-secondary">
                                No resume file attachment uploaded. Candidate information is sourced from their verified profile.
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer Action Bar */}
                <div className="p-4 sm:p-5 border-t border-km-border/70 bg-km-surface/40 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
                    {/* Pipeline Stage Advance Dropdown */}
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <span className="text-xs font-semibold text-km-text-secondary shrink-0">Stage:</span>
                        <select
                            value={application.status}
                            disabled={updatingStatus}
                            onChange={(e) => handleStageChange(e.target.value)}
                            className="flex-1 sm:flex-none text-xs font-semibold bg-km-surface-card border border-km-border rounded-xl px-3 py-2 text-km-text-primary outline-none focus:border-km-primary cursor-pointer disabled:opacity-50"
                        >
                            <option value="Applied">Applied</option>
                            <option value="Shortlisted">Shortlisted</option>
                            <option value="Interviewing">Interview</option>
                            <option value="Hired">Hired</option>
                            <option value="Rejected">Rejected</option>
                        </select>
                    </div>

                    {/* Schedule Interview CTA */}
                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                        <button
                            type="button"
                            onClick={() => {
                                onScheduleInterview(application.id);
                            }}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-semibold transition-colors shadow-xs cursor-pointer"
                        >
                            <CalendarBlankIcon size={15} weight="bold" aria-hidden="true" />
                            <span>Schedule Interview</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
}
