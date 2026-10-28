'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { BuildingOfficeIcon, CaretRightIcon, CheckIcon, PlusIcon, SealCheckIcon } from '@phosphor-icons/react';
import CustomImage from '@/components/ui/CustomImage';
import { HiringCompany } from '@/lib/constants/companies';
import { useFormat } from '@/i18n/useFormat';

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
    const t = useTranslations('company');
    const tc = useTranslations('common');
    const { number } = useFormat();
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
        <span className={`${sizeClass} rounded-xl border border-km-border-subtle bg-white p-2 flex items-center justify-center shrink-0`}>
            {company.logo ? (
                <CustomImage
                    src={company.logo}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                />
            ) : (
                <BuildingOfficeIcon size={iconSize} className="text-km-heading" aria-hidden="true" />
            )}
        </span>
    );

    const verifiedSeal = (size: number) =>
        company.verified ? (
            <SealCheckIcon weight="fill" size={size} className="text-km-link shrink-0" aria-label={t('verified')} role="img" />
        ) : null;

    if (variant === 'expanded') {
        return (
            <Link
                href={searchHref}
                className="group/card bg-km-surface-card rounded-2xl border border-km-border p-5 flex flex-col hover:border-[#0B5ED7]/40 hover:shadow-md transition-all"
            >
                <div className="flex items-center gap-4">
                    {logoTile('w-14 h-14', 24)}
                    <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                            <h3 className="text-base font-semibold text-km-text-primary group-hover/card:text-km-heading transition-colors truncate">
                                {company.name}
                            </h3>
                            {verifiedSeal(16)}
                        </div>
                        <p className="mt-0.5 text-sm text-km-text-secondary truncate">
                            {[company.category, company.location].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                </div>

                <div className="mt-5 pt-4 border-t border-km-border-subtle flex items-center justify-between text-sm">
                    <span className="font-medium text-[#16A34A]">
                        {company.jobCount > 0 ? tc('openJobs', { count: company.jobCount, n: number(company.jobCount) }) : ''}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-km-heading">
                        {t('viewJobs')}
                        <CaretRightIcon weight="bold" size={14} className="transition-transform group-hover/card:translate-x-0.5" aria-hidden="true" />
                    </span>
                </div>
            </Link>
        );
    }

    return (
        <div className="group bg-km-surface-card rounded-2xl border border-km-border p-4 flex flex-col hover:border-[#0B5ED7]/40 hover:shadow-md transition-all">
            <div className="flex items-center gap-3">
                {logoTile('w-11 h-11', 20)}
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                        <Link href={searchHref} className="text-sm font-semibold text-km-text-primary group-hover:text-km-heading transition-colors truncate">
                            {company.name}
                        </Link>
                        {verifiedSeal(14)}
                    </div>
                    {company.category && <p className="text-xs text-km-text-secondary truncate mt-0.5">{company.category}</p>}
                </div>
            </div>

            <div className="mt-3 pt-3 border-t border-km-border-subtle flex items-center justify-between text-xs">
                <Link
                    href={searchHref}
                    className="inline-flex items-center gap-0.5 font-semibold text-km-heading hover:text-km-blue transition-colors"
                >
                    {t('viewJobs')}
                    <CaretRightIcon weight="bold" size={12} aria-hidden="true" />
                </Link>
                {onToggleFollow && (
                <button
                    type="button"
                    onClick={handleFollowClick}
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold transition-colors cursor-pointer ${
                        isFollowing
                            ? 'bg-km-surface text-km-text-primary border border-km-border hover:bg-[#E3E9F1] dark:hover:bg-[#1D253D]'
                            : 'border border-km-primary text-km-heading hover:bg-km-surface'
                    }`}
                >
                    {isFollowing ? (
                        <>
                            <CheckIcon weight="bold" size={12} className="text-[#16A34A]" aria-hidden="true" />
                            {t('following')}
                        </>
                    ) : (
                        <>
                            <PlusIcon weight="bold" size={12} aria-hidden="true" />
                            {t('follow')}
                        </>
                    )}
                </button>
                )}
            </div>
        </div>
    );
};

export default CompanyCard;
