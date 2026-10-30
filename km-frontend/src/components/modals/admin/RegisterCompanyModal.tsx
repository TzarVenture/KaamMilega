'use client';

import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { 
    BuildingOfficeIcon, 
    CheckCircleIcon, 
    CircleNotchIcon, 
    EnvelopeSimpleIcon, 
    GlobeIcon, 
    IdentificationCardIcon, 
    PhoneIcon, 
    ShieldCheckIcon, 
    UserIcon 
} from '@phosphor-icons/react';
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
            setError('Company Name is required.');
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
            notify.success(`Successfully registered "${user.name}" as Recruiter for "${companyName.trim()}"!`);
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
        <ModalWrapper 
            isOpen={isOpen} 
            onClose={onClose} 
            title={`Register as Company Recruiter — ${user?.name || 'User'}`}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                        {error}
                    </div>
                )}

                {/* Pre-fill Notice Banner */}
                <div className="p-3.5 bg-purple-50/70 border border-purple-100 rounded-2xl flex items-start gap-3">
                    <UserIcon size={20} weight="duotone" className="text-purple-600 shrink-0 mt-0.5" />
                    <div>
                        <p className="text-xs font-bold text-purple-900">
                            Pre-filled from User Profile: <span className="font-semibold text-purple-700">{user?.name}</span>
                        </p>
                        <p className="text-[11px] text-purple-600/80 mt-0.5">
                            Mobile: <span className="font-mono font-medium">{user?.mobile || 'Not set'}</span>
                            {user?.email && <> • Email: <span className="font-medium">{user.email}</span></>}
                        </p>
                    </div>
                </div>

                {/* Section 1: Company Credentials (Admin Enters These) */}
                <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3.5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <BuildingOfficeIcon size={15} weight="bold" className="text-purple-600" />
                        Company & Business Details
                    </p>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Company / Organization Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Acme Technologies Pvt Ltd"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all font-medium"
                            autoFocus
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Industry</label>
                            <select
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium text-slate-700"
                            >
                                <option value="">Select Industry</option>
                                {INDUSTRY_OPTIONS.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <GlobeIcon size={13} className="text-slate-400" />
                                Website
                            </label>
                            <input
                                type="url"
                                placeholder="https://example.com"
                                value={website}
                                onChange={(e) => setWebsite(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <IdentificationCardIcon size={14} className="text-slate-400" />
                                GSTIN / Tax ID
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. 27ABCDE1234F1Z5"
                                value={gst}
                                onChange={(e) => setGst(e.target.value.toUpperCase())}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono uppercase font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <ShieldCheckIcon size={14} className="text-slate-400" />
                                Initial Verification Status
                            </label>
                            <select
                                value={status}
                                onChange={(e: any) => setStatus(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-bold text-slate-700"
                            >
                                <option value="verified">Verified (Direct Access)</option>
                                <option value="pending">Pending Review</option>
                                <option value="no_appeal">No Appeal</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Section 2: Recruiter Contact (Pre-filled from User) */}
                <div className="p-4 bg-slate-50/70 rounded-2xl border border-slate-200/80 space-y-3.5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                        <UserIcon size={15} weight="bold" className="text-purple-600" />
                        Recruiter / HR Contact Details
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Recruiter Name</label>
                            <input
                                type="text"
                                value={recruiterName}
                                onChange={(e) => setRecruiterName(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Role / Designation</label>
                            <input
                                type="text"
                                placeholder="e.g. HR Manager / Talent Lead"
                                value={designation}
                                onChange={(e) => setDesignation(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <EnvelopeSimpleIcon size={13} className="text-slate-400" />
                                Work Email
                            </label>
                            <input
                                type="email"
                                placeholder="recruiter@company.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-medium"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1">
                                <PhoneIcon size={13} className="text-slate-400" />
                                Mobile Number
                            </label>
                            <input
                                type="tel"
                                placeholder="e.g. 9876543210"
                                value={mobile}
                                onChange={(e) => setMobile(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all font-mono font-medium"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading || !companyName.trim()}
                        className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 active:scale-95"
                    >
                        {loading ? (
                            <>
                                <CircleNotchIcon weight="bold" size={16} className="animate-spin" />
                                <span>Registering Company...</span>
                            </>
                        ) : (
                            <>
                                <BuildingOfficeIcon weight="bold" size={16} />
                                <span>Register as Company Recruiter</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default RegisterCompanyModal;

