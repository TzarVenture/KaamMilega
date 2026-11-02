'use client';

import React, { useState, useEffect, useRef } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import {
    BuildingOfficeIcon,
    CheckCircleIcon,
    CircleNotchIcon,
    GlobeIcon,
    IdentificationCardIcon,
    MagnifyingGlassIcon,
    PhoneIcon,
    UserCheckIcon,
    UserIcon,
    XIcon
} from '@phosphor-icons/react';
import { notify } from '@/lib/notify';
import api from '@/lib/axios';

interface AddCompanyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

interface PlatformUser {
    id: string;
    name: string;
    email?: string;
    mobile?: string;
    headline?: string;
    roles?: string[];
}

const STATUS_CHOICES = [
    { id: 'pending', mobileLabel: 'Pending', fullLabel: 'Pending Review' },
    { id: 'verified', mobileLabel: 'Verified', fullLabel: 'Verified' },
    { id: 'no_appeal', mobileLabel: 'No Appeal', fullLabel: 'No Appeal' },
] as const;

const AddCompanyModal = ({ isOpen, onClose, onSuccess }: AddCompanyModalProps) => {
    // Company Fields
    const [companyName, setCompanyName] = useState('');
    const [website, setWebsite] = useState('');
    const [industry, setIndustry] = useState('');
    const [gst, setGst] = useState('');
    const [initialStatus, setInitialStatus] = useState<'pending' | 'verified' | 'no_appeal'>('pending');

    // Recruiter Fields
    const [recruiterName, setRecruiterName] = useState('');
    const [email, setEmail] = useState('');
    const [mobile, setMobile] = useState('');
    const [designation, setDesignation] = useState('');

    // Existing User Selection State
    const [existingUsers, setExistingUsers] = useState<PlatformUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const res: any = await api.get('/admin/users');
            const rawUsers = Array.isArray(res)
                ? res
                : Array.isArray(res?.data)
                ? res.data
                : Array.isArray(res?.users)
                ? res.users
                : [];

            const mapped: PlatformUser[] = rawUsers.map((u: any) => ({
                id: u.id || u._id,
                name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unnamed User',
                email: u.email || '',
                mobile: u.mobile || '',
                headline: u.headline || u.designation || '',
                roles: Array.isArray(u.roles) ? u.roles : (u.roles ? [u.roles] : ['user'])
            }));
            setExistingUsers(mapped);
        } catch (err) {
            console.error('Failed to load existing users:', err);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Pre-fetch on mount and on modal open
    useEffect(() => {
        fetchUsers();
    }, []);

    useEffect(() => {
        if (isOpen) {
            fetchUsers();
        }
    }, [isOpen]);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Eligible users: must NOT already be a recruiter
    const eligibleUsers = existingUsers.filter(u => {
        const hasRecruiterRole = u.roles?.some(r => r.toLowerCase() === 'recruiter');
        return !hasRecruiterRole;
    });

    // Intelligent initial & prefix-prioritized matching
    const filteredUsers = (() => {
        const q = userSearchQuery.trim().toLowerCase();
        if (!q) return []; // only show dropdown suggestions when user types letters

        return eligibleUsers
            .filter(u => {
                const name = (u.name || '').toLowerCase();
                const userEmail = (u.email || '').toLowerCase();
                const userMobile = (u.mobile || '').toLowerCase();
                const headline = (u.headline || '').toLowerCase();
                return name.includes(q) || userEmail.includes(q) || userMobile.includes(q) || headline.includes(q);
            })
            .sort((a, b) => {
                const aName = (a.name || '').toLowerCase();
                const bName = (b.name || '').toLowerCase();

                // 1. Matches first letters of name / initials
                const aStarts = aName.startsWith(q);
                const bStarts = bName.startsWith(q);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;

                // 2. Any word in name starts with query
                const aWordStarts = aName.split(/\s+/).some(w => w.startsWith(q));
                const bWordStarts = bName.split(/\s+/).some(w => w.startsWith(q));
                if (aWordStarts && !bWordStarts) return -1;
                if (!aWordStarts && bWordStarts) return 1;

                return aName.localeCompare(bName);
            })
            .slice(0, 8);
    })();

    const handleSelectUser = (u: PlatformUser) => {
        setSelectedUser(u);
        setRecruiterName(u.name);
        if (u.email) setEmail(u.email);
        if (u.mobile) setMobile(u.mobile);
        if (u.headline) setDesignation(u.headline);
        setUserSearchQuery('');
        setIsDropdownOpen(false);
    };

    const handleClearSelectedUser = () => {
        setSelectedUser(null);
        setRecruiterName('');
        setEmail('');
        setMobile('');
        setDesignation('');
        setUserSearchQuery('');
    };

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
        setSelectedUser(null);
        setUserSearchQuery('');
        setIsDropdownOpen(false);
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
                recruiter_id: selectedUser ? selectedUser.id : undefined,
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
            <form onSubmit={handleSubmit} className="space-y-3.5">
                {error && (
                    <div className="p-2.5 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/60">
                        {error}
                    </div>
                )}

                {/* Option to Choose Existing User as Recruiter */}
                <div className="p-2.5 sm:p-3 bg-gradient-to-r from-purple-50/90 to-indigo-50/60 dark:from-purple-950/30 dark:to-indigo-950/20 border border-purple-200/80 dark:border-purple-800/60 rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <UserCheckIcon size={13} weight="bold" />
                            </div>
                            <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                <span className="hidden sm:inline">Add Existing User as Recruiter</span>
                                <span className="sm:hidden">Existing User</span>
                            </h4>
                            <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300 shrink-0">
                                Optional
                            </span>
                        </div>
                        {selectedUser && (
                            <button
                                type="button"
                                onClick={handleClearSelectedUser}
                                className="px-2 py-0.5 text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 ml-1.5"
                                title="Unlink selected user"
                            >
                                <XIcon size={11} weight="bold" />
                                <span>Clear</span>
                            </button>
                        )}
                    </div>

                    {selectedUser ? (
                        <div className="p-2 bg-white dark:bg-slate-900/80 border border-purple-200 dark:border-purple-800/80 rounded-xl flex items-center justify-between gap-2 shadow-xs">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 font-bold text-xs flex items-center justify-center shrink-0">
                                    {selectedUser.name.substring(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                                            {selectedUser.name}
                                        </p>
                                        <span className="px-1.5 py-0.2 text-[9px] font-bold uppercase rounded bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 shrink-0">
                                            Linked
                                        </span>
                                    </div>
                                    <p className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                        {[selectedUser.email, selectedUser.mobile, selectedUser.headline].filter(Boolean).join(' • ')}
                                    </p>
                                </div>
                            </div>
                            <span className="text-[10px] sm:text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1 shrink-0">
                                <CheckCircleIcon size={13} weight="bold" /> Auto-filled
                            </span>
                        </div>
                    ) : (
                        <div className="relative" ref={dropdownRef}>
                            <div className="relative">
                                <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Search existing user"
                                    value={userSearchQuery}
                                    disabled={loadingUsers}
                                    onFocus={() => {
                                        if (userSearchQuery.trim()) setIsDropdownOpen(true);
                                    }}
                                    onChange={(e) => {
                                        setUserSearchQuery(e.target.value);
                                        setIsDropdownOpen(true);
                                    }}
                                    className="w-full h-9 pl-8.5 pr-8 py-1.5 bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all placeholder:text-slate-400 dark:text-white"
                                />
                                {loadingUsers && (
                                    <CircleNotchIcon size={13} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-purple-600" />
                                )}
                                {userSearchQuery && !loadingUsers && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUserSearchQuery('');
                                            setIsDropdownOpen(false);
                                        }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-0.5"
                                    >
                                        <XIcon size={11} weight="bold" />
                                    </button>
                                )}
                            </div>

                            {/* Suggestions Dropdown - shows only when typing matching letters */}
                            {isDropdownOpen && !loadingUsers && filteredUsers.length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredUsers.map((u) => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleSelectUser(u);
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-purple-50/70 dark:hover:bg-purple-950/40 transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[10px] flex items-center justify-center shrink-0 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/60 group-hover:text-purple-700 dark:group-hover:text-purple-300 transition-colors">
                                                    {u.name.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                                                        {u.name}
                                                    </p>
                                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                                        {[u.email, u.mobile].filter(Boolean).join(' • ') || 'No contact info'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {u.roles?.map((r) => (
                                                    <span key={r} className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase">
                                                        {r}
                                                    </span>
                                                ))}
                                                <span className="text-[10px] font-bold text-purple-600 dark:text-purple-400 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                                                    Select →
                                                </span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Company Details Section */}
                <div className="space-y-2.5">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <BuildingOfficeIcon size={14} weight="bold" /> Company Details
                    </p>

                    <div>
                        <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                            Company Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            placeholder="e.g. Acme Technologies Pvt Ltd"
                            value={companyName}
                            onChange={(e) => setCompanyName(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-900 transition-all dark:text-white"
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                        <div>
                            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Industry</label>
                            <input
                                type="text"
                                placeholder="e.g. Information Technology"
                                value={industry}
                                onChange={(e) => setIndustry(e.target.value)}
                                className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-900 transition-all dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Company Website</label>
                            <div className="relative">
                                <GlobeIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="url"
                                    placeholder="https://acme.com"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    className="w-full h-9 pl-8.5 pr-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-900 transition-all dark:text-white"
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">GSTIN / Tax ID</label>
                        <input
                            type="text"
                            placeholder="e.g. 27ABCDE1234F1Z5"
                            value={gst}
                            onChange={(e) => setGst(e.target.value)}
                            className="w-full h-9 px-3 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-mono focus:outline-none focus:ring-2 focus:ring-purple-500 focus:bg-white dark:focus:bg-slate-900 transition-all dark:text-white"
                        />
                    </div>
                </div>

                {/* Recruiter Contact Section */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <UserIcon size={14} weight="bold" /> Recruiter / HR Contact
                        </p>
                        {selectedUser && (
                            <span className="text-[10px] sm:text-[11px] font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                                <UserCheckIcon size={12} weight="bold" /> From {selectedUser.name}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                        <div>
                            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Recruiter Name</label>
                            <input
                                type="text"
                                placeholder="e.g. Priya Sharma"
                                value={recruiterName}
                                onChange={(e) => setRecruiterName(e.target.value)}
                                className={`w-full h-9 px-3 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all dark:text-white ${
                                    selectedUser
                                        ? 'bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60'
                                        : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900'
                                }`}
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Designation</label>
                            <input
                                type="text"
                                placeholder="e.g. HR Manager / Talent Lead"
                                value={designation}
                                onChange={(e) => setDesignation(e.target.value)}
                                className={`w-full h-9 px-3 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all dark:text-white ${
                                    selectedUser
                                        ? 'bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60'
                                        : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900'
                                }`}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                        <div>
                            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Work Email</label>
                            <input
                                type="email"
                                placeholder="recruiter@acme.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`w-full h-9 px-3 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all dark:text-white ${
                                    selectedUser
                                        ? 'bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60'
                                        : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900'
                                }`}
                            />
                        </div>

                        <div>
                            <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Mobile Number</label>
                            <div className="relative">
                                <PhoneIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <input
                                    type="tel"
                                    placeholder="9876543210"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                    className={`w-full h-9 pl-8.5 pr-3 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all dark:text-white ${
                                        selectedUser
                                            ? 'bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800/60'
                                            : 'bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:bg-white dark:focus:bg-slate-900'
                                    }`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Verification Status Choice - Slim, single-line, uniform buttons */}
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1.5">
                    <label className="block text-[11px] sm:text-xs font-semibold text-slate-700 dark:text-slate-300">Initial Verification Status</label>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {STATUS_CHOICES.map((item) => {
                            const isSelected = initialStatus === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setInitialStatus(item.id)}
                                    className={`h-9 px-2 text-[11px] sm:text-xs font-semibold rounded-xl border transition-all flex items-center justify-center text-center cursor-pointer whitespace-nowrap ${
                                        isSelected
                                            ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                                            : 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-purple-300 dark:hover:border-purple-600'
                                    }`}
                                >
                                    <span className="sm:hidden">{item.mobileLabel}</span>
                                    <span className="hidden sm:inline">{item.fullLabel}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Modal Footer - Slim, consistent h-9 buttons */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleClose}
                        className="h-9 px-4 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="h-9 px-4 sm:px-5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-sm shadow-purple-600/20 cursor-pointer active:scale-95 whitespace-nowrap"
                    >
                        {loading ? (
                            <>
                                <CircleNotchIcon size={14} weight="bold" className="animate-spin" />
                                <span>Creating...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon size={14} weight="bold" />
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
