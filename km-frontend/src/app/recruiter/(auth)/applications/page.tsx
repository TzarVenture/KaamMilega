"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import { KanbanSkeleton, PageHeaderSkeleton } from "@/components/ui/LoadingSkeleton";
import {
    FileText,
    Search,
    User,
    Briefcase,
    Calendar,
    Kanban,
    List,
    Mail,
    Phone,
    MoveRight,
    MapPin,
    CheckCircle2,
    Clock,
    XCircle,
    UserCheck,
    CalendarPlus
} from "lucide-react";
import ScheduleInterviewModal from "@/components/recruiter/ScheduleInterviewModal";

const KANBAN_COLUMNS = [
    { id: "Applied", title: "Applied", color: "blue", headerBg: "bg-blue-50 text-blue-700 border-blue-200", colBg: "bg-blue-50/30 border-blue-100" },
    { id: "Shortlisted", title: "Shortlisted", color: "purple", headerBg: "bg-purple-50 text-purple-700 border-purple-200", colBg: "bg-purple-50/30 border-purple-100" },
    { id: "Interviewing", title: "Interview", color: "amber", headerBg: "bg-amber-50 text-amber-700 border-amber-200", colBg: "bg-amber-50/30 border-amber-100" },
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
                toast.error("Failed to load applicant pipeline");
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
            toast.success(`Applicant moved to ${newStatus}`);
        } catch (error) {
            console.error("Failed to update status:", error);
            toast.error("Failed to update applicant status");
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
        <div className="space-y-6">
            <ToastContainer />

            {/* Header & Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Applicant Pipeline</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        {jobId ? "Viewing candidates for selected position" : "Manage all candidate applications via drag-and-drop pipeline"}
                    </p>
                </div>

                {/* View Switcher */}
                <div className="flex items-center gap-3">
                    <div className="bg-white p-1 rounded-2xl border border-gray-200 flex items-center shadow-sm">
                        <button
                            onClick={() => setViewMode("kanban")}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                viewMode === "kanban"
                                    ? "bg-purple-600 text-white shadow-md shadow-purple-200"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            <Kanban size={15} /> Kanban Board
                        </button>
                        <button
                            onClick={() => setViewMode("list")}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                                viewMode === "list"
                                    ? "bg-purple-600 text-white shadow-md shadow-purple-200"
                                    : "text-gray-600 hover:text-gray-900"
                            }`}
                        >
                            <List size={15} /> Table View
                        </button>
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3.5 top-3 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Filter by candidate name, email, headline, or job title..."
                        className="w-full pl-10 pr-4 py-2 bg-white rounded-xl border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-purple-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="text-xs font-bold text-gray-400">
                    Total: <span className="text-gray-900">{filteredApps.length}</span>
                </div>
            </div>

            {/* KANBAN BOARD VIEW */}
            {viewMode === "kanban" ? (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 items-start overflow-x-auto pb-6">
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
                                className={`rounded-3xl border p-3 min-h-137.5 transition-all flex flex-col ${col.colBg} ${
                                    isOver ? "ring-2 ring-purple-500 scale-[1.01] bg-purple-50/50" : ""
                                }`}
                            >
                                {/* Column Header */}
                                <div className={`flex items-center justify-between px-3 py-2 rounded-2xl border text-xs font-black uppercase tracking-wider mb-3 ${col.headerBg}`}>
                                    <span>{col.title}</span>
                                    <span className="w-5 h-5 rounded-full bg-white/80 text-gray-900 flex items-center justify-center font-bold text-[10px] shadow-sm">
                                        {colApps.length}
                                    </span>
                                </div>

                                {/* Candidate Cards Container */}
                                <div className="space-y-3 flex-1 overflow-y-auto max-h-175 pr-1">

                                    {colApps.length === 0 ? (
                                        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center text-xs text-gray-400 font-medium">
                                            Drop candidate here
                                        </div>
                                    ) : (
                                        colApps.map((app) => (
                                            <div
                                                key={app.id}
                                                draggable={true}
                                                onDragStart={(e) => handleDragStart(e, app.id)}
                                                className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-all cursor-grab active:cursor-grabbing hover:border-purple-300 group relative"
                                            >
                                                {/* Candidate Header */}
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-black text-xs shrink-0 uppercase">
                                                            {app.candidate?.name ? app.candidate.name.charAt(0) : "C"}
                                                        </div>
                                                        <div className="min-w-0">
                                                            <h4 className="font-bold text-gray-900 text-sm truncate group-hover:text-purple-600 transition-colors">
                                                                {app.candidate?.name || `Candidate #${app.candidate_id.substring(0, 6)}`}
                                                            </h4>
                                                            <p className="text-[11px] text-gray-500 truncate">
                                                                {app.candidate?.headline || app.candidate?.email || "Applicant"}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Job Applied */}
                                                {app.job && (
                                                    <div className="my-2 p-2 bg-gray-50 rounded-xl text-[11px] text-gray-600 font-medium flex items-center gap-1.5 border border-gray-100">
                                                        <Briefcase size={12} className="text-purple-600 shrink-0" />
                                                        <span className="truncate">{app.job.title}</span>
                                                    </div>
                                                )}

                                                {/* Cover Letter Snippet */}
                                                {app.cover_letter && (
                                                    <p className="text-[11px] text-gray-500 italic line-clamp-2 my-2 bg-purple-50/40 p-2 rounded-lg border border-purple-50">
                                                        "{app.cover_letter}"
                                                    </p>
                                                )}

                                                {/* Meta details */}
                                                <div className="flex items-center justify-between text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-50">
                                                    <span className="flex items-center gap-1">
                                                        <Clock size={11} /> {new Date(app.created_at).toLocaleDateString()}
                                                    </span>

                                                    {app.resume_url && (
                                                        <a
                                                            href={app.resume_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-purple-600 hover:underline font-bold flex items-center gap-1"
                                                        >
                                                            <FileText size={11} /> Resume
                                                        </a>
                                                    )}
                                                </div>

                                                {/* Quick Status Action Menu for non-drag */}
                                                <div className="mt-3 pt-2 border-t border-gray-100 flex items-center justify-between gap-1">
                                                    <select
                                                        value={app.status}
                                                        onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                                                        className="w-full text-[10px] font-bold bg-gray-50 border border-gray-200 rounded-lg p-1.5 text-gray-700 outline-none focus:ring-1 focus:ring-purple-500"
                                                    >
                                                        <option value="Applied">Move to Applied</option>
                                                        <option value="Shortlisted">Move to Shortlisted</option>
                                                        <option value="Interviewing">Move to Interview</option>
                                                        <option value="Hired">Move to Hired</option>
                                                        <option value="Rejected">Move to Rejected</option>
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
                <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-xs font-black text-gray-500 uppercase tracking-wider border-b border-gray-100">
                                <tr>
                                    <th className="py-4 px-6">Candidate</th>
                                    <th className="py-4 px-6">Applied Position</th>
                                    <th className="py-4 px-6">Date</th>
                                    <th className="py-4 px-6">Status</th>
                                    <th className="py-4 px-6">Resume</th>
                                    <th className="py-4 px-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredApps.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="py-12 text-center text-gray-400">
                                            No applicants found matching filter criteria.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredApps.map((app) => (
                                        <tr key={app.id} className="hover:bg-purple-50/20 transition-colors">
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 font-bold flex items-center justify-center uppercase shrink-0">
                                                        {app.candidate?.name ? app.candidate.name.charAt(0) : "C"}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-gray-900">{app.candidate?.name || `Candidate #${app.candidate_id.substring(0, 6)}`}</p>
                                                        <p className="text-xs text-gray-400">{app.candidate?.email || app.candidate?.mobile || "N/A"}</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="py-4 px-6">
                                                <p className="font-medium text-gray-900">{app.job?.title || "N/A"}</p>
                                                <p className="text-xs text-gray-400">{app.job?.company || ""}</p>
                                            </td>
                                            <td className="py-4 px-6 text-xs text-gray-500">
                                                {new Date(app.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-4 px-6">
                                                <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                                                    app.status === 'Applied' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                                    app.status === 'Shortlisted' ? 'bg-purple-50 text-purple-700 border-purple-200' :
                                                    app.status === 'Interviewing' || app.status === 'Interview' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    app.status === 'Hired' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}>
                                                    {app.status}
                                                </span>
                                            </td>
                                            <td className="py-4 px-6">
                                                {app.resume_url ? (
                                                    <a
                                                        href={app.resume_url}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-purple-600 hover:underline font-bold text-xs flex items-center gap-1"
                                                    >
                                                        <FileText size={14} /> Resume
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-400">None</span>
                                                )}
                                            </td>
                                            <td className="py-4 px-6 text-right">
                                                <select
                                                    value={app.status}
                                                    onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                                                    className="text-xs font-bold bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 outline-none focus:ring-2 focus:ring-purple-500"
                                                >
                                                    <option value="Applied">Applied</option>
                                                    <option value="Shortlisted">Shortlisted</option>
                                                    <option value="Interviewing">Interview</option>
                                                    <option value="Hired">Hired</option>
                                                    <option value="Rejected">Rejected</option>
                                                </select>
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
