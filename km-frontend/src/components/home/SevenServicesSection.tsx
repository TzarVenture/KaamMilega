'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, BriefcaseIcon, CalendarBlankIcon, GraduationCapIcon, LightningIcon, StorefrontIcon, UserCheckIcon, UsersIcon } from '@phosphor-icons/react';
import SectionHeader from './SectionHeader';
import { FEATURES } from '@/config/features';

interface ServiceDefinition {
    number: string;
    title: string;
    description: string;
    actionLabel: string;
    href: string;
    providerLabel: string;
    providerHref: string;
    icon: React.ReactNode;
    colorHex: string;
    borderColor: string;
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
            icon: <BriefcaseIcon size={36} weight="duotone" />,
            colorHex: '#0B5ED7',
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
            icon: <LightningIcon size={36} weight="duotone" />,
            colorHex: '#FF6B00',
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
            icon: <GraduationCapIcon size={36} weight="duotone" />,
            colorHex: '#16A34A',
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
            icon: <UserCheckIcon size={36} weight="duotone" />,
            colorHex: '#7C3AED',
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
            icon: <StorefrontIcon size={36} weight="duotone" />,
            colorHex: '#EF4444',
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
            icon: <UsersIcon size={36} weight="duotone" />,
            colorHex: '#0F9D8A',
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
            icon: <CalendarBlankIcon size={36} weight="duotone" />,
            colorHex: '#F59E0B',
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
                                className={`group relative w-full sm:w-[calc(50%-12px)] md:w-[calc(33.333%-16px)] lg:w-[calc(25%-18px)] bg-white rounded-2xl border border-[#D9E0EA] p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-lg ${service.borderColor}`}
                            >
                                {/* Header: service icon in its design.md colour, number as a quiet label */}
                                <div>
                                    <div className="flex items-start justify-between mb-5">
                                        <span className="leading-none" style={{ color: service.colorHex }} aria-hidden="true">
                                            {service.icon}
                                        </span>
                                        <span className="text-xs font-medium tabular-nums text-slate-400">
                                            {service.number}
                                        </span>
                                    </div>

                                    {/* Service Title */}
                                    <h3 className="text-lg sm:text-xl font-bold text-[#111827] group-hover:text-km-primary transition-colors mb-3 leading-snug">
                                        {service.title}
                                    </h3>

                                    {/* Description */}
                                    <p className="text-sm text-[#5B6472] leading-relaxed">
                                        {service.description}
                                    </p>
                                </div>

                                {/* Footer Links */}
                                <div className="mt-8 pt-5 border-t border-[#D9E0EA]/60 flex items-center justify-between">
                                    <Link
                                        href={service.href}
                                        className="inline-flex items-center gap-1.5 text-sm font-bold text-km-primary hover:text-km-primary-dark transition-colors"
                                    >
                                        <span>{service.actionLabel}</span>
                                        <ArrowRightIcon weight="bold"
                                            size={16}
                                            className="transition-transform group-hover:translate-x-1 shrink-0"
                                        />
                                    </Link>
                                    <Link
                                        href={service.providerHref}
                                        className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors"
                                    >
                                        {service.providerLabel}
                                    </Link>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </section>
    );
}
