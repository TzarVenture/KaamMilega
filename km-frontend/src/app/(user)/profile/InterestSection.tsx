'use client';

import { useState, useEffect } from 'react';
import { MessageCircle, Briefcase, Building2, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';
import CustomImage from '@/components/ui/CustomImage';

interface InterestsSectionProps {
    initialExperts?: any[];
}

const InterestsSection = ({ initialExperts }: InterestsSectionProps) => {
    const [activeTab, setActiveTab] = useState<'Top Experts' | 'Companies'>('Top Experts');
    const [experts, setExperts] = useState<any[]>(initialExperts || []);
    const [companies, setCompanies] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const tabs: Array<'Top Experts' | 'Companies'> = ['Top Experts', 'Companies'];

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            setLoading(true);
            try {
                const [expertsRes, jobsRes] = await Promise.allSettled([
                    api.get('/experts').catch(() => []),
                    api.get('/jobs?limit=30').catch(() => ({ jobs: [] }))
                ]);

                if (isMounted && expertsRes.status === 'fulfilled') {
                    const data = expertsRes.value as any;
                    const list = Array.isArray(data) ? data : data.data || [];
                    setExperts(list.slice(0, 6));
                }

                if (isMounted && jobsRes.status === 'fulfilled') {
                    const jobsData = (jobsRes.value as any)?.jobs || [];
                    const compMap = new Map();
                    jobsData.forEach((j: any) => {
                        const name = j.company || j.company_name;
                        if (name && !compMap.has(name)) {
                            compMap.set(name, {
                                name,
                                location: j.location || 'India',
                                jobCount: jobsData.filter((x: any) => (x.company || x.company_name) === name).length
                            });
                        }
                    });
                    setCompanies(Array.from(compMap.values()).slice(0, 6));
                }
            } catch (err) {
                console.error('Failed to load interests data:', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadData();
        return () => {
            isMounted = false;
        };
    }, []);

    return (
        <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mt-6">
            <h2 className="text-xl font-bold mb-4 text-gray-900">Interests</h2>

            {/* Tab Navigation */}
            <div className="overflow-x-auto -mx-1 mb-6">
                <div className="flex border-b border-gray-200 min-w-max">
                    {tabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`pb-3 px-4 text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                                activeTab === tab
                                    ? 'text-km-primary border-b-2 border-km-primary'
                                    : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {tab}
                        </button>
                    ))}
                </div>
            </div>

            {loading && (
                <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-km-primary"></div>
                </div>
            )}

            {/* Top Experts Grid */}
            {!loading && activeTab === 'Top Experts' && (
                <div>
                    {experts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            {experts.map((exp: any, i: number) => {
                                const expName = exp.name || exp.full_name || (exp.first_name ? `${exp.first_name} ${exp.last_name || ''}` : 'Verified Expert');
                                const expHeadline = exp.headline || exp.designation || exp.expertise || 'Career & Technical Mentor';

                                return (
                                    <div
                                        key={exp.id || exp._id || i}
                                        className="flex flex-col items-center text-center p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200 transition-all group"
                                    >
                                        <div className="relative mb-3">
                                            <div className="w-16 h-16 rounded-full bg-slate-800 text-white font-bold flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                                                {exp.profile_image ? (
                                                    <CustomImage
                                                        src={exp.profile_image}
                                                        alt={expName}
                                                        className="w-full h-full object-cover"
                                                    />
                                                ) : (
                                                    <span>{expName.charAt(0).toUpperCase()}</span>
                                                )}
                                            </div>
                                            <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></div>
                                        </div>
                                        <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{expName}</h4>
                                        <p className="text-xs text-gray-500 line-clamp-1 mb-1 mt-0.5">{expHeadline}</p>
                                        <p className="text-[11px] text-km-primary font-semibold mb-3">
                                            {exp.followers_count || 12} Connects
                                        </p>
                                        <Link href="/chat" className="w-full mt-auto">
                                            <button className="flex items-center justify-center gap-1.5 w-full py-1.5 border border-km-primary text-km-primary rounded-xl text-xs font-bold hover:bg-blue-50 transition-colors cursor-pointer">
                                                <MessageCircle size={14} /> Chat
                                            </button>
                                        </Link>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic py-4">No top experts available right now.</p>
                    )}

                    <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                        <Link
                            href="/network"
                            className="inline-flex items-center gap-1 text-km-primary font-bold text-sm hover:underline"
                        >
                            <span>Explore All Experts & Mentors</span>
                            <ChevronRight size={16} />
                        </Link>
                    </div>
                </div>
            )}

            {/* Companies Grid */}
            {!loading && activeTab === 'Companies' && (
                <div>
                    {companies.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {companies.map((comp: any, idx: number) => (
                                <div
                                    key={idx}
                                    className="p-4 rounded-xl border border-gray-100 bg-gray-50/50 hover:bg-white hover:border-gray-200 transition-all flex flex-col justify-between"
                                >
                                    <div className="flex items-start gap-3 mb-3">
                                        <div className="w-10 h-10 rounded-lg bg-km-primary/10 text-km-primary flex items-center justify-center font-bold text-sm shrink-0 border border-km-primary/20">
                                            <Building2 size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <h4 className="font-bold text-sm text-gray-900 truncate">{comp.name}</h4>
                                            <p className="text-xs text-gray-500 truncate">{comp.location}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs">
                                        <span className="text-gray-500">{comp.jobCount} open {comp.jobCount === 1 ? 'job' : 'jobs'}</span>
                                        <Link
                                            href={`/jobs?search=${encodeURIComponent(comp.name)}`}
                                            className="text-km-primary font-bold hover:underline inline-flex items-center gap-0.5"
                                        >
                                            <span>View</span>
                                            <ChevronRight size={12} />
                                        </Link>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic py-4">No companies listed right now.</p>
                    )}

                    <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                        <Link
                            href="/jobs"
                            className="inline-flex items-center gap-1 text-km-primary font-bold text-sm hover:underline"
                        >
                            <span>Browse All Hiring Companies</span>
                            <ChevronRight size={16} />
                        </Link>
                    </div>
                </div>
            )}
        </section>
    );
};

export default InterestsSection;
