'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandLogo from '@/components/km/BrandLogo';
import { clearSession, isAuthenticated } from '@/lib/auth';

import { 
    BellIcon, 
    BriefcaseIcon, 
    BuildingOfficeIcon, 
    CaretDownIcon, 
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

const navItems = [
    { name: 'Analytics & Overview', icon: SquaresFourIcon, href: '/admin' },
    { name: 'Reports & Analytics', icon: FileXlsIcon, href: '/admin/reports' },
    { name: 'User Module', icon: UsersIcon, href: '/admin/users' },
    { name: 'Recruiter / Company', icon: BuildingOfficeIcon, href: '/admin/companies' },
    { name: 'Testimonials', icon: QuotesIcon, href: '/admin/testimonials' },
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

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    
    // On desktop: controls collapsed/expanded (default open on large screens/monitors)
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [adminUser, setAdminUser] = useState<any>(null);

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

    // Close mobile menu on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
    }, [pathname]);

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

    // Shared sidebar content with perfect collapsed/expanded symmetry
    const SidebarContent = ({ collapsed }: { collapsed?: boolean }) => (
        <>
            <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 pb-4 space-y-5 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {/* Admin Profile Mini */}
                {!collapsed ? (
                    <div className="p-3.5 mx-1.5 rounded-2xl bg-linear-to-br from-purple-700 to-indigo-900 flex items-center gap-3 shadow-md shadow-purple-900/10 transition-all">
                        <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0 border border-white/20">
                            <span className="text-white text-base font-bold rotate-45">▲▲</span>
                        </div>
                        <div className="overflow-hidden min-w-0 flex-1">
                            <h3 className="text-sm font-bold text-white truncate">{adminUser?.name || 'Admin'}</h3>
                            <p className="text-[10px] text-purple-200/80 font-semibold tracking-wider truncate uppercase">System Controller</p>
                        </div>
                    </div>
                ) : (
                    <div className="flex justify-center" title={`${adminUser?.name || 'Admin'} (System Controller)`}>
                        <div className="w-10 h-10 bg-linear-to-br from-purple-700 to-indigo-900 rounded-2xl flex items-center justify-center text-white border border-purple-500/30 shadow-md">
                            <span className="text-white text-xs font-bold rotate-45">▲▲</span>
                        </div>
                    </div>
                )}

                {/* Navigation Links */}
                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                prefetch={true}
                                className="block group relative"
                            >
                                <div
                                    className={`flex items-center rounded-2xl transition-all relative ${
                                        collapsed
                                            ? 'justify-center w-11 h-11 mx-auto'
                                            : 'gap-3.5 px-3.5 py-2.5 mx-1'
                                    } ${
                                        isActive
                                            ? 'bg-purple-50 text-purple-700 font-bold shadow-xs'
                                            : 'text-slate-500 hover:text-purple-600 hover:bg-purple-50/60 dark:hover:text-purple-400'
                                    }`}
                                >
                                    {isActive && !collapsed && (
                                        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-6 bg-purple-600 rounded-r-full" />
                                    )}
                                    {isActive && collapsed && (
                                        <div className="absolute inset-0 rounded-2xl border-2 border-purple-600/30 bg-purple-50" />
                                    )}
                                    <item.icon
                                        size={20}
                                        weight={isActive ? "bold" : "regular"}
                                        className={`relative z-10 shrink-0 ${
                                            isActive
                                                ? 'text-purple-600 dark:text-purple-400'
                                                : 'text-slate-400 group-hover:text-purple-600 dark:group-hover:text-purple-400'
                                        } transition-colors`}
                                    />
                                    {!collapsed && (
                                        <span className="text-[13.5px] whitespace-nowrap font-semibold truncate relative z-10">
                                            {item.name}
                                        </span>
                                    )}

                                    {/* Hover Tooltip when collapsed */}
                                    {collapsed && (
                                        <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#071A4D] text-white text-xs font-semibold rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50">
                                            {item.name}
                                        </div>
                                    )}
                                </div>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            {/* Sign Out Button */}
            <div className="p-3 border-t border-purple-50">
                <button
                    onClick={handleSignOut}
                    className={`flex items-center rounded-2xl transition-all font-semibold text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:text-red-400 group relative ${
                        collapsed
                            ? 'justify-center w-11 h-11 mx-auto'
                            : 'gap-3.5 px-3.5 py-2.5 w-full'
                    }`}
                >
                    <SignOutIcon size={20} className="shrink-0" />
                    {!collapsed && <span className="text-[13.5px]">Sign Out</span>}
                    {collapsed && (
                        <div className="absolute left-full ml-3 px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-xl shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none whitespace-nowrap z-50">
                            Sign Out
                        </div>
                    )}
                </button>
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-[#FDFCFE] flex font-sans selection:bg-purple-200 dark:bg-white/5">
            {/* ── DESKTOP SIDEBAR ── */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 280 : 80 }}
                transition={{ duration: 0.2, ease: 'easeInOut' }}
                className="bg-km-surface-card border-r border-purple-50 flex-col fixed inset-y-0 z-50 shadow-sm overflow-hidden hidden lg:flex"
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

                <SidebarContent collapsed={!isSidebarOpen} />
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
                            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                        />
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 left-0 w-72 bg-km-surface-card border-r border-purple-50 flex flex-col z-50 shadow-2xl lg:hidden"
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
                            <SidebarContent collapsed={false} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 flex flex-col transition-all duration-300 w-full min-w-0">
                <style>{`
                    @media (min-width: 1024px) {
                        .admin-main-shift {
                            padding-left: ${isSidebarOpen ? '280px' : '80px'};
                            transition: padding-left 0.2s ease-in-out;
                        }
                    }
                `}</style>
                <div className="admin-main-shift flex-1 flex flex-col min-w-0">
                    {/* ── TOP HEADER ── */}
                    <header className="h-16 sm:h-20 bg-km-surface-card/90 backdrop-blur-md border-b border-purple-50 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40">
                        {/* Mobile hamburger */}
                        <button
                            className="lg:hidden p-2 hover:bg-purple-50 text-purple-900 rounded-xl transition-colors mr-3 shrink-0"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <ListIcon size={22} />
                        </button>

                        <div className="flex items-center flex-1 max-w-xl">
                            <div className="relative w-full group">
                                <MagnifyingGlassIcon weight="bold" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors dark:group-focus-within:text-purple-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search intelligence..."
                                    className="w-full pl-11 pr-4 py-2.5 bg-purple-50/50 border border-transparent rounded-2xl text-sm focus:outline-none focus:bg-km-surface-card focus:border-purple-200 focus:ring-4 focus:ring-purple-500/5 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-6 ml-3">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-km-surface-card border border-purple-100 text-purple-700 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all"
                            >
                                <DownloadSimpleIcon weight="bold" size={18} />
                                <span className="hidden md:inline">Download App</span>
                            </motion.button>
                            <div className="h-8 w-px bg-purple-100 hidden sm:block"></div>
                            <div className="relative cursor-pointer">
                                <BellIcon size={22} className="text-slate-400 hover:text-purple-600 transition-colors dark:hover:text-purple-400" />
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full dark:border-km-surface-card"></span>
                            </div>
                            <div className="flex items-center gap-2 cursor-pointer group">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700 text-xs font-bold ring-2 ring-purple-500/10 group-hover:ring-purple-500/20 transition-all shadow-sm">
                                    <span className="rotate-45">▲▲</span>
                                </div>
                                <div className="hidden md:block">
                                    <p className="text-[13px] font-bold text-slate-800 leading-none">{adminUser?.name || 'Admin'}</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">Administrator</p>
                                </div>
                                <CaretDownIcon weight="bold" size={14} className="text-slate-400 group-hover:text-purple-600 transition-colors hidden md:block dark:group-hover:text-purple-400" />
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
