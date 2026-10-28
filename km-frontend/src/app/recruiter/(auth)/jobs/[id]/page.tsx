"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import { 
    ArrowLeftIcon, 
    BuildingOfficeIcon, 
    CalendarBlankIcon, 
    CheckCircleIcon, 
    CircleNotchIcon, 
    ClockIcon, 
    CurrencyInrIcon, 
    NotePencilIcon, 
    TrashIcon, 
    UsersIcon, 
    WarningCircleIcon, 
    XIcon 
} from '@phosphor-icons/react';
import Link from "next/link";
import { notify } from "@/lib/notify";

export default function JobDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const jobId = params?.id as string;

    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        const fetchJob = async () => {
            try {
                const data = await api.get(`/jobs/${jobId}`);
                setJob(data);
            } catch (error) {
                console.error("Failed to fetch job", error);
                notify.error("Job not found or access denied");
                router.push("/recruiter/jobs/list");
            } finally {
                setLoading(false);
            }
        };

        if (jobId) fetchJob();
    }, [jobId, router]);



    const confirmDelete = async () => {
        setIsDeleting(true);
        try {
            await api.delete(`/jobs/${jobId}`);
            notify.success("Job deleted successfully");
            router.push("/recruiter/jobs/list");
        } catch (error) {
            console.error("Failed to delete job:", error);
            notify.error("Failed to delete job");
            setIsDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
                <CircleNotchIcon size={32} weight="bold" className="animate-spin text-km-primary" aria-hidden="true" />
                <p className="text-xs text-km-text-secondary">Loading job details...</p>
            </div>
        );
    }

    if (!job) return null;

    return (
        <div className="max-w-5xl mx-auto pb-16 px-4 font-sans text-km-text-primary">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-6">
                <Link
                    href="/recruiter/jobs/list"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-km-text-secondary hover:text-km-text-primary transition-colors"
                >
                    <ArrowLeftIcon size={14} weight="bold" aria-hidden="true" />
                    <span>Back to Manage Jobs</span>
                </Link>
                <div className="flex items-center gap-2">
                    <Link
                        href={`/recruiter/jobs/${jobId}/edit`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-km-border bg-km-surface-card hover:bg-km-surface rounded-xl text-xs font-medium text-km-text-primary transition-colors shadow-xs"
                    >
                        <NotePencilIcon size={14} weight="regular" aria-hidden="true" />
                        <span>Edit Post</span>
                    </Link>
                    <button
                        type="button"
                        onClick={() => setIsDeleteModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-red-200 bg-km-surface-card text-red-600 hover:bg-red-50/70 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                    >
                        <TrashIcon size={14} weight="regular" aria-hidden="true" />
                        <span>Delete</span>
                    </button>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-5">
                    {/* Header Card */}
                    <div className="bg-km-surface-card p-6 rounded-2xl border border-km-border shadow-xs">
                        <div className="flex items-start justify-between mb-4">
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold text-km-text-primary font-poppins">{job.title}</h1>
                                <div className="flex items-center gap-3 mt-1.5">
                                    <span className="flex items-center gap-1.5 text-xs text-km-text-secondary font-medium">
                                        <BuildingOfficeIcon size={14} weight="regular" className="text-km-blue" aria-hidden="true" />
                                        <span>{job.company}</span>
                                    </span>
                                    {(() => {
                                        const s = (job.status || "Open").toLowerCase();
                                        return (
                                            <span
                                                title="To change status, edit this job posting"
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border select-none capitalize ${
                                                    s === "closed"
                                                        ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-[#23142B] dark:border-rose-900/50 dark:text-rose-400"
                                                        : s === "on hold" || s === "onhold"
                                                        ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#211A25] dark:border-amber-900/50 dark:text-amber-400"
                                                        : s === "draft"
                                                        ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#626A7D] dark:border-slate-700 dark:text-slate-300"
                                                        : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#0C1F2E] dark:border-emerald-900/50 dark:text-emerald-400"
                                                }`}
                                            >
                                                {job.status || "Open"}
                                            </span>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 bg-km-surface rounded-xl border border-km-border/60">
                            <div>
                                <p className="text-[10px] text-km-text-secondary font-semibold uppercase tracking-wider mb-0.5">Salary</p>
                                <p className="text-xs font-bold text-km-text-primary">
                                    {job.salary_min && job.salary_max ? `₹${job.salary_min} – ₹${job.salary_max}` : "Not Disclosed"}
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-km-text-secondary font-semibold uppercase tracking-wider mb-0.5">Location</p>
                                <p className="text-xs font-semibold text-km-text-primary">{job.city_name || job.location || "Anywhere"}</p>
                            </div>
                            <div>
                                <p className="text-[10px] text-km-text-secondary font-semibold uppercase tracking-wider mb-0.5">Experience</p>
                                <p className="text-xs font-semibold text-km-text-primary">
                                    {job.experience_min ?? 0} – {job.experience_max ?? 0} Yrs
                                </p>
                            </div>
                            <div>
                                <p className="text-[10px] text-km-text-secondary font-semibold uppercase tracking-wider mb-0.5">Type</p>
                                <p className="text-xs font-semibold text-km-text-primary">{job.job_type || "Full-time"}</p>
                            </div>
                        </div>
                    </div>

                    {/* Description Section */}
                    <div className="bg-km-surface-card p-6 rounded-2xl border border-km-border shadow-xs">
                        <h2 className="text-sm font-bold text-km-text-primary font-poppins mb-3">Job Description</h2>
                        <p className="text-xs text-km-text-secondary leading-relaxed whitespace-pre-wrap">{job.description}</p>
                    </div>

                    {/* Requirements Section */}
                    {job.requirements?.length > 0 && (
                        <div className="bg-km-surface-card p-6 rounded-2xl border border-km-border shadow-xs">
                            <h2 className="text-sm font-bold text-km-text-primary font-poppins mb-3 flex items-center gap-1.5">
                                <CheckCircleIcon size={16} weight="regular" className="text-km-blue" aria-hidden="true" />
                                <span>Candidate Requirements</span>
                            </h2>
                            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                {job.requirements.map((req: string, i: number) => (
                                    <li key={i} className="flex items-start gap-2 p-2.5 bg-km-surface rounded-xl border border-km-border/60 text-xs text-km-text-primary font-medium">
                                        <span className="w-1.5 h-1.5 rounded-full bg-km-blue mt-1.5 shrink-0" />
                                        <span>{req}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* Benefits Section */}
                    {job.we_offer?.length > 0 && (
                        <div className="bg-km-surface-card p-6 rounded-2xl border border-km-border shadow-xs">
                            <h2 className="text-sm font-bold text-km-text-primary font-poppins mb-3 flex items-center gap-1.5">
                                <CurrencyInrIcon size={16} weight="regular" className="text-emerald-600" aria-hidden="true" />
                                <span>Perks & Benefits</span>
                            </h2>
                            <div className="flex flex-wrap gap-2">
                                {job.we_offer.map((offer: string, i: number) => (
                                    <span key={i} className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200/80 rounded-lg font-medium text-xs dark:bg-[#0C1F2E] dark:border-emerald-900/50 dark:text-emerald-400">
                                        {offer}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-4">
                    <div className="km-on-dark bg-gradient-to-br from-km-primary to-km-primary-dark p-6 rounded-2xl text-white shadow-xs border border-km-primary-dark">
                        <UsersIcon size={28} weight="duotone" className="text-white mb-2" aria-hidden="true" />
                        <h3 className="text-sm font-bold font-poppins mb-0.5">Candidate Pipeline</h3>
                        <p className="text-white/85 text-xs mb-4">Total applicants registered for this job opening.</p>
                        <div className="text-3xl font-bold font-poppins mb-5">
                            {job.applicant_count || 0}
                        </div>
                        <Link
                            href={`/recruiter/applications?jobId=${jobId}`}
                            className="block w-full text-center py-2 bg-white hover:bg-slate-100 text-km-primary rounded-xl text-xs font-semibold transition-colors shadow-xs"
                        >
                            Open Candidate Pipeline
                        </Link>
                    </div>

                    <div className="bg-km-surface-card p-5 rounded-2xl border border-km-border shadow-xs">
                        <h3 className="text-xs font-bold font-poppins text-km-text-primary mb-3 border-b border-km-border/70 pb-2">Posting Details</h3>
                        <div className="space-y-3">
                            <div className="flex items-center gap-2.5">
                                <CalendarBlankIcon size={16} weight="regular" className="text-km-text-secondary" aria-hidden="true" />
                                <div>
                                    <p className="text-[10px] uppercase font-semibold text-km-text-secondary">Posted On</p>
                                    <p className="text-xs font-medium text-km-text-primary">{new Date(job.created_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5">
                                <ClockIcon size={16} weight="regular" className="text-km-text-secondary" aria-hidden="true" />
                                <div>
                                    <p className="text-[10px] uppercase font-semibold text-km-text-secondary">Last Updated</p>
                                    <p className="text-xs font-medium text-km-text-primary">{new Date(job.updated_at).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2.5 pt-1 text-km-text-secondary">
                                <WarningCircleIcon size={16} weight="regular" aria-hidden="true" />
                                <p className="text-[11px] truncate">Job ID: {job.id}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* In-App Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="delete-job-dialog-title"
                >
                    <div className="w-full max-w-md bg-km-surface-card rounded-2xl border border-km-border shadow-xl p-6 space-y-4 animate-in fade-in duration-150">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                                <TrashIcon size={20} weight="regular" className="text-red-600 shrink-0" aria-hidden="true" />
                                <h3 id="delete-job-dialog-title" className="text-base font-bold text-km-text-primary font-poppins">
                                    Delete Job Posting
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => !isDeleting && setIsDeleteModalOpen(false)}
                                disabled={isDeleting}
                                aria-label="Close dialog"
                                className="p-1 text-km-text-secondary hover:text-km-text-primary rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <XIcon size={18} weight="regular" aria-hidden="true" />
                            </button>
                        </div>

                        <p className="text-xs text-km-text-secondary leading-relaxed">
                            Are you sure you want to remove <span className="font-semibold text-km-text-primary">&ldquo;{job.title}&rdquo;</span>? This will unlist the position and mark it as deleted. Existing candidate applications will be safely preserved in your records.
                        </p>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsDeleteModalOpen(false)}
                                disabled={isDeleting}
                                className="px-4 py-2 rounded-xl text-xs font-semibold border border-km-border text-km-text-primary hover:bg-km-surface transition-colors disabled:opacity-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={confirmDelete}
                                disabled={isDeleting}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                            >
                                {isDeleting ? (
                                    <>
                                        <CircleNotchIcon size={14} weight="bold" className="animate-spin" aria-hidden="true" />
                                        <span>Deleting...</span>
                                    </>
                                ) : (
                                    <>
                                        <TrashIcon size={14} weight="regular" aria-hidden="true" />
                                        <span>Delete Job</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
