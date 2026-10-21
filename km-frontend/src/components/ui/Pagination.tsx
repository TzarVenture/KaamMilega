'use client';

import React from 'react';
import { CaretLeftIcon, CaretRightIcon } from '@phosphor-icons/react';

interface PaginationProps {
    current: number;
    total: number;
    onPageChange: (page: number) => void;
}

const getPageNumbers = (current: number, total: number): (number | string)[] => {
    if (total <= 1) return [1];
    
    // For 5 or fewer pages, display all numbers directly
    if (total <= 5) {
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    // Near the start: 1, 2, 3, 4, ..., total
    if (current <= 3) {
        return [1, 2, 3, 4, '...', total];
    }

    // Near the end: 1, ..., total - 3, total - 2, total - 1, total
    if (current >= total - 2) {
        return [1, '...', total - 3, total - 2, total - 1, total];
    }

    // In the middle: 1, ..., current - 1, current, current + 1, ..., total
    return [1, '...', current - 1, current, current + 1, '...', total];
};

const Pagination: React.FC<PaginationProps> = ({ current, total, onPageChange }) => {
    if (total <= 1) return null;

    const safeCurrent = Math.max(1, Math.min(current, total));
    const pages = getPageNumbers(safeCurrent, total);

    return (
        <div className="flex items-center gap-1.5 sm:gap-2">
            <button
                type="button"
                disabled={safeCurrent <= 1}
                aria-label="Previous page"
                className="p-2 text-km-text-secondary hover:text-km-heading hover:bg-km-surface rounded-xl disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                onClick={() => onPageChange(safeCurrent - 1)}
            >
                <CaretLeftIcon weight="bold" size={18} />
            </button>

            {pages.map((item, index) => {
                const isNumber = typeof item === 'number';
                const isActive = item === safeCurrent;

                if (!isNumber) {
                    return (
                        <span
                            key={`ellipsis-${index}`}
                            className="w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center text-xs font-bold text-km-text-secondary select-none"
                        >
                            ...
                        </span>
                    );
                }

                return (
                    <button
                        type="button"
                        key={`page-${item}`}
                        aria-current={isActive ? 'page' : undefined}
                        className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center text-xs font-semibold transition-all cursor-pointer ${
                            isActive
                                ? 'bg-[#071A4D] text-white shadow-xs dark:bg-km-primary'
                                : 'text-km-text-secondary border border-km-border hover:border-[#071A4D] hover:text-km-heading hover:bg-km-surface bg-km-surface-card dark:hover:border-km-link'
                        }`}
                        onClick={() => onPageChange(item)}
                    >
                        {item}
                    </button>
                );
            })}

            <button
                type="button"
                disabled={safeCurrent >= total}
                aria-label="Next page"
                className="p-2 text-km-text-secondary hover:text-km-heading hover:bg-km-surface rounded-xl disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                onClick={() => onPageChange(safeCurrent + 1)}
            >
                <CaretRightIcon weight="bold" size={18} />
            </button>
        </div>
    );
};

export default Pagination;