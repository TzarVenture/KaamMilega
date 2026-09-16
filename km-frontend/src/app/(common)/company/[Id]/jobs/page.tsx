'use client';
import React, { useEffect, useState } from 'react';
import { useCompany } from "../CompanyContext";
import api from '@/lib/axios'; // Adjust path if needed
import { Phone, MessageCircle, MapPin, CheckCircle } from 'lucide-react';
import { toast } from 'react-toastify';
import Link from 'next/link';

interface Job {
    id: string;
    title: string;
    company: string;
    city_name: string;
    location: string;
    salary_min: number;
    salary_max: number;
    job_type: string;
    vacancies: number;
    created_at: string;
    description: string;
}

const JobsSection: React.FC = () => {
    const { company } = useCompany();
    const [jobs, setJobs] = useState<Job[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchJobs = async () => {
            if (!company?.id) return;
            setLoading(true);
            try {
                // Assuming filtering by company_id or similar
                // If company.id is the ID from URL
                const res: any = await api.get('/jobs', {
                    params: {
                        company_id: company.id,
                        limit: 10
                    }
                });

                // If API returns { jobs: [...] } or just [...]
                const jobList = res.jobs || res.data || [];
                setJobs(jobList);
            } catch (error) {
                console.error("Failed to fetch jobs", error);

                // Fallback: If API fails, maybe try searching by name?
                // Or just show nothing/error
            } finally {
                setLoading(false);
            }
        };

        fetchJobs();
    }, [company?.id]);

    return (
        <div className="flex w-full gap-6">
            {/* Sidebar (Consistent with Posts view) */}
            <aside className="w-full lg:w-1/4 hidden lg:block">
                <div className="sticky top-6 bg-blue-50/50 rounded-2xl border border-blue-100 p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-km-primary-dark rounded-full flex items-center justify-center mb-4 overflow-hidden shadow-inner">
                        {company?.logo ? (
                            <img src={company.logo} alt={company?.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-white text-2xl uppercase font-black">{company?.name?.charAt(0) || 'C'}</span>
                        )}
                    </div>
                    <h2 className="text-xl font-bold text-gray-900">{company?.name || "Company Name"}</h2>
                    <p className="text-sm text-gray-600 mt-1">{company?.connections?.toLocaleString() || 0} Followers</p>
                </div>
            </aside>

            {/* Jobs Feed */}
            <section className="flex-1 space-y-4">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(n => <div key={n} className="h-40 bg-gray-100 rounded-3xl animate-pulse" />)}
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="bg-white border border-gray-200 rounded-3xl p-12 text-center">
                        <h3 className="text-lg font-bold text-gray-900">No active jobs</h3>
                        <p className="text-gray-500">This company hasn't posted any jobs recently.</p>
                    </div>
                ) : (
                    jobs.map((job) => (
                        <JobCard key={job.id} job={job} />
                    ))
                )}
            </section>
        </div>
    );
};

const JobCard = ({ job }: { job: Job }) => {
    return (
        <div className="bg-white border border-slate-200 rounded-3xl p-6 transition-all hover:shadow-md hover:border-blue-200">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                {/* Job Title & Company */}
                <div>
                    <Link href={`/jobs/${job.id}`}>
                        <h3 className="text-xl font-bold text-gray-900 hover:text-km-primary transition-colors cursor-pointer">{job.title}</h3>
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">{job.company}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 w-full md:w-auto">
                    <button className="p-2.5 bg-blue-50 text-km-primary rounded-xl hover:bg-blue-100 transition">
                        <Phone size={18} />
                    </button>
                    <button className="flex items-center space-x-2 px-4 py-2 border border-km-primary text-km-primary rounded-xl text-sm font-bold hover:bg-blue-50 transition whitespace-nowrap">
                        <MessageCircle size={16} />
                        <span className="hidden sm:inline">Chat With HR</span>
                    </button>
                    <Link href={`/jobs/${job.id}`} className="px-6 py-2 bg-km-primary text-white rounded-xl text-sm font-bold hover:bg-km-primary-dark transition whitespace-nowrap shadow-md shadow-blue-900/10">
                        Apply Now
                    </Link>
                </div>
            </div>

            {/* Job Details Row */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-6">
                <div className="flex items-center text-gray-700 font-semibold">
                    <span className="mr-1 text-lg">₹</span>
                    <span>{job.salary_min?.toLocaleString()} - {job.salary_max?.toLocaleString()}</span>
                    <span className="text-gray-400 font-normal text-sm ml-1">/Month</span>
                </div>

                <div className="flex items-center text-gray-500 text-sm font-medium">
                    <MapPin size={16} className="mr-1 text-km-primary" />
                    <span>{job.location || 'Location N/A'}, {job.city_name}</span>
                </div>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
                <span className="px-3.5 py-1 bg-blue-50 text-km-primary text-xs font-bold rounded-xl border border-blue-100">
                    New
                </span>
                <span className="px-3.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl">
                    {job.job_type}
                </span>
                <span className="px-3.5 py-1 bg-slate-100 text-slate-700 text-xs font-semibold rounded-xl">
                    {job.vacancies} Vacancies
                </span>
                <div className="flex items-center space-x-1 px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200">
                    <CheckCircle size={12} fill="currentColor" className="text-emerald-500" />
                    <span>KM Verified</span>
                </div>
            </div>
        </div>
    );
};

export default JobsSection;
