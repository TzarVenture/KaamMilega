'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, CheckCircleIcon, ClockIcon, DeviceMobileIcon, DownloadSimpleIcon, MapPinAreaIcon, PasswordIcon, PathIcon, ShieldCheckIcon, TimerIcon } from '@phosphor-icons/react';
import DownloadAppModal from '@/components/km/DownloadAppModal';

// Popular on-demand services available on the mobile app
const POPULAR_SERVICES = [
    {
        id: 'plumber',
        title: 'Plumber',
        subtitle: 'Leaks, fittings & pipe repairs',
        img: '/asset/trades/plumber.jpg',
    },
    {
        id: 'electrician',
        title: 'Electrician',
        subtitle: 'Wiring, fixtures & power fixes',
        img: '/asset/trades/electrician.jpg',
    },
    {
        id: 'warehouse',
        title: 'Warehouse Worker',
        subtitle: 'Inventory, staging & packing',
        img: '/asset/trades/warehouse.jpg',
    },
    {
        id: 'loader',
        title: 'Loader-Unloader',
        subtitle: 'Loading, heavy goods & transit',
        img: '/asset/trades/labour.jpg',
    },
    {
        id: 'office-boy',
        title: 'Office Boy',
        subtitle: 'Daily errands & pantry support',
        img: '/asset/trades/office-executive.jpg',
    },
    {
        id: 'retail',
        title: 'Retail Executive',
        subtitle: 'Counter sales & shelf stocking',
        img: '/asset/trades/delivery.jpg',
    },
    {
        id: 'airport',
        title: 'Airport Assistant',
        subtitle: 'Luggage help & terminal support',
        img: '/asset/trades/driver.jpg',
    },
    {
        id: 'mall',
        title: 'Mall Assistant',
        subtitle: 'Floor help & customer guidance',
        img: '/asset/trades/security.jpg',
    },
];

export default function InstantMilegaLandingShowcase() {
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

    return (
        <div className="flex flex-col min-h-screen bg-km-surface font-sans antialiased">
            {/* ─── Hero Section with Deep Navy, Art & Rounded Bottom ─── */}
            <section className="bg-[#071A4D] border-b border-[#0B1F52] text-white pt-6 sm:pt-8 lg:pt-10 pb-0 rounded-b-[32px] sm:rounded-b-[44px] lg:rounded-b-[52px] relative overflow-hidden dark:border-white/10">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-end">
                        {/* Left Column: Instant Milega Branding, Headline, Human-friendly copy & CTAs */}
                        <div className="lg:col-span-6 xl:col-span-6 text-left pt-1 sm:pt-2 pb-3 sm:pb-4 lg:pb-5 flex flex-col justify-center">
                            {/* Brand Lockup: Logo Icon + Logo Text (Optically Aligned) */}
                            <div className="flex items-end gap-3.5 sm:gap-4 mb-4 sm:mb-5">
                                <img
                                    src="/instantMilega-logo-icon.png"
                                    alt="Instant Milega Icon"
                                    className="h-14 sm:h-16 lg:h-18 w-auto object-contain select-none shrink-0"
                                />
                                <img
                                    src="/instantMilega-logo-text.png"
                                    alt="Instant Milega"
                                    className="h-9 sm:h-10 lg:h-12 w-auto object-contain select-none mb-1 sm:mb-1.5"
                                />
                            </div>

                            {/* Clean, Human-Friendly Headline */}
                            <h1 className="text-3xl sm:text-4xl lg:text-[42px] xl:text-[46px] font-bold text-white tracking-tight leading-[1.18]">
                                Book local help &amp; spot work in <span className="text-[#FF6B00]">120 seconds</span>
                            </h1>

                            {/* Simple, Natural Subtitle */}
                            <p className="mt-3 text-sm sm:text-base text-white/80 max-w-lg font-normal leading-relaxed">
                                Find verified workers nearby or pick up immediate daily shifts. Direct phone connect, double OTP safety, and zero commission.
                            </p>

                            {/* Download App CTA Button */}
                            <div className="flex flex-wrap items-center gap-3.5 mt-5">
                                <button
                                    type="button"
                                    onClick={() => setIsDownloadModalOpen(true)}
                                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-semibold text-sm transition-all shadow-md cursor-pointer active:scale-98"
                                >
                                    <DownloadSimpleIcon weight="bold" size={16} />
                                    <span>Download App</span>
                                </button>
                                <span className="text-xs text-white/70 font-medium">
                                    Available for Android &amp; iOS
                                </span>
                            </div>

                            {/* Simple Trust Points */}
                            <div className="flex flex-wrap items-center gap-4 sm:gap-6 mt-5 pt-4 border-t border-white/10 text-xs text-white/90 font-medium">
                                <div className="flex items-center gap-1.5">
                                    <ClockIcon weight="bold" size={14} className="text-[#10B981] shrink-0" />
                                    <span>120s Fast Matching</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <ShieldCheckIcon weight="bold" size={14} className="text-[#10B981] shrink-0" />
                                    <span>Double OTP Security</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <CheckCircleIcon weight="bold" size={14} className="text-[#10B981] shrink-0" />
                                    <span>0% Commission</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Hero Artwork Resting Directly on Bottom Edge */}
                        <div className="lg:col-span-6 xl:col-span-6 flex items-end justify-center lg:justify-end self-end p-0 m-0 leading-none">
                            <div className="relative flex items-end justify-center lg:justify-end w-full leading-none">
                                <img
                                    src="/instantMilega-page-hero-art.png"
                                    alt="Instant Milega On-Demand Dispatch"
                                    className="w-full max-w-[500px] sm:max-w-[580px] lg:max-w-[660px] xl:max-w-[700px] h-auto object-contain select-none pointer-events-none drop-shadow-2xl block align-bottom translate-y-[2px]"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Main Application Landing Sections ─── */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 space-y-16 sm:space-y-20">
                {/* 1. Live Radar & Real-Time Tracking Feature (Urban Company style) */}
                <section className="bg-km-surface-card rounded-3xl border border-km-border p-6 sm:p-10 lg:p-12 shadow-xs">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                        {/* Map View Showcase */}
                        <div className="lg:col-span-7 relative">
                            <div className="relative rounded-2xl overflow-hidden border border-km-border shadow-sm bg-km-surface">
                                <img
                                    src="/instantMilega-page-map-view.png"
                                    alt="Live radar map tracking nearby workers"
                                    className="w-full h-auto object-cover select-none"
                                />
                                {/* Floating Live Status Badge */}
                                <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 bg-km-surface-card/95 backdrop-blur-xs border border-km-border px-3.5 py-1.5 rounded-full flex items-center gap-2 text-xs font-semibold text-km-heading shadow-xs">
                                    <span className="w-2.5 h-2.5 rounded-full bg-[#16A34A]" />
                                    <span>Live Radar • 120s Dispatch</span>
                                </div>
                            </div>
                        </div>

                        {/* Feature Highlights with Big Icons */}
                        <div className="lg:col-span-5 space-y-6">
                            <div>
                                <span className="text-xs font-semibold text-[#FF6B00]">
                                    Live tracking
                                </span>
                                <h2 className="text-2xl sm:text-3xl font-bold text-km-text-primary mt-1 tracking-tight">
                                    See nearby help on the radar map
                                </h2>
                                <p className="text-sm text-km-text-secondary mt-2 leading-relaxed">
                                    Open the app to view active verified pros in your neighborhood. When you request help, the closest available pro is dispatched right away.
                                </p>
                            </div>

                            <div className="space-y-4 pt-1">
                                <div className="flex items-start gap-3.5">
                                    <MapPinAreaIcon size={28} weight="duotone" className="text-km-instant shrink-0" aria-hidden="true" />
                                    <div>
                                        <h3 className="text-sm font-bold text-km-text-primary">
                                            Nearby pro radar
                                        </h3>
                                        <p className="text-xs sm:text-sm text-km-text-secondary mt-0.5 leading-relaxed">
                                            Workers available within 5 km appear live on your local radar.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3.5">
                                    <TimerIcon size={28} weight="duotone" className="text-km-instant shrink-0" aria-hidden="true" />
                                    <div>
                                        <h3 className="text-sm font-bold text-km-text-primary">
                                            Fast 120-second match
                                        </h3>
                                        <p className="text-xs sm:text-sm text-km-text-secondary mt-0.5 leading-relaxed">
                                            No long calls or bargaining. The system auto-assigns the nearest pro.
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-3.5">
                                    <PathIcon size={28} weight="duotone" className="text-km-instant shrink-0" aria-hidden="true" />
                                    <div>
                                        <h3 className="text-sm font-bold text-km-text-primary">
                                            Doorstep route tracking
                                        </h3>
                                        <p className="text-xs sm:text-sm text-km-text-secondary mt-0.5 leading-relaxed">
                                            Track their arrival directly to your doorstep on the live map.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDownloadModalOpen(true)}
                                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#071A4D] hover:bg-[#0B1F52] text-white text-xs sm:text-sm font-semibold transition-all shadow-xs cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                >
                                    <DownloadSimpleIcon weight="bold" size={15} />
                                    <span>Try live radar on the app</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 2. Popular Services (Urban Company Style Grid - No prices, big icons, clean copy) */}
                <section>
                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-8">
                        <div>
                            <span className="text-xs font-semibold text-[#FF6B00]">
                                Instant services
                            </span>
                            <h2 className="text-2xl sm:text-3xl font-bold text-km-text-primary mt-1 tracking-tight">
                                Popular services available on demand
                            </h2>
                            <p className="text-sm text-km-text-secondary mt-1">
                                Tap any service to book directly on the mobile app.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsDownloadModalOpen(true)}
                            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-km-heading hover:text-km-link transition-colors self-start sm:self-auto cursor-pointer"
                        >
                            <span>Download app to browse all</span>
                            <ArrowRightIcon weight="bold" size={14} />
                        </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                        {POPULAR_SERVICES.map((service) => {
                            return (
                                <button
                                    key={service.id}
                                    type="button"
                                    onClick={() => setIsDownloadModalOpen(true)}
                                    className="text-left relative rounded-2xl overflow-hidden min-h-[190px] sm:min-h-[210px] p-4 sm:p-5 flex flex-col justify-between border border-km-border shadow-xs cursor-pointer select-none"
                                >
                                    {/* Authentic Trade Background Image (No blue overlay) */}
                                    <img
                                        src={service.img}
                                        alt={service.title}
                                        className="absolute inset-0 w-full h-full object-cover pointer-events-none select-none z-0"
                                    />
                                    {/* Subtle Bottom Contrast Gradient for Legibility */}
                                    <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/85 via-black/45 to-transparent z-1" />

                                    <span aria-hidden="true" />

                                    {/* Bottom Content: Main Service Title in Semi-Bold Orange on the Image */}
                                    <div className="relative z-10">
                                        <h3 className="text-base sm:text-lg font-semibold text-[#FF6B00] tracking-tight leading-snug">
                                            {service.title}
                                        </h3>
                                        <p className="text-xs text-white/90 mt-0.5 line-clamp-1 font-normal">
                                            {service.subtitle}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* 3. Double OTP Safety & How It Works (Short Simple Human Steps) */}
                <section>
                    <div className="text-center max-w-xl mx-auto mb-10">
                        <span className="text-xs font-semibold text-[#FF6B00]">
                            Safe and simple
                        </span>
                        <h2 className="text-2xl sm:text-3xl font-bold text-km-text-primary mt-1 tracking-tight">
                            How every booking works
                        </h2>
                        <p className="text-sm text-km-text-secondary mt-1.5 leading-relaxed">
                            Two simple verification codes guarantee safety for both customers and workers.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Step 1 */}
                        <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 shadow-xs flex flex-col justify-between">
                            <div>
                                <DeviceMobileIcon size={36} weight="duotone" className="text-km-instant mb-4" aria-hidden="true" />
                                <span className="text-xs font-semibold text-km-heading">Step 1</span>
                                <h3 className="text-base font-bold text-km-text-primary mt-1">
                                    Pick your service
                                </h3>
                                <p className="text-sm text-km-text-secondary mt-1.5 leading-relaxed">
                                    Choose what you need and confirm your location. The closest verified pro accepts in seconds.
                                </p>
                            </div>
                        </div>

                        {/* Step 2 */}
                        <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 shadow-xs flex flex-col justify-between">
                            <div>
                                <PasswordIcon size={36} weight="duotone" className="text-km-instant mb-4" aria-hidden="true" />
                                <span className="text-xs font-semibold text-km-heading">Step 2</span>
                                <h3 className="text-base font-bold text-km-text-primary mt-1">
                                    Share the start code
                                </h3>
                                <p className="text-sm text-km-text-secondary mt-1.5 leading-relaxed">
                                    When the worker arrives at your location, share your 4-digit code to start the work.
                                </p>
                            </div>
                        </div>

                        {/* Step 3 */}
                        <div className="bg-km-surface-card rounded-2xl border border-km-border p-6 shadow-xs flex flex-col justify-between">
                            <div>
                                <CheckCircleIcon size={36} weight="duotone" className="text-km-instant mb-4" aria-hidden="true" />
                                <span className="text-xs font-semibold text-km-heading">Step 3</span>
                                <h3 className="text-base font-bold text-km-text-primary mt-1">
                                    Finish code &amp; pay
                                </h3>
                                <p className="text-sm text-km-text-secondary mt-1.5 leading-relaxed">
                                    Once the work is done, share the finish code to complete the booking and pay directly.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* 4. App Download Showcase Banner (Urban Company Style) */}
                <section className="bg-[#071A4D] text-white rounded-3xl border border-[#0B1F52] p-8 sm:p-12 relative overflow-hidden dark:border-km-link dark:ring-1 dark:ring-inset dark:ring-white/10">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                        <div className="lg:col-span-8 space-y-4">
                            <span className="text-xs font-semibold text-[#FF6B00]">
                                Ready to get started?
                            </span>
                            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight">
                                Download KaamMilega for Android &amp; iOS
                            </h2>
                            <p className="text-sm sm:text-base text-white/80 max-w-xl font-normal leading-relaxed">
                                Experience 120-second live radar dispatch, instant direct calls, and safe double OTP verification on your smartphone.
                            </p>

                            <div className="flex flex-wrap items-center gap-3.5 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsDownloadModalOpen(true)}
                                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#FF8A00] text-white text-sm font-semibold transition-all shadow-md cursor-pointer active:scale-98"
                                >
                                    <DownloadSimpleIcon weight="bold" size={16} />
                                    <span>Download App</span>
                                </button>
                                <span className="text-xs text-white/70">
                                    Free download • Zero commission
                                </span>
                            </div>
                        </div>

                        {/* Store Buttons Box */}
                        <div className="lg:col-span-4 bg-[#0B1F52] border border-white/10 rounded-2xl p-6 text-center space-y-3">
                            <h3 className="text-sm font-bold text-white">
                                Available on all platforms
                            </h3>
                            <p className="text-xs text-white/70">
                                For both workers seeking shifts and employers hiring help.
                            </p>
                            <div className="flex flex-col gap-3 pt-1 items-center justify-center">
                                <button
                                    type="button"
                                    onClick={() => setIsDownloadModalOpen(true)}
                                    className="hover:opacity-90 transition-opacity cursor-pointer inline-block"
                                    aria-label="Get it on Google Play"
                                >
                                    <img
                                        src="/asset/google-play-badge-logo.svg"
                                        alt="Get it on Google Play"
                                        className="h-10 sm:h-11 w-auto object-contain"
                                    />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsDownloadModalOpen(true)}
                                    className="hover:opacity-90 transition-opacity cursor-pointer inline-block"
                                    aria-label="Download on the App Store"
                                >
                                    <img
                                        src="/asset/download-on-the-app-store-apple-logo.svg"
                                        alt="Download on the App Store"
                                        className="h-10 sm:h-11 w-auto object-contain"
                                    />
                                </button>
                            </div>
                        </div>
                    </div>
                </section>
            </main>

            {/* Mobile App Download Modal */}
            <DownloadAppModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
            />
        </div>
    );
}
