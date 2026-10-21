'use client';

import React from 'react';
import { BriefcaseIcon, GraduationCapIcon, SquaresFourIcon, StarIcon } from '@phosphor-icons/react';
import { FeedCategory } from './feedTypes';

interface FeedHeaderFiltersProps {
  selectedCategory: FeedCategory;
  onSelectCategory: (category: FeedCategory) => void;
}

const CATEGORIES: { id: FeedCategory; label: string; icon: React.ReactNode; activeColor: string }[] = [
  { id: 'all', label: 'All Updates', icon: <SquaresFourIcon weight="bold" size={14} />, activeColor: 'bg-[#071A4D] text-white' },
  { id: 'jobs', label: 'Jobs & Hiring', icon: <BriefcaseIcon weight="bold" size={14} />, activeColor: 'bg-[#0B5ED7] text-white' },
  { id: 'skills', label: 'Skills & Learning', icon: <GraduationCapIcon weight="bold" size={14} />, activeColor: 'bg-[#16A34A] text-white' },
  { id: 'mentors', label: 'Mentorship', icon: <StarIcon weight="bold" size={14} />, activeColor: 'bg-[#7C3AED] text-white' },
];

export const FeedHeaderFilters: React.FC<FeedHeaderFiltersProps> = ({
  selectedCategory,
  onSelectCategory,
}) => {
  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
      {CATEGORIES.map((cat) => {
        const isSelected = selectedCategory === cat.id;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-poppins font-semibold transition-all shrink-0 border ${
              isSelected
                ? `${cat.activeColor} border-transparent shadow-xs`
                : 'bg-white text-[#5B6472] border-[#D9E0EA] hover:border-[#0B5ED7]/40 hover:text-[#071A4D] hover:bg-[#F4F7FB]'
            }`}
          >
            {cat.icon}
            <span>{cat.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default FeedHeaderFilters;
