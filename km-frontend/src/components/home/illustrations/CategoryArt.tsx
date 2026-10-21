/**
 * Small category illustrations for the home page qualification and job-type cards.
 * One family: 96x72 canvas, soft ground shadow, flat shapes in the design.md palette
 * (navy/blue for the main object, one orange accent, Skills green only for growth/success).
 */
import React from 'react';

const NAVY = '#071A4D';
const NAVY_2 = '#16307A';
const BLUE = '#0B5ED7';
const BLUE_SOFT = '#DCE8F8';
const BLUE_MIST = '#EEF4FC';
const ORANGE = '#FF6B00';
const ORANGE_SOFT = '#FFE3CC';
const GREEN = '#16A34A';
const PINK = '#DB2777';
const PINK_SOFT = '#FCE7F3';
const LINE = '#D9E0EA';

type ArtProps = { className?: string };

const Frame = ({ className = '', children }: ArtProps & { children: React.ReactNode }) => (
    <svg viewBox="0 0 96 72" className={className} fill="none" aria-hidden="true" role="presentation">
        <ellipse cx="48" cy="66" rx="32" ry="4" fill="#E3E9F1" />
        {children}
    </svg>
);

/** Open book with a pencil */
export const BelowTenthArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <path d="M11 26Q30 19 48 26Q66 19 85 26V62Q66 55 48 62Q30 55 11 62Z" fill={NAVY} />
        <path d="M14 24Q31 18 47 24V58Q31 52 14 58Z" fill="#FFFFFF" />
        <path d="M49 24Q65 18 82 24V58Q65 52 49 58Z" fill={BLUE_MIST} />
        <rect x="19" y="30" width="22" height="2.5" rx="1.25" fill={BLUE_SOFT} />
        <rect x="19" y="36" width="18" height="2.5" rx="1.25" fill={BLUE_SOFT} />
        <rect x="19" y="42" width="20" height="2.5" rx="1.25" fill={BLUE_SOFT} />
        <rect x="54" y="30" width="22" height="2.5" rx="1.25" fill={BLUE_SOFT} />
        <rect x="54" y="36" width="16" height="2.5" rx="1.25" fill={BLUE_SOFT} />
        <g transform="translate(66 6) rotate(32)">
            <rect x="0" y="0" width="6" height="4" rx="1" fill={BLUE} />
            <rect x="0" y="4" width="6" height="24" fill={ORANGE} />
            <path d="M0 28H6L3 34Z" fill={ORANGE_SOFT} />
            <path d="M2.1 31.3H3.9L3 34Z" fill={NAVY} />
        </g>
    </Frame>
);

/** Certificate with a large level number and a seal */
const CertificateArt = ({ className, label, seal }: ArtProps & { label: string; seal: string }) => (
    <Frame className={className}>
        <rect x="16" y="8" width="64" height="52" rx="6" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
        <rect x="21" y="13" width="54" height="42" rx="3" stroke={BLUE_SOFT} strokeWidth="1.5" />
        <rect x="34" y="19" width="28" height="3" rx="1.5" fill={BLUE_SOFT} />
        <text x="44" y="45" textAnchor="middle" fill={NAVY} fontSize="19" fontWeight="700">{label}</text>
        <path d="M63 56l-2.5 10 4-2 3 3 2-9Z" fill={seal} opacity="0.85" />
        <path d="M73 56l2.5 10-4-2-3 3-2-9Z" fill={seal} opacity="0.85" />
        <circle cx="68" cy="52" r="9" fill={seal} />
        <circle cx="68" cy="52" r="5" stroke="#FFFFFF" strokeWidth="1.5" />
    </Frame>
);

export const TenthPassArt = ({ className }: ArtProps) => <CertificateArt className={className} label="10" seal={ORANGE} />;
export const TwelfthPassArt = ({ className }: ArtProps) => <CertificateArt className={className} label="12" seal={BLUE} />;

/** Clipboard with a gear (vocational / ITI) */
export const DiplomaItiArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <rect x="16" y="12" width="44" height="50" rx="5" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
        <rect x="28" y="8" width="20" height="8" rx="3" fill={NAVY} />
        <rect x="23" y="25" width="30" height="3" rx="1.5" fill={BLUE_SOFT} />
        <rect x="23" y="32" width="24" height="3" rx="1.5" fill={BLUE_SOFT} />
        <rect x="23" y="39" width="28" height="3" rx="1.5" fill={BLUE_SOFT} />
        <rect x="23" y="46" width="18" height="3" rx="1.5" fill={BLUE_SOFT} />
        <g transform="translate(66 44)">
            {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
                <rect key={a} x="-3" y="-16" width="6" height="7" rx="1.5" fill={ORANGE} transform={`rotate(${a})`} />
            ))}
            <circle r="11.5" fill={ORANGE} />
            <circle r="4.5" fill="#FFFFFF" />
        </g>
    </Frame>
);

/** Graduation cap over a diploma scroll */
export const GraduateArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <rect x="20" y="48" width="56" height="12" rx="6" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
        <rect x="45" y="48" width="6" height="12" fill={ORANGE} />
        <path d="M28 28V38Q48 46 68 38V28L48 36Z" fill={NAVY_2} />
        <path d="M48 8 84 22 48 36 12 22Z" fill={NAVY} />
        <circle cx="48" cy="22" r="2.5" fill={ORANGE} />
        <path d="M48 22 76 27V37" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="73.5" y="35" width="5" height="8" rx="2" fill={ORANGE} />
    </Frame>
);

/** Graduation cap on a stack of books */
export const PostGraduateArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <rect x="18" y="50" width="60" height="11" rx="3" fill={NAVY} />
        <rect x="22" y="53.5" width="44" height="4" rx="2" fill={NAVY_2} />
        <rect x="22" y="39" width="54" height="11" rx="3" fill={ORANGE} />
        <rect x="26" y="42.5" width="38" height="4" rx="2" fill={ORANGE_SOFT} opacity="0.6" />
        <rect x="16" y="28" width="58" height="11" rx="3" fill={BLUE} />
        <rect x="20" y="31.5" width="40" height="4" rx="2" fill={BLUE_SOFT} opacity="0.6" />
        <path d="M33 18V24Q46 29 59 24V18L46 23Z" fill={NAVY_2} />
        <path d="M46 4 70 13 46 22 22 13Z" fill={NAVY} />
        <path d="M46 13 64 16V23" stroke={ORANGE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="61.5" y="21" width="5" height="6" rx="2" fill={ORANGE} />
    </Frame>
);

/** House with a laptop */
export const WorkFromHomeArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <rect x="22" y="28" width="52" height="34" fill={BLUE_MIST} />
        <path d="M14 31 48 7 82 31 78 35 48 14 18 35Z" fill={NAVY} />
        <rect x="31" y="34" width="34" height="21" rx="2.5" fill={NAVY} />
        <rect x="34" y="37" width="28" height="15" rx="1.5" fill={BLUE} />
        <rect x="37" y="40" width="12" height="2.5" rx="1.25" fill="#FFFFFF" opacity="0.85" />
        <rect x="37" y="45" width="18" height="2.5" rx="1.25" fill="#FFFFFF" opacity="0.5" />
        <path d="M25 55H71L68 60H28Z" fill="#9AA8BC" />
        <rect x="64" y="12" width="6" height="11" rx="1" fill={ORANGE} />
    </Frame>
);

/** Clock with half the face filled */
export const PartTimeArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <circle cx="48" cy="35" r="26" fill={NAVY} />
        <circle cx="48" cy="35" r="22" fill="#FFFFFF" />
        <path d="M48 35V13A22 22 0 0 1 48 57Z" fill={ORANGE_SOFT} />
        {[0, 90, 180, 270].map((a) => (
            <rect key={a} x="46.75" y="15" width="2.5" height="5" rx="1.25" fill={NAVY} transform={`rotate(${a} 48 35)`} />
        ))}
        <path d="M48 35V21" stroke={NAVY} strokeWidth="3" strokeLinecap="round" />
        <path d="M48 35 59 41" stroke={ORANGE} strokeWidth="3" strokeLinecap="round" />
        <circle cx="48" cy="35" r="3" fill={NAVY} />
    </Frame>
);

/** Briefcase in front of a calendar */
export const FullTimeArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <rect x="42" y="8" width="40" height="38" rx="5" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
        <path d="M42 13a5 5 0 0 1 5-5h30a5 5 0 0 1 5 5v6H42Z" fill={BLUE} />
        {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => (
                <rect key={`${r}-${c}`} x={48 + c * 8} y={24 + r * 7} width="5" height="4" rx="1" fill={BLUE_SOFT} />
            ))
        )}
        <rect x="25" y="25" width="18" height="10" rx="3.5" stroke={NAVY} strokeWidth="3" />
        <rect x="12" y="32" width="44" height="29" rx="5" fill={NAVY} />
        <rect x="12" y="44" width="44" height="3" fill={NAVY_2} />
        <rect x="31" y="41" width="6" height="8" rx="1.5" fill={ORANGE} />
    </Frame>
);

/** Sprout in a pot with a "new" tag */
export const FresherArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <path d="M48 42V22" stroke={GREEN} strokeWidth="3" strokeLinecap="round" />
        <path d="M48 32C40 32 33 26 33 17C41 17 48 23 48 32Z" fill={GREEN} />
        <path d="M48 27C56 27 63 21 63 12C55 12 48 18 48 27Z" fill="#7CCB97" />
        <rect x="31" y="41" width="34" height="7" rx="2.5" fill="#FF8A00" />
        <path d="M34 48H62L58.5 63H37.5Z" fill={ORANGE} />
        <rect x="64" y="8" width="26" height="13" rx="6.5" fill={BLUE} />
        <text x="77" y="17.5" textAnchor="middle" fill="#FFFFFF" fontSize="7.5" fontWeight="700">NEW</text>
    </Frame>
);

/** Profile card with a verified check (women-friendly employers), in pink */
export const WomenJobsArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <rect x="20" y="8" width="56" height="54" rx="8" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
        <circle cx="48" cy="28" r="15" fill={PINK_SOFT} />
        <path d="M38.5 35C37.5 23 42 17 48 17C54 17 58.5 23 57.5 35Z" fill={NAVY} />
        <circle cx="48" cy="26" r="7" fill="#F2C9A8" />
        <path d="M36 42C36 36 41.5 33.5 48 33.5S60 36 60 42Z" fill={PINK} />
        <rect x="32" y="47" width="32" height="3.5" rx="1.75" fill={NAVY} />
        <rect x="36" y="54" width="24" height="3" rx="1.5" fill="#F9C5DD" />
        <circle cx="72" cy="12" r="8.5" fill={PINK} />
        <path d="m68 12.2 2.8 2.8 5.2-5.4" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </Frame>
);
