'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AdminModal, btn, field } from '@/components/admin/ui';
import { BuildingOfficeIcon, CheckCircleIcon, CircleNotchIcon, GlobeIcon, MagnifyingGlassIcon, PhoneIcon, UserCheckIcon, UserIcon, XIcon } from '@phosphor-icons/react';
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
    { id: 'pending', mobileLabel: 'Pending', fullLabel: 'Pending' },
    { id: 'verified', mobileLabel: 'Verified', fullLabel: 'Verified' },
    { id: 'no_appeal', mobileLabel: 'No appeal', fullLabel: 'No appeal' },
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
                name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Unnamed user',
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
            setError('Enter the company name.');
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
            notify.success(`${companyName.trim()} added`);
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
        <AdminModal isOpen={isOpen} onClose={handleClose} title="Add company">
            <form onSubmit={handleSubmit} className="space-y-3.5">
                {error && (
                    <div className="p-2.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-xl">
                        {error}
                    </div>
                )}

                {/* Option to Choose Existing User as Recruiter */}
                <div className="p-2.5 sm:p-3 bg-km-surface border border-km-border rounded-xl space-y-2">
                    <div className="flex items-center justify-between gap-2 min-w-0">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                            <div className="w-5 h-5 rounded-md bg-km-primary text-white flex items-center justify-center shrink-0 shadow-xs">
                                <UserCheckIcon size={13} weight="bold" />
                            </div>
                            <h4 className="text-xs font-bold text-km-heading truncate">
                                <span className="hidden sm:inline">Add existing user as recruiter</span>
                                <span className="sm:hidden">Existing user</span>
                            </h4>
                            <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-km-surface text-km-link shrink-0">
                                Optional
                            </span>
                        </div>
                        {selectedUser && (
                            <button
                                type="button"
                                onClick={handleClearSelectedUser}
                                className="px-2 py-0.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shrink-0 ml-1.5"
                                title="Unlink selected user"
                            >
                                <XIcon size={11} weight="bold" />
                                <span>Clear</span>
                            </button>
                        )}
                    </div>

                    {selectedUser ? (
                        <div className="p-2 bg-km-surface-card border border-km-border rounded-xl flex items-center justify-between gap-2 shadow-xs">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-6 h-6 rounded-full bg-km-surface text-km-link font-bold text-xs flex items-center justify-center shrink-0">
                                    {selectedUser.name.substring(0, 1).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <p className="text-xs font-bold text-km-heading truncate">
                                            {selectedUser.name}
                                        </p>
                                        <span className="px-1.5 py-0.2 text-xs font-bold rounded bg-km-surface text-km-link border border-km-border shrink-0">
                                            Linked
                                        </span>
                                    </div>
                                    <p className="text-xs sm:text-xs text-km-text-secondary truncate">
                                        {[selectedUser.email, selectedUser.mobile, selectedUser.headline].filter(Boolean).join(' · ')}
                                    </p>
                                </div>
                            </div>
                            <span className="text-xs sm:text-xs text-emerald-600 font-semibold flex items-center gap-1 shrink-0">
                                <CheckCircleIcon size={13} weight="bold" /> Auto-filled
                            </span>
                        </div>
                    ) : (
                        <div className="relative" ref={dropdownRef}>
                            <div className="relative">
                                <MagnifyingGlassIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted shrink-0" />
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
                                    className={`${field.input} pr-8`}
                                />
                                {loadingUsers && (
                                    <CircleNotchIcon size={13} className="animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-km-link" />
                                )}
                                {userSearchQuery && !loadingUsers && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setUserSearchQuery('');
                                            setIsDropdownOpen(false);
                                        }}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-km-text-muted hover:text-km-text-secondary p-0.5"
                                    >
                                        <XIcon size={11} weight="bold" />
                                    </button>
                                )}
                            </div>

                            {/* Suggestions Dropdown - shows only when typing matching letters */}
                            {isDropdownOpen && !loadingUsers && filteredUsers.length > 0 && (
                                <div className="absolute z-50 left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-km-surface-card border border-km-border rounded-xl shadow-sm divide-y divide-km-border-subtle">
                                    {filteredUsers.map((u) => (
                                        <button
                                            key={u.id}
                                            type="button"
                                            onMouseDown={(e) => {
                                                e.preventDefault();
                                                handleSelectUser(u);
                                            }}
                                            className="w-full px-3 py-2 text-left hover:bg-km-surface transition-colors flex items-center justify-between gap-2 cursor-pointer group"
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-6 h-6 rounded-full bg-km-surface text-km-text-secondary font-bold text-xs flex items-center justify-center shrink-0 group-hover:bg-km-surface group-hover:text-km-link transition-colors">
                                                    {u.name.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-xs font-semibold text-km-heading truncate">
                                                        {u.name}
                                                    </p>
                                                    <p className="text-xs text-km-text-secondary truncate">
                                                        {[u.email, u.mobile].filter(Boolean).join(' · ') || 'No contact info'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {u.roles?.map((r) => (
                                                    <span key={r} className="text-xs font-bold px-1.5 py-0.2 rounded bg-km-surface text-km-text-secondary">
                                                        {r}
                                                    </span>
                                                ))}
                                                <span className="text-xs font-bold text-km-link opacity-0 group-hover:opacity-100 transition-opacity ml-1">
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
                    <p className="text-xs font-bold text-km-text-muted flex items-center gap-1.5">
                        <BuildingOfficeIcon size={14} weight="bold" /> Company Details
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
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
                                <GlobeIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted" />
                                <input
                                    type="url"
                                    placeholder="https://acme.com"
                                    value={website}
                                    onChange={(e) => setWebsite(e.target.value)}
                                    className={`${field.input} pr-3`}
                                />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className={field.label}>GSTIN / Tax ID</label>
                        <input
                            type="text"
                            placeholder="e.g. 27ABCDE1234F1Z5"
                            value={gst}
                            onChange={(e) => setGst(e.target.value)}
                            className={`${field.input} font-inter`}
                        />
                    </div>
                </div>

                {/* Recruiter Contact Section */}
                <div className="pt-2 border-t border-km-border-subtle space-y-2.5">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-km-text-muted flex items-center gap-1.5">
                            <UserIcon size={14} weight="bold" /> Recruiter / HR Contact
                        </p>
                        {selectedUser && (
                            <span className="text-xs sm:text-xs font-semibold text-km-link flex items-center gap-1">
                                <UserCheckIcon size={12} weight="bold" /> From {selectedUser.name}
                            </span>
                        )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                        <div>
                            <label className={field.label}>Recruiter name</label>
                            <input
                                type="text"
                                placeholder="For example: Priya Sharma"
                                value={recruiterName}
                                onChange={(e) => setRecruiterName(e.target.value)}
                                className={`w-full h-9 px-3 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-km-blue/20 transition-all ${
 selectedUser
 ?'bg-km-surface  border border-km-border '
                                        : 'bg-km-surface  border border-km-border  focus:bg-km-surface-card '
                                }`}
                            />
                        </div>

                        <div>
                            <label className={field.label}>Designation</label>
                            <input
                                type="text"
                                placeholder="For example: HR manager"
                                value={designation}
                                onChange={(e) => setDesignation(e.target.value)}
                                className={`w-full h-9 px-3 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-km-blue/20 transition-all ${
 selectedUser
 ?'bg-km-surface  border border-km-border '
                                        : 'bg-km-surface  border border-km-border  focus:bg-km-surface-card '
                                }`}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                        <div>
                            <label className={field.label}>Work email</label>
                            <input
                                type="email"
                                placeholder="recruiter@acme.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className={`w-full h-9 px-3 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-km-blue/20 transition-all ${
 selectedUser
 ?'bg-km-surface  border border-km-border '
                                        : 'bg-km-surface  border border-km-border  focus:bg-km-surface-card '
                                }`}
                            />
                        </div>

                        <div>
                            <label className={field.label}>Mobile number</label>
                            <div className="relative">
                                <PhoneIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted" />
                                <input
                                    type="tel"
                                    placeholder="9876543210"
                                    value={mobile}
                                    onChange={(e) => setMobile(e.target.value)}
                                    className={`w-full h-9 pl-8.5 pr-3 rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-km-blue/20 transition-all ${
 selectedUser
 ?'bg-km-surface  border border-km-border '
                                            : 'bg-km-surface  border border-km-border  focus:bg-km-surface-card '
                                    }`}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Verification Status Choice - Slim, single-line, uniform buttons */}
                <div className="pt-2 border-t border-km-border-subtle space-y-1.5">
                    <label className={field.label}>Initial verification status</label>
                    <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
                        {STATUS_CHOICES.map((item) => {
                            const isSelected = initialStatus === item.id;
                            return (
                                <button
                                    key={item.id}
                                    type="button"
                                    onClick={() => setInitialStatus(item.id)}
                                    className={`h-9 px-2 text-xs sm:text-xs font-semibold rounded-xl border transition-all flex items-center justify-center text-center cursor-pointer whitespace-nowrap ${
 isSelected
 ?'bg-km-primary text-white border-km-blue shadow-sm'
                                            : 'bg-km-surface  text-km-text-secondary  border-km-border  hover:border-km-border '
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
                <div className="pt-2.5 border-t border-km-border-subtle flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={handleClose}
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
                                <CircleNotchIcon size={14} weight="bold" className="animate-spin" />
                                <span>Adding</span>
                            </>
                        ) : (
                            <>
                                <CheckCircleIcon size={14} weight="bold" />
                                <span>Create company</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
};

export default AddCompanyModal;
