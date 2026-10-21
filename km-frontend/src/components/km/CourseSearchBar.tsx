"use client";

import React from "react";
import { MagnifyingGlassIcon, XIcon } from '@phosphor-icons/react';

interface CourseSearchBarProps {
    value: string;
    onChange: (val: string) => void;
    onClear?: () => void;
    placeholder?: string;
    selectedCategory?: string;
    onSelectCategory?: (category: string) => void;
    categories?: string[];
    showCategories?: boolean;
}

export default function CourseSearchBar({
    value,
    onChange,
    onClear,
    placeholder = "Search courses by title, topic, or expert name...",
    selectedCategory = "All",
    onSelectCategory,
    categories = ["All", "Vocational Skills", "Technology", "Construction", "Hospitality", "Automotive", "Business"],
    showCategories = true,
}: CourseSearchBarProps) {
    return (
        <div className="w-full space-y-3">
            {/* Input Bar */}
            <div className="w-full h-12 sm:h-13 bg-white rounded-2xl border border-[#D9E0EA] px-3.5 sm:px-4 shadow-xs focus-within:border-[#0B5ED7] focus-within:ring-2 focus-within:ring-[#0B5ED7]/10 transition-all flex items-center gap-2.5 sm:gap-3 box-border">
                <div className="text-[#5B6472] shrink-0 flex items-center justify-center">
                    <MagnifyingGlassIcon weight="bold" size={18} />
                </div>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="flex-1 min-w-0 h-full bg-transparent text-sm text-[#111827] placeholder:text-[#5B6472]/70 focus:outline-hidden font-medium"
                />
                {value ? (
                    <button
                        type="button"
                        onClick={() => {
                            if (onClear) onClear();
                            else onChange("");
                        }}
                        className="w-7 h-7 flex items-center justify-center text-[#5B6472] hover:text-[#111827] hover:bg-[#F4F7FB] rounded-full transition-colors shrink-0 cursor-pointer"
                        title="Clear search"
                        aria-label="Clear search"
                    >
                        <XIcon weight="bold" size={15} />
                    </button>
                ) : null}
            </div>

            {/* Quick Category Filter Pills */}
            {showCategories && categories && categories.length > 0 && onSelectCategory && (
                <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-none no-scrollbar">
                    {categories.map((cat) => {
                        const isActive = selectedCategory === cat;
                        return (
                            <button
                                key={cat}
                                type="button"
                                onClick={() => onSelectCategory(cat)}
                                className={`text-xs font-semibold px-3 py-1.5 rounded-full shrink-0 transition-all ${
                                    isActive
                                        ? "bg-[#071A4D] text-white shadow-xs"
                                        : "bg-white text-[#5B6472] border border-[#D9E0EA] hover:border-[#0B5ED7]/50 hover:text-[#071A4D]"
                                }`}
                            >
                                {cat}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
