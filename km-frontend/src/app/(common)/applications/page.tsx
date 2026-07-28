"use client";

import { useEffect, useMemo, useState } from "react";
import api from "@/lib/axios";
import {
    Briefcase,
    CheckCircle2,
    ChevronRight,
    Circle,
    CircleAlert,
    Clock,
    Loader2,
    MessageSquare,
    Star,
    Zap,
    PhoneCall,
    ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";

type JobInfo = {
    id: string;
    title: string;
    company: string;
    company_id: string;
    location: string;
    city_name: string;
    salary_min: number;
    salary_max: number;
    job_type: string;
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
    job: JobInfo;
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
        "Hired": "Hired"
    };
    return map[status] || status;
}

export default function ApplicationsPage() {
    const [applications, setApplications] = useState<ApplicationDetail[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await api.get("/applications/my") as ApplicationDetail[];
                setApplications(data);
                if (data.length > 0) {
                    setSelectedId(data[0].id);
                }
            } catch (err: any) {
                setError(err.response?.data?.error || "Failed to load applications");
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
                    <Loader2 className="w-10 h-10 animate-spin text-purple-600 mx-auto" />
                    <p className="text-slate-500 font-medium">Crunching your career moves...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="max-w-4xl mx-auto mt-20 p-8 bg-red-50 border border-red-100 rounded-3xl text-center">
                <CircleAlert className="w-12 h-12 text-red-500 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-red-900 mb-2">Oops! Something went wrong</h2>
                <p className="text-red-700">{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-6 px-6 py-2 bg-red-600 text-white rounded-full font-semibold hover:bg-red-700 transition"
                >
                    Try Again
                </button>
            </div>
        );
    }

    if (applications.length === 0) {
        return (
            <div className="max-w-4xl mx-auto mt-20 p-12 bg-white border border-slate-100 rounded-3xl text-center shadow-sm">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Briefcase className="w-10 h-10 text-slate-300" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">No Applications Yet</h2>
                <p className="text-slate-500 max-w-md mx-auto mb-8">
                    Your dream job is waiting! Start applying to see your application journey reflected here.
                </p>
                <a
                    href="/jobs"
                    className="inline-flex items-center gap-2 px-8 py-3 bg-purple-600 text-white rounded-full font-bold hover:bg-purple-700 transition shadow-lg shadow-purple-200"
                >
                    Explore Jobs
                    <ChevronRight className="w-4 h-4" />
                </a>
            </div>
        );
    }

    return (
        <div className="bg-[#fcfcff] min-h-screen">
            <div className="max-w-[1400px] mx-auto p-4 md:p-10">
                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Sidebar: Application List */}
                    <div className="w-full lg:w-[400px] shrink-0 space-y-6">
                        <div className="flex gap-2">
                            <button className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-500 hover:border-purple-300 hover:text-purple-600 transition">
                                Recruiter Action (7)
                            </button>
                            <button className="px-4 py-2 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-500 hover:border-purple-300 hover:text-purple-600 transition">
                                Applied On KM (12)
                            </button>
                        </div>

                        <div className="space-y-3">
                            {applications.map((app) => (
                                <button
                                    key={app.id}
                                    onClick={() => setSelectedId(app.id)}
                                    className={cn(
                                        "w-full text-left p-5 rounded-2xl transition-all duration-300 border",
                                        selectedId === app.id
                                            ? "bg-[#fff7fa] border-[#ffdbe9] shadow-md shadow-pink-50"
                                            : "bg-white border-slate-100 hover:border-purple-100 hover:bg-slate-50/50"
                                    )}
                                >
                                    <h3 className="font-bold text-slate-900 truncate pr-4 text-[17px]">
                                        {app?.job?.title}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1 text-sm text-slate-500">
                                        <span>{app?.job?.company}</span>
                                        <div className="flex items-center gap-0.5 text-amber-500 font-medium">
                                            <Star className="w-3.5 h-3.5 fill-current" />
                                            <span>{app?.job?.rating}</span>
                                        </div>
                                        <span className="text-slate-300">|</span>
                                        <span>{app?.job?.reviews_count}</span>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[11px] font-bold border border-green-100">
                                            <CheckCircle2 className="w-3 h-3" />
                                            {getStatusDisplay(app.status)} {formatTimeAgo(app.updated_at)}
                                        </div>
                                        <span className="text-[11px] text-slate-400 font-medium">
                                            {app?.job?.last_active}
                                        </span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content: Application Detail */}
                    <div className="flex-1 bg-white border border-slate-100 rounded-[32px] p-8 md:p-12 shadow-sm min-h-[700px]">
                        {selectedApp ? (
                            <div className="space-y-10">
                                {/* Job Header */}
                                <div className="space-y-2">
                                    <h1 className="text-3xl font-black text-[#2d2d4d]">
                                        {selectedApp?.job?.title} | {selectedApp?.job?.location}
                                    </h1>
                                    <div className="flex items-center gap-3 text-slate-500 font-medium">
                                        <span className="text-slate-900 font-bold">{selectedApp?.job?.company}</span>
                                        <div className="flex items-center gap-1 text-amber-500">
                                            <Star className="w-4 h-4 fill-current" />
                                            <span>{selectedApp?.job?.rating}</span>
                                        </div>
                                        <span className="text-slate-300">|</span>
                                        <span>{selectedApp?.job?.reviews_count}</span>
                                    </div>
                                    <button className="mt-4 text-purple-600 font-bold text-sm hover:underline flex items-center gap-1">
                                        View Similar Jobs
                                        <ExternalLink className="w-3 h-3" />
                                    </button>
                                </div>

                                <div className="h-px bg-slate-100 w-full" />

                                {/* Status Stepper */}
                                <div className="space-y-8">
                                    <h2 className="text-xl font-black text-[#2d2d4d]">Application Status</h2>
                                    <div className="relative pt-4 px-4">
                                        {/* Background Trace */}
                                        <div className="absolute top-[18px] left-[5%] right-[5%] h-[4px] bg-slate-100 rounded-full" />

                                        {(() => {
                                            const statusMap: Record<string, number> = {
                                                "Applied": 0,
                                                "Viewed": 1,
                                                "Shortlisted": 2,
                                                "Interviewing": 3,
                                                "Hired": 4,
                                                "Rejected": -1
                                            };
                                            const currentIndex = statusMap[selectedApp.status] ?? 0;
                                            const progressWidth = currentIndex >= 0 ? (currentIndex / (STEPS.length - 1)) * 90 : 0;

                                            return (
                                                <>
                                                    {/* Progress Trace */}
                                                    <div
                                                        className="absolute top-[18px] left-[5%] h-[4px] bg-[#b1679a] rounded-full transition-all duration-1000"
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
                                                                            ? "bg-white border-[#b1679a] ring-[#f8eef6]"
                                                                            : "bg-white border-slate-200 ring-transparent"
                                                                    )} />
                                                                    <span className={cn(
                                                                        "mt-4 text-[11px] font-black uppercase tracking-wider text-center max-w-[100px]",
                                                                        isActive ? "text-[#b1679a]" : "text-slate-400"
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

                                <div className="h-px bg-slate-100 w-full" />

                                {/* Matching Criteria */}
                                <div className="space-y-6">
                                    <div className="space-y-1">
                                        <h2 className="text-xl font-black text-[#2d2d4d]">What may work for you?</h2>
                                        <p className="text-slate-500 font-medium">Following criteria suggests how well you match with the job.</p>
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
                                                    item.match ? "bg-green-500" : "bg-slate-200"
                                                )}>
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                                </div>
                                                <span className={cn(
                                                    "font-bold text-[15px]",
                                                    item.match ? "text-slate-900" : "text-slate-400"
                                                )}>
                                                    {item.label}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="h-px bg-slate-100 w-full" />

                                {/* Company Footer */}
                                <div className="flex flex-col md:flex-row items-center justify-between gap-6 p-6 rounded-[24px] bg-slate-50/50 border border-slate-100 mt-auto">
                                    <div className="flex items-center gap-4">
                                        <div className="w-16 h-16 bg-[#2d1b38] rounded-full flex items-center justify-center text-white overflow-hidden">
                                            <div className="relative">
                                                <Zap className="w-8 h-8 fill-purple-400 text-purple-400 transform rotate-12" />
                                            </div>
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">{selectedApp.job.company}</h3>
                                            <p className="text-slate-500 text-sm font-medium">About company line, Location</p>
                                            <p className="text-[11px] text-slate-400 mt-1 font-bold italic">
                                                {getStatusDisplay(selectedApp.status)} {formatTimeAgo(selectedApp.updated_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button className="p-3 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition">
                                            <PhoneCall className="w-5 h-5" />
                                        </button>
                                        <button className="px-6 py-2.5 bg-white border border-slate-200 rounded-full font-bold text-slate-700 hover:border-purple-300 hover:text-purple-600 transition flex items-center gap-2 text-sm">
                                            <MessageSquare className="w-4 h-4" />
                                            Chat With HR
                                        </button>
                                        <button className="px-8 py-2.5 bg-[#b1679a] text-white rounded-full font-bold hover:bg-[#9a5183] transition shadow-lg shadow-pink-100 text-sm">
                                            Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center">
                                    <Clock className="w-10 h-10 text-slate-200" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900">Select an application</h3>
                                <p className="text-slate-500 max-w-[250px]">Choose an application from the left to see its detailed status and next steps.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style jsx>{`
                @import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&display=swap');
                div {
                    font-family: 'Montserrat', sans-serif;
                }
            `}</style>
        </div>
    );
}
