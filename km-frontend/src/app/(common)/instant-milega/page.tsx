'use client';

import React, { Suspense } from 'react';
import { notFound } from 'next/navigation';
import InstantMilegaLandingShowcase from '@/components/instant-milega/InstantMilegaLandingShowcase';
import { FEATURES } from '@/config/features';

export default function InstantMilegaPage() {
    if (!FEATURES.INSTANT_MILEGA) {
        notFound();
    }

    return (
        <Suspense
            fallback={
                <div className="min-h-[60vh] bg-km-surface flex items-center justify-center">
                    <div className="flex flex-col items-center gap-3">
                        <div className="w-8 h-8 border-2 border-[#071A4D] border-t-[#FF6B00] rounded-full animate-spin dark:border-km-link" />
                        <p className="text-xs font-semibold text-km-text-secondary">Loading Instant Milega...</p>
                    </div>
                </div>
            }
        >
            <InstantMilegaLandingShowcase />
        </Suspense>
    );
}
