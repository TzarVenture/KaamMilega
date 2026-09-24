import React, { useRef, useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ProfileConnectionCard, { ProfileCardUser } from '@/components/network/ProfileConnectionCard';
import InteractiveScrollbar from '@/components/ui/InteractiveScrollbar';

interface Props {
    users: ProfileCardUser[];
    pendingIds?: string[];
    onChat: (id: string) => void;
    onFollow: (id: string, name?: string) => void;
}

export const ConnectJustLikeYou: React.FC<Props> = ({ users, pendingIds = [], onChat, onFollow }) => {
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
                    <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                        <span className="text-km-primary">Connect</span> Just Like You
                    </h2>

                    {/* Smooth Prev / Next Paging Buttons */}
                    <div className="hidden sm:flex items-center gap-2 absolute right-0 top-1/2 -translate-y-1/2">
                        <button
                            onClick={() => scroll('left')}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-km-primary hover:border-km-primary flex items-center justify-center transition-all shadow-2xs cursor-pointer active:scale-95"
                            aria-label="Previous profiles"
                        >
                            <ChevronLeft size={18} />
                        </button>
                        <button
                            onClick={() => scroll('right')}
                            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 text-slate-700 hover:text-km-primary hover:border-km-primary flex items-center justify-center transition-all shadow-2xs cursor-pointer active:scale-95"
                            aria-label="Next profiles"
                        >
                            <ChevronRight size={18} />
                        </button>
                    </div>
                </div>
                
                <div 
                    ref={scrollContainerRef}
                    className="flex gap-5 sm:gap-6 overflow-x-auto pb-4 scrollbar-hide"
                >
                    {users.map((user, idx) => {
                        const targetUserId = user.id || user._id || '';
                        const isSelf = Boolean(currentUserId && targetUserId === currentUserId);
                        const isPending = pendingIds.includes(targetUserId);

                        return (
                            <ProfileConnectionCard
                                key={targetUserId || idx}
                                user={user}
                                variant="slider"
                                isSelf={isSelf}
                                isPending={isPending}
                                entityType="connect"
                                onChat={onChat}
                                onFollow={onFollow}
                            />
                        );
                    })}
                </div>

                {/* Custom Interactive Scrollbar */}
                <InteractiveScrollbar scrollRef={scrollContainerRef} className="max-w-4xl mx-auto mt-4 px-4 sm:px-0" />
            </div>
        </div>
    );
};

export default ConnectJustLikeYou;
