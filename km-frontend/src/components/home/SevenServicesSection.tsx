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
    /** home.services.<key>.{title,text,action} in the messages */
    key: 'jobs' | 'instant' | 'skills' | 'experts' | 'services' | 'p2p' | 'events';
    href: string;
    Art: React.ComponentType<{ className?: string }>;
    tintHex: string;
    borderColor: string;
}

// The client's seven services, in the client's order
const ALL_SERVICES: ServiceDefinition[] = [
    { key: 'jobs', href: '/jobs', Art: JobsServiceArt, tintHex: '#EAF1FC', borderColor: 'hover:border-[#0B5ED7]/40' },
    { key: 'instant', href: '/instant-milega', Art: InstantServiceArt, tintHex: '#FFF1E6', borderColor: 'hover:border-[#FF6B00]/40' },
    { key: 'skills', href: '/resources', Art: SkillsServiceArt, tintHex: '#E8F6ED', borderColor: 'hover:border-[#16A34A]/40' },
    { key: 'experts', href: '/mentorship', Art: MentorsServiceArt, tintHex: '#F2EDFE', borderColor: 'hover:border-[#7C3AED]/40' },
    { key: 'services', href: '/jobs?type=service', Art: ServicesServiceArt, tintHex: '#FDEDED', borderColor: 'hover:border-[#EF4444]/40' },
    { key: 'p2p', href: '/network', Art: PeerServiceArt, tintHex: '#E4F5F2', borderColor: 'hover:border-[#0F9D8A]/40' },
    { key: 'events', href: '/events', Art: EventsServiceArt, tintHex: '#FEF5E2', borderColor: 'hover:border-[#F59E0B]/40' },
];

function ServiceBanner({ Art, tintHex }: Pick<ServiceDefinition, 'Art' | 'tintHex'>) {
    const { ref, inView } = useInViewOnce<HTMLDivElement>();
    useReplayOnHover(ref, inView, '.group');
    return (
        <div ref={ref} data-inview={inView} className="km-on-light relative h-20 w-20 shrink-0 rounded-xl overflow-hidden dark:brightness-90 sm:h-32 sm:w-auto" style={{ backgroundColor: tintHex }}>
            <Art className="absolute inset-0 w-full h-full transition-transform duration-300 group-hover:-translate-y-1" />
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
                <div className="flex flex-wrap justify-center gap-3 sm:gap-6">
                    {services.map((service) => (
                        <Link
                            key={service.key}
                            href={service.href}
                            className={`group relative w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)] bg-km-surface-card rounded-2xl border border-km-border p-3 flex flex-row gap-3 sm:flex-col sm:gap-0 km-press-card duration-200 shadow-2xs hover:shadow-lg ${service.borderColor}`}
                        >
                            {/* Illustrated banner on a soft tint of the service colour; its art animates in view and on card hover */}
                            <ServiceBanner Art={service.Art} tintHex={service.tintHex} />

                            <div className="min-w-0 sm:px-3 sm:pt-5 sm:pb-2 flex flex-col flex-1">
                                <h3 className="text-base sm:text-lg font-bold text-km-text-primary group-hover:text-km-heading transition-colors mb-1 sm:mb-2 leading-snug">
                                    {t(`${service.key}.title`)}
                                </h3>
                                <p className="text-sm text-km-text-secondary leading-relaxed">{t(`${service.key}.text`)}</p>

                                <div className="mt-auto pt-2 sm:pt-5">
                                    <div className="sm:pt-4 sm:border-t border-km-border/60">
                                        <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold text-km-heading group-hover:text-km-primary-dark transition-colors dark:group-hover:text-km-link">
                                            {t(`${service.key}.action`)}
                                            <ArrowRightIcon weight="bold" size={16} className="transition-transform group-hover:translate-x-1 shrink-0" aria-hidden="true" />
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    );
}
