'use client';

import React, { useState, useEffect } from 'react';
import { AdminModal, btn, field } from '@/components/admin/ui';
import { BuildingOfficeIcon, CheckCircleIcon, CircleNotchIcon, EnvelopeSimpleIcon, GlobeIcon, IdentificationCardIcon, PhoneIcon, UserIcon } from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import api from '@/lib/axios';

interface EditCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    company: any | null;
    onSuccess: () => void;
}

const EditCompanyModal = ({ isOpen, onClose, company, onSuccess }: EditCompanyModalProps) => {
    const [companyName, setCompanyName] = useState('');
    const [recruiterName, setRecruiterName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [designation, setDesignation] = useState('');
    const [website, setWebsite] = useState('');
    const [industry, setIndustry] = useState('');
    const [gst, setGst] = useState('');
    const [status, setStatus] = useState<'pending' | 'verified' | 'rejected' | 'no_appeal'>('pending');

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (company) {
            setCompanyName(company.name || '');
            setIndustry(company.industry || '');
            setWebsite(company.website || '');
            setGst(company.gst || '');
            setRecruiterName(company.recruiter?.name || '');
            setDesignation(company.recruiter?.designation || '');
            setEmail(company.recruiter?.email || '');
            setMobile(company.recruiter?.mobile || '');
            setStatus(company.status || 'pending');
            setError(null);
        }
    }, [company]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!company?.id) return;

        if (!companyName.trim()) {
            setError('Enter the company name.');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const payload = {
                name: companyName.trim(),
                recruiter_name: recruiterName.trim() || undefined,
                designation: designation.trim() || undefined,
                email: email.trim().toLowerCase() || undefined,
                mobile: mobile.trim() || undefined,
                website: website.trim() || undefined,
                industry: industry.trim() || undefined,
                gst: gst.trim() || undefined,
                status,
            };

            await api.patch(`/admin/companies/${company.id}`, payload);
            notify.success(`${companyName.trim()} updated`);
            onSuccess();
            onClose();
        } catch (err: any) {
            console.error('Failed to update company:', err);
            const msg = err.response?.data?.error || err.message || 'Failed to update company.';
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
            title={`Edit ${company?.name || 'company'}`}
        >
            <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                    <div className="p-3 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl">
                        {error}
                    </div>
                )}

                {/* Company Details Section */}
                <div className="space-y-3.5">
                    <p className="text-xs font-bold text-km-text-muted flex items-center gap-1.5">
                        <BuildingOfficeIcon size={15} weight="bold" /> Company Details
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
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className={field.label}>Industry</label>
                            <input
                                type="text"
                                placeholder="For example: IT services"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                className={field.input}
                            />
                        </div>

                        <div>
                            <label className={field.label}>Company website</label>
                            <div className="relative">
                                <GlobeIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-muted" />
                                <input
                                    type="url"
                                    placeholder="https://acme.com"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    className={`${field.input} pl-9`}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={field.label}>GSTIN / Tax ID</label>
                        <div className="relative">
                            <IdentificationCardIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-muted" />
                            <input
                                type="text"
                                placeholder="e.g. 27ABCDE1234F1Z5"
                                value={gst}
                                onChange={(e) => setGst(e.target.value)}
                                className={`${field.input} pl-9 font-inter`}
                            />
                        </div>
                    </div>
                </div>

                {/* Recruiter Contact Section */}
                <div className="pt-3 border-t border-km-border-subtle space-y-3.5">
                    <p className="text-xs font-bold text-km-text-muted flex items-center gap-1.5">
                        <UserIcon size={15} weight="bold" /> Recruiter / HR Contact
                    </p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div>
                            <label className={field.label}>Recruiter name</label>
                            <input
                                type="text"
                                placeholder="For example: Priya Sharma"
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
                            <label className={field.label}>Work email</label>
                            <div className="relative">
                                <EnvelopeSimpleIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-muted" />
                                <input
                                    type="email"
                                    placeholder="recruiter@acme.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className={`${field.input} pl-9`}
                                />
                            </div>
                        </div>

                        <div>
                            <label className={field.label}>Mobile number</label>
                            <div className="relative">
                                <PhoneIcon size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-muted" />
                                <input
                                    type="tel"
                                    placeholder="9876543210"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                    className={`${field.input} pl-9`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Verification Status Choice */}
                <div className="pt-3 border-t border-km-border-subtle space-y-2">
                    <label className={field.label}>Verification status</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {[
                            { id: 'pending', label: 'Pending', color: 'hover:border-amber-300' },
                            { id: 'verified', label: 'Verified', color: 'hover:border-emerald-300' },
                            { id: 'no_appeal', label: 'No appeal', color: 'hover:border-km-border' },
                            { id: 'rejected', label: 'Rejected', color: 'hover:border-red-300' },
                        ].map((item) => (
                            <button
                                key={item.id}
                                type="button"
                                onClick={() => setStatus(item.id as any)}
                                className={`px-3 py-2 text-xs font-bold rounded-xl border transition-all text-center ${
 status === item.id
 ?'bg-km-primary text-white border-km-blue shadow-sm'
                                        : `bg-km-surface text-km-text-secondary border-km-border ${item.color}`
                                }`}
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Modal Footer */}
                <div className="pt-4 border-t border-km-border-subtle flex items-center justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className={btn.secondary}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className={btn.primary}
                    >
                        {loading ? (
                            <>
                                <CircleNotchIcon size={16} weight="bold" className="animate-spin" />
                                <span>Saving</span>
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon size={16} weight="bold" />
                                <span>Save changes</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
};

export default EditCompanyModal;

