import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import InstantMilegaLandingShowcase from '@/components/instant-milega/InstantMilegaLandingShowcase';
import type { AppInterest } from '@/components/km/AppDownload';
import { FEATURES } from '@/config/features';

export const metadata: Metadata = {
    title: 'InstantMilega: local help and work in minutes | KaamMilega',
    description:
        'Book a verified worker nearby or get work alerts near you, with live tracking and start and finish codes. Coming soon in the KaamMilega app for Android and iOS.',
    alternates: { canonical: '/instant-milega' },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || '';

export default async function InstantMilegaPage({ searchParams }: { searchParams: SearchParams }) {
    if (!FEATURES.INSTANT_MILEGA) {
        notFound();
    }

    // ?mode=hire|work wins. Otherwise ?role=recruiter (set by middleware for recruiters) means
    // hiring, and any other ?role is a trade from the home page "Find instant gigs" search.
    const params = await searchParams;
    const modeParam = first(params.mode).toLowerCase();
    const role = first(params.role).trim();
    const isRecruiter = role.toLowerCase() === 'recruiter';

    const initialMode: AppInterest =
        modeParam === 'hire' || modeParam === 'work' ? modeParam : role && !isRecruiter ? 'work' : 'hire';
    const trade = role && !isRecruiter ? role.slice(0, 60) : undefined;

    return <InstantMilegaLandingShowcase initialMode={initialMode} trade={trade} />;
}
