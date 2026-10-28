import { useTranslations } from 'next-intl';

/**
 * Decorative illustration for the premium services banner: a resume with an ATS match score
 * and a priority applicant badge. Brand palette from design.md.
 */
export default function ProfileBoostArt({ className = '' }: { className?: string }) {
    const t = useTranslations('home.premium');
    // ATS ring: r=30 -> circumference ≈ 188.5; 86% filled
    const circumference = 188.5;
    const filled = circumference * 0.86;

    return (
        <svg viewBox="0 0 400 250" className={className} role="presentation" aria-hidden="true" fill="none">
            <rect width="400" height="250" rx="20" fill="#EEF3FA" />

            {/* Resume sheet */}
            <g transform="translate(44 26)">
                <rect width="210" height="210" rx="14" fill="#FFFFFF" stroke="#D9E0EA" />
                <circle cx="36" cy="38" r="16" fill="#D9E0EA" />
                <circle cx="36" cy="33" r="6" fill="#FFFFFF" />
                <path d="M25.5 47c2-5 6-7.5 10.5-7.5s8.5 2.5 10.5 7.5" fill="#FFFFFF" />
                <rect x="62" y="28" width="96" height="9" rx="4.5" fill="#111827" />
                <rect x="62" y="44" width="68" height="7" rx="3.5" fill="#B8C3D3" />

                <rect x="20" y="74" width="54" height="7" rx="3.5" fill="#071A4D" />
                <rect x="20" y="90" width="170" height="6" rx="3" fill="#E3E9F1" />
                <rect x="20" y="102" width="150" height="6" rx="3" fill="#E3E9F1" />
                <rect x="20" y="114" width="160" height="6" rx="3" fill="#E3E9F1" />

                <rect x="20" y="136" width="46" height="7" rx="3.5" fill="#071A4D" />
                {/* Skill chips */}
                <rect x="20" y="152" width="52" height="20" rx="10" fill="#EEF4FF" />
                <rect x="78" y="152" width="64" height="20" rx="10" fill="#EEF4FF" />
                <rect x="148" y="152" width="42" height="20" rx="10" fill="#EEF4FF" />
                <rect x="20" y="180" width="70" height="6" rx="3" fill="#E3E9F1" />
            </g>

            {/* ATS score card */}
            <g transform="translate(224 40)">
                <rect width="148" height="92" rx="16" fill="#FFFFFF" stroke="#D9E0EA" />
                <circle cx="46" cy="46" r="30" stroke="#E3E9F1" strokeWidth="8" />
                <circle
                    cx="46" cy="46" r="30"
                    stroke="#16A34A" strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${filled} ${circumference}`}
                    transform="rotate(-90 46 46)"
                />
                <text x="46" y="51" textAnchor="middle" fill="#111827" fontSize="15" fontWeight="700">86%</text>
                <text x="88" y="40" fill="#111827" fontSize="12" fontWeight="600">ATS</text>
                <text x="88" y="56" fill="#5B6472" fontSize="11">{t('artMatch')}</text>
            </g>

            {/* Priority badge */}
            <g transform="translate(232 150)">
                <rect width="140" height="44" rx="14" fill="#071A4D" />
                <path d="M22 13.5 25 19.8l6.9 1-5 4.9 1.2 6.9L22 29.3l-6.1 3.3 1.2-6.9-5-4.9 6.9-1 3-6.3Z" fill="#FF8A00" />
                <text x="42" y="20" fill="#FFFFFF" fontSize="12" fontWeight="600">{t('artPriority')}</text>
                <text x="42" y="34" fill="#FFFFFF" fillOpacity="0.7" fontSize="10.5">{t('artApplicant')}</text>
            </g>
        </svg>
    );
}
