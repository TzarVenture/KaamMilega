'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
    Briefcase,
    Building2,
    MapPin,
    Phone,
    MessageSquare,
    CheckCircle2,
    Clock,
    ShieldCheck
} from 'lucide-react';
import { toast } from 'react-toastify';
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
            toast.success('Shift marked complete. Awaiting employer approval.');
            onStatusChange(updated);
        } catch (err: any) {
            toast.error(err.message || 'Failed to update job status');
        } finally {
            setCompleting(false);
        }
    };

    const isFinished = job.status === 'COMPLETED';

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
            <div className="bg-white rounded-2xl border-2 border-[#071A4D] shadow-xs p-5 sm:p-6">
                {/* Header Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D9E0EA]">
                    <div className="flex items-center gap-2.5">
                        <span className={`w-2.5 h-2.5 rounded-full ${isFinished ? 'bg-[#F59E0B]' : 'bg-[#16A34A]'}`} />
                        <div>
                            <span className="text-xs font-bold uppercase tracking-wider text-[#5B6472] block">
                                {isFinished ? 'Shift Completed · Payment Pending' : 'Active Shift Assigned'}
                            </span>
                            <h3 className="text-lg font-bold text-[#071A4D] mt-0.5">
                                {job.skill} for {job.company_name || 'Employer'}
                            </h3>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span className="px-3 py-1 rounded-md bg-[#F0FDF4] text-[#16A34A] border border-[#16A34A]/30 text-xs font-bold flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-[#16A34A]" />
                            <span>Match Confirmed</span>
                        </span>
                    </div>
                </div>

                {/* Job Details */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 py-4">
                    <div className="md:col-span-8 space-y-3">
                        <div className="flex flex-wrap items-center gap-4 text-xs text-[#5B6472] font-medium">
                            <div className="flex items-center gap-1.5 text-[#111827] font-semibold">
                                <Building2 size={15} className="text-[#071A4D]" />
                                <span>{job.company_name || 'Employer'}</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1.5">
                                <MapPin size={15} className="text-[#FF6B00]" />
                                <span>{job.address || 'Address provided upon match'}</span>
                            </div>
                            <span>•</span>
                            <div className="flex items-center gap-1.5">
                                <Clock size={15} className="text-[#5B6472]" />
                                <span>Est. {job.duration_hours || 4} Hours</span>
                            </div>
                        </div>

                        {job.notes && (
                            <div className="p-3 rounded-xl bg-[#F4F7FB] border border-[#D9E0EA] text-xs text-[#111827]">
                                <span className="font-bold block mb-0.5 text-[#071A4D]">Job Notes:</span>
                                {job.notes}
                            </div>
                        )}

                        {/* Direct Contact Bar */}
                        <div className="flex flex-wrap items-center gap-3 pt-2">
                            {job.recruiter_mobile ? (
                                <a
                                    href={`tel:${job.recruiter_mobile}`}
                                    className="inline-flex items-center gap-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                                >
                                    <Phone size={14} className="fill-white" />
                                    <span>Call Employer: {job.recruiter_mobile}</span>
                                </a>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => toast.info('Connecting with employer...')}
                                    className="inline-flex items-center gap-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                                >
                                    <Phone size={14} className="fill-white" />
                                    <span>Call Employer</span>
                                </button>
                            )}

                            <Link
                                href={`/chat?user=${job.recruiter_id}`}
                                className="inline-flex items-center gap-2 bg-white hover:bg-[#F4F7FB] border border-[#071A4D] text-[#071A4D] font-semibold text-xs px-4 py-2.5 rounded-xl transition-colors cursor-pointer"
                            >
                                <MessageSquare size={14} className="text-[#071A4D]" />
                                <span>In-App Chat</span>
                            </Link>
                        </div>
                    </div>

                    {/* Right: Payment & Completion Action */}
                    <div className="md:col-span-4 flex flex-col justify-between p-4 rounded-xl bg-[#F4F7FB] border border-[#D9E0EA]">
                        <div>
                            <span className="text-[11px] font-semibold text-[#5B6472] uppercase block">Agreed Pay</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-2xl font-bold text-[#071A4D]">₹{job.pay_rate}</span>
                                <span className="text-xs text-[#5B6472]">
                                    {job.rate_type === 'hourly' ? '/ hr' : 'flat rate'}
                                </span>
                            </div>
                            <p className="text-[11px] text-[#16A34A] font-semibold mt-1">
                                0% Platform Commission · 100% Direct Payout
                            </p>
                        </div>

                        <div className="mt-4 pt-3 border-t border-[#D9E0EA]">
                            {isFinished ? (
                                <div className="p-2.5 rounded-xl bg-[#FFFBEB] border border-[#F59E0B]/30 text-center">
                                    <p className="text-xs font-semibold text-[#B45309]">Awaiting Employer Approval</p>
                                    <p className="text-[11px] text-[#5B6472] mt-0.5">
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
                                            <CheckCircle2 size={15} />
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
