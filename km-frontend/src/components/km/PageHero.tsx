import React from 'react';
import type { Icon } from '@phosphor-icons/react';

/**
 * The one hero frame for KaamMilega pages (design.md): navy band with a rounded bottom, the same
 * padding, height and type scale everywhere, text on the left and art on the right. Pages pass
 * their content; spacing and alignment live here.
 *
 * On desktop heroes with art are at least HERO_MIN_HEIGHT tall, and the text and the art are both
 * centred vertically in that row, so the art never leaves an empty band above it. The art has a
 * capped size on every screen (ART_SIZE). Keep descriptions to one sentence of about 90 characters.
 *
 *   overlap  the next block (a search or filter card) overlaps the hero bottom by 40px, as on
 *            Jobs, Events and Mentors: the hero reserves that space below the content.
 */

/** Service identity colours from design.md §3 */
export type HeroTone = 'jobs' | 'instant' | 'skills' | 'experts' | 'services' | 'p2p' | 'events';

const KICKER_TONE: Record<HeroTone, { pill: string; icon: string }> = {
    jobs: { pill: 'bg-[#EBF3FE] text-km-link border-[#BFDBFE] dark:bg-blue-500/15 dark:border-blue-500/30', icon: 'text-km-link' },
    instant: { pill: 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA] dark:bg-orange-500/15 dark:border-orange-500/30 dark:text-orange-300', icon: 'text-[#FF6B00]' },
    skills: { pill: 'bg-[#F0FDF4] text-[#15803D] border-[#BBF7D0] dark:bg-green-500/15 dark:border-green-500/30 dark:text-green-300', icon: 'text-[#16A34A] dark:text-green-300' },
    experts: { pill: 'bg-[#F5F3FF] text-[#6D28D9] border-[#DDD6FE] dark:bg-violet-500/15 dark:border-violet-500/30 dark:text-violet-300', icon: 'text-[#7C3AED] dark:text-violet-300' },
    services: { pill: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA] dark:bg-red-500/15 dark:border-red-500/30 dark:text-red-300', icon: 'text-[#EF4444] dark:text-red-300' },
    p2p: { pill: 'bg-[#F0FDFA] text-[#0F766E] border-[#99F6E4] dark:bg-teal-500/15 dark:border-teal-500/30 dark:text-teal-300', icon: 'text-[#0F9D8A] dark:text-teal-300' },
    events: { pill: 'bg-[#FFFBEB] text-[#B45309] border-[#FDE68A] dark:bg-amber-500/15 dark:border-amber-500/30 dark:text-amber-300', icon: 'text-[#F59E0B]' },
};

/** Frame of the navy band, for headers that need their own inner layout (e.g. a job detail page) */
export const HERO_SHELL =
    'bg-[#071A4D] border-b border-[#0B1F52] text-white rounded-b-[32px] sm:rounded-b-[44px] lg:rounded-b-[52px] relative overflow-hidden font-sans dark:border-white/10';

/** Desktop height of the hero content row, the same on every page */
const HERO_MIN_HEIGHT = 'lg:min-h-[360px]';

/** Art size: hidden on phones (keeps the search above the fold), under the text on tablets, capped in height next to the text on desktop */
const ART_SIZE =
    'w-full max-w-[400px] lg:w-auto lg:max-w-full lg:max-h-[300px] xl:max-h-[340px]';

/** Headline style shared by every hero; wrap the highlighted words in <HeroAccent> */
export const HERO_TITLE = 'text-3xl sm:text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15] text-balance';

export function HeroAccent({ children }: { children: React.ReactNode }) {
    return <span className="text-[#FF6B00]">{children}</span>;
}

interface PageHeroProps {
    /** Small pill above the headline, in the page's service colour */
    kicker?: { label: React.ReactNode; Icon?: Icon; tone: HeroTone };
    /** Replaces the kicker with a brand lockup (e.g. the InstantMilega logo) */
    brand?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Actions, a search field or a form, under the description */
    children?: React.ReactNode;
    /** Short proof points under a divider */
    highlights?: { Icon: Icon; label: React.ReactNode }[];
    /** Right-hand art. `wide` gives it 7 of 12 columns (for art about twice as wide as tall), otherwise 6. */
    art?: { src: string; alt: string; wide?: boolean };
    /** Right-hand content instead of art (e.g. buttons on a compact hero) */
    aside?: React.ReactNode;
    overlap?: boolean;
    /** Match the width of the page content below (defaults to max-w-7xl) */
    width?: 'max-w-7xl' | 'max-w-6xl' | 'max-w-5xl';
}

export default function PageHero({
    kicker,
    brand,
    title,
    description,
    children,
    highlights,
    art,
    aside,
    overlap = false,
    width = 'max-w-7xl',
}: PageHeroProps) {
    const tone = kicker ? KICKER_TONE[kicker.tone] : null;
    const textSpan = art ? (art.wide ? 'lg:col-span-6' : 'lg:col-span-7') : aside ? 'lg:col-span-8' : 'lg:col-span-12';
    const sideSpan = art ? (art.wide ? 'lg:col-span-6' : 'lg:col-span-5') : 'lg:col-span-4';
    // With an overlapping card below, 40px more room at the bottom so the card does not cover the content
    const bottom = overlap ? 'pb-16 sm:pb-[72px] lg:pb-[88px]' : 'pb-8 sm:pb-10 lg:pb-12';

    return (
        <section className={`${HERO_SHELL} pt-8 sm:pt-10 lg:pt-12 ${bottom}`}>
            <div className={`${width} mx-auto px-4 sm:px-6 lg:px-8`}>
                <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 ${art ? HERO_MIN_HEIGHT : ''} items-center`}>
                    <div className={textSpan}>
                        {brand && <div className="mb-5">{brand}</div>}
                        {!brand && kicker && tone && (
                            <div className={`inline-flex items-center gap-2 border text-xs font-semibold px-3.5 py-1.5 rounded-full mb-4 ${tone.pill}`}>
                                {kicker.Icon && <kicker.Icon weight="bold" size={14} className={tone.icon} aria-hidden="true" />}
                                <span>{kicker.label}</span>
                            </div>
                        )}

                        <h1 className={HERO_TITLE}>{title}</h1>

                        {description && (
                            <p className="mt-3.5 text-sm sm:text-base text-white/80 max-w-2xl leading-relaxed">{description}</p>
                        )}

                        {children && <div className="mt-6">{children}</div>}

                        {highlights && highlights.length > 0 && (
                            <ul className="flex flex-wrap items-center gap-x-6 gap-y-3 mt-6 pt-5 border-t border-white/10 text-xs text-white/90 font-medium">
                                {highlights.map(({ Icon: HighlightIcon, label }, i) => (
                                    <li key={i} className="flex items-center gap-2">
                                        <HighlightIcon weight="bold" size={15} className="text-[#10B981] shrink-0" aria-hidden="true" />
                                        <span>{label}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {art && (
                        <div className={`${sideSpan} hidden md:flex justify-center lg:justify-end`}>
                            <img
                                src={art.src}
                                alt={art.alt}
                                className={`${ART_SIZE} h-auto object-contain select-none pointer-events-none drop-shadow-xl block`}
                            />
                        </div>
                    )}

                    {!art && aside && <div className={`${sideSpan} flex lg:justify-end`}>{aside}</div>}
                </div>
            </div>
        </section>
    );
}
