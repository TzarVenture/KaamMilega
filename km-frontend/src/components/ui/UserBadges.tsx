'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { MedalIcon, SealCheckIcon, ShieldCheckIcon, type Icon } from '@phosphor-icons/react';

export type BadgeKey = 'verified' | 'top_rated' | 'police_checked';

const BADGES: Record<BadgeKey, { icon: Icon; color: string; label: string; hint: string }> = {
    verified: { icon: SealCheckIcon, color: 'text-km-link', label: 'verified', hint: 'verifiedHint' },
    top_rated: { icon: MedalIcon, color: 'text-[#B45309] dark:text-[#FBBF24]', label: 'topRated', hint: 'topRatedHint' },
    police_checked: { icon: ShieldCheckIcon, color: 'text-[#15803D] dark:text-[#4ADE80]', label: 'policeChecked', hint: 'policeCheckedHint' },
};
const ORDER: BadgeKey[] = ['verified', 'top_rated', 'police_checked'];

/** The badges to show: the server's list, or just Verified from older responses that only send is_verified */
export function badgeList(badges?: string[] | null, isVerified?: boolean): BadgeKey[] {
    const list = (badges ?? (isVerified ? ['verified'] : [])) as string[];
    return ORDER.filter((b) => list.includes(b));
}

interface Props {
    badges?: string[] | null;
    /** Fallback for responses that only say whether the member is verified */
    isVerified?: boolean;
    /** Icon size next to a name */
    size?: number;
    /** Show each badge's name next to its icon (profile header) */
    labelled?: boolean;
    className?: string;
}

/**
 * Verified, Top rated and Police checked, next to a member's name. Icons alone carry a tooltip
 * and a screen-reader label; the labelled form spells each one out.
 */
export default function UserBadges({ badges, isVerified, size = 16, labelled = false, className = '' }: Props) {
    const t = useTranslations('badges');
    const list = badgeList(badges, isVerified);
    if (list.length === 0) return null;

    if (labelled) {
        return (
            <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1 ${className}`}>
                {list.map((key) => {
                    const b = BADGES[key];
                    const BadgeIcon = b.icon;
                    return (
                        <li key={key} className="inline-flex items-center gap-1 text-sm font-medium text-km-text-primary" title={t(b.hint)}>
                            <BadgeIcon size={16} weight="fill" className={`${b.color} shrink-0`} aria-hidden="true" />
                            {t(b.label)}
                        </li>
                    );
                })}
            </ul>
        );
    }

    return (
        <span className={`inline-flex items-center gap-0.5 shrink-0 ${className}`}>
            {list.map((key) => {
                const b = BADGES[key];
                const BadgeIcon = b.icon;
                return (
                    <span key={key} title={t(b.hint)} className="inline-flex">
                        <BadgeIcon size={size} weight="fill" className={`${b.color} shrink-0`} aria-hidden="true" />
                        <span className="sr-only">{t(b.label)}</span>
                    </span>
                );
            })}
        </span>
    );
}
