'use client';

import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { Shield, Building2, User, Check, Loader2 } from 'lucide-react';

interface UserRoleModalProps {
    isOpen: boolean;
    onClose: () => void;
    user: {
        id: string;
        name: string;
        mobile?: string;
        roles?: string[];
    } | null;
    onSaveRoles: (userId: string, newRoles: string[]) => Promise<void>;
}

const AVAILABLE_ROLES = [
    {
        id: 'admin',
        title: 'Platform Administrator',
        description: 'Full platform access: moderate vacancies, verify companies, and manage all users.',
        icon: Shield,
        color: 'text-purple-600 bg-purple-50 border-purple-200'
    },
    {
        id: 'recruiter',
        title: 'Recruiter / Employer',
        description: 'Can post vacancies, inspect applicant resumes, and manage company profile.',
        icon: Building2,
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
    },
    {
        id: 'user',
        title: 'Job Seeker / Candidate',
        description: 'Standard account: can browse jobs, apply to vacancies, and create profile.',
        icon: User,
        color: 'text-blue-600 bg-blue-50 border-blue-200'
    }
];

const UserRoleModal = ({ isOpen, onClose, user, onSaveRoles }: UserRoleModalProps) => {
    const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (user && user.roles) {
            setSelectedRoles(user.roles);
        } else {
            setSelectedRoles(['user']);
        }
    }, [user, isOpen]);

    const toggleRole = (roleId: string) => {
        setSelectedRoles(prev => {
            if (prev.includes(roleId)) {
                // Keep at least one role
                if (prev.length <= 1) return prev;
                return prev.filter(r => r !== roleId);
            } else {
                return [...prev, roleId];
            }
        });
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        setIsSaving(true);
        try {
            await onSaveRoles(user.id, selectedRoles);
            onClose();
        } catch (error) {
            console.error('Failed to update roles:', error);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={`Manage Access — ${user?.name || 'User'}`}
        >
            <form onSubmit={handleSave} className="space-y-6">
                <div>
                    <p className="text-xs text-slate-500 font-medium mb-4">
                        Select one or multiple access roles for this account. Changes apply immediately upon saving.
                    </p>

                    <div className="space-y-3">
                        {AVAILABLE_ROLES.map((role) => {
                            const isSelected = selectedRoles.includes(role.id);
                            const Icon = role.icon;

                            return (
                                <button
                                    key={role.id}
                                    type="button"
                                    onClick={() => toggleRole(role.id)}
                                    className={`w-full p-4 rounded-2xl border text-left transition-all flex items-start justify-between gap-4 ${isSelected
                                        ? 'bg-purple-50/50 border-purple-300 ring-2 ring-purple-500/10'
                                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/50'
                                    }`}
                                >
                                    <div className="flex items-start gap-3.5">
                                        <div className={`p-2.5 rounded-xl border shrink-0 ${role.color}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-slate-900">{role.title}</h4>
                                                <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 uppercase">
                                                    {role.id}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 font-medium leading-relaxed">
                                                {role.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 transition-colors ${isSelected
                                        ? 'bg-purple-600 border-purple-600 text-white'
                                        : 'border-slate-300 bg-white'
                                    }`}>
                                        {isSelected && <Check size={14} strokeWidth={3} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className="px-5 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || selectedRoles.length === 0}
                        className="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 active:scale-95"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Updating Permissions...</span>
                            </>
                        ) : (
                            <span>Save Permissions</span>
                        )}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default UserRoleModal;
