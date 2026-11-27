"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
    ArrowUUpLeftIcon,
    BriefcaseIcon,
    BuildingsIcon,
    CalendarBlankIcon,
    DotsThreeOutlineIcon,
    GearSixIcon,
    MagnifyingGlassIcon,
    MegaphoneIcon,
    NewspaperIcon,
    PlusIcon,
    SignOutIcon,
    SquaresFourIcon,
    TagIcon,
    UsersThreeIcon,
    WalletIcon,
    XIcon,
    type Icon,
} from "@phosphor-icons/react";
import api from "@/lib/axios";
import CompanyMenu, { type CompanyUser } from "@/components/recruiter/CompanyMenu";
import { clearSession } from "@/lib/auth";

type NavItem = { key: string; href: string; Icon: Icon };

/** The employer portal's menu, grouped the way hiring work flows */
const GROUPS: { key: string; items: NavItem[] }[] = [
    {
        key: "hiring",
        items: [
            { key: "dashboard", href: "/recruiter", Icon: SquaresFourIcon },
            { key: "jobs", href: "/recruiter/jobs/list", Icon: BriefcaseIcon },
            { key: "pipeline", href: "/recruiter/applications", Icon: UsersThreeIcon },
            { key: "interviews", href: "/recruiter/interviews", Icon: CalendarBlankIcon },
            { key: "talent", href: "/recruiter/people", Icon: MagnifyingGlassIcon },
        ],
    },
    {
        key: "company",
        items: [
            { key: "companyPage", href: "/recruiter/company", Icon: BuildingsIcon },
            { key: "posts", href: "/recruiter/posts", Icon: NewspaperIcon },
            { key: "advertise", href: "/recruiter/ads", Icon: MegaphoneIcon },
        ],
    },
    {
        key: "account",
        items: [
            { key: "plan", href: "/recruiter/plan", Icon: TagIcon },
            { key: "wallet", href: "/wallet", Icon: WalletIcon },
            { key: "settings", href: "/recruiter/settings", Icon: GearSixIcon },
        ],
    },
];

/** Phone bottom bar: the four daily places, then "More" for the rest */
const DOCK = ["dashboard", "jobs", "pipeline", "interviews"];
const ALL = GROUPS.flatMap((g) => g.items);

const isActive = (pathname: string, href: string) =>
    href === "/recruiter" ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);

export default function RecruiterSidebar() {
    const t = useTranslations("recruiterNav");
    const pathname = usePathname() || "";
    const [user, setUser] = useState<CompanyUser | null>(null);
    const [moreOpen, setMoreOpen] = useState(false);

    useEffect(() => {
        let alive = true;
        const load = () =>
            api.get("/user/profile")
                .then((u) => alive && setUser(u as typeof user))
                .catch(() => {});
        load();
        // The company page fires this after a new logo or name is saved
        window.addEventListener("km:profile-updated", load);
        return () => {
            alive = false;
            window.removeEventListener("km:profile-updated", load);
        };
    }, []);

    // Close the phone sheet on Escape (links inside it close it on click)
    useEffect(() => {
        if (!moreOpen) return;
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMoreOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [moreOpen]);

    const signOut = async () => {
        await clearSession();
        window.location.href = "/recruiter/login";
    };

    const companyCard = <CompanyMenu user={user} />;

    const groups = (
        <>
            {GROUPS.map((group) => (
                <div key={group.key} className="mt-5 first:mt-0">
                    <p className="px-3 mb-1 text-xs font-semibold text-km-text-secondary">{t(`group.${group.key}`)}</p>
                    <ul className="space-y-0.5">
                        {group.items.map(({ key, href, Icon }) => {
                            const active = isActive(pathname, href);
                            return (
                                <li key={key}>
                                    <Link
                                        href={href}
                                        aria-current={active ? "page" : undefined}
                                        className={`relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                                            active
                                                ? "bg-[#E8F0FE] text-[#0B5ED7] dark:bg-[#131D3D] dark:text-km-link"
                                                : "text-km-text-secondary hover:bg-km-surface hover:text-km-heading"
                                        }`}
                                    >
                                        {active && <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-[#FF6B00]" aria-hidden="true" />}
                                        <Icon size={20} weight={active ? "fill" : "regular"} className="shrink-0" aria-hidden="true" />
                                        <span className="truncate">{t(`item.${key}`)}</span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            ))}
        </>
    );

    const footer = (
        <div className="space-y-0.5">
            <Link href="/feed" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-km-text-secondary transition-colors hover:bg-km-surface hover:text-km-heading">
                <ArrowUUpLeftIcon size={20} className="shrink-0" aria-hidden="true" />
                {t("backToMember")}
            </Link>
            <button type="button" onClick={signOut} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-[#2A1215]">
                <SignOutIcon size={20} className="shrink-0" aria-hidden="true" />
                {t("signOut")}
            </button>
        </div>
    );

    return (
        <>
            {/* Desktop sidebar */}
            <aside className="hidden md:flex fixed left-0 top-14 z-30 h-[calc(100vh-3.5rem)] w-64 flex-col border-r border-km-border bg-km-surface-card select-none">
                <div className="p-4 pb-3">{companyCard}</div>
                <div className="px-4 pb-2">
                    <Link
                        href="/recruiter/jobs/create"
                        className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-km-accent text-sm font-semibold text-white transition-colors hover:bg-km-accent-dark"
                    >
                        <PlusIcon size={16} weight="bold" aria-hidden="true" />
                        {t("postJob")}
                    </Link>
                </div>
                <nav aria-label={t("label")} className="flex-1 overflow-y-auto px-3 py-3">{groups}</nav>
                <div className="border-t border-km-border/70 p-3">{footer}</div>
            </aside>

            {/* Phone bottom bar */}
            <nav aria-label={t("label")} className="md:hidden fixed bottom-0 inset-x-0 z-40 grid grid-cols-5 border-t border-km-border bg-km-surface-card px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))] select-none">
                {DOCK.map((key) => {
                    const item = ALL.find((i) => i.key === key)!;
                    const active = isActive(pathname, item.href);
                    return (
                        <Link
                            key={key}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-medium ${active ? "text-[#0B5ED7] dark:text-km-link" : "text-km-text-secondary"}`}
                        >
                            <item.Icon size={22} weight={active ? "fill" : "regular"} aria-hidden="true" />
                            <span className="truncate max-w-full">{t(`short.${key}`)}</span>
                        </Link>
                    );
                })}
                <button
                    type="button"
                    onClick={() => setMoreOpen(true)}
                    aria-expanded={moreOpen}
                    className={`flex flex-col items-center gap-0.5 rounded-lg py-1 text-[11px] font-medium ${
                        !DOCK.some((k) => isActive(pathname, ALL.find((i) => i.key === k)!.href)) ? "text-[#0B5ED7] dark:text-km-link" : "text-km-text-secondary"
                    }`}
                >
                    <DotsThreeOutlineIcon size={22} aria-hidden="true" />
                    {t("short.more")}
                </button>
            </nav>

            {/* Phone "More" sheet */}
            {moreOpen && (
                <div className="md:hidden fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={t("label")}>
                    <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/40" onClick={() => setMoreOpen(false)} />
                    <div onClick={(e) => (e.target as HTMLElement).closest("a") && setMoreOpen(false)} className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-km-surface-card p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                        <div className="mb-3 flex items-center justify-between">
                            <span className="mx-auto h-1.5 w-10 rounded-full bg-km-border" aria-hidden="true" />
                            <button type="button" onClick={() => setMoreOpen(false)} aria-label={t("close")} className="absolute right-4 flex h-9 w-9 items-center justify-center rounded-lg text-km-text-secondary hover:bg-km-surface">
                                <XIcon size={18} aria-hidden="true" />
                            </button>
                        </div>
                        {companyCard}
                        <Link
                            href="/recruiter/jobs/create"
                            className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-km-accent text-sm font-semibold text-white"
                        >
                            <PlusIcon size={16} weight="bold" aria-hidden="true" />
                            {t("postJob")}
                        </Link>
                        <div className="mt-4">{groups}</div>
                        <div className="mt-4 border-t border-km-border/70 pt-3">{footer}</div>
                    </div>
                </div>
            )}
        </>
    );
}
