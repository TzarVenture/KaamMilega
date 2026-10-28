"use client";

import FooterLink from "@/components/ui/FooterLink";
import BrandLogo from "@/components/km/BrandLogo";
import { StoreBadges } from "@/components/km/AppDownload";
import { FacebookLogoIcon, InstagramLogoIcon, LinkedinLogoIcon, YoutubeLogoIcon } from '@phosphor-icons/react';
import { useTranslations } from "next-intl";

import { usePathname } from "next/navigation";
import { FEATURES } from "@/config/features";

export default function Footer() {
    const t = useTranslations("footer");
    const pathname = usePathname();
    if (pathname?.startsWith('/chat')) return null;

    return (
        <footer className="bg-[#071A4D] text-white px-6 sm:px-12 lg:px-20 pt-16 pb-8 border-t border-blue-950">
            <div className="max-w-7xl mx-auto">
                {/* Official KaamMilega Platform Branding Header */}
                <div className="pb-10 mb-12 border-b border-blue-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                        <div className="bg-km-surface-card px-3.5 py-2 rounded-2xl flex items-center shadow-md shrink-0 w-fit">
                            <BrandLogo size="md" />
                        </div>
                        <div className="border-l-0 sm:border-l sm:border-white/15 sm:pl-6 space-y-1">
                            <p className="text-sm font-bold text-white">
                                {t("tagline")}
                            </p>
                            <p className="text-xs text-slate-300">
                                {FEATURES.INSTANT_MILEGA ? t("highlightsInstant") : t("highlights")}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-amber-300 shrink-0">
                        <span className="font-medium tracking-wide">{t("motto")}</span>
                    </div>
                </div>

                {/* GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

                    {/* Legal */}
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white mb-5 tracking-wide">{t("legal")}</h3>
                        <div className="space-y-3">
                            <FooterLink>{t("jobseekerFaqs")}</FooterLink>
                            <FooterLink>{t("employerFaqs")}</FooterLink>
                            <FooterLink>{t("userTerms")}</FooterLink>
                            <FooterLink>{t("privacy")}</FooterLink>
                            <FooterLink>{t("employerTerms")}</FooterLink>
                            <FooterLink>{t("guidelines")}</FooterLink>
                        </div>
                    </div>

                    {/* Services */}
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white mb-5 tracking-wide">{t("services")}</h3>
                        <div className="space-y-3">
                            <FooterLink>{t("byCategory")}</FooterLink>
                            <FooterLink>{t("byCity")}</FooterLink>
                            <FooterLink>{t("browseSearch")}</FooterLink>
                            <FooterLink>{t("jobAlerts")}</FooterLink>
                            <FooterLink>{t("recommended")}</FooterLink>
                            <FooterLink>{t("similar")}</FooterLink>
                            <FooterLink>{t("resumeBuilder")}</FooterLink>
                            <FooterLink>{t("subscription")}</FooterLink>
                        </div>
                    </div>

                    {/* Solutions */}
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white mb-5 tracking-wide">{t("solutions")}</h3>
                        <div className="space-y-3">
                            <FooterLink href="/network">{t("connectLikeYou")}</FooterLink>
                            <FooterLink href="/jobs">{t("premiumSearch")}</FooterLink>
                            {FEATURES.INSTANT_MILEGA && <FooterLink href="/instant-milega">InstantMilega™</FooterLink>}
                            <FooterLink href="/resources">{t("learn")}</FooterLink>
                            <FooterLink href="/jobs">{t("promotion")}</FooterLink>
                            <FooterLink href="/how-we-work">{t("howWeWork")}</FooterLink>
                        </div>
                    </div>

                    {/* Connect */}
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white mb-5 tracking-wide">{t("connect")}</h3>
                        <div className="space-y-3">
                            <FooterLink href="/about">{t("about")}</FooterLink>
                            <FooterLink href="/how-we-work">{t("howWeWork")}</FooterLink>
                            <FooterLink href="/support">{t("support")}</FooterLink>
                            <FooterLink href="/career">{t("career")}</FooterLink>
                        </div>

                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-slate-300 mb-4">
                                {t("followUs")}
                            </h3>

                            <div className="space-y-3 text-slate-300 text-sm">
                                <div className="flex items-center gap-3 hover:text-white transition-colors cursor-pointer">
                                    <InstagramLogoIcon weight="bold" size={18} />
                                    <span>Instagram</span>
                                </div>
                                <div className="flex items-center gap-3 hover:text-white transition-colors cursor-pointer">
                                    <FacebookLogoIcon weight="bold" size={18} />
                                    <span>Facebook</span>
                                </div>
                                <div className="flex items-center gap-3 hover:text-white transition-colors cursor-pointer">
                                    <LinkedinLogoIcon weight="bold" size={18} />
                                    <span>LinkedIn</span>
                                </div>
                                <div className="flex items-center gap-3 hover:text-white transition-colors cursor-pointer">
                                    <YoutubeLogoIcon weight="bold" size={18} />
                                    <span>Youtube</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Company / Employer */}
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white mb-5 tracking-wide">
                            {t("employer")}
                        </h3>

                        <div className="space-y-3">
                            <FooterLink href="/register">{t("hireLocalStaff")}</FooterLink>
                            <FooterLink href="/register">{t("postJob")}</FooterLink>
                            <FooterLink href="/about">{t("brand")}</FooterLink>
                            <FooterLink href="/support">{t("contactSupport")}</FooterLink>
                        </div>

                        <div className="mt-10">
                            <h3 className="text-base font-bold text-white mb-1">
                                {t("appTitle")}
                            </h3>
                            <p className="text-slate-400 text-xs mb-4">
                                {t("appText")}
                            </p>

                            {/* Real store links once the app is published (config/appLinks.ts), "Coming soon" until then */}
                            <StoreBadges tone="onDark" />
                        </div>
                    </div>
                </div>

                {/* Bottom */}
                <div className="mt-14 pt-8 border-t border-[#1E293B]/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-xs">
                    <p>{t("rights", { year: new Date().getFullYear() })}</p>
                    <p className="text-slate-400">{t("slogan")}</p>
                </div>
            </div>
        </footer>
    );
}
