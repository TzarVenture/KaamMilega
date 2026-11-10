'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, CheckCircleIcon, ShieldCheckIcon } from '@phosphor-icons/react';

export default function DailyEarningsSummary() {
    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mb-12">
            <div className="rounded-2xl bg-[#071A4D] p-6 sm:p-8 text-white dark:ring-1 dark:ring-inset dark:ring-white/10">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                    {/* Left: Heading and Guarantees */}
                    <div className="lg:col-span-8 space-y-3">
                        <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-[#FDBA74]">
                            <ShieldCheckIcon weight="bold" size={14} className="text-[#FF6B00]" />
                            <span>KaamMilega payouts</span>
                        </div>

                        <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-white">
                            Zero Platform Commission. Keep 100% of Your Earnings.
                        </h3>

                        <p className="text-xs sm:text-sm text-slate-300 max-w-xl font-normal leading-relaxed">
                            Once an employer confirms your work, your earnings reach your KaamMilega Wallet. Complete KYC to withdraw them to your bank.
                        </p>

                        <div className="flex flex-wrap items-center gap-5 pt-2 text-xs font-medium text-slate-200">
                            <div className="flex items-center gap-1.5">
                                <CheckCircleIcon weight="bold" size={15} className="text-[#FF6B00]" />
                                <span>Direct Employer Contact</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircleIcon weight="bold" size={15} className="text-[#FF6B00]" />
                                <span>Zero Brokerage / 0% Cut</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <CheckCircleIcon weight="bold" size={15} className="text-[#FF6B00]" />
                                <span>Withdraw to your bank</span>
                            </div>
                        </div>
                    </div>

                    {/* Right: Wallet Access Card */}
                    <div className="lg:col-span-4 flex flex-col justify-center">
                        <div className="p-5 rounded-xl bg-[#0B1F52] text-center">
                            <h4 className="text-base font-bold text-white">
                                KaamMilega Wallet
                            </h4>

                            <p className="text-xs text-slate-300 mt-1 mb-4">
                                See your earnings and withdraw them to your bank.
                            </p>

                            <Link
                                href="/wallet"
                                className="w-full inline-flex items-center justify-center gap-2 bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-semibold text-xs py-2.5 px-4 rounded-xl transition-colors cursor-pointer"
                            >
                                <span>Open Wallet</span>
                                <ArrowRightIcon weight="bold" size={14} />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
