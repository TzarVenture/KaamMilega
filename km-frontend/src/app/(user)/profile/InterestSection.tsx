'use client';

import { useState, useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import ProfileConnectionCard, { ProfileCardUser } from '@/components/network/ProfileConnectionCard';
import CompanyCard from '@/components/company/CompanyCard';
import { HiringCompany, mergeHiringCompanies } from '@/lib/constants/companies';

interface JobItem {
    company?: string;
    company_name?: string;
    city_name?: string;
    location?: string;
}

interface InterestsSectionProps {
    initialExperts?: ProfileCardUser[];
}

const InterestsSection = ({ initialExperts }: InterestsSectionProps) => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'Top Experts' | 'Companies'>('Top Experts');
    const [experts, setExperts] = useState<ProfileCardUser[]>(initialExperts || []);
    // Eagerly initialize with enterprise partners so the company tab is never empty
    const [companies, setCompanies] = useState<HiringCompany[]>(() => mergeHiringCompanies([]).slice(0, 6));
    const [loading, setLoading] = useState(false);
    const [followingCompanies, setFollowingCompanies] = useState<string[]>([]);
    const tabs: Array<'Top Experts' | 'Companies'> = ['Top Experts', 'Companies'];

    useEffect(() => {
        try {
            const saved = localStorage.getItem('km_following_companies');
            if (saved) setFollowingCompanies(JSON.parse(saved));
        } catch {}
    }, []);

    const handleToggleFollow = (companyName: string, following: boolean) => {
        setFollowingCompanies((prev) => {
            const updated = following
                ? [...prev, companyName]
                : prev.filter((name) => name !== companyName);
            try {
                localStorage.setItem('km_following_companies', JSON.stringify(updated));
            } catch {}
            return updated;
        });
    };

    const handleChat = (id: string) => {
        if (id) {
            router.push(`/chat?userId=${id}`);
        } else {
            router.push('/chat');
        }
    };

    useEffect(() => {
        let isMounted = true;
        const loadData = async () => {
            setLoading(true);
            try {
                const [expertsRes, jobsRes, topCompaniesRes] = await Promise.allSettled([
                    api.get('/experts').catch(() => []),
                    api.get('/jobs?limit=30').catch(() => ({ jobs: [] })),
                    api.get('/companies/top').catch(() => [])
                ]);

                if (isMounted && expertsRes.status === 'fulfilled') {
                    const data = expertsRes.value as unknown;
                    const list = Array.isArray(data)
                        ? (data as ProfileCardUser[])
                        : ((data as { data?: ProfileCardUser[] })?.data || []);
                    setExperts(list.slice(0, 6));
                }

                if (isMounted) {
                    const extracted: Array<Record<string, unknown>> = [];
                    const seen = new Set<string>();

                    // 1. Ingest any companies from /companies/top endpoint
                    if (topCompaniesRes.status === 'fulfilled') {
                        const topData = topCompaniesRes.value as unknown;
                        const topList = Array.isArray(topData) ? topData : ((topData as { data?: unknown[] })?.data || []);
                        if (Array.isArray(topList)) {
                            topList.forEach((c: any) => {
                                const name = c.name || c.company_name;
                                if (name && typeof name === 'string' && name.trim().length > 0 && !seen.has(name.toLowerCase())) {
                                    seen.add(name.toLowerCase());
                                    extracted.push({
                                        name: name.trim(),
                                        logo: c.logo || c.company_logo,
                                        location: c.location || c.city || 'India',
                                        category: c.category || c.industry || 'Enterprise Employer',
                                        jobCount: c.job_count || c.jobCount || 1,
                                    });
                                }
                            });
                        }
                    }

                    // 2. Ingest any companies from live jobs
                    const jobsVal = jobsRes.status === 'fulfilled' ? (jobsRes.value as unknown) : null;
                    const jobsData = (jobsVal as { jobs?: JobItem[] })?.jobs || [];
                    jobsData.forEach((j: JobItem) => {
                        const name = j.company || j.company_name;
                        if (name && typeof name === 'string' && name.trim().length > 0 && !seen.has(name.toLowerCase())) {
                            seen.add(name.toLowerCase());
                            extracted.push({
                                name: name.trim(),
                                location: j.city_name || j.location || 'India',
                                jobCount: jobsData.filter((x: JobItem) => (x.company || x.company_name) === name).length
                            });
                        }
                    });

                    const merged = mergeHiringCompanies(extracted);
                    setCompanies(merged.slice(0, 6));
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
        <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm mt-6 font-sans">
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

            {loading && experts.length === 0 && (
                <div className="flex items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-km-primary"></div>
                </div>
            )}

            {/* Top Experts Grid */}
            {activeTab === 'Top Experts' && (
                <div>
                    {experts.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5">
                            {experts.map((exp: ProfileCardUser, i: number) => {
                                const expId = exp.id || exp._id || '';
                                return (
                                    <ProfileConnectionCard
                                        key={expId || i}
                                        user={exp}
                                        variant="grid"
                                        showConnect={false}
                                        onChat={(id) => handleChat(id || expId)}
                                    />
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
            {activeTab === 'Companies' && (
                <div>
                    {companies.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            {companies.map((comp: HiringCompany, idx: number) => (
                                <CompanyCard
                                    key={comp.name || idx}
                                    company={comp}
                                    variant="compact"
                                    isInitiallyFollowing={followingCompanies.includes(comp.name)}
                                    onToggleFollow={handleToggleFollow}
                                />
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
