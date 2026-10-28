'use client';

import React, { useState } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { BuildingOfficeIcon, CheckCircleIcon, CircleNotchIcon, GlobeIcon, IdentificationCardIcon, PhoneIcon, UserIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import api from '@/lib/axios';

interface AddCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

const AddCompanyModal = ({ isOpen, onClose, onSuccess }: AddCompanyModalProps) => {
    const [companyName, setCompanyName] = useState('');
    const [recruiterName, setRecruiterName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [designation, setDesignation] = useState('');
    const [website, setWebsite] = useState('');
    const [industry, setIndustry] = useState('');
    const [gst, setGst] = useState('');
    const [initialStatus, setInitialStatus] = useState<'pending' | 'verified' | 'no_appeal'>('pending');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const resetForm = () => {
        setCompanyName('');
        setRecruiterName('');
        setEmail('');
        setMobile('');
        setDesignation('');
        setWebsite('');
        setIndustry('');
        setGst('');
        setInitialStatus('pending');
        setError(null);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName.trim()) {
            setError('Company Name is required.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const payload = {
                name: companyName.trim(),
                recruiter_name: recruiterName.trim() || undefined,
                email: email.trim().toLowerCase() || undefined,
                mobile: mobile.trim() || undefined,
                designation: designation.trim() || undefined,
                website: website.trim() || undefined,
                industry: industry.trim() || undefined,
                gst: gst.trim() || undefined,
                status: initialStatus,
            };

            await api.post('/admin/companies', payload);
            notify.success(`Company "${companyName.trim()}" created successfully!`);
            resetForm();
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to create company:', err);
            const msg = err.response?.data?.error || err.message || 'Failed to add company.';
            setError(msg);
            notify.error(msg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={handleClose} title="Add New Company & Recruiter">
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl">
                        {error}
                    </div>
                )}

                {/* Company Details Section */}
                <div className="space-y-3.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <BuildingOfficeIcon size={15} weight="bold" /> Company Details
                    </p>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">
                            Company Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Acme Technologies Pvt Ltd"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Industry</label>
                            <input
                                type="text"
                                placeholder="e.g. Information Technology"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Company Website</label>
                            <div className="relative">
                                <GlobeIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="url"
                                    placeholder="https://acme.com"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1">GSTIN / Tax ID</label>
                        <input
                            type="text"
                            placeholder="e.g. 27ABCDE1234F1Z5"
                            value={gst}
                            onChange={(e) => setGst(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                        />
                    </div>
                </div>

                {/* Recruiter Contact Section */}
                <div className="pt-3 border-t border-slate-100 space-y-3.5">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <UserIcon size={15} weight="bold" /> Recruiter / HR Contact
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Recruiter Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Priya Sharma"
                                value={recruiterName}
                                onChange={(e) => setRecruiterName(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Designation</label>
                            <input
                                type="text"
                                placeholder="e.g. HR Manager / Talent Lead"
                                value={designation}
                                onChange={(e) => setDesignation(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Work Email</label>
                            <input
                                type="email"
                                placeholder="recruiter@acme.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1">Mobile Number</label>
                            <div className="relative">
                                <PhoneIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="tel"
                                    placeholder="9876543210"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                    className="w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Verification Status Choice */}
                <div className="pt-3 border-t border-slate-100 space-y-2">
                    <label className="block text-xs font-bold text-slate-700">Initial Verification Status</label>
                    <div className="grid grid-cols-3 gap-2">
                        {[
                            { id: 'pending', label: 'Pending Review', color: 'hover:border-amber-300' },
                            { id: 'verified', label: 'Verified', color: 'hover:border-emerald-300' },
                            { id: 'no_appeal', label: 'No Appeal', color: 'hover:border-slate-300' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setInitialStatus(item.id as any)}
                                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all text-center ${
                                    initialStatus === item.id
                                        ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                        : `bg-slate-50 text-slate-600 border-slate-200 ${item.color}`
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm shadow-purple-600/20"
                    >
                        {loading ? (
                            <>
                                <CircleNotchIcon size={16} weight="bold" className="animate-spin" />
                                <span>Creating...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon size={16} weight="bold" />
                                <span>Create Company</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default AddCompanyModal;
