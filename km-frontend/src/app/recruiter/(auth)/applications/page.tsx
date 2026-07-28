"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import {
    FileText,
    Search,
    Filter,
    Eye,
    User,
    Briefcase,
    Calendar,
    CheckCircle,
    XCircle,
    Clock
} from "lucide-react";
import Link from "next/link";
import ScheduleInterviewModal from "@/components/recruiter/ScheduleInterviewModal";

function ApplicationsContent() {
    const searchParams = useSearchParams();
    const jobId = searchParams.get("jobId");

    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("All");
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
                setApplications(data);
            } catch (error) {
                console.error("Failed to fetch applications:", error);
                toast.error("Failed to load applications");
            } finally {
                setLoading(false);
            }
        };

        fetchApplications();
    }, [jobId]);

    const handleStatusUpdate = async (id: string, newStatus: string) => {
        try {
            await api.patch(`/applications/${id}/status`, { status: newStatus });
            setApplications(apps => apps.map(app =>
                app.id === id ? { ...app, status: newStatus, updated_at: new Date().toISOString() } : app
            ));
            toast.success(`Status updated to ${newStatus}`);
        } catch (error) {
            console.error("Failed to update status:", error);
            toast.error("Failed to update status");
        }
    };

    const filteredApps = applications.filter(app => {
        const matchesSearch = app.id.includes(searchTerm) || app.cover_letter?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesStatus = statusFilter === "All" || app.status === statusFilter;
        return matchesSearch && matchesStatus;
    });

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <ToastContainer />

            <header>
                <h1 className="text-3xl font-bold text-gray-900">Applications</h1>
                <p className="text-gray-500 mt-1">
                    {jobId ? "Viewing applications for selected job" : "All applications received"}
                </p>
            </header>

            {/* Filters */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search by ID or keywords..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <select
                    className="px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="All">All Statuses</option>
                    <option value="Applied">Applied</option>
                    <option value="Shortlisted">Shortlisted</option>
                    <option value="Interviewing">Interviewing</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Hired">Hired</option>
                </select>
            </div>

            {filteredApps.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                    <div className="inline-block p-4 rounded-full bg-gray-50 mb-4">
                        <FileText className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No applications found</h3>
                    <p className="text-gray-500 mt-1">Try adjusting your filters or search criteria.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-4">
                    {filteredApps.map((app) => (
                        <div key={app.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-200 transition-colors flex flex-col md:flex-row gap-6">
                            <div className="flex-1 space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                        <User className="w-5 h-5 text-gray-400" />
                                        Candidate #{app.candidate_id.substring(0, 8)}...
                                    </h3>
                                    <span className={`px-3 py-1 rounded-full text-xs font-medium border
                                        ${app.status === 'Applied' ? 'bg-blue-50 text-blue-700 border-blue-200' : ''}
                                        ${app.status === 'Shortlisted' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''}
                                        ${app.status === 'Interviewing' ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : ''}
                                        ${app.status === 'Hired' ? 'bg-green-50 text-green-700 border-green-200' : ''}
                                        ${app.status === 'Rejected' ? 'bg-red-50 text-red-700 border-red-200' : ''}
                                    `}>
                                        {app.status}
                                    </span>
                                </div>

                                <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                                    <div className="flex items-center gap-1.5">
                                        <Briefcase className="w-4 h-4 text-gray-400" />
                                        Job ID: {app.job_id.substring(0, 8)}...
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Calendar className="w-4 h-4 text-gray-400" />
                                        {new Date(app.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                {app.cover_letter && (
                                    <div className="bg-gray-50 p-3 rounded-lg text-sm text-gray-600 line-clamp-2">
                                        <span className="font-medium text-gray-900">Cover Letter: </span>
                                        {app.cover_letter}
                                    </div>
                                )}

                                {app.resume_url && (
                                    <a
                                        href={app.resume_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                                        onClick={() => {
                                            if (app.status === "Applied") {
                                                handleStatusUpdate(app.id, "Viewed");
                                            }
                                        }}
                                    >
                                        <FileText className="w-4 h-4" /> View Resume
                                    </a>
                                )}
                            </div>

                            <div className="flex flex-col justify-center gap-2 min-w-[140px] border-t md:border-t-0 md:border-l border-gray-100 md:pl-6 pt-4 md:pt-0">
                                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Update Status</label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        onClick={() => handleStatusUpdate(app.id, 'Shortlisted')}
                                        className="p-2 text-purple-600 bg-purple-50 hover:bg-purple-100 rounded-lg text-xs font-medium transition-colors text-center"
                                        title="Shortlist"
                                    >
                                        Shortlist
                                    </button>
                                    <button
                                        onClick={() => {
                                            setSelectedAppId(app.id);
                                            setIsInterviewModalOpen(true);
                                        }}
                                        className="p-2 text-yellow-600 bg-yellow-50 hover:bg-yellow-100 rounded-lg text-xs font-medium transition-colors text-center"
                                        title="Interview"
                                    >
                                        Interview
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(app.id, 'Hired')}
                                        className="p-2 text-green-600 bg-green-50 hover:bg-green-100 rounded-lg text-xs font-medium transition-colors text-center"
                                        title="Hire"
                                    >
                                        Hire
                                    </button>
                                    <button
                                        onClick={() => handleStatusUpdate(app.id, 'Rejected')}
                                        className="p-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-medium transition-colors text-center"
                                        title="Reject"
                                    >
                                        Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
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
                        // Refresh applications to show updated status
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
        <Suspense fallback={<div className="flex justify-center p-8">Loading...</div>}>
            <ApplicationsContent />
        </Suspense>
    );
}
