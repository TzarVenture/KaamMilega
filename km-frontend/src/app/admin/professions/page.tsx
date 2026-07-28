'use client';

import React, { useState } from 'react';
import {
    Search,
    Plus,
    MoreVertical,
    ChevronLeft,
    MapPin,
    DollarSign,
    Briefcase,
    ArrowRight,
    AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProfessionModal from '@/components/modals/admin/ProfessionModal';

const CATEGORIES = [
    { id: '1', name: 'Delivery', icon: '📦', jobsCount: 42 },
    { id: '2', name: 'Driver', icon: '🚗', jobsCount: 18 },
    { id: '3', name: 'Warehouse / Logistics', icon: '🏗️', jobsCount: 31 },
    { id: '4', name: 'Manufacturer', icon: '🏭', jobsCount: 12 },
    { id: '5', name: 'Housekeeping / Peon', icon: '🧹', jobsCount: 25 },
    { id: '6', name: 'Security Guard', icon: '🛡️', jobsCount: 15 },
    { id: '7', name: 'Painter', icon: '🎨', jobsCount: 8 },
    { id: '8', name: 'Labour / Helper', icon: '👷', jobsCount: 50 },
];

const MOCK_JOBS = [
    {
        id: '1',
        title: 'Accountant Cum Office Assistant',
        owner: 'Sreerama Auto Industries',
        location: 'Rajajinagar Stage, Bangalore',
        salary: '₹12,000 - ₹15,000',
        active: '24 hours',
        badge: 'New',
        type: 'Full Time',
        vacancies: '02 Vacancies',
        verified: true,
        urgency: 'Immediate',
        applyCount: 15
    },
    {
        id: '2',
        title: 'Senior Delivery Executive',
        owner: 'FastLogistics Hub',
        location: 'Indiranagar, Bangalore',
        salary: '₹18,000 - ₹22,000',
        active: '1 hour',
        type: 'Part Time',
        vacancies: '05 Vacancies',
        verified: true,
        urgency: 'High',
        applyCount: 8,
        alert: 'Fraud Alert: Suspicious Activity Detected'
    }
];

export default function ProfessionsPage() {
    const [view, setView] = useState<'categories' | 'jobs'>('categories');
    const [selectedCategory, setSelectedCategory] = useState<any>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const handleCategoryClick = (category: any) => {
        setSelectedCategory(category);
        setView('jobs');
    };

    const handleAddProfession = (data: any) => {
        console.log('Adding profession:', data);
    };

    return (
        <div className="space-y-8">
            <ProfessionModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSave={handleAddProfession}
            />

            {/* Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                    {view === 'jobs' && (
                        <button
                            onClick={() => setView('categories')}
                            className="p-2.5 bg-white border border-purple-100 text-purple-600 rounded-2xl shadow-sm hover:bg-purple-50 transition-all"
                        >
                            <ChevronLeft size={24} />
                        </button>
                    )}
                    <div>
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-900 to-indigo-700 bg-clip-text text-transparent">
                            {view === 'categories' ? 'Job Category' : selectedCategory?.name}
                        </h1>
                        <p className="text-slate-500 font-medium">
                            {view === 'categories'
                                ? 'Define and organize industry professions'
                                : `Managing ${selectedCategory?.jobsCount} active job roles`}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder={view === 'categories' ? "Find profession..." : "Find jobs..."}
                            className="w-full sm:w-80 pl-11 pr-4 py-2.5 bg-white border border-purple-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/5 transition-all shadow-sm"
                        />
                    </div>
                    {view === 'categories' && (
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setIsModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-2xl text-sm font-bold shadow-lg shadow-purple-200"
                        >
                            <Plus size={18} />
                            <span>Add Profession</span>
                        </motion.button>
                    )}
                </div>
            </div>

            <main>
                <AnimatePresence mode="wait">
                    {view === 'categories' ? (
                        <motion.div
                            key="categories-grid"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-white rounded-[32px] border border-purple-50 shadow-xl shadow-purple-900/5 overflow-hidden"
                        >
                            <div className="divide-y divide-purple-50/50">
                                {CATEGORIES.map((category) => (
                                    <div
                                        key={category.id}
                                        onClick={() => handleCategoryClick(category)}
                                        className="p-6 hover:bg-purple-50/30 transition-all group flex items-center justify-between cursor-pointer"
                                    >
                                        <div className="flex items-center gap-6">
                                            <div className="w-12 h-12 bg-gradient-to-tr from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center text-2xl shadow-sm border border-white">
                                                <span>{category.icon}</span>
                                            </div>
                                            <h3 className="text-lg font-bold text-slate-800 group-hover:text-purple-700 transition-colors">
                                                {category.name}
                                            </h3>
                                        </div>
                                        <button className="p-2.5 text-slate-400 hover:text-purple-600 rounded-xl transition-all">
                                            <MoreVertical size={20} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="jobs-list"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6"
                        >
                            {MOCK_JOBS.map((job) => (
                                <div key={job.id} className="bg-white rounded-[32px] p-8 border border-purple-100 shadow-xl shadow-purple-900/5 hover:shadow-purple-900/10 transition-all relative">
                                    <div className="flex flex-col lg:flex-row justify-between gap-6">
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <div className="flex items-center gap-3">
                                                    <h3 className="text-2xl font-black text-slate-900">{job.title}</h3>
                                                    {job.badge && (
                                                        <span className="px-3 py-1 bg-purple-100 text-purple-600 text-[10px] font-black uppercase tracking-widest rounded-full">{job.badge}</span>
                                                    )}
                                                </div>
                                                <p className="text-slate-400 font-bold text-sm italic">{job.owner}</p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                                                        <DollarSign size={12} strokeWidth={3} />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-600">{job.salary}</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className="w-5 h-5 bg-purple-100 rounded-full flex items-center justify-center text-purple-600">
                                                        <MapPin size={12} strokeWidth={3} />
                                                    </div>
                                                    <span className="text-sm font-bold text-slate-600">{job.location}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-3 pt-2">
                                                <span className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-black text-slate-500 uppercase tracking-tight">{job.type}</span>
                                                <span className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-black text-slate-500 uppercase tracking-tight">{job.vacancies}</span>
                                                <span className="px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-[11px] font-black text-blue-600 uppercase tracking-tight flex items-center gap-1.5">
                                                    <AlertCircle size={14} /> KM Verified
                                                </span>
                                                <span className="px-4 py-1.5 bg-rose-50 border border-rose-100 rounded-full text-[11px] font-black text-rose-500 uppercase tracking-tight">20 Application</span>
                                                <span className="px-4 py-1.5 bg-slate-50 border border-slate-100 rounded-full text-[11px] font-black text-slate-500 uppercase tracking-tight italic">Posted {job.active} ago</span>
                                            </div>

                                            {job.alert && (
                                                <div className="flex items-center gap-2 px-4 py-3 bg-red-50/50 border border-red-100 text-red-600 rounded-2xl text-[12px] font-bold">
                                                    <AlertCircle size={16} />
                                                    <span>{job.alert}</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pt-4">
                                            <button className="self-end p-3 text-slate-400 hover:text-purple-600 transition-colors">
                                                <MoreVertical size={24} />
                                            </button>
                                            <div className="flex flex-wrap gap-3">
                                                <button className="px-6 py-2.5 bg-white border border-purple-200 text-purple-600 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-purple-50 transition-all">Remove Job</button>
                                                <button className="px-6 py-2.5 bg-purple-600 text-white rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-lg shadow-purple-600/20">View Candidate</button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
