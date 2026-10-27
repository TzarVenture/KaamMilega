'use client';

import { useState, useEffect } from 'react';
import { CaretRightIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/axios';
import ProfileConnectionCard, { ProfileCardUser } from '@/components/network/ProfileConnectionCard';
import CompanyCard from '@/components/company/CompanyCard';
import { HiringCompany, companiesFromApi } from '@/lib/constants/companies';

interface InterestsSectionProps {
    initialExperts?: ProfileCardUser[];
}

const InterestsSection = ({ initialExperts }: InterestsSectionProps) => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<'Top Experts' | 'Companies'>('Top Experts');
    const [experts, setExperts] = useState<ProfileCardUser[]>(initialExperts || []);
    // Real companies only (registered employers); no showcase list mixed in
    const [companies, setCompanies] = useState<HiringCompany[]>([]);
    const [loading, setLoading] = useState(false);
    const tabs: Array<'Top Experts' | 'Companies'> = ['Top Experts', 'Companies'];

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
                const [expertsRes, topCompaniesRes] = await Promise.allSettled([
                    api.get('/experts').catch(() => []),
                    api.get('/companies/top?limit=6').catch(() => [])
                ]);

                if (isMounted && expertsRes.status === 'fulfilled') {
                    const data = expertsRes.value as unknown;
                    const list = Array.isArray(data)
                        ? (data as ProfileCardUser[])
                        : ((data as { data?: ProfileCardUser[] })?.data || []);
                    setExperts(list.slice(0, 6));
                }

                if (isMounted && topCompaniesRes.status === 'fulfilled') {
                    setCompanies(companiesFromApi(topCompaniesRes.value).slice(0, 6));
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
        <section className="bg-km-surface-card rounded-xl p-6 border border-gray-200 shadow-sm mt-6 font-sans">
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
                                    ? 'text-km-heading border-b-2 border-km-primary'
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
                            className="inline-flex items-center gap-1 text-km-heading font-bold text-sm hover:underline"
                        >
                            <span>Explore All Experts & Mentors</span>
                            <CaretRightIcon weight="bold" size={16} />
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
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-500 italic py-4">No companies listed right now.</p>
                    )}

                    <div className="mt-6 pt-4 border-t border-gray-100 text-center">
                        <Link
                            href="/jobs"
                            className="inline-flex items-center gap-1 text-km-heading font-bold text-sm hover:underline"
                        >
                            <span>Browse All Hiring Companies</span>
                            <CaretRightIcon weight="bold" size={16} />
                        </Link>
                    </div>
                </div>
            )}
        </section>
    );
};

export default InterestsSection;
