'use client';

import React, { useState, useEffect } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import api from '@/lib/axios';

interface City {
    id?: string;
    name: string;
    state?: string;
    country?: string;
}

interface CityModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    city?: City | null;
}

const CityModal = ({ isOpen, onClose, onSuccess, city }: CityModalProps) => {
    const [formData, setFormData] = useState({
        name: '',
        state: '',
        country: '',
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (city) {
            setFormData({
                name: city.name,
                state: city.state || '',
                country: city.country || '',
            });
        } else {
            setFormData({
                name: '',
                state: '',
                country: '',
            });
        }
        setError(null);
    }, [city, isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            if (city?.id) {
                await api.patch(`/cities/${city.id}`, formData);
            } else {
                await api.post('/cities', formData);
            }
            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to save city');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={city ? "Edit City" : "Add City"}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">City Name</label>
                    <input
                        type="text"
                        required
                        placeholder="e.g. Mumbai"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500/50 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">State</label>
                    <input
                        type="text"
                        placeholder="e.g. Maharashtra"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500/50 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-bold text-slate-700 ml-1">Country</label>
                    <input
                        type="text"
                        placeholder="e.g. India"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-purple-500/5 focus:border-purple-500/50 transition-all text-slate-900 placeholder:text-slate-400 font-medium"
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className="px-10 py-3.5 bg-purple-600 text-white font-bold rounded-2xl hover:bg-purple-700 transition-all disabled:opacity-50 shadow-xl shadow-purple-600/20 active:scale-95 flex items-center gap-2"
                    >
                        {isLoading && (
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        )}
                        {isLoading ? 'Saving...' : (city ? 'Save' : 'Add')}
                    </button>
                </div>
            </form>
        </ModalWrapper>
    );
};

export default CityModal;
