"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";
import { KanbanSkeleton, PageHeaderSkeleton } from "@/components/ui/LoadingSkeleton";
import { BriefcaseIcon, CalendarBlankIcon, ClockIcon, FileTextIcon, KanbanIcon, ListBulletsIcon, MagnifyingGlassIcon } from '@phosphor-icons/react';
import ScheduleInterviewModal from "@/components/recruiter/ScheduleInterviewModal";

const KANBAN_COLUMNS = [
    { id: "Applied", title: "Applied", color: "blue", headerBg: "bg-blue-50 text-blue-700 border-blue-200", colBg: "bg-blue-50/30 border-blue-100" },
    { id: "Shortlisted", title: "Shortlisted", color: "amber", headerBg: "bg-amber-50 text-amber-700 border-amber-200", colBg: "bg-amber-50/30 border-amber-100" },
    { id: "Interviewing", title: "Interview", color: "purple", headerBg: "bg-purple-50 text-purple-700 border-purple-200", colBg: "bg-purple-50/30 border-purple-100" },
    { id: "Hired", title: "Hired", color: "emerald", headerBg: "bg-emerald-50 text-emerald-700 border-emerald-200", colBg: "bg-emerald-50/30 border-emerald-100" },
    { id: "Rejected", title: "Rejected", color: "rose", headerBg: "bg-rose-50 text-rose-700 border-rose-200", colBg: "bg-rose-50/30 border-rose-100" }
];

function ApplicationsContent() {
    const searchParams = useSearchParams();
    const jobId = searchParams.get("jobId");

    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");
    const [dragOverCol, setDragOverCol] = useState<string | null>(null);
    const [isInterviewModalOpen, setIsInterviewModalOpen] = useState(false);
    const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

    useEffect(() => {
        const fetchApplications = async () => {
            setLoading(true);
            try {
                let url = "/applications/recruiter/all";
                if (jobId) {
                    url = `/applications/job/${jobId}`;
                }
                const data = await api.get(url) as any[];
                setApplications(data || []);
            } catch (error) {
                console.error("Failed to fetch applications:", error);
                notify.error("Failed to load applicant pipeline");
            } finally {
                setLoading(false);
            }
        };

        fetchApplications();
    }, [jobId]);

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            // Optimistic update
            setApplications(apps => apps.map(app =>
                app.id === id ? { ...app, status: newStatus, updated_at: new Date().toISOString() } : app
            ));
            await api.patch(`/applications/${id}/status`, { status: newStatus });
            notify.success(`Applicant moved to ${newStatus}`);
        } catch (error) {
            console.error("Failed to update status:", error);
            notify.error("Failed to update applicant status");
            // Revert on error
            const data = await api.get(jobId ? `/applications/job/${jobId}` : "/applications/recruiter/all") as any[];
            setApplications(data || []);
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
            app.id.toLowerCase().includes(term) ||
            candidateName.includes(term) ||
            candidateEmail.includes(term) ||
            candidateHeadline.includes(term) ||
            jobTitle.includes(term) ||
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
                    <h1 className="text-xl sm:text-2xl font-bold text-km-text-primary font-poppins">Applicant Pipeline</h1>
                    <p className="text-xs text-km-text-secondary mt-0.5">
                        {jobId ? "Viewing candidate pipeline for selected position" : "Track and advance applicants across each hiring stage"}
                    </p>
                </div>

                {/* View Switcher */}
                <div className="flex items-center gap-3">
                    <div className="bg-km-surface p-1 rounded-xl border border-km-border flex items-center">
                        <button
                            onClick={() => setViewMode("kanban")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                viewMode === "kanban"
                                    ? "bg-km-surface-card text-km-text-primary shadow-xs"
                                    : "text-km-text-secondary hover:text-km-text-primary"
                            }`}
                        >
                            <KanbanIcon weight={viewMode === "kanban" ? "fill" : "regular"} size={15} aria-hidden="true" />
                            <span>Kanban</span>
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
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

            {/* Search Bar */}
            <div className="bg-km-surface-card p-3 rounded-2xl border border-km-border shadow-xs flex items-center gap-3">
                <div className="flex-1 relative">
                    <MagnifyingGlassIcon weight="regular" size={16} className="absolute left-3 top-2.5 text-km-text-secondary" aria-hidden="true" />
                    <input
                        type="text"
                        placeholder="Filter by candidate name, email, or role..."
                        className="w-full pl-9 pr-3.5 py-1.5 bg-km-surface-card rounded-xl border border-km-border text-xs text-km-text-primary placeholder:text-km-text-secondary/70 outline-none focus:border-km-primary transition-colors"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-xs text-km-text-secondary font-medium px-2 py-1 bg-km-surface rounded-lg border border-km-border/70 shrink-0">
                    Total: <span className="font-semibold text-km-text-primary">{filteredApps.length}</span>
                </div>
            </div>

            {/* KANBAN BOARD VIEW */}
            {viewMode === "kanban" ? (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3.5 items-start overflow-x-auto pb-6">
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
                                className={`rounded-2xl border p-3 min-h-[500px] transition-colors flex flex-col bg-km-surface/50 border-km-border ${
                                    isOver ? "border-km-primary bg-blue-50/40 dark:bg-blue-950/20" : ""
                                }`}
                            >
                                {/* Column Header */}
                                <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-km-border bg-km-surface-card text-xs font-semibold text-km-text-primary mb-3">
                                    <span className="font-poppins">{col.title}</span>
                                    <span className="px-1.5 py-0.2 rounded-md bg-km-surface text-km-text-secondary font-semibold text-[11px] border border-km-border/60">
                                        {colApps.length}
                                    </span>
                                </div>

                                {/* Candidate Cards Container */}
                                <div className="space-y-2.5 flex-1 overflow-y-auto max-h-[640px] pr-0.5">
                                    {colApps.length === 0 ? (
                                        <div className="border border-dashed border-km-border rounded-xl p-5 text-center text-xs text-km-text-secondary font-normal">
                                            No applicants in this stage
                                        </div>
                                    ) : (
                                        colApps.map((app) => (
                                            <div
                                                key={app.id}
                                                draggable={true}
                                                onDragStart={(e) => handleDragStart(e, app.id)}
                                                className="bg-km-surface-card p-3 rounded-xl border border-km-border shadow-xs hover:border-km-primary transition-colors cursor-grab active:cursor-grabbing group relative"
                                            >
                                                {/* Candidate Header */}
                                                <div className="flex items-start justify-between gap-2 mb-1.5">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <Link
                                                            href={`/profile/${app.candidate_id}`}
                                                            target="_blank"
                                                            title="View Candidate Full Profile"
                                                            className="w-7 h-7 rounded-lg bg-km-surface border border-km-border text-km-primary font-bold text-xs flex items-center justify-center shrink-0 uppercase hover:bg-km-border/40 transition-colors"
                                                        >
                                                            {app.candidate?.name ? app.candidate.name.charAt(0) : "C"}
                                                        </Link>
                                                        <div className="min-w-0">
                                                            <Link
                                                                href={`/profile/${app.candidate_id}`}
                                                                target="_blank"
                                                                title="View Candidate Full Profile"
                                                                className="font-semibold text-km-text-primary text-xs truncate hover:text-km-blue transition-colors hover:underline block"
                                                            >
                                                                {app.candidate?.name || `Candidate #${app.candidate_id?.substring(0, 6) || "ID"}`}
                                                            </Link>
                                                            <p className="text-[11px] text-km-text-secondary truncate">
                                                                {app.candidate?.headline || app.candidate?.email || "Applicant"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Job Applied */}
                                                {app.job && (
                                                    <div className="my-1.5 p-1.5 bg-km-surface rounded-lg text-[11px] text-km-text-secondary font-medium flex items-center gap-1.5 border border-km-border/60">
                                                        <BriefcaseIcon weight="regular" size={13} className="text-km-blue shrink-0" aria-hidden="true" />
                                                        <span className="truncate">{app.job.title}</span>
                                                    </div>
                                                )}

                                                {/* Cover Letter Snippet */}
                                                {app.cover_letter && (
                                                    <p className="text-[11px] text-km-text-secondary italic line-clamp-2 my-1.5 bg-km-surface p-1.5 rounded-md border border-km-border/60">
                                                        "{app.cover_letter}"
                                                    </p>
                                                )}

                                                {/* Meta details */}
                                                <div className="flex items-center justify-between text-[11px] text-km-text-secondary mt-2 pt-2 border-t border-km-border/60">
                                                    <span className="flex items-center gap-1">
                                                        <ClockIcon weight="regular" size={12} aria-hidden="true" />
                                                        <span>{new Date(app.created_at).toLocaleDateString()}</span>
                                                    </span>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedAppId(app.id);
                                                                setIsInterviewModalOpen(true);
                                                            }}
                                                            className="text-amber-600 dark:text-amber-400 hover:underline font-semibold flex items-center gap-1"
                                                            title="Schedule Interview"
                                                        >
                                                            <CalendarBlankIcon weight="regular" size={12} aria-hidden="true" />
                                                            <span>Interview</span>
                                                        </button>

                                                        {app.resume_url && (
                                                            <a
                                                                href={app.resume_url}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-km-blue dark:text-km-link hover:underline font-semibold flex items-center gap-1"
                                                            >
                                                                <FileTextIcon weight="regular" size={12} aria-hidden="true" />
                                                                <span>Resume</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Quick Status Action Menu */}
                                                <div className="mt-2 pt-2 border-t border-km-border/60">
                                                    <select
                                                        value={app.status}
                                                        onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                                                        className="w-full text-[11px] font-medium bg-km-surface border border-km-border rounded-lg p-1 text-km-text-primary outline-none focus:border-km-primary"
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
                                            No applicants found matching filter criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredApps.map((app) => (
                                        <tr key={app.id} className="hover:bg-km-surface/50 transition-colors">
                                            <td className="py-3.5 px-5">
                                                <Link
                                                    href={`/profile/${app.candidate_id}`}
                                                    target="_blank"
                                                    title="View Candidate Full Profile"
                                                    className="flex items-center gap-2.5 group/cand"
                                                >
                                                    <div className="w-8 h-8 rounded-lg bg-km-surface text-km-primary font-bold flex items-center justify-center uppercase shrink-0 border border-km-border text-xs">
                                                        {app.candidate?.name ? app.candidate.name.charAt(0) : "C"}
                                                    </div>
                                                    <div>
                                                        <p className="font-semibold text-km-text-primary text-xs group-hover/cand:text-km-blue group-hover/cand:underline transition-colors">{app.candidate?.name || `Candidate #${app.candidate_id?.substring(0, 6) || "ID"}`}</p>
                                                        <p className="text-[11px] text-km-text-secondary">{app.candidate?.email || app.candidate?.mobile || "N/A"}</p>
                                                    </div>
                                                </Link>
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
                                                        onClick={() => {
                                                            setSelectedAppId(app.id);
                                                            setIsInterviewModalOpen(true);
                                                        }}
                                                        className="px-2.5 py-1 bg-km-surface hover:bg-km-border/50 text-km-text-primary border border-km-border rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
                                                    >
                                                        <CalendarBlankIcon weight="regular" size={13} aria-hidden="true" />
                                                        <span>Schedule</span>
                                                    </button>

                                                    <select
                                                        value={app.status}
                                                        onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                                                        className="text-xs font-medium bg-km-surface-card border border-km-border rounded-lg px-2 py-1 text-km-text-primary outline-none focus:border-km-primary"
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
