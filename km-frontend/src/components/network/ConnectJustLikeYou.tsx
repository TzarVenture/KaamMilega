import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProfileConnectionCard, { ProfileCardUser } from '@/components/network/ProfileConnectionCard';
import InteractiveScrollbar from '@/components/ui/InteractiveScrollbar';

interface Props {
    users: ProfileCardUser[];
    pendingIds?: string[];
    connectedIds?: string[];
    onChat: (id: string) => void;
    onFollow: (id: string, name?: string) => void;
}

export const ConnectJustLikeYou: React.FC<Props> = ({ users, pendingIds = [], connectedIds = [], onChat, onFollow }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
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

    const scroll = (direction: 'left' | 'right') => {
        if (scrollContainerRef.current) {
            const { scrollLeft, clientWidth } = scrollContainerRef.current;
            const step = clientWidth > 640 ? 540 : 270;
            scrollContainerRef.current.scrollTo({
                left: direction === 'left' ? scrollLeft - step : scrollLeft + step,
                behavior: 'smooth'
            });
        }
    };

    if (!users || users.length === 0) return null;

    return (
        <div className="w-full py-10 px-4 sm:px-6">
            <div className="max-w-7xl mx-auto">
                <div className="relative mb-8 text-center">
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                        <span className="text-km-primary">Connect</span> Just Like You
                    </h2>
                </div>
                
                {/* Infinite Marquee Track with Pause on Hover/Touch */}
                <div className="relative overflow-hidden">
                    <div 
                        ref={scrollContainerRef}
                        className="animate-km-marquee flex gap-5 sm:gap-6 hover:[animation-play-state:paused] active:[animation-play-state:paused] touch-pan-x pb-4"
                    >
                        {[...users, ...users].map((user, idx) => {
                            const targetUserId = user.id || user._id || '';
                            const isSelf = Boolean(currentUserId && targetUserId === currentUserId);
                            const isPending = pendingIds.includes(targetUserId);
                            const isConnected = connectedIds.includes(targetUserId);

                            return (
                                <div key={`${targetUserId}-${idx}`} className="shrink-0">
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

                {/* Custom Interactive Scrollbar */}
                <InteractiveScrollbar scrollRef={scrollContainerRef} className="max-w-4xl mx-auto mt-4 px-4 sm:px-0" />
            </div>
        </div>
    );
};

export default ConnectJustLikeYou;
