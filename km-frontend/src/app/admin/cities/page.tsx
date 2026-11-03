'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { MapPinIcon, PencilSimpleIcon, PlusIcon, TrashIcon } from '@phosphor-icons/react';
import CityModal from '@/components/modals/admin/CityModal';
import Pagination from '@/components/ui/Pagination';
import api from '@/lib/axios';
import { notify } from "@/lib/notify";
import { AdminPageHeader, AdminPanel, ConfirmDialog, EmptyState, MenuItem, RowMenu, SearchInput, SkeletonRows, btn, table } from '@/components/admin/ui';

interface City {
    id: string;
    name: string;
    state?: string;
    country?: string;
}

const PAGE_SIZE = 10;

export default function CitiesPage() {
    const [cities, setCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCity, setSelectedCity] = useState<City | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState<City | null>(null);
    const [deleting, setDeleting] = useState(false);

    const fetchCities = useCallback(async () => {
        setIsLoading(true);
        try {
            const response = await api.get<unknown, City[] | { data?: City[] }>('/cities');
            const list = Array.isArray(response) ? response : (response?.data || []);
            setCities(list.map((c) => ({ id: c.id, name: c.name, state: c.state, country: c.country })));
        } catch (error) {
            console.error('Failed to fetch cities:', error);
            notify.error("Couldn't load cities");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchCities(); }, [fetchCities]);

    const q = searchTerm.trim().toLowerCase();
    const filtered = q
        ? cities.filter((c) => c.name.toLowerCase().includes(q) || c.state?.toLowerCase().includes(q))
        : cities;
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

    const openModal = (city: City | null) => {
        setSelectedCity(city);
        setIsModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await api.delete(`/cities/${deleteTarget.id}`);
            setCities((prev) => prev.filter((c) => c.id !== deleteTarget.id));
            notify.success(`${deleteTarget.name} removed`);
            setDeleteTarget(null);
        } catch (error) {
            console.error('Failed to delete city:', error);
            notify.error(error, "Couldn't remove this city");
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div>
            <AdminPageHeader
                title="Cities"
                description="Cities people can pick for jobs and profiles"
                actions={
                    <button type="button" onClick={() => openModal(null)} className={btn.primary}>
                        <PlusIcon size={16} weight="bold" aria-hidden="true" />
                        Add city
                    </button>
                }
            />

            <AdminPanel>
                <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-km-border-subtle">
                    <SearchInput
                        value={searchTerm}
                        onChange={(v) => { setSearchTerm(v); setCurrentPage(1); }}
                        placeholder="Search city or state"
                        className="w-full sm:max-w-xs"
                    />
                    {!isLoading && <span className="hidden sm:inline text-sm text-km-text-secondary font-inter">{filtered.length} cities</span>}
                </div>

                {isLoading ? (
                    <SkeletonRows rows={6} />
                ) : pageItems.length === 0 ? (
                    <EmptyState icon={MapPinIcon} title="No cities found" description={q ? 'Try a different search.' : 'Add the first city.'} />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>City</th>
                                    <th className={table.th}>State</th>
                                    <th className={table.th}>Country</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {pageItems.map((city) => (
                                    <tr key={city.id} className={table.row}>
                                        <td className={`${table.td} font-medium text-km-heading`}>{city.name}</td>
                                        <td className={`${table.td} text-km-text-secondary`}>{city.state || '–'}</td>
                                        <td className={`${table.td} text-km-text-secondary`}>{city.country || '–'}</td>
                                        <td className={`${table.td} text-right`}>
                                            <RowMenu label={`Actions for ${city.name}`}>
                                                {() => (
                                                    <>
                                                        <MenuItem icon={PencilSimpleIcon} onClick={() => openModal(city)}>Edit city</MenuItem>
                                                        <MenuItem icon={TrashIcon} danger onClick={() => setDeleteTarget(city)}>Remove city</MenuItem>
                                                    </>
                                                )}
                                            </RowMenu>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-end px-5 py-4">
                        <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
                    </div>
                )}
            </AdminPanel>

            <CityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchCities}
                city={selectedCity}
            />

            {deleteTarget && (
                <ConfirmDialog
                    title={`Remove ${deleteTarget.name}?`}
                    description="People won't be able to pick this city any more. Existing jobs and profiles keep it."
                    confirmLabel="Remove city"
                    busy={deleting}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={handleDelete}
                />
            )}
        </div>
    );
}
