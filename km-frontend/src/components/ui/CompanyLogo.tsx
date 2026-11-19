'use client';

import React, { useState } from 'react';
import CustomImage from './CustomImage';

interface CompanyLogoProps {
    src?: string | null;
    /** Company name: its first letter stands in when there is no logo */
    name?: string;
    /** Size (and any extra classes) of the circle, e.g. "w-12 h-12" */
    className?: string;
    /** Text size of the first-letter fallback */
    textClass?: string;
}

/**
 * A company's logo in a circle, filled edge to edge like a profile photo (no inner padding).
 * Falls back to the company's first letter when there is no logo or it fails to load.
 */
export default function CompanyLogo({ src, name, className = 'w-12 h-12', textClass = 'text-base' }: CompanyLogoProps) {
    const [failed, setFailed] = useState(false);
    const showImage = Boolean(src) && !failed;

    return (
        <span
            className={`${className} rounded-full overflow-hidden shrink-0 flex items-center justify-center border border-km-border ${
                showImage ? 'bg-white' : 'bg-[#071A4D] text-white font-bold dark:bg-km-primary'
            }`}
            aria-hidden="true"
        >
            {showImage ? (
                <CustomImage src={src as string} alt="" className="w-full h-full object-cover" onError={() => setFailed(true)} />
            ) : (
                <span className={textClass}>{(name?.trim().charAt(0) || 'C').toUpperCase()}</span>
            )}
        </span>
    );
}
