'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import BrandLogo from '@/components/km/BrandLogo';
import ThemeToggle from '@/components/km/ThemeToggle';
import { clearSession, isAuthenticated } from '@/lib/auth';
import type { Icon } from '@phosphor-icons/react';
import {
    BellIcon,
    BriefcaseIcon,
    BuildingOfficeIcon,
    CalendarBlankIcon,
    CaretDownIcon,
    ChatCircleTextIcon,
    CircleNotchIcon,
    DeviceMobileIcon,
    FileXlsIcon,
    FlagIcon,
    GraduationCapIcon,
    CertificateIcon,
    IdentificationBadgeIcon,
    ListIcon,
    MapPinIcon,
    MapTrifoldIcon,
    MegaphoneIcon,
    QuestionIcon,
    QuotesIcon,
    ShieldCheckIcon,
    ShieldWarningIcon,
    SidebarSimpleIcon,
    SignOutIcon,
    SquaresFourIcon,
    UsersIcon,
    VideoCameraIcon,
    XIcon,
    BankIcon,
    ChartLineUpIcon,
    ChatsCircleIcon,
    CreditCardIcon,
} from '@phosphor-icons/react';
import { useNotifications } from '@/lib/notifications';
import AdminGlobalSearch from '@/components/admin/AdminGlobalSearch';

type NavItem = { name: string; icon: Icon; href: string };

const navGroups: { label: string; items: NavItem[] }[] = [
    {
        label: 'Overview',
        items: [
            { name: 'Dashboard', icon: SquaresFourIcon, href: '/admin' },
            { name: 'Notifications', icon: BellIcon, href: '/admin/notifications' },
            { name: 'Reports', icon: FileXlsIcon, href: '/admin/reports' },
        ],
    },
    {
        label: 'People',
        items: [
            { name: 'Users', icon: UsersIcon, href: '/admin/users' },
            { name: 'Companies', icon: BuildingOfficeIcon, href: '/admin/companies' },
            { name: 'Expert requests', icon: IdentificationBadgeIcon, href: '/admin/expert-requests' },
            { name: 'Certificates', icon: CertificateIcon, href: '/admin/certifications' },
        ],
    },
    {
        label: 'Jobs',
        items: [
            { name: 'Jobs', icon: BriefcaseIcon, href: '/admin/jobs' },
            { name: 'Jobs by city', icon: MapTrifoldIcon, href: '/admin/job-city' },
            { name: 'Cities', icon: MapPinIcon, href: '/admin/cities' },
            { name: 'Professions', icon: GraduationCapIcon, href: '/admin/professions' },
        ],
    },
    {
        label: 'Content',
        items: [
            { name: 'Events', icon: CalendarBlankIcon, href: '/admin/events' },
            { name: 'Learn videos', icon: VideoCameraIcon, href: '/admin/learn-videos' },
            { name: 'Testimonials', icon: QuotesIcon, href: '/admin/testimonials' },
            { name: 'Questions', icon: QuestionIcon, href: '/admin/questions' },
            { name: 'Policies', icon: ShieldCheckIcon, href: '/admin/policies' },
        ],
    },
    {
        label: 'Monetisation',
        items: [
            { name: 'Ads', icon: MegaphoneIcon, href: '/admin/ads' },
            { name: 'App waitlist', icon: DeviceMobileIcon, href: '/admin/app-waitlist' },
        ],
    },
    {
        label: 'Money',
        items: [
            { name: 'Payouts', icon: BankIcon, href: '/admin/payouts' },
            { name: 'Finance', icon: ChartLineUpIcon, href: '/admin/finance' },
            { name: 'Payments', icon: CreditCardIcon, href: '/admin/payments' },
        ],
    },
    {
        label: 'Trust and safety',
        items: [
            { name: 'Post reports', icon: FlagIcon, href: '/admin/post-reports' },
            { name: 'Chat reports', icon: ChatCircleTextIcon, href: '/admin/chat-reports' },
            { name: 'Wallet disputes', icon: ShieldWarningIcon, href: '/admin/disputes' },
            { name: 'Session reports', icon: ChatsCircleIcon, href: '/admin/session-reports' },
        ],
    },
];

function isActive(pathname: string, href: string) {
    return href === '/admin' ? pathname === '/admin' : pathname === href || pathname.startsWith(href + '/');
}

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
    onSignOut: () => void;
    unreadCount?: number;
}) {
    return (
        <>
            <nav aria-label="Admin" className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 [scrollbar-width:thin]">
                {navGroups.map((group, gi) => (
                    <div key={group.label} className={gi > 0 ? 'mt-5' : ''}>
                        {collapsed
                            ? gi > 0 && <div className="mx-2 mb-3 border-t border-km-border-subtle" />
                            : <p className="px-3 mb-1.5 text-xs font-medium text-km-text-muted">{group.label}</p>}
                        <ul className="space-y-0.5">
                            {group.items.map((item) => {
                                const active = isActive(pathname, item.href);
                                const unread = item.href === '/admin/notifications' ? unreadCount : 0;
                                return (
                                    <li key={item.href}>
                                        <Link
                                            href={item.href}
                                            title={collapsed ? item.name : undefined}
                                            aria-current={active ? 'page' : undefined}
                                            className={`group relative flex items-center rounded-lg text-sm transition-colors ${
                                                collapsed ? 'w-10 h-10 mx-auto justify-center' : 'gap-3 h-9 px-3'
                                            } ${
                                                active
                                                    ? 'bg-km-surface text-km-heading font-semibold'
                                                    : 'text-km-text-secondary font-medium hover:text-km-heading hover:bg-km-surface'
                                            }`}
                                        >
                                            {active && !collapsed && (
                                                <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-full bg-km-accent" aria-hidden="true" />
                                            )}
                                            <item.icon
                                                size={20}
                                                weight={active ? 'fill' : 'regular'}
                                                className={`shrink-0 ${active ? 'text-km-link' : ''}`}
                                                aria-hidden="true"
                                            />
                                            {!collapsed && <span className="truncate">{item.name}</span>}
                                            {unread > 0 && (collapsed
                                                ? <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-red-600 ring-2 ring-km-surface-card" aria-label={`${unread} unread`} />
                                                : <span className="ml-auto min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-semibold font-inter">
                                                    {unread > 99 ? '99+' : unread}
                                                </span>)}
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>

            <div className="p-3 border-t border-km-border-subtle">
                <button
                    type="button"
                    onClick={onSignOut}
                    title={collapsed ? 'Sign out' : undefined}
                    className={`flex items-center rounded-lg text-sm font-medium text-km-text-secondary hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer ${
                        collapsed ? 'w-10 h-10 mx-auto justify-center' : 'gap-3 h-9 px-3 w-full'
                    }`}
                >
                    <SignOutIcon size={20} className="shrink-0" aria-hidden="true" />
                    {!collapsed && <span>Sign out</span>}
                </button>
            </div>
        </>
    );
}

type AdminUser = { name?: string; roles?: string[] };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { unreadCount } = useNotifications();

    const [isSidebarOpen, setIsSidebarOpen] = useState(true);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
    const [isAuthChecking, setIsAuthChecking] = useState(true);
    const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
    const profileMenuRef = useRef<HTMLDivElement>(null);

    const isLoginPage = pathname === '/admin/login';

    // Remember the collapsed sidebar; by default it's open on wide screens
    useEffect(() => {
        try {
            const saved = localStorage.getItem('admin_sidebar_open');
            setIsSidebarOpen(saved !== null ? saved === 'true' : window.innerWidth >= 1280);
        } catch {
            setIsSidebarOpen(window.innerWidth >= 1280);
        }
    }, []);

    const toggleSidebar = () => {
        setIsSidebarOpen((prev) => {
            const next = !prev;
            try { localStorage.setItem('admin_sidebar_open', String(next)); } catch { /* private mode */ }
            return next;
        });
    };

    // Close menus on route change
    useEffect(() => {
        setIsMobileMenuOpen(false);
        setIsProfileMenuOpen(false);
    }, [pathname]);

    // Close the profile menu on an outside click or Escape
    useEffect(() => {
        if (!isProfileMenuOpen) return;
        const onClick = (e: MouseEvent) => {
            if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setIsProfileMenuOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsProfileMenuOpen(false); };
        document.addEventListener('mousedown', onClick);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onClick);
            document.removeEventListener('keydown', onKey);
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
            const user = JSON.parse(userStr) as AdminUser;
            if (!user.roles?.includes('admin')) {
                router.push('/admin/login');
                return;
            }
            setAdminUser(user);
            setIsAuthChecking(false);
        } catch {
            router.push('/admin/login');
        }
    }, [pathname, isLoginPage, router]);

    const handleSignOut = () => {
        clearSession();
        router.push('/admin/login');
    };

    if (isAuthChecking) {
        return (
            <div className="min-h-screen bg-km-surface flex items-center justify-center">
                <div className="flex items-center gap-2.5 text-sm text-km-text-secondary" role="status">
                    <CircleNotchIcon size={18} className="animate-spin text-km-link" aria-hidden="true" />
                    Checking access
                </div>
            </div>
        );
    }

    if (isLoginPage) return <>{children}</>;

    const initials = (adminUser?.name || 'Admin').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();

    return (
        <div className="min-h-screen bg-km-surface flex">
            {/* Desktop sidebar */}
            <aside
                className={`hidden md:flex flex-col fixed inset-y-0 left-0 z-40 bg-km-surface-card border-r border-km-border transition-[width] duration-200 ${
                    isSidebarOpen ? 'w-64' : 'w-[72px]'
                }`}
            >
                <div className={`h-16 flex items-center border-b border-km-border-subtle shrink-0 ${isSidebarOpen ? 'px-5 justify-between' : 'justify-center'}`}>
                    {isSidebarOpen ? <BrandLogo size="md" href="/admin" /> : <BrandLogo size="md" iconOnly href="/admin" />}
                    {isSidebarOpen && (
                        <button type="button" onClick={toggleSidebar} className="p-1.5 rounded-lg text-km-text-secondary hover:text-km-heading hover:bg-km-surface transition-colors cursor-pointer" aria-label="Collapse sidebar">
                            <SidebarSimpleIcon size={20} aria-hidden="true" />
                        </button>
                    )}
                </div>
                {!isSidebarOpen && (
                    <button type="button" onClick={toggleSidebar} className="mx-auto mt-3 p-2 rounded-lg text-km-text-secondary hover:text-km-heading hover:bg-km-surface transition-colors cursor-pointer" aria-label="Expand sidebar">
                        <SidebarSimpleIcon size={20} aria-hidden="true" />
                    </button>
                )}
                <SidebarContent collapsed={!isSidebarOpen} pathname={pathname} onSignOut={handleSignOut} unreadCount={unreadCount} />
            </aside>

            {/* Mobile drawer */}
            {isMobileMenuOpen && (
                <div className="md:hidden">
                    <div className="fixed inset-0 bg-black/50 z-50" onClick={() => setIsMobileMenuOpen(false)} aria-hidden="true" />
                    <aside className="fixed inset-y-0 left-0 w-72 max-w-[85vw] bg-km-surface-card border-r border-km-border flex flex-col z-50" aria-label="Admin menu">
                        <div className="h-16 px-5 flex items-center justify-between border-b border-km-border-subtle shrink-0">
                            <BrandLogo size="md" href="/admin" />
                            <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="p-1.5 rounded-lg text-km-text-secondary hover:bg-km-surface cursor-pointer" aria-label="Close menu">
                                <XIcon size={20} aria-hidden="true" />
                            </button>
                        </div>
                        <SidebarContent pathname={pathname} onSignOut={handleSignOut} unreadCount={unreadCount} />
                    </aside>
                </div>
            )}

            {/* Main column */}
            <div className={`flex-1 min-w-0 flex flex-col transition-[padding] duration-200 ${isSidebarOpen ? 'md:pl-64' : 'md:pl-[72px]'}`}>
                <header className="h-16 sticky top-0 z-30 bg-km-surface-card border-b border-km-border flex items-center gap-3 px-4 sm:px-6">
                    <button type="button" className="md:hidden p-2 -ml-2 rounded-lg text-km-heading hover:bg-km-surface cursor-pointer" onClick={() => setIsMobileMenuOpen(true)} aria-label="Open menu">
                        <ListIcon size={22} aria-hidden="true" />
                    </button>

                    <AdminGlobalSearch />

                    <div className="flex items-center gap-1 sm:gap-2 ml-auto shrink-0">
                        <Link
                            href="/admin/notifications"
                            className="relative p-2 rounded-lg text-km-text-secondary hover:text-km-heading hover:bg-km-surface transition-colors"
                            aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
                        >
                            <BellIcon size={22} aria-hidden="true" />
                            {unreadCount > 0 && <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-600 ring-2 ring-km-surface-card" aria-hidden="true" />}
                        </Link>

                        <div ref={profileMenuRef} className="relative">
                            <button
                                type="button"
                                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                                className="flex items-center gap-2.5 p-1 pr-2 rounded-xl hover:bg-km-surface transition-colors cursor-pointer text-left"
                                aria-haspopup="menu"
                                aria-expanded={isProfileMenuOpen}
                            >
                                <span className="w-8 h-8 rounded-full bg-km-primary text-white text-xs font-semibold flex items-center justify-center shrink-0">{initials}</span>
                                <span className="hidden md:block">
                                    <span className="block text-sm font-semibold text-km-heading leading-tight">{adminUser?.name || 'Admin'}</span>
                                    <span className="block text-xs text-km-text-secondary leading-tight">Administrator</span>
                                </span>
                                <CaretDownIcon size={14} weight="bold" className={`hidden md:block text-km-text-muted transition-transform ${isProfileMenuOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
                            </button>

                            {isProfileMenuOpen && (
                                <div role="menu" className="absolute right-0 top-full mt-2 w-60 bg-km-surface-raised rounded-xl shadow-lg border border-km-border p-2 z-50">
                                    <div className="px-2 pt-1 pb-2.5 border-b border-km-border-subtle md:hidden">
                                        <p className="text-sm font-semibold text-km-heading truncate">{adminUser?.name || 'Admin'}</p>
                                        <p className="text-xs text-km-text-secondary">Administrator</p>
                                    </div>
                                    <p className="px-2 pt-2 pb-1.5 text-xs font-medium text-km-text-secondary">Theme</p>
                                    <ThemeToggle />
                                    <div className="my-2 border-t border-km-border-subtle" />
                                    <button
                                        type="button"
                                        role="menuitem"
                                        onClick={() => { setIsProfileMenuOpen(false); handleSignOut(); }}
                                        className="w-full flex items-center gap-2.5 px-2 h-9 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
                                    >
                                        <SignOutIcon size={18} aria-hidden="true" />
                                        Sign out
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </header>

                <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
