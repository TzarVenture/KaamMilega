import React, { useRef, useState, useEffect } from 'react';
import { MessageSquare, MapPin } from 'lucide-react';

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
    onChat: (id: string) => void;
    onFollow: (id: string) => void;
}

export const ConnectJustLikeYou: React.FC<Props> = ({ users, onChat, onFollow }) => {
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
        <div className="w-full py-12 px-6 overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <h2 className="text-3xl font-extrabold text-center mb-10">
                    <span className="text-purple-600">Connect</span> Just Like You
                </h2>
                
                <div 
                    ref={scrollContainerRef}
                    onScroll={handleScroll}
                    className="flex gap-6 overflow-x-auto pb-8 snap-x snap-mandatory scrollbar-hide"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {users.map((user, idx) => (
                        <div 
                            key={user.id || user._id || idx}
                            className="w-[260px] bg-white rounded-3xl p-6 flex flex-col items-center shrink-0 snap-center"
                            style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}
                        >
                            <div className="relative mb-5">
                                <div className="w-[72px] h-[72px] rounded-full bg-[#290d4f] flex items-center justify-center overflow-hidden">
                                    {user.profile_image ? (
                                        <img src={user.profile_image} alt={user.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-0 h-0 border-l-12 border-l-white border-t-8 border-t-transparent border-b-8 border-b-transparent transform -rotate-45 ml-1"></div>
                                    )}
                                </div>
                                <div className="absolute bottom-1 right-0 w-4 h-4 rounded-full bg-[#10B981] border-2 border-white"></div>
                            </div>
                            
                            <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1">
                                {user.name || 'Person Name'}
                            </h3>
                            <p className="text-[11px] text-gray-400 italic mb-2 font-medium">
                                {user.headline || 'Person Designation'}
                            </p>
                            
                            <div className="flex items-center gap-1 text-gray-400 text-[11px] mb-3">
                                <MapPin size={10} />
                                <span>{user.city || 'Location'}</span>
                            </div>
                            
                            <p className="text-[11px] text-gray-400 mb-6 font-medium">
                                {user.mutual_connects || 10} Mutual Connects
                            </p>
                            
                            <div className="w-full flex gap-3 mt-auto flex-col">
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
                                    
                                    return !isSelf && (
                                        <>
                                            <button 
                                                onClick={() => onChat(user.id || user._id || '')}
                                                className="w-full py-2 rounded-full border border-purple-100 text-[#A855F7] text-sm font-semibold flex items-center justify-center gap-2 hover:bg-purple-50 transition-colors"
                                            >
                                                <MessageSquare size={14} />
                                                Chat
                                            </button>
                                            <button 
                                                onClick={() => onFollow(user.id || user._id || '')}
                                                className="w-full py-2.5 rounded-full bg-[#A855F7] text-white text-sm font-bold hover:bg-purple-600 transition-colors shadow-sm shadow-[#A855F7]/30"
                                            >
                                                Follow
                                            </button>
                                        </>
                                    );
                                })()}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Custom Scrollbar Simulator */}
                <div className="max-w-4xl mx-auto mt-2">
                    <div className="h-1.5 bg-gray-200 rounded-full w-full overflow-hidden relative">
                        <div 
                            className="h-full bg-gray-400 rounded-full absolute top-0 left-0 transition-all duration-150"
                            style={{ 
                                width: '25%', 
                                transform: `translateX(${scrollProgress * 3}%)` // simplistic visual translation
                            }} 
                        />
                    </div>
                </div>

                {/* Pagination Dots */}
                <div className="flex gap-1.5 justify-center mt-6">
                    <div className="w-6 h-1.5 rounded-full bg-[#5B21B6]"></div>
                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300"></div>
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
