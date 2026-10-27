'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import type { Icon } from '@phosphor-icons/react';
import {
    AirplaneTiltIcon,
    BellRingingIcon,
    BuildingOfficeIcon,
    CaretDownIcon,
    ChatsCircleIcon,
    CheckIcon,
    IdentificationCardIcon,
    MapPinAreaIcon,
    MapTrifoldIcon,
    PackageIcon,
    PasswordIcon,
    PhoneCallIcon,
    ReceiptIcon,
    ShieldCheckIcon,
    ShoppingBagIcon,
    StarIcon,
    StorefrontIcon,
    TimerIcon,
    ToggleRightIcon,
    WalletIcon,
    WarehouseIcon,
    WrenchIcon,
} from '@phosphor-icons/react';
import { AppNotifyForm, AppQrCode, StoreBadges, type AppInterest } from '@/components/km/AppDownload';
import { CodesArt, LiveTrackingArt, WorkAlertArt } from './InstantMilegaArt';

// InstantMilega runs in the KaamMilega mobile app only (it needs live location and tracking). This
// page introduces it and gets people to the app: "Coming soon" + notify-me until the store links
// are set (config/appLinks.ts), then store badges and a QR code.
// Facts on this page come from the client's answers (docs/client_queries_full_qa.md).

type Step = { Icon: Icon; title: string; text: string };

const STEPS: Record<AppInterest, Step[]> = {
    hire: [
        { Icon: MapPinAreaIcon, title: 'Choose a service', text: 'Pick what you need and share your location.' },
        { Icon: StarIcon, title: 'Get matched', text: 'Choose a worker yourself, or let the app send it to the best-rated worker nearby.' },
        { Icon: PasswordIcon, title: 'Start code on arrival', text: 'Track them on the map. When they arrive, share your start code.' },
        { Icon: ReceiptIcon, title: 'Finish code and pay', text: 'When the work is done, share your finish code and pay in the app. You get a bill.' },
    ],
    work: [
        { Icon: IdentificationCardIcon, title: 'Get verified', text: 'Add Aadhaar, PAN and bank details. Our team checks them the same day.' },
        { Icon: ToggleRightIcon, title: 'Go Free now', text: 'Turn on Free now when you are ready, and get alerts for work near you.' },
        { Icon: TimerIcon, title: 'Accept in 120 seconds', text: 'See the work, the place and the pay. Accept it and head to the customer.' },
        { Icon: WalletIcon, title: 'Get paid', text: 'The finish code closes the job. Your money lands in your wallet; withdraw it instantly.' },
    ],
};

// Launch services chosen by the client (Q24)
const SERVICES: { Icon: Icon; label: string }[] = [
    { Icon: WrenchIcon, label: 'Plumber' },
    { Icon: WarehouseIcon, label: 'Warehouse worker' },
    { Icon: PackageIcon, label: 'Loader and unloader' },
    { Icon: BuildingOfficeIcon, label: 'Office boy' },
    { Icon: StorefrontIcon, label: 'Retail executive' },
    { Icon: AirplaneTiltIcon, label: 'Airport assistant' },
    { Icon: ShoppingBagIcon, label: 'Mall assistant' },
];

const TRUST: Step[] = [
    { Icon: ShieldCheckIcon, title: 'Verified workers', text: 'Aadhaar, PAN and bank checked by our team, with at least 2 years of experience.' },
    { Icon: ChatsCircleIcon, title: 'Help when you need it', text: 'Support by in-app chat, phone and WhatsApp.' },
    { Icon: StarIcon, title: 'Better rated first', text: 'Higher-rated workers get your request first, even if a little farther away.' },
    { Icon: ReceiptIcon, title: 'Paid in the app', text: 'Online payment only, with a bill for every job.' },
];

const PASS_POINTS = [
    '10 bookings or gigs, or 90 days, whichever comes first',
    'Covers InstantMilega, chats and 10 mentors',
    'Every booking counts, even a cancelled one; unused ones lapse',
    'Full refund if you have not used it',
];

const LANGUAGES = [
    { label: 'English', lang: 'en' },
    { label: 'हिन्दी', lang: 'hi' },
    { label: 'मराठी', lang: 'mr' },
    { label: 'ગુજરાતી', lang: 'gu' },
];

// App screenshots go here once the app team shares them ({ src, alt }); the section stays hidden
// while the list is empty.
const APP_SCREENS: { src: string; alt: string }[] = [];

const FAQ: { q: string; a: React.ReactNode }[] = [
    {
        q: 'Why only in the app?',
        a: (
            <>
                InstantMilega needs your live location for matching, alerts and tracking, which works reliably only in the app. Jobs, skills,
                experts and events stay on the website as they are.{' '}
                <Link href="/jobs" className="font-medium text-km-link hover:underline">
                    Browse jobs
                </Link>
            </>
        ),
    },
    {
        q: 'When does the app launch?',
        a: 'Soon, on Android and iOS. Leave your number on this page and we will tell you the day it is live.',
    },
    {
        q: 'What does it cost?',
        a: 'Creating a profile, looking around and your first 3 chats are free. Booking or taking work needs the ₹99 pass. KaamMilega takes no commission on the service itself; if a small platform fee applies, you see it before you confirm.',
    },
    {
        q: 'What if no worker accepts?',
        a: 'Each worker gets 120 seconds, then the request moves on. If nobody is free, you can pick another time or offer a higher rate.',
    },
    {
        q: 'Can I cancel?',
        a: 'Before a worker accepts, you get a full refund. Once they are on the way, a small fee goes to the worker; after they arrive, a visit fee. Cancelled bookings count towards your pass.',
    },
    {
        q: 'Who pays for extra parts?',
        a: 'Parts or extra material are paid to the worker directly. The service itself is paid online in the app.',
    },
    {
        q: 'Can I hire and work from the same account?',
        a: 'Yes. One KaamMilega account lets you hire, work and find jobs; switch between Hire and Work at the top of the app.',
    },
];

function ModeSwitch({ mode, onChange }: { mode: AppInterest; onChange: (m: AppInterest) => void }) {
    return (
        <div role="radiogroup" aria-label="I want to" className="inline-flex p-1 rounded-xl bg-white/10 border border-white/15">
            {(['hire', 'work'] as const).map((value) => (
                <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={mode === value}
                    onClick={() => onChange(value)}
                    className={`px-5 h-10 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                        mode === value ? 'bg-white text-[#071A4D]' : 'text-white/80 hover:text-white'
                    }`}
                >
                    {value === 'hire' ? 'Hire' : 'Work'}
                </button>
            ))}
        </div>
    );
}

function SectionHeading({ id, title, text }: { id: string; title: string; text?: string }) {
    return (
        <div className="max-w-2xl">
            <h2 id={id} className="text-2xl sm:text-3xl font-bold text-km-heading tracking-tight">{title}</h2>
            {text && <p className="mt-2 text-base text-km-text-secondary">{text}</p>}
        </div>
    );
}

interface Props {
    initialMode: AppInterest;
    /** Trade from the home page search (?role=Electrician), kept with a "work" sign-up */
    trade?: string;
}

export default function InstantMilegaLandingShowcase({ initialMode, trade }: Props) {
    const [mode, setMode] = useState<AppInterest>(initialMode);
    const isHire = mode === 'hire';

    return (
        <div className="flex flex-col bg-km-surface font-sans antialiased">
            {/* Hero */}
            <section className="bg-[#071A4D] text-white rounded-b-[32px] sm:rounded-b-[48px] overflow-hidden">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 lg:pt-12">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-end">
                        <div className="lg:col-span-6 pb-2 lg:pb-14">
                            <div className="flex items-end gap-3 mb-6">
                                <img src="/instantMilega-logo-icon.png" alt="" className="h-12 sm:h-14 w-auto" />
                                <img src="/instantMilega-logo-text.png" alt="InstantMilega" className="h-8 sm:h-10 w-auto mb-1" />
                            </div>

                            <ModeSwitch mode={mode} onChange={setMode} />

                            <h1 className="mt-6 text-3xl sm:text-4xl lg:text-[44px] font-bold tracking-tight leading-[1.15]">
                                {isHire ? (
                                    <>
                                        Help at your door, <span className="text-[#FF8A33]">in minutes</span>
                                    </>
                                ) : (
                                    <>
                                        Work near you, <span className="text-[#FF8A33]">in minutes</span>
                                    </>
                                )}
                            </h1>
                            <p className="mt-4 text-base sm:text-lg text-white/80 max-w-xl">
                                {isHire
                                    ? 'Book a verified worker nearby, see them coming on the map, and pay in the app.'
                                    : 'Turn on Free now, get work alerts from customers nearby, and withdraw your earnings instantly.'}
                            </p>

                            <div className="mt-8">
                                <AppNotifyForm interest={mode} trade={isHire ? undefined : trade} tone="onDark" id="hero-notify-mobile" />
                            </div>
                            <div className="mt-6 flex flex-wrap items-center gap-6">
                                <StoreBadges tone="onDark" />
                                <AppQrCode tone="onDark" />
                            </div>
                        </div>

                        <div className="lg:col-span-6 flex justify-center lg:justify-end">
                            <img
                                src="/instantMilega-page-hero-art.png"
                                alt="A customer finding verified workers nearby on the InstantMilega map"
                                className="w-full max-w-[560px] lg:max-w-[640px] h-auto block rounded-t-3xl"
                            />
                        </div>
                    </div>
                </div>
            </section>

            <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-14 sm:py-20 space-y-16 sm:space-y-24">
                {/* How it works (follows the Hire / Work switch) */}
                <section aria-labelledby="how-title">
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                        <div className="max-w-2xl">
                            <h2 id="how-title" className="text-2xl sm:text-3xl font-bold text-km-heading tracking-tight">
                                {isHire ? 'How booking works' : 'How you get work'}
                            </h2>
                            <p className="mt-2 text-base text-km-text-secondary">
                                {isHire ? 'Four steps from request to finished job.' : 'Four steps from sign-up to money in your bank.'}
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMode(isHire ? 'work' : 'hire')}
                            className="self-start sm:self-auto text-sm font-semibold text-km-link hover:underline cursor-pointer"
                        >
                            {isHire ? 'Looking for work instead?' : 'Want to hire instead?'}
                        </button>
                    </div>
                    <ol className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {STEPS[mode].map(({ Icon, title, text }, i) => (
                            <li key={title} className="bg-km-surface-card rounded-2xl border border-km-border p-6">
                                <Icon size={36} weight="duotone" className="text-km-instant" aria-hidden="true" />
                                <p className="mt-4 text-sm font-medium text-km-text-secondary">Step {i + 1}</p>
                                <h3 className="mt-1 text-lg font-semibold text-km-text-primary">{title}</h3>
                                <p className="mt-1.5 text-sm text-km-text-secondary leading-relaxed">{text}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* The 120-second alert and the two codes */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[
                        {
                            Art: WorkAlertArt,
                            title: '120 seconds to respond',
                            text: 'Each request goes to one worker at a time. If they do not accept in 120 seconds, it moves to the next.',
                        },
                        {
                            Art: CodesArt,
                            title: 'Start and finish codes',
                            text: 'Work starts only with the customer’s start code and closes only with their finish code.',
                        },
                    ].map(({ Art, title, text }) => (
                        <div key={title} className="bg-km-surface-card rounded-3xl border border-km-border p-4 sm:p-6">
                            <Art />
                            <h2 className="mt-6 text-xl font-bold text-km-heading tracking-tight">{title}</h2>
                            <p className="mt-1.5 text-base text-km-text-secondary">{text}</p>
                        </div>
                    ))}
                </section>

                {/* Live map */}
                <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center" aria-labelledby="map-title">
                    <div className="lg:col-span-7 order-last lg:order-first">
                        <LiveTrackingArt />
                    </div>
                    <div className="lg:col-span-5">
                        <h2 id="map-title" className="text-2xl sm:text-3xl font-bold text-km-heading tracking-tight">
                            Know where they are
                        </h2>
                        <ul className="mt-6 space-y-5">
                            {[
                                { Icon: MapTrifoldIcon, title: 'Live map', text: 'Follow the worker on the way to you, like a cab ride.' },
                                { Icon: TimerIcon, title: 'Arrival time', text: 'See when they will reach, for example "Arriving in 10 min".' },
                                { Icon: PhoneCallIcon, title: 'Chat and call', text: 'Talk in the app, or call their number once the booking is confirmed.' },
                                { Icon: BellRingingIcon, title: 'Instant alerts', text: 'Workers hear about new work nearby even when the app is closed.' },
                            ].map(({ Icon, title, text }) => (
                                <li key={title} className="flex items-start gap-4">
                                    <Icon size={28} weight="duotone" className="text-km-instant shrink-0" aria-hidden="true" />
                                    <div>
                                        <h3 className="text-base font-semibold text-km-text-primary">{title}</h3>
                                        <p className="mt-0.5 text-sm text-km-text-secondary">{text}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Launch services */}
                <section aria-labelledby="services-title">
                    <SectionHeading id="services-title" title="Launching with" text="More services will follow after launch." />
                    <ul className="mt-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {SERVICES.map(({ Icon, label }) => (
                            <li
                                key={label}
                                className="flex flex-col items-center text-center gap-3 bg-km-surface-card rounded-2xl border border-km-border px-3 py-6"
                            >
                                <Icon size={36} weight="duotone" className="text-km-heading" aria-hidden="true" />
                                <span className="text-sm font-medium text-km-text-primary">{label}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Trust */}
                <section aria-labelledby="trust-title">
                    <h2 id="trust-title" className="text-2xl sm:text-3xl font-bold text-km-heading tracking-tight">
                        Safe for both sides
                    </h2>
                    <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {TRUST.map(({ Icon, title, text }) => (
                            <li key={title}>
                                <Icon size={28} weight="duotone" className="text-km-instant" aria-hidden="true" />
                                <h3 className="mt-3 text-base font-semibold text-km-text-primary">{title}</h3>
                                <p className="mt-1 text-sm text-km-text-secondary leading-relaxed">{text}</p>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* ₹99 pass */}
                <section
                    aria-labelledby="pass-title"
                    className="bg-km-surface-card rounded-3xl border border-km-border p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center"
                >
                    <div className="lg:col-span-5">
                        <p className="text-5xl font-bold text-km-heading tracking-tight">₹99</p>
                        <h2 id="pass-title" className="mt-3 text-2xl font-bold text-km-heading tracking-tight">
                            One pass for all of KaamMilega
                        </h2>
                        <p className="mt-2 text-base text-km-text-secondary">
                            The same pass for customers and workers. No commission on the service itself.
                        </p>
                    </div>
                    <ul className="lg:col-span-7 space-y-4">
                        {PASS_POINTS.map((point) => (
                            <li key={point} className="flex items-start gap-3 text-base text-km-text-primary">
                                <CheckIcon size={18} weight="bold" className="text-emerald-600 shrink-0 mt-1" aria-hidden="true" />
                                <span>{point}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* App screens (filled in once the app team shares them) */}
                {APP_SCREENS.length > 0 && (
                    <section aria-labelledby="screens-title">
                        <SectionHeading id="screens-title" title="A look inside the app" />
                        <div className="mt-8 flex gap-4 overflow-x-auto pb-2 snap-x">
                            {APP_SCREENS.map((s) => (
                                <img key={s.src} src={s.src} alt={s.alt} className="h-[480px] w-auto rounded-3xl border border-km-border snap-start" />
                            ))}
                        </div>
                    </section>
                )}

                {/* Languages and coverage */}
                <section aria-labelledby="lang-title" className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h2 id="lang-title" className="text-2xl font-bold text-km-heading tracking-tight">
                            In your language, across India
                        </h2>
                        <p className="mt-2 text-base text-km-text-secondary">Use the app in any of these languages.</p>
                    </div>
                    <ul className="flex flex-wrap gap-x-8 gap-y-3">
                        {LANGUAGES.map(({ label, lang }) => (
                            <li key={lang} lang={lang} className="text-xl font-semibold text-km-text-primary">
                                {label}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* FAQ */}
                <section aria-labelledby="faq-title" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4">
                        <h2 id="faq-title" className="text-2xl sm:text-3xl font-bold text-km-heading tracking-tight">
                            Questions
                        </h2>
                    </div>
                    <div className="lg:col-span-8 divide-y divide-km-border border-y border-km-border">
                        {FAQ.map(({ q, a }) => (
                            <details key={q} className="group py-5">
                                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-base font-semibold text-km-text-primary [&::-webkit-details-marker]:hidden">
                                    {q}
                                    <CaretDownIcon size={18} className="shrink-0 text-km-text-secondary transition-transform group-open:rotate-180" aria-hidden="true" />
                                </summary>
                                <p className="mt-3 text-sm sm:text-base text-km-text-secondary leading-relaxed">{a}</p>
                            </details>
                        ))}
                    </div>
                </section>
            </main>

            {/* Closing download band */}
            <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
                <div className="bg-[#071A4D] text-white rounded-3xl p-6 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-6">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Be the first to know</h2>
                        <p className="mt-2 text-base text-white/80">
                            The KaamMilega app is coming to Android and iOS. Hire, work and find jobs from one account.
                        </p>
                        <div className="mt-6 flex flex-wrap items-center gap-6">
                            <StoreBadges tone="onDark" />
                            <AppQrCode tone="onDark" />
                        </div>
                    </div>
                    <div className="lg:col-span-6">
                        <AppNotifyForm interest={mode} trade={isHire ? undefined : trade} tone="onDark" id="footer-notify-mobile" />
                    </div>
                </div>
            </section>
        </div>
    );
}
