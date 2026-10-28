'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BuildingOfficeIcon, ChatIcon, CheckCircleIcon, ClockIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import api from '@/lib/axios';

export interface ActiveGig {
    id: string;
    recruiter_id: string;
    recruiter_name: string;
    recruiter_mobile?: string;
    company_name: string;
    skill: string;
    address: string;
    pay_rate: number;
    rate_type: string;
    duration_hours: number;
    notes?: string;
    status: 'ACCEPTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED';
    matched_at?: string;
}

interface ActiveGigCardProps {
    job: ActiveGig;
    onStatusChange: (updatedJob: ActiveGig) => void;
}

export default function ActiveGigCard({ job, onStatusChange }: ActiveGigCardProps) {
    const [completing, setCompleting] = useState(false);

    const handleComplete = async () => {
        if (!confirm('Confirm that you have finished your work shift. The employer will be notified to release payment.')) {
            return;
        }

        setCompleting(true);
        try {
            const updated: any = await api.put(`/instant-work/jobs/${job.id}/complete`);
            notify.success('Shift marked complete. Awaiting employer approval.');
            onStatusChange(updated);
        } catch (err: any) {
            notify.error(err.message || 'Failed to update job status');
        } finally {
            setCompleting(false);
        }
    };

    const isFinished = job.status === 'COMPLETED';

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
            <div className="bg-km-surface-card rounded-2xl border-2 border-[#071A4D] shadow-xs p-5 sm:p-6 dark:border-km-link">
                {/* Header Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-km-border">
                    <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isFinished ? 'bg-[#F59E0B]' : 'bg-[#16A34A]'}`} />
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-km-text-secondary block">
                                {isFinished ? 'Shift Completed · Payment Pending' : 'Active Shift Assigned'}
                            </span>
                            <h3 className="text-lg font-bold text-km-heading mt-0.5">
                                {job.skill} for {job.company_name || 'Employer'}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="px-3 py-1 rounded-md bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/30 text-xs font-bold flex items-center gap-1.5 dark:bg-[#1D253D]">
                            <ShieldCheckIcon weight="bold" size={14} className="text-[#16A34A]" />
                            <span>Match Confirmed</span>
                        </span>
                    </div>
                </div>

                {/* Job Details */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-4">
                    <div className="md:col-span-8 space-y-3">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-km-text-secondary font-medium">
                            <div className="flex items-center gap-1.5 text-km-text-primary font-semibold">
                                <BuildingOfficeIcon weight="bold" size={15} className="text-km-heading" />
                                <span>{job.company_name || 'Employer'}</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1.5">
                                <MapPinIcon weight="bold" size={15} className="text-[#FF6B00]" />
                                <span>{job.address || 'Address provided upon match'}</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1.5">
                                <ClockIcon weight="bold" size={15} className="text-km-text-secondary" />
                                <span>Est. {job.duration_hours || 4} Hours</span>
                            </div>
                        </div>

                        {job.notes && (
                            <div className="p-3 rounded-xl bg-km-surface border border-km-border text-xs text-km-text-primary">
                                <span className="font-bold block mb-0.5 text-km-heading">Job Notes:</span>
                                {job.notes}
                            </div>
                        )}

                        {/* Direct Contact Bar */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            {job.recruiter_mobile ? (
                                <a
                                    href={`tel:${job.recruiter_mobile}`}
                                    className="inline-flex items-center gap-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                >
                                    <PhoneIcon weight="fill" size={14} className="fill-white" />
                                    <span>Call Employer: {job.recruiter_mobile}</span>
                                </a>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => notify.info('Connecting with employer...')}
                                    className="inline-flex items-center gap-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                >
                                    <PhoneIcon weight="fill" size={14} className="fill-white" />
                                    <span>Call Employer</span>
                                </button>
                            )}

                            <Link
                                href={`/chat?user=${job.recruiter_id}`}
                                className="inline-flex items-center gap-2 bg-km-surface-card hover:bg-km-surface border border-[#071A4D] text-km-heading font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer dark:border-km-link"
                            >
                                <ChatIcon weight="bold" size={14} className="text-km-heading" />
                                <span>In-App Chat</span>
                            </Link>
                        </div>
                    </div>

                    {/* Right: Payment & Completion Action */}
                    <div className="md:col-span-4 flex flex-col justify-between p-4 rounded-xl bg-km-surface border border-km-border">
                        <div>
                            <span className="text-[11px] font-semibold text-km-text-secondary uppercase block">Agreed Pay</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-2xl font-bold text-km-heading">₹{job.pay_rate}</span>
                                <span className="text-xs text-km-text-secondary">
                                    {job.rate_type === 'hourly' ? '/ hr' : 'flat rate'}
                                </span>
                            </div>
                            <p className="text-[11px] text-[#16A34A] font-semibold mt-1">
                                0% Platform Commission · 100% Direct Payout
                            </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-km-border">
                            {isFinished ? (
                                <div className="p-2.5 rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/30 text-center dark:bg-[#332E2D]">
                                    <p className="text-xs font-semibold text-[#B45309] dark:text-orange-400">Awaiting Employer Approval</p>
                                    <p className="text-[11px] text-km-text-secondary mt-0.5">
                                        Funds will credit automatically to your wallet upon confirmation.
                                    </p>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleComplete}
                                    disabled={completing}
                                    className="w-full bg-[#FF6B00] hover:bg-[#FF8A00] active:scale-[0.98] text-white font-semibold text-xs py-2.5 rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                                >
                                    {completing ? (
                                        <span>Submitting...</span>
                                    ) : (
                                        <>
                                            <CheckCircleIcon weight="bold" size={15} />
                                            <span>Mark Work Complete</span>
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
