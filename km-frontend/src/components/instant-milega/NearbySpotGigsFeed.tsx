'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
    MapPin,
    Clock,
    Building2,
    RefreshCw,
    Wrench,
    Check,
    Briefcase,
    AlertCircle,
    X
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';
import { ActiveGig } from './ActiveGigCard';

interface SpotJob {
    id: string;
    recruiter_id: string;
    recruiter_name: string;
    company_name: string;
    skill: string;
    address: string;
    pay_rate: number;
    rate_type: string;
    duration_hours: number;
    notes?: string;
    distance_km?: number;
    distance_meters?: number;
    expires_at: string;
    created_at: string;
}

interface NearbySpotGigsFeedProps {
    userLat?: number;
    userLng?: number;
    activeSkill?: string;
    isFreeNow: boolean;
    quotaRemaining: number;
    hasActivePass: boolean;
    onOpenPassModal: () => void;
    onGigClaimed: (job: ActiveGig) => void;
}

const CATEGORY_TABS = [
    'All',
    'Delivery Partner',
    'Electrician',
    'Driver',
    'Plumber',
    'Warehouse Helper',
    'AC Technician',
    'Carpenter'
];

export default function NearbySpotGigsFeed({
    userLat = 19.0760,
    userLng = 72.8777,
    activeSkill,
    isFreeNow,
    quotaRemaining,
    hasActivePass,
    onOpenPassModal,
    onGigClaimed,
    onResetCategory,
}: NearbySpotGigsFeedProps & { onResetCategory?: () => void }) {
    const [jobs, setJobs] = useState<SpotJob[]>([]);
    const [loading, setLoading] = useState(false);
    const [claimingId, setClaimingId] = useState<string | null>(null);
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    const fetchGigs = useCallback(async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set('lat', String(userLat));
            params.set('lng', String(userLng));
            params.set('radius_km', '15.0');
            if (activeSkill && activeSkill !== 'All' && activeSkill !== 'All Trades') {
                params.set('skill', activeSkill);
            }

            const data: any = await api.get(`/instant-work/candidate/feed?${params.toString()}`);
            if (Array.isArray(data)) {
                setJobs(data);
            } else {
                setJobs([]);
            }
        } catch (e) {
            console.error('[InstantMilega] Error fetching gigs feed:', e);
        } finally {
            if (!isSilent) setLoading(false);
        }
    }, [userLat, userLng, activeSkill]);

    // Initial and periodic 15-second polling
    useEffect(() => {
        fetchGigs();
        const interval = setInterval(() => {
            fetchGigs(true);
        }, 15000);
        return () => clearInterval(interval);
    }, [fetchGigs]);

    const handleClaim = async (job: SpotJob) => {
        if (!isAuthenticated()) {
            toast.info('Please log in to claim spot gigs');
            window.location.href = `/login?redirect=${encodeURIComponent('/instant-milega')}`;
            return;
        }

        if (!hasActivePass || quotaRemaining <= 0) {
            toast.warn('You need an active InstantPass (₹99) to claim spot gigs.');
            onOpenPassModal();
            return;
        }

        setClaimingId(job.id);
        try {
            const claimedJob: any = await api.post('/instant-work/claim', {
                job_id: job.id,
            });

            toast.success(`Gig locked for ${job.skill}.`);
            onGigClaimed(claimedJob);
            setJobs((prev) => prev.filter((j) => j.id !== job.id));
        } catch (err: any) {
            const message = err.message || 'Could not claim this gig';
            toast.error(message);
            setDismissedIds((prev) => new Set(prev).add(job.id));
        } finally {
            setClaimingId(null);
        }
    };

    const handleDismiss = (id: string) => {
        setDismissedIds((prev) => new Set(prev).add(id));
    };

    const visibleJobs = jobs.filter((j) => !dismissedIds.has(j.id));
    const isFiltered = Boolean(activeSkill && activeSkill !== 'All' && activeSkill !== 'All Trades');

    return (
        <section id="instant-gigs-feed" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 scroll-mt-6">
            {/* Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-5">
                <div>
                    <div className="flex items-center gap-2.5">
                        <h2 className="text-xl sm:text-2xl font-bold text-[#071A4D] tracking-tight font-poppins">
                            Nearby Spot Gigs
                        </h2>
                        {isFiltered && (
                            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#FFF7ED] text-[#FF6B00] border border-[#FF6B00]/30">
                                {activeSkill}
                            </span>
                        )}
                    </div>
                    <p className="text-xs sm:text-sm text-[#5B6472] mt-0.5 font-medium">
                        Direct urgent vocational requirements posted by verified recruiters within 15 km
                    </p>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto">
                    {isFiltered && onResetCategory && (
                        <button
                            type="button"
                            onClick={onResetCategory}
                            className="text-xs font-bold text-[#5B6472] hover:text-[#071A4D] px-3 py-2 rounded-xl border border-[#D9E0EA] hover:bg-[#F4F7FB] transition-colors cursor-pointer"
                        >
                            Clear Filter
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={() => fetchGigs()}
                        disabled={loading}
                        className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[#071A4D] text-[#071A4D] hover:bg-[#F4F7FB] text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={loading ? 'animate-spin text-[#FF6B00]' : ''} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* Gigs List or Empty State */}
            {visibleJobs.length === 0 ? (
                <div className="p-8 sm:p-12 bg-white rounded-2xl border border-[#D9E0EA] text-center">
                    <div className="w-12 h-12 mx-auto rounded-xl bg-[#F4F7FB] border border-[#D9E0EA] flex items-center justify-center text-[#071A4D] mb-3">
                        <Briefcase size={22} className="text-[#071A4D]" />
                    </div>
                    <h3 className="text-base font-bold text-[#111827] font-poppins">
                        {isFiltered
                            ? `No Open Gigs for "${activeSkill}" Nearby`
                            : 'No Active Spot Gigs In Your Perimeter'}
                    </h3>
                    <p className="text-xs sm:text-sm text-[#5B6472] max-w-md mx-auto mt-1 font-medium">
                        {isFiltered
                            ? `No verified employers currently posted open gigs for ${activeSkill} in your 15 km perimeter. Try clearing filter or scanning again.`
                            : 'There are no open spot demands within 15 km right now. Keep Free Now active to receive instant dispatches as soon as employers post.'}
                    </p>
                    <div className="mt-4 flex items-center justify-center gap-3">
                        {isFiltered && onResetCategory && (
                            <button
                                type="button"
                                onClick={onResetCategory}
                                className="bg-[#071A4D] hover:bg-[#0B1F52] text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
                            >
                                View All Categories
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => fetchGigs()}
                            className="bg-[#F4F7FB] hover:bg-[#D9E0EA] text-[#071A4D] font-semibold text-xs px-4 py-2 rounded-xl transition-colors cursor-pointer border border-[#D9E0EA]"
                        >
                            Scan Perimeter Again
                        </button>
                    </div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {visibleJobs.map((job) => {
                        const distText = job.distance_km != null
                            ? `${job.distance_km.toFixed(1)} km away`
                            : 'Near you';

                        const isClaimingThis = claimingId === job.id;

                        return (
                            <div
                                key={job.id}
                                className="bg-white rounded-2xl border border-[#D9E0EA] hover:border-[#071A4D]/40 hover:shadow-xs transition-all duration-150 flex flex-col justify-between p-5 sm:p-6"
                            >
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <span className="px-2.5 py-1 rounded-md bg-[#FFF7ED] text-[#FF6B00] border border-[#FF6B00]/20 text-xs font-bold">
                                            {job.skill}
                                        </span>

                                        <span className="text-xs font-medium text-[#5B6472] flex items-center gap-1">
                                            <MapPin size={13} className="text-[#FF6B00]" />
                                            <span>{distText}</span>
                                        </span>
                                    </div>

                                    <h4 className="text-base font-bold text-[#111827] line-clamp-1">
                                        {job.company_name || 'Verified Employer'}
                                    </h4>

                                    <p className="text-xs text-[#5B6472] font-medium line-clamp-1 mt-0.5">
                                        {job.address || 'Local spot work location'}
                                    </p>

                                    {job.notes && (
                                        <p className="text-xs text-[#5B6472] bg-[#F4F7FB] p-2.5 rounded-xl border border-[#D9E0EA] mt-3 line-clamp-2">
                                            {job.notes}
                                        </p>
                                    )}
                                </div>

                                <div className="mt-5 pt-4 border-t border-[#D9E0EA]">
                                    <div className="flex items-center justify-between mb-4">
                                        <div>
                                            <span className="text-[11px] font-semibold text-[#5B6472] block">Agreed Rate</span>
                                            <div className="flex items-baseline gap-1">
                                                <span className="text-xl font-bold text-[#071A4D]">
                                                    ₹{job.pay_rate}
                                                </span>
                                                <span className="text-xs text-[#5B6472]">
                                                    {job.rate_type === 'hourly' ? '/ hr' : 'flat'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <span className="text-[11px] font-semibold text-[#5B6472] block">Duration</span>
                                            <span className="text-xs font-bold text-[#111827]">
                                                {job.duration_hours || 4} Hours
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleClaim(job)}
                                            disabled={isClaimingThis}
                                            className="flex-1 bg-[#FF6B00] hover:bg-[#FF8A00] active:scale-[0.98] text-white font-semibold text-xs py-2.5 px-4 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
                                        >
                                            {isClaimingThis ? (
                                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Briefcase size={14} />
                                                    <span>Claim Gig</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => handleDismiss(job.id)}
                                            className="p-2.5 rounded-xl border border-[#D9E0EA] text-[#5B6472] hover:text-[#111827] hover:bg-[#F4F7FB] transition-colors cursor-pointer"
                                            title="Dismiss Gig"
                                            aria-label="Dismiss Gig"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}
