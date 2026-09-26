'use client';

import React from 'react';
import Link from 'next/link';
import {
    Briefcase,
    Zap,
    GraduationCap,
    UserCheck,
    Store,
    Users,
    Calendar,
    ArrowRight,
} from 'lucide-react';

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
    iconBg: string;
    borderColor: string;
}

export default function SevenServicesSection() {
    const services: ServiceDefinition[] = [
        {
            number: '01',
            title: 'Jobs & Recruitment',
            description: 'Verified full-time, part-time, and fresher openings with zero brokerage and direct HR calls.',
            actionLabel: 'Explore Jobs',
            href: '/jobs',
            providerLabel: 'Post a Job',
            providerHref: '/recruiter/login',
            icon: <Briefcase size={24} />,
            colorHex: '#0B5ED7',
            iconBg: 'bg-[#EFF6FF] text-[#0B5ED7]',
            borderColor: 'hover:border-[#0B5ED7]/40',
        },
        {
            number: '02',
            title: 'InstantMilega™',
            description: 'Hyperlocal 15-minute gig dispatch for certified technicians with daily wallet payouts.',
            actionLabel: 'Find Instant Gigs',
            href: '/jobs?type=instant',
            providerLabel: 'Book Staff',
            providerHref: '/jobs?type=instant&mode=hire',
            icon: <Zap size={24} />,
            colorHex: '#FF6B00',
            iconBg: 'bg-[#FFF7ED] text-[#FF6B00]',
            borderColor: 'hover:border-[#FF6B00]/40',
        },
        {
            number: '03',
            title: 'Skills Marketplace',
            description: 'Vocational trade courses, skill evaluation tests, and verified certifications to increase pay.',
            actionLabel: 'Browse Courses',
            href: '/resources',
            providerLabel: 'Accredited Tests',
            providerHref: '/resources',
            icon: <GraduationCap size={24} />,
            colorHex: '#16A34A',
            iconBg: 'bg-[#F0FDF4] text-[#16A34A]',
            borderColor: 'hover:border-[#16A34A]/40',
        },
        {
            number: '04',
            title: 'Experts & Mentors',
            description: '1-on-1 private career advisory, mock interview coaching, and expert resume evaluation.',
            actionLabel: 'Book Mentor',
            href: '/mentorship',
            providerLabel: 'Become Mentor',
            providerHref: '/mentorship',
            icon: <UserCheck size={24} />,
            colorHex: '#7C3AED',
            iconBg: 'bg-[#FAF5FF] text-[#7C3AED]',
            borderColor: 'hover:border-[#7C3AED]/40',
        },
        {
            number: '05',
            title: 'Services Marketplace',
            description: 'Fixed-price trade contracts and freelance services backed by milestone escrow protection.',
            actionLabel: 'Explore Services',
            href: '/jobs?type=service',
            providerLabel: 'List Service',
            providerHref: '/jobs/create',
            icon: <Store size={24} />,
            colorHex: '#EF4444',
            iconBg: 'bg-[#FEF2F2] text-[#EF4444]',
            borderColor: 'hover:border-[#EF4444]/40',
        },
        {
            number: '06',
            title: 'Peer-to-Peer',
            description: 'Connect directly with verified professionals across trades, share referrals, and grow reputation.',
            actionLabel: 'Join Network',
            href: '/network',
            providerLabel: 'Create Post',
            providerHref: '/network',
            icon: <Users size={24} />,
            colorHex: '#0F9D8A',
            iconBg: 'bg-[#F0FDFA] text-[#0F9D8A]',
            borderColor: 'hover:border-[#0F9D8A]/40',
        },
        {
            number: '07',
            title: 'Events & Community',
            description: 'Attend physical mega hiring drives, vocational workshops, and virtual recruitment webinars.',
            actionLabel: 'View Events',
            href: '/events',
            providerLabel: 'Host Drive',
            providerHref: '/events',
            icon: <Calendar size={24} />,
            colorHex: '#F59E0B',
            iconBg: 'bg-[#FFFBEB] text-[#F59E0B]',
            borderColor: 'hover:border-[#F59E0B]/40',
        },
    ];

    return (
        <section className="py-12 sm:py-16 bg-white border-b border-[#D9E0EA] font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header */}
                <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-[#111827] tracking-tight">
                        Explore the Seven Core Services
                    </h2>
                    <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-[#5B6472] leading-relaxed max-w-2xl mx-auto">
                        A unified platform designed for jobs, instant gig dispatch, vocational upskilling, and verified professional hiring.
                    </p>
                </div>

                {/* Services Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {services.map((service) => {
                        return (
                            <div
                                key={service.number}
                                className={`group relative bg-white rounded-2xl border border-[#D9E0EA] p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 shadow-2xs hover:shadow-lg ${service.borderColor}`}
                            >
                                {/* Header: Number & Vector Icon */}
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <span className="text-sm font-mono font-bold tracking-wider text-slate-400">
                                            {service.number}
                                        </span>
                                        <div
                                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${service.iconBg}`}
                                        >
                                            {service.icon}
                                        </div>
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
                                        <ArrowRight
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
