'use client'
import { useState, useRef, useEffect } from 'react';
import {
    Search, MapPin, ChevronDown, Home, Users, Briefcase,
    MessageSquare, BookOpen, Bell, ArrowUpRight, Menu, X,
    Calendar
} from 'lucide-react';
import CitySelector from './CitySelector';
import CustomImage from '@/components/ui/CustomImage';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface NavbarProps {
    showCitySelector?: boolean;
    user?: any;
}

const Navbar = ({ showCitySelector = true, user }: NavbarProps) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

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

    const displayName = user?.name || "User";

    // Determine Role
    const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
    const isRecruiter = roles.includes('recruiter');
    const isExpert = roles.includes('expert');
    const roleLabel = isRecruiter ? 'Recruiter' : isExpert ? 'Expert' : 'User';

    const router = useRouter();
    const searchParams = useSearchParams();

    const [searchValue, setSearchValue] = useState(searchParams.get('q') || '');
    const [selectedCity, setSelectedCity] = useState(searchParams.get('city') || 'All');

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
            <nav className="bg-white border-b border-gray-100 px-4 md:px-6 py-1.5 flex items-center justify-between sticky top-0 z-50">

                {/* Left Section: Logo & Search */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="flex items-center gap-2 shrink-0">
                        <Link href="/">
                            <Image src="/asset/icons/header_logo.png" alt="Logo" width={70} height={30} className="w-auto h-7" />
                        </Link>
                    </div>

                    {/* Desktop: City selector + Search */}
                    <div className="hidden md:flex items-center gap-3 flex-1 min-w-0">
                        {showCitySelector && (
                            <CitySelector
                                selectedCity={selectedCity}
                                onCityChange={handleCityChange}
                                variant="navbar"
                            />
                        )}

                        <form onSubmit={handleSearch} className="relative w-full max-w-sm">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                placeholder="Job Title/Category"
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                className="w-full pl-9 pr-4 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs focus:outline-none focus:ring-1 focus:ring-purple-900 transition-all focus:bg-white"
                            />
                        </form>
                    </div>
                </div>

                {/* Right Section: Desktop Icons & Profile */}
                <div className="hidden md:flex items-center gap-4 ml-4 shrink-0">
                    <div className="flex items-center gap-4 text-gray-700 border-r border-gray-200 pr-4">
                        {navLinks.map((link) => (
                            <Link key={link.href} href={link.href} title={link.label}>
                                <span className="cursor-pointer hover:text-purple-900 block transition-colors">{link.icon}</span>
                            </Link>
                        ))}
                        <div className="relative">
                            <Link href="/notifications" title="Notifications">
                                <Bell size={18} className="cursor-pointer hover:text-purple-900" />
                            </Link>
                            <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-red-500 rounded-full border border-white"></span>
                        </div>
                    </div>

                    {/* Profile Dropdown */}
                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setIsMenuOpen(!isMenuOpen)}
                            className="flex items-center gap-2 hover:bg-gray-50 p-1 rounded-lg transition-colors"
                        >
                            <div className="w-7 h-7 bg-purple-950 rounded-full flex items-center justify-center overflow-hidden">
                                {user?.profile_image ? (
                                    <CustomImage src={user.profile_image} alt={displayName} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="text-white scale-[0.6] rotate-45 font-bold">▲▲</div>
                                )}
                            </div>
                            <span className="text-xs font-semibold text-gray-800 hidden lg:inline">{displayName}</span>
                            <ChevronDown size={14} className={`text-gray-500 transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
                        </button>

                        {/* Context Menu (Dropdown) */}
                        {isMenuOpen && (
                            <div className="absolute right-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-gray-100 py-4 z-50">
                                {/* User Identity */}
                                <div className="px-4 pb-3 flex items-center gap-3">
                                    <div className="w-12 h-12 bg-purple-950 rounded-full flex items-center justify-center overflow-hidden text-white font-bold">
                                        {user?.profile_image ? (
                                            <CustomImage src={user.profile_image} alt={displayName} className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="rotate-45">▲▲</span>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900 leading-tight">{displayName}</h4>
                                        <p className="text-xs text-gray-500 italic">{roleLabel}</p>
                                    </div>
                                </div>

                                <div className="px-4 mb-4">
                                    <Link href="/profile">
                                        <button className="w-full py-1.5 border border-purple-800 text-purple-800 rounded-full text-xs font-bold hover:bg-purple-50 transition-colors">
                                            View Profile
                                        </button>
                                    </Link>
                                </div>

                                <hr className="border-gray-100" />

                                <div className="py-2">
                                    <h5 className="px-4 text-[13px] font-bold text-gray-900 mt-2">Account</h5>
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
                                            <h5 className="px-4 text-[13px] font-bold text-purple-900 mt-2">Expert Portal</h5>
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
                                        <Link href="/recruiter/register" className="flex items-center text-purple-800 text-xs font-bold hover:underline">
                                            Create Company Page <ArrowUpRight size={14} className="ml-1" />
                                        </Link>
                                        {!isExpert && (
                                            <Link href="/expert/apply" className="flex items-center text-purple-800 text-xs font-bold hover:underline">
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
                        onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
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
                        onClick={() => setMobileNavOpen(!mobileNavOpen)}
                        className="p-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors"
                        aria-label="Menu"
                    >
                        {mobileNavOpen ? <X size={22} /> : <Menu size={22} />}
                    </button>
                </div>
            </nav>

            {/* Mobile Search */}
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

            {/* Mobile Nav Drawer */}
            {mobileNavOpen && (
                <div className="md:hidden bg-white border-b border-gray-100 shadow-lg z-40">
                    {/* User identity */}
                    <div className="flex items-center gap-3 px-4 py-4 border-b border-gray-100">
                        <div className="w-10 h-10 bg-purple-950 rounded-full flex items-center justify-center overflow-hidden text-white font-bold shrink-0">
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
                            <span className="text-xs font-bold text-purple-700 border border-purple-200 px-3 py-1 rounded-full">Profile</span>
                        </Link>
                    </div>

                    {/* Nav links */}
                    <div className="py-2">
                        {navLinks.map((link) => (
                            <Link
                                key={link.href}
                                href={link.href}
                                onClick={() => setMobileNavOpen(false)}
                                className="flex items-center gap-4 px-5 py-3 text-sm font-semibold text-gray-700 hover:bg-purple-50 hover:text-purple-700 transition-colors"
                            >
                                {link.icon} {link.label}
                            </Link>
                        ))}
                    </div>

                    <hr className="border-gray-100" />

                    {/* Account actions */}
                    <div className="py-2 px-4 flex flex-col gap-1">
                        {!isRecruiter && (
                            <Link href="/settings" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">
                                Setting & Privacy
                            </Link>
                        )}
                        {isRecruiter ? (
                            <>
                                <Link href="/recruiter/jobs/list" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">My Jobs</Link>
                                <Link href="/recruiter/applications" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">Active Applications</Link>
                                <Link href="/recruiter/interviews" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">Interviews</Link>
                            </>
                        ) : (
                            <>
                                <Link href="/applications" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">Applied Jobs Status</Link>
                                <Link href="/interviews" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">Interviews</Link>
                                {!isExpert && (
                                    <Link href="/expert/apply" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">Apply to be an Expert</Link>
                                )}
                                {isExpert && (
                                    <>
                                        <hr className="border-gray-100 my-2" />
                                        <h5 className="px-4 text-[13px] font-bold text-purple-900">Expert Portal</h5>
                                        <Link href="/events/create" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">Create Event</Link>
                                        <Link href="/courses" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">My Courses</Link>
                                        <Link href="/expert/mentorship" onClick={() => setMobileNavOpen(false)} className="py-2 text-sm text-gray-600 hover:text-purple-700 font-medium">Manage Mentorships</Link>
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
                            className="w-full text-center py-2.5 text-sm font-bold text-red-500 hover:bg-red-50 rounded-xl transition-colors"
                        >
                            Sign Out
                        </button>
                    </div>
                </div>
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
