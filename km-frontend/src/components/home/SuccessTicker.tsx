'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { BriefcaseIcon, UserPlusIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import api from '@/lib/axios';

/**
 * Activity strip under the hero: a slow, continuous row of real platform activity from
 * GET /platform/live-activity (interviews scheduled, applications sent, members joining).
 * Hidden when there is none; it never shows invented stories.
 */

type Tone = 'jobs' | 'network';

interface TickerItem {
    id: string;
    tone: Tone;
    text: string;
    context: string;
}

const TONE_ICON: Record<Tone, Icon> = {
    jobs: BriefcaseIcon,
    network: UserPlusIcon,
};

// Interview "location" can be a meeting link; backend fills unknown values with placeholders
const isLinkLike = (v?: string) => !!v && (/^https?:/i.test(v) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v.trim()));
const PLACEHOLDER_VALUES = new Set(['General Trade', 'India']);
const realValue = (v?: string) => (v && !PLACEHOLDER_VALUES.has(v) ? v : undefined);

interface LiveEvent {
    id?: string;
    type?: string;
    place?: string;
    person?: string;
    trade?: string;
}

export default function SuccessTicker() {
    const t = useTranslations('home.ticker');
    const [events, setEvents] = useState<LiveEvent[]>([]);

    useEffect(() => {
        api.get('/platform/live-activity')
            .then((res: unknown) => {
                const list = (res as { events?: unknown } | null)?.events;
                setEvents(Array.isArray(list) ? (list as LiveEvent[]) : []);
            })
            .catch(() => {});
    }, []);

    const toItem = (ev: LiveEvent, idx: number): TickerItem | null => {
        const id = `live-${ev.id || idx}`;
        switch (ev.type) {
            case 'interview':
                return {
                    id,
                    tone: 'jobs',
                    text: t('interview'),
                    context: !ev.place || isLinkLike(ev.place) || ev.place === 'Online Video' ? t('onlineInterview') : ev.place,
                };
            case 'application':
                return { id, tone: 'jobs', text: t('application'), context: t('direct') };
            case 'member':
                return {
                    id,
                    tone: 'network',
                    text: ev.person ? t('joined', { name: ev.person }) : t('joinedAnonymous'),
                    context: [realValue(ev.trade), realValue(ev.place)].filter(Boolean).join(', '),
                };
            default:
                return null;
        }
    };

    // Live events are often identical ("New job application sent"); show each distinct line once
    const seen = new Set<string>();
    const items = events
        .map(toItem)
        .filter((item): item is TickerItem => {
            if (!item) return false;
            const key = `${item.tone}|${item.text}|${item.context}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

    if (items.length === 0) return null;

    // About 6s per entry keeps the reading speed the same however many entries there are
    const duration = `${Math.max(30, items.length * 6)}s`;

    return (
        <section aria-label={t('region')} className="bg-km-surface-card border-b border-km-border font-sans">
            <div className="max-w-7xl mx-auto flex items-center">
                <p className="hidden md:block shrink-0 pl-6 lg:pl-12 pr-5 py-1 text-sm font-semibold text-km-heading border-r border-km-border">
                    {t('label')}
                </p>

                <div className="relative flex-1 min-w-0 overflow-hidden py-2.5">
                    <ul className="animate-km-marquee" style={{ animationDuration: duration }}>
                        {[0, 1].map((copy) =>
                            items.map((item) => {
                                const ToneIcon = TONE_ICON[item.tone];
                                return (
                                    // Second copy completes the seamless loop and is hidden from assistive tech
                                    <li
                                        key={`${copy}-${item.id}`}
                                        aria-hidden={copy === 1 || undefined}
                                        className="flex items-center shrink-0 pl-6"
                                    >
                                        <span className="flex items-center gap-3 py-1.5">
                                            <ToneIcon size={24} weight="duotone" className="shrink-0 text-km-heading" aria-hidden="true" />
                                            <span className="flex flex-col text-left">
                                                <span className="text-sm text-km-text-primary leading-5">{item.text}</span>
                                                {item.context && <span className="text-xs text-km-text-secondary leading-4">{item.context}</span>}
                                            </span>
                                        </span>
                                        <span className="ml-6 h-8 w-px bg-[#D9E0EA] dark:bg-[#293147]" aria-hidden="true" />
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>
            </div>
        </section>
    );
}
