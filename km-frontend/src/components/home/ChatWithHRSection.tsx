'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowRightIcon, CheckIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';

/** Home section promoting direct chat with the people who hire */
export default function ChatWithHRSection() {
    const t = useTranslations('home.chatHr');
    const points = [t('point1'), t('point2'), t('point3')];

    return (
        <section className="py-8 sm:py-10 lg:py-12" aria-labelledby="chat-hr-title">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="grid items-center gap-8 rounded-3xl border border-km-border bg-km-surface-card px-6 py-8 sm:px-10 sm:py-10 lg:grid-cols-2 lg:gap-12">
                    <div>
                        <h2 id="chat-hr-title" className="text-2xl sm:text-[28px] lg:text-[32px] font-bold tracking-[-0.02em] leading-tight text-km-heading">
                            {t('title')}
                        </h2>
                        <p className="mt-2 text-base text-km-text-secondary">{t('text')}</p>
                        <ul className="mt-5 space-y-2.5">
                            {points.map((point) => (
                                <li key={point} className="flex items-start gap-2.5 text-[15px] text-km-text-primary">
                                    <CheckIcon weight="bold" size={18} className="mt-0.5 shrink-0 text-km-link" aria-hidden="true" />
                                    {point}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                            <Link href="/jobs" className="km-press inline-flex items-center justify-center gap-2 rounded-xl bg-km-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-km-primary-dark">
                                {t('findJobs')}
                                <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
                            </Link>
                            <Link href="/chat" className="km-press inline-flex items-center justify-center rounded-xl border border-km-border px-6 py-3 text-sm font-semibold text-km-heading transition-colors hover:bg-km-surface">
                                {t('openChats')}
                            </Link>
                        </div>
                    </div>

                    {/* A sample conversation */}
                    <div className="rounded-2xl border border-km-border bg-km-surface p-4 sm:p-5" aria-hidden="true">
                        <div className="mb-4 border-b border-km-border pb-3">
                            <p className="text-sm font-semibold text-km-heading">{t('sampleName')}</p>
                            <p className="text-xs text-km-text-secondary">{t('sampleRole')}</p>
                        </div>
                        <div className="space-y-3 text-sm">
                            <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-km-primary px-4 py-2.5 text-white">{t('sample1')}</p>
                            <p className="max-w-[85%] rounded-2xl rounded-bl-md border border-km-border bg-km-surface-card px-4 py-2.5 text-km-text-primary">{t('sample2')}</p>
                            <p className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-km-primary px-4 py-2.5 text-white">{t('sample3')}</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}
