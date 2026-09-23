'use client';

import React, { useState, useEffect } from 'react';
import { X, Briefcase, Check, Trash2, Loader2, MapPin } from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-toastify';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentPrefs?: {
        is_open?: boolean;
        job_titles?: string[];
        job_types?: string[];
        locations?: string[];
        visibility?: string;
    } | null;
    onSuccess: (updatedUser: Record<string, unknown>) => void;
}

const COMMON_TITLES = [
    'Electrician', 'Technician', 'Full Stack Developer', 'Plumber',
    'Driver', 'Delivery Executive', 'Sales Associate', 'AC Mechanic'
];

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Freelance', 'Hourly'];

export const OpenToWorkModal: React.FC<Props> = ({
    isOpen,
    onClose,
    currentPrefs,
    onSuccess,
}) => {
    const [titles, setTitles] = useState<string[]>([]);
    const [titleInput, setTitleInput] = useState('');
    const [jobTypes, setJobTypes] = useState<string[]>([]);
    const [locations, setLocations] = useState<string[]>([]);
    const [locationInput, setLocationInput] = useState('');
    const [visibility, setVisibility] = useState<'all' | 'recruiters'>('all');
    const [saving, setSaving] = useState(false);
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTitles(currentPrefs?.job_titles || []);
            setJobTypes(currentPrefs?.job_types || ['Full-time']);
            setLocations(currentPrefs?.locations || []);
            setVisibility(currentPrefs?.visibility === 'recruiters' ? 'recruiters' : 'all');
            setTitleInput('');
            setLocationInput('');
        }
    }, [isOpen, currentPrefs]);

    if (!isOpen) return null;

    const handleAddTitle = (val: string) => {
        const trimmed = val.trim();
        if (trimmed && !titles.includes(trimmed)) {
            setTitles([...titles, trimmed]);
            setTitleInput('');
        }
    };

    const handleRemoveTitle = (t: string) => {
        setTitles(titles.filter((item) => item !== t));
    };

    const handleToggleJobType = (jt: string) => {
        if (jobTypes.includes(jt)) {
            setJobTypes(jobTypes.filter((item) => item !== jt));
        } else {
            setJobTypes([...jobTypes, jt]);
        }
    };

    const handleAddLocation = (val: string) => {
        const trimmed = val.trim();
        if (trimmed && !locations.includes(trimmed)) {
            setLocations([...locations, trimmed]);
            setLocationInput('');
        }
    };

    const handleRemoveLocation = (loc: string) => {
        setLocations(locations.filter((item) => item !== loc));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (titles.length === 0) {
            toast.error('Please add at least one target job title');
            return;
        }

        setSaving(true);
        try {
            const res = (await api.patch('/user/open-to-work', {
                is_open: true,
                job_titles: titles,
                job_types: jobTypes,
                locations: locations,
                visibility: visibility,
            })) as { user?: Record<string, unknown> };
            toast.success('Open to work preferences saved');
            if (res?.user) {
                onSuccess(res.user);
            }
            onClose();
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Failed to save preferences';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleRemove = async () => {
        setRemoving(true);
        try {
            const res = (await api.patch('/user/open-to-work', {
                is_open: false,
                job_titles: titles,
                job_types: jobTypes,
                locations: locations,
                visibility: visibility,
            })) as { user?: Record<string, unknown> };
            toast.success('Removed Open to Work status from profile');
            if (res?.user) {
                onSuccess(res.user);
            }
            onClose();
        } catch (err: unknown) {
            const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : 'Failed to update preferences';
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
                        <div className="w-9 h-9 rounded-xl bg-blue-50 text-km-primary flex items-center justify-center border border-blue-100">
                            <Briefcase size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-slate-900">Open To Work</h3>
                            <p className="text-xs text-slate-500 font-medium">Show recruiters the opportunities you are seeking</p>
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
                    {/* Job Titles */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Job Titles
                        </label>
                        <div className="flex gap-2 mb-2.5">
                            <input
                                type="text"
                                value={titleInput}
                                onChange={(e) => setTitleInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddTitle(titleInput);
                                    }
                                }}
                                placeholder="Add role (e.g. Electrician, Web Developer)"
                                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-900 border border-slate-200 rounded-xl outline-hidden focus:border-km-primary focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                            />
                            <button
                                type="button"
                                onClick={() => handleAddTitle(titleInput)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Add
                            </button>
                        </div>

                        {/* Selected Title Badges */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                            {titles.map((t) => (
                                <span
                                    key={t}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-km-primary border border-blue-200 rounded-xl text-xs font-bold"
                                >
                                    <span>{t}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveTitle(t)}
                                        className="hover:text-rose-500 cursor-pointer"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>

                        {/* Suggested Titles */}
                        <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span className="text-[10px] text-slate-400 font-bold uppercase mr-1">Suggestions:</span>
                            {COMMON_TITLES.filter((t) => !titles.includes(t)).slice(0, 4).map((t) => (
                                <button
                                    key={t}
                                    type="button"
                                    onClick={() => handleAddTitle(t)}
                                    className="text-[11px] px-2.5 py-0.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-600 hover:text-km-primary font-semibold transition-colors cursor-pointer"
                                >
                                    + {t}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Job Types */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Job Types
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {JOB_TYPES.map((jt) => {
                                const selected = jobTypes.includes(jt);
                                return (
                                    <button
                                        key={jt}
                                        type="button"
                                        onClick={() => handleToggleJobType(jt)}
                                        className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                                            selected
                                                ? 'bg-km-primary text-white border-km-primary shadow-2xs'
                                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                                        }`}
                                    >
                                        {selected && <Check size={12} />}
                                        <span>{jt}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Target Locations */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Preferred Locations
                        </label>
                        <div className="flex gap-2 mb-2">
                            <input
                                type="text"
                                value={locationInput}
                                onChange={(e) => setLocationInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAddLocation(locationInput);
                                    }
                                }}
                                placeholder="Add city or 'Remote' (e.g. Mumbai, Delhi, Remote)"
                                className="flex-1 px-4 py-2 text-xs font-semibold text-slate-900 border border-slate-200 rounded-xl outline-hidden focus:border-km-primary focus:ring-2 focus:ring-blue-100 transition-all placeholder:text-slate-400"
                            />
                            <button
                                type="button"
                                onClick={() => handleAddLocation(locationInput)}
                                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                            >
                                Add
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                            {locations.map((loc) => (
                                <span
                                    key={loc}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold"
                                >
                                    <MapPin size={11} className="text-km-primary" />
                                    <span>{loc}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLocation(loc)}
                                        className="hover:text-rose-500 cursor-pointer ml-1"
                                    >
                                        <X size={12} />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Visibility Preference */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                            Visibility Scope
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label
                                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                                    visibility === 'all'
                                        ? 'border-km-primary bg-blue-50/50 ring-1 ring-km-primary'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-black text-slate-900">All Members</span>
                                    <input
                                        type="radio"
                                        name="visibility"
                                        value="all"
                                        checked={visibility === 'all'}
                                        onChange={() => setVisibility('all')}
                                        className="accent-km-primary"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium">
                                    Adds the Open to Work badge to your profile so anyone can find you.
                                </p>
                            </label>

                            <label
                                className={`p-3.5 rounded-2xl border cursor-pointer transition-all flex flex-col justify-between ${
                                    visibility === 'recruiters'
                                        ? 'border-km-primary bg-blue-50/50 ring-1 ring-km-primary'
                                        : 'border-slate-200 hover:border-slate-300'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-xs font-black text-slate-900">Recruiters Only</span>
                                    <input
                                        type="radio"
                                        name="visibility"
                                        value="recruiters"
                                        checked={visibility === 'recruiters'}
                                        onChange={() => setVisibility('recruiters')}
                                        className="accent-km-primary"
                                    />
                                </div>
                                <p className="text-[11px] text-slate-500 font-medium">
                                    Only verified recruiters and employers will see your job-seeking status.
                                </p>
                            </label>
                        </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                        {currentPrefs?.is_open ? (
                            <button
                                type="button"
                                onClick={handleRemove}
                                disabled={removing || saving}
                                className="px-4 py-2.5 rounded-xl text-xs font-bold text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer flex items-center gap-1.5"
                            >
                                {removing ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                                <span>Remove Status</span>
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
                                disabled={saving || titles.length === 0}
                                className="px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-km-primary hover:bg-km-primary-dark transition-all shadow-xs disabled:opacity-50 cursor-pointer flex items-center gap-2"
                            >
                                {saving && <Loader2 size={14} className="animate-spin" />}
                                <span>Save Preferences</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};
