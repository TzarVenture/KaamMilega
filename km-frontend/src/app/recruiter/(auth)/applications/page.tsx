"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";
import { KanbanSkeleton, PageHeaderSkeleton } from "@/components/ui/LoadingSkeleton";
import { 
    BriefcaseIcon, 
    CalendarBlankIcon, 
    CaretDownIcon, 
    ClockIcon, 
    EyeIcon, 
    FileTextIcon, 
    KanbanIcon, 
    ListBulletsIcon, 
    MagnifyingGlassIcon, 
    XIcon 
} from '@phosphor-icons/react';
import ScheduleInterviewModal from "@/components/recruiter/ScheduleInterviewModal";
import CandidateDetailDrawer from "@/components/recruiter/CandidateDetailDrawer";

const KANBAN_COLUMNS = [
    { id: "Applied", title: "Applied", color: "blue", headerBg: "bg-blue-50 text-blue-700 border-blue-200", colBg: "bg-blue-50/30 border-blue-100" },
    { id: "Shortlisted", title: "Shortlisted", color: "amber", headerBg: "bg-amber-50 text-amber-700 border-amber-200", colBg: "bg-amber-50/30 border-amber-100" },
    { id: "Interviewing", title: "Interview", color: "purple", headerBg: "bg-purple-50 text-purple-700 border-purple-200", colBg: "bg-purple-50/30 border-purple-100" },
    { id: "Hired", title: "Hired", color: "emerald", headerBg: "bg-emerald-50 text-emerald-700 border-emerald-200", colBg: "bg-emerald-50/30 border-emerald-100" },
    { id: "Rejected", title: "Rejected", color: "rose", headerBg: "bg-rose-50 text-rose-700 border-rose-200", colBg: "bg-rose-50/30 border-rose-100" }
];

function ApplicationsContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const jobId = searchParams.get("jobId");

    const [jobs, setJobs] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);
    const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
    const [drawerApp, setDrawerApp] = useState<any | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const [myJobs, appsData] = await Promise.all([
                    api.get("/jobs/my").catch(() => []) as Promise<any[]>,
                    api.get(jobId ? `/applications/job/${jobId}` : "/applications/recruiter/all").catch(() => []) as Promise<any[]>
                ]);
                setJobs(myJobs || []);
                setApplications(appsData || []);
            } catch (error) {
                console.error("Failed to fetch applications:", error);
                notify.error("Failed to load applicant pipeline");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [jobId]);

    const currentJob = jobs.find(j => j.id === jobId);

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            // Optimistic update
            setApplications(apps => apps.map(app =>
                app.id === id ? { ...app, status: newStatus, updated_at: new Date().toISOString() } : app
            ));
            setDrawerApp((prev: any) => prev && prev.id === id ? { ...prev, status: newStatus } : prev);
            await api.patch(`/applications/${id}/status`, { status: newStatus });
            notify.success(`Applicant moved to ${newStatus}`);
        } catch (error) {
            console.error("Failed to update status:", error);
            notify.error("Failed to update applicant status");
            // Revert on error
            const data = await api.get(jobId ? `/applications/job/${jobId}` : "/applications/recruiter/all") as any[];
            setApplications(data || []);
            setDrawerApp((prev: any) => prev ? data.find((a: any) => a.id === prev.id) || null : null);
        }
    };

    const handleDragStart = (e: React.DragEvent, appId: string) => {
        e.dataTransfer.setData("applicationId", appId);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleDragOver = (e: React.DragEvent, colId: string) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        if (dragOverCol !== colId) {
            setDragOverCol(colId);
        }
    };

    const handleDragLeave = () => {
        setDragOverCol(null);
    };

    const handleDrop = (e: React.DragEvent, targetStatus: string) => {
        e.preventDefault();
        setDragOverCol(null);
        const appId = e.dataTransfer.getData("applicationId");
        if (appId) {
            handleStatusUpdate(appId, targetStatus);
        }
    };

    const filteredApps = applications.filter(app => {
        const candidateName = app.candidate?.name?.toLowerCase() || "";
        const candidateEmail = app.candidate?.email?.toLowerCase() || "";
        const candidateHeadline = app.candidate?.headline?.toLowerCase() || "";
        const jobTitle = app.job?.title?.toLowerCase() || "";
        const term = searchTerm.toLowerCase();

        return (
            app.id?.toLowerCase().includes(term) ||
            candidateName.includes(term) ||
            candidateEmail.includes(term) ||
            candidateHeadline.includes(term) ||
            jobTitle.includes(term) ||
            app.status?.toLowerCase().includes(term) ||
            app.cover_letter?.toLowerCase().includes(term)
        );
    });

    if (loading) {
        return (
            <div className="space-y-6">
                <PageHeaderSkeleton />
                <KanbanSkeleton columns={4} cardsPerColumn={3} />
            </div>
        );
    }

    return (
        <div className="space-y-6 font-sans text-km-text-primary pb-16">

            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h1 className="text-xl sm:text-2xl font-bold text-km-text-primary font-poppins">
                            {currentJob ? `Pipeline: ${currentJob.title}` : "Applicant Pipeline"}
                        </h1>
                        {currentJob && (
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-km-blue border border-blue-200 text-xs font-semibold">
                                {currentJob.status || "Open"}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-km-text-secondary mt-0.5">
                        {currentJob 
                            ? `Showing candidate pipeline for ${currentJob.company} • ${currentJob.city_name || currentJob.location || "Anywhere"}`
                            : "Consolidated pipeline view across all your active job openings"}
                    </p>
                </div>

                {/* View Switcher & Clear Button */}
                <div className="flex items-center gap-2.5">
                    {currentJob && (
                        <button
                            type="button"
                            onClick={() => router.push("/recruiter/applications")}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-km-border bg-km-surface-card hover:bg-km-surface text-xs font-semibold text-km-text-secondary hover:text-km-text-primary transition-colors cursor-pointer shadow-xs"
                            title="View all applicants across all jobs"
                        >
                            <XIcon size={14} weight="bold" aria-hidden="true" />
                            <span>View All Jobs</span>
                        </button>
                    )}

                    <div className="bg-km-surface p-1 rounded-xl border border-km-border flex items-center">
                        <button
                            type="button"
                            onClick={() => setViewMode("kanban")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                viewMode === "kanban"
                                    ? "bg-km-surface-card text-km-text-primary shadow-xs"
                                    : "text-km-text-secondary hover:text-km-text-primary"
                            }`}
                        >
                            <KanbanIcon weight={viewMode === "kanban" ? "fill" : "regular"} size={15} aria-hidden="true" />
                            <span>Kanban</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("list")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                                viewMode === "list"
                                    ? "bg-km-surface-card text-km-text-primary shadow-xs"
                                    : "text-km-text-secondary hover:text-km-text-primary"
                            }`}
                        >
                            <ListBulletsIcon weight={viewMode === "list" ? "fill" : "regular"} size={15} aria-hidden="true" />
                            <span>Table View</span>
                        </button>
                    </div>
                </div>
            </div>

            {/* Job Selector & Search Bar Toolbar */}
            <div className="bg-km-surface-card p-3 rounded-2xl border border-km-border shadow-xs flex flex-col sm:flex-row sm:items-center gap-3">
                {/* Job Selector Dropdown */}
                <div className="relative shrink-0">
                    <label htmlFor="pipeline-job-filter" className="sr-only">Filter pipeline by job opening</label>
                    <div className="relative">
                        <BriefcaseIcon size={16} weight="regular" className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-secondary pointer-events-none" aria-hidden="true" />
                        <select
                            id="pipeline-job-filter"
                            value={jobId || "all"}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === "all") {
                                    router.push("/recruiter/applications");
                                } else {
                                    router.push(`/recruiter/applications?jobId=${val}`);
                                }
                            }}
                            className="pl-9 pr-8 py-2 text-xs font-semibold rounded-xl border border-km-border bg-km-surface text-km-text-primary outline-none focus:border-km-primary transition-colors cursor-pointer appearance-none max-w-[280px] truncate"
                        >
                            <option value="all">All Jobs ({jobs.length} postings)</option>
                            {jobs.map((j) => (
                                <option key={j.id} value={j.id}>
                                    {j.title} {j.city_name ? `(${j.city_name})` : ""}
                                </option>
                            ))}
                        </select>
                        <CaretDownIcon size={13} weight="bold" className="absolute right-3 top-1/2 -translate-y-1/2 text-km-text-secondary pointer-events-none" aria-hidden="true" />
                    </div>
                </div>

                {/* Search Input */}
                <div className="flex-1 relative">
                    <MagnifyingGlassIcon weight="regular" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-secondary pointer-events-none" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Search candidate name, email, or keywords..."
                        className="w-full pl-9 pr-3.5 py-2 bg-km-surface rounded-xl border border-km-border text-xs text-km-text-primary placeholder:text-km-text-secondary/70 outline-none focus:border-km-primary transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Total badge */}
                <div className="text-xs text-km-text-secondary font-medium px-2.5 py-1.5 bg-km-surface rounded-xl border border-km-border/70 shrink-0 self-start sm:self-auto">
                    Applicants: <span className="font-semibold text-km-text-primary">{filteredApps.length}</span>
                </div>
            </div>

            {/* KANBAN BOARD VIEW */}
            {viewMode === "kanban" ? (
                <div className="flex gap-4 items-start overflow-x-auto pb-6">
                    {KANBAN_COLUMNS.map((col) => {
                        const colApps = filteredApps.filter(app => {
                            if (col.id === "Interviewing") {
                                return app.status === "Interviewing" || app.status === "Interview";
                            }
                            return app.status === col.id;
                        });

                        const isOver = dragOverCol === col.id;

                        return (
                            <div
                                key={col.id}
                                onDragOver={(e) => handleDragOver(e, col.id)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, col.id)}
                                className={`rounded-2xl border p-3 min-h-[520px] min-w-[280px] sm:min-w-[300px] flex-1 transition-colors flex flex-col bg-km-surface/50 border-km-border ${
                                    isOver ? "border-km-primary bg-blue-50/40 dark:bg-blue-950/20" : ""
                                }`}
                            >
                                {/* Column Header */}
                                <div className="flex items-center justify-between px-3 py-2 rounded-xl border border-km-border bg-km-surface-card text-xs font-semibold text-km-text-primary mb-3 shadow-2xs">
                                    <span className="font-poppins">{col.title}</span>
                                    <span className="px-2 py-0.5 rounded-md bg-km-surface text-km-text-secondary font-semibold text-[11px] border border-km-border/60">
                                        {colApps.length}
                                    </span>
                                </div>

                                {/* Candidate Cards Container */}
                                <div className="space-y-3 flex-1 overflow-y-auto max-h-[660px] pr-0.5">
                                    {colApps.length === 0 ? (
                                        <div className="border border-dashed border-km-border rounded-xl p-6 text-center text-xs text-km-text-secondary font-normal">
                                            No applicants in this stage
                                        </div>
                                    ) : (
                                        colApps.map((app) => (
                                            <div
                                                key={app.id}
                                                draggable={true}
                                                onDragStart={(e) => handleDragStart(e, app.id)}
                                                className="bg-km-surface-card p-3.5 rounded-xl border border-km-border shadow-xs hover:border-km-primary transition-all cursor-grab active:cursor-grabbing group relative space-y-2.5"
                                            >
                                                {/* Candidate Header */}
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div
                                                            onClick={() => setDrawerApp(app)}
                                                            className="w-8 h-8 rounded-lg bg-km-surface border border-km-border text-km-primary font-bold text-xs flex items-center justify-center shrink-0 uppercase hover:bg-km-border/40 transition-colors cursor-pointer"
                                                        >
                                                            {app.candidate?.name ? app.candidate.name.charAt(0) : "C"}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <button
                                                                type="button"
                                                                onClick={() => setDrawerApp(app)}
                                                                className="font-bold text-km-text-primary text-xs truncate hover:text-km-blue transition-colors hover:underline text-left block cursor-pointer"
                                                            >
                                                                {app.candidate?.name || `Candidate #${app.candidate_id?.substring(0, 6) || "ID"}`}
                                                            </button>
                                                            <p className="text-[11px] text-km-text-secondary truncate mt-0.5 font-medium">
                                                                {app.candidate?.headline || app.candidate?.email || "Registered Candidate"}
                                                            </p>
                                                        </div>
                                                    </div>

                                                    <span className="text-[10px] text-km-text-secondary shrink-0 font-medium">
                                                        {new Date(app.created_at).toLocaleDateString(undefined, { month: "numeric", day: "numeric" })}
                                                    </span>
                                                </div>

                                                {/* Job Applied Chip */}
                                                {app.job && (
                                                    <div className="p-2 bg-km-surface rounded-lg text-[11px] text-km-text-secondary font-medium flex items-center gap-1.5 border border-km-border/60">
                                                        <BriefcaseIcon weight="regular" size={13} className="text-km-blue shrink-0" aria-hidden="true" />
                                                        <span className="truncate">{app.job.title}</span>
                                                    </div>
                                                )}

                                                {/* Cover Letter Snippet */}
                                                {app.cover_letter && (
                                                    <p className="text-[11px] text-km-text-secondary italic line-clamp-2 p-2 bg-km-surface rounded-lg border border-km-border/60 leading-relaxed">
                                                        &ldquo;{app.cover_letter}&rdquo;
                                                    </p>
                                                )}

                                                {/* Dedicated Action Buttons Row (No text clipping) */}
                                                <div className="flex items-center justify-between gap-1.5 pt-1 border-t border-km-border/60">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDrawerApp(app)}
                                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-km-blue hover:underline cursor-pointer"
                                                        title="View full candidate profile & application"
                                                    >
                                                        <EyeIcon weight="regular" size={13} aria-hidden="true" />
                                                        <span>View Details</span>
                                                    </button>

                                                    <div className="flex items-center gap-2">
                                                        {app.resume_url && (
                                                            <a
                                                                href={app.resume_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-[11px] font-medium text-km-text-secondary hover:text-km-blue flex items-center gap-1 transition-colors"
                                                                title="Open candidate resume"
                                                            >
                                                                <FileTextIcon weight="regular" size={13} aria-hidden="true" />
                                                                <span>Resume</span>
                                                            </a>
                                                        )}

                                                        <button
                                                            type="button"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedAppId(app.id);
                                                                setIsInterviewModalOpen(true);
                                                            }}
                                                            className="text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
                                                            title="Schedule Interview"
                                                        >
                                                            <CalendarBlankIcon weight="regular" size={13} aria-hidden="true" />
                                                            <span>Interview</span>
                                                        </button>
                                                    </div>
                                                </div>

                                                {/* Stage Selector */}
                                                <div className="pt-1">
                                                    <select
                                                        value={app.status}
                                                        onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                                                        className="w-full text-[11px] font-medium bg-km-surface border border-km-border rounded-lg p-1.5 text-km-text-primary outline-none focus:border-km-primary cursor-pointer"
                                                    >
                                                        <option value="Applied">Move: Applied</option>
                                                        <option value="Shortlisted">Move: Shortlisted</option>
                                                        <option value="Interviewing">Move: Interview</option>
                                                        <option value="Hired">Move: Hired</option>
                                                        <option value="Rejected">Move: Rejected</option>
                                                    </select>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : (
                /* TABLE / LIST VIEW */
                <div className="bg-km-surface-card rounded-2xl border border-km-border shadow-xs overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-km-text-secondary">
                            <thead className="bg-km-surface text-km-text-secondary font-semibold border-b border-km-border/70">
                                <tr>
                                    <th className="py-3 px-5">Candidate</th>
                                    <th className="py-3 px-5">Applied Position</th>
                                    <th className="py-3 px-5">Date</th>
                                    <th className="py-3 px-5">Status</th>
                                    <th className="py-3 px-5">Resume</th>
                                    <th className="py-3 px-5 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-km-border/60">
                                {filteredApps.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-10 text-center text-km-text-secondary">
                                            {currentJob 
                                                ? `No applicants found for ${currentJob.title}.`
                                                : "No applicants found matching filter criteria."}
                                        </td>
                                    </tr>
                                ) : (
                                    filteredApps.map((app) => (
                                        <tr key={app.id} className="hover:bg-km-surface/50 transition-colors">
                                            <td className="py-3.5 px-5">
                                                <button
                                                    type="button"
                                                    onClick={() => setDrawerApp(app)}
                                                    className="flex items-center gap-2.5 group/cand text-left cursor-pointer"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-km-surface text-km-primary font-bold flex items-center justify-center uppercase shrink-0 border border-km-border text-xs">
                                                        {app.candidate?.name ? app.candidate.name.charAt(0) : "C"}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-km-text-primary text-xs group-hover/cand:text-km-blue group-hover/cand:underline transition-colors">
                                                            {app.candidate?.name || `Candidate #${app.candidate_id?.substring(0, 6) || "ID"}`}
                                                        </p>
                                                        <p className="text-[11px] text-km-text-secondary">
                                                            {app.candidate?.email || app.candidate?.mobile || "N/A"}
                                                        </p>
                                                    </div>
                                                </button>
                                            </td>
                                            <td className="py-3.5 px-5">
                                                <p className="font-semibold text-km-text-primary text-xs">{app.job?.title || "N/A"}</p>
                                                <p className="text-[11px] text-km-text-secondary">{app.job?.company || ""}</p>
                                            </td>
                                            <td className="py-3.5 px-5 text-xs text-km-text-secondary">
                                                {new Date(app.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-3.5 px-5">
                                                <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium border ${
                                                    app.status === "Applied" ? "bg-blue-50 text-km-blue border-blue-200 dark:bg-blue-950/30 dark:border-blue-900/40 dark:text-km-link" :
                                                    app.status === "Shortlisted" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/40 dark:text-amber-400" :
                                                    app.status === "Interviewing" || app.status === "Interview" ? "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/30 dark:border-purple-900/40 dark:text-purple-400" :
                                                    app.status === "Hired" ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:border-emerald-900/40 dark:text-emerald-400" :
                                                    "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/30 dark:border-red-900/40 dark:text-red-400"
                                                }`}>
                                                    {app.status}
                                                </span>
                                            </td>
                                            <td className="py-3.5 px-5">
                                                {app.resume_url ? (
                                                    <a
                                                        href={app.resume_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-km-blue dark:text-km-link hover:underline font-semibold text-xs flex items-center gap-1"
                                                    >
                                                        <FileTextIcon weight="regular" size={13} aria-hidden="true" />
                                                        <span>Resume</span>
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-km-text-secondary">None</span>
                                                )}
                                            </td>
                                            <td className="py-3.5 px-5 text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => setDrawerApp(app)}
                                                        className="px-2.5 py-1 bg-km-surface hover:bg-km-border/50 text-km-text-primary border border-km-border rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                                        title="View Complete Candidate Application"
                                                    >
                                                        <EyeIcon weight="regular" size={13} aria-hidden="true" />
                                                        <span>View</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setSelectedAppId(app.id);
                                                            setIsInterviewModalOpen(true);
                                                        }}
                                                        className="px-2.5 py-1 bg-km-surface hover:bg-km-border/50 text-km-text-primary border border-km-border rounded-lg text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                                    >
                                                        <CalendarBlankIcon weight="regular" size={13} aria-hidden="true" />
                                                        <span>Schedule</span>
                                                    </button>

                                                    <select
                                                        value={app.status}
                                                        onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                                                        className="text-xs font-medium bg-km-surface-card border border-km-border rounded-lg px-2 py-1 text-km-text-primary outline-none focus:border-km-primary cursor-pointer"
                                                    >
                                                        <option value="Applied">Applied</option>
                                                        <option value="Shortlisted">Shortlisted</option>
                                                        <option value="Interviewing">Interview</option>
                                                        <option value="Hired">Hired</option>
                                                        <option value="Rejected">Rejected</option>
                                                    </select>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Candidate Detail Drawer */}
            {drawerApp && (
                <CandidateDetailDrawer
                    isOpen={!!drawerApp}
                    onClose={() => setDrawerApp(null)}
                    application={drawerApp}
                    onStatusUpdate={handleStatusUpdate}
                    onScheduleInterview={(appId) => {
                        setSelectedAppId(appId);
                        setIsInterviewModalOpen(true);
                    }}
                />
            )}

            {/* Schedule Interview Modal */}
            {selectedAppId && (
                <ScheduleInterviewModal
                    isOpen={isInterviewModalOpen}
                    onClose={() => {
                        setIsInterviewModalOpen(false);
                        setSelectedAppId(null);
                    }}
                    applicationId={selectedAppId}
                    onSuccess={() => {
                        setApplications(apps => apps.map(app =>
                            app.id === selectedAppId ? { ...app, status: 'Interviewing', updated_at: new Date().toISOString() } : app
                        ));
                    }}
                />
            )}
        </div>
    );
}

export default function ApplicationsPage() {
    return (
        <Suspense fallback={<KanbanSkeleton columns={4} cardsPerColumn={3} />}>
            <ApplicationsContent />
        </Suspense>
    );
}
