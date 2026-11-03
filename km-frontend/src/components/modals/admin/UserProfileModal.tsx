'use client';

import React, { useState, useEffect } from 'react';
import { AdminModal, btn, field } from '@/components/admin/ui';
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
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={mode === 'add' ? 'Add user' : 'Edit user'}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                <p className="text-xs text-km-link font-medium">* Indicates required</p>

                {/* Name Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                            <UserIcon size={14} className="text-km-link" />
                            First name*
                        </label>
                        <input
                            type="text"
                            name="firstName"
                            value={formData.firstName}
                            onChange={handleChange}
                            required
                            placeholder="e.g. John"
                            className={field.input}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                            <UserIcon size={14} className="text-km-link" />
                            Last name*
                        </label>
                        <input
                            type="text"
                            name="lastName"
                            value={formData.lastName}
                            onChange={handleChange}
                            required
                            placeholder="e.g. Doe"
                            className={field.input}
                        />
                    </div>
                </div>

                {/* Contact & Personal Details */}
                <div className="p-4 bg-km-surface rounded-2xl border border-km-border space-y-4">
                    <h5 className="text-xs font-bold text-km-heading">
                        Personal & contact details
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                                <EnvelopeSimpleIcon size={14} className="text-km-link" />
                                Email address
                            </label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="e.g. user@example.com"
                                className={field.input}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                                <PhoneIcon size={14} className="text-km-link" />
                                Mobile number
                            </label>
                            <input
                                type="tel"
                                name="mobile"
                                value={formData.mobile}
                                onChange={handleChange}
                                placeholder="e.g. 9876543210"
                                className={`${field.input} font-inter`}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                                <MapPinIcon size={14} className="text-km-link" />
                                City
                            </label>
                            <input
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleChange}
                                placeholder="e.g. Mumbai, Maharashtra"
                                className={field.input}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className={field.label}>Pronouns</label>
                            <div className="relative">
                                <select
                                    name="pronouns"
                                    value={formData.pronouns}
                                    onChange={handleChange}
                                    className={`${field.input} appearance-none cursor-pointer`}
                                >
                                    <option value="">Please select</option>
                                    {PRONOUNS_OPTIONS.map(option => (
                                        <option key={option} value={option}>{option}</option>
                                    ))}
                                </select>
                                <CaretDownIcon weight="bold" className="absolute right-4 top-1/2 -translate-y-1/2 text-km-text-muted pointer-events-none" size={16} />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Additional Info */}
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                        <BriefcaseIcon size={14} className="text-km-link" />
                        Professional headline*
                    </label>
                    <input
                        type="text"
                        name="headline"
                        value={formData.headline}
                        onChange={handleChange}
                        required
                        placeholder="For example: Frontend developer"
                        className={field.input}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className={field.label}>Additional name / nickname</label>
                    <input
                        type="text"
                        name="additionalName"
                        value={formData.additionalName}
                        onChange={handleChange}
                        placeholder="e.g. Johnny"
                        className={field.input}
                    />
                </div>

                <div className="space-y-1.5">
                    <label className={field.label}>About</label>
                    <textarea
                        name="about"
                        rows={3}
                        value={formData.about}
                        onChange={handleChange}
                        placeholder="Experience, interests or background"
                        className={`${field.textarea} resize-none`}
                    />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-km-border-subtle">
                    <button
                        type="button"
                        onClick={onClose}
                        className={btn.secondary}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className={btn.primary}
                    >
                        Save profile changes
                    </button>
                </div>
            </form>
        </AdminModal>
    );
};

export default UserProfileModal;
