import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';

import ProfileConnectionCard, { ProfileCardUser } from '@/components/network/ProfileConnectionCard';
import SectionHeader from '@/components/home/SectionHeader';

interface Props {
    users: ProfileCardUser[];
    pendingIds?: string[];
    connectedIds?: string[];
    onChat: (id: string) => void;
    onFollow: (id: string, name?: string) => void;
}

// Same section, header and auto-scrolling row as "Connect with our experts" on the home page
export const ConnectJustLikeYou: React.FC<Props> = ({ users, pendingIds = [], connectedIds = [], onChat, onFollow }) => {
    const t = useTranslations('home.connect');
    const [currentUserId, setCurrentUserId] = useState<string>('');

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    const parsed = JSON.parse(storedUser);
                    setCurrentUserId(parsed.id || parsed._id || '');
                }
            } catch {
                // Ignore parsing errors
            }
        }
    }, []);

    if (!users || users.length === 0) return null;

    return (
        <section className="py-8 sm:py-10 lg:py-12" aria-labelledby="connect-title">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <SectionHeader
                    id="connect-title"
                    title={t('title')}
                    description={t('text')}
                    action={{ href: '/network', label: t('action') }}
                />

                {/* Auto-scrolling row of profile cards (pauses on hover/touch) */}
                <div className="overflow-hidden">
                    <div className="animate-km-marquee hover:[animation-play-state:paused] active:[animation-play-state:paused] py-1">
                        {[...users, ...users].map((user, idx) => {
                            const targetUserId = user.id || user._id || '';
                            const isSelf = Boolean(currentUserId && targetUserId === currentUserId);
                            const isPending = pendingIds.includes(targetUserId);
                            const isConnected = connectedIds.includes(targetUserId);

                            return (
                                <div key={`${targetUserId}-${idx}`} className="shrink-0 mr-5" aria-hidden={idx >= users.length || undefined}>
                                    <ProfileConnectionCard
                                        user={user}
                                        variant="slider"
                                        isSelf={isSelf}
                                        isPending={isPending}
                                        isConnected={isConnected}
                                        entityType="connect"
                                        onChat={onChat}
                                        onFollow={onFollow}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default ConnectJustLikeYou;
