import React, { useRef, useState, useEffect } from 'react';
import { MessageSquare, MapPin, CheckCircle2 } from 'lucide-react';
import DefaultAvatar from '@/components/ui/DefaultAvatar';

export interface RecommendedUser {
    id?: string;
    _id?: string;
    name?: string;
    roles?: string[];
    headline?: string;
    profile_image?: string;
    city?: string;
    mutual_connects?: number;
}

interface Props {
    users: RecommendedUser[];
    pendingIds?: string[];
    onChat: (id: string) => void;
    onFollow: (id: string, name?: string) => void;
}

export const ConnectJustLikeYou: React.FC<Props> = ({ users, pendingIds = [], onChat, onFollow }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [scrollProgress, setScrollProgress] = useState(0);

    const handleScroll = () => {
        if (!scrollContainerRef.current) return;
        const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
        const maxScroll = scrollWidth - clientWidth;
        if (maxScroll <= 0) {
            setScrollProgress(0);
        } else {
            setScrollProgress((scrollLeft / maxScroll) * 100);
        }
    };

    useEffect(() => {
        handleScroll();
        window.addEventListener('resize', handleScroll);
        return () => window.removeEventListener('resize', handleScroll);
    }, [users]);

    if (!users || users.length === 0) return null;

    return (
        <div className="w-full py-10 px-6 overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <h2 className="text-2xl sm:text-3xl font-black text-center text-slate-900 mb-8 tracking-tight">
                    <span className="text-km-primary">Connect</span> Just Like You
                </h2>
                
                <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex gap-6 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {users.map((user, idx) => (
                        <div 
                            key={user.id || user._id || idx}
                            className="w-65 bg-white rounded-3xl p-6 flex flex-col items-center shrink-0 snap-center border border-slate-200/90 shadow-xs hover:shadow-md transition-all"
                        >
                            <div className="relative mb-4">
                                <div className="w-18 h-18 rounded-full bg-slate-100 border-2 border-slate-200 flex items-center justify-center overflow-hidden shadow-2xs">
                                    {user.profile_image ? (
                                        <img src={user.profile_image} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <DefaultAvatar />
                                    )}
                                </div>
                                <div className="absolute bottom-0 right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></div>
                            </div>
                            
                            <h3 className="text-sm font-bold text-slate-900 leading-tight mb-0.5 text-center">
                                {user.name?.replace(/\s*\.+$/, '') || 'Candidate'}
                            </h3>
                            <p className="text-[11px] text-slate-500 mb-2 font-medium text-center line-clamp-1">
                                {user.headline || (user as any).job_categories?.[0] || 'Verified Member'}
                            </p>
                            
                            <div className="flex items-center gap-1 text-slate-400 text-[10px] mb-2 font-semibold">
                                <MapPin size={10} className="text-km-primary" />
                                <span>{user.city || 'India'}</span>
                            </div>
                            
                            <p className="text-[10px] text-slate-400 mb-4 font-bold uppercase tracking-wider">
                                {user.mutual_connects || 5} Mutual Connects
                            </p>
                            
                            <div className="w-full flex gap-2 mt-auto flex-col">
                                {(() => {
                                    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                                    let currentUserId = '';
                                    if (storedUser) {
                                        try {
                                            const parsed = JSON.parse(storedUser);
                                            currentUserId = parsed.id || parsed._id;
                                        } catch (e) {}
                                    }
                                    const isSelf = (user.id === currentUserId || user._id === currentUserId);
                                    const userId = user.id || user._id || '';
                                    const isPending = pendingIds.includes(userId);
                                    
                                    return !isSelf && (
                                        <>
                                            <button 
                                                onClick={() => onChat(userId)}
                                                className="w-full py-2 rounded-xl border border-km-primary text-km-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors"
                                            >
                                                <MessageSquare size={14} />
                                                Chat
                                            </button>
                                            {isPending ? (
                                                <button 
                                                    disabled
                                                    className="w-full py-2 bg-slate-100 text-slate-500 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1 cursor-default border border-slate-200"
                                                >
                                                    <CheckCircle2 size={13} className="text-emerald-500" />
                                                    Pending
                                                </button>
                                            ) : (
                                                <button 
                                                    onClick={() => onFollow(userId, user.name)}
                                                    className="w-full py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-bold transition-all shadow-xs"
                                                >
                                                    Connect
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Custom Scrollbar Simulator */}
                <div className="max-w-4xl mx-auto mt-2">
                    <div className="h-1.5 bg-slate-200 rounded-full w-full overflow-hidden relative">
                        <div 
                            className="h-full bg-km-primary rounded-full absolute top-0 left-0 transition-all duration-150"
                            style={{ 
                                width: '25%', 
                                transform: `translateX(${scrollProgress * 3}%)`
                            }} 
                        />
                    </div>
                </div>

                {/* Pagination Dots */}
                <div className="flex gap-1.5 justify-center mt-6">
                    <div className="w-6 h-1.5 rounded-full bg-km-primary"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                </div>
            </div>
            
            <style>{`
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
};
