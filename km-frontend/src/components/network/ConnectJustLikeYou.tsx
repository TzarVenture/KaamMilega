import React, { useRef, useState } from 'react';
import Link from 'next/link';
import { MessageSquare, MapPin, CheckCircle2, ChevronLeft, ChevronRight } from 'lucide-react';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import CustomImage from '@/components/ui/CustomImage';
import InteractiveScrollbar from '@/components/ui/InteractiveScrollbar';
import { ImpressionWrapper } from '@/lib/telemetry';

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

const UserAvatar = ({ src, name }: { src?: string; name?: string }) => {
    const [failed, setFailed] = useState(false);
    if (!src || failed) {
        return <DefaultAvatar />;
    }
    return (
        <CustomImage
            src={src}
            alt={name || 'Candidate'}
            className="w-full h-full object-cover"
            onError={() => setFailed(true)}
        />
    );
};

export const ConnectJustLikeYou: React.FC<Props> = ({ users, pendingIds = [], onChat, onFollow }) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

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
                        const targetUserId = user.id || user._id;
                        return (
                            <ImpressionWrapper
                                key={targetUserId || idx}
                                authorId={targetUserId}
                                entityId={`connect:${targetUserId}`}
                                className="shrink-0"
                            >
                                <div 
                                    className="w-60 sm:w-65 bg-white rounded-3xl p-6 flex flex-col items-center shrink-0 border border-slate-200/90 shadow-xs hover:shadow-md transition-all h-full"
                                >
                            <Link 
                                href={targetUserId ? `/profile/${targetUserId}` : '#'}
                                className="w-full flex flex-col items-center group cursor-pointer"
                            >
                                <div className="relative mb-4">
                                    <div className="w-18 h-18 rounded-full bg-slate-100 border-2 border-slate-200 group-hover:border-km-primary flex items-center justify-center overflow-hidden shadow-2xs transition-colors">
                                        <UserAvatar src={user.profile_image} name={user.name} />
                                    </div>
                                    <div className="absolute bottom-0 right-0.5 w-4 h-4 rounded-full bg-emerald-500 border-2 border-white"></div>
                                </div>
                                
                                <h3 className="text-sm font-bold text-slate-900 group-hover:text-km-primary transition-colors leading-tight mb-0.5 text-center">
                                    {user.name?.replace(/\s*\.+$/, '') || 'Candidate'}
                                </h3>
                                <p className="text-[11px] text-slate-500 mb-2 font-medium text-center line-clamp-1">
                                    {user.headline || (user as { job_categories?: string[] }).job_categories?.[0] || 'Verified Member'}
                                </p>
                                
                                <div className="flex items-center gap-1 text-slate-400 text-[10px] mb-2 font-semibold">
                                    <MapPin size={10} className="text-km-primary" />
                                    <span>{user.city || 'India'}</span>
                                </div>
                                
                                <p className="text-[10px] text-slate-400 mb-4 font-bold uppercase tracking-wider">
                                    {user.mutual_connects || 5} Mutual Connects
                                </p>
                            </Link>
                            
                            <div className="w-full flex gap-2 mt-auto flex-col">
                                {(() => {
                                    const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
                                    let currentUserId = '';
                                    if (storedUser) {
                                        try {
                                            const parsed = JSON.parse(storedUser);
                                            currentUserId = parsed.id || parsed._id;
                                        } catch {
                                            // ignore parse error
                                        }
                                    }
                                    const isSelf = (user.id === currentUserId || user._id === currentUserId);
                                    const userId = user.id || user._id || '';
                                    const isPending = pendingIds.includes(userId);
                                    
                                    return !isSelf && (
                                        <>
                                             <button 
                                                onClick={() => onChat(userId)}
                                                className="w-full py-2 rounded-xl border border-km-primary text-km-primary text-xs font-bold flex items-center justify-center gap-2 hover:bg-blue-50 transition-colors cursor-pointer"
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
                                                    className="w-full py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer"
                                                >
                                                    Connect
                                                </button>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    </ImpressionWrapper>
                );
            })}
                </div>

                {/* Custom Interactive Scrollbar */}
                <InteractiveScrollbar scrollRef={scrollContainerRef} className="max-w-4xl mx-auto mt-4 px-4 sm:px-0" />
            </div>
        </div>
    );
};
