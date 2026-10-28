'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

const HINT_KEYS = ['jobs', 'instant', 'skills', 'mentorship', 'companies', 'events'] as const;

const HINT_INTERVAL_MS = 2600;

interface SearchHintProps {
    /** Positioning classes for the overlay, e.g. "left-10 right-8" */
    className?: string;
}

/**
 * Urban Company style search placeholder: "Search for" stays fixed while the quoted word slides up
 * and out as the next one slides up into place (km-hint-enter / km-hint-exit keyframes in globals.css).
 * Word order comes from the message ("Search for <word/>", Hindi "<word/> खोजें").
 * Render it over an empty input; it is aria-hidden, so give the input its own aria-label.
 */
export default function SearchHint({ className = '' }: SearchHintProps) {
    const t = useTranslations('searchHint');
    const words = HINT_KEYS.map((k) => t(k));
    const [{ index, previous }, setSlide] = useState<{ index: number; previous: number | null }>({
        index: 0,
        previous: null,
    });

    useEffect(() => {
        const interval = setInterval(() => {
            setSlide((s) => ({ previous: s.index, index: (s.index + 1) % HINT_KEYS.length }));
        }, HINT_INTERVAL_MS);
        return () => clearInterval(interval);
    }, []);

    const word = () => (
        <span className="relative inline-flex h-5 overflow-hidden">
            {previous !== null && (
                <span key={`out-${previous}-${index}`} className="km-hint-exit absolute left-0 top-0 font-semibold text-km-heading">
                    &lsquo;{words[previous]}&rsquo;
                </span>
            )}
            <span key={`in-${index}`} className={`${previous !== null ? 'km-hint-enter' : ''} font-semibold text-km-heading`}>
                &lsquo;{words[index]}&rsquo;
            </span>
        </span>
    );

    return (
        <div
            aria-hidden="true"
            className={`absolute top-1/2 -translate-y-1/2 pointer-events-none flex items-center gap-[0.3em] text-sm leading-5 text-slate-500 select-none whitespace-nowrap overflow-hidden ${className}`}
        >
            {t.rich('searchFor', { word })}
        </div>
    );
}
