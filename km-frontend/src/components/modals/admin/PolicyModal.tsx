'use client';

import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { Plus } from 'lucide-react';

interface PolicyModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'add' | 'edit';
    policyData?: {
        id?: string;
        title: string;
        content: string;
    };
    onSave: (data: any) => void;
}

const PolicyModal = ({ isOpen, onClose, mode, policyData, onSave }: PolicyModalProps) => {
    const [formData, setFormData] = useState({
        title: '',
        content: ''
    });

    useEffect(() => {
        if (mode === 'edit' && policyData) {
            setFormData({
                title: policyData.title || '',
                content: policyData.content || ''
            });
        } else {
            setFormData({
                title: '',
                content: ''
            });
        }
    }, [mode, policyData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'add' ? 'Add Policies' : 'Edit Policies'}
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Policy</label>
                    <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleChange}
                        placeholder="Policy Name..."
                        required
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-sm"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Answer</label>
                    <textarea
                        name="content"
                        value={formData.content}
                        onChange={handleChange}
                        placeholder="Answer..."
                        required
                        rows={6}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all shadow-sm resize-none"
                    />
                </div>

                <div className="flex items-center justify-between pt-4">
                    <button
                        type="button"
                        className="flex items-center gap-2 text-purple-600 font-bold text-sm hover:underline"
                    >
                        <Plus size={16} />
                        Policy Page
                    </button>
                    <button
                        type="submit"
                        className="px-8 py-2 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-full transition-all shadow-lg shadow-purple-200 active:scale-95"
                    >
                        Save
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default PolicyModal;
