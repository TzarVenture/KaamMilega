'use client';

import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { 
    CaretDownIcon, 
    EnvelopeSimpleIcon, 
    MapPinIcon, 
    PhoneIcon, 
    UserIcon,
    BriefcaseIcon
} from '@phosphor-icons/react';

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
        email?: string;
        mobile?: string;
        city?: string;
        about?: string;
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
        headline: '',
        email: '',
        mobile: '',
        city: '',
        about: ''
    });

    useEffect(() => {
        if (mode === 'edit' && userData) {
            setFormData({
                firstName: userData.firstName || '',
                lastName: userData.lastName || '',
                additionalName: userData.additionalName || '',
                pronouns: userData.pronouns || '',
                headline: userData.headline || '',
                email: userData.email || '',
                mobile: userData.mobile || '',
                city: userData.city || '',
                about: userData.about || ''
            });
        } else {
            setFormData({
                firstName: '',
                lastName: '',
                additionalName: '',
                pronouns: '',
                headline: '',
                email: '',
                mobile: '',
                city: '',
                about: ''
            });
        }
    }, [mode, userData, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
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
            title={mode === 'add' ? 'Add Platform User' : 'Edit User & Personal Details'}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-xs text-purple-600 font-medium dark:text-purple-400">* Indicates required</p>

                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                            <UserIcon size={14} className="text-purple-600" />
                            First Name*
                        </label>
                        <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            placeholder="e.g. John"
                            className="w-full px-4 py-2.5 bg-km-surface-card border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                            <UserIcon size={14} className="text-purple-600" />
                            Last Name*
                        </label>
                        <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            placeholder="e.g. Doe"
                            className="w-full px-4 py-2.5 bg-km-surface-card border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium"
                        />
                    </div>
                </div>

                {/* Contact & Personal Details */}
                <div className="p-4 bg-purple-50/50 dark:bg-purple-950/20 rounded-2xl border border-purple-100 dark:border-purple-900/40 space-y-4">
                    <h5 className="text-xs font-bold text-purple-900 dark:text-purple-300 uppercase tracking-wider">
                        Personal & Contact Details
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                <EnvelopeSimpleIcon size={14} className="text-purple-600" />
                                Email Address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="e.g. user@example.com"
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                <PhoneIcon size={14} className="text-purple-600" />
                                Mobile Number
                            </label>
                            <input
                                type="tel"
                                name="mobile"
                                value={formData.mobile}
                                onChange={handleChange}
                                placeholder="e.g. 9876543210"
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-mono font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                                <MapPinIcon size={14} className="text-purple-600" />
                                City / Location
                            </label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="e.g. Mumbai, Maharashtra"
                                className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Pronouns</label>
                            <div className="relative">
                                <select
                                    name="pronouns"
                                    value={formData.pronouns}
                                    onChange={handleChange}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all appearance-none text-gray-700 dark:text-gray-200 text-sm font-medium"
                                >
                                    <option value="">Please Select</option>
                                    {PRONOUNS_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                                <CaretDownIcon weight="bold" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" size={16} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                        <BriefcaseIcon size={14} className="text-purple-600" />
                        Professional Headline*
                    </label>
                    <input
                        type="text"
                        name="headline"
                        value={formData.headline}
                        onChange={handleChange}
                        required
                        placeholder="e.g. Senior Frontend Developer | React, Next.js"
                        className="w-full px-4 py-2.5 bg-km-surface-card border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Additional Name / Nickname</label>
                    <input
                        type="text"
                        name="additionalName"
                        value={formData.additionalName}
                        onChange={handleChange}
                        placeholder="e.g. Johnny"
                        className="w-full px-4 py-2.5 bg-km-surface-card border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium"
                    />
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wider">About / Summary</label>
                    <textarea
                        name="about"
                        rows={3}
                        value={formData.about}
                        onChange={handleChange}
                        placeholder="Brief summary of experience, interests, or background..."
                        className="w-full px-4 py-2.5 bg-km-surface-card border border-gray-300 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all text-sm font-medium resize-none"
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="px-8 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-purple-600/20 active:scale-95"
                    >
                        Save Profile Changes
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default UserProfileModal;
