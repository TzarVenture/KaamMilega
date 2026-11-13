'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { CaretDownIcon, CircleNotchIcon, MagnifyingGlassIcon, MapPinIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { notify } from "@/lib/notify";

interface City {
    id?: string;
    name: string;
}

interface CitySelectorProps {
    selectedCity: string;
    onCityChange: (city: string) => void;
    variant?: 'navbar' | 'guest' | 'hero';
    cities?: City[];
}

const CitySelector = ({ selectedCity, onCityChange, variant = 'navbar', cities: propCities }: CitySelectorProps) => {
    const t = useTranslations('city');
    const [isOpen, setIsOpen] = useState(false);
    const [fetchedCities, setFetchedCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (propCities && propCities.length > 0) return;

        const fetchCities = async () => {
            setIsLoading(true);
            try {
                const response: any = await api.get('/cities');
                const citiesData = Array.isArray(response) ? response : (response.data || []);
                setFetchedCities(citiesData);
            } catch (error) {
                console.error('Failed to fetch cities:', error);
                notify.error(error, "Cities couldn’t be loaded.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchCities();
    }, [propCities]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKey = (event: KeyboardEvent) => {
            if (event.key !== 'Escape' || !dropdownRef.current?.contains(document.activeElement)) return;
            setIsOpen(false);
            dropdownRef.current.querySelector<HTMLButtonElement>('button[aria-haspopup]')?.focus();
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKey);
        };
    }, []);

    // Deduplicate cities by lowercase trimmed name and sort alphabetically
    const allCities = useMemo(() => {
        const source = (propCities && propCities.length > 0) ? propCities : fetchedCities;
        const map = new Map<string, City>();
        for (const c of source) {
            const trimmed = (c.name || '').trim();
            if (!trimmed) continue;
            const key = trimmed.toLowerCase();
            if (!map.has(key)) {
                map.set(key, { id: c.id || trimmed, name: trimmed });
            }
        }
        return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [propCities, fetchedCities]);

    const displayCities = useMemo(() => {
        if (!searchTerm.trim()) return allCities;
        const term = searchTerm.toLowerCase().trim();
        return allCities.filter(city => city.name.toLowerCase().includes(term));
    }, [allCities, searchTerm]);

    const handleSelect = (city: string) => {
        onCityChange(city);
        setIsOpen(false);
        setSearchTerm('');
    };

    // --- Hero Variant ---
    if (variant === 'hero') {
        const displayLabel = !selectedCity || selectedCity === 'All' ? t('allIndia') : selectedCity;
        return (
            <div className="relative w-full sm:w-48" ref={dropdownRef}>
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(!isOpen)}
                    className={`w-full text-left flex items-center justify-between h-12 bg-slate-50/70 border border-km-border rounded-xl px-3.5 hover:bg-km-surface-card hover:border-km-primary transition-all cursor-pointer ${isOpen ? 'bg-km-surface-card border-km-primary ring-1 ring-km-primary' : ''}`}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <MapPinIcon weight="bold" size={17} className="text-km-text-muted shrink-0" />
                        <span className="text-sm font-semibold text-km-text-primary truncate">
                            {displayLabel}
                        </span>
                    </div>
                    <CaretDownIcon weight="bold" size={16} className={`text-km-text-secondary shrink-0 ml-1.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            style={{ transformOrigin: "top left" }}
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-2 w-64 sm:w-72 bg-km-surface-card border border-km-border rounded-2xl shadow-xl z-50 overflow-hidden"
                        >
                            <div className="p-3 border-b border-km-border-subtle bg-slate-50/50">
                                <div className="relative">
                                    <MagnifyingGlassIcon weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted" size={14} />
                                    <input
                                        type="text"
                                        placeholder={t('search')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-km-surface-card border border-km-border rounded-xl text-xs text-km-text-primary placeholder:text-km-text-muted focus:outline-none focus:ring-1 focus:ring-km-primary focus:border-km-primary"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div role="listbox" aria-label={t('label')} className="max-h-64 overflow-y-auto py-1.5 px-1.5">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={!selectedCity || selectedCity === 'All'}
                                    onClick={() => handleSelect('')}
                                    className={`w-full text-left px-3 py-2 text-xs sm:text-sm rounded-xl cursor-pointer transition-colors font-medium flex items-center justify-between ${!selectedCity || selectedCity === 'All' ? 'bg-blue-50 text-km-heading font-bold' : 'text-km-text-primary hover:bg-km-surface'}`}
                                >
                                    <span>{t('allIndia')}</span>
                                    {(!selectedCity || selectedCity === 'All') && (
                                        <span className="text-[10px] font-bold text-km-heading bg-blue-100/70 px-2 py-0.5 rounded-md">Selected</span>
                                    )}
                                </button>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <CircleNotchIcon weight="bold" size={18} className="animate-spin text-km-heading" />
                                    </div>
                                ) : (
                                    displayCities.map(city => (
                                        <button
                                            key={city.id || city.name}
                                            type="button"
                                            role="option"
                                            aria-selected={selectedCity === city.name}
                                            onClick={() => handleSelect(city.name)}
                                            className={`w-full text-left px-3 py-2 text-xs sm:text-sm rounded-xl cursor-pointer transition-colors font-medium flex items-center justify-between ${selectedCity === city.name ? 'bg-blue-50 text-km-heading font-bold' : 'text-km-text-primary hover:bg-km-surface'}`}
                                        >
                                            <span>{city.name}</span>
                                            {selectedCity === city.name && (
                                                <span className="text-[10px] font-bold text-km-heading bg-blue-100/70 px-2 py-0.5 rounded-md">Selected</span>
                                            )}
                                        </button>
                                    ))
                                )}
                                {!isLoading && displayCities.length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-km-text-muted">
                                        {t('none')}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // --- Guest Variant ---
    if (variant === 'guest') {
        return (
            <div className="relative" ref={dropdownRef}>
                <button
                    type="button"
                    aria-haspopup="listbox"
                    aria-expanded={isOpen}
                    onClick={() => setIsOpen(!isOpen)}
                    className="w-full text-left flex items-center gap-2 px-4 py-2 hover:bg-km-surface rounded-full cursor-pointer transition-colors min-w-35"
                >
                    <MapPinIcon weight="bold" size={18} className="text-km-text-secondary" />
                    <span className="text-sm text-km-text-muted">{t('label')}:</span>
                    <span className="text-sm font-semibold text-km-text-primary">{!selectedCity || selectedCity === 'All' ? t('all') : selectedCity}</span>
                    <CaretDownIcon weight="bold" size={16} className={`text-km-text-secondary ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            style={{ transformOrigin: "top left" }}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 mt-2 w-64 bg-km-surface-card border border-km-border-subtle rounded-2xl shadow-xl z-50 overflow-hidden"
                        >
                            <div className="p-3 border-b border-km-border-subtle">
                                <div className="relative">
                                    <MagnifyingGlassIcon weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted" size={14} />
                                    <input
                                        type="text"
                                        placeholder={t('search')}
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-km-surface border border-km-border-subtle rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-km-primary"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div role="listbox" aria-label={t('label')} className="max-h-60 overflow-y-auto py-2 px-1">
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={selectedCity === 'All'}
                                    onClick={() => handleSelect('All')}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === 'All' ? 'bg-blue-50 text-km-heading font-bold' : 'text-km-text-primary hover:bg-km-surface'}`}
                                >
                                    {t('allCities')}
                                </button>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <CircleNotchIcon weight="bold" size={18} className="animate-spin text-km-heading" />
                                    </div>
                                ) : (
                                    displayCities.map(city => (
                                        <button
                                            key={city.id || city.name}
                                            type="button"
                                            role="option"
                                            aria-selected={selectedCity === city.name}
                                            onClick={() => handleSelect(city.name)}
                                            className={`w-full text-left px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === city.name ? 'bg-blue-50 text-km-heading font-bold' : 'text-km-text-primary hover:bg-km-surface'}`}
                                        >
                                            {city.name}
                                        </button>
                                    ))
                                )}
                                {!isLoading && displayCities.length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-km-text-muted">
                                        {t('none')}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    }

    // --- Standard Navbar Variant ---
    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                onClick={() => setIsOpen(!isOpen)}
                className="w-full text-left flex items-center gap-2 bg-km-surface px-3 py-2 rounded-full border border-km-border-subtle min-w-35 cursor-pointer"
            >
                <MapPinIcon weight="bold" size={16} className="text-km-text-secondary" />
                <span className="text-sm font-medium text-km-text-primary">{t('label')}: <span className="font-bold">{!selectedCity || selectedCity === 'All' ? t('all') : selectedCity}</span></span>
                <CaretDownIcon weight="bold" size={16} className={`ml-auto text-km-text-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        style={{ transformOrigin: "top left" }}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 mt-2 w-64 bg-km-surface-card border border-km-border-subtle rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                        <div className="p-3 border-b border-km-border-subtle">
                            <div className="relative">
                                <MagnifyingGlassIcon weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted" size={14} />
                                <input
                                    type="text"
                                    placeholder={t('search')}
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-km-surface border border-km-border-subtle rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-km-primary"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div role="listbox" aria-label={t('label')} className="max-h-60 overflow-y-auto py-2 px-1">
                            <button
                                type="button"
                                role="option"
                                aria-selected={selectedCity === 'All'}
                                onClick={() => handleSelect('All')}
                                className={`w-full text-left px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === 'All' ? 'bg-blue-50 text-km-heading font-bold' : 'text-km-text-primary hover:bg-km-surface'}`}
                            >
                                {t('allCities')}
                            </button>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <CircleNotchIcon weight="bold" size={18} className="animate-spin text-km-heading" />
                                </div>
                            ) : (
                                displayCities.map(city => (
                                    <button
                                        key={city.id || city.name}
                                        type="button"
                                        role="option"
                                        aria-selected={selectedCity === city.name}
                                        onClick={() => handleSelect(city.name)}
                                        className={`w-full text-left px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === city.name ? 'bg-blue-50 text-km-heading font-bold' : 'text-km-text-primary hover:bg-km-surface'}`}
                                    >
                                        {city.name}
                                    </button>
                                ))
                            )}
                            {!isLoading && displayCities.length === 0 && (
                                <div className="px-3 py-4 text-center text-xs text-km-text-muted">
                                    {t('none')}
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CitySelector;

