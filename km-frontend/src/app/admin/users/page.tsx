'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

import { BuildingOfficeIcon, NotePencilIcon, ShieldIcon, UserIcon, UsersIcon } from '@phosphor-icons/react';
import Pagination from '@/components/ui/Pagination';
import { AdminPageHeader, AdminPanel, EmptyState, FilterTabs, SearchInput, SkeletonRows, StatCard, StatusBadge, btn, table, type BadgeTone } from '@/components/admin/ui';
import { notify } from "@/lib/notify";
import UserProfileModal from '@/components/modals/admin/UserProfileModal';
import UserRoleModal from '@/components/modals/admin/UserRoleModal';
import api from '@/lib/axios';

interface PlatformUser {
    id: string;
    name: string;
    companyName?: string;
    firstName?: string;
    lastName?: string;
    mobile?: string;
    email?: string;
    city?: string;
    about?: string;
    additionalName?: string;
    pronouns?: string;
    designation: string;
    roles: string[];
    lastActive: string;
    dateAdded: string;
    status: string;
}

function UsersContent() {
    const searchParams = useSearchParams();
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [roleFilter, setRoleFilter] = useState(searchParams.get('role') || 'all');
    const [page, setPage] = useState(1);
    const pageSize = 10;

    useEffect(() => {
        const q = searchParams.get('search');
        if (q !== null) {
            setSearchQuery(q);
        }
    }, [searchParams]);

    // Modals
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
    const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const response = await api.get('/admin/users');
            const data = (response as unknown as any[]) || [];
            const mappedUsers: PlatformUser[] = data.map((u: any) => {
                const name = u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'KaamMilega User';
                const rawRoles: string[] = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : ['user'];
                
                // Recruiter role is strictly restricted to users associated with a company in /admin/companies
                const hasCompany = Boolean(u.company_name && u.company_name.trim());
                let roles = rawRoles.filter(r => r.toLowerCase() !== 'recruiter' || hasCompany);
                if (roles.length === 0) {
                    roles = ['user'];
                }

                return {
                    id: u.id,
                    name,
                    companyName: u.company_name || '',
                    firstName: u.first_name || name.split(' ')[0] || '',
                    lastName: u.last_name || name.split(' ').slice(1).join(' ') || '',
                    mobile: u.mobile || '',
                    email: u.email || '',
                    city: u.city || '',
                    about: u.about || '',
                    additionalName: u.additional_name || '',
                    pronouns: u.pronouns || '',
                    designation: u.headline || (roles.includes('recruiter') ? 'Recruiter' : roles.includes('admin') ? 'System Admin' : 'Job Seeker'),
                    roles,
                    lastActive: u.otp_verified_at ? new Date(u.otp_verified_at).toLocaleDateString() : 'Never',
                    dateAdded: u.created_at ? new Date(u.created_at).toLocaleDateString() : 'Recent',
                    status: u.otp_verified_at ? 'Active' : 'Unverified'
                };
            });
            setUsers(mappedUsers);
        } catch (error) {
            console.error('Failed to fetch users:', error);
            notify.error("Couldn't load users");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users
    const filteredUsers = users.filter((u) => {
        if (roleFilter !== 'all' && !u.roles.includes(roleFilter)) return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            u.name.toLowerCase().includes(q) ||
            (u.mobile && u.mobile.includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
            (u.city && u.city.toLowerCase().includes(q)) ||
            u.designation.toLowerCase().includes(q) ||
            u.roles.some(r => r.toLowerCase().includes(q))
        );
    });

    const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
    const paginatedUsers = filteredUsers.slice((page - 1) * pageSize, page * pageSize);

    // Dynamic stats
    const totalUsersCount = users.length;
    const adminCount = users.filter(u => u.roles.includes('admin')).length;
    const recruiterCount = users.filter(u => u.roles.includes('recruiter')).length;
    const candidateCount = users.filter(u => !u.roles.includes('admin') && !u.roles.includes('recruiter')).length;

    const handleEditUser = (user: PlatformUser) => {
        setModalMode('edit');
        setSelectedUser(user);
        setIsProfileModalOpen(true);
    };

    const handleOpenRoleModal = (user: PlatformUser) => {
        setSelectedUser(user);
        setIsRoleModalOpen(true);
    };

    // Save roles via API
    const handleSaveRoles = async (userId: string, newRoles: string[]) => {
        try {
            const target = users.find(u => u.id === userId);
            const hasCompany = Boolean(target?.companyName && target.companyName.trim());
            const sanitizedRoles = newRoles.filter(r => r.toLowerCase() !== 'recruiter' || hasCompany);
            await api.patch(`/admin/users/${userId}/roles`, { roles: sanitizedRoles });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: sanitizedRoles } : u));
            notify.success('Roles updated');
        } catch (error: any) {
            console.error('Failed to update roles:', error);
            notify.error(error, "Couldn't update roles");
            throw error;
        }
    };

    // Save profile via API
    const handleSaveUser = async (data: any) => {
        if (!selectedUser) {
            notify.info('People join by signing in with their phone number.');
            setIsProfileModalOpen(false);
            return;
        }

        try {
            const updates: Record<string, any> = {
                city: data.city?.trim() || '',
                about: data.about?.trim() || '',
                ...(data.email !== undefined && { email: data.email.trim() }),
                ...(data.mobile !== undefined && { mobile: data.mobile.trim() }),
                name: `${data.firstName} ${data.lastName}`.trim(),
                first_name: data.firstName,
                last_name: data.lastName,
                headline: data.headline,
                additional_name: data.additionalName,
                pronouns: data.pronouns
            };

            await api.patch(`/admin/users/${selectedUser.id}`, updates);
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { 
                ...u, 
                ...updates,
                firstName: data.firstName,
                lastName: data.lastName,
                designation: data.headline,
                email: updates.email !== undefined ? updates.email : u.email,
                mobile: updates.mobile !== undefined ? updates.mobile : u.mobile,
                city: updates.city,
                about: updates.about
            } : u));
            notify.success('Profile updated');
        } catch (error: any) {
            console.error('Failed to update user profile:', error);
            notify.error(error, "Couldn't update the profile");
        } finally {
            setIsProfileModalOpen(false);
        }
    };

    return (
        <div>
            {/* Modals */}
            <UserProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                mode={modalMode}
                userData={selectedUser ? {
                    firstName: selectedUser.firstName || '',
                    lastName: selectedUser.lastName || '',
                    headline: selectedUser.designation || '',
                    additionalName: selectedUser.additionalName || '',
                    pronouns: selectedUser.pronouns || '',
                    email: selectedUser.email || '',
                    mobile: selectedUser.mobile || '',
                    city: selectedUser.city || '',
                    about: selectedUser.about || '',
                } : undefined}
                onSave={handleSaveUser}
            />

            <UserRoleModal
                isOpen={isRoleModalOpen}
                onClose={() => setIsRoleModalOpen(false)}
                user={selectedUser}
                onSaveRoles={handleSaveRoles}
            />

            <AdminPageHeader title="Users" description="Profiles, contact details and access roles" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="All users" value={isLoading ? '–' : totalUsersCount.toLocaleString('en-IN')} icon={UsersIcon} />
                <StatCard label="Jobseekers" value={isLoading ? '–' : candidateCount.toLocaleString('en-IN')} icon={UserIcon} iconClassName="text-km-jobs-text" />
                <StatCard label="Employers" value={isLoading ? '–' : recruiterCount.toLocaleString('en-IN')} icon={BuildingOfficeIcon} iconClassName="text-km-p2p-text" />
                <StatCard label="Admins" value={isLoading ? '–' : adminCount.toLocaleString('en-IN')} icon={ShieldIcon} iconClassName="text-km-text-secondary" />
            </div>

            <AdminPanel>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-km-border-subtle">
                    <FilterTabs
                        value={roleFilter}
                        onChange={(v) => { setRoleFilter(v); setPage(1); }}
                        options={[
                            { value: 'all', label: 'All' },
                            { value: 'user', label: 'Jobseekers' },
                            { value: 'recruiter', label: 'Employers' },
                            { value: 'expert', label: 'Experts' },
                            { value: 'admin', label: 'Admins' },
                        ]}
                    />
                    <SearchInput
                        value={searchQuery}
                        onChange={(v) => { setSearchQuery(v); setPage(1); }}
                        placeholder="Search name, email, mobile or city"
                        className="w-full lg:w-80"
                    />
                </div>

                {isLoading ? (
                    <SkeletonRows rows={6} />
                ) : paginatedUsers.length === 0 ? (
                    <EmptyState icon={UserIcon} title="No users found" description="Try a different search or filter." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>User</th>
                                    <th className={table.th}>Roles</th>
                                    <th className={table.th}>Joined</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedUsers.map((user) => (
                                    <tr key={user.id} className={table.row}>
                                        <td className={table.td}>
                                            <div className="flex items-center gap-3 min-w-[260px]">
                                                <span className="w-9 h-9 rounded-full bg-km-surface border border-km-border text-km-heading text-sm font-semibold flex items-center justify-center shrink-0">
                                                    {user.name.charAt(0).toUpperCase()}
                                                </span>
                                                <div className="min-w-0">
                                                    <p className="font-medium text-km-heading truncate">{user.name}</p>
                                                    <p className="text-xs text-km-text-secondary truncate max-w-[360px]">
                                                        {[user.email, user.mobile, user.city].filter(Boolean).join(' · ') || user.designation}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className={table.td}>
                                            <div className="flex flex-wrap gap-1.5">
                                                {user.roles.map((role) => (
                                                    <StatusBadge key={role} tone={ROLE_TONES[role] || 'neutral'} dot={false}>
                                                        {ROLE_LABELS[role] || role}
                                                    </StatusBadge>
                                                ))}
                                            </div>
                                        </td>
                                        <td className={`${table.td} whitespace-nowrap`}>
                                            <p className="font-inter">{user.dateAdded}</p>
                                            <p className="text-xs text-km-text-secondary">
                                                {user.status === 'Active' ? `Verified ${user.lastActive}` : 'Not verified'}
                                            </p>
                                        </td>
                                        <td className={`${table.td} text-right whitespace-nowrap`}>
                                            <button type="button" onClick={() => handleOpenRoleModal(user)} className={`${btn.ghost} h-9 px-3`}>
                                                <ShieldIcon size={16} aria-hidden="true" />
                                                Roles
                                            </button>
                                            <button type="button" onClick={() => handleEditUser(user)} className={btn.icon} aria-label={`Edit ${user.name}`}>
                                                <NotePencilIcon size={18} aria-hidden="true" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
                        <p className="text-sm text-km-text-secondary">
                            {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredUsers.length)} of {filteredUsers.length}
                        </p>
                        <Pagination current={page} total={totalPages} onPageChange={setPage} />
                    </div>
                )}
            </AdminPanel>
        </div>
    );
}

const ROLE_LABELS: Record<string, string> = { user: 'Jobseeker', recruiter: 'Employer', expert: 'Expert', admin: 'Admin' };
const ROLE_TONES: Record<string, BadgeTone> = { user: 'blue', recruiter: 'green', expert: 'amber', admin: 'neutral' };

export default function UsersPage() {
    return (
        <Suspense fallback={<SkeletonRows rows={6} />}>
            <UsersContent />
        </Suspense>
    );
}
