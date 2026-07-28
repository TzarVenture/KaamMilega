'use client';

import React, { useState } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { ChevronDown, Camera } from 'lucide-react';

interface AddAdsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: any) => void;
}

const AD_TYPES = [
    'Banner Ad',
    'Video Ad',
    'Sidebar Ad',
    'Featured Job Ad',
];

const AddAdsModal = ({ isOpen, onClose, onSave }: AddAdsModalProps) => {
    const [formData, setFormData] = useState({
        type: '',
        position: '',
        phoneNumber: '',
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave(formData);
        onClose();
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title="Add Adds"
            size="lg"
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Select Type Of Advertising</label>
                    <div className="relative">
                        <select
                            value={formData.type}
                            onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                            className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 transition-all text-sm italic appearance-none"
                            required
                        >
                            <option value="">Please Select Job Type</option>
                            {AD_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Input Position</label>
                    <input
                        type="text"
                        value={formData.position}
                        onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                        placeholder="Write here..."
                        required
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 transition-all text-sm italic"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Input Advertising Phone Number (Only for Ad)</label>
                    <input
                        type="tel"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                        placeholder="Write here..."
                        required
                        className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 transition-all text-sm italic"
                    />
                </div>

                {/* Creative Upload Placeholder */}
                <div className="pt-4 flex flex-col items-center">
                    <div className="w-full aspect-video bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-slate-400 group hover:border-purple-200 hover:bg-purple-50 transition-all cursor-pointer">
                        <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                            <Camera size={32} className="text-purple-600" />
                        </div>
                        <span className="text-xs font-bold uppercase tracking-widest">Upload Advertisement Creative</span>
                    </div>
                </div>

                <div className="flex justify-end pt-4">
                    <button
                        type="submit"
                        className="px-10 py-2.5 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-full transition-all shadow-lg shadow-purple-200 active:scale-95 uppercase text-xs tracking-wider"
                    >
                        Add
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default AddAdsModal;
