'use client';

import React, { useState, useEffect } from 'react';
import { AdminModal, btn } from '@/components/admin/ui';
import { CheckIcon, CircleNotchIcon, GraduationCapIcon, ShieldIcon, UserIcon } from '@phosphor-icons/react';

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
        title: 'Admin',
        description: 'Full platform access: moderate vacancies, verify companies, and manage all users.',
        icon: ShieldIcon,
        color: 'text-km-link bg-km-surface border-km-border   '
    },
    {
        id: 'expert',
        title: 'Expert',
        description: 'Can host mentorship sessions, take expert bookings, and offer career advisory.',
        icon: GraduationCapIcon,
        color: 'text-amber-600 bg-amber-50 border-amber-200   '
    },
    {
        id: 'user',
        title: 'Jobseeker',
        description: 'Standard account: can browse jobs, apply to vacancies, and create profile.',
        icon: UserIcon,
        color: 'text-blue-600 bg-blue-50 border-blue-200   '
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
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Roles for ${user?.name || 'this user'}`}
        >
            <form onSubmit={handleSave} className="space-y-6">
                <div>
                    <p className="text-xs text-km-text-secondary font-medium mb-4">
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
 ?'bg-km-surface  border-km-border  ring-2 ring-km-border'
                                        : 'bg-km-surface-card border-km-border  hover:border-km-border  hover:bg-km-surface '
                                        }`}
                                >
                                    <div className="flex items-start gap-3.5">
                                        <div className={`p-2.5 rounded-xl border shrink-0 ${role.color}`}>
                                            <Icon size={18} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-km-heading">{role.title}</h4>
                                                <span className="font-inter text-xs font-bold px-2 py-0.5 rounded-md bg-km-surface text-km-text-secondary">
                                                    {role.id}
                                                </span>
                                            </div>
                                            <p className="text-xs text-km-text-secondary mt-1 font-medium leading-relaxed">
                                                {role.description}
                                            </p>
                                        </div>
                                    </div>

                                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center border shrink-0 mt-0.5 transition-colors ${isSelected
 ?'bg-km-primary border-km-blue text-white'
                                        : 'border-km-border  bg-km-surface-card'
                                        }`}>
                                        {isSelected && <CheckIcon weight="bold" size={14} />}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-km-border-subtle">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSaving}
                        className={btn.secondary}
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving || selectedRoles.length === 0}
                        className={btn.primary}
                    >
                        {isSaving ? (
                            <>
                                <CircleNotchIcon weight="bold" size={16} className="animate-spin" />
                                <span>Saving</span>
                            </>
                        ) : (
                            <span>Save permissions</span>
                        )}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
};

export default UserRoleModal;
