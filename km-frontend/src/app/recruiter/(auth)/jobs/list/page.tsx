"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Link from "next/link";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';
import {
    Briefcase,
    MoreHorizontal,
    MapPin,
    Clock,
    Trash2,
    Edit,
    Eye,
    Search,
    Filter
} from "lucide-react";

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
            toast.error("Failed to load jobs");
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
            toast.success("Job deleted successfully");
        } catch (error) {
            console.error("Failed to delete job:", error);
            toast.error("Failed to delete job");
        }
    };

    const filteredJobs = jobs.filter(job =>
        job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        job.company.toLowerCase().includes(searchTerm.toLowerCase())
    );

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

            <header className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Manage Jobs</h1>
                    <p className="text-gray-500 mt-1">View and manage your job postings</p>
                </div>
                <Link
                    href="/recruiter/jobs/create"
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg flex items-center gap-2 shadow-sm transition-all"
                >
                    <Briefcase className="w-5 h-5" />
                    Post New Job
                </Link>
            </header>

            {/* Search and Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search jobs by title or company..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-500"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <button className="px-4 py-2.5 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 flex items-center gap-2">
                    <Filter className="w-5 h-5" />
                    Filters
                </button>
            </div>

            {filteredJobs.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
                    <div className="inline-block p-4 rounded-full bg-gray-50 mb-4">
                        <Briefcase className="w-8 h-8 text-gray-400" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900">No jobs found</h3>
                    <p className="text-gray-500 mt-1 mb-6">You haven't posted any jobs matching your search.</p>
                    <Link
                        href="/recruiter/jobs/create"
                        className="text-blue-600 font-medium hover:underline"
                    >
                        Post a new job
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-gray-600">
                            <thead className="bg-gray-50 text-gray-900 font-semibold border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-4">Job Title</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Salary</th>
                                    <th className="px-6 py-4">Location</th>
                                    <th className="px-6 py-4 text-center">Applications</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredJobs.map((job) => (
                                    <tr key={job.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900 mb-0.5">{job.title}</div>
                                            <div className="text-xs text-gray-500">{job.company}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${job.status === 'Open'
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {job.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {job.salary_min && job.salary_max ? `${job.salary_min} - ${job.salary_max}` : (job.salary_range || 'Not specified')}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-1.5">
                                                <MapPin className="w-3.5 h-3.5 text-gray-400" />
                                                {job.city_name} {job.location ? `(${job.location})` : ''}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 text-center">
                                            <Link href={`/recruiter/applications?jobId=${job.id}`} className="inline-flex items-center justify-center px-2.5 py-1 bg-blue-50 text-blue-700 rounded-md font-medium hover:bg-blue-100 transition-colors">
                                                {job.applicant_count || 0}
                                            </Link>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Link
                                                    href={`/recruiter/jobs/${job.id}`}
                                                    className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </Link>
                                                <Link
                                                    href={`/recruiter/jobs/${job.id}/edit`}
                                                    className="p-1.5 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Link>
                                                <button
                                                    onClick={() => handleDelete(job.id)}
                                                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="px-6 py-4 border-t border-gray-100 text-xs text-gray-500 flex justify-between items-center">
                        <span>Showing {filteredJobs.length} jobs</span>
                        {/* Pagination would go here */}
                    </div>
                </div>
            )}
        </div>
    );
}
