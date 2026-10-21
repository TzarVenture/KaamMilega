"use client";

import FooterLink from "@/components/ui/FooterLink";
import BrandLogo from "@/components/km/BrandLogo";
import { FacebookLogoIcon, InstagramLogoIcon, LinkedinLogoIcon, YoutubeLogoIcon } from '@phosphor-icons/react';

import { usePathname } from "next/navigation";
import { FEATURES } from "@/config/features";

export default function Footer() {
    const pathname = usePathname();
    if (pathname?.startsWith('/chat')) return null;

    return (
        <footer className="bg-[#071A4D] text-white px-6 sm:px-12 lg:px-20 pt-16 pb-8 border-t border-blue-950">
            <div className="max-w-7xl mx-auto">
                {/* Official KaamMilega Platform Branding Header */}
                <div className="pb-10 mb-12 border-b border-blue-900/60 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
                        <div className="bg-white px-3.5 py-2 rounded-2xl flex items-center shadow-md shrink-0 w-fit">
                            <BrandLogo size="md" />
                        </div>
                        <div className="border-l-0 sm:border-l sm:border-white/15 sm:pl-6 space-y-1">
                            <p className="text-xs sm:text-sm font-bold text-white tracking-wide uppercase">
                                India&apos;s Verified Employment &amp; Skill Platform
                            </p>
                            <p className="text-xs text-slate-300">
                                Direct HR Calls • Zero Brokerage • Biometric Verified Profiles{FEATURES.INSTANT_MILEGA ? ' • InstantMilega™ Shifts' : ''}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 bg-white/10 px-4 py-2 rounded-xl border border-white/10 text-xs font-semibold text-amber-300 shrink-0">
                        <span className="font-medium tracking-wide">Har Kaam, Har Mauka™</span>
                    </div>
                </div>

                {/* GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10">

                    {/* Legal */}
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white mb-5 tracking-wide">Legal</h3>
                        <div className="space-y-3">
                            <FooterLink>Jobseeker FAQs</FooterLink>
                            <FooterLink>Employer FAQs</FooterLink>
                            <FooterLink>User Terms & Conditions</FooterLink>
                            <FooterLink>Privacy Policy</FooterLink>
                            <FooterLink>Employer Terms Of Service</FooterLink>
                            <FooterLink>Connect Like You Guidelines</FooterLink>
                        </div>
                    </div>

                    {/* Services */}
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white mb-5 tracking-wide">Services</h3>
                        <div className="space-y-3">
                            <FooterLink>Job Search By Category</FooterLink>
                            <FooterLink>Job Search By City</FooterLink>
                            <FooterLink>Browse Search</FooterLink>
                            <FooterLink>Free Job Alerts</FooterLink>
                            <FooterLink>Recommended Job</FooterLink>
                            <FooterLink>Similar Jobs</FooterLink>
                            <FooterLink>Resume Builder</FooterLink>
                            <FooterLink>Subscription (Wallets)</FooterLink>
                        </div>
                    </div>

                    {/* Solutions */}
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white mb-5 tracking-wide">Solutions</h3>
                        <div className="space-y-3">
                            <FooterLink href="/network">Connect Like You</FooterLink>
                            <FooterLink href="/jobs">Premium Job Search</FooterLink>
                            {FEATURES.INSTANT_MILEGA && <FooterLink href="/instant-milega">InstantMilega™</FooterLink>}
                            <FooterLink href="/resources">Learn With KM</FooterLink>
                            <FooterLink href="/jobs">Promotion (Ad Network)</FooterLink>
                            <FooterLink href="/how-we-work">How We Work</FooterLink>
                        </div>
                    </div>

                    {/* Connect */}
                    <div>
                        <h3 className="text-base sm:text-lg font-bold text-white mb-5 tracking-wide">Connect</h3>
                        <div className="space-y-3">
                            <FooterLink href="/about">About</FooterLink>
                            <FooterLink href="/how-we-work">How We Work</FooterLink>
                            <FooterLink href="/support">Support</FooterLink>
                            <FooterLink href="/career">Career</FooterLink>
                        </div>

                        <div className="mt-8">
                            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4">
                                Follow Us
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
                            Company / Employer
                        </h3>

                        <div className="space-y-3">
                            <FooterLink href="/register">Hire Local Staff</FooterLink>
                            <FooterLink href="/register">Post A Job</FooterLink>
                            <FooterLink href="/about">Build Brand Image</FooterLink>
                            <FooterLink href="/support">Contact Support</FooterLink>
                        </div>

                        <div className="mt-10">
                            <h3 className="text-base font-bold text-white mb-1">
                                Apply On The Go
                            </h3>
                            <p className="text-slate-400 text-xs mb-4">
                                Get Real Time Updates On Our App
                            </p>

                            <div className="space-y-3">
                                <a
                                    href="https://play.google.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:opacity-90 transition-opacity inline-block"
                                    aria-label="Get it on Google Play"
                                >
                                    <img
                                        src="/asset/google-play-badge-logo.svg"
                                        alt="Get it on Google Play"
                                        className="h-10 w-auto object-contain"
                                    />
                                </a>
                                <a
                                    href="https://apple.com"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="hover:opacity-90 transition-opacity inline-block"
                                    aria-label="Download on the App Store"
                                >
                                    <img
                                        src="/asset/download-on-the-app-store-apple-logo.svg"
                                        alt="Download on the App Store"
                                        className="h-10 w-auto object-contain"
                                    />
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Bottom */}
                <div className="mt-14 pt-8 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between gap-4 text-slate-400 text-xs">
                    <p>All Rights Reserved © {new Date().getFullYear()} KaamMilega™ — India&apos;s Most Trusted Work &amp; Skill Platform</p>
                    <p className="text-slate-500">Kaam Bhi. Skill Bhi. Kamaai Bhi.</p>
                </div>
            </div>
        </footer>
    );
}
