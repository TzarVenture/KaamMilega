'use client';

import React, { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import CandidateInstantMilegaView from '@/components/instant-milega/CandidateInstantMilegaView';

function InstantMilegaPageContent() {
    const searchParams = useSearchParams();
    const roleParam = searchParams.get('role') || '';
    const locationParam = searchParams.get('location') || '';

    return (
        <main className="min-h-screen bg-[#F4F7FB] font-sans antialiased">
            {/* Candidate Instant Milega Real-Time Experience */}
            <CandidateInstantMilegaView
                initialRole={roleParam}
                initialLocation={locationParam}
            />
        </main>
    );
}

export default function InstantMilegaPage() {
    return (
        <Suspense fallback={
            <div className="min-h-[60vh] bg-[#F4F7FB] flex items-center justify-center">
                <div className="flex flex-col items-center gap-3">
                    <div className="w-10 h-10 border-3 border-[#071A4D] border-t-[#FF6B00] rounded-full animate-spin" />
                    <p className="text-xs font-bold text-slate-600">Loading InstantMilega...</p>
                </div>
            </div>
        }>
            <InstantMilegaPageContent />
        </Suspense>
    );
}
