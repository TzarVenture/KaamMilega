'use client';

import React, { useState, useEffect } from 'react';
import { Search, Trash2, Loader2, MoreVertical } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import CityModal from '@/components/modals/admin/CityModal';
import Pagination from '@/components/ui/Pagination';
import api from '@/lib/axios';

interface City {
    id: string;
    name: string;
    state?: string;
    country?: string;
    vacancies?: string; // Placeholder until backend supports it
}

export default function CitiesPage() {
    const [cities, setCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedCity, setSelectedCity] = useState<City | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [activeActionMenu, setActiveActionMenu] = useState<string | null>(null);

    const fetchCities = async () => {
        setIsLoading(true);
        try {
            const response: any = await api.get(`/cities`); // Currently fetching all
            const citiesData = Array.isArray(response) ? response : (response.data || []);

            const mappedCities = citiesData.map((city: any) => ({
                id: city.id,
                name: city.name,
                state: city.state,
                country: city.country,
                vacancies: 'N/A' // Placeholder
            }));

            // Client-side pagination/search
            let filtered = mappedCities;
            if (searchTerm) {
                filtered = mappedCities.filter((c: any) =>
                    c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    (c.state && c.state.toLowerCase().includes(searchTerm.toLowerCase()))
                );
            }
            // Simple pagination slice
            const startIndex = (currentPage - 1) * 10;
            const endIndex = startIndex + 10;
            const paginated = filtered.slice(startIndex, endIndex);

            setCities(paginated);
            setTotalPages(Math.ceil(filtered.length / 10));
        } catch (error) {
            console.error('Failed to fetch cities:', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        const delaySearch = setTimeout(() => {
            fetchCities();
        }, 500);
        return () => clearTimeout(delaySearch);
    }, [currentPage, searchTerm]);

    const handleAdd = () => {
        setSelectedCity(null);
        setIsModalOpen(true);
    };

    const handleEdit = (city: City) => {
        setSelectedCity(city);
        setIsModalOpen(true);
        setActiveActionMenu(null);
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('Are you sure you want to remove this city?')) {
            try {
                await api.delete(`/cities/${id}`);
                fetchCities();
            } catch (error) {
                console.error('Failed to delete city:', error);
            }
        }
        setActiveActionMenu(null);
    };

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Header section as per design */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white px-6 sm:px-8 py-4 rounded-[20px] shadow-sm border border-purple-50">
                <h1 className="text-xl font-bold text-purple-800">All City</h1>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="relative">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Find city"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full sm:w-64 pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/10 focus:border-purple-200 transition-all"
                        />
                    </div>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleAdd}
                        className="px-6 py-2.5 bg-purple-600 text-white font-bold rounded-xl shadow-lg shadow-purple-600/20 hover:bg-purple-700 transition-all text-sm"
                    >
                        Add City
                    </motion.button>
                </div>
            </div>

            <div className="bg-white rounded-[24px] shadow-sm border border-purple-50 overflow-hidden">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-50">
                            <th className="px-8 py-5 text-left text-sm font-bold text-slate-400 uppercase tracking-wider">City Name</th>
                            <th className="px-8 py-5 text-left text-sm font-bold text-slate-400 uppercase tracking-wider">State</th>
                            <th className="px-8 py-5 text-left text-sm font-bold text-slate-400 uppercase tracking-wider">Country</th>
                            {/* <th className="px-8 py-5 text-left text-sm font-bold text-slate-400 uppercase tracking-wider">Vacancies</th> */}
                            <th className="px-8 py-5 text-right text-sm font-bold text-slate-400 uppercase tracking-wider"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {isLoading ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-20 text-center">
                                    <div className="flex flex-col items-center gap-3">
                                        <Loader2 className="w-10 h-10 text-purple-600 animate-spin" />
                                        <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Updating inventory</p>
                                    </div>
                                </td>
                            </tr>
                        ) : cities.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="px-8 py-20 text-center">
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-3xl">🏙️</div>
                                        <p className="text-slate-500 font-medium">No cities found.</p>
                                    </div>
                                </td>
                            </tr>
                        ) : (
                            cities.map((city) => (
                                <tr key={city.id} className="hover:bg-slate-50/50 transition-colors group">
                                    <td className="px-8 py-5">
                                        <span className="text-base font-bold text-slate-900">{city.name}</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-sm font-medium text-slate-500">{city.state || '-'}</span>
                                    </td>
                                    <td className="px-8 py-5">
                                        <span className="text-sm font-medium text-slate-500">{city.country || '-'}</span>
                                    </td>
                                    {/* <td className="px-8 py-5">
                                        <span className="text-sm font-medium text-slate-400">{city.vacancies}</span>
                                    </td> */}
                                    <td className="px-8 py-5 text-right relative">
                                        <button
                                            onClick={() => setActiveActionMenu(activeActionMenu === city.id ? null : city.id)}
                                            className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-all"
                                        >
                                            <MoreVertical size={20} />
                                        </button>

                                        <AnimatePresence>
                                            {activeActionMenu === city.id && (
                                                <>
                                                    <div
                                                        className="fixed inset-0 z-10"
                                                        onClick={() => setActiveActionMenu(null)}
                                                    />
                                                    <motion.div
                                                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                                        className="absolute right-8 top-14 w-40 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden"
                                                    >
                                                        <button
                                                            onClick={() => handleEdit(city)}
                                                            className="w-full px-4 py-3 text-left text-sm font-bold text-slate-600 hover:bg-purple-50 hover:text-purple-600 flex items-center gap-2 transition-colors"
                                                        >
                                                            Edit City
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(city.id)}
                                                            className="w-full px-4 py-3 text-left text-sm font-bold text-red-600 hover:bg-red-50 flex items-center gap-2 transition-colors border-t border-slate-50"
                                                        >
                                                            <Trash2 size={16} />
                                                            Remove City
                                                        </button>
                                                    </motion.div>
                                                </>
                                            )}
                                        </AnimatePresence>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>

                {totalPages > 1 && (
                    <div className="flex justify-center py-8 border-t border-slate-50">
                        <Pagination
                            current={currentPage}
                            total={totalPages}
                            onPageChange={setCurrentPage}
                        />
                    </div>
                )}
            </div>

            <CityModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onSuccess={fetchCities}
                city={selectedCity}
            />
        </div>
    );
}

