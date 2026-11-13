"use client";

import FooterLink from "@/components/ui/FooterLink";
import BrandLogo from "@/components/km/BrandLogo";
import { StoreBadges } from "@/components/km/AppDownload";
import { FacebookLogoIcon, InstagramLogoIcon, LinkedinLogoIcon, YoutubeLogoIcon } from '@phosphor-icons/react';
import { useTranslations } from "next-intl";
import { FEATURES } from "@/config/features";
import { SOCIAL_LINKS } from "@/config/social";

// Only pages that are filled in config/social.ts get an icon
const SOCIALS = [
    { name: "Instagram", href: SOCIAL_LINKS.instagram, Icon: InstagramLogoIcon },
    { name: "Facebook", href: SOCIAL_LINKS.facebook, Icon: FacebookLogoIcon },
    { name: "LinkedIn", href: SOCIAL_LINKS.linkedin, Icon: LinkedinLogoIcon },
    { name: "YouTube", href: SOCIAL_LINKS.youtube, Icon: YoutubeLogoIcon },
].filter((s) => s.href);

/** Site footer. Hidden on /chat by CommonFooter, which wraps it for the public pages. */
export default function Footer() {
    const t = useTranslations("footer");

    const column = (title: string, links: React.ReactNode) => (
        <div>
            <h3 className="text-base font-semibold text-white mb-2 sm:mb-4">{title}</h3>
            <div className="sm:space-y-1">{links}</div>
        </div>
    );

    return (
        // Navy in both themes: design.md keeps the footer and heroes on the brand navy
        <footer className="bg-[#071A4D] text-white px-4 sm:px-12 lg:px-20 pt-12 sm:pt-16 pb-8 border-t border-white/10">
            <div className="max-w-7xl mx-auto">
                <div className="pb-10 mb-10 border-b border-white/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                        <div className="bg-km-surface-card px-3.5 py-2 rounded-2xl flex items-center shrink-0 w-fit">
                            <BrandLogo size="md" />
                        </div>
                        <div className="sm:border-l sm:border-white/15 sm:pl-6 space-y-1">
                            <p className="text-sm font-semibold text-white">{t("tagline")}</p>
                            <p className="text-xs text-white/70">
                                {FEATURES.INSTANT_MILEGA ? t("highlightsInstant") : t("highlights")}
                            </p>
                        </div>
                    </div>
                    <p className="px-4 py-2 rounded-xl bg-[#0B1F52] text-xs font-semibold tracking-wide text-km-accent shrink-0">
                        {t("motto")}
                    </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-6 gap-y-8 sm:gap-10">
                    {column(t("legal"), <>
                        <FooterLink href="/support#faqs">{t("jobseekerFaqs")}</FooterLink>
                        <FooterLink href="/policies/terms">{t("userTerms")}</FooterLink>
                        <FooterLink href="/policies/privacy">{t("privacy")}</FooterLink>
                        <FooterLink href="/policies/employer-terms">{t("employerTerms")}</FooterLink>
                        <FooterLink href="/policies/community-guidelines">{t("guidelines")}</FooterLink>
                    </>)}

                    {column(t("services"), <>
                        <FooterLink href="/#job-categories">{t("byCategory")}</FooterLink>
                        <FooterLink href="/jobs">{t("byCity")}</FooterLink>
                        <FooterLink href="/settings">{t("jobAlerts")}</FooterLink>
                        <FooterLink href="/wallet">{t("subscription")}</FooterLink>
                    </>)}

                    {column(t("solutions"), <>
                        <FooterLink href="/network">{t("connectLikeYou")}</FooterLink>
                        {FEATURES.INSTANT_MILEGA && <FooterLink href="/instant-milega">InstantMilega™</FooterLink>}
                        <FooterLink href="/resources">{t("learn")}</FooterLink>
                        <FooterLink href="/how-we-work">{t("howWeWork")}</FooterLink>
                    </>)}

                    <div>
                        {column(t("connect"), <>
                            <FooterLink href="/about">{t("about")}</FooterLink>
                            <FooterLink href="/support">{t("support")}</FooterLink>
                            <FooterLink href="/career">{t("career")}</FooterLink>
                        </>)}
                        {SOCIALS.length > 0 && (
                            <div className="mt-6">
                                <h3 className="text-sm font-semibold text-white/70 mb-2">{t("followUs")}</h3>
                                <div className="flex flex-wrap gap-1">
                                    {SOCIALS.map(({ name, href, Icon }) => (
                                        <a
                                            key={name}
                                            href={href}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            aria-label={name}
                                            className="flex h-11 w-11 items-center justify-center rounded-xl text-white/75 hover:text-white hover:bg-white/10 transition-colors"
                                        >
                                            <Icon weight="bold" size={20} />
                                        </a>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="col-span-2 lg:col-span-1">
                        {column(t("employer"), <>
                            <FooterLink href="/recruiter/register">{t("postJob")}</FooterLink>
                            <FooterLink href="/support">{t("contactSupport")}</FooterLink>
                        </>)}
                        <div className="mt-8">
                            <h3 className="text-base font-semibold text-white mb-1">{t("appTitle")}</h3>
                            <p className="text-white/70 text-xs mb-4">{t("appText")}</p>
                            {/* Real store links once the app is published (config/appLinks.ts), "Coming soon" until then */}
                            <StoreBadges tone="onDark" />
                        </div>
                    </div>
                </div>

                <div className="mt-12 pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/60 text-center sm:text-left">
                    <p>{t("rights", { year: new Date().getFullYear() })}</p>
                    <p>{t("slogan")}</p>
                </div>
            </div>
        </footer>
    );
}
