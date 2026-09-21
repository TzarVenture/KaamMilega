'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { MapPin, ChevronDown, Search, Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { motion, AnimatePresence } from 'framer-motion';

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
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
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
        const displayLabel = !selectedCity || selectedCity === 'All' ? 'All India' : selectedCity;
        return (
            <div className="relative w-full sm:w-48" ref={dropdownRef}>
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className={`flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 hover:bg-white hover:border-km-primary transition-all cursor-pointer shadow-2xs ${isOpen ? 'bg-white border-km-primary ring-1 ring-km-primary' : ''}`}
                >
                    <div className="flex items-center gap-2 overflow-hidden">
                        <MapPin size={17} className="text-slate-400 shrink-0" />
                        <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
                            {displayLabel}
                        </span>
                    </div>
                    <ChevronDown size={16} className={`text-slate-500 shrink-0 ml-1.5 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 8, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.98 }}
                            transition={{ duration: 0.15 }}
                            className="absolute top-full left-0 mt-2 w-64 sm:w-72 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden"
                        >
                            <div className="p-3 border-b border-slate-100 bg-slate-50/50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search city or hub..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-km-primary focus:border-km-primary"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="max-h-64 overflow-y-auto py-1.5 px-1.5">
                                <div
                                    onClick={() => handleSelect('')}
                                    className={`px-3 py-2 text-xs sm:text-sm rounded-xl cursor-pointer transition-colors font-medium flex items-center justify-between ${!selectedCity || selectedCity === 'All' ? 'bg-blue-50 text-km-primary font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    <span>All India</span>
                                    {(!selectedCity || selectedCity === 'All') && (
                                        <span className="text-[10px] font-bold text-km-primary bg-blue-100/70 px-2 py-0.5 rounded-md">Selected</span>
                                    )}
                                </div>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 size={18} className="animate-spin text-km-primary" />
                                    </div>
                                ) : (
                                    displayCities.map(city => (
                                        <div
                                            key={city.id || city.name}
                                            onClick={() => handleSelect(city.name)}
                                            className={`px-3 py-2 text-xs sm:text-sm rounded-xl cursor-pointer transition-colors font-medium flex items-center justify-between ${selectedCity === city.name ? 'bg-blue-50 text-km-primary font-bold' : 'text-slate-700 hover:bg-slate-50'}`}
                                        >
                                            <span>{city.name}</span>
                                            {selectedCity === city.name && (
                                                <span className="text-[10px] font-bold text-km-primary bg-blue-100/70 px-2 py-0.5 rounded-md">Selected</span>
                                            )}
                                        </div>
                                    ))
                                )}
                                {!isLoading && displayCities.length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-slate-400">
                                        No cities found
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
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-full cursor-pointer transition-colors min-w-35"
                >
                    <MapPin size={18} className="text-gray-500" />
                    <span className="text-sm text-gray-400">City-</span>
                    <span className="text-sm font-semibold text-gray-800">{selectedCity || 'All'}</span>
                    <ChevronDown size={16} className={`text-gray-500 ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </div>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden"
                        >
                            <div className="p-3 border-b border-gray-50">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                    <input
                                        type="text"
                                        placeholder="Search city..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-km-primary"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto py-2 px-1">
                                <div
                                    onClick={() => handleSelect('All')}
                                    className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === 'All' ? 'bg-blue-50 text-km-primary font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                    All Cities
                                </div>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 size={18} className="animate-spin text-km-primary" />
                                    </div>
                                ) : (
                                    displayCities.map(city => (
                                        <div
                                            key={city.id || city.name}
                                            onClick={() => handleSelect(city.name)}
                                            className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === city.name ? 'bg-blue-50 text-km-primary font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                                        >
                                            {city.name}
                                        </div>
                                    ))
                                )}
                                {!isLoading && displayCities.length === 0 && (
                                    <div className="px-3 py-4 text-center text-xs text-gray-400">
                                        No cities found
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
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-full border border-gray-100 min-w-35 cursor-pointer"
            >
                <MapPin size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">City- <span className="font-bold">{selectedCity || 'All'}</span></span>
                <ChevronDown size={16} className={`ml-auto text-gray-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full left-0 mt-2 w-64 bg-white border border-gray-100 rounded-2xl shadow-xl z-50 overflow-hidden"
                    >
                        <div className="p-3 border-b border-gray-50">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                                <input
                                    type="text"
                                    placeholder="Search city..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-km-primary"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto py-2 px-1">
                            <div
                                onClick={() => handleSelect('All')}
                                className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === 'All' ? 'bg-blue-50 text-km-primary font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                All Cities
                            </div>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 size={18} className="animate-spin text-km-primary" />
                                </div>
                            ) : (
                                displayCities.map(city => (
                                    <div
                                        key={city.id || city.name}
                                        onClick={() => handleSelect(city.name)}
                                        className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === city.name ? 'bg-blue-50 text-km-primary font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        {city.name}
                                    </div>
                                ))
                            )}
                            {!isLoading && displayCities.length === 0 && (
                                <div className="px-3 py-4 text-center text-xs text-gray-400">
                                    No cities found
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

