'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
    Search,
    MapPin,
    Briefcase,
    Zap,
    GraduationCap,
    Wrench,
    ChevronRight,
    Users,
    Building2,
    PhoneCall,
    Clock,
    TrendingUp,
    Target,
} from 'lucide-react';

import CitySelector from '@/components/km/CitySelector';

interface HeroSectionProps {
    cities?: any[];
    stats?: any;
}

export default function HeroSection({ cities = [], stats }: HeroSectionProps) {
    const router = useRouter();

    const [activeTab, setActiveTab] = useState<'jobs' | 'instant' | 'skills' | 'mentors'>('jobs');
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCity, setSelectedCity] = useState('');
    const [tradeType, setTradeType] = useState('Electrician');
    const [pincode, setPincode] = useState('');

    const handleJobSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        if (selectedCity) params.set('city', selectedCity);
        router.push(`/jobs?${params.toString()}`);
    };

    const handleInstantGigSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams();
        params.set('type', 'instant');
        if (tradeType) params.set('role', tradeType);
        if (pincode.trim()) params.set('pincode', pincode.trim());
        router.push(`/jobs?${params.toString()}`);
    };

    const handleSkillSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        router.push(`/resources?${params.toString()}`);
    };

    const handleMentorSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set('q', searchQuery.trim());
        router.push(`/mentorship?${params.toString()}`);
    };

    const popularSearches = [
        'Fresher Jobs',
        'Work From Home',
        'Delivery Partner',
        'Electrician',
        'Plumber',
        'Warehouse',
        'Retail',
        'Customer Support',
    ];

    return (
        <section className="relative overflow-hidden bg-gradient-to-b from-[#F0F5FB] via-[#F4F7FB] to-white pt-4 pb-4 sm:pt-10 sm:pb-12 lg:min-h-[96vh] lg:flex lg:items-center border-b border-slate-200/80 font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Main Hero Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-6 items-center">
                    
                    {/* Left Column: Heading, Tabbed Console, Popular Searches */}
                    <div className="lg:col-span-7 flex flex-col justify-center z-10 py-2 sm:py-6">
                        {/* Top Category Line */}
                        <div className="flex items-center flex-wrap gap-2 text-xs sm:text-sm font-semibold tracking-wide text-slate-500 mb-3 sm:mb-4">
                            <span className="text-km-primary font-bold">Skills</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-km-accent font-bold">Jobs</span>
                            <span className="text-slate-300">•</span>
                            <span className="text-km-blue font-bold">Opportunities</span>
                            <span className="text-slate-300">•</span>
                            <span className="font-devanagari font-bold text-slate-700 tracking-normal">हर काम, हर मौका</span>
                        </div>

                        {/* Master Hero Headline */}
                        <h1 className="text-3xl sm:text-5xl lg:text-[52px] font-black text-slate-900 tracking-tight leading-[1.12] mb-3 sm:mb-4">
                            Kaam Dhoondo.{' '}
                            <span className="text-km-accent block sm:inline">Milega Yahin!</span>
                        </h1>

                        {/* Subtitle */}
                        <p className="text-sm sm:text-base text-slate-600 mb-6 sm:mb-8 max-w-xl leading-relaxed font-normal">
                            India&apos;s verified platform for direct jobs, InstantMilega™ rapid gigs, industry skills, and career mentorship with zero brokerage.
                        </p>

                        {/* Search Console: Distinct Tabs + Clean Elevated Bar */}
                        <div>
                            {/* Tabs Row */}
                            <div className="flex items-end gap-1.5 sm:gap-2 overflow-x-auto scrollbar-none">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('jobs')}
                                    className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-t-xl sm:rounded-t-2xl font-bold text-xs sm:text-sm transition-all shrink-0 cursor-pointer ${
                                        activeTab === 'jobs'
                                            ? 'bg-km-accent text-white shadow-md'
                                            : 'bg-white/70 hover:bg-white text-slate-700 border border-b-0 border-slate-200/80 hover:text-km-primary'
                                    }`}
                                >
                                    <Briefcase size={16} />
                                    <span>Jobs</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('instant')}
                                    className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-t-xl sm:rounded-t-2xl font-bold text-xs sm:text-sm transition-all shrink-0 cursor-pointer ${
                                        activeTab === 'instant'
                                            ? 'bg-km-accent text-white shadow-md'
                                            : 'bg-white/70 hover:bg-white text-slate-700 border border-b-0 border-slate-200/80 hover:text-km-primary'
                                    }`}
                                >
                                    <Zap 
                                        size={16} 
                                        className={activeTab === 'instant' ? 'text-white fill-white' : 'text-km-accent fill-km-accent'} 
                                    />
                                    <span>
                                        Instant Milega<sup className="text-[10px] font-semibold ml-0.5">™</sup>
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('skills')}
                                    className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-t-xl sm:rounded-t-2xl font-bold text-xs sm:text-sm transition-all shrink-0 cursor-pointer ${
                                        activeTab === 'skills'
                                            ? 'bg-km-accent text-white shadow-md'
                                            : 'bg-white/70 hover:bg-white text-slate-700 border border-b-0 border-slate-200/80 hover:text-km-primary'
                                    }`}
                                >
                                    <GraduationCap size={16} />
                                    <span>Learn Skills</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('mentors')}
                                    className={`flex items-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-t-xl sm:rounded-t-2xl font-bold text-xs sm:text-sm transition-all shrink-0 cursor-pointer ${
                                        activeTab === 'mentors'
                                            ? 'bg-km-accent text-white shadow-md'
                                            : 'bg-white/70 hover:bg-white text-slate-700 border border-b-0 border-slate-200/80 hover:text-km-primary'
                                    }`}
                                >
                                    <Users size={16} />
                                    <span>Mentors</span>
                                </button>
                            </div>

                            {/* Elevated Search Bar Box */}
                            <div className="bg-white rounded-b-2xl rounded-tr-2xl sm:rounded-b-3xl sm:rounded-tr-3xl border border-slate-200 shadow-xl shadow-blue-950/5 p-3 sm:p-4">
                                {/* Tab 1: Find Jobs */}
                                {activeTab === 'jobs' && (
                                    <form onSubmit={handleJobSearch} className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1 flex items-center bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-3 focus-within:bg-white focus-within:border-km-primary focus-within:ring-2 focus-within:ring-km-primary/10 transition-all">
                                            <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="Job title, skill or company"
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full bg-transparent text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
                                            />
                                        </div>

                                        <CitySelector
                                            selectedCity={selectedCity}
                                            onCityChange={(city) => setSelectedCity(city === 'All' ? '' : city)}
                                            variant="hero"
                                            cities={cities}
                                        />

                                        <button
                                            type="submit"
                                            className="bg-km-accent hover:bg-km-accent-light text-white text-sm font-bold px-7 sm:px-8 py-3.5 rounded-xl transition-all shadow-md shadow-orange-500/20 shrink-0 flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                                        >
                                            <span>Search Jobs</span>
                                        </button>
                                    </form>
                                )}

                                {/* Tab 2: Instant Gigs */}
                                {activeTab === 'instant' && (
                                    <form onSubmit={handleInstantGigSearch} className="flex flex-col gap-3">
                                        <div className="flex flex-col sm:flex-row gap-3">
                                            <div className="flex-1 flex items-center bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-3 focus-within:bg-white focus-within:border-km-accent focus-within:ring-2 focus-within:ring-orange-500/10 transition-all">
                                                <Wrench size={18} className="text-km-accent mr-2.5 shrink-0" />
                                                <select
                                                    value={tradeType}
                                                    onChange={(e) => setTradeType(e.target.value)}
                                                    className="w-full bg-transparent text-xs sm:text-sm text-slate-800 font-semibold focus:outline-none cursor-pointer"
                                                >
                                                    <option value="Electrician">Electrician Gigs (Home &amp; Commercial)</option>
                                                    <option value="Plumber">Plumber Gigs (Fittings &amp; Repair)</option>
                                                    <option value="Delivery">Delivery Partner (Bikes / Vans)</option>
                                                    <option value="Carpenter">Carpenter Gigs (Furniture &amp; Woodwork)</option>
                                                    <option value="AC Repair">AC &amp; Appliance Technician</option>
                                                    <option value="Labour">Helper &amp; General Labour</option>
                                                </select>
                                            </div>
                                            <div className="sm:w-44 flex items-center bg-slate-50/70 border border-slate-200 rounded-xl px-3 py-3 focus-within:bg-white focus-within:border-km-accent focus-within:ring-2 focus-within:ring-orange-500/10 transition-all">
                                                <MapPin size={18} className="text-slate-400 mr-2 shrink-0" />
                                                <input
                                                    type="text"
                                                    maxLength={6}
                                                    placeholder="Your Pincode"
                                                    value={pincode}
                                                    onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                                                    className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none font-medium"
                                                />
                                            </div>
                                            <button
                                                type="submit"
                                                className="bg-km-accent hover:bg-km-accent-light text-white text-sm font-bold px-7 sm:px-8 py-3.5 rounded-xl transition-all shadow-md shadow-orange-500/20 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                            >
                                                <span>Find Instant Gigs</span>
                                                <Zap size={15} />
                                            </button>
                                        </div>
                                        <p className="text-[11px] text-slate-500 font-medium flex items-center gap-1.5 pl-1">
                                            <Clock size={13} className="shrink-0 text-km-accent" />
                                            <span>Instant local gig alerts with zero commission and daily verified payouts.</span>
                                        </p>
                                    </form>
                                )}

                                {/* Tab 3: Learn Skills */}
                                {activeTab === 'skills' && (
                                    <form onSubmit={handleSkillSearch} className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1 flex items-center bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-3 focus-within:bg-white focus-within:border-km-primary focus-within:ring-2 focus-within:ring-km-primary/10 transition-all">
                                            <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="Search skills, trades & certifications (e.g. Electrician, Python, AutoCAD)..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none font-medium"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-km-accent hover:bg-km-accent-light text-white text-sm font-bold px-7 sm:px-8 py-3.5 rounded-xl transition-all shadow-md shadow-orange-500/20 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <span>Explore Skills</span>
                                            <ChevronRight size={16} />
                                        </button>
                                    </form>
                                )}

                                {/* Tab 4: Mentors */}
                                {activeTab === 'mentors' && (
                                    <form onSubmit={handleMentorSearch} className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1 flex items-center bg-slate-50/70 border border-slate-200 rounded-xl px-3.5 py-3 focus-within:bg-white focus-within:border-km-primary focus-within:ring-2 focus-within:ring-km-primary/10 transition-all">
                                            <Search size={18} className="text-slate-400 mr-2.5 shrink-0" />
                                            <input
                                                type="text"
                                                placeholder="Search mentors by expertise (e.g. Career Guidance, Interview Prep)..."
                                                value={searchQuery}
                                                onChange={(e) => setSearchQuery(e.target.value)}
                                                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none font-medium"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-km-accent hover:bg-km-accent-light text-white text-sm font-bold px-7 sm:px-8 py-3.5 rounded-xl transition-all shadow-md shadow-orange-500/20 shrink-0 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
                                        >
                                            <span>Find Mentors</span>
                                            <ChevronRight size={16} />
                                        </button>
                                    </form>
                                )}
                            </div>
                        </div>

                        {/* Popular Searches Line */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-500">Popular Searches:</span>
                            {popularSearches.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery(tag);
                                        router.push(`/jobs?q=${encodeURIComponent(tag)}`);
                                    }}
                                    className="text-xs font-medium text-slate-600 bg-white/80 hover:bg-white hover:text-km-primary hover:border-km-primary px-3 py-1 rounded-full border border-slate-200/80 transition-all cursor-pointer shadow-2xs"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Hero Person with KaamMilega 'K' Brand Art */}
                    <div className="lg:col-span-5 relative flex items-end justify-center min-h-[200px] sm:min-h-[300px] lg:min-h-[460px]">
                        
                        {/* KaamMilega K Logo — proportional background art */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden select-none">
                            <div className="relative w-[70%] sm:w-[80%] lg:w-[95%] aspect-square max-w-[480px] translate-x-2 sm:translate-x-4 opacity-90">
                                <Image
                                    src="/kaammilega-logo-icon.png"
                                    alt="KaamMilega K Brand Art"
                                    fill
                                    priority
                                    className="object-contain"
                                />
                            </div>
                            
                            {/* Soft Radial Ambient Lighting */}
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />
                        </div>

                        {/* Motivational Slogan Accent */}
                        <div className="absolute top-2 left-0 sm:-left-2 z-20 select-none hidden lg:block transform -rotate-6">
                            <p className="text-sm font-bold text-slate-800 tracking-tight leading-tight">
                                Better Skills
                            </p>
                            <p className="text-sm font-black text-km-primary tracking-tight leading-tight">
                                Brighter Tomorrows
                            </p>
                            <svg className="w-28 h-3 text-km-accent mt-0.5" viewBox="0 0 100 12" fill="none">
                                <path d="M2 8C28 2 72 2 98 9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                            </svg>
                        </div>

                        {/* Main Person — sized to sit within the K art, not overflow it */}
                        <div className="relative z-10 w-[50%] sm:w-[60%] lg:w-[75%] max-w-[360px] flex items-end justify-center">
                            <Image
                                src="/asset/hero/hero-worker-new-clean.png"
                                alt="KaamMilega Verified Candidate"
                                width={1254}
                                height={1254}
                                priority
                                className="w-full h-auto object-contain object-bottom drop-shadow-2xl"
                            />
                        </div>

                        {/* Floating Feature Card (Using kaammilega-logo-text.png, no hover animation) */}
                        <div className="absolute bottom-2 -right-1 sm:bottom-6 sm:-right-2 lg:-right-4 z-20 bg-white/95 backdrop-blur-md rounded-xl sm:rounded-2xl p-2.5 sm:p-4 shadow-lg sm:shadow-xl border border-slate-200/90 space-y-1.5 sm:space-y-2.5 min-w-[130px] sm:min-w-[160px] select-none">
                            <div className="flex items-center gap-2 sm:gap-2.5">
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-orange-50 text-km-accent flex items-center justify-center shrink-0">
                                    <Briefcase size={13} className="sm:hidden" />
                                    <Briefcase size={15} className="hidden sm:block" />
                                </div>
                                <span className="text-[11px] sm:text-sm font-bold text-slate-800">Jobs</span>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-2.5">
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-emerald-50 text-km-skills flex items-center justify-center shrink-0">
                                    <GraduationCap size={13} className="sm:hidden" />
                                    <GraduationCap size={15} className="hidden sm:block" />
                                </div>
                                <span className="text-[11px] sm:text-sm font-bold text-slate-800">Skills</span>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-2.5">
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-blue-50 text-km-blue flex items-center justify-center shrink-0">
                                    <Users size={13} className="sm:hidden" />
                                    <Users size={15} className="hidden sm:block" />
                                </div>
                                <span className="text-[11px] sm:text-sm font-bold text-slate-800">Opportunities</span>
                            </div>

                            <div className="flex items-center gap-2 sm:gap-2.5">
                                <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-md sm:rounded-lg bg-purple-50 text-km-mentors flex items-center justify-center shrink-0">
                                    <TrendingUp size={13} className="sm:hidden" />
                                    <TrendingUp size={15} className="hidden sm:block" />
                                </div>
                                <span className="text-[11px] sm:text-sm font-bold text-slate-800">Growth</span>
                            </div>

                            {/* Brand Lockup Baseline with kaammilega-logo-text.png */}
                            <div className="pt-1.5 sm:pt-2 border-t border-slate-100 flex items-center gap-1 sm:gap-1.5">
                                <span className="text-[10px] sm:text-[11px] font-semibold text-slate-500 shrink-0">All at</span>
                                <div className="relative h-3 w-16 sm:h-4 sm:w-20">
                                    <Image
                                        src="/kaammilega-logo-text.png"
                                        alt="Kaammilega™"
                                        fill
                                        className="object-contain object-left"
                                    />
                                </div>
                            </div>
                        </div>

                    </div>
                </div>

                {/* Real Platform Stats Strip */}
                <div className="mt-6 pt-6 sm:mt-10 sm:pt-8 border-t border-slate-200/80 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-km-primary flex items-center justify-center shrink-0">
                            <Users size={20} />
                        </div>
                        <div className="text-left">
                            <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                                {stats?.total_users ? `${stats.total_users}+ Users` : '120+ Users'}
                            </p>
                            <p className="text-xs text-slate-500 font-medium">Verified Community</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                            <MapPin size={20} />
                        </div>
                        <div className="text-left">
                            <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                                {stats?.cities || cities.length || 36}+ Cities
                            </p>
                            <p className="text-xs text-slate-500 font-medium">Verified Hubs</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-700 flex items-center justify-center shrink-0">
                            <Building2 size={20} />
                        </div>
                        <div className="text-left">
                            <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                                {stats?.applications ? `${stats.applications}+ Placed` : '100% Free'}
                            </p>
                            <p className="text-xs text-slate-500 font-medium">Direct Applications</p>
                        </div>
                    </div>
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center shrink-0">
                            <PhoneCall size={20} />
                        </div>
                        <div className="text-left">
                            <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">Direct Calls</p>
                            <p className="text-xs text-slate-500 font-medium">With HR Recruiters</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
