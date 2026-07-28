'use client';

import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { ChevronDown } from 'lucide-react';

interface UserProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'add' | 'edit';
    userData?: {
        firstName: string;
        lastName: string;
        additionalName?: string;
        pronouns?: string;
        headline: string;
    };
    onSave: (data: any) => void;
}

const PRONOUNS_OPTIONS = [
    'He/Him',
    'She/Her',
    'They/Them',
    'Other',
    'Prefer not to say'
];

const UserProfileModal = ({ isOpen, onClose, mode, userData, onSave }: UserProfileModalProps) => {
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        additionalName: '',
        pronouns: '',
        headline: ''
    });

    useEffect(() => {
        if (mode === 'edit' && userData) {
            setFormData({
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                additionalName: userData.additionalName || '',
                pronouns: userData.pronouns || '',
                headline: userData.headline || ''
            });
        } else {
            setFormData({
                firstName: '',
                lastName: '',
                additionalName: '',
                pronouns: '',
                headline: ''
            });
        }
    }, [mode, userData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
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
            title={mode === 'add' ? 'Add Profile' : 'Edit User Profile'}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                <p className="text-xs text-purple-600 font-medium">* Indicates required</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">First Name*</label>
                        <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-semibold text-gray-700">Last Name*</label>
                        <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                        />
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Additional Name</label>
                    <input
                        type="text"
                        name="additionalName"
                        value={formData.additionalName}
                        onChange={handleChange}
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Pronouns</label>
                    <div className="relative">
                        <select
                            name="pronouns"
                            value={formData.pronouns}
                            onChange={handleChange}
                            className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none text-gray-600"
                        >
                            <option value="">Please Select</option>
                            {PRONOUNS_OPTIONS.map(option => (
                                <option key={option} value={option}>{option}</option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={18} />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Let others know how to refer to you.</p>
                    <p className="text-xs text-gray-500">
                        Learn More About <a href="#" className="text-purple-600 font-semibold hover:underline">Gender Pronouns.</a>
                    </p>
                </div>

                <div className="space-y-1.5">
                    <label className="text-sm font-semibold text-gray-700">Headline*</label>
                    <input
                        type="text"
                        name="headline"
                        value={formData.headline}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                    />
                </div>

                <div className="flex justify-end pt-4">
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

export default UserProfileModal;
