'use client';

import React, { useState, useEffect } from 'react';
import { AdminModal, btn, field } from '@/components/admin/ui';
import { CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { errorText } from "@/lib/notify";

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
            setErrorMessage('Enter a name');
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
            setErrorMessage(errorText(err, 'Failed to save profession/skill'));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={initialData ? "Edit profession" : "Add profession"}
        >
            <form onSubmit={handleSave} className="space-y-6">
                {errorMessage && (
                    <div className="flex items-center gap-2.5 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs font-semibold">
                        <WarningCircleIcon weight="bold" size={18} className="shrink-0 text-red-500" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Name Input */}
                <div className="space-y-2">
                    <label className={field.label}>
                        Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="For example: Electrician"
                            className={field.input}
                            required
                            autoFocus
                        />
                    </div>
                </div>

                {/* Category Selection */}
                <div className="space-y-2">
                    <label className={field.label}>
                        Category <span className="text-red-500">*</span>
                    </label>
                    <select
                        value={isCustomCategory ? '__custom__' : category}
                        onChange={handleCategoryChange}
                        className={`${field.input} cursor-pointer`}
                    >
                        {availableCategories.map((cat) => (
                            <option key={cat} value={cat}>
                                {cat}
                            </option>
                        ))}
                        <option value="__custom__">New category</option>
                    </select>

                    {isCustomCategory && (
                        <div className="pt-2">
                            <input
                                type="text"
                                value={customCategory}
                                onChange={(e) => setCustomCategory(e.target.value)}
                                placeholder="New category name"
                                className={field.input}
                                required
                            />
                        </div>
                    )}
                </div>

                <p className={field.hint}>People see it in profile skills, job filters and InstantMilega categories as soon as you add it.</p>

                {/* Footer Controls */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-km-border-subtle">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className={btn.secondary}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className={btn.primary}
                    >
                        {isSubmitting ? (
                            <>
                                <CircleNotchIcon weight="bold" size={16} className="animate-spin" />
                                <span>Saving</span>
                            </>
                        ) : (
                            <span>{initialData ? 'Save' : 'Add profession'}</span>
                        )}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
};

export default ProfessionModal;
