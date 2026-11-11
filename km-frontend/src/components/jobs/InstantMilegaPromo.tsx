import Link from 'next/link';
import { CaretRightIcon } from '@phosphor-icons/react';
import { FEATURES } from '@/config/features';

/** Link to Instant Milega shown with the job type filters */
export default function InstantMilegaPromo() {
    if (!FEATURES.INSTANT_MILEGA) return null;

    return (
        <Link
            href="/instant-milega?mode=work"
            className="mt-2 flex items-center gap-2.5 rounded-xl bg-[#071A4D] px-3 py-2.5 text-white hover:bg-[#0B2463] transition-colors dark:bg-km-primary"
        >
            {/* The text logo is white, so it needs the navy background */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/instantMilega-logo-icon.png" alt="" className="h-7 w-auto shrink-0" />
            <span className="min-w-0 flex-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/instantMilega-logo-text.png" alt="Instant Milega" className="h-3.5 w-auto" />
                <span className="mt-1 block text-xs text-white/80">Work today, near you</span>
            </span>
            <CaretRightIcon weight="bold" size={14} className="shrink-0 text-white/80" aria-hidden="true" />
        </Link>
    );
}
