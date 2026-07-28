"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import {
    Briefcase, MapPin, DollarSign, Clock,
    ArrowLeft, Edit, Trash2, Calendar,
    CheckCircle2, AlertCircle, Building2, Users
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";

export default function JobDetailsPage() {
    const router = useRouter();
    const params = useParams();
    const jobId = params.id;

    const [job, setJob] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchJob = async () => {
            try {
                const data = await api.get(`/jobs/${jobId}`);
                setJob(data);
            } catch (error) {
                console.error("Failed to fetch job", error);
                toast.error("Job not found or access denied");
                router.push("/recruiter/jobs/list");
            } finally {
                setLoading(false);
            }
        };

        if (jobId) fetchJob();
    }, [jobId, router]);

    const handleDelete = async () => {
        if (!confirm("Are you sure you want to delete this job posting?")) return;

        try {
            await api.delete(`/jobs/${jobId}`);
            toast.success("Job deleted successfully");
            router.push("/recruiter/jobs/list");
        } catch (error) {
            toast.error("Failed to delete job");
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-gray-500 font-medium">Loading job details...</p>
            </div>
        );
    }

    if (!job) return null;

    return (
        <div className="max-w-5xl mx-auto pb-20 px-4">
            {/* Top Bar */}
            <div className="flex items-center justify-between mb-8">
                <Link href="/recruiter/jobs/list" className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-medium">
                    <ArrowLeft className="w-5 h-5" />
                    Back to All Jobs
                </Link>
                <div className="flex gap-3">
                    <Link
                        href={`/recruiter/jobs/${jobId}/edit`}
                        className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-xl text-gray-700 font-bold hover:bg-gray-50 transition-all"
                    >
                        <Edit className="w-4 h-4" />
                        Edit Job
                    </Link>
                    <button
                        onClick={handleDelete}
                        className="flex items-center gap-2 px-4 py-2 border border-red-100 bg-red-50 rounded-xl text-red-600 font-bold hover:bg-red-100 transition-all"
                    >
                        <Trash2 className="w-4 h-4" />
                        Delete
                    </button>
                </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-8">
                    {/* Header Card */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <div className="flex items-start justify-between mb-6">
                            <div>
                                <h1 className="text-3xl font-bold text-gray-900">{job.title}</h1>
                                <div className="flex items-center gap-4 mt-2">
                                    <span className="flex items-center gap-1.5 text-gray-500 font-medium">
                                        <Building2 className="w-4 h-4" />
                                        {job.company}
                                    </span>
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${job.status === 'Open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {job.status}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 p-6 bg-gray-50 rounded-2xl">
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Salary</p>
                                <p className="text-gray-900 font-bold">₹{job.salary_min} - {job.salary_max}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Location</p>
                                <p className="text-gray-900 font-bold">{job.city_name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Experience</p>
                                <p className="text-gray-900 font-bold">{job.experience_min} - {job.experience_max} Years</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider mb-1">Job Type</p>
                                <p className="text-gray-900 font-bold">{job.job_type}</p>
                            </div>
                        </div>
                    </div>

                    {/* Description Section */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-4">Description</h3>
                        <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{job.description}</p>
                    </div>

                    {/* Requirements Section */}
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-blue-600" />
                            Requirements
                        </h3>
                        <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {job.requirements?.map((req: string, i: number) => (
                                <li key={i} className="flex items-start gap-3 p-4 bg-blue-50/50 rounded-xl border border-blue-100/50 text-blue-900 font-medium text-sm">
                                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 shrink-0" />
                                    {req}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Benefits Section */}
                    {job.we_offer?.length > 0 && (
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                                <DollarSign className="w-5 h-5 text-green-600" />
                                Perks & Benefits
                            </h3>
                            <div className="flex flex-wrap gap-3">
                                {job.we_offer.map((offer: string, i: number) => (
                                    <span key={i} className="px-4 py-2 bg-green-50 text-green-700 border border-green-100 rounded-xl font-bold text-xs uppercase tracking-wider">
                                        {offer}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Sidebar Stats */}
                <div className="space-y-6">
                    <div className="bg-blue-600 p-8 rounded-3xl shadow-xl shadow-blue-200 text-white overflow-hidden relative">
                        <div className="relative z-10">
                            <div className="p-3 bg-white/20 w-fit rounded-2xl mb-4">
                                <Users className="w-8 h-8 text-white" />
                            </div>
                            <h4 className="text-xl font-bold mb-1">Applications</h4>
                            <p className="text-blue-100 text-sm mb-6">Total candidates applied for this position.</p>
                            <div className="text-5xl font-black mb-8">0</div>
                            <Link
                                href={`/recruiter/applications?jobId=${jobId}`}
                                className="block w-full text-center py-4 bg-white text-blue-600 rounded-2xl font-black hover:bg-blue-50 transition-all shadow-lg"
                            >
                                View Applications
                            </Link>
                        </div>
                        <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl" />
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 className="font-bold text-gray-900 mb-4 border-b pb-3">Posting Details</h4>
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Posted On</p>
                                    <p className="text-sm font-bold text-gray-700">{new Date(job.created_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <Clock className="w-5 h-5 text-gray-400" />
                                <div>
                                    <p className="text-[10px] uppercase font-black text-gray-400 tracking-widest">Last Updated</p>
                                    <p className="text-sm font-bold text-gray-700">{new Date(job.updated_at).toLocaleDateString(undefined, { dateStyle: 'long' })}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 pt-2">
                                <AlertCircle className="w-5 h-5 text-gray-400" />
                                <p className="text-xs text-gray-500 italic">Job ID: {job.id}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
