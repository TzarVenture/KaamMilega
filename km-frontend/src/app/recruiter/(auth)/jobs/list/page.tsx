"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import { notify } from "@/lib/notify";
import { BriefcaseIcon, EyeIcon, FunnelSimpleIcon, MagnifyingGlassIcon, MapPinIcon, NotePencilIcon, TrashIcon } from '@phosphor-icons/react';

import { TableSkeleton, PageHeaderSkeleton } from "@/components/ui/LoadingSkeleton";

export default function ManageJobsPage() {
    const [jobs, setJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");

    const fetchJobs = async () => {
        try {
            const data = await api.get("/jobs/my") as any[];
            setJobs(data);

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

    const handleDelete = async (id: string) => {
        if (!confirm("Are you sure you want to delete this job?")) return;

        try {
            await api.delete(`/jobs/${id}`);
            setJobs(jobs.filter(job => job.id !== id));
            notify.success("Job deleted successfully");
        } catch (error) {
            console.error("Failed to delete job:", error);
            notify.error("Failed to delete job");
        }
    };

    const filteredJobs = jobs.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
            <div className="bg-km-surface-card p-3 rounded-2xl border border-km-border shadow-xs flex items-center gap-3">
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
                <div className="text-xs text-km-text-secondary font-medium px-2 py-1 bg-km-surface rounded-lg border border-km-border/70 shrink-0">
                    {filteredJobs.length} {filteredJobs.length === 1 ? "Job" : "Jobs"}
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
                                            <span
                                                className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                                    job.status === "Open" || !job.status
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/50 dark:text-emerald-400"
                                                        : "bg-km-surface text-km-text-secondary border-km-border"
                                                }`}
                                            >
                                                {job.status || "Open"}
                                            </span>
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
                                            <div className="flex items-center justify-end gap-1">
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
                                                    onClick={() => handleDelete(job.id)}
                                                    className="p-1.5 text-km-text-secondary hover:text-red-600 hover:bg-red-50/70 rounded-lg transition-colors"
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
        </div>
    );
}
