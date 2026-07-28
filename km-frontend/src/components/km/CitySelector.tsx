'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, ChevronDown, Search, Loader2 } from 'lucide-react';
import api from '@/lib/axios';
import { motion, AnimatePresence } from 'framer-motion';

interface City {
    id: string;
    name: string;
}

interface CitySelectorProps {
    selectedCity: string;
    onCityChange: (city: string) => void;
    variant?: 'navbar' | 'guest';
}

const CitySelector = ({ selectedCity, onCityChange, variant = 'navbar' }: CitySelectorProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [cities, setCities] = useState<City[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchCities = async () => {
            setIsLoading(true);
            try {
                const response: any = await api.get('/cities');
                const citiesData = Array.isArray(response) ? response : (response.data || []);
                setCities(citiesData);
            } catch (error) {
                console.error('Failed to fetch cities:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchCities();
    }, []);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const filteredCities = cities.filter(city =>
        city.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const displayCities = searchTerm ? filteredCities : filteredCities.slice(0, 10);

    const handleSelect = (city: string) => {
        onCityChange(city);
        setIsOpen(false);
        setSearchTerm('');
    };

    if (variant === 'guest') {
        return (
            <div className="relative" ref={dropdownRef}>
                <div
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-2 px-4 py-2 hover:bg-gray-100 rounded-full cursor-pointer transition-colors min-w-[140px]"
                >
                    <MapPin size={18} className="text-gray-500" />
                    <span className="text-sm text-gray-400">City-</span>
                    <span className="text-sm font-semibold text-gray-800">{selectedCity}</span>
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
                                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-500"
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="max-h-60 overflow-y-auto py-2 px-1">
                                <div
                                    onClick={() => handleSelect('All')}
                                    className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === 'All' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                                >
                                    All Cities
                                </div>
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-4">
                                        <Loader2 size={18} className="animate-spin text-purple-500" />
                                    </div>
                                ) : (
                                    displayCities.map(city => (
                                        <div
                                            key={city.id}
                                            onClick={() => handleSelect(city.name)}
                                            className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === city.name ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
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

    return (
        <div className="relative" ref={dropdownRef}>
            <div
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 bg-gray-50 px-3 py-2 rounded-full border border-gray-100 min-w-[140px] cursor-pointer"
            >
                <MapPin size={16} className="text-gray-500" />
                <span className="text-sm font-medium text-gray-700">City- <span className="font-bold">{selectedCity}</span></span>
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
                                    className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-purple-700"
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="max-h-60 overflow-y-auto py-2 px-1">
                            <div
                                onClick={() => handleSelect('All')}
                                className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === 'All' ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                All Cities
                            </div>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 size={18} className="animate-spin text-purple-500" />
                                </div>
                            ) : (
                                displayCities.map(city => (
                                    <div
                                        key={city.id}
                                        onClick={() => handleSelect(city.name)}
                                        className={`px-3 py-2 text-sm rounded-lg cursor-pointer transition-colors ${selectedCity === city.name ? 'bg-purple-50 text-purple-700 font-bold' : 'text-gray-700 hover:bg-gray-50'}`}
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
