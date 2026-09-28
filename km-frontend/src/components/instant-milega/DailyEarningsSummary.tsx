'use client';

import React from 'react';
import Link from 'next/link';
import {
    Wallet,
    ArrowRight,
    CheckCircle2,
    ShieldCheck,
    CreditCard
} from 'lucide-react';

export default function DailyEarningsSummary() {
    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-12">
            <div className="rounded-2xl bg-[#071A4D] p-6 sm:p-8 text-white">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Left: Heading and Guarantees */}
                    <div className="lg:col-span-8 space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/10 text-white text-xs font-semibold">
                            <ShieldCheck size={14} className="text-[#FF6B00]" />
                            <span>KaamMilega Payout Guarantee</span>
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                            Zero Platform Commission. Keep 100% of Your Earnings.
                        </h3>

                        <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-normal leading-relaxed">
                            Once an employer confirms your spot gig completion, earnings are credited immediately to your KaamMilega Wallet with support for same-day UPI and IMPS bank withdrawal.
                        </p>

                        <div className="flex flex-wrap items-center gap-5 pt-2 text-xs font-medium text-slate-200">
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-[#FF6B00]" />
                                <span>Direct Employer Contact</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-[#FF6B00]" />
                                <span>Zero Brokerage / 0% Cut</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircle2 size={15} className="text-[#FF6B00]" />
                                <span>Same-Day Bank Transfers</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Wallet Access Card */}
                    <div className="lg:col-span-4 flex flex-col justify-center">
                        <div className="p-5 rounded-xl bg-white/10 border border-white/10 text-center">
                            <div className="w-10 h-10 rounded-xl bg-[#FF6B00] mx-auto flex items-center justify-center text-white mb-2.5">
                                <Wallet size={20} />
                            </div>

                            <h4 className="text-base font-bold text-white">
                                KaamMilega Wallet
                            </h4>

                            <p className="text-xs text-slate-300 mt-1 mb-4">
                                Check shift credits, view ledger statements, or transfer funds to your bank.
                            </p>

                            <Link
                                href="/wallet"
                                className="w-full inline-flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
                            >
                                <span>Open Wallet</span>
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
