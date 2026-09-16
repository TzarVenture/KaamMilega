"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import {
    PlusCircle,
    Briefcase,
    Users,
    ChevronRight,
    Building2,
    ShieldCheck,
    Clock,
    FileText,
    Calendar,
    Kanban,
    CheckCircle2,
    ArrowUpRight,
    TrendingUp,
    AlertCircle,
    UserCheck
} from "lucide-react";

// --- Shimmer Loading Skeleton ---
const RecruiterDashboardSkeleton = () => (
    <div className="space-y-8">
        <div className="h-32 bg-white rounded-3xl border border-slate-200/80 animate-shimmer shadow-xs" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(n => (
                <div key={n} className="h-32 bg-white rounded-3xl border border-slate-200/80 animate-shimmer shadow-xs" />
            ))}
        </div>
        <div className="h-80 bg-white rounded-3xl border border-slate-200/80 animate-shimmer shadow-xs" />
    </div>
);

export default function RecruiterDashboard() {
    const [user, setUser] = useState<any>(null);
    const [jobs, setJobs] = useState<any[]>([]);
    const [applications, setApplications] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            // Fetch User Profile
            const userData: any = await api.get("/user/profile").catch(() => null);
            setUser(userData);

            // Fetch Recruiter Jobs
            const myJobs = await api.get("/jobs/my").catch(() => []) as any[];
            setJobs(myJobs || []);

            // Fetch Applications Received
            const myApps = await api.get("/applications/recruiter/all").catch(() => []) as any[];
            setApplications(myApps || []);

        } catch (error) {
            console.error("Failed to fetch dashboard data:", error);
            toast.error("Failed to refresh recruiter dashboard");
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
            toast.success(`Applicant status updated to ${newStatus}`);
        } catch (error) {
            toast.error("Failed to update status");
            fetchDashboardData();
        }
    };

    if (loading) {
        return <RecruiterDashboardSkeleton />;
    }

    const companyName = user?.company_name || user?.name || "Company Portal";
    const verificationStatus = user?.verification_status || "verified";

    // Dynamic Calculated Stats
    const activeJobsCount = jobs.filter(j => j.status === 'Open' || !j.status).length;
    const totalApplications = applications.length;
    const interviewingCount = applications.filter(a => a.status === 'Interviewing' || a.status === 'Interview').length;
    const hiredCount = applications.filter(a => a.status === 'Hired').length;
    const recentJobs = jobs.slice(0, 5);
    const recentApplications = applications.slice(0, 5);

    return (
        <div className="space-y-8 font-sans text-slate-900 pb-16">
            <ToastContainer />

            {/* ── RECRUITER WELCOME BANNER ── */}
            <div className="bg-linear-to-r from-slate-950 via-km-primary-dark to-slate-950 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <span className="px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                                <Building2 size={13} className="text-blue-400" /> {companyName}
                            </span>

                            {verificationStatus === 'verified' ? (
                                <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold flex items-center gap-1">
                                    <ShieldCheck size={13} /> Verified Employer
                                </span>
                            ) : (
                                <span className="px-3 py-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs font-bold flex items-center gap-1">
                                    <AlertCircle size={13} /> Verification Pending
                                </span>
                            )}
                        </div>

                        <h1 className="text-2xl sm:text-4xl font-black tracking-tight">
                            Welcome back, {user?.name || "Recruiter"} 👋
                        </h1>
                        <p className="text-slate-300 text-xs sm:text-sm mt-1 font-medium max-w-xl">
                            Here is an overview of your active hiring pipelines, applications, and scheduled interviews.
                        </p>
                    </div>

                    {/* Quick Command Bar */}
                    <div className="flex items-center gap-3 shrink-0">
                        <Link
                            href="/recruiter/jobs/create"
                            className="px-6 py-3.5 bg-km-primary hover:bg-km-primary-dark text-white font-bold text-xs rounded-xl shadow-lg shadow-blue-950/20 flex items-center gap-2 uppercase tracking-wider transition-all hover:scale-[1.02]"
                        >
                            <PlusCircle size={16} /> Post New Job
                        </Link>
                        <Link
                            href="/recruiter/applications"
                            className="px-5 py-3.5 bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/20 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-2"
                        >
                            <Kanban size={16} /> Kanban Board
                        </Link>
                    </div>
                </div>
            </div>

            {/* ── METRICS FUNNEL GRID ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Active Postings</p>
                        <h3 className="text-3xl font-black text-slate-900">{activeJobsCount}</h3>
                        <p className="text-[11px] text-slate-500 font-semibold mt-1">Out of {jobs.length} total posts</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-km-primary flex items-center justify-center font-bold shrink-0 border border-blue-100">
                        <Briefcase size={22} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Total Applications</p>
                        <h3 className="text-3xl font-black text-km-primary">{totalApplications}</h3>
                        <p className="text-[11px] text-emerald-600 font-semibold mt-1 flex items-center gap-1">
                            <TrendingUp size={12} /> Active candidates
                        </p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 text-km-primary flex items-center justify-center font-bold shrink-0 border border-blue-100">
                        <Users size={22} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Interviews Scheduled</p>
                        <h3 className="text-3xl font-black text-amber-600">{interviewingCount}</h3>
                        <p className="text-[11px] text-slate-500 font-semibold mt-1">Scheduled sessions</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold shrink-0 border border-amber-100">
                        <Calendar size={22} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all flex items-center justify-between">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Successful Hires</p>
                        <h3 className="text-3xl font-black text-emerald-600">{hiredCount}</h3>
                        <p className="text-[11px] text-emerald-600 font-semibold mt-1">Completed recruitment</p>
                    </div>
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 border border-emerald-100">
                        <UserCheck size={22} />
                    </div>
                </div>
            </div>

            {/* ── RECENT JOB POSTS SUITE ── */}
            <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Recent Job Postings</h2>
                        <p className="text-xs text-slate-500 font-medium">Manage your position listings and view candidate response rates</p>
                    </div>
                    <Link
                        href="/recruiter/jobs/list"
                        className="text-xs font-bold text-km-primary hover:text-km-primary-dark flex items-center gap-1 group"
                    >
                        View All Jobs ({jobs.length})
                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>

                {recentJobs.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-14 h-14 bg-blue-50 text-km-primary rounded-full flex items-center justify-center mx-auto mb-3">
                            <Briefcase size={24} />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">No Job Posts Found</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium mb-4">
                            You haven't published any job listings yet. Create your first post to start receiving candidate applications.
                        </p>
                        <Link
                            href="/recruiter/jobs/create"
                            className="inline-flex items-center gap-2 px-5 py-2.5 bg-km-primary text-white rounded-xl text-xs font-bold hover:bg-km-primary-dark transition-all shadow-md shadow-blue-900/10"
                        >
                            <PlusCircle size={15} /> Create Job Post
                        </Link>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs text-slate-600">
                            <thead className="bg-slate-50/70 text-slate-400 font-black uppercase tracking-wider border-b border-slate-100">
                                <tr>
                                    <th className="py-3.5 px-6">Job Title & Company</th>
                                    <th className="py-3.5 px-6">Status</th>
                                    <th className="py-3.5 px-6">Location</th>
                                    <th className="py-3.5 px-6 text-center">Applicants</th>
                                    <th className="py-3.5 px-6 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-semibold">
                                {recentJobs.map((job) => (
                                     <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 px-6">
                                            <p className="font-bold text-slate-900 text-sm">{job.title}</p>
                                            <p className="text-slate-400 text-xs">{job.company}</p>
                                        </td>
                                        <td className="py-4 px-6">
                                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                                                job.status === 'Closed'
                                                    ? 'bg-slate-100 text-slate-600 border-slate-200'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            }`}>
                                                {job.status || 'Active'}
                                            </span>
                                        </td>
                                        <td className="py-4 px-6 text-slate-600">
                                            {job.city_name || job.location || 'N/A'}
                                        </td>
                                        <td className="py-4 px-6 text-center">
                                            <Link
                                                href={`/recruiter/applications?jobId=${job.id}`}
                                                className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-blue-50 text-km-primary border border-blue-100 font-extrabold text-xs hover:bg-blue-100 transition-colors"
                                            >
                                                {applications.filter(a => a.job_id === job.id || a.job?.id === job.id).length} Applicants
                                            </Link>
                                        </td>
                                        <td className="py-4 px-6 text-right">
                                            <Link
                                                href={`/recruiter/applications?jobId=${job.id}`}
                                                className="inline-flex items-center gap-1 px-3.5 py-1.5 bg-slate-100 hover:bg-km-primary hover:text-white text-slate-700 rounded-xl text-xs font-bold transition-all"
                                            >
                                                Pipeline <ArrowUpRight size={13} />
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* ── RECENT CANDIDATE APPLICATIONS FEED ── */}
            <section className="bg-white rounded-3xl border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-black text-slate-900">Latest Candidate Applications</h2>
                        <p className="text-xs text-slate-500 font-medium">Real-time application feed across all active postings</p>
                    </div>
                    <Link
                        href="/recruiter/applications"
                        className="text-xs font-bold text-km-primary hover:text-km-primary-dark flex items-center gap-1 group"
                    >
                        Kanban Pipeline Board
                        <ChevronRight size={14} className="group-hover:translate-x-0.5 transition-transform" />
                    </Link>
                </div>

                {recentApplications.length === 0 ? (
                    <div className="p-12 text-center text-slate-500">
                        <div className="w-14 h-14 bg-blue-50 text-km-primary rounded-full flex items-center justify-center mx-auto mb-3">
                            <Users size={24} />
                        </div>
                        <h3 className="text-base font-bold text-slate-900">No Applications Received Yet</h3>
                        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto font-medium">
                            When job seekers submit applications to your job postings, they will appear right here in real time.
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {recentApplications.map((app) => (
                            <div key={app.id} className="p-6 hover:bg-slate-50/50 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="flex items-start gap-3 flex-1 min-w-0">
                                    <div className="w-10 h-10 rounded-2xl bg-blue-50 text-km-primary font-black flex items-center justify-center shrink-0 uppercase border border-blue-100">
                                        {app.candidate?.name ? app.candidate.name.charAt(0) : "C"}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="font-bold text-slate-900 text-sm">
                                                {app.candidate?.name || `Candidate #${app.candidate_id.substring(0, 6)}`}
                                            </h4>
                                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                                                <Clock size={11} /> {new Date(app.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 font-semibold truncate">
                                            Applied for <span className="text-slate-900 font-bold">{app.job?.title || "Position"}</span>
                                        </p>
                                        {app.cover_letter && (
                                            <p className="text-xs text-slate-500 italic mt-1 line-clamp-1 bg-slate-50 p-1.5 rounded-lg border border-slate-100">
                                                "{app.cover_letter}"
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                    {app.resume_url && (
                                        <a
                                            href={app.resume_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1"
                                        >
                                            <FileText size={13} /> Resume
                                        </a>
                                    )}

                                    <select
                                        value={app.status}
                                        onChange={(e) => handleStatusUpdate(app.id, e.target.value)}
                                        className="text-xs font-bold bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-800 outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary"
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
