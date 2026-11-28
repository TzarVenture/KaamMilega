"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import { ArrowSquareOutIcon, BriefcaseIcon, CaretRightIcon, ChatIcon, CheckCircleIcon, CircleNotchIcon, ClockIcon, LightningIcon, PhoneCallIcon, StarIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { cn } from "@/lib/utils";
import { errorText, notify } from "@/lib/notify";

type JobInfo = {
    id: string;
    title: string;
    company: string;
    company_id?: string;
    location: string;
    city_name: string;
    salary_min: number;
    salary_max: number;
    job_type: string;
    status?: string;
    experience_min: number;
    experience_max: number;
    rating: number;
    reviews_count: string;
    status_text: string;
    last_active: string;
};

type ApplicationDetail = {
    id: string;
    job_id: string;
    status: string;
    created_at: string;
    updated_at: string;
    job?: JobInfo | null;
};

const STEPS = [
    { label: "Applied", key: "Applied" },
    { label: "Application Viewed", key: "Viewed" },
    { label: "Resume View", key: "Shortlisted" },
    { label: "Awaiting Recruiter Response", key: "Interviewing" },
    { label: "Connect", key: "Hired" },
];

function formatTimeAgo(dateString: string) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks} week${weeks > 1 ? 's' : ''} ago`;
    const months = Math.floor(days / 30);
    return `${months} month${months > 1 ? 's' : ''} ago`;
}

function getStatusDisplay(status: string) {
    const map: Record<string, string> = {
        "Applied": "Applied",
        "Viewed": "Resume viewed",
        "Shortlisted": "Resume shortlisted",
        "Interviewing": "Interviewing",
        "Rejected": "Rejected",
        "Hired": "Hired",
        "Withdrawn": "Withdrawn"
    };
    return map[status] || status;
}

function getStatusBadgeClass(status: string) {
    switch (status) {
        case "Applied":
            return "bg-blue-50 text-blue-700 border-blue-200";
        case "Viewed":
            return "bg-indigo-50 text-indigo-700 border-indigo-200";
        case "Shortlisted":
            return "bg-amber-50 text-amber-700 border-amber-200";
        case "Interviewing":
            return "bg-purple-50 text-purple-700 border-purple-200";
        case "Hired":
            return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "Rejected":
            return "bg-rose-50 text-rose-700 border-rose-200";
        case "Withdrawn":
            return "bg-slate-100 text-slate-700 border-slate-200";
        default:
            return "bg-km-surface text-km-text-primary border-km-border";
    }
}

export default function ApplicationsPage() {
    const [applications, setApplications] = useState<ApplicationDetail[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Withdrawing asks once more before it happens
    const [confirmWithdraw, setConfirmWithdraw] = useState<string | null>(null);
    const [withdrawing, setWithdrawing] = useState(false);

    const withdraw = async (id: string) => {
        setWithdrawing(true);
        try {
            const updated = await api.post(`/applications/${id}/withdraw`) as { status?: string; updated_at?: string };
            setApplications((list) => list.map((a) => a.id === id ? { ...a, status: updated?.status || "Withdrawn", updated_at: updated?.updated_at || new Date().toISOString() } : a));
            notify.success("Application withdrawn. The employer has been told.");
        } catch (err) {
            notify.error(err, "Could not withdraw the application");
        } finally {
            setWithdrawing(false);
            setConfirmWithdraw(null);
        }
    };

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.get("/applications/my") as ApplicationDetail[];
                setApplications(data);
                if (data.length > 0) {
                    setSelectedId(data[0].id);
                }
            } catch (err: any) {
                setError(errorText(err, "Failed to load applications"));
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const selectedApp = useMemo(() =>
        applications.find(a => a.id === selectedId),
        [applications, selectedId]);

    if (loading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <div className="text-center space-y-4">
                    <CircleNotchIcon className="w-10 h-10 animate-spin text-km-heading mx-auto" />
                    <p className="text-km-text-secondary font-medium">Crunching your career moves...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto mt-20 p-8 bg-red-50 border border-red-100 rounded-3xl text-center">
                <WarningCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4 dark:text-red-400" />
                <h2 className="text-xl font-bold text-red-900 mb-2">Oops! Something went wrong</h2>
                <p className="text-red-700">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (applications.length === 0) {
        return (
            <div className="max-w-4xl mx-auto mt-20 p-12 bg-km-surface-card border border-km-border rounded-3xl text-center shadow-sm">
                <BriefcaseIcon size={48} weight="duotone" className="text-km-text-muted mx-auto mb-6" aria-hidden="true" />
                <h2 className="text-2xl font-bold text-km-text-primary mb-2">No Applications Yet</h2>
                <p className="text-km-text-secondary max-w-md mx-auto mb-8">
                    Your dream job is waiting! Start applying to see your application journey reflected here.
                </p>
                <a
                    href="/jobs"
                    className="inline-flex items-center gap-2 px-8 py-3 bg-km-primary text-white rounded-xl font-bold hover:bg-km-primary-dark transition shadow-lg shadow-blue-900/10"
                >
                    Explore Jobs
                    <CaretRightIcon weight="bold" className="w-4 h-4" />
                </a>
            </div>
        );
    }

    return (
        <div className="bg-[#fcfcff] min-h-screen dark:bg-[#1D253D]">
            <div className="max-w-350 mx-auto p-4 md:p-10">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar: Application List */}
                    <div className="w-full lg:w-100 shrink-0 space-y-6">
                        <div className="flex gap-2">
                            <button className="px-4 py-2 bg-km-surface-card border border-km-border rounded-xl text-sm font-medium text-km-text-secondary hover:border-km-primary hover:text-km-heading transition">
                                Recruiter Action (7)
                            </button>
                            <button className="px-4 py-2 bg-km-surface-card border border-km-border rounded-xl text-sm font-medium text-km-text-secondary hover:border-km-primary hover:text-km-heading transition">
                                Applied On KM (12)
                            </button>
                        </div>

                        <div className="space-y-3">
                            {applications.map((app) => {
                                const isJobDeleted = !app.job || app.job.status === "Deleted";
                                const isJobClosed = app.job?.status === "Closed";

                                return (
                                    <button
                                        key={app.id}
                                        onClick={() => setSelectedId(app.id)}
                                        className={cn(
                                            "w-full text-left p-5 rounded-2xl transition-all duration-300 border cursor-pointer",
                                            selectedId === app.id
                                                ? "bg-blue-50/40 border-blue-200 shadow-sm ring-1 ring-km-primary/30"
                                                : "bg-km-surface-card border-km-border hover:border-blue-100 hover:bg-km-surface"
                                        )}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <h3 className="font-bold text-km-text-primary truncate text-[17px]">
                                                {app?.job?.title || "Position Closed / Removed"}
                                            </h3>
                                            {isJobDeleted ? (
                                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-km-surface text-km-text-secondary font-medium">
                                                    Removed
                                                </span>
                                            ) : isJobClosed ? (
                                                <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/80 font-medium">
                                                    Closed
                                                </span>
                                            ) : null}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1 text-sm text-km-text-secondary">
                                            <span>{app?.job?.company || "Listing archived"}</span>
                                            {app?.job?.rating ? (
                                                <>
                                                    <div className="flex items-center gap-0.5 text-amber-500 font-medium dark:text-amber-400">
                                                        <StarIcon weight="fill" className="w-3.5 h-3.5 fill-current" />
                                                        <span>{app?.job?.rating}</span>
                                                    </div>
                                                    <span className="text-km-text-muted">|</span>
                                                    <span>{app?.job?.reviews_count}</span>
                                                </>
                                            ) : null}
                                        </div>

                                        <div className="mt-4 flex items-center justify-between">
                                            <div className={cn("flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border", getStatusBadgeClass(app.status))}>
                                                <CheckCircleIcon weight="bold" className="w-3 h-3" />
                                                {getStatusDisplay(app.status)} {formatTimeAgo(app.updated_at)}
                                            </div>
                                            <span className="text-[11px] text-km-text-secondary font-medium">
                                                {app?.job?.last_active || (isJobDeleted ? "Archived" : "")}
                                            </span>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Content: Application Detail */}
                    <div className="flex-1 bg-km-surface-card border border-km-border rounded-4xl p-8 md:p-12 shadow-sm min-h-175">
                        {selectedApp ? (
                            <div className="space-y-10">
                                {/* Job Header */}
                                <div className="space-y-3">
                                    <h1 className="text-2xl sm:text-3xl font-bold text-km-text-primary">
                                        {selectedApp?.job?.title || "Position Closed / Removed"}
                                        {selectedApp?.job?.location ? ` | ${selectedApp.job.location}` : ""}
                                    </h1>

                                    {(!selectedApp.job || selectedApp.job.status === "Deleted") && (
                                        <div className="p-3 rounded-xl bg-km-surface border border-km-border text-xs text-km-text-secondary flex items-center gap-2">
                                            <WarningCircleIcon size={16} weight="regular" className="text-km-text-secondary shrink-0" aria-hidden="true" />
                                            <span>This opening was removed by the employer. Your past application record remains securely preserved below.</span>
                                        </div>
                                    )}

                                    {selectedApp.job && selectedApp.job.status === "Closed" && (
                                        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                                            <WarningCircleIcon size={16} weight="regular" className="text-amber-600 shrink-0" aria-hidden="true" />
                                            <span>This opening is closed to new applicants. Your application is under review.</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3 text-km-text-secondary font-medium">
                                        <span className="text-km-text-primary font-bold">{selectedApp?.job?.company || "Employer"}</span>
                                        {selectedApp?.job?.rating ? (
                                            <>
                                                <div className="flex items-center gap-1 text-amber-500 dark:text-amber-400">
                                                    <StarIcon weight="fill" className="w-4 h-4 fill-current" />
                                                    <span>{selectedApp?.job?.rating}</span>
                                                </div>
                                                <span className="text-km-text-muted">|</span>
                                                <span>{selectedApp?.job?.reviews_count}</span>
                                            </>
                                        ) : null}
                                    </div>
                                    <Link 
                                        href={`/jobs${selectedApp?.job?.title ? `?search=${encodeURIComponent(selectedApp.job.title)}` : ""}`}
                                        className="mt-2 text-km-heading font-bold text-sm hover:underline inline-flex items-center gap-1"
                                    >
                                        <span>View Similar Jobs</span>
                                        <ArrowSquareOutIcon weight="bold" className="w-3.5 h-3.5" aria-hidden="true" />
                                    </Link>
                                </div>

                                <div className="h-px bg-km-surface w-full" />

                                {/* Status Stepper */}
                                <div className="space-y-8">
                                    <h2 className="text-xl font-bold text-km-text-primary">Application Status</h2>
                                    <div className="relative pt-4 px-4">
                                        {/* Background Trace */}
                                        <div className="absolute top-4.5 left-[5%] right-[5%] h-1 bg-km-surface rounded-full" />

                                        {(() => {
                                            const statusMap: Record<string, number> = {
                                                "Applied": 0,
                                                "Viewed": 1,
                                                "Shortlisted": 2,
                                                "Interviewing": 3,
                                                "Hired": 4,
                                                "Rejected": -1,
                                                "Withdrawn": -1
                                            };
                                            const currentIndex = statusMap[selectedApp.status] ?? 0;
                                            const progressWidth = currentIndex >= 0 ? (currentIndex / (STEPS.length - 1)) * 90 : 0;

                                            return (
                                                <>
                                                    {/* Progress Trace */}
                                                    <div
                                                        className="absolute top-4.5 left-[5%] h-1 bg-km-primary rounded-full transition-all duration-1000"
                                                        style={{ width: `${progressWidth}%` }}
                                                    />

                                                    <div className="relative flex justify-between">
                                                        {STEPS.map((step, idx) => {
                                                            const isActive = currentIndex >= idx;
                                                            return (
                                                                <div key={step.key} className="flex flex-col items-center group w-1/5">
                                                                    <div className={cn(
                                                                        "w-4 h-4 rounded-full border-4 z-10 transition-all duration-300 ring-4",
                                                                        isActive
                                                                            ? "bg-km-surface-card border-km-primary ring-blue-100"
                                                                            : "bg-km-surface-card border-km-border ring-transparent"
                                                                    )} />
                                                                    <span className={cn(
                                                                        "mt-4 text-[11px] font-bold text-center max-w-25",
                                                                        isActive ? "text-km-heading font-bold" : "text-km-text-secondary"
                                                                    )}>
                                                                        {step.label}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>

                                {["Applied", "Viewed", "Shortlisted", "Interviewing"].includes(selectedApp.status) && (
                                    <div className="flex flex-col gap-3 rounded-2xl border border-km-border bg-km-surface p-4 sm:flex-row sm:items-center sm:justify-between">
                                        <p className="text-sm text-km-text-secondary">
                                            {confirmWithdraw === selectedApp.id
                                                ? "Withdraw this application? The employer will be told, and any upcoming interview for this job will be cancelled. You can't apply to this job again."
                                                : "No longer interested? You can withdraw your application."}
                                        </p>
                                        {confirmWithdraw === selectedApp.id ? (
                                            <div className="flex shrink-0 gap-2">
                                                <button type="button" onClick={() => setConfirmWithdraw(null)} disabled={withdrawing} className="rounded-xl border border-km-border bg-km-surface-card px-4 py-2 text-sm font-semibold text-km-text-primary hover:bg-km-surface">
                                                    Keep it
                                                </button>
                                                <button type="button" onClick={() => withdraw(selectedApp.id)} disabled={withdrawing} className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60">
                                                    {withdrawing ? "Withdrawing…" : "Yes, withdraw"}
                                                </button>
                                            </div>
                                        ) : (
                                            <button type="button" onClick={() => setConfirmWithdraw(selectedApp.id)} className="shrink-0 rounded-xl border border-km-border bg-km-surface-card px-4 py-2 text-sm font-semibold text-km-text-primary hover:border-rose-300 hover:text-rose-700">
                                                Withdraw application
                                            </button>
                                        )}
                                    </div>
                                )}
                                {selectedApp.status === "Withdrawn" && (
                                    <p className="rounded-2xl border border-km-border bg-km-surface p-4 text-sm text-km-text-secondary">
                                        You withdrew this application. The employer can no longer move it forward.
                                    </p>
                                )}

                                <div className="h-px bg-km-surface w-full" />

                                {/* Matching Criteria */}
                                <div className="space-y-6">
                                    <div className="space-y-1">
                                        <h2 className="text-xl font-bold text-km-text-primary">What may work for you?</h2>
                                        <p className="text-km-text-secondary font-medium">Following criteria suggests how well you match with the job.</p>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4">
                                        {[
                                            { label: "Early Applicant", match: true },
                                            { label: "Keyskills", match: false },
                                            { label: "Location", match: false },
                                            { label: "Work Experience", match: false },
                                            { label: "Industry", match: false },
                                            { label: "Department", match: true },
                                        ].map((item, idx) => (
                                            <div key={idx} className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-5 h-5 rounded-full flex items-center justify-center transition-colors",
                                                    item.match ? "bg-emerald-500" : "bg-km-border"
                                                )}>
                                                    <CheckCircleIcon weight="bold" className="w-3.5 h-3.5 text-white" />
                                                </div>
                                                <span className={cn(
                                                    "font-bold text-[15px]",
                                                    item.match ? "text-km-text-primary" : "text-km-text-secondary"
                                                )}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-km-surface w-full" />

                                {/* Company Footer */}
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-3xl bg-km-surface border border-km-border mt-auto">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-km-primary-dark rounded-full flex items-center justify-center text-white overflow-hidden shadow-sm">
                                            <div className="relative">
                                                <LightningIcon weight="fill" className="w-8 h-8 fill-km-accent text-km-accent transform rotate-12" />
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-km-text-primary text-lg">{selectedApp?.job?.company || "Employer"}</h3>
                                            <p className="text-km-text-secondary text-sm font-medium">{selectedApp?.job?.city_name || selectedApp?.job?.location || "Location not specified"}</p>
                                            <p className="text-[11px] text-km-text-secondary mt-1 font-bold italic">
                                                {getStatusDisplay(selectedApp.status)} {formatTimeAgo(selectedApp.updated_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="p-3 bg-blue-50 text-km-heading rounded-xl hover:bg-blue-100 transition">
                                            <PhoneCallIcon className="w-5 h-5" />
                                        </button>
                                        <button className="px-6 py-2.5 bg-km-surface-card border border-km-border rounded-xl font-bold text-km-text-primary hover:border-km-primary hover:text-km-heading transition flex items-center gap-2 text-sm">
                                            <ChatIcon weight="bold" className="w-4 h-4" />
                                            Chat With HR
                                        </button>
                                        <button className="px-8 py-2.5 bg-km-primary text-white rounded-xl font-bold hover:bg-km-primary-dark transition shadow-sm text-sm">
                                            Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                                <ClockIcon size={48} weight="duotone" className="text-km-text-muted" aria-hidden="true" />
                                <h3 className="text-xl font-bold text-km-text-primary">Select an application</h3>
                                <p className="text-km-text-secondary max-w-62.5">Choose an application from the left to see its detailed status and next steps.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
