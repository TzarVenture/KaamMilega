'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
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
import { LOCALES, LOCALE_NAMES } from '@/i18n/config';
import { CodesArt, LiveTrackingArt, WorkAlertArt } from './InstantMilegaArt';

// InstantMilega runs in the KaamMilega mobile app only (it needs live location and tracking). This
// page introduces it and gets people to the app: "Coming soon" + notify-me until the store links
// are set (config/appLinks.ts), then store badges and a QR code.
// Facts on this page come from the client's answers (docs/client_queries_full_qa.md); the text is
// in messages/<locale>.json under "instantMilega".

// Icons per item; the item key picks its title and text from the messages
const STEPS: Record<AppInterest, [string, Icon][]> = {
    hire: [
        ['choose', MapPinAreaIcon],
        ['match', StarIcon],
        ['start', PasswordIcon],
        ['finish', ReceiptIcon],
    ],
    work: [
        ['verify', IdentificationCardIcon],
        ['free', ToggleRightIcon],
        ['accept', TimerIcon],
        ['paid', WalletIcon],
    ],
};

// Launch services chosen by the client (Q24)
const SERVICES: [string, Icon][] = [
    ['plumber', WrenchIcon],
    ['warehouse', WarehouseIcon],
    ['loader', PackageIcon],
    ['officeBoy', BuildingOfficeIcon],
    ['retail', StorefrontIcon],
    ['airport', AirplaneTiltIcon],
    ['mall', ShoppingBagIcon],
];

const MAP_POINTS: [string, Icon][] = [
    ['live', MapTrifoldIcon],
    ['eta', TimerIcon],
    ['call', PhoneCallIcon],
    ['alerts', BellRingingIcon],
];

const TRUST: [string, Icon][] = [
    ['verified', ShieldCheckIcon],
    ['support', ChatsCircleIcon],
    ['rating', StarIcon],
    ['paid', ReceiptIcon],
];

const PASS_POINTS = ['limit', 'covers', 'counts', 'refund'];

const FAQ = ['whyApp', 'launch', 'cost', 'noAccept', 'cancel', 'parts', 'oneAccount'];

// App screenshots go here once the app team shares them ({ src, alt }); the section stays hidden
// while the list is empty.
const APP_SCREENS: { src: string; alt: string }[] = [];

function ModeSwitch({ mode, onChange }: { mode: AppInterest; onChange: (m: AppInterest) => void }) {
    const t = useTranslations('instantMilega');
    return (
        <div role="radiogroup" aria-label={t('iWantTo')} className="inline-flex p-1 rounded-xl bg-white/10 border border-white/15">
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
                    {t(value)}
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
    const t = useTranslations('instantMilega');
    const [mode, setMode] = useState<AppInterest>(initialMode);
    const isHire = mode === 'hire';
    const accent = (chunks: React.ReactNode) => <span className="text-[#FF8A33]">{chunks}</span>;

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
                                {t.rich(isHire ? 'hero.titleHire' : 'hero.titleWork', { accent })}
                            </h1>
                            <p className="mt-4 text-base sm:text-lg text-white/80 max-w-xl">
                                {t(isHire ? 'hero.textHire' : 'hero.textWork')}
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
                                alt={t('hero.imageAlt')}
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
                                {t(isHire ? 'how.titleHire' : 'how.titleWork')}
                            </h2>
                            <p className="mt-2 text-base text-km-text-secondary">{t(isHire ? 'how.textHire' : 'how.textWork')}</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setMode(isHire ? 'work' : 'hire')}
                            className="self-start sm:self-auto text-sm font-semibold text-km-link hover:underline cursor-pointer"
                        >
                            {t(isHire ? 'how.toWork' : 'how.toHire')}
                        </button>
                    </div>
                    <ol className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {STEPS[mode].map(([key, Icon], i) => (
                            <li key={key} className="bg-km-surface-card rounded-2xl border border-km-border p-6">
                                <Icon size={36} weight="duotone" className="text-km-instant" aria-hidden="true" />
                                <p className="mt-4 text-sm font-medium text-km-text-secondary">{t('how.step', { n: i + 1 })}</p>
                                <h3 className="mt-1 text-lg font-semibold text-km-text-primary">{t(`steps.${mode}.${key}.title`)}</h3>
                                <p className="mt-1.5 text-sm text-km-text-secondary leading-relaxed">{t(`steps.${mode}.${key}.text`)}</p>
                            </li>
                        ))}
                    </ol>
                </section>

                {/* The 120-second alert and the two codes */}
                <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {([
                        ['alert', WorkAlertArt],
                        ['codes', CodesArt],
                    ] as const).map(([key, Art]) => (
                        <div key={key} className="bg-km-surface-card rounded-3xl border border-km-border p-4 sm:p-6">
                            <Art />
                            <h2 className="mt-6 text-xl font-bold text-km-heading tracking-tight">{t(`pair.${key}.title`)}</h2>
                            <p className="mt-1.5 text-base text-km-text-secondary">{t(`pair.${key}.text`)}</p>
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
                            {t('map.title')}
                        </h2>
                        <ul className="mt-6 space-y-5">
                            {MAP_POINTS.map(([key, Icon]) => (
                                <li key={key} className="flex items-start gap-4">
                                    <Icon size={28} weight="duotone" className="text-km-instant shrink-0" aria-hidden="true" />
                                    <div>
                                        <h3 className="text-base font-semibold text-km-text-primary">{t(`map.${key}.title`)}</h3>
                                        <p className="mt-0.5 text-sm text-km-text-secondary">{t(`map.${key}.text`)}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    </div>
                </section>

                {/* Launch services */}
                <section aria-labelledby="services-title">
                    <SectionHeading id="services-title" title={t('services.title')} text={t('services.text')} />
                    <ul className="mt-8 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                        {SERVICES.map(([key, Icon]) => (
                            <li
                                key={key}
                                className="flex flex-col items-center text-center gap-3 bg-km-surface-card rounded-2xl border border-km-border px-3 py-6"
                            >
                                <Icon size={36} weight="duotone" className="text-km-heading" aria-hidden="true" />
                                <span className="text-sm font-medium text-km-text-primary">{t(`services.${key}`)}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* Trust */}
                <section aria-labelledby="trust-title">
                    <h2 id="trust-title" className="text-2xl sm:text-3xl font-bold text-km-heading tracking-tight">
                        {t('trust.title')}
                    </h2>
                    <ul className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
                        {TRUST.map(([key, Icon]) => (
                            <li key={key}>
                                <Icon size={28} weight="duotone" className="text-km-instant" aria-hidden="true" />
                                <h3 className="mt-3 text-base font-semibold text-km-text-primary">{t(`trust.${key}.title`)}</h3>
                                <p className="mt-1 text-sm text-km-text-secondary leading-relaxed">{t(`trust.${key}.text`)}</p>
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
                            {t('pass.title')}
                        </h2>
                        <p className="mt-2 text-base text-km-text-secondary">{t('pass.text')}</p>
                    </div>
                    <ul className="lg:col-span-7 space-y-4">
                        {PASS_POINTS.map((key) => (
                            <li key={key} className="flex items-start gap-3 text-base text-km-text-primary">
                                <CheckIcon size={18} weight="bold" className="text-emerald-600 shrink-0 mt-1" aria-hidden="true" />
                                <span>{t(`pass.${key}`)}</span>
                            </li>
                        ))}
                    </ul>
                </section>

                {/* App screens (filled in once the app team shares them) */}
                {APP_SCREENS.length > 0 && (
                    <section aria-labelledby="screens-title">
                        <SectionHeading id="screens-title" title={t('screens.title')} />
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
                            {t('languages.title')}
                        </h2>
                        <p className="mt-2 text-base text-km-text-secondary">{t('languages.text')}</p>
                    </div>
                    <ul className="flex flex-wrap gap-x-8 gap-y-3">
                        {LOCALES.map((locale) => (
                            <li key={locale} lang={locale} className="text-xl font-semibold text-km-text-primary">
                                {LOCALE_NAMES[locale]}
                            </li>
                        ))}
                    </ul>
                </section>

                {/* FAQ */}
                <section aria-labelledby="faq-title" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    <div className="lg:col-span-4">
                        <h2 id="faq-title" className="text-2xl sm:text-3xl font-bold text-km-heading tracking-tight">
                            {t('faq.title')}
                        </h2>
                    </div>
                    <div className="lg:col-span-8 divide-y divide-km-border border-y border-km-border">
                        {FAQ.map((key) => (
                            <details key={key} className="group py-5">
                                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none text-base font-semibold text-km-text-primary [&::-webkit-details-marker]:hidden">
                                    {t(`faq.${key}.q`)}
                                    <CaretDownIcon size={18} className="shrink-0 text-km-text-secondary transition-transform group-open:rotate-180" aria-hidden="true" />
                                </summary>
                                <p className="mt-3 text-sm sm:text-base text-km-text-secondary leading-relaxed">
                                    {t.rich(`faq.${key}.a`, {
                                        link: (chunks) => (
                                            <Link href="/jobs" className="font-medium text-km-link hover:underline">
                                                {chunks}
                                            </Link>
                                        ),
                                    })}
                                </p>
                            </details>
                        ))}
                    </div>
                </section>
            </main>

            {/* Closing download band */}
            <section className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24">
                <div className="bg-[#071A4D] text-white rounded-3xl p-6 sm:p-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                    <div className="lg:col-span-6">
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('closing.title')}</h2>
                        <p className="mt-2 text-base text-white/80">{t('closing.text')}</p>
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
