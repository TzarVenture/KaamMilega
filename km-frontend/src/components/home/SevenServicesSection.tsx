'use client';

import React from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ArrowRightIcon } from '@phosphor-icons/react';
import SectionHeader from './SectionHeader';
import {
    EventsServiceArt,
    InstantServiceArt,
    JobsServiceArt,
    MentorsServiceArt,
    PeerServiceArt,
    ServicesServiceArt,
    SkillsServiceArt,
} from './illustrations/ServiceArt';
import { FEATURES } from '@/config/features';
import { useInViewOnce } from '@/lib/useInViewOnce';
import { useReplayOnHover } from '@/lib/useReplayOnHover';

interface ServiceDefinition {
    /** home.services.<key>.{title,text,action,provider} in the messages */
    key: 'jobs' | 'instant' | 'skills' | 'experts' | 'services' | 'p2p' | 'events';
    href: string;
    /** Second link for the other side of the service (employers, mentors…), when there is one */
    providerHref?: string;
    Art: React.ComponentType<{ className?: string }>;
    tintHex: string;
    borderColor: string;
}

// The client's seven services, in the client's order
const ALL_SERVICES: ServiceDefinition[] = [
    { key: 'jobs', href: '/jobs', providerHref: '/recruiter/login', Art: JobsServiceArt, tintHex: '#EAF1FC', borderColor: 'hover:border-[#0B5ED7]/40' },
    { key: 'instant', href: '/instant-milega', providerHref: '/instant-milega?mode=hire', Art: InstantServiceArt, tintHex: '#FFF1E6', borderColor: 'hover:border-[#FF6B00]/40' },
    { key: 'skills', href: '/resources', providerHref: '/resources', Art: SkillsServiceArt, tintHex: '#E8F6ED', borderColor: 'hover:border-[#16A34A]/40' },
    { key: 'experts', href: '/mentorship', providerHref: '/mentorship', Art: MentorsServiceArt, tintHex: '#F2EDFE', borderColor: 'hover:border-[#7C3AED]/40' },
    { key: 'services', href: '/jobs?type=service', providerHref: '/jobs/create', Art: ServicesServiceArt, tintHex: '#FDEDED', borderColor: 'hover:border-[#EF4444]/40' },
    { key: 'p2p', href: '/network', providerHref: '/network', Art: PeerServiceArt, tintHex: '#E4F5F2', borderColor: 'hover:border-[#0F9D8A]/40' },
    { key: 'events', href: '/events', providerHref: '/events', Art: EventsServiceArt, tintHex: '#FEF5E2', borderColor: 'hover:border-[#F59E0B]/40' },
];

function ServiceBanner({ Art, tintHex, children }: Pick<ServiceDefinition, 'Art' | 'tintHex'> & { children: React.ReactNode }) {
    const { ref, inView } = useInViewOnce<HTMLDivElement>();
    useReplayOnHover(ref, inView, '.group');
    return (
        <div ref={ref} data-inview={inView} className="km-on-light relative h-32 rounded-xl overflow-hidden dark:brightness-90" style={{ backgroundColor: tintHex }}>
            <Art className="absolute inset-0 w-full h-full transition-transform duration-300 group-hover:-translate-y-1" />
            {children}
        </div>
    );
}

export default function SevenServicesSection() {
    const t = useTranslations('home.services');
    const services = ALL_SERVICES.filter((s) => FEATURES.INSTANT_MILEGA || s.key !== 'instant');

    return (
        <section className="py-8 sm:py-10 lg:py-12 font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <SectionHeader
                    title={FEATURES.INSTANT_MILEGA ? t('title') : t('titleNoInstant')}
                    description={t('text')}
                />

                {/* Services Cards */}
                <div className="flex flex-wrap justify-center gap-6">
                    {services.map((service, idx) => (
                        <div
                            key={service.key}
                            className={`group relative w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)] bg-km-surface-card rounded-2xl border border-km-border p-3 flex flex-col transition-all duration-200 shadow-2xs hover:shadow-lg ${service.borderColor}`}
                        >
                            {/* Illustrated banner on a soft tint of the service colour; its art animates in view and on card hover */}
                            <ServiceBanner Art={service.Art} tintHex={service.tintHex}>
                                <span className="absolute top-2.5 right-2.5 text-xs font-semibold tabular-nums text-slate-500 bg-km-surface-card/80 px-2 py-0.5 rounded-full">
                                    {String(idx + 1).padStart(2, '0')}
                                </span>
                            </ServiceBanner>

                            <div className="px-3 pt-5 pb-2 flex flex-col flex-1">
                                <h3 className="text-lg font-bold text-km-text-primary group-hover:text-km-heading transition-colors mb-2 leading-snug">
                                    {t(`${service.key}.title`)}
                                </h3>
                                <p className="text-sm text-km-text-secondary leading-relaxed">{t(`${service.key}.text`)}</p>

                                <div className="mt-auto pt-5">
                                    <div className="pt-4 border-t border-km-border/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                                        <Link
                                            href={service.href}
                                            className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold text-km-heading hover:text-km-primary-dark transition-colors dark:hover:text-km-link"
                                        >
                                            <span>{t(`${service.key}.action`)}</span>
                                            <ArrowRightIcon weight="bold"
                                                size={16}
                                                className="transition-transform group-hover:translate-x-1 shrink-0"
                                            />
                                        </Link>
                                        {service.providerHref && (
                                            <Link
                                                href={service.providerHref}
                                                className="whitespace-nowrap text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                            >
                                                {t(`${service.key}.provider`)}
                                            </Link>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
