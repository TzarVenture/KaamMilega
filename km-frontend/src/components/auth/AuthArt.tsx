// Illustrations for the sign-in screens. Motion lives in globals.css (.km-auth-*): an entrance,
// cards and the tick replaying on a loop, floating pieces drifting and chat dots typing;
// under reduced motion everything is still.

type Variant = 'candidate' | 'employer';

/** Brand panel scene: a phone resting on the city skyline, with job (or candidate) cards
 *  arriving on screen and the things KaamMilega offers floating around it */
export function AuthHeroArt({ variant = 'candidate', className = '' }: { variant?: Variant; className?: string }) {
    const isEmployer = variant === 'employer';
    // Card accents: the service colours for jobs, InstantMilega and skills
    const cards = [
        { y: 116, accent: '#0B5ED7', delay: '0.35s' },
        { y: 168, accent: '#FF6B00', delay: '0.6s' },
        { y: 220, accent: '#16A34A', delay: '0.85s' },
    ];

    return (
        <svg viewBox="0 0 440 300" className={className} role="img" aria-hidden="true" focusable="false">
            {/* Skyline the phone rests on */}
            <g className="km-auth-rise" style={{ animationDelay: '0s' }}>
                <rect x="0" y="206" width="54" height="94" rx="3" fill="#0E2763" />
                <rect x="60" y="176" width="44" height="124" rx="3" fill="#102C6E" />
                <rect x="112" y="226" width="34" height="74" rx="3" fill="#0E2763" />
                <rect x="296" y="220" width="38" height="80" rx="3" fill="#0E2763" />
                <rect x="340" y="168" width="48" height="132" rx="3" fill="#102C6E" />
                <rect x="394" y="204" width="46" height="96" rx="3" fill="#0E2763" />
                {[
                    [12, 222], [30, 222], [12, 246], [70, 192], [88, 192], [70, 218], [88, 244], [120, 240],
                    [304, 236], [352, 184], [370, 184], [352, 210], [370, 236], [404, 220], [422, 246],
                ].map(([x, y], i) => (
                    <rect key={i} x={x} y={y} width="8" height="10" rx="1.5" fill={i % 4 === 1 ? '#FFB066' : '#1A3A85'} />
                ))}
            </g>

            {/* Phone, cropped by the panel's bottom edge */}
            <g className="km-auth-rise" style={{ animationDelay: '0.15s' }}>
                <rect x="146" y="52" width="148" height="270" rx="24" fill="#FFFFFF" />
                <rect x="156" y="62" width="128" height="250" rx="16" fill="#F4F7FB" />
                <rect x="198" y="70" width="44" height="6" rx="3" fill="#D9E0EA" />
                {/* App bar: the K mark */}
                <rect x="166" y="88" width="16" height="16" rx="5" fill="#071A4D" />
                <circle cx="178" cy="92" r="2.5" fill="#FF6B00" />
                <rect x="188" y="91" width="54" height="5" rx="2.5" fill="#071A4D" />
                <rect x="188" y="100" width="34" height="4" rx="2" fill="#C2CCDA" />
            </g>

            {/* Cards arriving on the screen */}
            {cards.map((c, i) => (
                <g key={i} className="km-auth-card" style={{ animationDelay: c.delay }}>
                    <rect x="164" y={c.y} width="112" height="44" rx="10" fill="#FFFFFF" stroke="#E3E8F0" />
                    <rect x="164" y={c.y} width="4" height="44" rx="2" fill={c.accent} />
                    {isEmployer ? (
                        <>
                            <circle cx="186" cy={c.y + 22} r="9" fill="#E8EEF8" />
                            <circle cx="186" cy={c.y + 19} r="3.5" fill="#8EA0BE" />
                            <path d={`M179 ${c.y + 29} a7 6 0 0 1 14 0`} fill="#8EA0BE" />
                        </>
                    ) : (
                        <rect x="177" y={c.y + 13} width="18" height="18" rx="5" fill="#E8EEF8" />
                    )}
                    <rect x="202" y={c.y + 14} width="54" height="6" rx="3" fill="#1F2A44" />
                    <rect x="202" y={c.y + 25} width="38" height="5" rx="2.5" fill="#B4BFCF" />
                </g>
            ))}

            {/* The first card gets its tick: applied / shortlisted */}
            <g className="km-auth-tick" style={{ animationDelay: '1.3s' }}>
                <circle cx="268" cy="118" r="11" fill="#16A34A" />
                <path d="M262.5 118.5l3.8 3.8 7-7.6" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
            </g>

            {/* Floating pieces: location, pay, verified, chat */}
            <g className="km-auth-pop" style={{ animationDelay: '1s' }}>
                <g className="km-auth-drift">
                    <path d="M92 66c-13 0-22 9.6-22 21.4C70 103 92 124 92 124s22-21 22-36.6C114 75.6 105 66 92 66z" fill="#FF6B00" />
                    <circle cx="92" cy="87" r="8" fill="#071A4D" />
                </g>
            </g>
            <g className="km-auth-pop" style={{ animationDelay: '1.15s' }}>
                <g className="km-auth-drift" style={{ animationDelay: '-2s' }}>
                    <circle cx="352" cy="92" r="24" fill="#F59E0B" />
                    <circle cx="352" cy="92" r="18" fill="none" stroke="#FFD58A" strokeWidth="2" />
                    <text x="352" y="100" textAnchor="middle" fontSize="22" fontWeight="700" fill="#7A4A00" fontFamily="var(--font-poppins), sans-serif">₹</text>
                </g>
            </g>
            <g className="km-auth-pop" style={{ animationDelay: '1.45s' }}>
                <g className="km-auth-drift" style={{ animationDelay: '-4s' }}>
                    <path d="M366 140l16 6v12c0 10-7 17-16 20-9-3-16-10-16-20v-12z" fill="#0B5ED7" />
                    <path d="M359.5 158.5l4.5 4.5 8.5-9" fill="none" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </g>
            </g>
            <g className="km-auth-pop" style={{ animationDelay: '1.6s' }}>
                <g className="km-auth-drift" style={{ animationDelay: '-1s' }}>
                    <rect x="54" y="140" width="62" height="34" rx="12" fill="#FFFFFF" />
                    <path d="M66 172l-4 10 12-8z" fill="#FFFFFF" />
                    {[72, 85, 98].map((cx, i) => (
                        <circle key={cx} className="km-auth-dot" style={{ animationDelay: `${i * 0.15}s` }} cx={cx} cy="157" r="3.5" fill="#0B5ED7" />
                    ))}
                </g>
            </g>
        </svg>
    );
}

/** Code step: a message arriving on a phone */
export function CodeSentArt({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true" focusable="false">
            {/* The outline keeps the navy body visible on the dark theme's navy background */}
            <rect x="14" y="4" width="32" height="56" rx="7" fill="#071A4D" stroke="#3A4D7A" strokeWidth="1.5" />
            <rect x="17" y="9" width="26" height="44" rx="4" fill="#F4F7FB" />
            <rect x="26" y="55" width="8" height="2" rx="1" fill="#3A4D7A" />
            <g className="km-auth-message">
                <rect x="24" y="20" width="34" height="18" rx="6" fill="#FF6B00" />
                <path d="M30 37l-3 6 8-6z" fill="#FF6B00" />
                {[33, 41, 49].map((cx, i) => (
                    <circle key={cx} className="km-auth-dot" style={{ animationDelay: `${0.6 + i * 0.15}s` }} cx={cx} cy="29" r="2" fill="#FFFFFF" />
                ))}
            </g>
        </svg>
    );
}

/** New account step: a profile card filling in */
export function WelcomeArt({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true" focusable="false">
            <rect x="6" y="10" width="52" height="44" rx="9" fill="#071A4D" stroke="#3A4D7A" strokeWidth="1.5" />
            <circle cx="22" cy="28" r="7" fill="#F4F7FB" />
            <path d="M12 46a10 8 0 0 1 20 0z" fill="#F4F7FB" />
            <rect className="km-auth-line" x="36" y="24" width="16" height="4" rx="2" fill="#F4F7FB" style={{ animationDelay: '0.2s' }} />
            <rect className="km-auth-line" x="36" y="33" width="12" height="4" rx="2" fill="#8EA0BE" style={{ animationDelay: '0.4s' }} />
            <g className="km-auth-pop" style={{ animationDelay: '0.7s' }}>
                <circle cx="50" cy="46" r="8" fill="#FF6B00" />
                <path d="M46.5 46.3l2.4 2.4 4.4-4.8" fill="none" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </g>
        </svg>
    );
}

/** Employer setup, company step: a shopfront with its windows lighting up */
export function CompanyArt({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true" focusable="false">
            <rect x="10" y="14" width="44" height="42" rx="5" fill="#071A4D" stroke="#3A4D7A" strokeWidth="1.5" />
            <path d="M8 18l6-10h36l6 10z" fill="#FF6B00" />
            {[
                [17, 24], [29, 24], [41, 24], [17, 34], [41, 34],
            ].map(([x, y], i) => (
                <rect key={i} className="km-auth-pop" style={{ animationDelay: `${0.15 + i * 0.12}s` }} x={x} y={y} width="6" height="6" rx="1.5" fill={i === 1 ? '#FFB066' : '#F4F7FB'} />
            ))}
            <rect x="27" y="40" width="10" height="16" rx="2" fill="#F4F7FB" />
        </svg>
    );
}

/** Employer setup, verification step: a shield whose tick lands */
export function VerifyArt({ className = '' }: { className?: string }) {
    return (
        <svg viewBox="0 0 64 64" className={className} role="img" aria-hidden="true" focusable="false">
            <path d="M32 6l20 7v15c0 13-8.5 23-20 28C20.5 51 12 41 12 28V13z" fill="#071A4D" stroke="#3A4D7A" strokeWidth="1.5" />
            <path className="km-auth-line" style={{ animationDelay: '0.1s' }} d="M32 12l14 5v11c0 9.5-6 17-14 21z" fill="#0B5ED7" />
            <g className="km-auth-pop" style={{ animationDelay: '0.5s' }}>
                <circle cx="46" cy="46" r="10" fill="#16A34A" />
                <path d="M41.5 46.3l3 3 5.5-6" fill="none" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </g>
        </svg>
    );
}
