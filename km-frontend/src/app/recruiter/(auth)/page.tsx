"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import { PlusCircle, Briefcase, Users, LayoutDashboard, ChevronRight } from "lucide-react";

export default function RecruiterDashboard() {
    const [stats, setStats] = useState({
        jobsPosted: 0,
        applicationsReceived: 0,
        interviewsScheduled: 0,
    });
    const [recentJobs, setRecentJobs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch jobs for stats and recent list
                const jobs = await api.get("/jobs/my") as any[];

                setRecentJobs(jobs.slice(0, 5));
                setStats({
                    jobsPosted: jobs.length,
                    applicationsReceived: 0, // Placeholder
                    interviewsScheduled: 0, // Placeholder
                });
            } catch (error) {
                console.error("Failed to fetch dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-50">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <header className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white sticky top-0 bg-white/50 backdrop-blur-md pt-5 pb-2">Recruiter Dashboard</h1>
                    <p className="text-gray-500 mt-2">Welcome back! Here's what's happening today.</p>
                </div>
                <Link
                    href="/recruiter/jobs/create"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-lg transition-all transform hover:scale-105"
                >
                    <PlusCircle className="w-5 h-5" />
                    Post New Job
                </Link>
            </header>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {[
                    { label: "Jobs Posted", value: stats.jobsPosted, color: "text-blue-600", bg: "bg-blue-50", icon: Briefcase },
                    { label: "Applications Received", value: stats.applicationsReceived, color: "text-green-600", bg: "bg-green-50", icon: Users },
                    { label: "Interviews Scheduled", value: stats.interviewsScheduled, color: "text-purple-600", bg: "bg-purple-50", icon: LayoutDashboard },
                ].map((stat, idx) => (
                    <div key={idx} className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow p-6 flex items-center justify-between border border-gray-100">
                        <div>
                            <p className="text-sm font-medium text-gray-500 mb-1">{stat.label}</p>
                            <h3 className={`text-3xl font-bold ${stat.color}`}>{stat.value}</h3>
                        </div>
                        <div className={`p-4 rounded-full ${stat.bg}`}>
                            <stat.icon className={`w-8 h-8 ${stat.color}`} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Recent Jobs Section */}
            <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                    <h2 className="text-lg font-semibold text-gray-900">Recent Job Posts</h2>
                    <Link href="/recruiter/jobs/list" className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center gap-1 group">
                        View All Jobs
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>

                {recentJobs.length === 0 ? (
                    <div className="p-12 text-center text-gray-500">
                        <div className="mb-4 inline-block bg-gray-100 rounded-full p-4">
                            <Briefcase className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-lg">No jobs posted yet.</p>
                        <Link href="/recruiter/jobs/create" className="text-blue-600 hover:underline mt-2 block font-medium">Create your first job post</Link>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {recentJobs.map((job) => (
                            <div key={job.id} className="p-6 hover:bg-gray-50/50 transition-colors flex items-center justify-between group">
                                <div className="flex-1 min-w-0 pr-4">
                                    <h3 className="text-base font-semibold text-gray-900 mb-1 truncate group-hover:text-blue-600 transition-colors">{job.title}</h3>
                                    <div className="flex items-center text-sm text-gray-500 gap-4 mt-1">
                                        <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {job.company}</span>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${job.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {job.status}
                                        </span>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full"></span>
                                        <span className="text-xs text-gray-400">Posted on {new Date(job.created_at).toLocaleDateString()}</span>
                                    </div>
                                </div>
                                <Link
                                    href={`/recruiter/jobs/${job.id}`}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:text-gray-900 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                                >
                                    Manage
                                </Link>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
