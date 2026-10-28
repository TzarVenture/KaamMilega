import React from 'react';
import type { Icon } from '@phosphor-icons/react';

/**
 * The one hero frame for KaamMilega pages (design.md §5.5): navy band with a rounded bottom, the same
 * padding, height and type scale everywhere, copy on the left and art on the right. Pages pass
 * their content; spacing and alignment live here.
 *
 * Copy follows PREP: Point (title), Reason (one-sentence description, 90 characters max), Example
 * (highlights), then the action (children: buttons, a search or a form).
 *
 * The art is grounded: it stands on the bottom edge of the band and its cropped bottom fades into
 * the navy, so it never floats as a sticker. On phones it sits under the copy, smaller.
 *
 *   overlap  the next block (a search or filter card) overlaps the hero bottom by 40px, as on
 *            Jobs, Events and Mentors: the copy keeps clear of it and the card covers the art foot.
 */

/** Service identity colours from design.md §3, in their light tints so they read on the navy band */
export type HeroTone = 'jobs' | 'instant' | 'skills' | 'experts' | 'services' | 'p2p' | 'events';

const EYEBROW_TONE: Record<HeroTone, string> = {
    jobs: 'text-[#93C5FD]',
    instant: 'text-[#FDBA74]',
    skills: 'text-[#86EFAC]',
    experts: 'text-[#C4B5FD]',
    services: 'text-[#FCA5A5]',
    p2p: 'text-[#5EEAD4]',
    events: 'text-[#FCD34D]',
};

/** Frame of the navy band, for headers that need their own inner layout (e.g. a job detail page) */
export const HERO_SHELL =
    'bg-[#071A4D] border-b border-[#0B1F52] text-white rounded-b-[32px] sm:rounded-b-[44px] lg:rounded-b-[52px] relative overflow-hidden font-sans dark:border-white/10';

/** Desktop height of the hero content row, the same on every page */
const HERO_MIN_HEIGHT = 'lg:min-h-[360px]';

/**
 * Art: grounded on the band's bottom edge, its lower 18% fading into the navy. Capped by height on
 * desktop so every page's art has the same presence, by width on phones and tablets.
 */
const ART_CLASS =
    'block w-full max-w-[300px] sm:max-w-[380px] lg:w-auto lg:max-w-full lg:max-h-[320px] xl:max-h-[350px] h-auto object-contain select-none pointer-events-none [mask-image:linear-gradient(to_bottom,black_82%,transparent)]';

/** Headline style shared by every hero; wrap the highlighted words in <HeroAccent> */
export const HERO_TITLE = 'text-3xl sm:text-4xl xl:text-5xl font-extrabold text-white tracking-tight leading-[1.15] text-balance';

export function HeroAccent({ children }: { children: React.ReactNode }) {
    return <span className="text-[#FF6B00]">{children}</span>;
}

interface PageHeroProps {
    /** Eyebrow above the headline: plain icon + label in the page's service colour (design.md §5.3) */
    kicker?: { label: React.ReactNode; Icon?: Icon; tone: HeroTone };
    /** Replaces the kicker with a brand lockup (e.g. the InstantMilega logo) */
    brand?: React.ReactNode;
    title: React.ReactNode;
    description?: React.ReactNode;
    /** Actions, a search field or a form, under the description */
    children?: React.ReactNode;
    /** Three short proof points (two to four words each) */
    highlights?: { Icon: Icon; label: React.ReactNode }[];
    /** Right-hand art with a cropped bottom edge. `wide` gives it 7 of 12 columns (art about twice as wide as tall), otherwise 5. */
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
    const eyebrow = kicker ? EYEBROW_TONE[kicker.tone] : null;
    const textSpan = art ? (art.wide ? 'lg:col-span-5' : 'lg:col-span-7') : aside ? 'lg:col-span-8' : 'lg:col-span-12';
    const sideSpan = art ? (art.wide ? 'lg:col-span-7' : 'lg:col-span-5') : 'lg:col-span-4';
    // With art the band has no bottom padding (the art stands on the edge) and the copy carries it;
    // an overlapping card needs 40px more so it never covers the copy
    const copyBottom = overlap ? 'lg:pb-[88px]' : 'lg:pb-12';
    const bottom = art ? 'pb-0' : overlap ? 'pb-16 sm:pb-[72px] lg:pb-[88px]' : 'pb-8 sm:pb-10 lg:pb-12';

    return (
        <section className={`${HERO_SHELL} pt-8 sm:pt-10 lg:pt-12 ${bottom}`}>
            <div className={`${width} mx-auto px-4 sm:px-6 lg:px-8`}>
                <div className={`grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 ${art ? `${HERO_MIN_HEIGHT} lg:items-stretch` : 'items-center'}`}>
                    <div className={`${textSpan} ${art ? `lg:self-center lg:pt-2 ${copyBottom}` : ''}`}>
                        {brand && <div className="mb-5">{brand}</div>}
                        {!brand && kicker && eyebrow && (
                            <p className={`flex items-center gap-2 text-[13px] font-semibold mb-3 ${eyebrow}`}>
                                {kicker.Icon && <kicker.Icon weight="bold" size={16} className="shrink-0" aria-hidden="true" />}
                                <span>{kicker.label}</span>
                            </p>
                        )}

                        <h1 className={HERO_TITLE}>{title}</h1>

                        {description && (
                            <p className="mt-3.5 text-[15px] sm:text-base text-white/80 max-w-2xl leading-relaxed">{description}</p>
                        )}

                        {children && <div className="mt-6">{children}</div>}

                        {highlights && highlights.length > 0 && (
                            // Phones: three columns, icon above a short label. Larger screens: one row.
                            <ul className="grid grid-cols-3 gap-3 sm:flex sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-3 mt-6 pt-5 border-t border-white/10 text-[11px] sm:text-xs leading-snug text-white/90 font-medium">
                                {highlights.map(({ Icon: HighlightIcon, label }, i) => (
                                    <li key={i} className="flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:gap-2">
                                        <HighlightIcon weight="bold" size={16} className="text-[#10B981] shrink-0" aria-hidden="true" />
                                        <span>{label}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {art && (
                        <div className={`${sideSpan} flex items-end justify-center lg:justify-end`}>
                            <img src={art.src} alt={art.alt} className={ART_CLASS} />
                        </div>
                    )}

                    {!art && aside && <div className={`${sideSpan} flex lg:justify-end`}>{aside}</div>}
                </div>
            </div>
        </section>
    );
}
