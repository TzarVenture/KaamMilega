"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import {
    ArrowSquareOutIcon,
    CaretUpDownIcon,
    CheckIcon,
    LinkSimpleIcon,
    PencilSimpleIcon,
    SealCheckIcon,
    ShieldCheckIcon,
    TagIcon,
    HourglassMediumIcon,
} from "@phosphor-icons/react";
import CompanyLogo from "@/components/ui/CompanyLogo";
import { recruiterPlansApi, type PlanOverview } from "@/lib/api/recruiterPlans";

export type CompanyUser = {
    id?: string;
    _id?: string;
    company_name?: string;
    name?: string;
    company_logo?: string;
    company_city?: string;
    industry?: string;
    verification_status?: string;
    company_documents?: unknown[];
};

const row = "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-km-text-primary hover:bg-km-surface";

/**
 * The company card at the top of the employer menu. It names the account being worked in, and
 * opens a short menu: how the company stands (verification, plan) and the page candidates see.
 */
export default function CompanyMenu({ user }: { user: CompanyUser | null }) {
    const t = useTranslations("recruiterNav.companyMenu");
    const [open, setOpen] = useState(false);
    const [plan, setPlan] = useState<PlanOverview | null>(null);
    const [copied, setCopied] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    // Close on a click outside, on Escape and when the page changes
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const toggle = () => {
        const next = !open;
        setOpen(next);
        // The plan is only needed once the menu is opened
        if (next && !plan) recruiterPlansApi.overview().then(setPlan).catch(() => {});
    };

    const name = user?.company_name || user?.name || t("yourCompany");
    const id = user?.id || user?._id || "";
    const publicPath = id ? `/company/${id}` : "";
    const verified = String(user?.verification_status || "").toLowerCase() === "verified";
    const underReview = !verified && (user?.company_documents?.length ?? 0) > 0;
    const subline = [user?.industry, user?.company_city].filter(Boolean).join(" · ");

    const copyLink = async () => {
        if (!publicPath) return;
        try {
            await navigator.clipboard.writeText(window.location.origin + publicPath);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            /* clipboard blocked: nothing to do */
        }
    };

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-haspopup="menu"
                className={`flex w-full items-center gap-3 rounded-xl border bg-km-surface p-3 text-left transition-colors ${open ? "border-[#0B5ED7]" : "border-km-border hover:border-[#0B5ED7]/40"}`}
            >
                {user ? (
                    <CompanyLogo key={user.company_logo || "none"} src={user.company_logo} name={name} className="w-10 h-10" textClass="text-sm" />
                ) : (
                    <span className="h-10 w-10 shrink-0 rounded-full bg-km-border" aria-hidden="true" />
                )}
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1">
                        <span className="truncate text-sm font-semibold text-km-heading">{user ? name : " "}</span>
                        {verified && <SealCheckIcon size={15} weight="fill" className="shrink-0 text-[#0B5ED7]" aria-label={t("verified")} />}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-km-text-secondary">{subline || t("companyAccount")}</span>
                </span>
                <CaretUpDownIcon size={16} className="shrink-0 text-km-text-secondary" aria-hidden="true" />
            </button>

            {open && (
                <div role="menu" onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)} className="absolute inset-x-0 top-full z-40 mt-2 rounded-xl border border-km-border bg-km-surface-card p-1.5 shadow-lg">
                    {/* Where the company stands */}
                    <div className="px-3 pt-2 pb-2.5 space-y-2 border-b border-km-border/70 mb-1.5">
                        <div className="flex items-center gap-2 text-sm">
                            {verified ? (
                                <><SealCheckIcon size={16} weight="fill" className="text-[#0B5ED7]" aria-hidden="true" /><span className="text-km-text-primary">{t("verified")}</span></>
                            ) : underReview ? (
                                <><HourglassMediumIcon size={16} className="text-[#F59E0B]" aria-hidden="true" /><span className="text-km-text-primary">{t("underReview")}</span></>
                            ) : (
                                <><ShieldCheckIcon size={16} className="text-km-text-secondary" aria-hidden="true" /><span className="text-km-text-secondary">{t("notVerified")}</span></>
                            )}
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <TagIcon size={16} className="text-km-text-secondary" aria-hidden="true" />
                            <span className="text-km-text-primary">
                                {plan ? (plan.current ? plan.current.plan_name : t("freePlan")) : " "}
                            </span>
                            <Link href="/recruiter/plan" className="ml-auto text-xs font-semibold text-km-link hover:underline">{t("managePlan")}</Link>
                        </div>
                    </div>

                    {publicPath && (
                        <Link href={publicPath} role="menuitem" className={row}>
                            <ArrowSquareOutIcon size={18} className="text-km-text-secondary" aria-hidden="true" />
                            {t("viewPublic")}
                        </Link>
                    )}
                    <Link href="/recruiter/company" role="menuitem" className={row}>
                        <PencilSimpleIcon size={18} className="text-km-text-secondary" aria-hidden="true" />
                        {t("edit")}
                    </Link>
                    {publicPath && (
                        <button type="button" role="menuitem" onClick={copyLink} className={row}>
                            {copied ? <CheckIcon size={18} className="text-[#16A34A]" aria-hidden="true" /> : <LinkSimpleIcon size={18} className="text-km-text-secondary" aria-hidden="true" />}
                            {copied ? t("copied") : t("copyLink")}
                        </button>
                    )}
                    {!verified && !underReview && (
                        <Link href="/recruiter/register?step=verify" role="menuitem" className={row}>
                            <ShieldCheckIcon size={18} className="text-[#16A34A]" aria-hidden="true" />
                            {t("getVerified")}
                        </Link>
                    )}
                </div>
            )}
        </div>
    );
}
