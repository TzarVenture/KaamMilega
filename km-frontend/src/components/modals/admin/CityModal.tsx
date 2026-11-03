'use client';

import React, { useState, useEffect } from 'react';
import { CircleNotchIcon } from '@phosphor-icons/react';
import { AdminModal, btn, field } from '@/components/admin/ui';
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
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={city ? "Edit city" : "Add city"}
        >
            <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                    <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl">
                        {error}
                    </div>
                )}

                <div className="space-y-2">
                    <label className={field.label}>City name</label>
                    <input
                        type="text"
                        required
                        placeholder="e.g. Mumbai"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className={field.input}
                    />
                </div>

                <div className="space-y-2">
                    <label className={field.label}>State</label>
                    <input
                        type="text"
                        placeholder="e.g. Maharashtra"
                        value={formData.state}
                        onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        className={field.input}
                    />
                </div>

                <div className="space-y-2">
                    <label className={field.label}>Country</label>
                    <input
                        type="text"
                        placeholder="e.g. India"
                        value={formData.country}
                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                        className={field.input}
                    />
                </div>

                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={btn.primary}
                    >
                        {isLoading && (
                            <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />
                        )}
                        {city ? 'Save' : 'Add city'}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
};

export default CityModal;
