'use client';

import React, { useState, useEffect } from 'react';
import { AdminModal, btn, field } from '@/components/admin/ui';
import { BuildingOfficeIcon, CircleNotchIcon, EnvelopeSimpleIcon, GlobeIcon, IdentificationCardIcon, PhoneIcon, ShieldCheckIcon, UserIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import api from '@/lib/axios';

interface RegisterCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        id: string;
        name: string;
        mobile?: string;
        email?: string;
        designation?: string;
    } | null;
    onSuccess: () => void;
}

const INDUSTRY_OPTIONS = [
    'Information Technology & Services',
    'Manufacturing & Engineering',
    'Healthcare & Pharmaceuticals',
    'Logistics, Supply Chain & Transport',
    'Retail & E-Commerce',
    'Hospitality & Food Services',
    'Banking & Financial Services',
    'Construction & Real Estate',
    'Education & Training',
    'Staffing & Recruiting',
    'Other Industry'
];

const RegisterCompanyModal = ({ isOpen, onClose, user, onSuccess }: RegisterCompanyModalProps) => {
    // Pre-filled from User
    const [recruiterName, setRecruiterName] = useState('');
    const [mobile, setMobile] = useState('');
    const [email, setEmail] = useState('');
    const [designation, setDesignation] = useState('');

    // Company specific details
    const [companyName, setCompanyName] = useState('');
    const [industry, setIndustry] = useState('');
    const [website, setWebsite] = useState('');
    const [gst, setGst] = useState('');
    const [status, setStatus] = useState<'pending' | 'verified' | 'no_appeal'>('verified');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (user) {
            setRecruiterName(user.name || '');
            setMobile(user.mobile || '');
            setEmail(user.email || '');
            setDesignation(user.designation || 'Talent Acquisition / HR Lead');
            setCompanyName('');
            setIndustry('');
            setWebsite('');
            setGst('');
            setStatus('verified');
            setError(null);
        }
    }, [user, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (!companyName.trim()) {
            setError('Enter the company name.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const payload = {
                recruiter_id: user.id,
                name: companyName.trim(),
                recruiter_name: recruiterName.trim() || user.name,
                email: email.trim().toLowerCase() || undefined,
                mobile: mobile.trim() || undefined,
                designation: designation.trim() || undefined,
                website: website.trim() || undefined,
                industry: industry.trim() || undefined,
                gst: gst.trim() || undefined,
                status: status,
            };

            await api.post('/admin/companies', payload);
            notify.success(`${user.name} is now a recruiter at ${companyName.trim()}`);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to register recruiter company:', err);
            const msg = err.response?.data?.error || err.message || 'Failed to register recruiter company.';
            setError(msg);
            notify.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AdminModal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Make ${user?.name || 'this user'} a recruiter`}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl">
                        {error}
                    </div>
                )}

                {/* Pre-fill Notice Banner */}
                <div className="p-3.5 bg-km-surface border border-km-border rounded-2xl flex items-start gap-3">
                    <UserIcon size={20} weight="duotone" className="text-km-link shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-km-heading">
                            Filled in from the profile of <span className="font-semibold text-km-link">{user?.name}</span>
                        </p>
                        <p className="text-xs text-km-link mt-0.5">
                            Mobile: <span className="font-inter font-medium">{user?.mobile || 'Not set'}</span>
                            {user?.email && <> · <span className="font-medium">{user.email}</span></>}
                        </p>
                    </div>
                </div>

                {/* Section 1: Company Credentials (Admin Enters These) */}
                <div className="p-4 bg-km-surface rounded-2xl border border-km-border/80 space-y-3.5">
                    <p className="text-xs font-bold text-km-text-secondary flex items-center gap-1.5">
                        <BuildingOfficeIcon size={15} weight="bold" className="text-km-link" />
                        Company & business details
                    </p>

                    <div>
                        <label className={field.label}>
                            Company name <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="For example: Acme Technologies Pvt Ltd"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className={field.input}
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className={field.label}>Industry</label>
                            <select
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                className={`${field.input} cursor-pointer`}
                            >
                                <option value="">Select industry</option>
                                {INDUSTRY_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                                <GlobeIcon size={13} className="text-km-text-muted" />
                                Website
                            </label>
                            <input
                                type="url"
                                placeholder="https://example.com"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                className={field.input}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                                <IdentificationCardIcon size={14} className="text-km-text-muted" />
                                GSTIN / Tax ID
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 27ABCDE1234F1Z5"
                                value={gst}
                                onChange={(e) => setGst(e.target.value.toUpperCase())}
                                className={`${field.input} font-inter`}
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                                <ShieldCheckIcon size={14} className="text-km-text-muted" />
                                Initial verification status
                            </label>
                            <select
                                value={status}
                                onChange={(e: any) => setStatus(e.target.value)}
                                className={`${field.input} cursor-pointer`}
                            >
                                <option value="verified">Verified (direct access)</option>
                                <option value="pending">Pending review</option>
                                <option value="no_appeal">No appeal</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Section 2: Recruiter Contact (Pre-filled from User) */}
                <div className="p-4 bg-km-surface rounded-2xl border border-km-border/80 space-y-3.5">
                    <p className="text-xs font-bold text-km-text-secondary flex items-center gap-1.5">
                        <UserIcon size={15} weight="bold" className="text-km-link" />
                        Recruiter / HR contact details
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className={field.label}>Recruiter name</label>
                            <input
                                type="text"
                                value={recruiterName}
                                onChange={(e) => setRecruiterName(e.target.value)}
                                className={field.input}
                            />
                        </div>

                        <div>
                            <label className={field.label}>Job title</label>
                            <input
                                type="text"
                                placeholder="For example: HR manager"
                                value={designation}
                                onChange={(e) => setDesignation(e.target.value)}
                                className={field.input}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                                <EnvelopeSimpleIcon size={13} className="text-km-text-muted" />
                                Work email
                            </label>
                            <input
                                type="email"
                                placeholder="recruiter@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={field.input}
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-1.5 text-sm font-medium text-km-heading mb-1.5">
                                <PhoneIcon size={13} className="text-km-text-muted" />
                                Mobile number
                            </label>
                            <input
                                type="tel"
                                placeholder="e.g. 9876543210"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value)}
                                className={`${field.input} font-inter`}
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-km-border-subtle">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className={btn.secondary}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !companyName.trim()}
                        className={btn.primary}
                    >
                        {loading ? (
                            <>
                                <CircleNotchIcon weight="bold" size={16} className="animate-spin" />
                                <span>Saving</span>
                            </>
                        ) : (
                            <>
                                <BuildingOfficeIcon weight="bold" size={16} />
                                <span>Register as company recruiter</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
};

export default RegisterCompanyModal;

