"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    BriefcaseIcon,
    CalendarBlankIcon,
    CaretRightIcon,
    GearSixIcon,
    KanbanIcon,
    PlusCircleIcon,
    ShieldCheckIcon,
    SignOutIcon,
    SquaresFourIcon,
    WalletIcon,
} from "@phosphor-icons/react";
import api from "@/lib/axios";
import { clearSession } from "@/lib/auth";

const sidebarItems = [
    { name: "Dashboard Overview", href: "/recruiter", icon: SquaresFourIcon },
    { name: "Post New Job", href: "/recruiter/jobs/create", icon: PlusCircleIcon },
    { name: "Manage Job Posts", href: "/recruiter/jobs/list", icon: BriefcaseIcon },
    { name: "Applicant Pipeline", href: "/recruiter/applications", icon: KanbanIcon },
    { name: "Scheduled Interviews", href: "/recruiter/interviews", icon: CalendarBlankIcon },
    { name: "Billing & Wallet", href: "/wallet", icon: WalletIcon },
    { name: "Account Settings", href: "/recruiter/settings", icon: GearSixIcon },
];

const mobileNavItems = [
    { name: "Overview", href: "/recruiter", icon: SquaresFourIcon },
    { name: "Post Job", href: "/recruiter/jobs/create", icon: PlusCircleIcon },
    { name: "Jobs", href: "/recruiter/jobs/list", icon: BriefcaseIcon },
    { name: "Pipeline", href: "/recruiter/applications", icon: KanbanIcon },
    { name: "Interviews", href: "/recruiter/interviews", icon: CalendarBlankIcon },
];

export default function RecruiterSidebar() {
    const pathname = usePathname();
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        let isMounted = true;
        const fetchUser = async () => {
            try {
                const userData = await api.get("/user/profile");
                if (isMounted) setUser(userData);
            } catch {}
        };
        fetchUser();
        return () => {
            isMounted = false;
        };
    }, []);

    const companyName = user?.company_name || user?.name || "Company Portal";

    return (
        <>
            {/* Desktop Left Sidebar */}
            <aside className="w-64 bg-km-surface-card border-r border-km-border h-[calc(100vh-3.5rem)] flex flex-col fixed left-0 top-14 overflow-y-auto z-30 hidden md:flex shadow-xs select-none">
                {/* Recruiter / Company Profile Card */}
                <div className="p-4 border-b border-km-border/70">
                    <div className="p-3 bg-km-surface rounded-xl border border-km-border flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-km-primary text-white flex items-center justify-center font-bold text-xs uppercase shrink-0">
                            {companyName.charAt(0)}
                        </div>
                        <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-km-text-primary truncate">
                                {companyName}
                            </p>
                            <p className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1 mt-0.5">
                                <ShieldCheckIcon weight="bold" size={13} aria-hidden="true" />
                                <span>Verified Employer</span>
                            </p>
                        </div>
                    </div>
                </div>

                {/* Navigation Menu */}
                <nav className="flex-1 py-4 px-3 space-y-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-km-text-secondary px-3 mb-2">
                        Recruitment
                    </p>
                    {sidebarItems.map((item) => {
                        const isActive =
                            pathname === item.href ||
                            (item.href !== "/recruiter" && pathname.startsWith(item.href));
                        const IconComponent = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`group flex items-center justify-between px-3 py-2.5 rounded-xl transition-colors duration-150 text-xs font-medium border ${
                                    isActive
                                        ? "bg-blue-50/80 text-km-blue border-blue-200/80 dark:bg-blue-950/30 dark:border-blue-900/50 dark:text-km-link"
                                        : "text-km-text-secondary border-transparent hover:bg-km-surface hover:text-km-text-primary"
                                }`}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    <IconComponent
                                        size={20}
                                        weight={isActive ? "fill" : "regular"}
                                        aria-hidden="true"
                                        className={`shrink-0 transition-colors ${
                                            isActive
                                                ? "text-km-blue dark:text-km-link"
                                                : "text-km-text-secondary group-hover:text-km-text-primary"
                                        }`}
                                    />
                                    <span className="truncate">{item.name}</span>
                                </div>
                                <CaretRightIcon
                                    weight="bold"
                                    size={13}
                                    aria-hidden="true"
                                    className={`shrink-0 transition-opacity ${
                                        isActive
                                            ? "opacity-100 text-km-blue dark:text-km-link"
                                            : "opacity-0 group-hover:opacity-40"
                                    }`}
                                />
                            </Link>
                        );
                    })}
                </nav>

                {/* Footer / Sign Out */}
                <div className="p-3 border-t border-km-border/70 bg-km-surface/40">
                    <button
                        onClick={async () => {
                            await clearSession();
                            window.location.href = "/recruiter/login";
                        }}
                        className="flex items-center gap-2.5 w-full px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50/80 dark:hover:bg-red-950/20 rounded-xl transition-colors"
                    >
                        <SignOutIcon weight="regular" size={18} aria-hidden="true" />
                        <span>Sign Out</span>
                    </button>
                </div>
            </aside>

            {/* Mobile Bottom Navigation Bar (< md) */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-km-surface-card border-t border-km-border px-2 py-1.5 flex items-center justify-around shadow-lg select-none">
                {mobileNavItems.map((item) => {
                    const isActive =
                        pathname === item.href ||
                        (item.href !== "/recruiter" && pathname.startsWith(item.href));
                    const IconComponent = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex flex-col items-center justify-center py-1 px-2 rounded-lg text-[10px] font-medium transition-colors ${
                                isActive
                                    ? "text-km-primary dark:text-km-link"
                                    : "text-km-text-secondary hover:text-km-text-primary"
                            }`}
                        >
                            <IconComponent
                                size={20}
                                weight={isActive ? "fill" : "regular"}
                                aria-hidden="true"
                                className="mb-0.5"
                            />
                            <span>{item.name}</span>
                        </Link>
                    );
                })}
            </nav>
        </>
    );
}
