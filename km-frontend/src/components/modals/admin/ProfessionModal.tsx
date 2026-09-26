'use client';

import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { Info, Loader2, AlertCircle } from 'lucide-react';

interface ProfessionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { id?: string; name: string; category: string }) => Promise<boolean | void>;
    categories?: string[];
    initialData?: { id?: string; name: string; category?: string; icon?: string };
}

const DEFAULT_CATEGORIES = [
    'Logistics & Delivery',
    'Skilled Trades & Construction',
    'Facility & Security',
    'Office & Administration',
    'Tech & Creative',
    'Hospitality & Services',
];

const ProfessionModal = ({
    isOpen,
    onClose,
    onSave,
    categories = [],
    initialData
}: ProfessionModalProps) => {
    const [name, setName] = useState('');
    const [category, setCategory] = useState('Logistics & Delivery');
    const [customCategory, setCustomCategory] = useState('');
    const [isCustomCategory, setIsCustomCategory] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const availableCategories = Array.from(
        new Set([...DEFAULT_CATEGORIES, ...categories])
    ).filter(Boolean);

    useEffect(() => {
        if (isOpen) {
            setErrorMessage('');
            if (initialData) {
                setName(initialData.name || '');
                const initialCat = initialData.category || 'Logistics & Delivery';
                if (availableCategories.includes(initialCat)) {
                    setCategory(initialCat);
                    setIsCustomCategory(false);
                    setCustomCategory('');
                } else {
                    setCategory('__custom__');
                    setIsCustomCategory(true);
                    setCustomCategory(initialCat);
                }
            } else {
                setName('');
                setCategory(availableCategories[0] || 'Logistics & Delivery');
                setIsCustomCategory(false);
                setCustomCategory('');
            }
        }
    }, [isOpen, initialData]);

    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        if (val === '__custom__') {
            setIsCustomCategory(true);
            setCategory('__custom__');
        } else {
            setIsCustomCategory(false);
            setCategory(val);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorMessage('');

        const finalName = name.trim();
        const finalCategory = (isCustomCategory ? customCategory.trim() : category.trim()) || 'General';

        if (!finalName) {
            setErrorMessage('Profession / Skill name is required');
            return;
        }

        setIsSubmitting(true);
        try {
            const success = await onSave({
                id: initialData?.id,
                name: finalName,
                category: finalCategory
            });
            if (success !== false) {
                onClose();
            }
        } catch (err: any) {
            setErrorMessage(err?.response?.data?.error || err?.message || 'Failed to save profession/skill');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "Edit Profession / Skill" : "Add Master Profession"}
        >
            <form onSubmit={handleSave} className="space-y-6">
                {errorMessage && (
                    <div className="flex items-center gap-2.5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold">
                        <AlertCircle size={18} className="shrink-0 text-red-500" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Name Input */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
                        Profession / Skill Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Electrician, Delivery Executive, Accountant..."
                            className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-600/5 transition-all text-slate-800 font-medium text-sm"
                            required
                            autoFocus
                        />
                    </div>
                </div>

                {/* Category Selection */}
                <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider ml-1">
                        Industry Category <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={isCustomCategory ? '__custom__' : category}
                        onChange={handleCategoryChange}
                        className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:bg-white focus:border-purple-600 focus:ring-4 focus:ring-purple-600/5 transition-all text-slate-800 font-medium text-sm cursor-pointer"
                    >
                        {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                        <option value="__custom__">+ Add Custom Category...</option>
                    </select>

                    {isCustomCategory && (
                        <div className="pt-2">
                            <input
                                type="text"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                placeholder="Enter custom category name..."
                                className="w-full px-5 py-3 bg-white border border-purple-300 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-600/5 transition-all text-slate-800 font-medium text-sm"
                                required
                            />
                        </div>
                    )}
                </div>

                {/* Info Note */}
                <div className="flex items-start gap-2.5 p-3.5 bg-blue-50/70 border border-blue-100 text-blue-900 rounded-2xl text-xs">
                    <Info size={16} className="text-km-primary shrink-0 mt-0.5" />
                    <span>
                        This profession/skill will be instantly available in the candidate profile search, recruiter job creation filters, and InstantMilega gig dispatch categories.
                    </span>
                </div>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-xs uppercase tracking-wider transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex items-center gap-2 px-8 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl text-xs uppercase tracking-wider transition-all shadow-md hover:shadow-lg disabled:opacity-50 active:scale-95"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Saving...</span>
                            </>
                        ) : (
                            <span>{initialData ? 'Update Profession' : 'Create Profession'}</span>
                        )}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default ProfessionModal;
