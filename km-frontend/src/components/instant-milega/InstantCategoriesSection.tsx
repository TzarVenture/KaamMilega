'use client';

import React from 'react';
import {
    Layers,
    Truck,
    Zap,
    Car,
    Wrench,
    Package,
    Wind,
    Hammer,
    ShieldCheck,
    Paintbrush,
    Building2,
    Check
} from 'lucide-react';

interface TradeCategory {
    id: string;
    title: string;
    icon: React.ReactNode;
}

interface InstantCategoriesSectionProps {
    onSelectCategory: (categoryTitle: string) => void;
    selectedCategory?: string;
}

export default function InstantCategoriesSection({
    onSelectCategory,
    selectedCategory = 'All',
}: InstantCategoriesSectionProps) {
    const categories: TradeCategory[] = [
        {
            id: 'all',
            title: 'All Trades',
            icon: <Layers size={18} className="text-[#FF6B00] fill-[#FF6B00]/20" />,
        },
        {
            id: 'delivery',
            title: 'Delivery Partner',
            icon: <Truck size={18} className="text-[#FF6B00] fill-[#FF6B00]/20" />,
        },
        {
            id: 'electrician',
            title: 'Electrician',
            icon: <Zap size={18} className="text-[#FF6B00] fill-[#FF6B00]" />,
        },
        {
            id: 'driver',
            title: 'Driver',
            icon: <Car size={18} className="text-[#FF6B00] fill-[#FF6B00]" />,
        },
        {
            id: 'plumber',
            title: 'Plumber',
            icon: <Wrench size={18} className="text-[#FF6B00] fill-[#FF6B00]/20" />,
        },
        {
            id: 'warehouse',
            title: 'Warehouse Helper',
            icon: <Package size={18} className="text-[#FF6B00] fill-[#FF6B00]/20" />,
        },
        {
            id: 'ac_repair',
            title: 'AC Technician',
            icon: <Wind size={18} className="text-[#FF6B00] fill-[#FF6B00]/20" />,
        },
        {
            id: 'carpenter',
            title: 'Carpenter',
            icon: <Hammer size={18} className="text-[#FF6B00] fill-[#FF6B00]/20" />,
        },
        {
            id: 'security',
            title: 'Security Guard',
            icon: <ShieldCheck size={18} className="text-[#FF6B00] fill-[#FF6B00]/20" />,
        },
        {
            id: 'painter',
            title: 'Painter',
            icon: <Paintbrush size={18} className="text-[#FF6B00] fill-[#FF6B00]/20" />,
        },
        {
            id: 'construction',
            title: 'Mason & Construction',
            icon: <Building2 size={18} className="text-[#FF6B00] fill-[#FF6B00]/20" />,
        },
    ];

    return (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Header: Clean & Real-World */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
                <div>
                    <h2 className="text-xl sm:text-2xl font-bold text-[#071A4D] tracking-tight font-poppins">
                        Spot Work by Trade
                    </h2>
                    <p className="text-xs sm:text-sm text-[#5B6472] mt-0.5 font-medium">
                        Filter urgent hiring demands and verified spot gigs by vocational trade
                    </p>
                </div>

                {selectedCategory && selectedCategory !== 'All' && (
                    <button
                        type="button"
                        onClick={() => onSelectCategory('All')}
                        className="text-xs font-bold text-[#071A4D] hover:text-[#FF6B00] transition-colors cursor-pointer self-start sm:self-auto underline underline-offset-2"
                    >
                        Show All Trades
                    </button>
                )}
            </div>

            {/* Compact Real-World Trade Tiles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
                {categories.map((cat) => {
                    const isSelected =
                        selectedCategory === cat.title ||
                        (cat.title === 'All Trades' && (!selectedCategory || selectedCategory === 'All'));

                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => onSelectCategory(cat.title === 'All Trades' ? 'All' : cat.title)}
                            className={`p-3 rounded-xl border text-left transition-all duration-150 cursor-pointer flex items-center gap-2.5 group select-none ${
                                isSelected
                                    ? 'bg-[#071A4D] border-[#071A4D] text-white shadow-xs'
                                    : 'bg-white border-[#D9E0EA] hover:border-[#FF6B00]/50 hover:bg-[#FFFDFB] text-[#111827]'
                            }`}
                        >
                            {/* Brand Colored Icon Pill (Always Brand Orange) */}
                            <div
                                className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center transition-colors ${
                                    isSelected
                                        ? 'bg-white shadow-2xs'
                                        : 'bg-[#FFF7ED] border border-[#FFEDD5]'
                                }`}
                            >
                                {cat.icon}
                            </div>

                            {/* Trade Name */}
                            <div className="min-w-0 flex-1">
                                <span
                                    className={`text-xs font-semibold block truncate font-poppins ${
                                        isSelected ? 'text-white' : 'text-[#111827] group-hover:text-[#071A4D]'
                                    }`}
                                >
                                    {cat.title}
                                </span>
                            </div>

                            {/* Active Indicator Check */}
                            {isSelected && (
                                <Check size={14} className="text-[#FF6B00] shrink-0 stroke-[2.5]" />
                            )}
                        </button>
                    );
                })}
            </div>
        </section>
    );
}

