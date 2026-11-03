'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { ArrowsClockwiseIcon, CheckCircleIcon, CircleNotchIcon, DatabaseIcon, PencilSimpleIcon, PlusIcon, TagIcon, TrashIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { AdminPageHeader, AdminPanel, ConfirmDialog, EmptyState, FilterTabs, SearchInput, SkeletonRows, btn, table } from '@/components/admin/ui';
import api from '@/lib/axios';
import ProfessionModal from '@/components/modals/admin/ProfessionModal';
import { errorText } from "@/lib/notify";

interface Skill {
    id: string;
    name: string;
    category?: string;
    created_at?: string;
    updated_at?: string;
}


export default function ProfessionsPage() {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [categories, setCategories] = useState<string[]>([]);
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isSeeding, setIsSeeding] = useState<boolean>(false);
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Skill | null>(null);
    const [statusBanner, setStatusBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

    // Fetch skills and categories from live backend
    const fetchData = async () => {
        setIsLoading(true);
        try {
            const [skillsRes, catsRes] = await Promise.all([
                api.get('/skills'),
                api.get('/skills/categories')
            ]);

            const skillsData = Array.isArray(skillsRes) ? skillsRes : ((skillsRes as any)?.data || []);
            const catsData = Array.isArray(catsRes) ? catsRes : ((catsRes as any)?.data || []);

            setSkills(skillsData);
            setCategories(catsData);
        } catch (error) {
            console.error('Failed to fetch skill catalog:', error);
            setStatusBanner({
                type: 'error',
                message: "Couldn't load professions."
            });
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // Filter skills by category & search term
    const filteredSkills = useMemo(() => {
        return skills.filter((item) => {
            const matchesCategory =
                selectedCategory === 'All' ||
                (item.category || 'General').toLowerCase() === selectedCategory.toLowerCase();

            const matchesSearch =
                !searchTerm.trim() ||
                item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (item.category || '').toLowerCase().includes(searchTerm.toLowerCase());

            return matchesCategory && matchesSearch;
        });
    }, [skills, selectedCategory, searchTerm]);

    // Handle Create or Update
    const handleSaveProfession = async (data: { id?: string; name: string; category: string }) => {
        try {
            if (data.id) {
                // Update
                await api.patch(`/skills/${data.id}`, {
                    name: data.name,
                    category: data.category
                });
                setSkills((prev) =>
                    prev.map((s) => (s.id === data.id ? { ...s, name: data.name, category: data.category } : s))
                );
                setStatusBanner({
                    type: 'success',
                    message: `${data.name} updated.`
                });
            } else {
                // Create
                const res: any = await api.post('/skills', {
                    name: data.name,
                    category: data.category
                });
                const newSkill = res?.data || res;
                setSkills((prev) => [newSkill, ...prev]);
                if (data.category && !categories.includes(data.category)) {
                    setCategories((prev) => [...prev, data.category]);
                }
                setStatusBanner({
                    type: 'success',
                    message: `${data.name} added.`
                });
            }
            setIsModalOpen(false);
            setEditingSkill(null);
        } catch (error: any) {
            console.error('Save failed:', error);
            const msg = errorText(error, 'Failed to save profession');
            setStatusBanner({ type: 'error', message: msg });
            throw error;
        }
    };

    // Handle Delete
    const handleDeleteSkill = async (id: string, name: string) => {

        setDeletingId(id);
        try {
            await api.delete(`/skills/${id}`);
            setSkills((prev) => prev.filter((s) => s.id !== id));
            setStatusBanner({
                type: 'success',
                message: `${name} deleted.`
            });
        } catch (error: any) {
            console.error('Delete failed:', error);
            setStatusBanner({
                type: 'error',
                message: errorText(error, 'Failed to delete profession.')
            });
        } finally {
            setDeletingId(null);
        }
    };

    // Handle Seed default catalog
    const handleSeedCatalog = async () => {
        setIsSeeding(true);
        try {
            const res: any = await api.post('/skills/seed');
            setStatusBanner({
                type: 'success',
                message: res?.message || 'Standard list added.'
            });
            await fetchData();
        } catch (error: any) {
            console.error('Seed failed:', error);
            setStatusBanner({
                type: 'error',
                message: errorText(error, 'Failed to seed catalog.')
            });
        } finally {
            setIsSeeding(false);
        }
    };

    const openCreateModal = () => {
        setEditingSkill(null);
        setIsModalOpen(true);
    };

    const openEditModal = (skill: Skill) => {
        setEditingSkill(skill);
        setIsModalOpen(true);
    };

    return (
        <div>
            <ProfessionModal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    setEditingSkill(null);
                }}
                onSave={handleSaveProfession}
                categories={categories}
                initialData={editingSkill ? { id: editingSkill.id, name: editingSkill.name, category: editingSkill.category } : undefined}
            />

            <AdminPageHeader
                title="Professions"
                description="Skills and trades people pick on their profiles and jobs"
                actions={
                    <>
                        <button type="button" onClick={fetchData} disabled={isLoading} className={btn.icon} aria-label="Refresh">
                            <ArrowsClockwiseIcon size={18} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
                        </button>
                        {skills.length === 0 && !isLoading && (
                            <button type="button" onClick={handleSeedCatalog} disabled={isSeeding} className={btn.secondary}>
                                <DatabaseIcon size={16} aria-hidden="true" />
                                {isSeeding ? 'Adding' : 'Add standard list'}
                            </button>
                        )}
                        <button type="button" onClick={openCreateModal} className={btn.primary}>
                            <PlusIcon size={16} weight="bold" aria-hidden="true" />
                            Add profession
                        </button>
                    </>
                }
            />

            {statusBanner && (
                <div
                    role={statusBanner.type === 'error' ? 'alert' : 'status'}
                    className={`mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${
                        statusBanner.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
                    }`}
                >
                    <span className="flex items-center gap-2">
                        {statusBanner.type === 'success'
                            ? <CheckCircleIcon size={18} className="text-emerald-600 shrink-0" aria-hidden="true" />
                            : <WarningCircleIcon size={18} className="text-red-600 shrink-0" aria-hidden="true" />}
                        {statusBanner.message}
                    </span>
                    <button type="button" onClick={() => setStatusBanner(null)} className="text-sm font-medium hover:underline cursor-pointer">Dismiss</button>
                </div>
            )}

            <AdminPanel>
                <div className="flex flex-col gap-3 px-5 py-4 border-b border-km-border-subtle">
                    <div className="flex items-center justify-between gap-3">
                        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search skill or category" className="w-full sm:max-w-sm" />
                        <span className="hidden sm:inline text-sm text-km-text-secondary font-inter">{filteredSkills.length} of {skills.length}</span>
                    </div>
                    {categories.length > 0 && (
                        <div className="overflow-x-auto -mx-1 px-1">
                            <FilterTabs
                                value={selectedCategory}
                                onChange={setSelectedCategory}
                                options={[
                                    { value: 'All', label: 'All', count: skills.length },
                                    ...categories.map((cat) => ({
                                        value: cat,
                                        label: cat,
                                        count: skills.filter((s) => (s.category || 'General').toLowerCase() === cat.toLowerCase()).length,
                                    })),
                                ]}
                            />
                        </div>
                    )}
                </div>

                {isLoading ? (
                    <SkeletonRows rows={6} />
                ) : filteredSkills.length === 0 ? (
                    <EmptyState
                        icon={TagIcon}
                        title={skills.length === 0 ? 'No professions yet' : 'No matches'}
                        description={skills.length === 0 ? 'Add the standard list or your first profession.' : 'Try a different search or category.'}
                    />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Profession</th>
                                    <th className={table.th}>Category</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredSkills.map((skill) => (
                                    <tr key={skill.id} className={table.row}>
                                        <td className={`${table.td} font-medium text-km-heading`}>{skill.name}</td>
                                        <td className={`${table.td} text-km-text-secondary`}>{skill.category || 'General'}</td>
                                        <td className={`${table.td} text-right whitespace-nowrap`}>
                                            <button type="button" onClick={() => openEditModal(skill)} className={btn.icon} aria-label={`Edit ${skill.name}`}>
                                                <PencilSimpleIcon size={18} aria-hidden="true" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setDeleteTarget(skill)}
                                                disabled={deletingId === skill.id}
                                                className={`${btn.icon} hover:text-red-600`}
                                                aria-label={`Delete ${skill.name}`}
                                            >
                                                {deletingId === skill.id
                                                    ? <CircleNotchIcon size={18} className="animate-spin" aria-hidden="true" />
                                                    : <TrashIcon size={18} aria-hidden="true" />}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            {deleteTarget && (
                <ConfirmDialog
                    title={`Delete ${deleteTarget.name}?`}
                    description="It's removed from the list people pick from. Profiles that already have it keep it."
                    confirmLabel="Delete profession"
                    busy={deletingId === deleteTarget.id}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={async () => {
                        await handleDeleteSkill(deleteTarget.id, deleteTarget.name);
                        setDeleteTarget(null);
                    }}
                />
            )}
        </div>
    );
}
