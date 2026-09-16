'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Search,
    Plus,
    Trash2,
    Edit2,
    GraduationCap,
    Sparkles,
    Loader2,
    RefreshCw,
    FolderTree,
    Layers,
    CheckCircle2,
    AlertCircle,
    Database,
    Tag
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '@/lib/axios';
import ProfessionModal from '@/components/modals/admin/ProfessionModal';

interface Skill {
    id: string;
    name: string;
    category?: string;
    created_at?: string;
    updated_at?: string;
}

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    'Logistics & Delivery': { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    'Skilled Trades & Construction': { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    'Facility & Security': { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    'Office & Administration': { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    'Tech & Creative': { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
    'Hospitality & Services': { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

export default function ProfessionsPage() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSeeding, setIsSeeding] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Fetch skills and categories from live backend
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [skillsRes, catsRes] = await Promise.all([
                api.get('/skills'),
                api.get('/skills/categories')
            ]);

            const skillsData = Array.isArray(skillsRes) ? skillsRes : ((skillsRes as any)?.data || []);
            const catsData = Array.isArray(catsRes) ? catsRes : ((catsRes as any)?.data || []);

            setSkills(skillsData);
            setCategories(catsData);
        } catch (error) {
            console.error('Failed to fetch skill catalog:', error);
            setStatusBanner({
                type: 'error',
                message: 'Failed to load master skill catalog from server.'
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter skills by category & search term
    const filteredSkills = useMemo(() => {
        return skills.filter((item) => {
            const matchesCategory =
                selectedCategory === 'All' ||
                (item.category || 'General').toLowerCase() === selectedCategory.toLowerCase();

            const matchesSearch =
                !searchTerm.trim() ||
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());

            return matchesCategory && matchesSearch;
        });
    }, [skills, selectedCategory, searchTerm]);

    // Handle Create or Update
    const handleSaveProfession = async (data: { id?: string; name: string; category: string }) => {
        try {
            if (data.id) {
                // Update
                const res: any = await api.patch(`/skills/${data.id}`, {
                    name: data.name,
                    category: data.category
                });
                setSkills((prev) =>
                    prev.map((s) => (s.id === data.id ? { ...s, name: data.name, category: data.category } : s))
                );
                setStatusBanner({
                    type: 'success',
                    message: `Profession "${data.name}" updated successfully.`
                });
            } else {
                // Create
                const res: any = await api.post('/skills', {
                    name: data.name,
                    category: data.category
                });
                const newSkill = res?.data || res;
                setSkills((prev) => [newSkill, ...prev]);
                if (data.category && !categories.includes(data.category)) {
                    setCategories((prev) => [...prev, data.category]);
                }
                setStatusBanner({
                    type: 'success',
                    message: `Profession "${data.name}" added to master catalog.`
                });
            }
            setIsModalOpen(false);
            setEditingSkill(null);
        } catch (error: any) {
            console.error('Save failed:', error);
            const msg = error?.response?.data?.error || error?.message || 'Failed to save profession';
            setStatusBanner({ type: 'error', message: msg });
            throw error;
        }
    };

    // Handle Delete
    const handleDeleteSkill = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to remove "${name}" from the master catalog?`)) {
            return;
        }

        setDeletingId(id);
        try {
            await api.delete(`/skills/${id}`);
            setSkills((prev) => prev.filter((s) => s.id !== id));
            setStatusBanner({
                type: 'success',
                message: `Profession "${name}" deleted.`
            });
        } catch (error: any) {
            console.error('Delete failed:', error);
            setStatusBanner({
                type: 'error',
                message: error?.response?.data?.error || 'Failed to delete profession.'
            });
        } finally {
            setDeletingId(null);
        }
    };

    // Handle Seed default catalog
    const handleSeedCatalog = async () => {
        setIsSeeding(true);
        try {
            const res: any = await api.post('/skills/seed');
            setStatusBanner({
                type: 'success',
                message: res?.message || 'Default profession catalog seeded successfully!'
            });
            await fetchData();
        } catch (error: any) {
            console.error('Seed failed:', error);
            setStatusBanner({
                type: 'error',
                message: error?.response?.data?.error || 'Failed to seed catalog.'
            });
        } finally {
            setIsSeeding(false);
        }
    };

    const openCreateModal = () => {
        setEditingSkill(null);
        setIsModalOpen(true);
    };

    const openEditModal = (skill: Skill) => {
        setEditingSkill(skill);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-8 max-w-7xl mx-auto pb-12">
            <ProfessionModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingSkill(null);
                }}
                onSave={handleSaveProfession}
                categories={categories}
                initialData={editingSkill ? { id: editingSkill.id, name: editingSkill.name, category: editingSkill.category } : undefined}
            />

            {/* Notification Banner */}
            {statusBanner && (
                <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`flex items-center justify-between gap-3 p-4 rounded-2xl border text-sm font-semibold ${
                        statusBanner.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {statusBanner.type === 'success' ? (
                            <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle size={18} className="text-rose-600 shrink-0" />
                        )}
                        <span>{statusBanner.message}</span>
                    </div>
                    <button
                        onClick={() => setStatusBanner(null)}
                        className="text-xs font-bold hover:underline opacity-80"
                    >
                        Dismiss
                    </button>
                </motion.div>
            )}

            {/* Page Header Area */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white p-6 sm:p-8 rounded-[28px] border border-purple-100/60 shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-purple-100 rounded-2xl flex items-center justify-center text-purple-700">
                            <GraduationCap size={26} />
                        </div>
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-r from-purple-950 via-purple-900 to-indigo-900 bg-clip-text text-transparent">
                                Master Skill & Profession Catalog
                            </h1>
                            <p className="text-slate-500 text-xs sm:text-sm font-medium">
                                Manage standard industry professions, gig trade roles, and candidate skill tags across the platform
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        onClick={handleSeedCatalog}
                        disabled={isSeeding}
                        className="flex items-center gap-2 px-5 py-2.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-2xl text-xs font-bold transition-all disabled:opacity-50"
                        title="Seed platform standard catalog"
                    >
                        {isSeeding ? <Loader2 size={15} className="animate-spin" /> : <Database size={15} />}
                        <span>Seed Catalog</span>
                    </button>

                    <button
                        onClick={fetchData}
                        disabled={isLoading}
                        className="p-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-2xl transition-all"
                        title="Refresh list"
                    >
                        <RefreshCw size={18} className={isLoading ? 'animate-spin' : ''} />
                    </button>

                    <button
                        onClick={openCreateModal}
                        className="flex items-center gap-2 px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95"
                    >
                        <Plus size={16} />
                        <span>Add Profession</span>
                    </button>
                </div>
            </div>

            {/* Metric Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-[24px] border border-purple-100/60 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-100 flex items-center justify-center text-purple-700 shrink-0">
                        <Tag size={22} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Master Skills</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{skills.length}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[24px] border border-purple-100/60 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-700 shrink-0">
                        <FolderTree size={22} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Categories</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{categories.length}</p>
                    </div>
                </div>

                <div className="bg-white p-6 rounded-[24px] border border-purple-100/60 shadow-sm flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-700 shrink-0">
                        <Layers size={22} />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Matching Query</p>
                        <p className="text-2xl font-black text-slate-900 mt-0.5">{filteredSkills.length}</p>
                    </div>
                </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white p-6 rounded-[28px] border border-purple-100/60 shadow-sm space-y-5">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                    {/* Search Input */}
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Search by skill or profession..."
                            className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-600/5 transition-all"
                        />
                        {searchTerm && (
                            <button
                                onClick={() => setSearchTerm('')}
                                className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
                            >
                                Clear
                            </button>
                        )}
                    </div>

                    <span className="text-xs font-semibold text-slate-400 self-end md:self-center">
                        Showing {filteredSkills.length} of {skills.length} catalog items
                    </span>
                </div>

                {/* Category Filter Tabs */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2 custom-scrollbar">
                    <button
                        onClick={() => setSelectedCategory('All')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 ${
                            selectedCategory === 'All'
                                ? 'bg-purple-600 text-white shadow-sm'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                    >
                        All Categories ({skills.length})
                    </button>
                    {categories.map((cat) => {
                        const count = skills.filter(
                            (s) => (s.category || 'General').toLowerCase() === cat.toLowerCase()
                        ).length;
                        const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
                        return (
                            <button
                                key={cat}
                                onClick={() => setSelectedCategory(cat)}
                                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-2 ${
                                    isSelected
                                        ? 'bg-purple-600 text-white shadow-sm'
                                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                                }`}
                            >
                                <span>{cat}</span>
                                <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                                        isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                                    }`}
                                >
                                    {count}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Main Catalog View */}
            <main>
                {isLoading ? (
                    <div className="bg-white rounded-[32px] p-20 flex flex-col items-center justify-center gap-4 border border-purple-100/60 shadow-sm">
                        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[11px]">
                            Loading master catalog from database...
                        </p>
                    </div>
                ) : filteredSkills.length === 0 ? (
                    <div className="bg-white rounded-[32px] p-16 text-center border border-dashed border-purple-200 shadow-sm">
                        <div className="w-16 h-16 bg-purple-50 text-purple-600 rounded-3xl flex items-center justify-center text-3xl mx-auto mb-4">
                            🏷️
                        </div>
                        <h3 className="text-lg font-black text-slate-900">No Professions or Skills Found</h3>
                        <p className="text-slate-500 text-xs mt-1 max-w-md mx-auto">
                            {searchTerm || selectedCategory !== 'All'
                                ? 'No skills matched your current search filters. Try adjusting your search query or selecting "All Categories".'
                                : 'The master skill catalog is currently empty. Click "Seed Catalog" to populate baseline industry professions.'}
                        </p>
                        <div className="flex items-center justify-center gap-3 mt-6">
                            {skills.length === 0 ? (
                                <button
                                    onClick={handleSeedCatalog}
                                    disabled={isSeeding}
                                    className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md"
                                >
                                    {isSeeding ? 'Seeding Catalog...' : 'Seed Standard Catalog (35 Skills)'}
                                </button>
                            ) : (
                                <button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setSelectedCategory('All');
                                    }}
                                    className="px-6 py-2.5 bg-purple-50 text-purple-700 font-bold rounded-2xl text-xs hover:bg-purple-100"
                                >
                                    Reset Filters
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-[28px] border border-purple-100/60 shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-slate-100 bg-slate-50/60">
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            Profession / Skill
                                        </th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">
                                            Category
                                        </th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider hidden sm:table-cell">
                                            System ID
                                        </th>
                                        <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredSkills.map((skill) => {
                                        const cat = skill.category || 'General';
                                        const colors = CATEGORY_COLORS[cat] || {
                                            bg: 'bg-slate-100',
                                            text: 'text-slate-700',
                                            border: 'border-slate-200'
                                        };
                                        const isDeleting = deletingId === skill.id;

                                        return (
                                            <tr
                                                key={skill.id}
                                                className="hover:bg-purple-50/20 transition-colors group"
                                            >
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-sm shrink-0 border border-purple-100">
                                                            {skill.name.charAt(0).toUpperCase()}
                                                        </div>
                                                        <span className="font-bold text-slate-900 text-sm group-hover:text-purple-700 transition-colors">
                                                            {skill.name}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-6 py-4">
                                                    <span
                                                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${colors.bg} ${colors.text} ${colors.border}`}
                                                    >
                                                        {cat}
                                                    </span>
                                                </td>

                                                <td className="px-6 py-4 text-xs text-slate-400 font-mono hidden sm:table-cell">
                                                    {skill.id}
                                                </td>

                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => openEditModal(skill)}
                                                            className="p-2 hover:bg-purple-50 text-slate-400 hover:text-purple-600 rounded-xl transition-colors"
                                                            title="Edit profession"
                                                        >
                                                            <Edit2 size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteSkill(skill.id, skill.name)}
                                                            disabled={isDeleting}
                                                            className="p-2 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded-xl transition-colors disabled:opacity-50"
                                                            title="Delete profession"
                                                        >
                                                            {isDeleting ? (
                                                                <Loader2 size={16} className="animate-spin text-rose-600" />
                                                            ) : (
                                                                <Trash2 size={16} />
                                                            )}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
