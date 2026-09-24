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
            <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-blue-400 transition-all flex flex-col justify-between group/card">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3.5">
                            <div className={`w-13 h-13 rounded-xl border p-2 flex items-center justify-center shrink-0 bg-white shadow-2xs ${company.bgClass || 'border-slate-200'}`}>
                                {company.logo ? (
                                    <CustomImage
                                        src={company.logo}
                                        alt={company.name}
                                        className={`object-contain ${company.imgClass || 'max-h-full max-w-full'}`}
                                    />
                                ) : (
                                    <Building2 size={24} className="text-km-primary" />
                                )}
                            </div>
                            <div>
                                <div className="flex items-center gap-1.5">
                                    <h4 className="text-base font-bold text-slate-900 group-hover/card:text-km-primary transition-colors leading-tight">
                                        {company.name}
                                    </h4>
                                    {company.verified && (
                                        <CheckCircle2 size={15} className="fill-blue-500 text-white shrink-0" />
                                    )}
                                </div>
                                <p className="text-xs text-slate-500 mt-1">
                                    {company.category}
                                </p>
                            </div>
                        </div>
                        <span className="text-[11px] font-bold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-full shrink-0">
                            Verified Employer
                        </span>
                    </div>
                </div>

                <Link href={searchHref} className="mt-4">
                    <button className="w-full py-2.5 bg-slate-50 group-hover/card:bg-km-primary group-hover/card:text-white text-slate-700 border border-slate-200 group-hover/card:border-km-primary rounded-xl text-xs sm:text-sm font-bold transition-all shadow-2xs cursor-pointer">
                        View Jobs →
                    </button>
                </Link>
            </div>
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
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        isFollowing
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
