'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Search, ChevronDown, Smartphone, LogIn, ExternalLink, Menu, X } from 'lucide-react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import CitySelector from './CitySelector';

const GuestNavbar = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || 'All');
    const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);

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
        if (searchValue) params.set('q', searchValue);
        else params.delete('q');
        if (selectedCity && selectedCity !== 'All') params.set('city', selectedCity);
        else params.delete('city');
        router.push(`/jobs?${params.toString()}`);
        setMobileSearchOpen(false);
        setMobileMenuOpen(false);
    };

    return (
        <>
            <nav className="flex items-center justify-between px-4 md:px-6 py-3 bg-white border-b border-gray-100 shadow-sm font-sans sticky top-0 z-50">

                {/* Left: Logo */}
                <div className="flex items-center gap-2 cursor-pointer shrink-0">
                    <Link href="/">
                        <Image
                            src="/asset/icons/header_logo.png"
                            alt="Logo"
                            width={100}
                            height={50}
                        />
                    </Link>
                </div>

                {/* Center: Search Bar Group — desktop only */}
                <div className="hidden lg:flex items-center bg-gray-50 rounded-full border border-gray-200 p-1 ml-8 grow max-w-2xl">
                    <CitySelector
                        selectedCity={selectedCity}
                        onCityChange={handleCityChange}
                        variant="guest"
                    />
                    <div className="h-6 w-px bg-gray-300 mx-2"></div>
                    <form onSubmit={handleSearch} className="flex items-center grow px-2">
                        <Search size={18} className="text-gray-400 mr-3" />
                        <input
                            type="text"
                            placeholder="Job Title/Category"
                            value={searchValue}
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="bg-transparent text-sm outline-none w-full text-gray-700 placeholder:text-gray-400"
                        />
                    </form>
                </div>

                {/* Right: Actions — desktop */}
                <div className="hidden md:flex items-center gap-4 ml-4">
                    <button className="hidden lg:flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600">
                        <Smartphone size={18} />
                        Download App
                    </button>

                    <div className="flex items-center gap-1 text-sm font-medium text-gray-700 cursor-pointer">
                        English <ChevronDown size={16} />
                    </div>

                    <Link href="/login" className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-indigo-600">
                        <LogIn size={18} />
                        Login
                    </Link>

                    <Link
                        href="/recruiter/login"
                        className="bg-[#8B7EF8] hover:bg-[#7a6df0] text-white px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2 transition-all shadow-sm"
                    >
                        Hire Local Staff
                        <ExternalLink size={14} />
                    </Link>
                </div>

                {/* Mobile Right: Search + Hamburger */}
                <div className="flex md:hidden items-center gap-3 ml-2">
                    <button
                        onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                        aria-label="Search"
                    >
                        <Search size={20} />
                    </button>
                    <button
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                        aria-label="Menu"
                    >
                        {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Search Bar */}
            {mobileSearchOpen && (
                <div className="md:hidden bg-white border-b border-gray-100 px-4 py-3 shadow-sm z-40">
                    <form onSubmit={handleSearch} className="flex items-center bg-gray-50 rounded-full border border-gray-200 px-4 py-2 gap-2">
                        <Search size={16} className="text-gray-400 shrink-0" />
                        <input
                            type="text"
                            placeholder="Job Title/Category"
                            value={searchValue}
                            autoFocus
                            onChange={(e) => setSearchValue(e.target.value)}
                            className="bg-transparent text-sm outline-none w-full text-gray-700 placeholder:text-gray-400"
                        />
                        <button type="submit" className="bg-purple-500 text-white text-xs font-bold px-3 py-1 rounded-full shrink-0">
                            Go
                        </button>
                    </form>
                </div>
            )}

            {/* Mobile Menu Drawer */}
            {mobileMenuOpen && (
                <div className="md:hidden bg-white border-b border-gray-100 shadow-lg z-40 px-4 py-4 flex flex-col gap-3">
                    <Link
                        href="/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 py-2 text-sm font-semibold text-gray-700 hover:text-purple-600 border-b border-gray-50"
                    >
                        <LogIn size={18} /> Login
                    </Link>
                    <Link
                        href="/recruiter/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center gap-3 py-2 text-sm font-semibold text-gray-700 hover:text-purple-600 border-b border-gray-50"
                    >
                        <ExternalLink size={18} /> Hire Local Staff
                    </Link>
                    <button className="flex items-center gap-3 py-2 text-sm font-semibold text-gray-700 hover:text-purple-600 border-b border-gray-50">
                        <Smartphone size={18} /> Download App
                    </button>
                    <div className="flex items-center gap-2 py-2 text-sm font-semibold text-gray-700">
                        English <ChevronDown size={16} />
                    </div>
                    <Link
                        href="/recruiter/login"
                        onClick={() => setMobileMenuOpen(false)}
                        className="mt-1 bg-[#8B7EF8] hover:bg-[#7a6df0] text-white px-5 py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
                    >
                        Hire Local Staff <ExternalLink size={14} />
                    </Link>
                </div>
            )}
        </>
    );
};

export default GuestNavbar;