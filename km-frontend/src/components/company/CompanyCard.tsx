'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { BuildingOfficeIcon, CaretRightIcon, CheckIcon, PlusIcon, SealCheckIcon } from '@phosphor-icons/react';
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

    // Logo in a neutral tile so every brand sits on the same surface
    const logoTile = (sizeClass: string, iconSize: number) => (
        <span className={`${sizeClass} rounded-xl border border-[#E3E9F1] bg-white p-2 flex items-center justify-center shrink-0`}>
            {company.logo ? (
                <CustomImage
                    src={company.logo}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                />
            ) : (
                <BuildingOfficeIcon size={iconSize} className="text-km-primary" aria-hidden="true" />
            )}
        </span>
    );

    const verifiedSeal = (size: number) =>
        company.verified ? (
            <SealCheckIcon weight="fill" size={size} className="text-[#0B5ED7] shrink-0" aria-label="Verified employer" role="img" />
        ) : null;

    if (variant === 'expanded') {
        return (
            <Link
                href={searchHref}
                className="group/card bg-white rounded-2xl border border-[#D9E0EA] p-5 flex flex-col hover:border-[#0B5ED7]/40 hover:shadow-md transition-all"
            >
                <div className="flex items-center gap-4">
                    {logoTile('w-14 h-14', 24)}
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-base font-semibold text-[#111827] group-hover/card:text-km-primary transition-colors truncate">
                                {company.name}
                            </h3>
                            {verifiedSeal(16)}
                        </div>
                        <p className="mt-0.5 text-sm text-[#5B6472] truncate">
                            {[company.category, company.location].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-[#E3E9F1] flex items-center justify-between text-sm">
                    <span className="font-medium text-[#16A34A]">{company.openings}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-km-primary">
                        View jobs
                        <CaretRightIcon weight="bold" size={14} className="transition-transform group-hover/card:translate-x-0.5" aria-hidden="true" />
                    </span>
                </div>
            </Link>
        );
    }

    return (
        <div className="group bg-white rounded-2xl border border-[#D9E0EA] p-4 flex flex-col hover:border-[#0B5ED7]/40 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
                {logoTile('w-11 h-11', 20)}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                        <Link href={searchHref} className="text-sm font-semibold text-[#111827] group-hover:text-km-primary transition-colors truncate">
                            {company.name}
                        </Link>
                        {verifiedSeal(14)}
                    </div>
                    <p className="text-xs text-[#5B6472] truncate mt-0.5">{company.category}</p>
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-[#E3E9F1] flex items-center justify-between text-xs">
                <Link
                    href={searchHref}
                    className="inline-flex items-center gap-0.5 font-semibold text-km-primary hover:text-km-blue transition-colors"
                >
                    View jobs
                    <CaretRightIcon weight="bold" size={12} aria-hidden="true" />
                </Link>
                <button
                    type="button"
                    onClick={handleFollowClick}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        isFollowing
                            ? 'bg-[#F4F7FB] text-[#111827] border border-[#D9E0EA] hover:bg-[#E3E9F1]'
                            : 'border border-km-primary text-km-primary hover:bg-[#F4F7FB]'
                    }`}
                >
                    {isFollowing ? (
                        <>
                            <CheckIcon weight="bold" size={12} className="text-[#16A34A]" aria-hidden="true" />
                            Following
                        </>
                    ) : (
                        <>
                            <PlusIcon weight="bold" size={12} aria-hidden="true" />
                            Follow
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default CompanyCard;
