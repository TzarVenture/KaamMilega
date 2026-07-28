'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
    Users,
    Building2,
    ShieldCheck,
    HelpCircle,
    Briefcase,
    MapPin,
    Map,
    GraduationCap,
    Video,
    LayoutPanelLeft,
    Search,
    Download,
    ChevronDown,
    Bell,
    Menu,
    LogOut,
    Shield,
    X
} from 'lucide-react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = [
    { name: 'User Module', icon: Users, href: '/admin/users' },
    { name: 'Recruiter / Company', icon: Building2, href: '/admin/companies' },
    { name: 'Policies', icon: ShieldCheck, href: '/admin/policies' },
    { name: 'Questions', icon: HelpCircle, href: '/admin/questions' },
    { name: 'Jobs', icon: Briefcase, href: '/admin/jobs' },
    { name: 'Cities', icon: MapPin, href: '/admin/cities' },
    { name: 'Job City Wise', icon: Map, href: '/admin/job-city' },
    { name: 'Professions', icon: GraduationCap, href: '/admin/professions' },
    { name: 'Learn Videos', icon: Video, href: '/admin/learn-videos' },
    { name: 'Adds Published', icon: LayoutPanelLeft, href: '/admin/ads' },
    { name: 'Expert Requests', icon: Briefcase, href: '/admin/expert-requests' },
];

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const router = useRouter();
    // On desktop: controls collapsed/expanded. On mobile: controls open/hidden overlay.
    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [adminUser, setAdminUser] = useState<any>(null);

    const isLoginPage = pathname === '/admin/login';

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
        const token = localStorage.getItem('token');

        if (!token || !userStr) {
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
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        router.push('/admin/login');
    };

    if (isAuthChecking) {
        return (
            <div className="min-h-screen bg-white flex items-center justify-center">
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

    // If it's the login page, don't show the sidebar or header
    if (isLoginPage) {
        return <>{children}</>;
    }

    // Shared sidebar content
    const SidebarContent = ({ collapsed }: { collapsed?: boolean }) => (
        <>
            <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-6">
                {/* Admin Profile Mini */}
                <div className={`p-4 mx-2 rounded-2xl bg-gradient-to-br from-purple-700 to-indigo-900 flex items-center gap-4 shadow-lg shadow-purple-900/10 transition-all ${collapsed && 'px-2'}`}>
                    <motion.div
                        whileHover={{ scale: 1.05 }}
                        className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center shrink-0 border border-white/20"
                    >
                        <span className="text-white text-lg font-bold rotate-45">▲▲</span>
                    </motion.div>
                    <AnimatePresence mode="wait">
                        {!collapsed && (
                            <motion.div
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -10 }}
                                className="overflow-hidden"
                            >
                                <h3 className="text-sm font-bold text-white truncate">{adminUser?.name || 'Admin'}</h3>
                                <p className="text-[10px] text-purple-200/70 font-medium tracking-wider truncate uppercase">System Controller</p>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <nav className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className="block group"
                            >
                                <motion.div
                                    whileHover={{ x: 4 }}
                                    whileTap={{ scale: 0.98 }}
                                    className={`flex items-center gap-4 px-4 py-3 rounded-2xl transition-all relative ${isActive
                                        ? 'bg-purple-50 text-purple-700 font-bold'
                                        : 'text-slate-500 hover:text-purple-600'
                                        }`}
                                >
                                    {isActive && (
                                        <motion.div
                                            layoutId="activeNav"
                                            className="absolute left-0 w-1.5 h-6 bg-purple-600 rounded-r-full"
                                        />
                                    )}
                                    <item.icon size={22} className={`${isActive ? 'text-purple-600' : 'text-slate-400 group-hover:text-purple-600'} transition-colors`} />
                                    <AnimatePresence mode="wait">
                                        {!collapsed && (
                                            <motion.span
                                                initial={{ opacity: 0, x: -5 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: -5 }}
                                                className="text-[14px] whitespace-nowrap font-semibold"
                                            >
                                                {item.name}
                                            </motion.span>
                                        )}
                                    </AnimatePresence>
                                </motion.div>
                            </Link>
                        );
                    })}
                </nav>
            </div>

            <div className="p-4 border-t border-purple-50">
                <button
                    onClick={handleSignOut}
                    className="w-full flex items-center gap-4 px-4 py-3 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all font-semibold"
                >
                    <LogOut size={22} />
                    {!collapsed && <span className="text-[14px]">Sign Out</span>}
                </button>
            </div>
        </>
    );

    return (
        <div className="min-h-screen bg-[#FDFCFE] flex font-sans selection:bg-purple-200">
            {/* ── DESKTOP SIDEBAR ── */}
            <motion.aside
                initial={false}
                animate={{ width: isSidebarOpen ? 280 : 88 }}
                className="bg-white border-r border-purple-50 flex-col fixed inset-y-0 z-50 shadow-sm overflow-hidden hidden lg:flex"
            >
                <div className="p-6 flex items-center justify-between">
                    <Link href="/admin" className="flex items-center gap-2 overflow-hidden min-w-[120px]">
                        <motion.div animate={{ scale: isSidebarOpen ? 1 : 0.8 }}>
                            <Image src="/asset/icons/header_logo.png" alt="Logo" width={100} height={45} className="object-contain" />
                        </motion.div>
                    </Link>
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-purple-50 text-purple-900 rounded-xl transition-colors"
                    >
                        <Menu size={20} />
                    </button>
                </div>
                <SidebarContent collapsed={!isSidebarOpen} />
            </motion.aside>

            {/* ── MOBILE SIDEBAR OVERLAY ── */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <>
                        {/* Backdrop */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsMobileMenuOpen(false)}
                            className="fixed inset-0 bg-black/40 z-40 lg:hidden"
                        />
                        {/* Slide-in drawer */}
                        <motion.aside
                            initial={{ x: -280 }}
                            animate={{ x: 0 }}
                            exit={{ x: -280 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                            className="fixed inset-y-0 left-0 w-72 bg-white border-r border-purple-50 flex flex-col z-50 shadow-2xl lg:hidden"
                        >
                            {/* Drawer header */}
                            <div className="p-6 flex items-center justify-between">
                                <Link href="/admin" className="flex items-center gap-2">
                                    <Image src="/asset/icons/header_logo.png" alt="Logo" width={100} height={45} className="object-contain" />
                                </Link>
                                <button
                                    onClick={() => setIsMobileMenuOpen(false)}
                                    className="p-2 hover:bg-purple-50 text-purple-900 rounded-xl transition-colors"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                            <SidebarContent collapsed={false} />
                        </motion.aside>
                    </>
                )}
            </AnimatePresence>

            {/* ── MAIN CONTENT ── */}
            <div className="flex-1 flex flex-col transition-all duration-300 w-full min-w-0">
                {/* Apply padding via CSS, not inline style, so it can be zeroed on mobile */}
                <style>{`
                    @media (min-width: 1024px) {
                        .admin-main-shift {
                            padding-left: ${isSidebarOpen ? '280px' : '88px'};
                        }
                    }
                `}</style>
                <div className="admin-main-shift flex-1 flex flex-col min-w-0">
                    {/* ── TOP HEADER ── */}
                    <header className="h-16 sm:h-20 bg-white/80 backdrop-blur-md border-b border-purple-50 flex items-center justify-between px-4 sm:px-8 sticky top-0 z-40">
                        {/* Mobile hamburger */}
                        <button
                            className="lg:hidden p-2 hover:bg-purple-50 text-purple-900 rounded-xl transition-colors mr-3 shrink-0"
                            onClick={() => setIsMobileMenuOpen(true)}
                        >
                            <Menu size={22} />
                        </button>

                        <div className="flex items-center flex-1 max-w-xl">
                            <div className="relative w-full group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={18} />
                                <input
                                    type="text"
                                    placeholder="Search intelligence..."
                                    className="w-full pl-11 pr-4 py-2.5 bg-purple-50/50 border border-transparent rounded-2xl text-sm focus:outline-none focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-500/5 transition-all outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 sm:gap-6 ml-3">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className="hidden sm:flex items-center gap-2 px-5 py-2.5 bg-white border border-purple-100 text-purple-700 rounded-xl text-sm font-bold shadow-sm hover:shadow-md transition-all"
                            >
                                <Download size={18} />
                                <span className="hidden md:inline">Download App</span>
                            </motion.button>
                            <div className="h-8 w-px bg-purple-100 hidden sm:block"></div>
                            <div className="relative cursor-pointer">
                                <Bell size={22} className="text-slate-400 hover:text-purple-600 transition-colors" />
                                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 border-2 border-white rounded-full"></span>
                            </div>
                            <div className="flex items-center gap-2 cursor-pointer group">
                                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-purple-100 rounded-xl flex items-center justify-center text-purple-700 text-xs font-bold ring-2 ring-purple-500/10 group-hover:ring-purple-500/20 transition-all shadow-sm">
                                    <span className="rotate-45">▲▲</span>
                                </div>
                                <div className="hidden md:block">
                                    <p className="text-[13px] font-bold text-slate-800 leading-none">{adminUser?.name || 'Admin'}</p>
                                    <p className="text-[10px] text-slate-400 font-medium mt-1">Administrator</p>
                                </div>
                                <ChevronDown size={14} className="text-slate-400 group-hover:text-purple-600 transition-colors hidden md:block" />
                            </div>
                        </div>
                    </header>

                    {/* ── PAGE CONTENT ── */}
                    <motion.main
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        key={pathname}
                        className="p-4 sm:p-6 lg:p-8"
                    >
                        {children}
                    </motion.main>
                </div>
            </div>
        </div>
    );
}
