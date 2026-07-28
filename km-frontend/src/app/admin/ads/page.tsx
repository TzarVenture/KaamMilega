'use client';

import React, { useState } from 'react';
import { Search, MoreVertical, PlayCircle, Building2, ChevronDown, Rocket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AddAdsModal from '@/components/modals/admin/AddAdsModal';
import Image from 'next/image';
import { div } from 'framer-motion/client';

const MOCK_ADS = [
    {
        id: '1',
        title: 'Our Diversity And Inclusion At Workplace',
        company: 'Company Name',
        type: 'Video Ad',
        thumbnail: 'https://images.unsplash.com/photo-1522071823991-b99c22302d9b?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: '2',
        title: 'Our Diversity And Inclusion At Workplace',
        company: 'Company Name',
        type: 'Banner Ad',
        thumbnail: 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: '3',
        title: 'Our Diversity And Inclusion At Workplace',
        company: 'Company Name',
        type: 'Sidebar Ad',
        thumbnail: 'https://images.unsplash.com/photo-1600880212340-02d9565539d0?q=80&w=400&auto=format&fit=crop',
    }
];

export default function AdsPublishedPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [view, setView] = useState<'list' | 'coming-soon'>('list');

    const handleAddAd = (data: any) => {
        console.log('Adding advertisement:', data);
    };

    if (view === 'coming-soon') {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] text-center space-y-8 p-8">
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="relative"
                >
                    {/* Rocket Illustration Background */}
                    <div className="absolute inset-0 bg-purple-100 rounded-full blur-3xl opacity-20 scale-150"></div>
                    <div className="relative w-64 h-64 mx-auto bg-gradient-to-br from-purple-600 to-indigo-900 rounded-[64px] flex items-center justify-center shadow-2xl rotate-12">
                        <Rocket size={120} className="text-white -rotate-12 animate-bounce" />
                    </div>
                </motion.div>

                <div className="space-y-3">
                    <h1 className="text-5xl font-black text-slate-900 tracking-tight">Coming Soon</h1>
                    <p className="text-xl font-bold text-slate-400 italic">We Are Working On It.</p>
                </div>

                <div className="pt-8">
                    <button
                        onClick={() => setView('list')}
                        className="px-10 py-3 bg-purple-600 text-white rounded-full font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-xl shadow-purple-600/20 active:scale-95"
                    >
                        Back To Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <AddAdsModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleAddAd}
            />

            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex-1 flex items-center gap-6">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-800 whitespace-nowrap">
                        Sort by: <span className="flex items-center gap-1 text-slate-500 cursor-pointer hover:text-purple-600 transition-colors">Recently added <ChevronDown size={14} /></span>
                    </div>
                    <div className="relative flex-1 max-w-xl group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Find Ad..."
                            className="w-full pl-11 pr-4 py-2.5 bg-white border border-purple-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 transition-all outline-none shadow-sm"
                        />
                    </div>
                </div>

                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-8 py-2.5 bg-purple-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-purple-600/20 active:scale-95 uppercase tracking-wider"
                >
                    Add
                </motion.button>
            </div>

            {/* Ads List Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[32px] border border-purple-50 shadow-xl shadow-purple-900/5 overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-0">
                        <tbody className="divide-y divide-slate-50">
                            {MOCK_ADS.map((ad, i) => (
                                <tr key={ad.id} className="hover:bg-purple-50/20 transition-all group">
                                    <td className="px-8 py-6 w-32">
                                        <div className="relative w-20 h-14 bg-slate-100 rounded-xl overflow-hidden shadow-sm group-hover:scale-105 transition-transform">
                                            <img src={ad.thumbnail} alt={ad.title} className="w-full h-full object-cover" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/10">
                                                <PlayCircle size={24} className="text-white opacity-80" />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6">
                                        <h4 className="text-lg font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                                            {ad.title}
                                        </h4>
                                    </td>
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4 justify-end">
                                            <div className="text-right">
                                                <p className="text-sm font-black text-slate-700">{ad.company}</p>
                                                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{ad.type}</p>
                                            </div>
                                            <div className="w-10 h-10 bg-slate-900 rounded-full flex items-center justify-center text-white ring-2 ring-purple-100 group-hover:ring-purple-200 transition-all">
                                                <span className="text-xs font-bold italic rotate-45">▲▲</span>
                                            </div>
                                            <button className="p-2.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all ml-4">
                                                <MoreVertical size={20} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </motion.div>

            {/* Temporary view toggle for demonstration */}
            <div className="fixed bottom-8 right-8 flex gap-2">
                <button
                    onClick={() => setView(view === 'list' ? 'coming-soon' : 'list')}
                    className="px-4 py-2 bg-slate-900 text-white text-[10px] font-bold rounded-lg opacity-40 hover:opacity-100 transition-opacity uppercase tracking-widest"
                >
                    Toggle {view === 'list' ? 'Coming Soon' : 'List View'}
                </button>
            </div>
        </div>
    );
}
