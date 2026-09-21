'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
    Search,
    MapPin,
    Briefcase,
    Zap,
    GraduationCap,
    Wrench,
    ChevronRight,
    CheckCircle2,
    Users,
    Building2,
    PhoneCall,
    Clock,
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

    const trendingKeywords = [
        'Delivery Partner',
        'Electrician',
        'Plumber',
        'Store Executive',
        'Warehouse',
        'Software Developer',
    ];

    return (
        <section className="bg-white pt-6 pb-12 sm:pt-10 sm:pb-16 border-b border-slate-200/80 font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Main Hero Grid */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                    {/* Left Column: Headings, Tabbed Search, Trending */}
                    <div className="lg:col-span-7 flex flex-col justify-center">
                        {/* Trust Tagline */}
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-100 text-km-primary text-xs font-semibold w-fit mb-5">
                            <CheckCircle2 size={15} className="text-km-primary shrink-0" />
                            <span>India&apos;s Verified Hiring &amp; Opportunity Ecosystem</span>
                        </div>

                        {/* Main Title (Aligned with Client Mockup) */}
                        <h1 className="text-3xl sm:text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-[1.15] mb-4">
                            Kaam Dhoondo.{' '}
                            <span className="text-km-accent">Milega Yahin!</span>
                        </h1>

                        <p className="text-sm sm:text-base text-slate-600 mb-8 max-w-xl leading-relaxed">
                            Connect directly with verified recruiters, schedule zero-brokerage interviews, or pick up local instant gigs with daily payouts.
                        </p>

                        {/* Search Card Container */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-4 sm:p-5">
                            {/* Tabs Header */}
                            <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4 overflow-x-auto">
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('jobs')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                                        activeTab === 'jobs'
                                            ? 'bg-km-primary text-white shadow-xs'
                                            : 'text-slate-600 hover:text-km-primary hover:bg-slate-50'
                                    }`}
                                >
                                    <Briefcase size={14} />
                                    <span>Find Jobs</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('instant')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                                        activeTab === 'instant'
                                            ? 'bg-amber-600 text-white shadow-xs'
                                            : 'text-amber-700 bg-amber-50/80 hover:bg-amber-100/80'
                                    }`}
                                >
                                    <Zap size={14} />
                                    <span>Instant Work (Daily Cash)</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('skills')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                                        activeTab === 'skills'
                                            ? 'bg-km-primary text-white shadow-xs'
                                            : 'text-slate-600 hover:text-km-primary hover:bg-slate-50'
                                    }`}
                                >
                                    <GraduationCap size={14} />
                                    <span>Learn Skills</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setActiveTab('mentors')}
                                    className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors shrink-0 ${
                                        activeTab === 'mentors'
                                            ? 'bg-km-primary text-white shadow-xs'
                                            : 'text-slate-600 hover:text-km-primary hover:bg-slate-50'
                                    }`}
                                >
                                    <Users size={14} />
                                    <span>1-on-1 Mentors</span>
                                </button>
                            </div>

                            {/* Tab 1: Find Jobs Form */}
                            {activeTab === 'jobs' && (
                                <form onSubmit={handleJobSearch} className="flex flex-col sm:flex-row gap-2.5">
                                    <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:bg-white focus-within:border-km-primary focus-within:ring-1 focus-within:ring-km-primary transition-all">
                                        <Search size={17} className="text-slate-400 mr-2.5 shrink-0" />
                                        <input
                                            type="text"
                                            placeholder="Job title, skill, or company..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
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
                                        className="bg-km-primary hover:bg-km-primary-dark text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md shrink-0 flex items-center justify-center gap-1.5"
                                    >
                                        <span>Search Jobs</span>
                                        <ChevronRight size={16} />
                                    </button>
                                </form>
                            )}

                            {/* Tab 2: Instant Gigs (Worker Perspective: Find immediate work & daily pay) */}
                            {activeTab === 'instant' && (
                                <form onSubmit={handleInstantGigSearch} className="flex flex-col gap-2.5">
                                    <div className="flex flex-col sm:flex-row gap-2.5">
                                        <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:bg-white focus-within:border-amber-600 focus-within:ring-1 focus-within:ring-amber-600 transition-all">
                                            <Wrench size={17} className="text-amber-600 mr-2.5 shrink-0" />
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
                                        <div className="sm:w-36 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:bg-white focus-within:border-amber-600 focus-within:ring-1 focus-within:ring-amber-600 transition-all">
                                            <MapPin size={17} className="text-slate-400 mr-2 shrink-0" />
                                            <input
                                                type="text"
                                                maxLength={6}
                                                placeholder="Your Pincode"
                                                value={pincode}
                                                onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                                                className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                                            />
                                        </div>
                                        <button
                                            type="submit"
                                            className="bg-amber-600 hover:bg-amber-700 text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md shrink-0 flex items-center justify-center gap-1.5"
                                        >
                                            <span>Find Gigs Nearby</span>
                                            <Zap size={15} />
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-amber-800 font-medium flex items-center gap-1.5">
                                        <Clock size={13} className="shrink-0 text-amber-600" />
                                        <span>⚡ 100% Free for workers. Local gig alerts dispatched in your area with daily wallet payouts.</span>
                                    </p>
                                </form>
                            )}

                            {/* Tab 3: Learn Skills */}
                            {activeTab === 'skills' && (
                                <form onSubmit={handleSkillSearch} className="flex flex-col sm:flex-row gap-2.5">
                                    <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:bg-white focus-within:border-km-primary focus-within:ring-1 focus-within:ring-km-primary transition-all">
                                        <Search size={17} className="text-slate-400 mr-2.5 shrink-0" />
                                        <input
                                            type="text"
                                            placeholder="Search skills & certifications (e.g. Electrician, React, Accounting)..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="bg-km-primary hover:bg-km-primary-dark text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md shrink-0 flex items-center justify-center gap-1.5"
                                    >
                                        <span>Explore Skills</span>
                                        <ChevronRight size={16} />
                                    </button>
                                </form>
                            )}

                            {/* Tab 4: Mentors */}
                            {activeTab === 'mentors' && (
                                <form onSubmit={handleMentorSearch} className="flex flex-col sm:flex-row gap-2.5">
                                    <div className="flex-1 flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:bg-white focus-within:border-km-primary focus-within:ring-1 focus-within:ring-km-primary transition-all">
                                        <Search size={17} className="text-slate-400 mr-2.5 shrink-0" />
                                        <input
                                            type="text"
                                            placeholder="Search mentors by domain (e.g. Career Coaching, Mock Interview, IT)..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="w-full bg-transparent text-xs sm:text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        className="bg-km-primary hover:bg-km-primary-dark text-white text-xs sm:text-sm font-bold px-6 py-3 rounded-xl transition-all shadow-sm hover:shadow-md shrink-0 flex items-center justify-center gap-1.5"
                                    >
                                        <span>Find Mentors</span>
                                        <ChevronRight size={16} />
                                    </button>
                                </form>
                            )}
                        </div>

                        {/* Trending Search Tags */}
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">Popular:</span>
                            {trendingKeywords.map((tag) => (
                                <button
                                    key={tag}
                                    type="button"
                                    onClick={() => {
                                        setSearchQuery(tag);
                                        router.push(`/jobs?q=${encodeURIComponent(tag)}`);
                                    }}
                                    className="text-[11px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 hover:text-km-primary px-2.5 py-1 rounded-md transition-colors"
                                >
                                    {tag}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Right Column: Hero Visual Anchor + Candidate Earning Cards (Zero Overlap Guaranteed) */}
                    <div className="lg:col-span-5 flex flex-col items-center justify-center">
                        {/* Dedicated Photo + Badge Container */}
                        <div className="relative w-full max-w-sm sm:max-w-md">
                            {/* Main Photo Box */}
                            <div className="relative w-full aspect-square rounded-3xl overflow-hidden bg-slate-100 border border-slate-200/90 shadow-md">
                                <Image
                                    src="/asset/hero/hero-worker.jpg"
                                    alt="KaamMilega Professional"
                                    fill
                                    priority
                                    sizes="(max-width: 768px) 100vw, 450px"
                                    className="object-cover object-top"
                                />
                            </div>

                            {/* Floating Badge 1: Top Right (Delivery Partner Earning Pill) */}
                            <div className="hidden sm:flex absolute top-4 -right-2 sm:-right-6 bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xl items-center gap-3 z-20 transition-all hover:scale-105">
                                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200">
                                    <Image
                                        src="/asset/hero/delivery.jpg"
                                        alt="Delivery Partner"
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-slate-900">Delivery Partner</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded text-emerald-700 bg-emerald-50">
                                            14 Gigs Open
                                        </span>
                                    </div>
                                    <p className="text-xs font-black text-km-primary">Earn ₹18k–₹26k/Mo</p>
                                </div>
                                <Link
                                    href="/jobs?q=Delivery"
                                    className="ml-2 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors bg-km-accent hover:bg-orange-600"
                                >
                                    Apply
                                </Link>
                            </div>

                            {/* Floating Badge 2: Bottom Left (Electrician Earning Pill - Anchored safely at bottom-10) */}
                            <div className="hidden sm:flex absolute bottom-10 -left-2 sm:-left-6 bg-white border border-slate-200/90 rounded-2xl p-2.5 sm:p-3 shadow-xl items-center gap-3 z-20 transition-all hover:scale-105">
                                <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border border-slate-200">
                                    <Image
                                        src="/asset/hero/electrician.jpg"
                                        alt="Electrician"
                                        width={40}
                                        height={40}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-xs font-bold text-slate-900">Electrician</span>
                                        <span className="text-[10px] text-amber-700 bg-amber-50 font-bold px-1.5 py-0.5 rounded">
                                            Daily Cash
                                        </span>
                                    </div>
                                    <p className="text-xs font-black text-km-primary">Earn ₹700–₹900/Day</p>
                                </div>
                                <Link
                                    href="/jobs?type=instant&role=Electrician"
                                    className="ml-2 bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors"
                                >
                                    View Gigs
                                </Link>
                            </div>
                        </div>

                        {/* Clean Dedicated InstantMilega Pill Banner (Placed safely with mt-6 gap, zero collision) */}
                        <div className="mt-6 w-full max-w-sm sm:max-w-md bg-slate-900 text-white rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-md">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
                                    <Zap size={16} />
                                </div>
                                <div>
                                    <span className="text-[10px] uppercase font-bold tracking-wider text-amber-400">
                                        InstantMilega™ Hyperlocal
                                    </span>
                                    <p className="text-xs font-bold text-slate-100">
                                        Get daily paid gigs in 15 mins across 36 cities
                                    </p>
                                </div>
                            </div>
                            <Link
                                href="/jobs?type=instant"
                                className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors shrink-0 flex items-center gap-1"
                            >
                                <span>Join Now</span>
                                <ChevronRight size={13} />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Real Platform Stats Strip */}
                <div className="mt-14 pt-8 border-t border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
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
