import React from 'react';
import type { Icon } from '@phosphor-icons/react';
import { HeroAccent, type HeroTone } from '@/components/km/PageHero';

export { HeroAccent };

const EYEBROW_TONE: Record<HeroTone, string> = {
    jobs: 'text-[#93C5FD]',
    instant: 'text-[#FDBA74]',
    skills: 'text-[#86EFAC]',
    experts: 'text-[#C4B5FD]',
    services: 'text-[#FCA5A5]',
    p2p: 'text-[#5EEAD4]',
    events: 'text-[#FCD34D]',
};

interface RecruiterBannerProps {
    kicker: { label: React.ReactNode; Icon: Icon; tone: HeroTone };
    title: React.ReactNode;
    description: React.ReactNode;
    /** Two or three short proof points */
    highlights?: { Icon: Icon; label: React.ReactNode }[];
    /** Buttons under the copy */
    children?: React.ReactNode;
    art: { src: string; alt: string };
}

/**
 * The page header for pages inside the employer portal: the navy band of PageHero, sized for the
 * column next to the sidebar. Copy on the left, art standing on the bottom edge on the right
 * (hidden on phones, where the column is too narrow for both).
 */
export default function RecruiterBanner({ kicker, title, description, highlights, children, art }: RecruiterBannerProps) {
    const { Icon: KickerIcon } = kicker;
    return (
        <header className="km-on-dark relative overflow-hidden rounded-3xl border border-[#0B1F52] bg-[#071A4D] text-white dark:border-[#1E2A4F]">
            <div className="grid md:grid-cols-[1fr_minmax(0,300px)] lg:grid-cols-[1fr_minmax(0,360px)]">
                <div className="relative z-10 p-6 sm:p-8">
                    <p className={`flex items-center gap-1.5 text-sm font-semibold ${EYEBROW_TONE[kicker.tone]}`}>
                        <KickerIcon size={16} weight="bold" aria-hidden="true" />
                        {kicker.label}
                    </p>
                    <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight leading-[1.2] text-white text-balance">{title}</h1>
                    <p className="mt-3 max-w-xl text-sm sm:text-base leading-relaxed text-[#C7D2FE]">{description}</p>
                    {highlights && highlights.length > 0 && (
                        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
                            {highlights.map(({ Icon, label }, i) => (
                                <li key={i} className="flex items-center gap-1.5 text-sm text-white">
                                    <Icon size={18} weight="duotone" className="shrink-0 text-[#FF6B00]" aria-hidden="true" />
                                    {label}
                                </li>
                            ))}
                        </ul>
                    )}
                    {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
                </div>
                <div className="relative hidden md:flex items-end justify-center pr-6">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={art.src}
                        alt={art.alt}
                        className="block w-full max-h-[260px] object-contain object-bottom select-none pointer-events-none [mask-image:linear-gradient(to_bottom,black_85%,transparent)]"
                    />
                </div>
            </div>
        </header>
    );
}
