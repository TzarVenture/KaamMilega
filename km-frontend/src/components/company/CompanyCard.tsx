'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Building2, ChevronRight, CheckCircle2, Check, Plus } from 'lucide-react';
import CustomImage from '@/components/ui/CustomImage';
import { HiringCompany } from '@/lib/constants/companies';

interface CompanyCardProps {
    company: HiringCompany;
    variant?: 'compact' | 'expanded';
    isInitiallyFollowing?: boolean;
    onToggleFollow?: (companyName: string, following: boolean) => void;
}

/**
 * Professional, clean Company Card component following LinkedIn & industry-standard design.
 * Free of artificial counts or cluttered multi-line text wrapping.
 */
export const CompanyCard: React.FC<CompanyCardProps> = ({
    company,
    variant = 'compact',
    isInitiallyFollowing = false,
    onToggleFollow,
}) => {
    const [isFollowing, setIsFollowing] = useState(isInitiallyFollowing);
    const searchHref = `/jobs?company=${encodeURIComponent(company.name)}`;

    const handleFollowClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        const nextState = !isFollowing;
        setIsFollowing(nextState);
        if (onToggleFollow) {
            onToggleFollow(company.name, nextState);
        }
    };

    if (variant === 'expanded') {
        return (
            <Link
                href={searchHref}
                className="bg-gradient-to-b from-white via-white to-[#F4F7FB] rounded-2xl p-2.5 sm:p-3.5 md:p-3 lg:p-3.5 border border-slate-200 shadow-sm shadow-gray-400 hover:border-[#0B5ED7]/60 transition-all flex flex-col items-center justify-between text-center group/card cursor-pointer"
            >
                <div className="w-full flex flex-col items-center">
                    {/* Company Logo Tile with distinctive Brand Tint */}
                    <div className={`w-11 h-11 sm:w-12 sm:h-12 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-xl border p-1.5 sm:p-2 flex items-center justify-center shrink-0 shadow-2xs transition-transform group-hover/card:scale-105 ${company.bgClass || 'bg-slate-50 border-slate-200'}`}>
                        {company.logo ? (
                            <CustomImage
                                src={company.logo}
                                alt={company.name}
                                className={`object-contain ${company.imgClass || 'max-h-full max-w-full'}`}
                            />
                        ) : (
                            <Building2 size={22} className="text-km-primary" />
                        )}
                    </div>

                    {/* Company Name & Verified Badge */}
                    <div className="flex items-center justify-center gap-1 mt-2.5 w-full px-0.5">
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover/card:text-[#071A4D] transition-colors leading-tight truncate">
                            {company.name}
                        </h4>
                        {company.verified && (
                            <CheckCircle2 size={13} className="fill-[#0B5ED7] text-white shrink-0" />
                        )}
                    </div>

                    {/* Category */}
                    <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate w-full px-0.5 mt-0.5">
                        {company.category}
                    </p>

                    {/* Active Hiring Badge */}
                    <div className="mt-1.5">
                        <span className="inline-flex items-center gap-1 text-[9px] sm:text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-1.5 sm:px-2 py-0.5 rounded-full leading-none whitespace-nowrap">
                            <span>Active Hiring</span>
                        </span>
                    </div>
                </div>

                {/* Brand Blue to Deep Navy CTA Pill (Single Line) */}
                <div className="w-full mt-2.5 sm:mt-3 pt-2 sm:pt-2.5 border-t border-slate-100 flex items-center justify-center">
                    <span className="w-full py-1.5 px-1 sm:px-2 bg-blue-50/80 group-hover/card:bg-[#071A4D] text-[#0B5ED7] group-hover/card:text-white border border-blue-200/60 group-hover/card:border-[#071A4D] rounded-lg sm:rounded-xl text-[10px] sm:text-xs font-bold transition-all text-center flex items-center justify-center gap-0.5 sm:gap-1 whitespace-nowrap shadow-2xs">
                        <span>View Jobs</span>
                        <ChevronRight size={11} className="group-hover/card:translate-x-0.5 transition-transform shrink-0" />
                    </span>
                </div>
            </Link>
        );
    }

    return (
        <div className="p-4 rounded-xl border border-gray-200/90 bg-white hover:border-blue-400 hover:shadow-xs transition-all flex flex-col justify-between group">
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-11 h-11 rounded-xl border p-2 shrink-0 flex items-center justify-center bg-white shadow-2xs ${company.bgClass || 'border-gray-200'}`}>
                    {company.logo ? (
                        <CustomImage
                            src={company.logo}
                            alt={company.name}
                            className={`object-contain ${company.imgClass || 'max-h-full max-w-full'}`}
                        />
                    ) : (
                        <Building2 size={20} className="text-km-primary" />
                    )}
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                        <Link href={searchHref} className="font-bold text-sm text-gray-900 group-hover:text-km-primary transition-colors truncate">
                            {company.name}
                        </Link>
                        {company.verified && (
                            <span title="Verified Employer" className="text-blue-500 shrink-0">
                                <CheckCircle2 size={13} className="fill-blue-500 text-white" />
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-gray-500 truncate mt-0.5">{company.category}</p>
                </div>
            </div>

            {/* Clean action bar without line-wrapped fake numbers */}
            <div className="flex items-center justify-between pt-2.5 border-t border-gray-100 text-xs">
                <Link
                    href={searchHref}
                    className="text-gray-500 hover:text-km-primary font-semibold transition-colors inline-flex items-center gap-0.5"
                >
                    <span>View Jobs</span>
                    <ChevronRight size={13} />
                </Link>
                <button
                    type="button"
                    onClick={handleFollowClick}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${isFollowing
                        ? 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200/70'
                        : 'border border-km-primary text-km-primary hover:bg-blue-50'
                        }`}
                >
                    {isFollowing ? (
                        <>
                            <Check size={12} className="text-emerald-600" />
                            <span>Following</span>
                        </>
                    ) : (
                        <>
                            <Plus size={12} />
                            <span>Follow</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CompanyCard;
