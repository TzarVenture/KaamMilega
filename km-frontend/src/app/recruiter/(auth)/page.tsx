"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import { notify } from "@/lib/notify";
import FileLink from '@/components/ui/FileLink';
import { ArrowUpRightIcon, BriefcaseIcon, BuildingOfficeIcon, CalendarBlankIcon, CaretRightIcon, ClockIcon, FileTextIcon, KanbanIcon, PlusCircleIcon, ShieldCheckIcon, TrendUpIcon, UserCheckIcon, UsersIcon, WarningCircleIcon } from '@phosphor-icons/react';

// --- Shimmer Loading Skeleton ---
const RecruiterDashboardSkeleton = () => (
    <div className="space-y-8">
        <div className="h-32 bg-km-surface-card rounded-3xl border border-slate-200/80 animate-shimmer shadow-xs" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(n => (
                <div key={n} className="h-32 bg-km-surface-card rounded-3xl border border-slate-200/80 animate-shimmer shadow-xs" />
            ))}
        </div>
        <div className="h-80 bg-km-surface-card rounded-3xl border border-slate-200/80 animate-shimmer shadow-xs" />
    </div>
);

export default function RecruiterDashboard() {
    const [user, setUser] = useState<any>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [interviews, setInterviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch User Profile
            const userData: any = await api.get("/user/profile").catch(() => null);
            setUser(userData);

            // Fetch Recruiter Jobs
            const myJobs = await api.get("/jobs/my").catch(() => []) as any[];
            setJobs(Array.isArray(myJobs) ? myJobs : []);

            // Fetch Applications Received
            const myApps = await api.get("/applications/recruiter/all").catch(() => []) as any[];
            setApplications(Array.isArray(myApps) ? myApps : []);

            // Fetch Scheduled Interviews
            const myInterviews = await api.get("/interviews/my").catch(() => []) as any[];
            setInterviews(Array.isArray(myInterviews) ? myInterviews : []);

        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            notify.error(error, "Failed to refresh recruiter dashboard");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
    }, []);

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            setApplications(prev => prev.map(app =>
                app.id === id ? { ...app, status: newStatus } : app
            ));
            await api.patch(`/applications/${id}/status`, { status: newStatus });
            notify.success(`Applicant status updated to ${newStatus}`);
        } catch (error) {
            notify.error(error, "Failed to update status");
            fetchDashboardData();
        }
    };

    if (loading) {
        return <RecruiterDashboardSkeleton />;
    }

    const companyName = user?.company_name || user?.name || "Company Portal";
    const rawVerification = user?.verification_status || (user?.is_verified ? "verified" : "pending");
    const isVerified = String(rawVerification).toLowerCase() === "verified";

    // Dynamic Calculated Stats (Case-insensitive)
    const activeJobsCount = jobs.filter(j => {
        const s = String(j.status || "").toLowerCase().trim();
        return s === "open" || s === "active" || s === "";
    }).length;

    const totalApplications = applications.length;

    const scheduledInterviews = interviews.filter((i: any) => {
        const s = String(i.status || "").toLowerCase().trim();
        return s === "scheduled" || s === "confirmed" || !s;
    });

    const interviewingCount = interviews.length > 0
        ? scheduledInterviews.length
        : applications.filter(a => {
            const s = String(a.status || "").toLowerCase().trim();
            return s === "interviewing" || s === "interview";
        }).length;

    const hiredCount = applications.filter(a => {
        const s = String(a.status || "").toLowerCase().trim();
        return s === "hired";
    }).length;

    const recentJobs = jobs.slice(0, 5);
    const recentApplications = applications.slice(0, 5);

    return (
        <div className="space-y-6 font-sans text-km-text-primary pb-16">

            {/* Recruiter Welcome Banner */}
            <div className="km-on-dark bg-gradient-to-r from-km-primary via-km-primary-dark to-km-primary text-white rounded-2xl p-6 sm:p-7 border border-km-primary-dark shadow-sm relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
                    <div>
                        <div className="flex items-center gap-2.5 mb-2.5">
                            <span className="px-2.5 py-1 rounded-md bg-[#0B1F52] border border-[#1E3A8A] text-white text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                                <BuildingOfficeIcon weight="bold" size={13} className="text-white" aria-hidden="true" />
                                <span className="text-white">{companyName}</span>
                            </span>

                            {isVerified ? (
                                <span className="px-2.5 py-1 rounded-md bg-[#064E3B] border border-[#047857] text-[#D1FAE5] text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                                    <ShieldCheckIcon weight="bold" size={13} className="text-emerald-300" aria-hidden="true" />
                                    <span className="text-emerald-100">Verified Employer</span>
                                </span>
                            ) : (
                                <span className="px-2.5 py-1 rounded-md bg-[#78350F] border border-[#B45309] text-[#FEF3C7] text-xs font-semibold flex items-center gap-1.5 shadow-2xs">
                                    <WarningCircleIcon weight="bold" size={13} className="text-amber-300" aria-hidden="true" />
                                    <span className="text-amber-100">Verification Pending</span>
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-white font-poppins">
                            Welcome back, {user?.name || "Recruiter"}
                        </h1>
                        <p className="text-white/90 text-xs sm:text-sm mt-1.5 max-w-xl font-normal leading-relaxed">
                            Manage your job postings, candidate applications, and interview schedules.
                        </p>
                    </div>

                    {/* Quick Command Bar */}
                    <div className="flex items-center gap-2.5 shrink-0">
                        <Link
                            href="/recruiter/jobs/create"
                            className="px-4 py-2.5 bg-km-accent hover:bg-km-accent-light text-white font-semibold text-xs rounded-xl shadow-xs flex items-center gap-2 transition-colors shrink-0"
                        >
                            <PlusCircleIcon weight="bold" size={16} aria-hidden="true" />
                            <span>Post New Job</span>
                        </Link>
                        <Link
                            href="/recruiter/applications"
                            className="px-4 py-2.5 border border-white/30 text-white hover:bg-white/10 hover:border-white font-semibold text-xs rounded-xl transition-colors flex items-center gap-2 shrink-0"
                        >
                            <KanbanIcon weight="bold" size={16} aria-hidden="true" />
                            <span>Applicant Pipeline</span>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Metrics Funnel Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-km-surface-card p-5 rounded-2xl border border-km-border shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-km-text-secondary mb-1">Active Postings</p>
                        <h3 className="text-2xl font-bold text-km-text-primary">{activeJobsCount}</h3>
                        <p className="text-[11px] text-km-text-secondary mt-1">Out of {jobs.length} total posts</p>
                    </div>
                    <BriefcaseIcon size={26} weight="duotone" className="text-km-blue shrink-0" aria-hidden="true" />
                </div>

                <div className="bg-km-surface-card p-5 rounded-2xl border border-km-border shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-km-text-secondary mb-1">Total Applications</p>
                        <h3 className="text-2xl font-bold text-km-text-primary">{totalApplications}</h3>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1 font-medium">
                            <TrendUpIcon weight="bold" size={12} aria-hidden="true" />
                            <span>Active candidates</span>
                        </p>
                    </div>
                    <UsersIcon size={26} weight="duotone" className="text-km-primary dark:text-km-link shrink-0" aria-hidden="true" />
                </div>

                <div className="bg-km-surface-card p-5 rounded-2xl border border-km-border shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-km-text-secondary mb-1">Interviews Scheduled</p>
                        <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">{interviewingCount}</h3>
                        <p className="text-[11px] text-km-text-secondary mt-1">Scheduled sessions</p>
                    </div>
                    <CalendarBlankIcon size={26} weight="duotone" className="text-amber-600 dark:text-amber-400 shrink-0" aria-hidden="true" />
                </div>

                <div className="bg-km-surface-card p-5 rounded-2xl border border-km-border shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-xs font-medium text-km-text-secondary mb-1">Successful Hires</p>
                        <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{hiredCount}</h3>
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">Completed recruitment</p>
                    </div>
                    <UserCheckIcon size={26} weight="duotone" className="text-emerald-600 dark:text-emerald-400 shrink-0" aria-hidden="true" />
                </div>
            </div>

            {/* Recent Job Postings */}
            <section className="bg-km-surface-card rounded-2xl border border-km-border shadow-xs overflow-hidden">
                <div className="p-5 border-b border-km-border/70 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-km-text-primary font-poppins">Recent Job Postings</h2>
                        <p className="text-xs text-km-text-secondary mt-0.5">Manage your position listings and view candidate response rates</p>
                    </div>
                    <Link
                        href="/recruiter/jobs/list"
                        className="text-xs font-semibold text-km-blue hover:underline flex items-center gap-1 group"
                    >
                        <span>View All ({jobs.length})</span>
                        <CaretRightIcon weight="bold" size={13} aria-hidden="true" />
                    </Link>
                </div>

                {recentJobs.length === 0 ? (
                    <div className="p-10 text-center">
                        <BriefcaseIcon size={34} weight="duotone" className="text-km-text-secondary mx-auto mb-2.5" aria-hidden="true" />
                        <h3 className="text-sm font-semibold text-km-text-primary">No Job Posts Found</h3>
                        <p className="text-xs text-km-text-secondary mt-1 max-w-sm mx-auto mb-4">
                            You have not published any job listings yet. Create your first post to start receiving candidate applications.
                        </p>
                        <Link
                            href="/recruiter/jobs/create"
                            className="inline-flex items-center gap-2 px-4 py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-semibold transition-colors shadow-xs"
                        >
                            <PlusCircleIcon weight="bold" size={15} aria-hidden="true" />
                            <span>Create Job Post</span>
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-km-text-secondary">
                            <thead className="bg-km-surface text-km-text-secondary font-semibold border-b border-km-border/70">
                                <tr>
                                    <th className="py-3 px-5">Job Title & Company</th>
                                    <th className="py-3 px-5">Status</th>
                                    <th className="py-3 px-5">Location</th>
                                    <th className="py-3 px-5 text-center">Applicants</th>
                                    <th className="py-3 px-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-km-border/60">
                                {recentJobs.map((job) => {
                                    const rawStatus = String(job.status || "Open").trim();
                                    const norm = rawStatus.toLowerCase();
                                    let statusBadge = (
                                        <span className="px-2 py-0.5 rounded-md text-[11px] font-medium border bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#0C1F2E] dark:border-emerald-900/50 dark:text-emerald-400">
                                            Open
                                        </span>
                                    );
                                    if (norm === "closed") {
                                        statusBadge = (
                                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium border bg-rose-50 text-rose-700 border-rose-200 dark:bg-[#23142B] dark:border-rose-900/50 dark:text-rose-400">
                                                Closed
                                            </span>
                                        );
                                    } else if (norm === "on hold" || norm === "on_hold" || norm === "paused") {
                                        statusBadge = (
                                            <span className="px-2 py-0.5 rounded-md text-[11px] font-medium border bg-amber-50 text-amber-700 border-amber-200 dark:bg-[#211A25] dark:border-amber-900/50 dark:text-amber-400">
                                                On Hold
                                            </span>
                                        );
                                    }

                                    const applicantCount = typeof job.applicant_count === "number"
                                        ? job.applicant_count
                                        : typeof job.applicants_count === "number"
                                        ? job.applicants_count
                                        : applications.filter(a => a.job_id === job.id || a.job?.id === job.id || a.job_id === job._id).length;

                                    const jobId = job.id || job._id;

                                    return (
                                        <tr key={jobId} className="hover:bg-km-surface/50 transition-colors">
                                            <td className="py-3.5 px-5">
                                                <p className="font-semibold text-km-text-primary text-xs">{job.title}</p>
                                                <p className="text-km-text-secondary text-[11px]">{job.company}</p>
                                            </td>
                                            <td className="py-3.5 px-5">
                                                {statusBadge}
                                            </td>
                                            <td className="py-3.5 px-5 text-km-text-secondary">
                                                {job.city_name || job.location || "N/A"}
                                            </td>
                                            <td className="py-3.5 px-5 text-center">
                                                <Link
                                                    href={`/recruiter/applications?jobId=${jobId}`}
                                                    className="inline-flex items-center justify-center px-2.5 py-0.5 rounded-full bg-blue-50 text-km-blue border border-blue-200 text-xs font-semibold hover:bg-blue-100 transition-colors dark:bg-[#131D3D] dark:border-blue-900/40 dark:text-km-link"
                                                >
                                                    {applicantCount} {applicantCount === 1 ? "Applicant" : "Applicants"}
                                                </Link>
                                            </td>
                                            <td className="py-3.5 px-5 text-right">
                                                <Link
                                                    href={`/recruiter/applications?jobId=${jobId}`}
                                                    className="inline-flex items-center gap-1 px-3 py-1 bg-km-surface hover:bg-km-primary hover:text-white text-km-text-primary border border-km-border rounded-lg text-xs font-medium transition-colors"
                                                >
                                                    <span>Pipeline</span>
                                                    <ArrowUpRightIcon weight="bold" size={12} aria-hidden="true" />
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Recent Candidate Applications Feed */}
            <section className="bg-km-surface-card rounded-2xl border border-km-border shadow-xs overflow-hidden">
                <div className="p-5 border-b border-km-border/70 flex items-center justify-between">
                    <div>
                        <h2 className="text-base font-bold text-km-text-primary font-poppins">Latest Candidate Applications</h2>
                        <p className="text-xs text-km-text-secondary mt-0.5">Real-time application feed across all active postings</p>
                    </div>
                    <Link
                        href="/recruiter/applications"
                        className="text-xs font-semibold text-km-blue hover:underline flex items-center gap-1 group"
                    >
                        <span>Pipeline Board</span>
                        <CaretRightIcon weight="bold" size={13} aria-hidden="true" />
                    </Link>
                </div>

                {recentApplications.length === 0 ? (
                    <div className="p-10 text-center text-km-text-secondary">
                        <UsersIcon size={34} weight="duotone" className="text-km-text-secondary mx-auto mb-2.5" aria-hidden="true" />
                        <h3 className="text-sm font-semibold text-km-text-primary">No Applications Received Yet</h3>
                        <p className="text-xs text-km-text-secondary mt-1 max-w-sm mx-auto">
                            When job seekers submit applications to your job postings, they will appear right here in real time.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-km-border/60">
                        {recentApplications.map((app) => (
                            <div key={app.id} className="p-4 sm:p-5 hover:bg-km-surface/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-9 h-9 rounded-lg bg-km-surface border border-km-border text-km-primary font-bold flex items-center justify-center shrink-0 uppercase text-xs">
                                        {app.candidate?.name ? app.candidate.name.charAt(0) : "C"}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-semibold text-km-text-primary text-xs">
                                                {app.candidate?.name || `Candidate #${app.candidate_id?.substring(0, 6) || "ID"}`}
                                            </h4>
                                            <span className="text-[11px] text-km-text-secondary flex items-center gap-1">
                                                <ClockIcon weight="regular" size={12} aria-hidden="true" />
                                                <span>{new Date(app.created_at).toLocaleDateString()}</span>
                                            </span>
                                        </div>
                                        <p className="text-xs text-km-text-secondary mt-0.5 truncate">
                                            Applied for <span className="text-km-text-primary font-medium">{app.job?.title || "Position"}</span>
                                        </p>
                                        {app.cover_letter && (
                                            <p className="text-xs text-km-text-secondary italic mt-1 line-clamp-1 bg-km-surface p-1.5 rounded-md border border-km-border/60">
                                                "{app.cover_letter}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-2.5 shrink-0">
                                    {app.resume_url && (
                                        <FileLink
                                            href={app.resume_url}
                                            className="px-2.5 py-1 bg-km-surface hover:bg-km-border/50 text-km-text-primary border border-km-border rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                                        >
                                            <FileTextIcon weight="regular" size={14} aria-hidden="true" />
                                            <span>Resume</span>
                                        </FileLink>
                                    )}

                                    <select
                                        value={app.status}
                                        onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                                        className="text-xs font-medium bg-km-surface-card border border-km-border rounded-lg px-2.5 py-1 text-km-text-primary outline-none focus:border-km-primary"
                                    >
                                        <option value="Applied">Applied</option>
                                        <option value="Shortlisted">Shortlisted</option>
                                        <option value="Interviewing">Interview</option>
                                        <option value="Hired">Hired</option>
                                        <option value="Rejected">Rejected</option>
                                    </select>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
