'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandLogo from '@/components/km/BrandLogo';
import { clearSession, isAuthenticated } from '@/lib/auth';

import { 
    BellIcon, 
    BriefcaseIcon, 
    BuildingOfficeIcon, 
    CalendarBlankIcon, 
    CaretDownIcon, 
    DeviceMobileIcon, 
    DownloadSimpleIcon, 
    FileXlsIcon, 
    FlagIcon, 
    GraduationCapIcon, 
    ListIcon, 
    MagnifyingGlassIcon, 
    MapPinIcon, 
    MapTrifoldIcon, 
    QuestionIcon, 
    QuotesIcon, 
    ShieldCheckIcon, 
    ShieldWarningIcon, 
    SidebarSimpleIcon, 
    SignOutIcon, 
    SquaresFourIcon, 
    UsersIcon, 
    VideoCameraIcon, 
    XIcon 
} from '@phosphor-icons/react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/lib/notifications';
import AdminGlobalSearch from '@/components/admin/AdminGlobalSearch';

const navItems = [
    { name: 'Analytics & Overview', icon: SquaresFourIcon, href: '/admin' },
    { name: 'Notifications', icon: BellIcon, href: '/admin/notifications' },
    { name: 'Reports & Analytics', icon: FileXlsIcon, href: '/admin/reports' },
    { name: 'User Module', icon: UsersIcon, href: '/admin/users' },
    { name: 'Recruiter / Company', icon: BuildingOfficeIcon, href: '/admin/companies' },
    { name: 'Events & Workshops', icon: CalendarBlankIcon, href: '/admin/events' },
    { name: 'Testimonials', icon: QuotesIcon, href: '/admin/testimonials' },
    { name: 'App Waitlist', icon: DeviceMobileIcon, href: '/admin/app-waitlist' },
    { name: 'Policies', icon: ShieldCheckIcon, href: '/admin/policies' },
    { name: 'Questions', icon: QuestionIcon, href: '/admin/questions' },
    { name: 'Jobs', icon: BriefcaseIcon, href: '/admin/jobs' },
    { name: 'Cities', icon: MapPinIcon, href: '/admin/cities' },
    { name: 'Job City Wise', icon: MapTrifoldIcon, href: '/admin/job-city' },
    { name: 'Professions', icon: GraduationCapIcon, href: '/admin/professions' },
    { name: 'Learn Videos', icon: VideoCameraIcon, href: '/admin/learn-videos' },
    { name: 'Adds Published', icon: SidebarSimpleIcon, href: '/admin/ads' },
    { name: 'Expert Requests', icon: BriefcaseIcon, href: '/admin/expert-requests' },
    { name: 'Wallet Disputes', icon: ShieldWarningIcon, href: '/admin/disputes' },
    { name: 'Chat Reports', icon: FlagIcon, href: '/admin/chat-reports' },
];

// Sidebar menu shared by the desktop sidebar (collapsible) and the mobile drawer. Declared at
// module level: defined inside AdminLayout it was a new component on every render, so React
// rebuilt the menu each time (the scrolled menu jumped back to the top on every navigation).
function SidebarContent({
    collapsed,
    pathname,
    onSignOut,
    unreadCount = 0,
}: {
    collapsed?: boolean;
    pathname: string;
    adminName?: string;
    onSignOut: () => void;
    unreadCount?: number;
}) {
    return (
    <>
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3 space-y-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {/* Navigation Links */}
            <nav className="space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    const isNotification = item.href === '/admin/notifications';
                    const hasUnread = isNotification && (unreadCount ?? 0) > 0;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch={true}
                            title={item.name}
                            className="block group"
                        >
                            <div
                                className={`flex items-center transition-all duration-150 ${
                                    collapsed
                                        ? `w-10 h-10 mx-auto rounded-xl justify-center relative ${
                                            isActive
                                                ? 'bg-purple-600 text-white shadow-sm shadow-purple-600/25'
                                                : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50/70 dark:text-slate-400 dark:hover:text-purple-300 dark:hover:bg-purple-950/40'
                                          }`
                                        : `gap-3 px-3.5 py-2 mx-1.5 rounded-xl ${
                                            isActive
                                                ? 'bg-purple-50 text-purple-700 font-semibold border border-purple-100/80 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800/60'
                                                : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50/50 dark:text-slate-400 dark:hover:text-purple-300 dark:hover:bg-purple-950/30'
                                          }`
                                }`}
                            >
                                <div className="relative shrink-0 flex items-center justify-center">
                                    <item.icon
                                        size={19}
                                        weight={isActive ? "bold" : "regular"}
                                        className={`shrink-0 transition-colors ${
                                            isActive
                                                ? collapsed ? 'text-white' : 'text-purple-600 dark:text-purple-400'
                                                : 'text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                                        }`}
                                    />
                                    {collapsed && hasUnread && (
                                        <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                                    )}
                                </div>
                                {!collapsed && (
                                    <div className="flex items-center justify-between flex-1 min-w-0">
                                        <span className="text-[13px] whitespace-nowrap font-medium truncate">
                                            {item.name}
                                        </span>
                                        {hasUnread && (
                                            <span className="ml-auto inline-flex items-center justify-center min-w-5 h-5 px-1.5 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full animate-pulse shadow-xs">
                                                {unreadCount > 99 ? '99+' : unreadCount}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        </Link>
                    );
                })}
            </nav>
        </div>

        {/* Sign Out Button */}
        <div className="p-2.5 border-t border-purple-50 dark:border-slate-800">
            <button
                onClick={onSignOut}
                title="Sign Out"
                className={`flex items-center transition-all duration-150 cursor-pointer ${
                    collapsed
                        ? 'w-10 h-10 mx-auto rounded-xl justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30'
                        : 'gap-3 px-3.5 py-2 mx-1.5 w-[calc(100%-12px)] rounded-xl text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 font-medium text-[13px]'
                }`}
            >
                <SignOutIcon size={19} className="shrink-0" />
                {!collapsed && <span>Sign Out</span>}
            </button>
        </div>
    </>
    );
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const { unreadCount } = useNotifications();
    
    // On desktop: controls collapsed/expanded (default open on large screens/monitors)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [adminUser, setAdminUser] = useState<any>(null);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    const isLoginPage = pathname === '/admin/login';

    // Auto-detect large screen on mount & remember preference
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedState = localStorage.getItem('admin_sidebar_open');
            if (savedState !== null) {
                setIsSidebarOpen(savedState === 'true');
            } else {
                // On large monitors (>= 1280px), always default to open
                setIsSidebarOpen(window.innerWidth >= 1280);
            }
        }
    }, []);

    const toggleSidebar = () => {
        setIsSidebarOpen(prev => {
            const next = !prev;
            if (typeof window !== 'undefined') {
                localStorage.setItem('admin_sidebar_open', String(next));
            }
            return next;
        });
    };

    // Close menus on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
        setIsProfileMenuOpen(false);
    }, [pathname]);

    // Close profile dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
                setIsProfileMenuOpen(false);
            }
        };
        if (isProfileMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isProfileMenuOpen]);

    useEffect(() => {
        if (isLoginPage) {
            setIsAuthChecking(false);
            return;
        }

        const userStr = localStorage.getItem('user');

        if (!userStr || !isAuthenticated()) {
            router.push('/admin/login');
            return;
        }

        try {
            const user = JSON.parse(userStr);
            if (!user.roles?.includes('admin')) {
                router.push('/admin/login');
                return;
            }
            setAdminUser(user);
            setIsAuthChecking(false);
        } catch (e) {
            router.push('/admin/login');
        }
    }, [pathname, isLoginPage, router]);

    const handleSignOut = () => {
        clearSession();
        router.push('/admin/login');
    };

    if (isAuthChecking) {
        return (
            <div className="min-h-screen bg-km-surface-card flex items-center justify-center">
                <motion.div
                    animate={{
                        scale: [1, 1.1, 1],
                        opacity: [0.5, 1, 0.5]
                    }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                    className="flex flex-col items-center gap-4"
                >
                    <div className="w-16 h-16 bg-purple-600 rounded-2xl rotate-45 flex items-center justify-center text-white font-black text-2xl shadow-xl shadow-purple-200">
                        ▲▲
                    </div>
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-[10px]">Authorizing Secure Access</p>
                </motion.div>
            </div>
        );
    }

    if (isLoginPage) {
        return <>{children}</>;
    }

    return (
        <div className="min-h-screen bg-[#FDFCFE] flex font-sans selection:bg-purple-200 dark:bg-[#1D253D]">
            {/* ── DESKTOP SIDEBAR ── */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 280 : 80 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="bg-km-surface-card border-r border-purple-50 flex-col fixed inset-y-0 z-50 shadow-sm overflow-hidden hidden md:flex"
            >
                {/* Sidebar Header */}
                <div className={`h-20 flex items-center border-b border-purple-50 transition-all ${
                    isSidebarOpen ? 'px-6 justify-between' : 'justify-center flex-col gap-1 px-2'
                }`}>
                    {isSidebarOpen ? (
                        <>
                            <BrandLogo size="md" href="/admin" />
                            <button
                                onClick={toggleSidebar}
                                className="p-2 hover:bg-purple-50 text-slate-500 hover:text-purple-700 rounded-xl transition-all cursor-pointer"
                                title="Collapse Sidebar"
                            >
                                <ListIcon size={20} />
                            </button>
                        </>
                    ) : (
                        <div className="flex flex-col items-center gap-1.5">
                            <BrandLogo size="md" iconOnly={true} href="/admin" />
                            <button
                                onClick={toggleSidebar}
                                className="p-1 hover:bg-purple-50 text-slate-400 hover:text-purple-700 rounded-lg transition-all cursor-pointer"
                                title="Expand Sidebar"
                            >
                                <ListIcon size={16} />
                            </button>
                        </div>
                    )}
                </div>

                <SidebarContent collapsed={!isSidebarOpen} pathname={pathname} adminName={adminUser?.name} onSignOut={handleSignOut} unreadCount={unreadCount} />
            </motion.aside>

            {/* ── MOBILE SIDEBAR OVERLAY ── */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/40 z-50 md:hidden"
                        />
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 left-0 w-72 bg-km-surface-card border-r border-purple-50 flex flex-col z-50 shadow-2xl md:hidden"
                        >
                            <div className="h-20 px-6 flex items-center justify-between border-b border-purple-50">
                                <BrandLogo size="md" href="/admin" />
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 hover:bg-purple-50 text-purple-900 rounded-xl transition-colors"
                                >
                                    <XIcon size={20} />
                                </button>
                            </div>
                            <SidebarContent collapsed={false} pathname={pathname} adminName={adminUser?.name} onSignOut={handleSignOut} unreadCount={unreadCount} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 flex flex-col transition-all duration-300 w-full min-w-0">
                <style>{`
                    @media (min-width: 768px) {
                        .admin-main-shift {
                            padding-left: ${isSidebarOpen ? '280px' : '80px'};
                            transition: padding-left 0.2s ease-in-out;
                        }
                    }
                `}</style>
                <div className="admin-main-shift flex-1 flex flex-col min-w-0">
                    {/* ── TOP HEADER ── */}
                    <header className="h-16 sm:h-20 bg-km-surface-card border-b border-purple-50 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40">
                        {/* Mobile hamburger */}
                        <button
                            className="md:hidden p-2 hover:bg-purple-50 text-purple-900 rounded-xl transition-colors mr-3 shrink-0"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <ListIcon size={22} />
                        </button>

                        <AdminGlobalSearch />

                        <div className="flex items-center gap-2 sm:gap-3 lg:gap-5 ml-2 sm:ml-4 shrink-0">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="hidden md:inline-flex items-center gap-1.5 lg:gap-2 px-3 lg:px-4 py-2 bg-km-surface-card border border-purple-100 text-purple-700 rounded-xl text-xs sm:text-sm font-bold shadow-xs hover:shadow-sm transition-all whitespace-nowrap shrink-0"
                            >
                                <DownloadSimpleIcon weight="bold" size={18} />
                                <span className="whitespace-nowrap">Download App</span>
                            </motion.button>
                            <div className="h-8 w-px bg-purple-100 hidden md:block"></div>
                            <Link 
                                href="/admin/notifications"
                                className="relative p-2 rounded-xl hover:bg-purple-50 text-slate-400 hover:text-purple-600 transition-all cursor-pointer flex items-center justify-center dark:hover:text-purple-400"
                                title={unreadCount > 0 ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}` : 'Notifications'}
                            >
                                <BellIcon size={22} className="transition-colors" />
                                {unreadCount > 0 && (
                                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full dark:border-km-surface-card animate-pulse"></span>
                                )}
                            </Link>
                            {/* Profile Dropdown */}
                            <div ref={profileMenuRef} className="relative">
                                <button
                                    type="button"
                                    onClick={() => setIsProfileMenuOpen(prev => !prev)}
                                    className="flex items-center gap-2 cursor-pointer group focus:outline-none select-none text-left"
                                    aria-haspopup="true"
                                    aria-expanded={isProfileMenuOpen}
                                >
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700 text-xs font-bold ring-2 ring-purple-500/10 group-hover:ring-purple-500/20 transition-all shadow-sm">
                                        <span className="rotate-45">▲▲</span>
                                    </div>
                                    <div className="hidden md:block">
                                        <p className="text-[13px] font-bold text-slate-800 leading-none">{adminUser?.name || 'Admin'}</p>
                                        <p className="text-[10px] text-slate-400 font-medium mt-1">Administrator</p>
                                    </div>
                                    <CaretDownIcon 
                                        weight="bold" 
                                        size={14} 
                                        className={`text-slate-400 group-hover:text-purple-600 transition-transform duration-200 hidden md:block dark:group-hover:text-purple-400 ${
                                            isProfileMenuOpen ? 'rotate-180 text-purple-600' : ''
                                        }`} 
                                    />
                                </button>

                                <AnimatePresence>
                                    {isProfileMenuOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 6, scale: 0.95 }}
                                            transition={{ duration: 0.15, ease: 'easeOut' }}
                                            className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-purple-100 dark:border-slate-800 p-1.5 z-50 overflow-hidden"
                                        >
                                            <div className="px-3 py-2 border-b border-purple-50 dark:border-slate-800 md:hidden">
                                                <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">{adminUser?.name || 'Admin'}</p>
                                                <p className="text-[10px] text-slate-400 font-medium">Administrator</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setIsProfileMenuOpen(false);
                                                    handleSignOut();
                                                }}
                                                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 hover:text-red-700 transition-colors cursor-pointer group text-left"
                                            >
                                                <SignOutIcon size={18} weight="bold" className="shrink-0 group-hover:translate-x-0.5 transition-transform" />
                                                <span>Sign Out</span>
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                        </div>
                    </header>

                    {/* ── PAGE CONTENT ── */}
                    <motion.main
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={pathname}
                        className="p-4 sm:p-6 lg:p-8 max-w-[1920px] w-full"
                    >
                        {children}
                    </motion.main>
                </div>
            </div>
        </div>
    );
}
