'use client';

import React, { useState, useEffect } from 'react';
import { Search, Filter, Plus, MoreVertical, Edit, UserPlus, Mail, Shield, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import UserProfileModal from '@/components/modals/admin/UserProfileModal';

import api from '@/lib/axios';

export default function UsersPage() {
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
    const [selectedUser, setSelectedUser] = useState<any>(null);

    useEffect(() => {
        const fetchUsers = async () => {
            try {
                const response = await api.get('/admin/users');
                const data = response as unknown as any[]; // Cast to any array because interceptor returns data
                const mappedUsers = data.map((u: any) => ({
                    id: u.id,
                    name: u.name || `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'No Name',
                    designation: u.headline || 'User',
                    lastActive: u.otp_verified_at ? new Date(u.otp_verified_at).toLocaleDateString() : 'Never',
                    dateAdded: new Date(u.created_at).toLocaleDateString(),
                    status: 'Online' // defaulting for now as we don't have real-time status
                }));
                setUsers(mappedUsers);
            } catch (error) {
                console.error("Failed to fetch users", error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchUsers();
    }, []);

    const handleAddUser = () => {
        setModalMode('add');
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleEditUser = (user: any) => {
        setModalMode('edit');
        // Map table data to modal data structure
        const firstName = user.name.split(' ')[0] || '';
        const lastName = user.name.split(' ').slice(1).join(' ') || '';
        setSelectedUser({
            firstName,
            lastName,
            headline: user.designation,
            additionalName: '',
            pronouns: ''
        });
        setIsModalOpen(true);
    };

    const handleSaveUser = (data: any) => {
        console.log('Saving user data:', data);
        // Here you would typically make an API call
        // For now, we just close the modal
        setIsModalOpen(false);
    };

    return (
        <div className="space-y-8">
            <UserProfileModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                mode={modalMode}
                userData={selectedUser}
                onSave={handleSaveUser}
            />

            {/* Quick Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {[
                    { label: 'Total Users', value: users.length.toString(), icon: UsersIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Active Now', value: '44', icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'New This Week', value: '+124', icon: UserPlus, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { label: 'Pending Verifications', value: '18', icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
                ].map((stat, i) => (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.1 }}
                        key={stat.label}
                        className="p-6 bg-white rounded-3xl border border-purple-50 shadow-sm hover:shadow-md transition-all group"
                    >
                        <div className="flex items-start justify-between">
                            <div>
                                <p className="text-sm font-medium text-slate-500 mb-1">{stat.label}</p>
                                <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
                            </div>
                            <div className={`${stat.bg} ${stat.color} p-3 rounded-2xl group-hover:scale-110 transition-transform`}>
                                <stat.icon size={22} />
                            </div>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Page Header */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-purple-900 to-indigo-700 bg-clip-text text-transparent">User Management</h1>
                    <p className="text-sm sm:text-base text-slate-500 mt-1 font-medium">Manage and monitor all platform participants</p>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative group flex-1">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                        <input
                            type="text"
                            placeholder="Find user by name, email..."
                            className="w-full sm:w-80 pl-11 pr-4 py-2.5 bg-white border border-purple-100 rounded-2xl text-sm focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-300 transition-all shadow-sm"
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 text-slate-600 bg-white border border-purple-100 rounded-2xl text-sm font-bold hover:bg-purple-50 transition-all shadow-sm active:scale-95">
                            <Filter size={18} />
                            <span>Filters</span>
                        </button>
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={handleAddUser}
                            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-purple-600 text-white rounded-2xl text-sm font-bold hover:bg-purple-700 transition-all shadow-lg shadow-purple-200"
                        >
                            <UserPlus size={18} />
                            <span>Add User</span>
                        </motion.button>
                    </div>
                </div>
            </div>

            {/* Table Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white rounded-[32px] border border-purple-50 shadow-xl shadow-purple-900/5 overflow-hidden"
            >
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-purple-50 bg-slate-50/50">
                                <th className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-wider">UserInfo</th>
                                <th className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-wider">Access Rights</th>
                                <th className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-wider">Activity Status</th>
                                <th className="px-8 py-5 text-[13px] font-bold text-slate-600 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-purple-50/50">
                            {users.map((user, i) => (
                                <motion.tr
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.05 }}
                                    key={user.id}
                                    className="hover:bg-purple-50/30 transition-colors group cursor-default"
                                >
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className="w-14 h-14 bg-gradient-to-tr from-purple-100 to-indigo-100 rounded-2xl flex items-center justify-center shrink-0 border-2 border-white shadow-sm overflow-hidden text-purple-700 font-black italic">
                                                    <span className="rotate-45 scale-125">▲▲</span>
                                                </div>
                                                {user.status === 'Online' && (
                                                    <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full"></span>
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-[15px] font-bold text-slate-900 leading-tight group-hover:text-purple-700 transition-colors">{user.name}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <p className="text-xs text-slate-500 font-medium">{user.designation}</p>
                                                    <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                                                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: USER-0{user.id}29</p>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <button className="flex items-center gap-2 px-4 py-1.5 bg-purple-50 text-purple-700 rounded-full text-xs font-bold hover:bg-purple-600 hover:text-white transition-all">
                                            <Shield size={14} />
                                            Manage Access
                                        </button>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-1.5">
                                                <span className={`w-1.5 h-1.5 rounded-full ${user.status === 'Online' ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                                                <span className="text-[13px] font-semibold text-slate-700">{user.lastActive}</span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 font-medium ml-3">Added on {user.dateAdded}</p>
                                        </div>
                                    </td>
                                    <td className="px-8 py-5">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleEditUser(user)}
                                                className="p-2.5 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all shadow-sm bg-white border border-purple-50"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all shadow-sm bg-white border border-purple-50">
                                                <MoreVertical size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </motion.tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-4 sm:px-8 py-6 bg-slate-50/50 border-t border-purple-50 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <p className="text-[13px] text-slate-500 font-medium">Showing <span className="text-slate-900 font-bold">1-7</span> of <span className="text-slate-900 font-bold">284</span> users</p>
                    <div className="flex items-center gap-2">
                        <button className="px-4 py-2 text-sm font-bold text-slate-400 hover:text-purple-700 transition-colors">Prev</button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl bg-purple-600 text-white font-bold shadow-lg shadow-purple-600/20">1</button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 font-bold hover:bg-purple-50 transition-colors">2</button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-600 font-bold hover:bg-purple-50 transition-colors">3</button>
                        <button className="px-4 py-2 text-sm font-bold text-slate-600 hover:text-purple-700 transition-colors">Next</button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}



const UsersIcon = ({ size, className }: { size?: number, className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size || 24}
        height={size || 24}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
);
