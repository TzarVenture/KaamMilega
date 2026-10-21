/**
 * Profile progress illustration: a profile card next to three rising steps with an orange flag on
 * top. Same family as CategoryArt (96x72 canvas, ground shadow, design.md palette).
 * Steps rise and the flag pops once when an ancestor gets data-inview="true" (globals.css km-a-*).
 */
import React from 'react';

const NAVY = '#071A4D';
const BLUE = '#0B5ED7';
const BLUE_SOFT = '#DCE8F8';
const ORANGE = '#FF6B00';
const LINE = '#D9E0EA';
const MUTED = '#C9D3E1';

export default function ProfileProgressArt({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 96 72" className={`km-art ${className}`} fill="none" aria-hidden="true" role="presentation">
            <ellipse cx="50" cy="66" rx="40" ry="4" fill="#E3E9F1" />

            {/* Profile card */}
            <rect x="6" y="16" width="34" height="44" rx="6" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
            <circle cx="23" cy="29" r="7" fill={BLUE_SOFT} />
            <circle cx="23" cy="27.5" r="2.8" fill={NAVY} />
            <path d="M18 34c0-3 2.2-4.4 5-4.4s5 1.4 5 4.4Z" fill={NAVY} />
            <rect x="13" y="40" width="20" height="3" rx="1.5" fill={NAVY} />
            <rect x="15" y="46" width="16" height="2.5" rx="1.25" fill={MUTED} />
            <rect x="12" y="52" width="22" height="3" rx="1.5" fill="#E3E9F1" />
            <rect x="12" y="52" width="14" height="3" rx="1.5" fill={ORANGE} />

            {/* Rising steps */}
            <g className="km-a-rise km-a-hide" style={{ animationDelay: '150ms' }}>
                <rect x="46" y="48" width="14" height="16" rx="2" fill={BLUE_SOFT} />
            </g>
            <g className="km-a-rise km-a-hide" style={{ animationDelay: '300ms' }}>
                <rect x="61" y="36" width="14" height="28" rx="2" fill={BLUE} />
            </g>
            <g className="km-a-rise km-a-hide" style={{ animationDelay: '450ms' }}>
                <rect x="76" y="24" width="14" height="40" rx="2" fill={NAVY} />
            </g>

            {/* Flag on the top step */}
            <g className="km-a-pop km-a-hide" style={{ animationDelay: '700ms' }}>
                <path d="M83 24V7" stroke={NAVY} strokeWidth="2" strokeLinecap="round" />
                <path d="M84 7.5 94 11l-10 3.5Z" fill={ORANGE} />
            </g>
        </svg>
    );
}
