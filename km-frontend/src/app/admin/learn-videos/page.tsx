'use client';

import React, { useState } from 'react';
import { Search, ChevronDown, MoreVertical, PlayCircle, Eye, Trash2, ShieldCheck, Info } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LearnVideoModal from '@/components/modals/admin/LearnVideoModal';

const MOCK_VIDEOS = [
    {
        id: '1',
        title: 'Developing A Learning Mindset',
        duration: '30 Min',
        author: 'Expert Name',
        date: 'Feb 27, 2025',
        viewers: '10K Viewers',
        isRecommended: true,
        thumbnail: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=400&auto=format&fit=crop'
    },
    {
        id: '2',
        title: 'Effective Communication Skills',
        duration: '45 Min',
        author: 'Skills Trainer',
        date: 'Feb 25, 2025',
        viewers: '8K Viewers',
        isRecommended: true,
        thumbnail: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=400&auto=format&fit=crop'
    },
    {
        id: '3',
        title: 'Mastering Technical Interviews',
        duration: '60 Min',
        author: 'Interview Pro',
        date: 'Feb 22, 2025',
        viewers: '15K Viewers',
        isRecommended: true,
        thumbnail: 'https://images.unsplash.com/photo-1521737711867-e3b97375f902?q=80&w=400&auto=format&fit=crop'
    },
    {
        id: '4',
        title: 'Introduction to Modern UI Design',
        duration: '25 Min',
        author: 'Creative Director',
        date: 'Feb 20, 2025',
        viewers: '12K Viewers',
        isRecommended: false,
        thumbnail: 'https://images.unsplash.com/photo-1558655146-d09347e92766?q=80&w=400&auto=format&fit=crop'
    }
];

export default function LearnVideosPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeMenu, setActiveMenu] = useState<string | null>(null);

    const handleAddVideo = (data: any) => {
        console.log('Adding video:', data);
    };

    return (
        <div className="space-y-8">
            <LearnVideoModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleAddVideo}
            />

            {/* Header / Search Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-[32px] border border-purple-50 shadow-sm">
                <div className="flex-1 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 whitespace-nowrap">
                        Sort by: <span className="flex items-center gap-1 text-slate-500 cursor-pointer hover:text-purple-600 transition-colors">Recently added <ChevronDown size={14} /></span>
                    </div>
                    <div className="relative flex-1 w-full max-w-xl group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Find video..."
                            className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-transparent rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-500/5 transition-all outline-none"
                        />
                    </div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-8 py-2.5 bg-purple-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-purple-600/20 active:scale-95"
                >
                    Add Video
                </motion.button>
            </div>

            {/* Videos List */}
            <div className="space-y-4">
                {MOCK_VIDEOS.map((video) => (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={video.id}
                        className="bg-white p-4 rounded-[32px] border border-purple-50 shadow-sm hover:shadow-md transition-all group relative"
                    >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                            {/* Thumbnail Container */}
                            <div className="relative w-full sm:w-48 h-44 sm:h-28 shrink-0 rounded-2xl overflow-hidden bg-slate-100 group-hover:scale-[1.02] transition-transform duration-300 shadow-sm">
                                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" />
                                {video.isRecommended && (
                                    <div className="absolute top-2 left-2 px-2 py-0.5 bg-purple-500/90 backdrop-blur-sm text-[10px] font-black text-white uppercase tracking-widest rounded-md">
                                        Recommended
                                    </div>
                                )}
                                <div className="absolute inset-0 flex items-center justify-center bg-black/10 group-hover:bg-black/0 transition-colors">
                                    <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white ring-1 ring-white/50 group-hover:scale-110 transition-transform">
                                        <PlayCircle size={24} fill="currentColor" />
                                    </div>
                                </div>
                            </div>

                            {/* Info Container */}
                            <div className="flex-1 space-y-2">
                                <h3 className="text-lg sm:text-xl font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                                    {video.title}
                                </h3>
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-400 font-medium italic">
                                    <div className="flex items-center gap-1.5">
                                        Video Duration: <span className="text-slate-600 font-bold not-italic">{video.duration}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        By <span className="text-purple-600 font-bold not-italic">{video.author}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        Released <span className="text-slate-600 font-bold not-italic">{video.date}</span>
                                    </div>
                                </div>
                                <div className="text-sm font-bold text-slate-400">
                                    {video.viewers}
                                </div>
                            </div>

                            {/* Menu Button */}
                            <div className="relative">
                                <button
                                    onClick={() => setActiveMenu(activeMenu === video.id ? null : video.id)}
                                    className="p-3 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-2xl transition-all"
                                >
                                    <MoreVertical size={20} />
                                </button>

                                {/* Dropdown Menu */}
                                <AnimatePresence>
                                    {activeMenu === video.id && (
                                        <>
                                            <div className="fixed inset-0 z-10" onClick={() => setActiveMenu(null)}></div>
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                                exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                className="absolute right-0 top-12 w-56 bg-white rounded-2xl shadow-2xl border border-purple-50 z-20 overflow-hidden"
                                            >
                                                <div className="p-2 space-y-1 text-sm font-bold text-slate-600">
                                                    <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-purple-50 rounded-xl hover:text-purple-700 transition-all text-left">
                                                        <Eye size={16} /> Check Profile Posted
                                                    </button>
                                                    <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-amber-50 rounded-xl hover:text-amber-700 transition-all text-left">
                                                        <ShieldCheck size={16} /> Remove Recommended
                                                    </button>
                                                    <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-red-50 rounded-xl hover:text-red-700 transition-all text-left">
                                                        <Trash2 size={16} /> Delete Video
                                                    </button>
                                                    <button className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-blue-50 rounded-xl hover:text-blue-700 transition-all text-left border-t border-slate-50 mt-1">
                                                        <Info size={16} /> About This Video
                                                    </button>
                                                </div>
                                            </motion.div>
                                        </>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
