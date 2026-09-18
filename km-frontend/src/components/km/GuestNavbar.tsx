'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, Smartphone, LogIn, ExternalLink, Menu, X, Briefcase, Zap, GraduationCap, Calendar, Users } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import CitySelector from './CitySelector';
import BrandLogo from './BrandLogo';
import DownloadAppModal from './DownloadAppModal';

const GuestNavbar = () => {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || 'All');
    const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [selectedLang, setSelectedLang] = useState('English');
    const langRef = useRef<HTMLDivElement>(null);

    // Close language dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(event.target as Node)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Lock body scroll when mobile menu or mobile search is open
    useEffect(() => {
        if (mobileMenuOpen || mobileSearchOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [mobileMenuOpen, mobileSearchOpen]);

    const handleCityChange = (city: string) => {
        setSelectedCity(city);
        const params = new URLSearchParams(searchParams.toString());
        if (city && city !== 'All') params.set('city', city);
        else params.delete('city');
        if (searchValue) params.set('q', searchValue);
        router.push(`/jobs?${params.toString()}`);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (searchValue.trim()) params.set('q', searchValue.trim());
        else params.delete('q');
        if (selectedCity && selectedCity !== 'All') params.set('city', selectedCity);
        else params.delete('city');
        router.push(`/jobs?${params.toString()}`);
        setMobileSearchOpen(false);
        setMobileMenuOpen(false);
    };

    const navLinks = [
        { label: 'Jobs', href: '/jobs', icon: <Briefcase size={15} /> },
        { label: 'InstantMilega™', href: '/jobs?type=instant', icon: <Zap size={15} className="text-amber-500 fill-amber-500" />, isHighlighted: true },
        { label: 'Mentors', href: '/mentorship', icon: <GraduationCap size={15} /> },
        { label: 'Events', href: '/events', icon: <Calendar size={15} /> },
        { label: 'Network', href: '/network', icon: <Users size={15} /> },
    ];

    const isLinkActive = (item: { href: string }) => {
        if (item.href === '/jobs?type=instant') {
            return searchParams.get('type') === 'instant';
        }
        if (item.href === '/jobs') {
            return pathname === '/jobs' && searchParams.get('type') !== 'instant';
        }
        return pathname.startsWith(item.href);
    };

    return (
        <>
            <header className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-xs font-sans">
                {/* Main Nav Bar */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                    {/* Left: Official Brand Logo with proper spacing */}
                    <div className="shrink-0 flex items-center mr-2 md:mr-6">
                        <BrandLogo size="md" />
                    </div>

                    {/* Center: Search Bar with Integrated City Selector (Desktop) */}
                    <div className="hidden md:flex items-center flex-1 max-w-xl bg-slate-50 hover:bg-slate-100/80 rounded-full border border-slate-200 focus-within:border-km-primary focus-within:bg-white focus-within:ring-2 focus-within:ring-km-primary/15 transition-all p-1">
                        <CitySelector
                            selectedCity={selectedCity}
                            onCityChange={handleCityChange}
                            variant="guest"
                        />
                        <div className="h-5 w-px bg-slate-300 mx-1 shrink-0" />
                        <form onSubmit={handleSearch} className="flex items-center flex-1 min-w-0 pr-2">
                            <Search size={16} className="text-slate-400 mr-2 shrink-0" />
                            <input
                                type="text"
                                placeholder="Search jobs, skills, or companies..."
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="bg-transparent text-xs sm:text-sm outline-none w-full text-slate-800 placeholder:text-slate-400"
                            />
                            {searchValue && (
                                <button
                                    type="button"
                                    onClick={() => setSearchValue('')}
                                    className="text-slate-400 hover:text-slate-600 p-1"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </form>
                    </div>

                    {/* Right: Actions & Conversion (Desktop) */}
                    <div className="hidden lg:flex items-center gap-4 shrink-0">
                        {/* Download App Button */}
                        <button
                            type="button"
                            onClick={() => setIsDownloadModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-km-primary transition-colors py-2 px-2.5 rounded-lg hover:bg-slate-50"
                        >
                            <Smartphone size={16} className="text-slate-500" />
                            <span>App</span>
                        </button>

                        {/* Language Switcher */}
                        <div className="relative" ref={langRef}>
                            <button
                                type="button"
                                onClick={() => setIsLangOpen(!isLangOpen)}
                                className="flex items-center gap-1 text-xs font-semibold text-slate-700 hover:text-km-primary transition-colors py-2 px-2.5 rounded-lg hover:bg-slate-50"
                            >
                                <span>{selectedLang}</span>
                                <ChevronDown size={14} className={`transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
                            </button>
                            {isLangOpen && (
                                <div className="absolute right-0 mt-1 w-28 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedLang('English'); setIsLangOpen(false); }}
                                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${selectedLang === 'English' ? 'font-bold text-km-primary bg-blue-50' : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        English
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedLang('हिन्दी'); setIsLangOpen(false); }}
                                        className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${selectedLang === 'हिन्दी' ? 'font-bold text-km-primary bg-blue-50' : 'text-slate-700 hover:bg-slate-50'}`}
                                    >
                                        हिन्दी
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Login Link */}
                        <Link
                            href="/login"
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-km-primary transition-colors py-2 px-3 rounded-lg hover:bg-slate-50"
                        >
                            <LogIn size={15} />
                            <span>Sign In</span>
                        </Link>

                        {/* Hire Local Staff (Recruiter CTA) */}
                        <Link
                            href="/recruiter/login"
                            className="bg-km-primary hover:bg-km-primary-dark text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs hover:shadow-sm active:scale-98"
                        >
                            <span>Hire Staff</span>
                            <ExternalLink size={13} />
                        </Link>
                    </div>

                    {/* Mobile Right: Search + Hamburger */}
                    <div className="flex lg:hidden items-center gap-1.5 shrink-0">
                        <button
                            onClick={() => {
                                setMobileSearchOpen(!mobileSearchOpen);
                                if (mobileMenuOpen) setMobileMenuOpen(false);
                            }}
                            className={`p-2 rounded-xl transition-colors cursor-pointer ${
                                mobileSearchOpen ? 'bg-blue-50 text-km-primary' : 'text-slate-600 hover:bg-slate-100'
                            }`}
                            aria-label="Open search"
                        >
                            <Search size={19} />
                        </button>
                        <Link
                            href="/login"
                            className="px-3 py-1.5 text-xs font-semibold text-km-primary hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                        >
                            Sign In
                        </Link>
                        <button
                            onClick={() => {
                                setMobileMenuOpen(!mobileMenuOpen);
                                if (mobileSearchOpen) setMobileSearchOpen(false);
                            }}
                            className={`p-2 rounded-xl transition-colors ml-0.5 cursor-pointer ${
                                mobileMenuOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                            }`}
                            aria-label="Toggle navigation menu"
                        >
                            {mobileMenuOpen ? <X size={21} /> : <Menu size={21} />}
                        </button>
                    </div>
                </div>

                {/* Desktop Secondary Navigation Bar (Core Services) - Center Aligned with Active States */}
                <div className="hidden lg:block border-t border-slate-100 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="max-w-7xl mx-auto px-6 flex items-center justify-center">
                        <nav className="flex items-center gap-2 py-1.5">
                            {navLinks.map((item) => {
                                const active = isLinkActive(item);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                                            active
                                                ? item.isHighlighted
                                                    ? 'text-amber-900 bg-amber-100/80 font-bold shadow-xs'
                                                    : 'text-km-primary bg-blue-50/90 font-bold shadow-xs'
                                                : item.isHighlighted
                                                    ? 'text-amber-700 hover:bg-amber-50/80'
                                                    : 'text-slate-600 hover:text-km-primary hover:bg-slate-50'
                                        }`}
                                    >
                                        <span className={active ? (item.isHighlighted ? 'text-amber-700' : 'text-km-primary') : (item.isHighlighted ? 'text-amber-600' : 'text-slate-400')}>
                                            {item.icon}
                                        </span>
                                        <span>{item.label}</span>
                                        {active && (
                                            <span className={`absolute bottom-0 left-3 right-3 h-0.5 rounded-full ${item.isHighlighted ? 'bg-amber-500' : 'bg-km-primary'}`} />
                                        )}
                                    </Link>
                                );
                            })}
                        </nav>
                    </div>
                </div>
            </header>

            {/* Mobile Search Floating Overlay with High Z-Index & Backdrop */}
            {mobileSearchOpen && (
                <>
                    <div
                        onClick={() => setMobileSearchOpen(false)}
                        className="lg:hidden fixed inset-0 top-16 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
                        aria-hidden="true"
                    />
                    <div className="lg:hidden fixed top-16 inset-x-0 z-50 bg-white border-b border-slate-200 px-4 py-3.5 shadow-xl animate-in slide-in-from-top-2 duration-150">
                        <form onSubmit={handleSearch} className="flex items-center gap-2">
                            <div className="flex items-center flex-1 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-km-primary focus-within:bg-white focus-within:ring-1 focus-within:ring-km-primary transition-all">
                                <Search size={16} className="text-slate-400 mr-2 shrink-0" />
                                <input
                                    type="text"
                                    placeholder="Search jobs, skills, roles..."
                                    value={searchValue}
                                    autoFocus
                                    onChange={(e) => setSearchValue(e.target.value)}
                                    className="bg-transparent text-xs sm:text-sm outline-none w-full text-slate-800 placeholder:text-slate-400"
                                />
                            </div>
                            <button
                                type="submit"
                                className="bg-km-primary hover:bg-km-primary-dark text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shrink-0 transition-colors shadow-2xs cursor-pointer"
                            >
                                Search
                            </button>
                        </form>
                    </div>
                </>
            )}

            {/* Mobile Menu Drawer (Floating Overlay with High Z-Index & Dim Backdrop) */}
            {mobileMenuOpen && (
                <>
                    {/* Backdrop */}
                    <div
                        onClick={() => setMobileMenuOpen(false)}
                        className="lg:hidden fixed inset-0 top-16 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
                        aria-hidden="true"
                    />

                    {/* Drawer Content */}
                    <div className="lg:hidden fixed top-16 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-2xl max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain animate-in slide-in-from-top duration-200">
                        {/* Core Services Links */}
                        <div className="px-5 py-4 border-b border-slate-100">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                                Explore Ecosystem
                            </p>
                            <div className="space-y-1">
                                {navLinks.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors ${
                                            item.isHighlighted
                                                ? 'text-amber-800 bg-amber-50/80 font-bold border border-amber-200/60'
                                                : 'text-slate-700 hover:bg-slate-50 hover:text-km-primary active:bg-slate-100'
                                        }`}
                                    >
                                        <span className={item.isHighlighted ? 'text-amber-600' : 'text-slate-500'}>
                                            {item.icon}
                                        </span>
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Account & Recruitment CTAs */}
                        <div className="p-5 space-y-3 border-b border-slate-100 bg-slate-50/50">
                            <Link
                                href="/login"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                            >
                                <LogIn size={16} />
                                <span>Sign In as Candidate</span>
                            </Link>
                            <Link
                                href="/recruiter/login"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-km-primary hover:bg-km-primary-dark text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-900/15 cursor-pointer"
                            >
                                <span>Hire Local Staff (Recruiter Portal)</span>
                                <ExternalLink size={15} />
                            </Link>
                        </div>

                        {/* Utilities: App Download & Language */}
                        <div className="px-5 py-3.5 bg-slate-100/80 flex items-center justify-between text-xs text-slate-700">
                            <button
                                type="button"
                                onClick={() => { setMobileMenuOpen(false); setIsDownloadModalOpen(true); }}
                                className="flex items-center gap-2 font-bold text-slate-700 hover:text-km-primary py-1 cursor-pointer"
                            >
                                <Smartphone size={16} className="text-slate-500" />
                                <span>Install Mobile App</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedLang(selectedLang === 'English' ? 'हिन्दी' : 'English')}
                                className="font-bold text-km-primary hover:underline py-1 cursor-pointer"
                            >
                                {selectedLang === 'English' ? 'Switch to हिन्दी' : 'Switch to English'}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* Functional App Download Dialog */}
            <DownloadAppModal
                isOpen={isDownloadModalOpen}
                onClose={() => setIsDownloadModalOpen(false)}
            />
        </>
    );
};

export default GuestNavbar;