'use client';

import React, { useState, useEffect } from 'react';
import {
    Search,
    MoreVertical,
    ArrowLeft,
    MapPin,
    Briefcase,
    DollarSign,
    Users,
    ShieldCheck,
    Star,
    Loader2,
    Trash2,
    Building2,
    Eye
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';
import Pagination from '@/components/ui/Pagination';

interface City {
    id: string;
    name: string;
    vacancies: string;
}

interface Job {
    id: string;
    title: string;
    company: string;
    salary: string;
    location: string;
    type: string;
    vacancies: number;
    isVerified: boolean;
    reviews: number;
    applicants: number;
}

export default function JobCityWisePage() {
    const [view, setView] = useState<'cities' | 'jobs'>('cities');
    const [selectedCity, setSelectedCity] = useState<City | null>(null);
    const [cities, setCities] = useState<City[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    const fetchCities = async () => {
        setIsLoading(true);
        try {
            const response: any = await api.get(`/cities?page=${currentPage}&search=${searchTerm}`);
            if (response && Array.isArray(response)) {
                setCities(response);
                setTotalPages(1);
            } else if (response && response.data) {
                setCities(response.data);
                setTotalPages(response.totalPages || 1);
            }
        } catch (error) {
            console.error('Failed to fetch cities:', error);
            // Mock for development
            // setCities([
            //     { id: '1', name: 'Delhi', vacancies: '600,000+' },
            //     { id: '2', name: 'Mumbai', vacancies: '800,000+' }
            // ]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchJobsByCity = async (cityName: string) => {
        setIsLoading(true);
        try {
            const response: any = await api.get(`/admin/jobs?city=${cityName}&page=${currentPage}&search=${searchTerm}`);
            if (response && Array.isArray(response)) {
                setJobs(response);
                setTotalPages(1);
            } else if (response && response.data) {
                setJobs(response.data);
                setTotalPages(response.totalPages || 1);
            }
        } catch (error) {
            console.error('Failed to fetch jobs:', error);
            // Mocking for visual development based on screenshot
            setJobs([
                {
                    id: '1',
                    title: 'Accountant Cum Office Assistant',
                    company: 'Shreeji Auto Industries',
                    salary: '₹20,000 - ₹35,000 /Month',
                    location: 'Rajarajeshwari Nagar, Bangalore',
                    type: 'Full Time',
                    vacancies: 30,
                    isVerified: true,
                    reviews: 20,
                    applicants: 10
                },
                {
                    id: '2',
                    title: 'Accountant Cum Office Assistant',
                    company: 'Shreeji Auto Industries',
                    salary: '₹20,000 - ₹35,000 /Month',
                    location: 'Rajarajeshwari Nagar, Bangalore',
                    type: 'Full Time',
                    vacancies: 30,
                    isVerified: true,
                    reviews: 20,
                    applicants: 10
                }
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (view === 'cities') {
            fetchCities();
        } else if (selectedCity) {
            fetchJobsByCity(selectedCity.name);
        }
    }, [view, selectedCity, currentPage, searchTerm]);

    const handleCityClick = (city: City) => {
        setSelectedCity(city);
        setView('jobs');
        setCurrentPage(1);
        setSearchTerm('');
    };

    const handleBack = () => {
        setView('cities');
        setSelectedCity(null);
        setCurrentPage(1);
        setSearchTerm('');
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header Content */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white px-6 sm:px-8 py-4 rounded-[20px] shadow-sm border border-purple-50">
                <div className="flex items-center gap-4">
                    {view === 'jobs' && (
                        <button
                            onClick={handleBack}
                            className="p-2 hover:bg-purple-50 text-purple-600 rounded-xl transition-all"
                        >
                            <ArrowLeft size={20} />
                        </button>
                    )}
                    <h1 className="text-xl font-bold text-purple-800">
                        {view === 'cities' ? 'All City' : selectedCity?.name}
                    </h1>
                </div>

                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder={view === 'cities' ? "Find city" : "Find job"}
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full sm:w-64 pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-200 transition-all"
                    />
                </div>
            </div>

            <main>
                <AnimatePresence mode="wait">
                    {view === 'cities' ? (
                        <motion.div
                            key="cities-view"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            className="bg-white rounded-[24px] shadow-sm border border-purple-50 overflow-hidden"
                        >
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-slate-50">
                                        <th className="px-8 py-5 text-left text-sm font-bold text-slate-400 uppercase tracking-wider">City Name</th>
                                        <th className="px-8 py-5 text-left text-sm font-bold text-slate-400 uppercase tracking-wider">Vacancies</th>
                                        <th className="px-8 py-5 text-right"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {isLoading ? (
                                        <tr>
                                            <td colSpan={3} className="px-8 py-20 text-center">
                                                <div className="flex flex-col items-center gap-3">
                                                    <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Filtering cities</p>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        cities.map((city) => (
                                            <tr
                                                key={city.id}
                                                onClick={() => handleCityClick(city)}
                                                className="hover:bg-purple-50/30 transition-colors cursor-pointer group"
                                            >
                                                <td className="px-8 py-5">
                                                    <span className="text-base font-bold text-slate-900 group-hover:text-purple-700 transition-colors">{city.name}</span>
                                                </td>
                                                <td className="px-8 py-5">
                                                    <span className="text-sm font-medium text-slate-400">{city.vacancies}</span>
                                                </td>
                                                <td className="px-8 py-5 text-right">
                                                    <button className="p-2 text-slate-400 group-hover:text-purple-600 transition-all">
                                                        <MoreVertical size={20} />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                            {totalPages > 1 && (
                                <div className="flex justify-center py-8 border-t border-slate-50">
                                    <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
                                </div>
                            )}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="jobs-view"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-4"
                        >
                            {isLoading ? (
                                <div className="bg-white rounded-[32px] p-20 flex flex-col items-center gap-4 shadow-sm border border-purple-50">
                                    <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Retrieving jobs for {selectedCity?.name}</p>
                                </div>
                            ) : jobs.length === 0 ? (
                                <div className="bg-white rounded-[32px] p-20 text-center border border-dashed border-purple-200">
                                    <div className="w-20 h-20 bg-purple-50 rounded-3xl flex items-center justify-center text-4xl mx-auto mb-6">🔍</div>
                                    <h3 className="text-xl font-bold text-slate-900">No Jobs Found</h3>
                                    <p className="text-slate-500 mt-2">There are currently no active jobs in {selectedCity?.name}.</p>
                                </div>
                            ) : (
                                <>
                                    {jobs.map((job) => (
                                        <div key={job.id} className="bg-white rounded-[24px] p-6 border border-purple-50 shadow-sm hover:shadow-md transition-all relative">
                                            <div className="flex justify-between items-start mb-4">
                                                <div>
                                                    <h3 className="text-lg font-bold text-slate-900">{job.title}</h3>
                                                    <p className="text-sm font-medium text-slate-400 flex items-center gap-1.5 mt-0.5">
                                                        <Building2 size={14} className="text-purple-400" />
                                                        {job.company}
                                                    </p>
                                                </div>
                                                <button className="p-2 text-slate-300 hover:text-purple-600 transition-colors">
                                                    <MoreVertical size={20} />
                                                </button>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-6 mb-5">
                                                <div className="flex items-center gap-2 text-[13px] font-bold text-slate-600 italic">
                                                    <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                                                        <DollarSign size={14} />
                                                    </div>
                                                    {job.salary}
                                                </div>
                                                <div className="flex items-center gap-2 text-[13px] font-bold text-slate-600 italic">
                                                    <div className="w-7 h-7 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                                                        <MapPin size={14} />
                                                    </div>
                                                    {job.location}
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-50">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="px-3 py-1 bg-rose-50 text-rose-500 text-[11px] font-black rounded-full uppercase">New</span>
                                                    <span className="px-3 py-1 bg-rose-50 text-rose-500 text-[11px] font-black rounded-full uppercase">{job.type}</span>
                                                    <span className="px-3 py-1 bg-rose-50 text-rose-500 text-[11px] font-black rounded-full uppercase">{job.vacancies} Vacancies</span>

                                                    {job.isVerified && (
                                                        <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[11px] font-black rounded-full uppercase flex items-center gap-1">
                                                            <ShieldCheck size={12} fill="currentColor" className="text-blue-500 text-opacity-30" />
                                                            KM Verified
                                                        </span>
                                                    )}
                                                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[11px] font-black rounded-full uppercase">{job.reviews} Review</span>
                                                    <span className="px-3 py-1 bg-blue-50 text-blue-600 text-[11px] font-black rounded-full uppercase">{job.applicants} Apply</span>
                                                </div>

                                                <div className="flex items-center gap-3">
                                                    <button className="px-6 py-2 border border-rose-200 text-rose-500 text-xs font-bold rounded-xl hover:bg-rose-50 transition-all">
                                                        Remove Job
                                                    </button>
                                                    <button className="px-6 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/10 hover:bg-purple-700 transition-all flex items-center gap-2">
                                                        View Candidate
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {totalPages > 1 && (
                                        <div className="flex justify-center py-6">
                                            <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
                                        </div>
                                    )}
                                </>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}

