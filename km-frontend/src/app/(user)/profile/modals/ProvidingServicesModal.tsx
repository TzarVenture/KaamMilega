'use client';

import React, { useState, useEffect } from 'react';
import { X, Wrench, Trash2, Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-toastify';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentPrefs?: {
        is_providing?: boolean;
        services?: string[];
        hourly_rate?: number;
        currency?: string;
        description?: string;
    } | null;
    onSuccess: (updatedUser: Record<string, unknown>) => void;
}

const COMMON_SERVICES = [
    'AC Repair & Service', 'Electrical Wiring', 'Plumbing Maintenance',
    'Carpentry & Furniture', 'Painting & Waterproofing', 'Technical Mentorship',
    'Vehicle Mechanics', 'Welding & Fabrication'
];

export const ProvidingServicesModal: React.FC<Props> = ({
    isOpen,
    onClose,
    currentPrefs,
    onSuccess,
}) => {
    const [services, setServices] = useState<string[]>([]);
    const [serviceInput, setServiceInput] = useState('');
    const [hourlyRate, setHourlyRate] = useState<string>('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setServices(currentPrefs?.services || []);
            setHourlyRate(currentPrefs?.hourly_rate ? String(currentPrefs.hourly_rate) : '');
            setDescription(currentPrefs?.description || '');
            setServiceInput('');
        }
    }, [isOpen, currentPrefs]);

    if (!isOpen) return null;

    const handleAddService = (val: string) => {
        const trimmed = val.trim();
        if (trimmed && !services.includes(trimmed)) {
            setServices([...services, trimmed]);
            setServiceInput('');
        }
    };

    const handleRemoveService = (s: string) => {
        setServices(services.filter((item) => item !== s));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (services.length === 0) {
            toast.error('Please specify at least one service offered');
            return;
        }

        const rateNum = hourlyRate ? parseFloat(hourlyRate) : 0;

        setSaving(true);
        try {
            const res = (await api.patch('/user/providing-services', {
                is_providing: true,
                services: services,
                hourly_rate: rateNum,
                currency: 'INR',
                description: description.trim(),
            })) as { user?: Record<string, unknown> };
            toast.success('Service offerings updated');
            if (res?.user) {
                onSuccess(res.user);
            }
            onClose();
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Failed to save service offerings';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async () => {
        setRemoving(true);
        try {
            const res = (await api.patch('/user/providing-services', {
                is_providing: false,
                services: services,
                hourly_rate: hourlyRate ? parseFloat(hourlyRate) : 0,
                currency: 'INR',
                description: description.trim(),
            })) as { user?: Record<string, unknown> };
            toast.success('Removed service offerings from profile');
            if (res?.user) {
                onSuccess(res.user);
            }
            onClose();
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Failed to update service offerings';
            toast.error(msg);
        } finally {
            setRemoving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
            <div 
                className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50 shrink-0">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-orange-50 text-km-accent flex items-center justify-center border border-orange-100">
                            <Wrench size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">Providing Services</h3>
                            <p className="text-xs text-slate-500 font-medium">Showcase direct trades and services you deliver to clients</p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6 flex-1">
                    {/* Services Offered */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Services You Offer
                        </label>
                        <div className="flex gap-2 mb-2.5">
                            <input
                                type="text"
                                value={serviceInput}
                                onChange={(e) => setServiceInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddService(serviceInput);
                                    }
                                }}
                                placeholder="Add service (e.g. Electrical Fitting, Solar Installation)"
                                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-900 border border-slate-200 rounded-xl outline-hidden focus:border-km-primary focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                            />
                            <button
                                type="button"
                                onClick={() => handleAddService(serviceInput)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Add
                            </button>
                        </div>

                        {/* Selected Services Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {services.map((s) => (
                                <span
                                    key={s}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-800 border border-orange-200 rounded-xl text-xs font-bold"
                                >
                                    <span>{s}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveService(s)}
                                        className="hover:text-rose-500 cursor-pointer"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>

                        {/* Suggested Services */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Suggestions:</span>
                            {COMMON_SERVICES.filter((s) => !services.includes(s)).slice(0, 4).map((s) => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => handleAddService(s)}
                                    className="text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-orange-50 text-slate-600 hover:text-orange-800 font-semibold transition-colors cursor-pointer"
                                >
                                    + {s}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Hourly Rate / Starting Fee */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Starting / Hourly Rate (Optional)
                        </label>
                        <div className="relative max-w-xs">
                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs select-none">
                                ₹
                            </span>
                            <input
                                type="number"
                                min="0"
                                step="50"
                                value={hourlyRate}
                                onChange={(e) => setHourlyRate(e.target.value)}
                                placeholder="500"
                                className="w-full pl-8 pr-16 py-2 text-xs font-bold text-slate-900 border border-slate-200 rounded-xl outline-hidden focus:border-km-primary focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                            />
                            <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-semibold select-none">
                                / hour
                            </span>
                        </div>
                    </div>

                    {/* Service Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Service Details & Scope
                        </label>
                        <textarea
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Describe how you work with clients, equipment provided, warranty, or response turnaround time..."
                            className="w-full px-4 py-2.5 text-xs font-medium text-slate-900 border border-slate-200 rounded-xl outline-hidden focus:border-km-primary focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                        />
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        {currentPrefs?.is_providing ? (
                            <button
                                type="button"
                                onClick={handleRemove}
                                disabled={removing || saving}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                                {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                <span>Remove Services</span>
                            </button>
                        ) : <div />}

                        <div className="flex items-center gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={saving || services.length === 0}
                                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-km-primary hover:bg-km-primary-dark transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                <span>Save Services</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
