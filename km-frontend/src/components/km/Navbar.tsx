'use client'
import { useState, useRef, useEffect } from 'react';
import {
    Search, MapPin, ChevronDown, Home, Users, Briefcase,
    MessageSquare, BookOpen, Bell, ArrowUpRight, Menu, X,
    Calendar
} from 'lucide-react';
import CitySelector from './CitySelector';
import BrandLogo from './BrandLogo';
import CustomImage from '@/components/ui/CustomImage';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

interface NavbarProps {
    showCitySelector?: boolean;
    user?: any;
}

const Navbar = ({ showCitySelector = true, user }: NavbarProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Lock body scroll when mobile drawer or mobile search is open
    useEffect(() => {
        if (mobileNavOpen || mobileSearchOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
        return () => {
            document.body.style.overflow = '';
        };
    }, [mobileNavOpen, mobileSearchOpen]);

    // Close mobile drawers on route change
    useEffect(() => {
        setMobileNavOpen(false);
        setMobileSearchOpen(false);
    }, [pathname]);

    const displayName = user?.name || "User";

    // Determine Role
    const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
    const isRecruiter = roles.includes('recruiter');
    const isExpert = roles.includes('expert');
    const roleLabel = isRecruiter ? 'Recruiter' : isExpert ? 'Expert' : 'User';

    const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
    const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || 'All');

    const isLinkActive = (href: string) => {
        if (href === '/') return pathname === '/';
        return pathname === href || pathname.startsWith(href + '/');
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
        setMobileNavOpen(false);
    };

    const handleCityChange = (city: string) => {
        setSelectedCity(city);
        const params = new URLSearchParams(searchParams.toString());
        if (city && city !== 'All') params.set('city', city);
        else params.delete('city');

        if (searchValue) params.set('q', searchValue);
        router.push(`/jobs?${params.toString()}`);
    };

    const navLinks = [
        { href: '/', icon: <Home size={18} />, label: 'Home' },
        { href: '/network', icon: <Users size={18} />, label: 'Network' },
        { href: '/events', icon: <Calendar size={18} />, label: 'Events' },
        { href: '/jobs', icon: <Briefcase size={18} />, label: 'Jobs' },
        { href: '/mentorship', icon: <BookOpen size={18} />, label: 'Mentors' },
        { href: '/chat', icon: <MessageSquare size={18} />, label: 'Chat' },
        ...(!isRecruiter ? [{ href: '/resources', icon: <BookOpen size={18} />, label: 'Resources' }] : []),
    ];

    return (
        <>
            <nav className="bg-white border-b border-slate-200 px-4 md:px-6 h-16 flex items-center justify-between sticky top-0 z-50 shadow-xs font-sans">

                {/* Left Section: Logo & Search */}
                <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div className="shrink-0 flex items-center">
                        <BrandLogo size="sm" showTextOnMobile={false} />
                    </div>

                    {/* Desktop: City selector + Search */}
                    <div className="hidden md:flex items-center gap-3 flex-1 min-w-0 max-w-md">
                        {showCitySelector && (
                            <CitySelector
                                selectedCity={selectedCity}
                                onCityChange={handleCityChange}
                                variant="navbar"
                            />
                        )}

                        <form onSubmit={handleSearch} className="relative w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                                type="text"
                                placeholder="Job Title, Skills or Category..."
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="w-full pl-9 pr-7 py-2 bg-slate-50 border border-slate-200 rounded-full text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:border-km-primary focus:bg-white focus:ring-2 focus:ring-km-primary/15 transition-all"
                            />
                            {searchValue && (
                                <button
                                    type="button"
                                    onClick={() => setSearchValue('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                                >
                                    <X size={13} />
                                </button>
                            )}
                        </form>
                    </div>
                </div>

                {/* Right Section: Desktop Icons with Custom Tooltips & Profile */}
                <div className="hidden md:flex items-center gap-3 ml-4 shrink-0">
                    <div className="flex items-center gap-1.5 text-slate-600 border-r border-slate-200 pr-3">
                        {navLinks.map((link) => {
                            const isActive = isLinkActive(link.href);
                            return (
                                <div key={link.href} className="relative group flex items-center justify-center">
                                    <Link
                                        href={link.href}
                                        className={`relative p-2 rounded-xl flex items-center justify-center transition-all duration-150 ${
                                            isActive
                                                ? 'text-km-primary bg-blue-50/90 font-bold shadow-xs'
                                                : 'text-slate-600 hover:text-km-primary hover:bg-slate-50'
                                        }`}
                                        aria-label={link.label}
                                    >
                                        {link.icon}
                                        {isActive && (
                                            <span className="absolute -bottom-1 left-2 right-2 h-0.5 bg-km-primary rounded-full" />
                                        )}
                                    </Link>

                                    {/* Custom Floating Tooltip */}
                                    <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 translate-y-1 group-hover:translate-y-0 z-50">
                                        <div className="bg-slate-900 text-white text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-md whitespace-nowrap">
                                            {link.label}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Notifications Icon with Custom Tooltip */}
                        <div className="relative group flex items-center justify-center">
                            <Link
                                href="/notifications"
                                className={`relative p-2 rounded-xl flex items-center justify-center transition-all duration-150 ${
                                    pathname === '/notifications'
                                        ? 'text-km-primary bg-blue-50/90 font-bold shadow-xs'
                                        : 'text-slate-600 hover:text-km-primary hover:bg-slate-50'
                                    }`}
                                aria-label="Notifications"
                            >
                                <Bell size={18} />
                                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
                                {pathname === '/notifications' && (
                                    <span className="absolute -bottom-1 left-2 right-2 h-0.5 bg-km-primary rounded-full" />
                                )}
                            </Link>

                            {/* Custom Tooltip */}
                            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 translate-y-1 group-hover:translate-y-0 z-50">
                                <div className="bg-slate-900 text-white text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-md whitespace-nowrap">
                                    Notifications
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Profile Dropdown */}
                    <div className="relative group" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center gap-2 hover:bg-slate-50 p-1.5 rounded-xl transition-colors border border-transparent hover:border-slate-200"
                        >
                            <div className="w-8 h-8 bg-km-primary rounded-full flex items-center justify-center overflow-hidden shrink-0">
                                {user?.profile_image ? (
                                    <CustomImage src={user.profile_image} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-white text-xs font-bold">{displayName?.[0]?.toUpperCase() || 'U'}</span>
                                )}
                            </div>
                            <span className="text-xs font-semibold text-slate-800 hidden lg:inline">{displayName}</span>
                            <ChevronDown size={14} className={`text-slate-500 transition-transform duration-200 ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Profile Tooltip */}
                        {!isMenuOpen && (
                            <div className="absolute -bottom-8 right-0 opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 translate-y-1 group-hover:translate-y-0 z-50">
                                <div className="bg-slate-900 text-white text-[10px] font-semibold py-0.5 px-2 rounded-md shadow-md whitespace-nowrap">
                                    Account &amp; Settings
                                </div>
                            </div>
                        )}

                        {/* Context Menu (Dropdown) */}
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 py-4 z-50 animate-in fade-in zoom-in-95 duration-150">
                                {/* User Identity */}
                                <div className="px-4 pb-3 flex items-center gap-3">
                                    <div className="w-11 h-11 bg-km-primary rounded-full flex items-center justify-center overflow-hidden text-white font-bold shrink-0">
                                        {user?.profile_image ? (
                                            <CustomImage src={user.profile_image} alt={displayName} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-sm font-bold">{displayName?.[0]?.toUpperCase() || 'U'}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <h4 className="font-bold text-slate-900 leading-tight truncate">{displayName}</h4>
                                        <span className="inline-block mt-0.5 px-2 py-0.5 bg-blue-50 text-km-primary rounded-full text-[10px] font-bold">{roleLabel}</span>
                                    </div>
                                </div>

                                <div className="px-4 mb-3">
                                    <Link href="/profile">
                                        <button className="w-full py-1.5 border border-km-primary text-km-primary hover:bg-blue-50 rounded-xl text-xs font-bold transition-colors">
                                            View Profile
                                        </button>
                                    </Link>
                                </div>

                                <hr className="border-gray-100" />

                                <div className="py-2">
                                    <h5 className="px-4 text-[13px] font-bold text-gray-900 mt-2">Account</h5>
                                    <MenuItem label="Digital Wallet" href="/wallet" />
                                    {!isRecruiter && <MenuItem label="Try Premium" />}
                                    <MenuItem label="Setting & Privacy" href={isRecruiter ? '/recruiter/settings' : '/settings'} />
                                    <MenuItem label="Help" />
                                    <MenuItem label="Language" />
                                </div>

                                <hr className="border-gray-100" />

                                <div className="py-2">
                                    <h5 className="px-4 text-[13px] font-bold text-gray-900 mt-2">Manage</h5>
                                    {isRecruiter ? (
                                        <>
                                            <MenuItem label="My Jobs" href="/recruiter/jobs/list" />
                                            <MenuItem label="Active Applications" href="/recruiter/applications" />
                                            <MenuItem label="Interviews" href="/recruiter/interviews" />
                                        </>
                                    ) : (
                                        <>
                                            <MenuItem label="Posts & Activity" />
                                            <MenuItem label="Job Posting Account" href="/recruiter" />
                                            <MenuItem label="Applied Jobs Status" href="/applications" />
                                            <MenuItem label="Interviews" href="/interviews" />
                                        </>
                                    )}
                                    {isExpert && (
                                        <>
                                            <hr className="border-gray-100 my-2" />
                                            <h5 className="px-4 text-[13px] font-bold text-km-primary mt-2">Expert Portal</h5>
                                            <MenuItem label="Create Event" href="/user/events/create" />
                                            <MenuItem label="My Courses" href="/courses" />
                                            <MenuItem label="Manage Mentorships" href="/expert/mentorship" />
                                        </>
                                    )}
                                </div>

                                <hr className="border-gray-100" />

                                <div className="pt-2">
                                    <MenuItem label="Sign Out" onClick={() => {
                                        localStorage.removeItem('token');
                                        localStorage.removeItem('user');
                                        window.location.href = '/login';
                                    }} />
                                </div>

                                {!isRecruiter && (
                                    <div className="px-4 pt-4 flex flex-col gap-2">
                                        <Link href="/recruiter/register" className="flex items-center text-km-primary text-xs font-bold hover:underline">
                                            Create Company Page <ArrowUpRight size={14} className="ml-1" />
                                        </Link>
                                        {!isExpert && (
                                            <Link href="/expert/apply" className="flex items-center text-km-primary text-xs font-bold hover:underline">
                                                Apply to be an Expert <ArrowUpRight size={14} className="ml-1" />
                                            </Link>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Mobile Right: Search + Avatar + Hamburger */}
                <div className="flex md:hidden items-center gap-2 ml-2 shrink-0">
                    <button
                        onClick={() => {
                            setMobileSearchOpen(!mobileSearchOpen);
                            if (mobileNavOpen) setMobileNavOpen(false);
                        }}
                        className={`p-2 rounded-full transition-colors cursor-pointer ${
                            mobileSearchOpen ? 'bg-blue-50 text-km-primary' : 'hover:bg-gray-100 text-gray-600'
                        }`}
                        aria-label="Search"
                    >
                        <Search size={20} />
                    </button>
                    <div className="relative">
                        <Link href="/notifications">
                            <Bell size={20} className="text-gray-600" />
                        </Link>
                        <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full border border-white"></span>
                    </div>
                    <button
                        onClick={() => {
                            setMobileNavOpen(!mobileNavOpen);
                            if (mobileSearchOpen) setMobileSearchOpen(false);
                        }}
                        className={`p-2 rounded-full transition-colors cursor-pointer ${
                            mobileNavOpen ? 'bg-slate-100 text-slate-900' : 'hover:bg-gray-100 text-gray-600'
                        }`}
                        aria-label="Menu"
                    >
                        {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Search Overlay */}
            {mobileSearchOpen && (
                <>
                    <div
                        onClick={() => setMobileSearchOpen(false)}
                        className="md:hidden fixed inset-0 top-16 z-40 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-150 animate-in fade-in"
                        aria-hidden="true"
                    />
                    <div className="md:hidden fixed top-16 inset-x-0 z-50 bg-white border-b border-slate-200 px-4 py-3 shadow-xl animate-in slide-in-from-top-2 duration-150">
                        <form onSubmit={handleSearch} className="flex items-center bg-slate-50 rounded-xl border border-slate-200 px-3.5 py-2 gap-2 focus-within:border-km-primary focus-within:bg-white focus-within:ring-1 focus-within:ring-km-primary transition-all">
                            <Search size={16} className="text-slate-400 shrink-0" />
                            <input
                                type="text"
                                placeholder="Job Title, Skills or Category..."
                                value={searchValue}
                                autoFocus
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="bg-transparent text-sm outline-none w-full text-slate-800 placeholder:text-slate-400"
                            />
                            <button type="submit" className="bg-km-primary hover:bg-km-primary-dark text-white text-xs font-bold px-3.5 py-1.5 rounded-lg shrink-0 transition-colors cursor-pointer shadow-2xs">
                                Go
                            </button>
                        </form>
                    </div>
                </>
            )}

            {/* Mobile Nav Drawer */}
            {mobileNavOpen && (
                <>
                    <div
                        onClick={() => setMobileNavOpen(false)}
                        className="md:hidden fixed inset-0 top-16 z-40 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200 animate-in fade-in"
                        aria-hidden="true"
                    />
                    <div className="md:hidden fixed top-16 inset-x-0 z-50 bg-white border-b border-slate-200 shadow-2xl max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain animate-in slide-in-from-top duration-200">
                        {/* User identity */}
                        <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
                            <div className="w-10 h-10 bg-km-primary rounded-full flex items-center justify-center overflow-hidden text-white font-bold shrink-0">
                                {user?.profile_image ? (
                                    <CustomImage src={user.profile_image} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <span className="rotate-45 text-sm">▲▲</span>
                                )}
                            </div>
                            <div>
                                <p className="font-bold text-gray-900 text-sm">{displayName}</p>
                                <p className="text-xs text-gray-500 italic">{roleLabel}</p>
                            </div>
                            <Link href="/profile" className="ml-auto" onClick={() => setMobileNavOpen(false)}>
                                <span className="text-xs font-bold text-km-primary border border-blue-200 px-3 py-1 rounded-full hover:bg-blue-50 transition-colors">Profile</span>
                            </Link>
                        </div>

                        {/* Nav links */}
                        <div className="py-2">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    onClick={() => setMobileNavOpen(false)}
                                    className="flex items-center gap-4 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-blue-50 hover:text-km-primary transition-colors"
                                >
                                    {link.icon} {link.label}
                                </Link>
                            ))}
                        </div>

                        <hr className="border-gray-100" />

                        {/* Account actions */}
                        <div className="py-2 px-4 flex flex-col gap-1">
                            <Link href="/wallet" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium">
                                Digital Wallet & Ledger
                            </Link>
                            {!isRecruiter && (
                                <Link href="/settings" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">
                                    Setting & Privacy
                                </Link>
                            )}
                            {isRecruiter ? (
                                <>
                                    <Link href="/recruiter/jobs/list" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">My Jobs</Link>
                                    <Link href="/recruiter/applications" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">Active Applications</Link>
                                    <Link href="/recruiter/interviews" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">Interviews</Link>
                                </>
                            ) : (
                                <>
                                    <Link href="/applications" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">Applied Jobs Status</Link>
                                    <Link href="/interviews" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">Interviews</Link>
                                    {!isExpert && (
                                        <Link href="/expert/apply" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">Apply to be an Expert</Link>
                                    )}
                                    {isExpert && (
                                        <>
                                            <hr className="border-gray-100 my-2" />
                                            <h5 className="px-4 text-[13px] font-bold text-km-primary">Expert Portal</h5>
                                            <Link href="/events/create" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">Create Event</Link>
                                            <Link href="/courses" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">My Courses</Link>
                                            <Link href="/expert/mentorship" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-km-primary font-medium transition-colors">Manage Mentorships</Link>
                                        </>
                                    )}
                                </>
                            )}
                        </div>

                        <hr className="border-gray-100" />

                        <div className="px-4 py-3">
                            <button
                                onClick={() => {
                                    localStorage.removeItem('token');
                                    localStorage.removeItem('user');
                                    window.location.href = '/login';
                                }}
                                className="w-full text-center py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors cursor-pointer"
                            >
                                Sign Out
                            </button>
                        </div>
                    </div>
                </>
            )}
        </>
    );
};

const MenuItem = ({ label, onClick, href }: { label: string; onClick?: () => void; href?: string }) => {
    const content = (
        <div onClick={onClick} className="px-4 py-1.5 text-xs text-gray-500 hover:bg-gray-50 cursor-pointer transition-colors">
            {label}
        </div>
    );

    if (href) {
        return <Link href={href}>{content}</Link>;
    }

    return content;
};

export default Navbar;
