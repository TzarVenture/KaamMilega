'use client';

import React, { useState, useEffect } from 'react';
import CandidateHero from './CandidateHero';
import CandidateAvailabilityBar from './CandidateAvailabilityBar';
import ActiveGigCard, { ActiveGig } from './ActiveGigCard';
import NearbySpotGigsFeed from './NearbySpotGigsFeed';
import InstantCategoriesSection from './InstantCategoriesSection';
import DailyEarningsSummary from './DailyEarningsSummary';
import InstantPassModal from './InstantPassModal';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';

interface CandidateInstantMilegaViewProps {
    initialRole?: string;
    initialLocation?: string;
    cities?: any[];
}

export default function CandidateInstantMilegaView({
    initialRole = '',
    initialLocation = '',
    cities = [],
}: CandidateInstantMilegaViewProps) {
    const [isFreeNow, setIsFreeNow] = useState(false);
    const [quotaRemaining, setQuotaRemaining] = useState(0);
    const [hasActivePass, setHasActivePass] = useState(false);
    const [activeSkill, setActiveSkill] = useState(initialRole || 'All');
    const [hourlyRate, setHourlyRate] = useState(350);
    const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({
        lat: 19.0760,
        lng: 72.8777,
    });

    const [activeJob, setActiveJob] = useState<ActiveGig | null>(null);
    const [isPassModalOpen, setIsPassModalOpen] = useState(false);

    // Stable location update handler preventing infinite re-render loops
    const handleLocationUpdate = React.useCallback((lat: number, lng: number) => {
        setUserCoords((prev) => {
            if (
                prev &&
                Math.abs(prev.lat - lat) < 0.0001 &&
                Math.abs(prev.lng - lng) < 0.0001
            ) {
                return prev;
            }
            return { lat, lng };
        });
    }, []);

    // Fetch candidate live status and active job on mount if authenticated
    useEffect(() => {
        if (!isAuthenticated()) return;

        const loadCandidateData = async () => {
            try {
                // 1. Fetch live status & pass quota
                const statusRes: any = await api.get('/instant-work/candidate/status');
                if (statusRes) {
                    setIsFreeNow(Boolean(statusRes.is_free_now));
                    setQuotaRemaining(statusRes.quota_remaining || 0);
                    setHasActivePass(Boolean(statusRes.has_active_pass));
                    if (statusRes.active_skill) setActiveSkill(statusRes.active_skill);
                    if (statusRes.hourly_rate > 0) setHourlyRate(statusRes.hourly_rate);
                    if (statusRes.current_location?.coordinates?.length === 2) {
                        setUserCoords({
                            lng: statusRes.current_location.coordinates[0],
                            lat: statusRes.current_location.coordinates[1],
                        });
                    }
                }

                // 2. Fetch active gig if one is ongoing
                const jobRes: any = await api.get('/instant-work/candidate/active-job');
                if (jobRes && jobRes.id) {
                    setActiveJob(jobRes);
                }
            } catch (e) {
                console.error('[InstantMilega] Error loading candidate initial status:', e);
            }
        };

        loadCandidateData();
    }, []);

    const handleToggleSuccess = (newStatus: { isFreeNow: boolean; activeSkill: string; hourlyRate: number }) => {
        setIsFreeNow(newStatus.isFreeNow);
        setActiveSkill(newStatus.activeSkill);
        setHourlyRate(newStatus.hourlyRate);
    };

    const handlePassRechargeSuccess = (newQuota: number) => {
        setQuotaRemaining(newQuota);
        setHasActivePass(true);
    };

    const handleGigClaimed = (job: ActiveGig) => {
        setActiveJob(job);
        setQuotaRemaining((prev) => Math.max(0, prev - 1));
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#F4F7FB]">
            {/* 1. Master Candidate Hero */}
            <CandidateHero
                initialRole={initialRole}
                initialLocation={initialLocation}
                cities={cities}
                onSearch={(trade) => {
                    setActiveSkill(trade || 'All');
                    const feedElement = document.getElementById('instant-gigs-feed');
                    if (feedElement) {
                        feedElement.scrollIntoView({ behavior: 'smooth' });
                    }
                }}
            />

            {/* 2. Candidate Live Availability Bar (Free Now, Background GPS & Pass Quota) */}
            <CandidateAvailabilityBar
                isFreeNow={isFreeNow}
                quotaRemaining={quotaRemaining}
                hasActivePass={hasActivePass}
                activeSkill={activeSkill}
                hourlyRate={hourlyRate}
                onToggleSuccess={handleToggleSuccess}
                onOpenPassModal={() => setIsPassModalOpen(true)}
                onLocationUpdate={handleLocationUpdate}
            />

            {/* 3. Active Gig In-Progress Card (shown when candidate has an accepted match) */}
            {activeJob && (
                <ActiveGigCard
                    job={activeJob}
                    onStatusChange={(updated) => {
                        if (updated.status === 'CLOSED') {
                            setActiveJob(null);
                        } else {
                            setActiveJob(updated);
                        }
                    }}
                />
            )}

            {/* 4. Spot Work Categories Section */}
            <InstantCategoriesSection
                selectedCategory={activeSkill}
                onSelectCategory={(categoryTitle) => setActiveSkill(categoryTitle)}
            />

            {/* 5. Live Nearby Spot Gigs Feed */}
            <NearbySpotGigsFeed
                userLat={userCoords.lat}
                userLng={userCoords.lng}
                activeSkill={activeSkill}
                isFreeNow={isFreeNow}
                quotaRemaining={quotaRemaining}
                hasActivePass={hasActivePass}
                onOpenPassModal={() => setIsPassModalOpen(true)}
                onGigClaimed={handleGigClaimed}
                onResetCategory={() => setActiveSkill('All')}
            />

            {/* 6. Daily Earnings & Zero Brokerage Payout Banner */}
            <DailyEarningsSummary />

            {/* 7. InstantPass Modal with Wallet & Online Checkout */}
            <InstantPassModal
                isOpen={isPassModalOpen}
                onClose={() => setIsPassModalOpen(false)}
                onSuccess={handlePassRechargeSuccess}
            />
        </div>
    );
}
