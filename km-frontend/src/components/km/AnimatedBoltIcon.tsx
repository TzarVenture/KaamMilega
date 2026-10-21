'use client';

import { useId } from 'react';

/**
 * InstantMilega™ bolt: orange gradient fill with a pulsing glow and a light shine that sweeps
 * across every few seconds (globals.css .km-bolt). Static glow under reduced motion.
 */
export default function AnimatedBoltIcon({ size = 22, className = '' }: { size?: number; className?: string }) {
    const id = useId();
    const fillId = `${id}-fill`;
    const clipId = `${id}-clip`;
    const bolt = 'M13.6 2 4.4 13.4h6.2L9.4 22l10.2-12.6h-6.3L13.6 2Z';

    return (
        <svg width={size} height={size} viewBox="0 0 24 24" className={`km-bolt shrink-0 ${className}`} aria-hidden="true">
            <defs>
                <linearGradient id={fillId} x1="6" y1="2" x2="18" y2="22" gradientUnits="userSpaceOnUse">
                    <stop offset="0" stopColor="#FFB020" />
                    <stop offset="0.55" stopColor="#FF8A00" />
                    <stop offset="1" stopColor="#FF6B00" />
                </linearGradient>
                <clipPath id={clipId}>
                    <path d={bolt} />
                </clipPath>
            </defs>
            <path d={bolt} fill={`url(#${fillId})`} stroke="#E66000" strokeWidth="0.8" strokeLinejoin="round" />
            <g clipPath={`url(#${clipId})`}>
                <g transform="rotate(35 12 12)">
                    <rect className="km-bolt-shine" x="9.5" y="-4" width="5" height="32" fill="#FFFFFF" opacity="0.55" />
                </g>
            </g>
        </svg>
    );
}
