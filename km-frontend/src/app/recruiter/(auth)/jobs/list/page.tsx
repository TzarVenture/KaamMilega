"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import { notify } from "@/lib/notify";
import { 
    BriefcaseIcon, 
    CircleNotchIcon, 
    EyeIcon, 
    KanbanIcon,
    MagnifyingGlassIcon, 
    MapPinIcon, 
    NotePencilIcon, 
    TrashIcon, 
    XIcon 
} from '@phosphor-icons/react';

import { TableSkeleton, PageHeaderSkeleton } from "@/components/ui/LoadingSkeleton";

export default function ManageJobsPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<string>("all");
    const [deleteModalJob, setDeleteModalJob] = useState<{ id: string; title: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const fetchJobs = async () => {
        try {
            const data = await api.get("/jobs/my") as any[];
            setJobs(data || []);
        } catch (error) {
            console.error("Failed to fetch jobs:", error);
            notify.error("Failed to load jobs");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);



    const confirmDelete = async () => {
        if (!deleteModalJob) return;
        setIsDeleting(true);
        try {
            await api.delete(`/jobs/${deleteModalJob.id}`);
            setJobs(prev => prev.filter(job => job.id !== deleteModalJob.id));
            notify.success("Job posting removed successfully");
            setDeleteModalJob(null);
        } catch (error) {
            console.error("Failed to delete job:", error);
            notify.error("Failed to delete job");
        } finally {
            setIsDeleting(false);
        }
    };

    const filteredJobs = jobs.filter(job => {
        const matchesSearch = 
            job.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            job.company?.toLowerCase().includes(searchTerm.toLowerCase());
        
        if (!matchesSearch) return false;
        
        if (statusFilter === "all") return true;
        const s = (job.status || "Open").toLowerCase();
        if (statusFilter === "open") return s === "open";
        if (statusFilter === "closed") return s === "closed";
        if (statusFilter === "on hold") return s === "on hold" || s === "onhold";
        return true;
    });

    if (loading) {
        return (
            <div className="space-y-6">
                <PageHeaderSkeleton />
                <TableSkeleton rows={5} cols={5} />
            </div>
        );
    }

    return (
        <div className="space-y-6 font-sans text-km-text-primary pb-16">

            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-km-text-primary font-poppins">Manage Job Postings</h1>
                    <p className="text-xs text-km-text-secondary mt-0.5">View, edit, and track applicants across all your active positions</p>
                </div>
                <Link
                    href="/recruiter/jobs/create"
                    className="inline-flex items-center gap-2 bg-km-primary hover:bg-km-primary-dark text-white px-4 py-2.5 rounded-xl font-semibold text-xs transition-colors shadow-xs shrink-0"
                >
                    <BriefcaseIcon size={16} weight="bold" aria-hidden="true" />
                    <span>Post New Job</span>
                </Link>
            </header>

            {/* Search and Filter Bar */}
            <div className="bg-km-surface-card p-3 rounded-2xl border border-km-border shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex-1 relative">
                        <MagnifyingGlassIcon size={16} weight="regular" className="absolute left-3 top-2.5 text-km-text-secondary" aria-hidden="true" />
                        <input
                            type="text"
                            placeholder="Search jobs by title or company..."
                            className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 outline-none focus:border-km-primary transition-colors"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                        {[
                            { id: "all", label: "All", count: jobs.length },
                            { id: "open", label: "Open", count: jobs.filter(j => (j.status || "Open").toLowerCase() === "open").length },
                            { id: "closed", label: "Closed", count: jobs.filter(j => (j.status || "").toLowerCase() === "closed").length },
                            { id: "on hold", label: "On Hold", count: jobs.filter(j => { const s = (j.status || "").toLowerCase(); return s === "on hold" || s === "onhold"; }).length },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setStatusFilter(tab.id)}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer shrink-0 border ${
                                    statusFilter === tab.id
                                        ? "bg-km-primary text-white border-km-primary shadow-xs"
                                        : "bg-km-surface hover:bg-km-surface/80 text-km-text-secondary hover:text-km-text-primary border-km-border/70"
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                                    statusFilter === tab.id ? "bg-white/20 text-white" : "bg-km-border/60 text-km-text-secondary"
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {filteredJobs.length === 0 ? (
                <div className="text-center py-14 bg-km-surface-card rounded-2xl border border-km-border shadow-xs p-6">
                    <BriefcaseIcon size={36} weight="duotone" className="text-km-text-secondary mx-auto mb-3" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-km-text-primary font-poppins">No jobs found</h3>
                    <p className="text-xs text-km-text-secondary mt-1 mb-4 max-w-sm mx-auto">
                        {searchTerm ? "No job postings matched your search criteria." : "You haven't posted any jobs yet. Create your first opening to attract talent."}
                    </p>
                    <Link
                        href="/recruiter/jobs/create"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                    >
                        <BriefcaseIcon size={15} weight="bold" aria-hidden="true" />
                        <span>Post a new job</span>
                    </Link>
                </div>
            ) : (
                <div className="bg-km-surface-card rounded-2xl border border-km-border shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-km-text-secondary">
                            <thead className="bg-km-surface text-km-text-secondary font-semibold border-b border-km-border/70">
                                <tr>
                                    <th className="px-5 py-3">Job Title & Company</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Salary Range</th>
                                    <th className="px-5 py-3">Location</th>
                                    <th className="px-5 py-3 text-center">Applications</th>
                                    <th className="px-5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-km-border/60">
                                {filteredJobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-km-surface/50 transition-colors">
                                        <td className="px-5 py-3.5">
                                            <div className="font-semibold text-km-text-primary text-xs">{job.title}</div>
                                            <div className="text-[11px] text-km-text-secondary mt-0.5">{job.company}</div>
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {(() => {
                                                const s = (job.status || "Open").toLowerCase();
                                                return (
                                                    <span
                                                        title="To change status, edit this job posting"
                                                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border select-none capitalize ${
                                                            s === "closed"
                                                                ? "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/30 dark:border-rose-900/50 dark:text-rose-400"
                                                                : s === "on hold" || s === "onhold"
                                                                ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 dark:text-amber-400"
                                                                : s === "draft"
                                                                ? "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/40 dark:border-slate-700 dark:text-slate-300"
                                                                : "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400"
                                                        }`}
                                                    >
                                                        {job.status || "Open"}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-5 py-3.5 font-medium text-km-text-primary">
                                            {job.salary_min && job.salary_max
                                                ? `₹${job.salary_min} – ₹${job.salary_max}`
                                                : job.salary_range || "Not specified"}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-1.5 text-km-text-secondary">
                                                <MapPinIcon weight="regular" size={13} className="shrink-0 text-km-text-secondary" aria-hidden="true" />
                                                <span className="truncate">{job.city_name || "Anywhere"} {job.location ? `(${job.location})` : ""}</span>
                                            </div>
                                        </td>

                                        <td className="px-5 py-3.5 text-center">
                                            <Link
                                                href={`/recruiter/applications?jobId=${job.id}`}
                                                className="inline-flex items-center justify-center px-2.5 py-0.5 bg-blue-50 text-km-blue border border-blue-200 rounded-full font-semibold text-xs hover:bg-blue-100 transition-colors dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-km-link"
                                            >
                                                {job.applicant_count || 0}
                                            </Link>
                                        </td>
                                        <td className="px-5 py-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <Link
                                                    href={`/recruiter/applications?jobId=${job.id}`}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-km-surface hover:bg-km-primary hover:text-white text-km-text-primary border border-km-border transition-colors mr-0.5 shrink-0"
                                                    title="Open Candidate Pipeline"
                                                    aria-label={`Open candidate pipeline for ${job.title}`}
                                                >
                                                    <KanbanIcon size={14} weight="regular" aria-hidden="true" />
                                                    <span>Pipeline</span>
                                                </Link>
                                                <Link
                                                    href={`/recruiter/jobs/${job.id}`}
                                                    className="p-1.5 text-km-text-secondary hover:text-km-blue hover:bg-km-surface rounded-lg transition-colors"
                                                    title="View Details"
                                                    aria-label="View Details"
                                                >
                                                    <EyeIcon weight="regular" size={16} aria-hidden="true" />
                                                </Link>
                                                <Link
                                                    href={`/recruiter/jobs/${job.id}/edit`}
                                                    className="p-1.5 text-km-text-secondary hover:text-km-blue hover:bg-km-surface rounded-lg transition-colors"
                                                    title="Edit Post"
                                                    aria-label="Edit Post"
                                                >
                                                    <NotePencilIcon weight="regular" size={16} aria-hidden="true" />
                                                </Link>
                                                <button
                                                    type="button"
                                                    onClick={() => setDeleteModalJob({ id: job.id, title: job.title })}
                                                    className="p-1.5 text-km-text-secondary hover:text-red-600 hover:bg-red-50/70 rounded-lg transition-colors cursor-pointer"
                                                    title="Delete Post"
                                                    aria-label="Delete Post"
                                                >
                                                    <TrashIcon weight="regular" size={16} aria-hidden="true" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-5 py-3 border-t border-km-border/70 text-xs text-km-text-secondary flex justify-between items-center bg-km-surface/30">
                        <span>Showing {filteredJobs.length} job postings</span>
                    </div>
                </div>
            )}

            {/* In-App Delete Confirmation Modal */}
            {deleteModalJob && (
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
                                onClick={() => !isDeleting && setDeleteModalJob(null)}
                                disabled={isDeleting}
                                aria-label="Close dialog"
                                className="p-1 text-km-text-secondary hover:text-km-text-primary rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            >
                                <XIcon size={18} weight="regular" aria-hidden="true" />
                            </button>
                        </div>

                        <p className="text-xs text-km-text-secondary leading-relaxed">
                            Are you sure you want to remove <span className="font-semibold text-km-text-primary">&ldquo;{deleteModalJob.title}&rdquo;</span>? This will unlist the position and mark it as deleted. Existing candidate applications will be safely preserved in your records.
                        </p>

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalJob(null)}
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
