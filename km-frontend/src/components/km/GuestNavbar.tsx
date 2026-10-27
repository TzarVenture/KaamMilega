'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowSquareOutIcon, DeviceMobileIcon, ListIcon, MagnifyingGlassIcon, SignInIcon, XIcon } from '@phosphor-icons/react';
import { EventsNavIcon, InstantNavIcon, JobsNavIcon, MentorsNavIcon, NetworkNavIcon, type NavIcon } from './icons/NavIcons';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import CitySelector from './CitySelector';
import BrandLogo from './BrandLogo';
import ThemeToggle, { ThemeIconButton } from './ThemeToggle';
import DownloadAppModal from './DownloadAppModal';
import SearchHint from './SearchHint';
import { LanguageList, LanguageMenu } from './LanguageSwitcher';
import { FEATURES } from '@/config/features';

const GuestNavbar = () => {
    const t = useTranslations('nav');
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || 'All');
    const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);

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

    const navLinks: { label: string; href: string; Icon: NavIcon; isHighlighted?: boolean }[] = [
        { label: t('jobs'), href: '/jobs', Icon: JobsNavIcon },
        ...(FEATURES.INSTANT_MILEGA ? [{ label: t('instantMilega'), href: '/instant-milega', Icon: InstantNavIcon, isHighlighted: true }] : []),
        { label: t('mentors'), href: '/mentorship', Icon: MentorsNavIcon },
        { label: t('events'), href: '/events', Icon: EventsNavIcon },
        { label: t('network'), href: '/network', Icon: NetworkNavIcon },
    ];

    const isLinkActive = (item: { href: string }) => {
        if (item.href === '/instant-milega') {
            return pathname === '/instant-milega' || searchParams.get('type') === 'instant';
        }
        if (item.href === '/jobs') {
            return pathname === '/jobs' && searchParams.get('type') !== 'instant';
        }
        return pathname.startsWith(item.href);
    };

    return (
        <>
            <header className="sticky top-0 z-50 bg-km-surface-card border-b border-slate-200 shadow-xs font-sans">
                {/* Main Nav Bar */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
                    {/* Left: Official Brand Logo with proper spacing */}
                    <div className="shrink-0 flex items-center mr-2 md:mr-6">
                        <BrandLogo size="md" />
                    </div>

                    {/* Center: Search Bar with Integrated City Selector (Desktop) */}
                    <div className="hidden md:flex items-center flex-1 max-w-xl bg-slate-50 hover:bg-slate-100/80 rounded-full border border-slate-200 focus-within:border-km-primary focus-within:bg-km-surface-card focus-within:ring-2 focus-within:ring-km-primary/15 transition-all p-1">
                        <CitySelector
                            selectedCity={selectedCity}
                            onCityChange={handleCityChange}
                            variant="guest"
                        />
                        <div className="h-5 w-px bg-slate-300 mx-1 shrink-0" />
                        <form onSubmit={handleSearch} className="relative flex items-center flex-1 min-w-0 pr-2">
                            <MagnifyingGlassIcon weight="bold" size={16} className="text-slate-400 mr-2 shrink-0" />
                            <input
                                type="text"
                                aria-label={t('searchLabel')}
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="bg-transparent text-sm outline-none w-full text-slate-800"
                            />
                            {!searchValue && <SearchHint className="left-6 right-2" />}
                            {searchValue && (
                                <button
                                    type="button"
                                    onClick={() => setSearchValue('')}
                                    aria-label={t('clearSearch')}
                                    className="text-slate-400 hover:text-slate-600 p-1"
                                >
                                    <XIcon weight="bold" size={14} />
                                </button>
                            )}
                        </form>
                    </div>

                    {/* Right: Actions & Conversion (Desktop) */}
                    <div className="hidden lg:flex items-center gap-4 shrink-0">
                        {FEATURES.DARK_MODE && <ThemeIconButton />}

                        {/* Download App Button */}
                        <button
                            type="button"
                            onClick={() => setIsDownloadModalOpen(true)}
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-km-heading transition-colors py-2 px-2.5 rounded-lg hover:bg-slate-50"
                        >
                            <DeviceMobileIcon weight="bold" size={16} className="text-slate-500" />
                            <span>{t('app')}</span>
                        </button>

                        {FEATURES.I18N && <LanguageMenu />}

                        {/* Login Link */}
                        <Link
                            href="/login"
                            className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-km-heading transition-colors py-2 px-3 rounded-lg hover:bg-slate-50"
                        >
                            <SignInIcon weight="bold" size={15} />
                            <span>{t('signIn')}</span>
                        </Link>

                        {/* Hire Local Staff (Recruiter CTA) */}
                        <Link
                            href="/recruiter/login"
                            className="bg-km-primary hover:bg-km-primary-dark text-white text-xs font-bold px-4 py-2.5 rounded-xl flex items-center gap-1.5 transition-all shadow-xs hover:shadow-sm active:scale-98"
                        >
                            <span>{t('hireStaff')}</span>
                            <ArrowSquareOutIcon weight="bold" size={13} />
                        </Link>
                    </div>

                    {/* Mobile Right: Search + Hamburger */}
                    <div className="flex lg:hidden items-center gap-1 shrink-0">
                        {FEATURES.DARK_MODE && (
                            <div className="hidden sm:block">
                                <ThemeIconButton />
                            </div>
                        )}
                        <button
                            onClick={() => {
                                setMobileSearchOpen(!mobileSearchOpen);
                                if (mobileMenuOpen) setMobileMenuOpen(false);
                            }}
                            className={`p-2 rounded-xl transition-colors cursor-pointer ${mobileSearchOpen ? 'bg-blue-50 text-km-heading' : 'text-slate-600 hover:bg-slate-100'
                                }`}
                            aria-label={t('openSearch')}
                        >
                            <MagnifyingGlassIcon size={19} />
                        </button>
                        <Link
                            href="/login"
                            className="px-3 py-1.5 text-xs font-semibold text-km-heading hover:bg-blue-50 rounded-lg transition-colors border border-blue-100"
                        >
                            {t('signIn')}
                        </Link>
                        <button
                            onClick={() => {
                                setMobileMenuOpen(!mobileMenuOpen);
                                if (mobileSearchOpen) setMobileSearchOpen(false);
                            }}
                            className={`p-2 rounded-xl transition-colors ml-0.5 cursor-pointer ${mobileMenuOpen ? 'bg-slate-100 text-slate-900' : 'text-slate-700 hover:bg-slate-100'
                                }`}
                            aria-label={t('toggleMenu')}
                        >
                            {mobileMenuOpen ? <XIcon size={21} /> : <ListIcon size={21} />}
                        </button>
                    </div>
                </div>

                {/* Desktop Secondary Navigation Bar (Core Services) - Center Aligned with Active States */}
                <div className="hidden lg:block border-t border-slate-100 bg-km-surface-card shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                    <div className="max-w-7xl mx-auto px-6 flex items-center justify-center">
                        <nav className="flex items-center gap-2 py-1.5">
                            {navLinks.map((item) => {
                                const active = isLinkActive(item);
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        className={`group relative flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 ${active
                                                ? item.isHighlighted
                                                    ? 'text-amber-900 bg-amber-100/80 font-bold shadow-xs'
                                                    : 'text-km-heading bg-blue-50/90 font-bold shadow-xs'
                                                : item.isHighlighted
                                                    ? 'text-amber-700 hover:bg-amber-50/80'
                                                    : 'text-slate-600 hover:text-km-heading hover:bg-slate-50'
                                            }`}
                                    >
                                        <span className={active ? (item.isHighlighted ? 'text-amber-700' : 'text-km-heading') : (item.isHighlighted ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500')}>
                                            <item.Icon size={17} strokeWidth={2} active={active} />
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
                        className="lg:hidden fixed inset-0 top-16 z-40 bg-km-ink/40 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
                        aria-hidden="true"
                    />
                    <div className="lg:hidden fixed top-16 inset-x-0 z-50 bg-km-surface-card border-b border-slate-200 px-4 py-3.5 shadow-xl animate-in slide-in-from-top-2 duration-150">
                        <form onSubmit={handleSearch} className="flex items-center gap-2">
                            <div className="relative flex items-center flex-1 bg-slate-50 rounded-xl border border-slate-200 px-3 py-2.5 focus-within:border-km-primary focus-within:bg-km-surface-card focus-within:ring-1 focus-within:ring-km-primary transition-all">
                                <MagnifyingGlassIcon weight="bold" size={16} className="text-slate-400 mr-2 shrink-0" />
                                <input
                                    type="text"
                                    aria-label={t('searchLabel')}
                                    value={searchValue}
                                    autoFocus
                                    onChange={(e) => setSearchValue(e.target.value)}
                                    className="bg-transparent text-sm outline-none w-full text-slate-800"
                                />
                                {!searchValue && <SearchHint className="left-9 right-3" />}
                            </div>
                            <button
                                type="submit"
                                className="bg-km-primary hover:bg-km-primary-dark text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl shrink-0 transition-colors shadow-2xs cursor-pointer"
                            >
                                {t('search')}
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
                        className="lg:hidden fixed inset-0 top-16 z-40 bg-km-ink/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
                        aria-hidden="true"
                    />

                    {/* Drawer Content */}
                    <div className="lg:hidden fixed top-16 inset-x-0 z-50 bg-km-surface-card border-b border-slate-200 shadow-2xl max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain animate-in slide-in-from-top duration-200">
                        {/* Core Services Links */}
                        <div className="px-5 py-4 border-b border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 mb-2">
                                {t('browse')}
                            </p>
                            <div className="space-y-1">
                                {navLinks.map((item) => (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        onClick={() => setMobileMenuOpen(false)}
                                        className={`group flex items-center gap-3 py-2.5 px-3 rounded-xl text-sm font-semibold transition-colors ${item.isHighlighted
                                                ? 'text-amber-800 bg-amber-50/80 font-bold border border-amber-200/60'
                                                : 'text-slate-700 hover:bg-slate-50 hover:text-km-heading active:bg-slate-100'
                                            }`}
                                    >
                                        <span className={item.isHighlighted ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}>
                                            <item.Icon size={19} strokeWidth={1.9} active={isLinkActive(item)} />
                                        </span>
                                        <span>{item.label}</span>
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {FEATURES.DARK_MODE && (
                            <div className="px-5 py-4 border-b border-slate-100 sm:hidden">
                                <p className="text-xs font-semibold text-slate-500 mb-2">{t('appearance')}</p>
                                <ThemeToggle />
                            </div>
                        )}

                        {/* Account & Recruitment CTAs */}
                        <div className="p-5 space-y-3 border-b border-slate-100 bg-slate-50/50">
                            <Link
                                href="/login"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-km-surface-card border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-bold rounded-xl transition-all shadow-2xs cursor-pointer"
                            >
                                <SignInIcon weight="bold" size={16} />
                                <span>{t('signInCandidate')}</span>
                            </Link>
                            <Link
                                href="/recruiter/login"
                                onClick={() => setMobileMenuOpen(false)}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-km-primary hover:bg-km-primary-dark text-white text-sm font-bold rounded-xl transition-all shadow-md shadow-blue-900/15 cursor-pointer"
                            >
                                <span>{t('hireLocalStaff')}</span>
                                <ArrowSquareOutIcon weight="bold" size={15} />
                            </Link>
                        </div>

                        {FEATURES.I18N && (
                            <div className="px-5 py-4 border-b border-slate-100">
                                <p className="text-xs font-semibold text-slate-500 mb-2">{t('language')}</p>
                                <LanguageList />
                            </div>
                        )}

                        {/* Utilities: App Download */}
                        <div className="px-5 py-3.5 bg-slate-100/80 flex items-center justify-between text-xs text-slate-700">
                            <button
                                type="button"
                                onClick={() => { setMobileMenuOpen(false); setIsDownloadModalOpen(true); }}
                                className="flex items-center gap-2 font-bold text-slate-700 hover:text-km-heading py-1 cursor-pointer"
                            >
                                <DeviceMobileIcon weight="bold" size={16} className="text-slate-500" />
                                <span>{t('installApp')}</span>
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