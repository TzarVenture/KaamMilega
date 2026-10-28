import React from 'react';
import { useTranslations } from 'next-intl';
import s from './instantMilegaArt.module.css';

// Animated illustrations for the InstantMilega page. Colours come from the km-* tokens so they
// follow dark mode; motion lives in instantMilegaArt.module.css and stops for reduced motion.

const BLOCKS: [number, number, number, number][] = [
    // x, y, width, height: city blocks between the roads (roads run along x=150, 290 and y=120, 230)
    [16, 16, 123, 93], [161, 16, 118, 93], [301, 16, 163, 93],
    [161, 131, 118, 88], [301, 131, 163, 88],
    [16, 241, 123, 43], [161, 241, 118, 43], [301, 241, 163, 43],
];

/** Customer view: the worker drives to the door, "Arriving in 10 min" turns into "Arrived" */
export function LiveTrackingArt() {
    const t = useTranslations('instantMilega.art.tracking');
    return (
        <svg viewBox="0 0 480 300" className={s.art} role="img" aria-label={t('label')}>
            <rect x="0.5" y="0.5" width="479" height="299" rx="24" fill="var(--km-surface)" stroke="var(--km-border)" />
            {BLOCKS.map(([x, y, w, h]) => (
                <rect key={`${x}-${y}`} x={x} y={y} width={w} height={h} rx="10" fill="var(--km-surface-card)" stroke="var(--km-border-subtle)" />
            ))}
            {/* Park */}
            <rect x="16" y="131" width="123" height="88" rx="10" fill="var(--km-skills)" opacity="0.14" />

            {/* Route: full path dashed, travelled part solid */}
            <path d="M60 230 H290 V120 H410" fill="none" stroke="var(--km-border)" strokeWidth="4" strokeDasharray="2 8" strokeLinecap="round" />
            <path className={s.progress} d="M60 230 H290 V120 H410" pathLength={100} fill="none" stroke="var(--km-instant)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            <circle cx="60" cy="230" r="5" fill="var(--km-text-muted)" />

            {/* Customer's home */}
            <g transform="translate(410 120)">
                <path d="M0 0 C-4 -10 -18 -18 -18 -32 A18 18 0 0 1 18 -32 C18 -18 4 -10 0 0 Z" fill="var(--km-instant)" />
                <path d="M-8 -30 L0 -38 L8 -30 V-23 H-8 Z" fill="#FFFFFF" />
            </g>

            {/* Worker */}
            <g className={s.marker}>
                <circle r="16" fill="#0B5ED7" stroke="var(--km-surface-card)" strokeWidth="3" />
                <circle cy="-4" r="4" fill="#FFFFFF" />
                <path d="M-7 8 A7 6 0 0 1 7 8 Z" fill="#FFFFFF" />
            </g>

            {/* Arrival time */}
            <rect x="24" y="24" width="214" height="44" rx="22" fill="var(--km-surface-card)" stroke="var(--km-border)" />
            <circle cx="46" cy="46" r="8" fill="none" stroke="var(--km-instant)" strokeWidth="2" />
            <path d="M46 41.5 V46 L49.5 48" fill="none" stroke="var(--km-instant)" strokeWidth="2" strokeLinecap="round" />
            <text x="62" y="52" fontSize="16" fontWeight="600" fill="var(--km-text-primary)" className={s.eta}>
                {t('eta')}
            </text>
            <text x="62" y="52" fontSize="16" fontWeight="600" fill="var(--km-text-primary)" className={s.arrived}>
                {t('arrived')}
            </text>
        </svg>
    );
}

/** Worker view: a work alert with the 120-second timer, then "Accepted" */
export function WorkAlertArt() {
    const t = useTranslations('instantMilega.art.alert');
    return (
        <svg viewBox="0 0 480 300" className={s.art} role="img" aria-label={t('label')}>
            <rect x="0.5" y="0.5" width="479" height="299" rx="24" fill="var(--km-surface)" stroke="var(--km-border)" />
            <rect x="60" y="40" width="360" height="220" rx="20" fill="var(--km-surface-card)" stroke="var(--km-border)" />

            <g transform="translate(94 66)">
                <g className={s.bell}>
                    <path d="M-8 14 V8 A8 8 0 0 1 8 8 V14 L10 17 H-10 Z" fill="var(--km-instant)" />
                    <circle cy="20" r="2.5" fill="var(--km-instant)" />
                </g>
            </g>
            <text x="114" y="86" fontSize="15" fontWeight="500" fill="var(--km-text-secondary)">{t('newWork')}</text>
            <text x="84" y="128" fontSize="22" fontWeight="600" fill="var(--km-text-primary)">{t('job')}</text>
            <text x="84" y="156" fontSize="15" fill="var(--km-text-secondary)">{t('distance')}</text>

            {/* 120-second timer */}
            <circle cx="360" cy="112" r="30" fill="none" stroke="var(--km-border)" strokeWidth="6" />
            <circle className={s.timer} cx="360" cy="112" r="30" pathLength={100} fill="none" stroke="var(--km-instant)" strokeWidth="6" strokeLinecap="round" transform="rotate(-90 360 112)" />
            <text x="360" y="118" fontSize="16" fontWeight="600" textAnchor="middle" fill="var(--km-text-primary)">{t('seconds')}</text>

            {/* Actions */}
            <rect x="84" y="186" width="150" height="48" rx="12" fill="none" stroke="var(--km-border)" strokeWidth="1.5" />
            <text x="159" y="216" fontSize="16" fontWeight="600" textAnchor="middle" fill="var(--km-text-primary)">{t('decline')}</text>
            <g className={s.accept}>
                <rect x="246" y="186" width="150" height="48" rx="12" fill="var(--km-instant)" />
                <text x="321" y="216" fontSize="16" fontWeight="600" textAnchor="middle" fill="#FFFFFF">{t('accept')}</text>
            </g>
            <g className={s.accepted}>
                <rect x="246" y="186" width="150" height="48" rx="12" fill="#16A34A" />
                <path d="M264 210 l5 5 l10 -11" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                <text x="335" y="216" fontSize="16" fontWeight="600" textAnchor="middle" fill="#FFFFFF">{t('accepted')}</text>
            </g>
        </svg>
    );
}

const START = ['4', '8', '2', '1'];
const FINISH = ['7', '3', '9', '0'];
const START_CLASSES = [s.s1, s.s2, s.s3, s.s4];
const FINISH_CLASSES = [s.f1, s.f2, s.f3, s.f4];

function CodeRow({ y, label, digits, classes, checkClass, done }: { y: number; label: string; digits: string[]; classes: string[]; checkClass: string; done: string }) {
    return (
        <g>
            <text x="40" y={y} fontSize="16" fontWeight="600" fill="var(--km-text-primary)">{label}</text>
            {digits.map((d, i) => (
                <g key={i}>
                    <rect x={40 + i * 72} y={y + 16} width="60" height="68" rx="12" fill="var(--km-surface-card)" stroke="var(--km-border)" strokeWidth="1.5" />
                    <text x={70 + i * 72} y={y + 61} fontSize="28" fontWeight="600" textAnchor="middle" fill="var(--km-heading)" className={classes[i]}>
                        {d}
                    </text>
                </g>
            ))}
            <g className={checkClass}>
                <circle cx="362" cy={y + 50} r="20" fill="#16A34A" />
                <path d={`M353 ${y + 50} l6 6 l12 -13`} fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                <text x="392" y={y + 56} fontSize="16" fontWeight="600" fill="var(--km-text-primary)">{done}</text>
            </g>
        </g>
    );
}

/** The two codes that start and close every job */
export function CodesArt() {
    const t = useTranslations('instantMilega.art.codes');
    return (
        <svg viewBox="0 0 480 300" className={s.art} role="img" aria-label={t('label')}>
            <rect x="0.5" y="0.5" width="479" height="299" rx="24" fill="var(--km-surface)" stroke="var(--km-border)" />
            <CodeRow y={40} label={t('start')} digits={START} classes={START_CLASSES} checkClass={s.sc} done={t('started')} />
            <CodeRow y={168} label={t('finish')} digits={FINISH} classes={FINISH_CLASSES} checkClass={s.fc} done={t('done')} />
        </svg>
    );
}
