'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    Zap,
    MapPin,
    ShieldCheck,
    RefreshCw,
    Wrench,
    Power
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '@/lib/axios';
import { isAuthenticated } from '@/lib/auth';

interface CandidateAvailabilityBarProps {
    isFreeNow: boolean;
    quotaRemaining: number;
    hasActivePass: boolean;
    activeSkill: string;
    hourlyRate: number;
    onToggleSuccess: (newStatus: { isFreeNow: boolean; activeSkill: string; hourlyRate: number }) => void;
    onOpenPassModal: () => void;
    onLocationUpdate?: (lat: number, lng: number) => void;
}

export default function CandidateAvailabilityBar({
    isFreeNow,
    quotaRemaining,
    hasActivePass,
    activeSkill,
    hourlyRate,
    onToggleSuccess,
    onOpenPassModal,
    onLocationUpdate,
}: CandidateAvailabilityBarProps) {
    const [toggling, setToggling] = useState(false);
    const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

    const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const onLocationUpdateRef = useRef(onLocationUpdate);

    // Keep callback ref updated without triggering re-render cascades
    useEffect(() => {
        onLocationUpdateRef.current = onLocationUpdate;
    }, [onLocationUpdate]);

    // Periodic 30-Second GPS Broadcaster strictly active when Free Now is true
    useEffect(() => {
        if (!isFreeNow) {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
            return;
        }

        const sendPing = () => {
            if (typeof window === 'undefined' || !navigator.geolocation) return;

            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const { latitude, longitude } = position.coords;

                    // Update local state only if coordinates shifted
                    setCurrentCoords((prev) => {
                        if (
                            prev &&
                            Math.abs(prev.lat - latitude) < 0.0001 &&
                            Math.abs(prev.lng - longitude) < 0.0001
                        ) {
                            return prev;
                        }
                        return { lat: latitude, lng: longitude };
                    });

                    // Safely invoke parent callback via ref
                    onLocationUpdateRef.current?.(latitude, longitude);

                    try {
                        await api.post('/instant-work/location', {
                            lat: latitude,
                            lng: longitude,
                        });
                    } catch (e) {
                        // Silent catch to prevent UI disturbance during transient network issues
                        console.warn('[InstantMilega] Location ping update notice:', e);
                    }
                },
                (error) => {
                    console.warn('[InstantMilega] Geolocation access notice:', error.message);
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 }
            );
        };

        // Send initial ping on activation
        sendPing();
        pingIntervalRef.current = setInterval(sendPing, 30000);

        return () => {
            if (pingIntervalRef.current) {
                clearInterval(pingIntervalRef.current);
                pingIntervalRef.current = null;
            }
        };
    }, [isFreeNow]); // Strictly depend on isFreeNow to prevent infinite loops

    const handleToggle = async () => {
        if (!isAuthenticated()) {
            toast.info('Please log in as a candidate to go Free Now');
            window.location.href = `/login?redirect=${encodeURIComponent('/instant-milega')}`;
            return;
        }

        const newTarget = !isFreeNow;

        // Quota check before going online
        if (newTarget && (!hasActivePass || quotaRemaining <= 0)) {
            toast.warn('An active InstantPass (₹99) is required to go online and receive dispatches');
            onOpenPassModal();
            return;
        }

        setToggling(true);

        let lat = currentCoords?.lat || 19.0760;
        let lng = currentCoords?.lng || 72.8777;

        if (typeof window !== 'undefined' && navigator.geolocation) {
            try {
                const pos: GeolocationPosition = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 5000,
                        enableHighAccuracy: true,
                    });
                });
                lat = pos.coords.latitude;
                lng = pos.coords.longitude;
                setCurrentCoords({ lat, lng });
                onLocationUpdateRef.current?.(lat, lng);
            } catch (err) {
                console.warn('Geolocation fallback to defaults', err);
            }
        }

        try {
            await api.post('/instant-work/availability', {
                is_free_now: newTarget,
                skill: activeSkill || 'Electrician',
                hourly_rate: hourlyRate > 0 ? hourlyRate : 350,
                lat: lat,
                lng: lng,
            });

            onToggleSuccess({
                isFreeNow: newTarget,
                activeSkill: activeSkill || 'Electrician',
                hourlyRate: hourlyRate > 0 ? hourlyRate : 350,
            });

            if (newTarget) {
                toast.success(`Online as ${activeSkill || 'Professional'}. Visible to nearby employers.`);
            } else {
                toast.info('Status updated to Offline. Dispatches paused.');
            }
        } catch (err: any) {
            if (err?.requires_pass || err?.message?.includes('InstantPass') || err?.message?.includes('quota')) {
                toast.warn(err.message || 'InstantPass required to go Free Now');
                onOpenPassModal();
            } else {
                toast.error(err?.message || 'Failed to update availability status');
            }
        } finally {
            setToggling(false);
        }
    };

    return (
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 sm:mt-6 mb-4">
            <div className="bg-white rounded-2xl border border-[#D9E0EA] p-4 sm:p-5 shadow-xs transition-all">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    {/* Left: Real-world Partner Status Header */}
                    <div className="flex items-center gap-3.5 sm:gap-4">
                        {/* Tactile Status Toggle Button — Perfectly Centered */}
                        <button
                            type="button"
                            onClick={handleToggle}
                            disabled={toggling}
                            className={`relative inline-flex h-9 w-16 shrink-0 cursor-pointer items-center rounded-full p-1 transition-colors duration-200 ease-in-out focus:outline-none disabled:opacity-50 ${
                                isFreeNow
                                    ? 'bg-[#16A34A]'
                                    : 'bg-[#CBD5E1]'
                            }`}
                            aria-label={isFreeNow ? 'Switch to Offline' : 'Switch to Online'}
                            title={isFreeNow ? 'Click to go Offline' : 'Click to go Online'}
                        >
                            <span
                                className={`pointer-events-none flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-sm transition-transform duration-200 ease-in-out ${
                                    isFreeNow ? 'translate-x-7' : 'translate-x-0'
                                }`}
                            >
                                {toggling ? (
                                    <RefreshCw size={13} className="animate-spin text-[#5B6472]" />
                                ) : isFreeNow ? (
                                    <Zap size={14} className="fill-[#16A34A] text-[#16A34A]" />
                                ) : (
                                    <Power size={13} className="text-[#5B6472]" />
                                )}
                            </span>
                        </button>

                        <div>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                                        isFreeNow ? 'bg-[#16A34A]' : 'bg-[#5B6472]'
                                    }`}
                                />
                                <h3 className="text-sm sm:text-base font-bold text-[#071A4D] font-poppins">
                                    {isFreeNow ? 'ONLINE — READY FOR WORK' : 'CURRENTLY OFFLINE'}
                                </h3>
                            </div>

                            <p className="text-xs font-medium text-[#5B6472] flex items-center gap-1.5 mt-0.5">
                                <MapPin size={12} className="text-[#FF6B00] shrink-0" />
                                <span>
                                    {isFreeNow
                                        ? 'GPS broadcasting within 15 km to verified local recruiters'
                                        : 'Turn on status to receive instant hiring requests'}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* Middle: Active Primary Trade Chip */}
                    <div className="flex items-center gap-2.5 self-start md:self-auto">
                        <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#F4F7FB] border border-[#D9E0EA] text-xs font-semibold text-[#111827]">
                            <Wrench size={13} className="text-[#FF6B00] shrink-0" />
                            <span>Primary Trade: <strong className="text-[#071A4D]">{activeSkill || 'All Trades'}</strong></span>
                        </div>
                    </div>

                    {/* Right: Pass Quota Status & Action Button */}
                    <div className="flex items-center gap-3 self-stretch md:self-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-[#D9E0EA]">
                        {hasActivePass && quotaRemaining > 0 ? (
                            <div className="px-3.5 py-2 rounded-xl bg-[#F0FDF4] border border-[#16A34A]/30 text-xs font-semibold text-[#16A34A] flex items-center gap-2">
                                <ShieldCheck size={15} className="text-[#16A34A] shrink-0" />
                                <span>InstantPass: {quotaRemaining} of 10 Gigs Remaining</span>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2.5 w-full md:w-auto justify-between md:justify-end">
                                <span className="text-xs font-semibold text-[#5B6472]">
                                    Pass Inactive (0 Gigs)
                                </span>
                                <button
                                    type="button"
                                    onClick={onOpenPassModal}
                                    className="bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-bold text-xs px-4 py-2 rounded-xl transition-all cursor-pointer shadow-xs active:scale-95"
                                >
                                    Activate Pass (₹99)
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

