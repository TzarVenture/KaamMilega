'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    Search,
    MapPin,
    Zap,
    Wrench,
    Clock,
    ShieldCheck,
    CheckCircle2,
    ArrowRight,
    CreditCard
} from 'lucide-react';

import CitySelector from '@/components/km/CitySelector';

interface CandidateHeroProps {
    initialRole?: string;
    initialLocation?: string;
    cities?: any[];
    onSearch?: (trade: string, location: string) => void;
}

export default function CandidateHero({
    initialRole = '',
    initialLocation = '',
    cities = [],
    onSearch,
}: CandidateHeroProps) {
    const router = useRouter();

    const [tradeType, setTradeType] = useState(initialRole || 'All');
    const [selectedCity, setSelectedCity] = useState(initialLocation);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const selectedTrade = tradeType === 'All' ? '' : tradeType;
        if (onSearch) {
            onSearch(selectedTrade, selectedCity);
        } else {
            const params = new URLSearchParams();
            if (selectedTrade) params.set('role', selectedTrade);
            if (selectedCity) params.set('location', selectedCity);
            router.push(`/instant-milega?${params.toString()}`);
        }

        // Smoothly scroll down to the instant gigs feed on this page
        const feedElement = document.getElementById('instant-gigs-feed');
        if (feedElement) {
            feedElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const popularGigSearches = [
        'Delivery Partner',
        'Electrician',
        'Plumber',
        'Driver',
        'Warehouse Helper',
        'AC Technician',
        'Carpenter',
        'Security Guard',
    ];

    const handleQuickTag = (tag: string) => {
        setTradeType(tag);
        if (onSearch) {
            onSearch(tag, selectedCity);
        } else {
            router.push(`/instant-milega?role=${encodeURIComponent(tag)}`);
        }

        const feedElement = document.getElementById('instant-gigs-feed');
        if (feedElement) {
            feedElement.scrollIntoView({ behavior: 'smooth' });
        }
    };

    return (
        <section className="relative overflow-hidden bg-linear-to-b from-[#F0F5FB] via-[#F4F7FB] to-white pt-6 pb-6 sm:pt-10 sm:pb-14 lg:min-h-[92vh] lg:flex lg:items-center border-b border-slate-200/80 font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                
                {/* Main Hero Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center">
                    
                    {/* Left Column: Brand Lockup, Headline, Reduced Copy, Action Search Console & Popular Tags */}
                    <div className="lg:col-span-7 flex flex-col justify-center z-10 py-2 sm:py-6">
                        
                        {/* InstantMilega™ Official Logo */}
                        <div className="w-65 sm:w-[320px] lg:w-95 mb-1 sm:mb-2">
                            <Image
                                src="/instantMilega-logo.png"
                                alt="InstantMilega™"
                                width={760}
                                height={220}
                                priority
                                className="w-full h-auto object-contain"
                            />
                        </div>

                        {/* Master Hero Headline */}
                        <h1 className="text-3xl sm:text-5xl lg:text-[54px] font-black text-slate-900 tracking-tight leading-[1.12] mb-3 sm:mb-4">
                            Work in Minutes.{' '}
                            <span className="text-km-accent block sm:inline">Anywhere. Anytime!</span>
                        </h1>

                        {/* Reduced Description Subtitle */}
                        <p className="text-sm sm:text-base font-semibold text-slate-600 mb-6 sm:mb-7 flex items-center gap-2">
                            <span className="text-km-blue font-black text-base sm:text-lg">»</span>
                            <span>Trusted professionals. Quick response. Quality work.</span>
                        </p>

                        {/* Search Console: Clean Elevated Bar (Matching Platform Instant Gig Design) */}
                        <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-xl shadow-blue-950/5 p-3.5 sm:p-5">
                            <form onSubmit={handleSearch} className="flex flex-col gap-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    
                                    {/* Trade Selector */}
                                    <div className="flex-1 flex items-center bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-3 focus-within:bg-white focus-within:border-km-accent focus-within:ring-2 focus-within:ring-orange-500/10 transition-all">
                                        <Wrench size={18} className="text-km-accent mr-2.5 shrink-0" />
                                        <select
                                            value={tradeType}
                                            onChange={(e) => setTradeType(e.target.value)}
                                            className="w-full bg-transparent text-xs sm:text-sm text-slate-800 font-semibold focus:outline-none cursor-pointer"
                                        >
                                            <option value="All">All Instant Gigs &amp; Trades</option>
                                            <option value="Delivery Partner">Delivery Partner (Bikes / Vans)</option>
                                            <option value="Electrician">Electrician (Fittings &amp; Repair)</option>
                                            <option value="Plumber">Plumber (Fittings &amp; Sanitation)</option>
                                            <option value="Driver">Driver (Personal &amp; Commercial)</option>
                                            <option value="Warehouse Helper">Warehouse Helper &amp; Loader</option>
                                            <option value="AC Technician">AC &amp; Appliance Technician</option>
                                            <option value="Carpenter">Carpenter &amp; Woodworker</option>
                                            <option value="Security Guard">Security Guard &amp; Bouncer</option>
                                            <option value="Painter">Painter (Walls &amp; Textures)</option>
                                            <option value="Mason & Construction">Mason &amp; Construction</option>
                                        </select>
                                    </div>

                                    {/* City Selector */}
                                    <div className="sm:w-56 flex items-center">
                                        <CitySelector
                                            selectedCity={selectedCity}
                                            onCityChange={(city) => setSelectedCity(city === 'All' ? '' : city)}
                                            variant="hero"
                                            cities={cities}
                                        />
                                    </div>

                                    {/* Find Instant Gigs Submit CTA */}
                                    <button
                                        type="submit"
                                        className="bg-km-accent hover:bg-km-accent-light text-white text-sm font-bold px-7 sm:px-8 py-3.5 rounded-xl transition-all shadow-md shadow-orange-500/20 shrink-0 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                    >
                                        <Zap size={16} className="fill-white" />
                                        <span>Find Instant Gigs</span>
                                    </button>
                                </div>

                                {/* Slogan Subtext */}
                                <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 pl-1">
                                    <Clock size={13} className="shrink-0 text-km-accent" />
                                    <span>Instant local gig alerts with zero commission and daily verified payouts.</span>
                                </p>

                                {/* Popular Gigs Chips */}
                                <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                                    <span className="text-xs font-bold text-slate-500 shrink-0">Popular Gigs:</span>
                                    {popularGigSearches.map((tag) => (
                                        <button
                                            key={tag}
                                            type="button"
                                            onClick={() => handleQuickTag(tag)}
                                            className="text-xs font-medium text-slate-600 bg-slate-50/80 hover:bg-orange-50 hover:text-km-accent hover:border-km-accent px-3 py-1 rounded-full border border-slate-200/80 transition-all cursor-pointer shadow-2xs active:scale-95"
                                        >
                                            {tag}
                                        </button>
                                    ))}
                                </div>
                            </form>
                        </div>

                    </div>

                    {/* Right Column: Hero Person with KaamMilega 'K' Brand Art */}
                    <div className="lg:col-span-5 relative flex items-end justify-center min-h-80 sm:min-h-95 lg:min-h-125">
                        
                        {/* KaamMilega K Logo — Proportional Background Art */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
                            <div className="relative w-[75%] sm:w-[85%] lg:w-[98%] aspect-square max-w-120 translate-x-2 sm:translate-x-4 opacity-90">
                                <Image
                                    src="/kaammilega-logo-icon.png"
                                    alt="KaamMilega Brand Icon Art"
                                    fill
                                    priority
                                    className="object-contain"
                                />
                            </div>
                            
                            {/* Soft Radial Ambient Lighting */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-orange-100/40 rounded-full blur-3xl pointer-events-none" />
                        </div>

                        {/* Motivational Slogan Accent with Hand-Drawn SVG Shape */}
                        <div className="absolute top-2 left-0 sm:-left-2 z-20 select-none hidden lg:block transform -rotate-6">
                            <p className="text-sm font-bold text-slate-800 tracking-tight leading-tight">
                                Instant Dispatch
                            </p>
                            <p className="text-sm font-black text-km-accent tracking-tight leading-tight">
                                Verified Earnings
                            </p>
                            <svg className="w-28 h-3 text-km-accent mt-0.5" viewBox="0 0 100 12" fill="none">
                                <path d="M2 8C28 2 72 2 98 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </div>

                        {/* Main Person Image: InstantMilega Worker with Phone */}
                        <div className="relative z-10 w-[60%] sm:w-[70%] lg:w-[82%] max-w-100 flex items-end justify-center">
                            <Image
                                src="/asset/hero/instantMilega-hero-person.png"
                                alt="InstantMilega Professional Candidate"
                                width={1200}
                                height={1200}
                                priority
                                className="w-full h-auto object-contain object-bottom drop-shadow-2xl"
                            />
                        </div>

                        {/* Floating One Time Access Card (Revamped from Reference Image 2, maintaining same position & size) */}
                        <div className="absolute bottom-2 -right-1 sm:bottom-6 sm:-right-2 lg:-right-4 z-20 bg-[#071A4D] text-white rounded-2xl p-3.5 sm:p-5 shadow-2xl border border-blue-400/25 space-y-2.5 sm:space-y-3 min-w-42.5 sm:min-w-52.5 select-none group hover:border-km-accent/40 transition-all">
                            
                            {/* Card Header Label */}
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-300 bg-white/10 px-2.5 py-0.5 rounded-full border border-white/10">
                                    One Time Access
                                </span>
                            </div>

                            {/* Pricing & Benefit Subtitle */}
                            <div className="my-1">
                                <div className="flex items-baseline gap-1.5">
                                    <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">₹99</span>
                                    <span className="text-[10px] sm:text-xs font-black text-km-accent tracking-wider uppercase">ONLY</span>
                                </div>
                                <p className="text-[11px] sm:text-xs font-semibold text-slate-300 mt-0.5">Unlimited Benefits</p>
                            </div>

                            {/* 3 Value Checklist Items */}
                            <div className="space-y-1.5 pt-2 border-t border-white/10 text-[11px] sm:text-xs font-medium text-slate-200">
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={11} className="text-emerald-400" />
                                    </span>
                                    <span>No Subscription</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={11} className="text-emerald-400" />
                                    </span>
                                    <span>Use Anytime</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                                        <CheckCircle2 size={11} className="text-emerald-400" />
                                    </span>
                                    <span>Across All Services</span>
                                </div>
                            </div>

                            {/* High-Conversion Access CTA */}
                            <button
                                type="button"
                                onClick={() => router.push('/wallet?action=instant_pass')}
                                className="w-full bg-linear-to-r from-km-accent to-km-accent-light hover:brightness-105 text-white text-xs font-bold py-2.5 px-3 rounded-xl transition-all shadow-md shadow-orange-500/30 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                            >
                                <span>Get Access Now</span>
                                <ArrowRight size={13} />
                            </button>
                        </div>

                    </div>

                </div>

                {/* Bottom 4-Metric Statistics Strip (matching Home Page Hero layout) */}
                <div className="mt-8 pt-6 sm:mt-10 sm:pt-7 border-t border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
                    <div className="flex items-center gap-2.5 sm:gap-3.5 p-2 sm:p-2.5 rounded-xl hover:bg-white/70 transition-all text-left">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-orange-50 text-km-accent border border-orange-100/80 flex items-center justify-center shrink-0 shadow-2xs">
                            <Clock size={18} className="sm:hidden" />
                            <Clock size={20} className="hidden sm:block" />
                        </div>
                        <div>
                            <p className="text-sm sm:text-base lg:text-lg font-black text-slate-900 leading-tight font-poppins">
                                10–15 Min
                            </p>
                            <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-tight mt-0.5">Avg. Arrival Time</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-3.5 p-2 sm:p-2.5 rounded-xl hover:bg-white/70 transition-all text-left">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-blue-50 text-km-blue border border-blue-100/80 flex items-center justify-center shrink-0 shadow-2xs">
                            <MapPin size={18} className="sm:hidden" />
                            <MapPin size={20} className="hidden sm:block" />
                        </div>
                        <div>
                            <p className="text-sm sm:text-base lg:text-lg font-black text-slate-900 leading-tight font-poppins">
                                1–10 KM
                            </p>
                            <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-tight mt-0.5">Hyperlocal Radius</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-3.5 p-2 sm:p-2.5 rounded-xl hover:bg-white/70 transition-all text-left">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100/80 flex items-center justify-center shrink-0 shadow-2xs">
                            <ShieldCheck size={18} className="sm:hidden" />
                            <ShieldCheck size={20} className="hidden sm:block" />
                        </div>
                        <div>
                            <p className="text-sm sm:text-base lg:text-lg font-black text-slate-900 leading-tight font-poppins">
                                100% Free
                            </p>
                            <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-tight mt-0.5">For Workers</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2.5 sm:gap-3.5 p-2 sm:p-2.5 rounded-xl hover:bg-white/70 transition-all text-left">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl bg-purple-50 text-purple-600 border border-purple-100/80 flex items-center justify-center shrink-0 shadow-2xs">
                            <CreditCard size={18} className="sm:hidden" />
                            <CreditCard size={20} className="hidden sm:block" />
                        </div>
                        <div>
                            <p className="text-sm sm:text-base lg:text-lg font-black text-slate-900 leading-tight font-poppins">
                                Daily Payouts
                            </p>
                            <p className="text-[11px] sm:text-xs text-slate-500 font-medium leading-tight mt-0.5">Direct to Wallet</p>
                        </div>
                    </div>
                </div>

            </div>
        </section>
    );
}
