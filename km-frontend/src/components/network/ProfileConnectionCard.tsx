'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, MessageCircle, MapPin, CheckCircle2 } from 'lucide-react';
import UserAvatar from '@/components/ui/UserAvatar';
import { ImpressionWrapper } from '@/lib/telemetry';

export interface ProfileCardUser {
    id?: string;
    _id?: string;
    name?: string;
    full_name?: string;
    first_name?: string;
    last_name?: string;
    roles?: string[];
    headline?: string;
    designation?: string;
    expertise?: string;
    profile_image?: string;
    city?: string;
    mutual_connects?: number;
    followers_count?: number;
    rating?: string | number;
    job_categories?: string[];
}

export interface ProfileConnectionCardProps {
    user: ProfileCardUser;
    variant?: 'slider' | 'grid';
    showConnect?: boolean;
    isPending?: boolean;
    isSelf?: boolean;
    badgeText?: string;
    entityType?: 'connect' | 'expert';
    onChat: (id: string) => void;
    onFollow?: (id: string, name?: string) => void;
}

/**
 * Universal, modular Profile Connection Card following Next.js & Vercel best practices.
 * Unifies candidate and expert cards across Home, Network, and Profile Interest sections.
 * Replaces legacy letter-based initials with the modern LinkedIn/Instagram neutral silhouette avatar.
 */
export const ProfileConnectionCard: React.FC<ProfileConnectionCardProps> = ({
    user,
    variant = 'slider',
    showConnect = true,
    isPending = false,
    isSelf = false,
    badgeText,
    entityType,
    onChat,
    onFollow,
}) => {
    const userId = user.id || user._id || '';
    const rawName = user.name || user.full_name || (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '');
    const cleanName = rawName ? rawName.replace(/\s*\.+$/, '') : 'Verified Member';
    const headline = user.headline || user.designation || user.expertise || (user.job_categories?.[0] ? `${user.job_categories[0]} Specialist` : 'Career & Trade Mentor');
    const profileHref = userId ? `/profile/${userId}` : '#';

    // Compute display badge (only if genuine data exists)
    const displayBadge = badgeText !== undefined
        ? badgeText
        : user.mutual_connects && user.mutual_connects > 0
            ? `${user.mutual_connects} Mutual Connects`
            : user.rating
                ? `${user.rating} ★ Rating`
                : null;

    const isGrid = variant === 'grid';

    const cardContent = (
        <div
            className={`bg-white flex flex-col items-center justify-between transition-all group ${
                isGrid
                    ? 'w-full p-5 rounded-2xl border border-gray-100 bg-gray-50/40 hover:bg-white hover:border-gray-200 hover:shadow-xs text-center'
                    : 'w-60 sm:w-65 p-6 rounded-3xl shrink-0 border border-slate-200/90 shadow-2xs hover:shadow-md hover:border-slate-300 h-full text-center'
            }`}
        >
            <Link href={profileHref} className="w-full flex flex-col items-center cursor-pointer">
                {/* Avatar with online status */}
                <div className="relative mb-3.5">
                    <div
                        className={`${
                            isGrid ? 'w-16 h-16' : 'w-18 h-18'
                        } rounded-full bg-slate-100 border-2 border-slate-200 group-hover:border-km-primary flex items-center justify-center overflow-hidden shadow-2xs transition-colors`}
                    >
                        <UserAvatar src={user.profile_image} name={cleanName} />
                    </div>
                    <div className="absolute bottom-0 right-0.5 w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full bg-emerald-500 border-2 border-white" />
                </div>

                {/* Name */}
                <h3 className="text-sm font-bold text-slate-900 group-hover:text-km-primary transition-colors leading-tight mb-0.5 text-center line-clamp-1">
                    {cleanName}
                </h3>

                {/* Headline */}
                <p className="text-[11px] text-slate-500 mb-2 font-medium text-center line-clamp-1 max-w-[90%]">
                    {headline}
                </p>

                {/* Location (if present) */}
                {user.city && (
                    <div className="flex items-center gap-1 text-slate-400 text-[10px] mb-1.5 font-semibold">
                        <MapPin size={11} className="text-km-primary" />
                        <span className="line-clamp-1">{user.city}</span>
                    </div>
                )}

                {/* Badge text (only if present) */}
                {displayBadge && (
                    <p className="text-[10px] sm:text-[11px] text-km-primary font-bold tracking-wide mb-3">
                        {displayBadge}
                    </p>
                )}
            </Link>

            {/* Action Buttons */}
            <div className="w-full flex gap-2 mt-auto flex-col">
                {!isSelf && (
                    <>
                        <button
                            type="button"
                            onClick={() => onChat(userId)}
                            className="w-full py-2 rounded-xl border border-km-primary text-km-primary text-xs font-bold flex items-center justify-center gap-1.5 hover:bg-blue-50 transition-colors cursor-pointer"
                        >
                            {isGrid ? <MessageCircle size={14} /> : <MessageSquare size={14} />}
                            Chat
                        </button>

                        {showConnect && onFollow && (
                            isPending ? (
                                <button
                                    type="button"
                                    disabled
                                    className="w-full py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-default border border-slate-200"
                                >
                                    <CheckCircle2 size={13} className="text-emerald-500" />
                                    Pending
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => onFollow(userId, cleanName)}
                                    className="w-full py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-98"
                                >
                                    Connect
                                </button>
                            )
                        )}
                    </>
                )}
            </div>
        </div>
    );

    if (entityType && userId) {
        return (
            <ImpressionWrapper
                authorId={userId}
                entityId={`${entityType}:${userId}`}
                className={isGrid ? 'w-full' : 'shrink-0'}
            >
                {cardContent}
            </ImpressionWrapper>
        );
    }

    return cardContent;
};

export default ProfileConnectionCard;
