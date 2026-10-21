'use client';

import React from 'react';
import Link from 'next/link';
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

interface ServiceDefinition {
    number: string;
    title: string;
    description: string;
    actionLabel: string;
    href: string;
    providerLabel: string;
    providerHref: string;
    Art: React.ComponentType<{ className?: string }>;
    tintHex: string;
    borderColor: string;
}

function ServiceBanner({ Art, tintHex, children }: Pick<ServiceDefinition, 'Art' | 'tintHex'> & { children: React.ReactNode }) {
    const { ref, inView } = useInViewOnce<HTMLDivElement>();
    return (
        <div ref={ref} data-inview={inView} className="relative h-32 rounded-xl overflow-hidden" style={{ backgroundColor: tintHex }}>
            <Art className="absolute inset-0 w-full h-full transition-transform duration-300 group-hover:-translate-y-1" />
            {children}
        </div>
    );
}

export default function SevenServicesSection() {
    const allServices: ServiceDefinition[] = [
        {
            number: '01',
            title: 'Jobs & Recruitment',
            description: 'Full-time and part-time openings with direct hiring manager contact.',
            actionLabel: 'Explore Jobs',
            href: '/jobs',
            providerLabel: 'Post a Job',
            providerHref: '/recruiter/login',
            Art: JobsServiceArt,
            tintHex: '#EAF1FC',
            borderColor: 'hover:border-[#0B5ED7]/40',
        },
        {
            number: '02',
            title: 'InstantMilega™',
            description: 'Fast local help and on-demand shifts with verified start and finish codes.',
            actionLabel: 'Find Instant Gigs',
            href: '/instant-milega',
            providerLabel: 'Book Staff',
            providerHref: '/instant-milega?mode=hire',
            Art: InstantServiceArt,
            tintHex: '#FFF1E6',
            borderColor: 'hover:border-[#FF6B00]/40',
        },
        {
            number: '03',
            title: 'Skills Marketplace',
            description: 'Practical courses and certifications to build skills and boost earnings.',
            actionLabel: 'Browse Courses',
            href: '/resources',
            providerLabel: 'Accredited Tests',
            providerHref: '/resources',
            Art: SkillsServiceArt,
            tintHex: '#E8F6ED',
            borderColor: 'hover:border-[#16A34A]/40',
        },
        {
            number: '04',
            title: 'Experts & Mentors',
            description: 'One-on-one guidance, interview practice, and advice from industry professionals.',
            actionLabel: 'Book Mentor',
            href: '/mentorship',
            providerLabel: 'Become Mentor',
            providerHref: '/mentorship',
            Art: MentorsServiceArt,
            tintHex: '#F2EDFE',
            borderColor: 'hover:border-[#7C3AED]/40',
        },
        {
            number: '05',
            title: 'Services Marketplace',
            description: 'Direct project contracts and trade services for businesses and individuals.',
            actionLabel: 'Explore Services',
            href: '/jobs?type=service',
            providerLabel: 'List Service',
            providerHref: '/jobs/create',
            Art: ServicesServiceArt,
            tintHex: '#FDEDED',
            borderColor: 'hover:border-[#EF4444]/40',
        },
        {
            number: '06',
            title: 'Peer-to-Peer',
            description: 'Network with people in your trade, share opportunities, and stay connected.',
            actionLabel: 'Join Network',
            href: '/network',
            providerLabel: 'Create Post',
            providerHref: '/network',
            Art: PeerServiceArt,
            tintHex: '#E4F5F2',
            borderColor: 'hover:border-[#0F9D8A]/40',
        },
        {
            number: '07',
            title: 'Events & Community',
            description: 'Hiring drives, industry workshops, and community skill sessions.',
            actionLabel: 'View Events',
            href: '/events',
            providerLabel: 'Host Drive',
            providerHref: '/events',
            Art: EventsServiceArt,
            tintHex: '#FEF5E2',
            borderColor: 'hover:border-[#F59E0B]/40',
        },
    ];

    const services = FEATURES.INSTANT_MILEGA
        ? allServices
        : allServices
            .filter((s) => s.title !== 'InstantMilega™')
            .map((s, idx) => ({ ...s, number: `0${idx + 1}` }));

    return (
        <section className="py-8 sm:py-10 lg:py-12 font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <SectionHeader
                    title={FEATURES.INSTANT_MILEGA ? 'Explore core services' : 'Explore platform services'}
                    description="Everything you need to hire, work, and grow your career in one place."
                />

                {/* Services Cards */}
                <div className="flex flex-wrap justify-center gap-6">
                    {services.map((service) => {
                        return (
                            <div
                                key={service.number}
                                className={`group relative w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)] bg-white rounded-2xl border border-[#D9E0EA] p-3 flex flex-col transition-all duration-200 shadow-2xs hover:shadow-lg ${service.borderColor}`}
                            >
                                {/* Illustrated banner on a soft tint of the service colour; its art animates once in view */}
                                <ServiceBanner Art={service.Art} tintHex={service.tintHex}>
                                    <span className="absolute top-2.5 right-2.5 text-xs font-semibold tabular-nums text-slate-500 bg-white/80 px-2 py-0.5 rounded-full">
                                        {service.number}
                                    </span>
                                </ServiceBanner>

                                <div className="px-3 pt-5 pb-2 flex flex-col flex-1">
                                    <h3 className="text-lg font-bold text-[#111827] group-hover:text-km-primary transition-colors mb-2 leading-snug">
                                        {service.title}
                                    </h3>
                                    <p className="text-sm text-[#5B6472] leading-relaxed">
                                        {service.description}
                                    </p>

                                    <div className="mt-auto pt-5">
                                        <div className="pt-4 border-t border-[#D9E0EA]/60 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
                                            <Link
                                                href={service.href}
                                                className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-bold text-km-primary hover:text-km-primary-dark transition-colors"
                                            >
                                                <span>{service.actionLabel}</span>
                                                <ArrowRightIcon weight="bold"
                                                    size={16}
                                                    className="transition-transform group-hover:translate-x-1 shrink-0"
                                                />
                                            </Link>
                                            <Link
                                                href={service.providerHref}
                                                className="whitespace-nowrap text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
                                            >
                                                {service.providerLabel}
                                            </Link>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
