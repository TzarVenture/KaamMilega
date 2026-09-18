'use client';

import React from 'react';
import Link from 'next/link';
import {
    Briefcase,
    Zap,
    GraduationCap,
    UserCheck,
    Wrench,
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
    tagColor: string;
    iconColor: string;
    iconBg: string;
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
            tagColor: 'text-blue-700 bg-blue-50 border-blue-100',
            iconColor: 'text-blue-600',
            iconBg: 'bg-blue-50/80',
        },
        {
            number: '02',
            title: 'Instant / Hourly Work',
            description: 'Hyperlocal 15-minute gig dispatch for certified technicians with daily wallet payouts.',
            actionLabel: 'Find Instant Gigs',
            href: '/jobs?type=instant',
            providerLabel: 'Book Staff',
            providerHref: '/jobs?type=instant&mode=hire',
            icon: <Zap size={24} />,
            tagColor: 'text-amber-700 bg-amber-50 border-amber-100',
            iconColor: 'text-amber-600',
            iconBg: 'bg-amber-50/80',
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
            tagColor: 'text-emerald-700 bg-emerald-50 border-emerald-100',
            iconColor: 'text-emerald-600',
            iconBg: 'bg-emerald-50/80',
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
            tagColor: 'text-sky-700 bg-sky-50 border-sky-100',
            iconColor: 'text-sky-600',
            iconBg: 'bg-sky-50/80',
        },
        {
            number: '05',
            title: 'Services Marketplace',
            description: 'Fixed-price trade contracts and freelance services backed by milestone escrow protection.',
            actionLabel: 'Explore Services',
            href: '/jobs?type=service',
            providerLabel: 'List Service',
            providerHref: '/jobs/create',
            icon: <Wrench size={24} />,
            tagColor: 'text-rose-700 bg-rose-50 border-rose-100',
            iconColor: 'text-rose-600',
            iconBg: 'bg-rose-50/80',
        },
        {
            number: '06',
            title: 'Peer-to-Peer Network',
            description: 'Connect directly with verified professionals across trades, share referrals, and grow reputation.',
            actionLabel: 'Join Network',
            href: '/network',
            providerLabel: 'Create Post',
            providerHref: '/network',
            icon: <Users size={24} />,
            tagColor: 'text-indigo-700 bg-indigo-50 border-indigo-100',
            iconColor: 'text-indigo-600',
            iconBg: 'bg-indigo-50/80',
        },
        {
            number: '07',
            title: 'Events & Job Fairs',
            description: 'Attend physical mega hiring drives, vocational workshops, and virtual recruitment webinars.',
            actionLabel: 'View Events',
            href: '/events',
            providerLabel: 'Host Drive',
            providerHref: '/events',
            icon: <Calendar size={24} />,
            tagColor: 'text-orange-700 bg-orange-50 border-orange-100',
            iconColor: 'text-orange-600',
            iconBg: 'bg-orange-50/80',
        },
    ];

    return (
        <section className="py-12 sm:py-16 bg-white border-b border-slate-200/80 font-sans">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Section Header - Centered, Authoritative, High Readability */}
                <div className="max-w-3xl mx-auto text-center mb-10 sm:mb-12">
                    <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                        Explore the Seven Core Services
                    </h2>
                    <p className="mt-2.5 sm:mt-3 text-sm sm:text-base text-slate-600 leading-relaxed max-w-2xl mx-auto">
                        A unified platform designed for jobs, instant gig dispatch, vocational upskilling, and verified professional hiring.
                    </p>
                </div>

                {/* Services Cards - Clean, High Contrast, Enhanced Readability */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {services.map((service) => {
                        return (
                            <div
                                key={service.number}
                                className="group relative bg-white rounded-2xl border border-slate-200/90 p-6 sm:p-7 flex flex-col justify-between transition-all duration-200 shadow-xs hover:shadow-lg hover:border-blue-500/40"
                            >
                                {/* Header: Number & Vector Icon */}
                                <div>
                                    <div className="flex items-center justify-between mb-6">
                                        <span className="text-sm font-mono font-bold tracking-wider text-slate-400">
                                            {service.number}
                                        </span>
                                        <div
                                            className={`w-12 h-12 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105 ${service.iconBg} ${service.iconColor}`}
                                        >
                                            {service.icon}
                                        </div>
                                    </div>

                                    {/* Service Title */}
                                    <h3 className="text-lg sm:text-xl font-bold text-slate-900 group-hover:text-km-primary transition-colors mb-3 leading-snug">
                                        {service.title}
                                    </h3>

                                    {/* Description - High contrast & readable size */}
                                    <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed">
                                        {service.description}
                                    </p>
                                </div>

                                {/* Footer Links */}
                                <div className="mt-8 pt-5 border-t border-slate-100 flex items-center justify-between">
                                    <Link
                                        href={service.href}
                                        className="inline-flex items-center gap-1.5 text-sm font-bold text-km-primary group-hover:text-km-primary-dark transition-colors"
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
