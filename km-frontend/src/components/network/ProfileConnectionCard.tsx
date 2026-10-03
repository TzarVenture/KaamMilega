'use client';

import React from 'react';
import Link from 'next/link';
import { MessageSquare, MessageCircle, MapPin, CheckCircle2, UserPlus, Trash2, X, Calendar } from 'lucide-react';
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
    hourly_rate?: number;
    job_categories?: string[];
}

export interface ProfileConnectionCardProps {
    user: ProfileCardUser;
    variant?: 'slider' | 'grid';
    actionType?: 'discover' | 'connected' | 'expert';
    showConnect?: boolean;
    isPending?: boolean;
    isSelf?: boolean;
    badgeText?: string;
    entityType?: 'connect' | 'expert';
    onChat: (id: string) => void;
    onFollow?: (id: string, name?: string) => void;
    onConnect?: (id: string, name?: string) => void;
    onRemove?: (id: string) => void;
    onDismiss?: (id: string) => void;
    onBook?: (id: string) => void;
}

/**
 * Universal, production-crafted Profile Connection Card.
 * Strict design system alignment: Deep Navy (#071A4D), Brand Orange (#FF6B00),
 * Brand Blue (#0B5ED7), and neutral borders (#D9E0EA).
 * Zero AI slop: mathematical vertical alignment, crisp contrast, and tactile micro-states.
 */
export const ProfileConnectionCard: React.FC<ProfileConnectionCardProps> = ({
    user,
    variant = 'slider',
    actionType = 'discover',
    showConnect = true,
    isPending = false,
    isSelf = false,
    badgeText,
    entityType,
    onChat,
    onFollow,
    onConnect,
    onRemove,
    onDismiss,
    onBook,
}) => {
    const userId = user.id || user._id || '';
    const rawName = user.name || user.full_name || (user.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : '');
    const cleanName = rawName ? rawName.replace(/\s*\.+$/, '') : 'Verified Member';
    const headline = user.headline || user.designation || user.expertise || (user.job_categories?.[0] ? `${user.job_categories[0]} Specialist` : 'Trade & Career Member');
    const profileHref = userId ? (actionType === 'expert' || user.roles?.includes('expert') ? `/expert/${userId}` : `/profile/${userId}`) : '#';

    const handleConnectAction = onConnect || onFollow;

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
            className={`relative bg-white flex flex-col justify-between transition-all duration-200 group ${
                isGrid
                    ? 'w-full p-5 rounded-2xl border border-[#D9E0EA] hover:border-[#0B5ED7]/50 hover:shadow-md h-full text-center'
                    : 'w-60 sm:w-64 p-5 rounded-2xl shrink-0 border border-[#D9E0EA] shadow-2xs hover:shadow-md hover:border-[#0B5ED7]/50 h-full text-center'
            }`}
        >
            {/* Dismiss action */}
            {onDismiss && (
                <button
                    type="button"
                    onClick={() => onDismiss(userId)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-slate-600 transition-colors p-1.5 rounded-lg cursor-pointer"
                    aria-label="Dismiss recommendation"
                >
                    <X size={15} />
                </button>
            )}

            {/* Remove connection / expert action */}
            {onRemove && (
                <button
                    type="button"
                    onClick={() => onRemove(userId)}
                    className="absolute top-3 right-3 text-slate-300 hover:text-red-600 hover:bg-red-50 transition-colors p-1.5 rounded-lg cursor-pointer"
                    aria-label="Remove connection"
                    title="Remove connection"
                >
                    <Trash2 size={15} />
                </button>
            )}

            <Link href={profileHref} className="w-full flex flex-col items-center cursor-pointer">
                {/* Avatar with online status */}
                <div className="relative mb-3 shrink-0">
                    <div className="w-16 h-16 rounded-full bg-[#F4F7FB] border-2 border-[#D9E0EA] group-hover:border-[#071A4D] flex items-center justify-center overflow-hidden shadow-2xs transition-colors">
                        <UserAvatar src={user.profile_image} name={cleanName} />
                    </div>
                    <div className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>

                {/* Name */}
                <h3 className="text-sm font-bold text-[#111827] group-hover:text-[#0B5ED7] transition-colors leading-tight mb-1 text-center line-clamp-1 min-h-[1.25rem]">
                    {cleanName}
                </h3>

                {/* Headline */}
                <p className="text-[11px] text-[#5B6472] mb-1 font-medium text-center line-clamp-1 max-w-[92%] min-h-[1rem]">
                    {headline}
                </p>

                {/* Location */}
                <div className="min-h-[1.25rem] flex items-center justify-center mb-1">
                    {user.city ? (
                        <div className="flex items-center gap-1 text-[#5B6472] text-[10px] font-semibold">
                            <MapPin size={11} className="text-[#071A4D] shrink-0" />
                            <span className="line-clamp-1">{user.city}</span>
                        </div>
                    ) : null}
                </div>

                {/* Badge text */}
                <div className="min-h-[1.5rem] flex items-center justify-center mb-3">
                    {displayBadge ? (
                        <span className="text-[10px] font-bold tracking-wide text-[#0B5ED7] bg-[#0B5ED7]/10 px-2.5 py-0.5 rounded-full inline-block">
                            {displayBadge}
                        </span>
                    ) : null}
                </div>
            </Link>

            {/* Action Buttons - Fixed at bottom */}
            <div className="w-full flex flex-col gap-2 mt-auto pt-2 border-t border-[#D9E0EA]/40">
                {!isSelf && (
                    <>
                        {/* Connected State */}
                        {actionType === 'connected' && (
                            <button
                                type="button"
                                onClick={() => onChat(userId)}
                                className="w-full py-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                            >
                                <MessageSquare size={14} />
                                <span>Message</span>
                            </button>
                        )}

                        {/* Expert State */}
                        {actionType === 'expert' && (
                            <>
                                <Link
                                    href={`/expert/${userId}`}
                                    className="w-full py-2 bg-[#FF6B00] hover:bg-[#E05E00] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                                >
                                    <Calendar size={14} />
                                    <span>Book Session</span>
                                </Link>
                                <button
                                    type="button"
                                    onClick={() => onChat(userId)}
                                    className="w-full py-2 rounded-xl border border-[#D9E0EA] text-[#071A4D] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#F4F7FB] hover:border-[#071A4D] transition-all cursor-pointer active:scale-[0.98]"
                                >
                                    <MessageSquare size={14} />
                                    <span>Chat</span>
                                </button>
                            </>
                        )}

                        {/* Discover State */}
                        {actionType === 'discover' && (
                            <>
                                {showConnect && handleConnectAction && (
                                    isPending ? (
                                        <button
                                            type="button"
                                            disabled
                                            className="w-full py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-default border border-slate-200"
                                        >
                                            <CheckCircle2 size={13} className="text-emerald-500" />
                                            <span>Pending</span>
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => handleConnectAction(userId, cleanName)}
                                            className="w-full py-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-[0.98]"
                                        >
                                            <UserPlus size={14} />
                                            <span>Connect</span>
                                        </button>
                                    )
                                )}

                                <button
                                    type="button"
                                    onClick={() => onChat(userId)}
                                    className="w-full py-2 rounded-xl border border-[#D9E0EA] text-[#071A4D] text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-[#F4F7FB] hover:border-[#071A4D] transition-all cursor-pointer active:scale-[0.98]"
                                >
                                    {isGrid ? <MessageCircle size={14} /> : <MessageSquare size={14} />}
                                    <span>Chat</span>
                                </button>
                            </>
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
                className={isGrid ? 'w-full h-full' : 'shrink-0 h-full'}
            >
                {cardContent}
            </ImpressionWrapper>
        );
    }

    return cardContent;
};

export default ProfileConnectionCard;
