'use client';

import { useEffect, useState } from 'react';

export const SEARCH_HINT_WORDS = ['Jobs', 'Instant Work', 'Skills', 'Mentorship', 'Companies', 'Events'];

const HINT_INTERVAL_MS = 2600;

interface SearchHintProps {
    /** Positioning classes for the overlay, e.g. "left-10 right-8" */
    className?: string;
    words?: string[];
}

/**
 * Urban Company style search placeholder: "Search for" stays fixed while the quoted word slides up
 * and out as the next one slides up into place (km-hint-enter / km-hint-exit keyframes in globals.css).
 * Render it over an empty input; it is aria-hidden, so give the input its own aria-label.
 */
export default function SearchHint({ className = '', words = SEARCH_HINT_WORDS }: SearchHintProps) {
    const [{ index, previous }, setSlide] = useState<{ index: number; previous: number | null }>({
        index: 0,
        previous: null,
    });

    useEffect(() => {
        const interval = setInterval(() => {
            setSlide((s) => ({ previous: s.index, index: (s.index + 1) % words.length }));
        }, HINT_INTERVAL_MS);
        return () => clearInterval(interval);
    }, [words.length]);

    return (
        <div
            aria-hidden="true"
            className={`absolute top-1/2 -translate-y-1/2 pointer-events-none flex items-center text-sm leading-5 text-slate-500 select-none whitespace-nowrap overflow-hidden ${className}`}
        >
            <span>Search for&nbsp;</span>
            <span className="relative inline-flex h-5 overflow-hidden">
                {previous !== null && (
                    <span key={`out-${previous}-${index}`} className="km-hint-exit absolute left-0 top-0 font-semibold text-[#071A4D]">
                        &lsquo;{words[previous]}&rsquo;
                    </span>
                )}
                <span key={`in-${index}`} className={`${previous !== null ? 'km-hint-enter' : ''} font-semibold text-[#071A4D]`}>
                    &lsquo;{words[index]}&rsquo;
                </span>
            </span>
        </div>
    );
}
