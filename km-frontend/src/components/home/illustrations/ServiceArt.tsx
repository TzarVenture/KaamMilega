/**
 * Banner illustrations for the home page "Explore core services" cards.
 * One family: 240x128 canvas drawn over a soft tint of the service colour (the card supplies the tint),
 * flat shapes in the design.md palette, navy for structure, the service colour for the hero object
 * and orange as the single accent.
 *
 * Parts tagged km-a-* animate once when an ancestor gets data-inview="true" (globals.css).
 */
import React from 'react';

const NAVY = '#071A4D';
const NAVY_2 = '#16307A';
const ORANGE = '#FF6B00';
const GREEN = '#16A34A';
const LINE = '#D9E0EA';
const MUTED = '#C9D3E1';
const SKIN = '#F2C9A8';

type ArtProps = { className?: string };

const Frame = ({ className = '', children }: ArtProps & { children: React.ReactNode }) => (
    <svg viewBox="0 0 240 128" className={`km-art ${className}`} fill="none" aria-hidden="true" role="presentation">
        <circle cx="120" cy="66" r="52" fill="#FFFFFF" opacity="0.55" />
        {children}
    </svg>
);

/** Job post card with an apply button, a briefcase and a verified check */
export const JobsServiceArt = ({ className }: ArtProps) => {
    const BLUE = '#0B5ED7';
    const BLUE_SOFT = '#DCE8F8';
    return (
        <Frame className={className}>
            <g className="km-a-rise km-a-hide">
                <rect x="62" y="22" width="104" height="80" rx="10" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
                <rect x="74" y="34" width="20" height="20" rx="5" fill={BLUE} />
                <rect x="80" y="40" width="8" height="8" rx="1.5" fill="#FFFFFF" />
                <rect x="100" y="36" width="48" height="5" rx="2.5" fill={NAVY} />
                <rect x="100" y="46" width="34" height="4" rx="2" fill={MUTED} />
                <rect x="74" y="62" width="30" height="10" rx="5" fill={BLUE_SOFT} />
                <rect x="108" y="62" width="26" height="10" rx="5" fill={BLUE_SOFT} />
                <g className="km-a-grow" style={{ animationDelay: '350ms' }}>
                    <rect x="74" y="80" width="46" height="12" rx="6" fill={BLUE} />
                    <rect x="84" y="84.75" width="26" height="2.5" rx="1.25" fill="#FFFFFF" />
                </g>
            </g>
            <g className="km-a-pop km-a-hide" style={{ animationDelay: '450ms' }}>
                <g transform="translate(148 64)">
                    <rect x="10" y="0" width="20" height="12" rx="4" stroke={NAVY} strokeWidth="4" />
                    <rect x="0" y="7" width="40" height="30" rx="6" fill={NAVY} />
                    <rect x="0" y="19" width="40" height="3" fill={NAVY_2} />
                    <rect x="17" y="16" width="6" height="9" rx="1.5" fill={ORANGE} />
                </g>
            </g>
            <g className="km-a-pop km-a-hide" style={{ animationDelay: '800ms' }}>
                <circle cx="166" cy="24" r="10" fill={GREEN} />
                <path d="m161.5 24.2 3.2 3.2 5.8-6" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
        </Frame>
    );
};

/** Stopwatch, lightning bolt and a start code pill */
export const InstantServiceArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <rect x="98" y="22" width="12" height="9" rx="2.5" fill={NAVY} />
        <circle cx="104" cy="68" r="36" fill="#FFFFFF" stroke={NAVY} strokeWidth="5" />
        <path className="km-a-draw" pathLength={1} d="M104 40A28 28 0 0 1 128.25 82" stroke={ORANGE} strokeWidth="6" strokeLinecap="round" />
        <g className="km-a-spin" style={{ transformOrigin: '104px 68px' }}>
            <path d="M104 68V49" stroke={NAVY} strokeWidth="3.5" strokeLinecap="round" />
            <path d="M104 68 116 74" stroke={NAVY} strokeWidth="3.5" strokeLinecap="round" />
        </g>
        <circle cx="104" cy="68" r="4" fill={NAVY} />
        <path className="km-a-flash" style={{ animationDelay: '500ms' }} d="M168 22 148 66h15l-8 38 32-50h-16l11-32Z" fill={ORANGE} />
        <g className="km-a-rise km-a-hide" style={{ animationDelay: '700ms' }}>
            <rect x="30" y="88" width="56" height="20" rx="10" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
            <circle cx="41" cy="98" r="3.5" fill={GREEN} />
            <text x="64" y="102" textAnchor="middle" fill={NAVY} fontSize="11" fontWeight="700" letterSpacing="1.5">4821</text>
        </g>
    </Frame>
);

/** Course video with a progress bar and a certificate with a seal */
export const SkillsServiceArt = ({ className }: ArtProps) => (
    <Frame className={className}>
        <rect x="50" y="24" width="96" height="62" rx="9" fill={GREEN} />
        <circle cx="98" cy="52" r="13" fill="#FFFFFF" />
        <path d="M94 45.5 105 52l-11 6.5Z" fill={GREEN} />
        <rect x="60" y="74" width="76" height="4" rx="2" fill="#FFFFFF" opacity="0.35" />
        <rect className="km-a-grow" style={{ animationDelay: '200ms' }} x="60" y="74" width="46" height="4" rx="2" fill="#FFFFFF" />
        <g className="km-a-slide km-a-hide" style={{ animationDelay: '500ms' }}>
            <rect x="122" y="52" width="72" height="54" rx="7" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
            <rect x="132" y="63" width="40" height="5" rx="2.5" fill={NAVY} />
            <rect x="132" y="73" width="50" height="3.5" rx="1.75" fill={MUTED} />
            <rect x="132" y="81" width="34" height="3.5" rx="1.75" fill={MUTED} />
        </g>
        <g className="km-a-pop km-a-hide" style={{ animationDelay: '950ms' }}>
            <path d="m174 96-3 12 5-2.5 3.5 3.5 2.5-11Z" fill={ORANGE} opacity="0.85" />
            <path d="m188 96 3 12-5-2.5-3.5 3.5-2.5-11Z" fill={ORANGE} opacity="0.85" />
            <circle cx="181" cy="93" r="10" fill={ORANGE} />
            <circle cx="181" cy="93" r="5.5" stroke="#FFFFFF" strokeWidth="1.6" />
        </g>
    </Frame>
);

/** A mentor and a learner in conversation */
export const MentorsServiceArt = ({ className }: ArtProps) => {
    const PURPLE = '#7C3AED';
    return (
        <Frame className={className}>
            <g className="km-a-pop km-a-hide" style={{ animationDelay: '150ms' }}>
                <rect x="92" y="18" width="50" height="26" rx="11" fill={PURPLE} />
                <path d="M100 43 96 52l12-9Z" fill={PURPLE} />
                <rect x="101" y="26" width="32" height="3.5" rx="1.75" fill="#FFFFFF" />
                <rect x="101" y="33" width="20" height="3.5" rx="1.75" fill="#FFFFFF" opacity="0.7" />
            </g>
            <g className="km-a-pop km-a-hide" style={{ animationDelay: '550ms' }}>
                <rect x="146" y="32" width="38" height="20" rx="10" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
                <circle className="km-a-type" style={{ animationDelay: '900ms' }} cx="156" cy="42" r="2.2" fill={NAVY} />
                <circle className="km-a-type" style={{ animationDelay: '1050ms' }} cx="165" cy="42" r="2.2" fill={NAVY} />
                <circle className="km-a-type" style={{ animationDelay: '1200ms' }} cx="174" cy="42" r="2.2" fill={NAVY} />
            </g>

            <path d="M52 110c0-21 11-30 26-30s26 9 26 30Z" fill={PURPLE} />
            <circle cx="78" cy="62" r="13" fill={SKIN} />
            <path d="M65 61a13 13 0 0 1 26 0c-5-6-21-6-26 0Z" fill={NAVY} />

            <path d="M136 110c0-18 10-26 24-26s24 8 24 26Z" fill={NAVY} />
            <circle cx="160" cy="68" r="12" fill={SKIN} />
            <path d="M148 67.5a12 12 0 0 1 24 0c-3-7-19-8-24 0Z" fill={NAVY_2} />
            <rect x="154" y="92" width="12" height="4" rx="2" fill={ORANGE} />
        </Frame>
    );
};

/** Storefront with a striped awning and a price tag */
export const ServicesServiceArt = ({ className }: ArtProps) => {
    const RED = '#EF4444';
    const RED_LIGHT = '#FECACA';
    const stripes = [0, 1, 2, 3, 4];
    return (
        <Frame className={className}>
            <rect x="70" y="48" width="100" height="58" rx="4" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
            <rect className="km-a-pop" x="88" y="18" width="64" height="15" rx="4" fill={NAVY} />
            <rect x="100" y="24" width="40" height="3" rx="1.5" fill="#FFFFFF" />
            {stripes.map((i) => (
                <rect key={`s${i}`} x={64 + i * 22.4} y="33" width="22.4" height="15" fill={i % 2 ? RED_LIGHT : RED} />
            ))}
            {stripes.map((i) => (
                <circle key={`c${i}`} cx={75.2 + i * 22.4} cy="48" r="11.2" fill={i % 2 ? RED_LIGHT : RED} />
            ))}
            <rect x="82" y="68" width="36" height="24" rx="3" fill={RED_LIGHT} opacity="0.6" />
            <rect x="88" y="74" width="24" height="3" rx="1.5" fill={RED} opacity="0.5" />
            <rect x="128" y="68" width="28" height="38" rx="3" fill={NAVY} />
            <circle cx="150" cy="88" r="2" fill={ORANGE} />
            <g transform="translate(176 76) rotate(-14)">
                <g className="km-a-swing" style={{ animationDelay: '300ms' }}>
                    <path d="M0 0h26l9 11-9 11H0Z" fill={ORANGE} />
                    <circle cx="27" cy="11" r="2.5" fill="#FFFFFF" />
                    <text x="11" y="15.5" textAnchor="middle" fill="#FFFFFF" fontSize="13" fontWeight="700">₹</text>
                </g>
            </g>
        </Frame>
    );
};

/** Avatar network with dashed connections */
export const PeerServiceArt = ({ className }: ArtProps) => {
    const TEAL = '#0F9D8A';
    const nodes: [number, number][] = [[64, 38], [178, 36], [70, 98], [172, 98]];
    return (
        <Frame className={className}>
            {nodes.map(([x, y]) => (
                <path key={`l${x}`} className="km-a-flow" d={`M120 66L${x} ${y}`} stroke={TEAL} strokeWidth="2.5" strokeDasharray="5 5" strokeLinecap="round" opacity="0.6" />
            ))}
            {nodes.map(([x, y], i) => (
                <g key={`n${x}`} transform={`translate(${x} ${y})`}>
                    <g className="km-a-pop km-a-hide" style={{ animationDelay: `${200 + i * 140}ms` }}>
                        <circle r="14" fill="#FFFFFF" stroke={TEAL} strokeWidth="3" />
                        <circle cy="-3" r="4.5" fill={NAVY} />
                        <path d="M-8 9c0-5 4-7 8-7s8 2 8 7Z" fill={NAVY} />
                    </g>
                </g>
            ))}
            <circle cx="120" cy="66" r="23" fill={TEAL} />
            <circle cx="120" cy="60" r="7" fill="#FFFFFF" />
            <path d="M107 80c0-8 6-11 13-11s13 3 13 11Z" fill="#FFFFFF" />
            <g className="km-a-pop km-a-hide" style={{ animationDelay: '900ms' }}>
                <rect x="136" y="14" width="24" height="15" rx="7.5" fill={ORANGE} />
                <path d="M142 28.5 139 35l9-6.5Z" fill={ORANGE} />
                <circle cx="143" cy="21.5" r="1.6" fill="#FFFFFF" />
                <circle cx="148" cy="21.5" r="1.6" fill="#FFFFFF" />
                <circle cx="153" cy="21.5" r="1.6" fill="#FFFFFF" />
            </g>
        </Frame>
    );
};

/** Calendar page with a ticket and confetti */
export const EventsServiceArt = ({ className }: ArtProps) => {
    const AMBER = '#F59E0B';
    return (
        <Frame className={className}>
            <rect x="64" y="26" width="84" height="80" rx="10" fill="#FFFFFF" stroke={LINE} strokeWidth="1.5" />
            <path d="M64 36a10 10 0 0 1 10-10h64a10 10 0 0 1 10 10v12H64Z" fill={AMBER} />
            <rect x="83" y="18" width="7" height="16" rx="3.5" fill={NAVY} />
            <rect x="122" y="18" width="7" height="16" rx="3.5" fill={NAVY} />
            <text x="106" y="91" textAnchor="middle" fill={NAVY} fontSize="32" fontWeight="700">12</text>
            <g transform="translate(140 62) rotate(-12)">
                <g className="km-a-slide km-a-hide" style={{ animationDelay: '300ms' }}>
                    <path d="M0 4a4 4 0 0 1 4-4h48a4 4 0 0 1 4 4v7a4 4 0 0 0 0 8v7a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4v-7a4 4 0 0 0 0-8Z" fill={NAVY} />
                    <path d="M40 4v22" stroke="#FFFFFF" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />
                    <rect x="8" y="9" width="22" height="3.5" rx="1.75" fill="#FFFFFF" />
                    <rect x="8" y="17" width="14" height="3.5" rx="1.75" fill="#FFFFFF" opacity="0.6" />
                    <circle cx="48" cy="15" r="3" fill={ORANGE} />
                </g>
            </g>
            <g className="km-a-pop km-a-hide" style={{ animationDelay: '700ms' }}>
                <circle cx="54" cy="26" r="3.5" fill={ORANGE} />
                <rect x="174" y="28" width="7" height="7" rx="1.5" fill={AMBER} transform="rotate(20 177.5 31.5)" />
            </g>
            <g className="km-a-pop km-a-hide" style={{ animationDelay: '850ms' }}>
                <circle cx="192" cy="46" r="2.5" fill="#0B5ED7" />
                <rect x="44" y="70" width="6" height="6" rx="1.5" fill="#0B5ED7" transform="rotate(-18 47 73)" />
            </g>
        </Frame>
    );
};
