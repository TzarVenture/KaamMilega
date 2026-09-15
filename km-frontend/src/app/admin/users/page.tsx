'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, MoreVertical, Edit, UserPlus, Mail, Shield, Zap, Users, Building2, User, Loader2, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import UserProfileModal from '@/components/modals/admin/UserProfileModal';
import UserRoleModal from '@/components/modals/admin/UserRoleModal';
import api from '@/lib/axios';

interface PlatformUser {
    id: string;
    name: string;
    firstName?: string;
    lastName?: string;
    mobile?: string;
    email?: string;
    designation: string;
    roles: string[];
    lastActive: string;
    dateAdded: string;
    status: string;
}

export default function UsersPage() {
    const [users, setUsers] = useState<PlatformUser[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const pageSize = 10;

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
                const roles: string[] = Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : ['user'];

                return {
                    id: u.id,
                    name,
                    firstName: u.first_name || name.split(' ')[0] || '',
                    lastName: u.last_name || name.split(' ').slice(1).join(' ') || '',
                    mobile: u.mobile || '',
                    email: u.email || '',
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
            toast.error('Failed to load platform users');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter users
    const filteredUsers = users.filter((u) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
            u.name.toLowerCase().includes(q) ||
            (u.mobile && u.mobile.includes(q)) ||
            (u.email && u.email.toLowerCase().includes(q)) ||
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

    const handleAddUser = () => {
        setModalMode('add');
        setSelectedUser(null);
        setIsProfileModalOpen(true);
    };

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
            await api.patch(`/admin/users/${userId}/roles`, { roles: newRoles });
            setUsers(prev => prev.map(u => u.id === userId ? { ...u, roles: newRoles } : u));
            toast.success('User access permissions updated successfully!');
        } catch (error: any) {
            console.error('Failed to update roles:', error);
            toast.error(error.response?.data?.error || 'Failed to update roles');
            throw error;
        }
    };

    // Save profile via API
    const handleSaveUser = async (data: any) => {
        if (!selectedUser) {
            toast.info('New user invitations are dispatched via phone authentication.');
            setIsProfileModalOpen(false);
            return;
        }

        try {
            const updates = {
                name: `${data.firstName} ${data.lastName}`.trim(),
                first_name: data.firstName,
                last_name: data.lastName,
                headline: data.headline,
                additional_name: data.additionalName,
                pronouns: data.pronouns
            };

            await api.patch(`/admin/users/${selectedUser.id}`, updates);
            setUsers(prev => prev.map(u => u.id === selectedUser.id ? { ...u, ...updates } : u));
            toast.success('User profile updated successfully!');
        } catch (error: any) {
            console.error('Failed to update user profile:', error);
            toast.error(error.response?.data?.error || 'Failed to update profile');
        } finally {
            setIsProfileModalOpen(false);
        }
    };

    return (
        <div className="space-y-8">
            {/* Modals */}
            <UserProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                mode={modalMode}
                userData={selectedUser ? {
                    firstName: selectedUser.firstName || '',
                    lastName: selectedUser.lastName || '',
                    headline: selectedUser.designation || ''
                } : undefined}
                onSave={handleSaveUser}
            />

            <UserRoleModal
                isOpen={isRoleModalOpen}
                onClose={() => setIsRoleModalOpen(false)}
                user={selectedUser}
                onSaveRoles={handleSaveRoles}
            />

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: 'Total Registered', value: totalUsersCount.toString(), icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { label: 'Platform Admins', value: adminCount.toString(), icon: Shield, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                    { label: 'Verified Employers', value: recruiterCount.toString(), icon: Building2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Active Candidates', value: candidateCount.toString(), icon: User, color: 'text-blue-600', bg: 'bg-blue-50' },
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        key={stat.label}
                        className="p-6 bg-white rounded-3xl border border-purple-50 shadow-sm hover:border-purple-200 transition-all group"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                            </div>
                            <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl`}>
                                <stat.icon size={20} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Page Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-900 to-indigo-700 bg-clip-text text-transparent">User Directory & Governance</h1>
                    <p className="text-sm text-slate-500 mt-1 font-medium">Manage user identities, access roles, and permissions</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative group flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Search by name, mobile, role..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                            className="w-full sm:w-80 pl-11 pr-4 py-2.5 bg-white border border-purple-100 rounded-2xl text-sm focus:outline-none focus:border-purple-300 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleAddUser}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all"
                        >
                            <UserPlus size={18} />
                            <span>Add User</span>
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[32px] border border-purple-50 shadow-sm overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-purple-50 bg-slate-50/50">
                                <th className="px-8 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider">User Identity</th>
                                <th className="px-8 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider">Active Roles</th>
                                <th className="px-8 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider">Access Control</th>
                                <th className="px-8 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider">Registered</th>
                                <th className="px-8 py-5 text-[12px] font-bold text-slate-600 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50/50">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-16 text-center text-slate-500">
                                        <Loader2 className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
                                        <p className="text-sm font-medium">Loading platform users...</p>
                                    </td>
                                </tr>
                            ) : paginatedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-8 py-16 text-center text-slate-500">
                                        <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                                        <h4 className="text-base font-bold text-slate-700">No Users Found</h4>
                                        <p className="text-xs text-slate-400 mt-1">Try refining your search query.</p>
                                    </td>
                                </tr>
                            ) : (
                                paginatedUsers.map((user, i) => (
                                    <motion.tr
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: i * 0.03 }}
                                        key={user.id}
                                        className="hover:bg-purple-50/30 transition-colors group cursor-default"
                                    >
                                        <td className="px-8 py-5">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center shrink-0 border border-purple-100 text-purple-700 font-bold text-sm">
                                                    {user.name.substring(0, 1).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 className="text-sm font-bold text-slate-900 leading-tight group-hover:text-purple-700 transition-colors">
                                                        {user.name}
                                                    </h4>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {user.mobile && (
                                                            <p className="text-xs font-mono text-slate-500 font-semibold">{user.mobile}</p>
                                                        )}
                                                        {user.designation && (
                                                            <>
                                                                <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                                <p className="text-xs text-slate-400 font-medium truncate max-w-[180px]">{user.designation}</p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                {user.roles.map((role) => (
                                                    <span
                                                        key={role}
                                                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg uppercase tracking-wider border ${role === 'admin'
                                                            ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                            : role === 'recruiter'
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                            : 'bg-blue-50 text-blue-700 border-blue-200'
                                                        }`}
                                                    >
                                                        {role}
                                                    </span>
                                                ))}
                                            </div>
                                        </td>
                                        <td className="px-8 py-5">
                                            <button
                                                onClick={() => handleOpenRoleModal(user)}
                                                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-purple-200 text-purple-700 hover:bg-purple-600 hover:text-white rounded-xl text-xs font-bold transition-all active:scale-95"
                                            >
                                                <Shield size={13} />
                                                <span>Manage Access</span>
                                            </button>
                                        </td>
                                        <td className="px-8 py-5">
                                            <p className="text-xs font-semibold text-slate-700">{user.dateAdded}</p>
                                            <p className="text-[11px] text-slate-400 mt-0.5">Active: {user.lastActive}</p>
                                        </td>
                                        <td className="px-8 py-5 text-right">
                                            <button
                                                onClick={() => handleEditUser(user)}
                                                className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all border border-transparent hover:border-purple-100"
                                                title="Edit Profile"
                                            >
                                                <Edit size={16} />
                                            </button>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="px-8 py-6 bg-slate-50/50 border-t border-purple-50 flex items-center justify-between">
                        <p className="text-xs text-slate-500 font-medium">
                            Showing <span className="font-bold text-slate-900">{((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, filteredUsers.length)}</span> of <span className="font-bold text-slate-900">{filteredUsers.length}</span> users
                        </p>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-purple-50 bg-white border border-purple-100 rounded-xl disabled:opacity-40 transition-colors"
                            >
                                Prev
                            </button>
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPage(p)}
                                    className={`w-8 h-8 flex items-center justify-center rounded-xl font-bold text-xs border transition-colors ${p === page
                                        ? 'bg-purple-600 text-white border-purple-600'
                                        : 'text-slate-600 hover:bg-purple-50 bg-white border-purple-100'
                                    }`}
                                >
                                    {p}
                                </button>
                            ))}
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page === totalPages}
                                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-purple-50 bg-white border border-purple-100 rounded-xl disabled:opacity-40 transition-colors"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
