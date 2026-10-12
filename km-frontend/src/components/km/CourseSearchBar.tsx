"use client";

import React from "react";
import { Search, X, SlidersHorizontal } from "lucide-react";

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
            <div className="bg-white rounded-2xl border border-[#D9E0EA] p-2 sm:p-2.5 shadow-xs focus-within:border-[#0B5ED7] focus-within:ring-2 focus-within:ring-[#0B5ED7]/10 transition-all flex items-center gap-3">
                <div className="pl-2 sm:pl-3 text-[#5B6472] shrink-0">
                    <Search size={18} />
                </div>
                <input
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    className="w-full bg-transparent text-sm text-[#111827] placeholder:text-[#5B6472]/70 focus:outline-hidden font-medium"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => {
                            if (onClear) onClear();
                            else onChange("");
                        }}
                        className="p-1.5 text-[#5B6472] hover:text-[#111827] hover:bg-[#F4F7FB] rounded-full transition-colors shrink-0 mr-1"
                        title="Clear search"
                    >
                        <X size={15} />
                    </button>
                )}
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
