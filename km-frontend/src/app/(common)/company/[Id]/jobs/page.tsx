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
                <div className="sticky top-6 bg-[#FDF4FF] rounded-2xl border border-purple-100 p-8 flex flex-col items-center text-center">
                    <div className="w-20 h-20 bg-[#3B124D] rounded-full flex items-center justify-center mb-4 overflow-hidden">
                        {company?.logo ? (
                            <img src={company.logo} alt={company?.name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-white text-2xl uppercase">{company?.name?.charAt(0) || 'C'}</span>
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
        <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl p-6 transition-shadow hover:shadow-md">
            <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                {/* Job Title & Company */}
                <div>
                    <Link href={`/jobs/${job.id}`}>
                        <h3 className="text-xl font-bold text-gray-900 hover:text-purple-600 transition-colors cursor-pointer">{job.title}</h3>
                    </Link>
                    <p className="text-sm text-gray-500 mt-1">{job.company}</p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3 w-full md:w-auto">
                    <button className="p-2 bg-purple-100 text-purple-700 rounded-full hover:bg-purple-200 transition">
                        <Phone size={18} />
                    </button>
                    <button className="flex items-center space-x-2 px-4 py-2 border border-purple-700 text-purple-700 rounded-full text-sm font-medium hover:bg-purple-50 transition whitespace-nowrap">
                        <MessageCircle size={16} />
                        <span className="hidden sm:inline">Chat With HR</span>
                    </button>
                    <Link href={`/jobs/${job.id}`} className="px-6 py-2 bg-purple-600 text-white rounded-full text-sm font-medium hover:bg-purple-700 transition whitespace-nowrap">
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

                <div className="flex items-center text-gray-500 text-sm">
                    <MapPin size={16} className="mr-1" />
                    <span>{job.location || 'Location N/A'}, {job.city_name}</span>
                </div>
            </div>

            {/* Badges Row */}
            <div className="flex flex-wrap items-center gap-3 mt-4">
                <span className="px-4 py-1 bg-purple-50 text-purple-600 text-xs font-medium rounded-full border border-purple-100">
                    New
                </span>
                <span className="px-4 py-1 bg-gray-50 text-gray-500 text-xs font-medium rounded-full border border-gray-100">
                    {job.job_type}
                </span>
                <span className="px-4 py-1 bg-gray-50 text-gray-500 text-xs font-medium rounded-full border border-gray-100">
                    {job.vacancies} Vacancies
                </span>
                <div className="flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full border border-blue-100">
                    <CheckCircle size={12} fill="currentColor" className="text-white" />
                    <span>KM Verified</span>
                </div>
            </div>
        </div>
    );
};

export default JobsSection;
