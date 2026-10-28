"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";
import { 
    ArrowSquareOutIcon,
    CalendarBlankIcon, 
    CaretRightIcon, 
    ChatCircleIcon,
    ChatIcon, 
    CheckCircleIcon, 
    CheckIcon,
    ClockIcon,
    CopyIcon,
    KanbanIcon, 
    MagnifyingGlassIcon, 
    MapPinIcon, 
    PencilSimpleIcon, 
    PhoneIcon, 
    TrashIcon, 
    UserIcon, 
    VideoCameraIcon, 
    WarningCircleIcon, 
    XCircleIcon,
    XIcon
} from '@phosphor-icons/react';
import Link from "next/link";
import { CardGridSkeleton, PageHeaderSkeleton } from "@/components/ui/LoadingSkeleton";
import ModalWrapper from "@/components/ui/ModalWrapper";
import EditInterviewModal from "@/components/recruiter/EditInterviewModal";
import UserAvatar from "@/components/ui/UserAvatar";

export default function InterviewsPage() {
    const [interviews, setInterviews] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState<"All" | "Scheduled" | "Completed" | "Cancelled">("All");

    // Modal States
    const [editTarget, setEditTarget] = useState<any | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    const handleCopyLink = (id: string, link: string) => {
        if (!link) return;
        navigator.clipboard.writeText(link);
        setCopiedId(id);
        notify.success("Meeting link copied to clipboard");
        setTimeout(() => {
            setCopiedId((prev) => (prev === id ? null : prev));
        }, 2000);
    };

    const fetchInterviews = async () => {
        try {
            const data = await api.get("/interviews/my") as any[];
            setInterviews(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch interviews:", error);
            notify.error(error, "Failed to load interviews");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInterviews();
    }, []);

    const handleUpdateStatus = async (id: string, newStatus: string) => {
        try {
            await api.patch(`/interviews/${id}/status`, { status: newStatus });
            setInterviews(prev => prev.map(inview =>
                inview.id === id ? { ...inview, status: newStatus } : inview
            ));
            notify.success(`Interview marked as ${newStatus}`);
        } catch (error) {
            console.error("Failed to update interview status:", error);
            notify.error(error, "Failed to update status");
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setIsDeleting(true);
        try {
            await api.delete(`/interviews/${deleteTarget.id}`);
            setInterviews(prev => prev.filter(i => i.id !== deleteTarget.id));
            notify.success("Interview session deleted successfully");
            setDeleteTarget(null);
        } catch (error) {
            console.error("Failed to delete interview:", error);
            notify.error(error, "Failed to delete interview");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEditSuccess = (updated: any) => {
        setInterviews(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
        fetchInterviews();
    };

    // Derived Counts
    const scheduledCount = interviews.filter(i => i.status === "Scheduled").length;
    const completedCount = interviews.filter(i => i.status === "Completed").length;
    const cancelledCount = interviews.filter(i => i.status === "Cancelled").length;

    // Filter & Search
    const filteredInterviews = interviews.filter((inview) => {
        // Status filter
        if (statusFilter !== "All" && inview.status !== statusFilter) {
            return false;
        }

        // Search filter
        if (!searchTerm.trim()) return true;
        const term = searchTerm.toLowerCase();
        const candName = String(inview.candidate?.name || "").toLowerCase();
        const candEmail = String(inview.candidate?.email || "").toLowerCase();
        const jobTitle = String(inview.job?.title || "").toLowerCase();
        const location = String(inview.location || "").toLowerCase();
        const notes = String(inview.notes || "").toLowerCase();

        return (
            candName.includes(term) ||
            candEmail.includes(term) ||
            jobTitle.includes(term) ||
            location.includes(term) ||
            notes.includes(term)
        );
    });

    if (loading) {
        return (
            <div className="space-y-6">
                <PageHeaderSkeleton />
                <CardGridSkeleton count={6} />
            </div>
        );
    }

    return (
        <div className="space-y-6 font-sans text-km-text-primary pb-16">

            {/* Header */}
            <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-xl sm:text-2xl font-bold text-km-text-primary font-poppins">Scheduled Interviews</h1>
                    <p className="text-xs text-km-text-secondary mt-0.5">Manage, reschedule, and evaluate candidate interview sessions</p>
                </div>
                <div className="flex items-center gap-2.5">
                    <Link
                        href="/recruiter/applications"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-km-surface-card hover:bg-km-surface border border-km-border rounded-xl text-xs font-semibold text-km-text-primary transition-colors shadow-2xs"
                    >
                        <KanbanIcon weight="bold" size={15} aria-hidden="true" />
                        <span>Applicant Pipeline</span>
                    </Link>
                </div>
            </header>

            {/* Controls: Search & Filter Tabs */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-km-surface-card p-3 rounded-2xl border border-km-border shadow-xs">
                {/* Search Bar */}
                <div className="relative flex-1">
                    <MagnifyingGlassIcon
                        size={16}
                        weight="regular"
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-secondary"
                        aria-hidden="true"
                    />
                    <input
                        type="text"
                        placeholder="Search candidate, job title, or meeting details..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-8 py-2 bg-km-surface rounded-xl text-xs text-km-text-primary placeholder:text-km-text-secondary/70 border border-km-border focus:border-km-primary outline-none transition-colors"
                    />
                    {searchTerm && (
                        <button
                            type="button"
                            onClick={() => setSearchTerm("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-km-text-secondary hover:text-km-text-primary p-0.5"
                            aria-label="Clear search"
                        >
                            <XIcon size={13} weight="bold" aria-hidden="true" />
                        </button>
                    )}
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                    {[
                        { id: "All" as const, label: "All", count: interviews.length },
                        { id: "Scheduled" as const, label: "Upcoming", count: scheduledCount },
                        { id: "Completed" as const, label: "Completed", count: completedCount },
                        { id: "Cancelled" as const, label: "Cancelled", count: cancelledCount },
                    ].map((tab) => {
                        const isActive = statusFilter === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setStatusFilter(tab.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs transition-colors flex items-center gap-1.5 shrink-0 ${
                                    isActive
                                        ? "bg-km-primary text-white font-semibold shadow-2xs"
                                        : "bg-km-surface text-km-text-secondary hover:text-km-text-primary hover:bg-km-border/40 font-medium"
                                }`}
                            >
                                <span>{tab.label}</span>
                                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                    isActive ? "bg-white/20 text-white" : "bg-km-border text-km-text-secondary"
                                }`}>
                                    {tab.count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Interviews List */}
            {interviews.length === 0 ? (
                <div className="bg-km-surface-card p-12 rounded-2xl shadow-xs border border-km-border text-center">
                    <CalendarBlankIcon size={36} weight="duotone" className="text-km-text-secondary mx-auto mb-3" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-km-text-primary font-poppins">No interviews scheduled yet</h3>
                    <p className="text-xs text-km-text-secondary mt-1 max-w-sm mx-auto mb-4">
                        Interviews appear here once you schedule evaluation sessions with candidates from your Applicant Pipeline.
                    </p>
                    <Link
                        href="/recruiter/applications"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-km-primary text-white rounded-xl text-xs font-semibold hover:bg-km-primary-dark transition-colors shadow-xs"
                    >
                        <span>Open Applicant Pipeline</span>
                        <CaretRightIcon weight="bold" size={13} aria-hidden="true" />
                    </Link>
                </div>
            ) : filteredInterviews.length === 0 ? (
                <div className="bg-km-surface-card p-10 rounded-2xl shadow-xs border border-km-border text-center">
                    <MagnifyingGlassIcon size={32} weight="duotone" className="text-km-text-secondary mx-auto mb-2.5" aria-hidden="true" />
                    <h3 className="text-sm font-semibold text-km-text-primary font-poppins">No Matching Interviews</h3>
                    <p className="text-xs text-km-text-secondary mt-1 max-w-sm mx-auto mb-3">
                        No sessions matched your search or status filter. Try clearing filters to see all interviews.
                    </p>
                    <button
                        type="button"
                        onClick={() => { setSearchTerm(""); setStatusFilter("All"); }}
                        className="px-3.5 py-1.5 bg-km-surface hover:bg-km-border/50 text-km-text-primary border border-km-border rounded-xl text-xs font-medium transition-colors"
                    >
                        Clear Filters
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredInterviews.map((inview) => {
                        const candidateId = inview.candidate_id || inview.candidate?.id;
                        return (
                            <div key={inview.id} className="bg-km-surface-card rounded-2xl border border-km-border shadow-xs overflow-hidden transition-colors hover:border-km-border/90">
                                <div className="p-5 flex flex-col md:flex-row gap-5">
                                    {/* Date & Time Column */}
                                    <div className="md:w-44 shrink-0 flex flex-row md:flex-col gap-3 items-center md:items-start justify-between md:justify-center border-b md:border-b-0 md:border-r border-km-border pb-4 md:pb-0 md:pr-5">
                                        <div>
                                            <p className="text-xs text-km-text-secondary flex items-center gap-1.5 mb-0.5">
                                                <CalendarBlankIcon size={14} weight="regular" aria-hidden="true" />
                                                <span>Date</span>
                                            </p>
                                            <p className="text-sm font-semibold text-km-text-primary">
                                                {new Date(inview.scheduled_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-km-text-secondary flex items-center gap-1.5 mb-0.5">
                                                <ClockIcon size={14} weight="regular" aria-hidden="true" />
                                                <span>Time</span>
                                            </p>
                                            <p className="text-xs font-medium text-km-text-secondary">
                                                {new Date(inview.scheduled_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                                            </p>
                                        </div>
                                        <div>
                                            <span className={`inline-block px-2.5 py-0.5 rounded-md text-xs font-medium border ${
                                                inview.status === "Scheduled"
                                                    ? "bg-blue-50 text-km-blue border-blue-200 dark:bg-[#131D3D] dark:border-blue-900/40 dark:text-km-link"
                                                    : inview.status === "Completed"
                                                    ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-[#0C1F2E] dark:border-emerald-900/40 dark:text-emerald-400"
                                                    : "bg-rose-50 text-rose-700 border-rose-200 dark:bg-[#23142B] dark:border-rose-900/40 dark:text-rose-400"
                                            }`}>
                                                {inview.status}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Main Details */}
                                    <div className="flex-1 space-y-3.5 min-w-0">
                                        {/* Position Title & Session Format */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                            <div>
                                                <p className="text-xs text-km-text-secondary mb-0.5">Job Position</p>
                                                <h3 className="text-sm font-semibold text-km-text-primary font-poppins">{inview.job?.title || "Position Title"}</h3>
                                            </div>
                                            <div className="flex items-center gap-1.5 text-xs font-medium text-km-text-secondary self-start sm:self-auto">
                                                {inview.type === "Video" && <VideoCameraIcon size={16} weight="regular" className="text-km-blue" aria-hidden="true" />}
                                                {inview.type === "Phone" && <PhoneIcon size={16} weight="regular" className="text-emerald-600" aria-hidden="true" />}
                                                {inview.type === "In-person" && <MapPinIcon size={16} weight="regular" className="text-amber-600" aria-hidden="true" />}
                                                <span>{inview.type} Interview</span>
                                            </div>
                                        </div>

                                        {/* Candidate Profile Snippet Card */}
                                        <div className="p-3.5 bg-km-surface rounded-xl border border-km-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-km-border">
                                                    <UserAvatar
                                                        src={inview.candidate?.profile_image}
                                                        name={inview.candidate?.name || "Candidate"}
                                                        sizeClass="w-full h-full"
                                                    />
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {candidateId ? (
                                                            <Link
                                                                href={`/profile/${candidateId}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-xs font-semibold text-km-text-primary hover:text-km-blue transition-colors flex items-center gap-1 group"
                                                            >
                                                                <span>{inview.candidate?.name || "Candidate"}</span>
                                                                <ArrowSquareOutIcon size={12} weight="bold" className="text-km-text-secondary group-hover:text-km-blue" aria-hidden="true" />
                                                            </Link>
                                                        ) : (
                                                            <span className="text-xs font-semibold text-km-text-primary">
                                                                {inview.candidate?.name || "Candidate"}
                                                            </span>
                                                        )}
                                                        {inview.candidate?.email && (
                                                            <span className="text-xs text-km-text-secondary truncate">
                                                                ({inview.candidate.email})
                                                            </span>
                                                        )}
                                                    </div>
                                                    {inview.candidate?.headline && (
                                                        <p className="text-xs text-km-text-secondary truncate max-w-md mt-0.5">
                                                            {inview.candidate.headline}
                                                        </p>
                                                    )}
                                                    {inview.candidate?.mobile && (
                                                        <p className="text-xs text-km-text-secondary mt-0.5">
                                                            Mobile: <span className="font-medium text-km-text-primary">{inview.candidate.mobile}</span>
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Profile & Chat Quick Action Links */}
                                            {candidateId && (
                                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                                                    <Link
                                                        href={`/profile/${candidateId}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-3 py-1.5 text-xs font-medium text-km-text-primary bg-km-surface-card hover:bg-km-border/40 border border-km-border rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                                                        title="View candidate profile in new tab"
                                                    >
                                                        <UserIcon size={14} weight="regular" aria-hidden="true" />
                                                        <span>View Profile</span>
                                                        <ArrowSquareOutIcon size={11} weight="bold" aria-hidden="true" />
                                                    </Link>
                                                    <Link
                                                        href={`/chat?user=${candidateId}`}
                                                        className="px-3 py-1.5 text-xs font-medium text-km-blue hover:text-km-blue/90 bg-blue-50 hover:bg-blue-100/70 dark:bg-[#131E40] border border-blue-200 dark:border-blue-900/50 rounded-xl transition-colors flex items-center gap-1.5 shadow-2xs"
                                                        title="Open chat with candidate"
                                                    >
                                                        <ChatCircleIcon size={14} weight="regular" aria-hidden="true" />
                                                        <span>Chat</span>
                                                    </Link>
                                                </div>
                                            )}
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div className="bg-km-surface p-3 rounded-xl border border-km-border">
                                                <div className="flex items-center justify-between gap-2 mb-1.5">
                                                    <p className="text-xs text-km-text-secondary flex items-center gap-1.5">
                                                        <MapPinIcon weight="regular" size={14} aria-hidden="true" />
                                                        <span className="font-medium">{inview.type === "Video" ? "Meeting URL" : inview.type === "Phone" ? "Phone Contact" : "Address"}</span>
                                                    </p>
                                                    {inview.location && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCopyLink(inview.id, inview.location)}
                                                            className="inline-flex items-center gap-1 text-[11px] font-medium text-km-text-secondary hover:text-km-text-primary px-1.5 py-0.5 rounded-md hover:bg-km-border/50 transition-colors"
                                                            title={inview.type === "Video" ? "Copy meeting link" : "Copy to clipboard"}
                                                        >
                                                            {copiedId === inview.id ? (
                                                                <>
                                                                    <CheckIcon size={12} weight="bold" className="text-emerald-600" aria-hidden="true" />
                                                                    <span className="text-emerald-600">Copied</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <CopyIcon size={12} weight="regular" aria-hidden="true" />
                                                                    <span>{inview.type === "Video" ? "Copy Link" : "Copy"}</span>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="text-xs font-medium text-km-text-primary break-all">
                                                    {inview.type === "Video" && inview.location?.startsWith("http") ? (
                                                        <div className="flex items-center gap-2.5 flex-wrap">
                                                            <a href={inview.location} target="_blank" rel="noreferrer" className="text-km-blue hover:underline inline-flex items-center gap-1 font-semibold">
                                                                <span>Join Meeting</span>
                                                                <CaretRightIcon weight="bold" size={12} aria-hidden="true" />
                                                            </a>
                                                            <span className="text-km-text-secondary/70 text-[11px] truncate max-w-xs">
                                                                {inview.location}
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        inview.location || "Not specified"
                                                    )}
                                                </div>
                                            </div>
                                            {inview.notes && (
                                                <div className="bg-km-surface p-3 rounded-xl border border-km-border">
                                                    <p className="text-xs text-km-text-secondary flex items-center gap-1.5 mb-1">
                                                        <ChatIcon weight="regular" size={14} aria-hidden="true" />
                                                        <span className="font-medium">Instructions / Notes</span>
                                                    </p>
                                                    <p className="text-xs text-km-text-secondary line-clamp-2">"{inview.notes}"</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Actions Column (Compact buttons, no excessive padding or vertical stretching) */}
                                    <div className="md:w-32 shrink-0 flex flex-row md:flex-col gap-2 justify-center border-t md:border-t-0 md:border-l border-km-border pt-4 md:pt-0 md:pl-5">
                                        {inview.status === "Scheduled" && (
                                            <>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(inview.id, "Completed")}
                                                    className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 shadow-2xs"
                                                >
                                                    <CheckCircleIcon weight="bold" size={14} aria-hidden="true" />
                                                    <span>Finish</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleUpdateStatus(inview.id, "Cancelled")}
                                                    className="w-full py-1.5 px-3 bg-km-surface hover:bg-rose-50 dark:hover:bg-[#23142B] text-rose-600 border border-km-border rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                                                >
                                                    <XCircleIcon weight="regular" size={14} aria-hidden="true" />
                                                    <span>Cancel</span>
                                                </button>
                                            </>
                                        )}

                                        {/* Edit Button */}
                                        <button
                                            type="button"
                                            onClick={() => setEditTarget(inview)}
                                            className="w-full py-1.5 px-3 bg-km-surface hover:bg-km-border/50 text-km-text-primary border border-km-border rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                                        >
                                            <PencilSimpleIcon weight="bold" size={14} aria-hidden="true" />
                                            <span>Edit</span>
                                        </button>

                                        {/* Delete Button */}
                                        <button
                                            type="button"
                                            onClick={() => setDeleteTarget(inview)}
                                            className="w-full py-1.5 px-3 bg-km-surface hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-[#211527] text-km-text-secondary border border-km-border rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                                            title="Delete Interview Record"
                                        >
                                            <TrashIcon weight="regular" size={14} aria-hidden="true" />
                                            <span>Delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Edit / Reschedule Modal */}
            <EditInterviewModal
                isOpen={!!editTarget}
                onClose={() => setEditTarget(null)}
                interview={editTarget}
                onSuccess={handleEditSuccess}
            />

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <ModalWrapper
                    isOpen={!!deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    title="Delete Interview Record"
                >
                    <div className="space-y-4 font-sans text-km-text-primary">
                        <div className="flex items-start gap-3 p-3 bg-red-50/70 dark:bg-[#1B172B] border border-red-200 dark:border-red-900/40 rounded-xl text-red-800 dark:text-red-300 text-xs leading-relaxed">
                            <WarningCircleIcon size={20} weight="fill" className="text-red-600 shrink-0 mt-0.5" aria-hidden="true" />
                            <div>
                                <p className="font-semibold">Are you sure you want to delete this interview record?</p>
                                <p className="mt-1 text-red-700 dark:text-red-400">
                                    Interview with <strong className="font-semibold">{deleteTarget.candidate?.name || "Candidate"}</strong> scheduled for {new Date(deleteTarget.scheduled_at).toLocaleDateString()} will be permanently removed.
                                </p>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2.5 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 border border-km-border text-km-text-secondary hover:bg-km-surface rounded-xl text-xs font-medium transition-colors"
                            >
                                Keep Interview
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold disabled:opacity-50 transition-colors shadow-xs flex items-center gap-1.5"
                            >
                                <TrashIcon weight="bold" size={14} aria-hidden="true" />
                                <span>{isDeleting ? "Deleting..." : "Confirm Delete"}</span>
                            </button>
                        </div>
                    </div>
                </ModalWrapper>
            )}

        </div>
    );
}

