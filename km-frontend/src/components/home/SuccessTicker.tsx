'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { BriefcaseIcon, BuildingOfficeIcon, CheckCircleIcon, LightningIcon, MapPinIcon, UserPlusIcon, XIcon } from '@phosphor-icons/react';
import type { Icon } from '@phosphor-icons/react';
import api from '@/lib/axios';

/**
 * Social-proof strip under the hero: a slow, continuous row of recent hiring outcomes and platform
 * activity ("Priya S. got an interview · Store Executive, Mumbai"). Success stories open a detail card.
 */

export interface TickerUpdate {
    id: string;
    name: string;
    status: string;
    role: string;
    company: string;
    city: string;
    quote?: string;
}

type Tone = 'jobs' | 'success' | 'instant' | 'network';

interface TickerItem {
    id: string;
    tone: Tone;
    person?: string;
    action: string;
    context: string;
    story?: TickerUpdate;
}

interface SuccessTickerProps {
    updates?: TickerUpdate[];
}

// Service colours from design.md §3
const TONE_STYLE: Record<Tone, { Icon: Icon; text: string }> = {
    jobs: { Icon: BriefcaseIcon, text: 'text-km-heading' },
    success: { Icon: CheckCircleIcon, text: 'text-km-heading' },
    instant: { Icon: LightningIcon, text: 'text-km-heading' },
    network: { Icon: UserPlusIcon, text: 'text-km-heading' },
};

const defaultUpdates: TickerUpdate[] = [
    {
        id: 's1',
        name: 'Dharmender K.',
        status: 'interview',
        role: 'Warehouse Executive',
        company: 'Technova Logistics',
        city: 'Bhiwandi',
        quote: 'Scheduled a direct interview with HR within 2 hours of applying.',
    },
    {
        id: 's2',
        name: 'Roshan Y.',
        status: 'selected',
        role: 'Shift Supervisor',
        company: 'Reliance Supply Chain',
        city: 'Surat',
        quote: 'Got a call directly from the hiring manager and accepted the offer.',
    },
    {
        id: 's3',
        name: 'Priya S.',
        status: 'interview',
        role: 'Store Executive',
        company: 'Tata Croma',
        city: 'Mumbai',
        quote: 'Direct HR chat helped me schedule my interview for the next morning.',
    },
    {
        id: 's4',
        name: 'Sachin S.',
        status: 'selected',
        role: 'Commercial Driver',
        company: 'City Fleet Transport',
        city: 'Surat',
        quote: 'Found a verified driving job with daily payouts.',
    },
    {
        id: 's5',
        name: 'Raju Y.',
        status: 'gig',
        role: 'Electrician',
        company: 'Instant Milega',
        city: 'Delhi NCR',
        quote: 'Received a repair gig 15 minutes after going online.',
    },
];

function storyToItem(story: TickerUpdate): TickerItem {
    const s = story.status.toLowerCase();
    const tone: Tone = s.includes('gig') || s.includes('instant') ? 'instant' : s.includes('select') ? 'success' : 'jobs';
    const action = tone === 'instant' ? 'completed an Instant Milega gig' : tone === 'success' ? 'got selected' : 'got an interview';
    return { id: story.id, tone, person: story.name, action, context: `${story.role}, ${story.city}`, story };
}

// Interview "location" can be a meeting link; backend fills unknown values with placeholders
const isLinkLike = (v?: string) => !!v && (/^https?:/i.test(v) || /^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(v.trim()));
const PLACEHOLDER_VALUES = new Set(['General Trade', 'India']);
const realValue = (v?: string) => (v && !PLACEHOLDER_VALUES.has(v) ? v : undefined);

function liveEventToItem(ev: any, idx: number): TickerItem | null {
    const id = `live-${ev?.id || idx}`;
    switch (ev?.type) {
        case 'interview':
            return {
                id,
                tone: 'jobs',
                action: 'Interview scheduled with an employer',
                context: !ev.place || isLinkLike(ev.place) || ev.place === 'Online Video' ? 'Online interview' : ev.place,
            };
        case 'application':
            return { id, tone: 'jobs', action: 'New job application sent', context: 'Direct to the employer' };
        case 'member':
            return {
                id,
                tone: 'network',
                person: ev.person,
                action: 'joined KaamMilega',
                context: [realValue(ev.trade), realValue(ev.place)].filter(Boolean).join(', '),
            };
        default:
            return null;
    }
}

function TickerEntry({ item, onOpen }: { item: TickerItem; onOpen: (story: TickerUpdate) => void }) {
    const tone = TONE_STYLE[item.tone];
    const content = (
        <>
            <tone.Icon size={24} weight="duotone" className={`shrink-0 ${tone.text}`} aria-hidden="true" />
            <span className="flex flex-col text-left">
                <span className="text-sm text-km-text-primary leading-5">
                    {item.person && <span className="font-semibold">{item.person} </span>}
                    {item.action}
                </span>
                {item.context && <span className="text-xs text-km-text-secondary leading-4">{item.context}</span>}
            </span>
        </>
    );

    if (item.story) {
        const story = item.story;
        return (
            <button
                type="button"
                onClick={() => onOpen(story)}
                className="flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2 cursor-pointer hover:bg-km-surface focus-visible:outline-2 focus-visible:outline-[#0B5ED7]"
            >
                {content}
            </button>
        );
    }
    return <span className="flex items-center gap-3 py-1.5">{content}</span>;
}

export default function SuccessTicker({ updates }: SuccessTickerProps) {
    const [selectedStory, setSelectedStory] = useState<TickerUpdate | null>(null);
    const [liveItems, setLiveItems] = useState<TickerItem[]>([]);

    useEffect(() => {
        api.get('/platform/live-activity')
            .then((res: any) => {
                const events = Array.isArray(res?.events) ? res.events : [];
                setLiveItems(events.map(liveEventToItem).filter(Boolean) as TickerItem[]);
            })
            .catch(() => {});
    }, []);

    useEffect(() => {
        if (!selectedStory) return;
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSelectedStory(null);
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [selectedStory]);

    const stories = updates && updates.length > 0 ? updates : defaultUpdates;
    // Live events are often identical ("New job application sent"); show each distinct line once
    const seen = new Set<string>();
    const items = [...liveItems, ...stories.map(storyToItem)].filter((item) => {
        const key = `${item.tone}|${item.person ?? ''}|${item.action}|${item.context}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    // About 6s per entry keeps the reading speed the same however many entries there are
    const duration = `${Math.max(30, items.length * 6)}s`;

    return (
        <>
            <section aria-label="Recent activity on KaamMilega" className="bg-km-surface-card border-b border-km-border font-sans">
                <div className="max-w-7xl mx-auto flex items-center">
                    <p className="hidden md:block shrink-0 pl-6 lg:pl-12 pr-5 py-1 text-sm font-semibold text-km-heading border-r border-km-border">
                        Recent activity
                    </p>

                    <div className="relative flex-1 min-w-0 overflow-hidden py-2.5">

                        <ul className="animate-km-marquee" style={{ animationDuration: duration }}>
                            {[0, 1].map((copy) =>
                                items.map((item) => (
                                    // Second copy completes the seamless loop and is hidden from assistive tech
                                    <li
                                        key={`${copy}-${item.id}`}
                                        aria-hidden={copy === 1 || undefined}
                                        className="flex items-center shrink-0 pl-6"
                                    >
                                        <TickerEntry item={item} onOpen={setSelectedStory} />
                                        <span className="ml-6 h-8 w-px bg-[#D9E0EA]" aria-hidden="true" />
                                    </li>
                                ))
                            )}
                        </ul>
                    </div>
                </div>
            </section>

            {selectedStory && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#071A4D]/50"
                    onClick={() => setSelectedStory(null)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="ticker-story-title"
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md bg-km-surface-card rounded-2xl border border-km-border shadow-lg p-6 font-sans"
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedStory(null)}
                            aria-label="Close"
                            className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center text-km-text-secondary hover:bg-km-surface cursor-pointer"
                        >
                            <XIcon weight="bold" size={18} />
                        </button>

                        {(() => {
                            const item = storyToItem(selectedStory);
                            const tone = TONE_STYLE[item.tone];
                            return (
                                <div className="flex items-center gap-3 pr-8">
                                    <tone.Icon size={32} weight="duotone" className={`shrink-0 ${tone.text}`} aria-hidden="true" />
                                    <h3 id="ticker-story-title" className="text-lg font-semibold text-km-text-primary">
                                        {selectedStory.name} {item.action}
                                    </h3>
                                </div>
                            );
                        })()}

                        <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-4 text-sm text-km-text-secondary">
                            <span className="inline-flex items-center gap-1.5">
                                <BriefcaseIcon weight="bold" size={14} className="text-km-heading" />
                                {selectedStory.role}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <BuildingOfficeIcon weight="bold" size={14} className="text-km-heading" />
                                {selectedStory.company}
                            </span>
                            <span className="inline-flex items-center gap-1.5">
                                <MapPinIcon weight="bold" size={14} className="text-km-heading" />
                                {selectedStory.city}
                            </span>
                        </div>

                        {selectedStory.quote && (
                            <p className="mt-4 pt-4 border-t border-km-border text-sm text-km-text-primary leading-relaxed">
                                &ldquo;{selectedStory.quote}&rdquo;
                            </p>
                        )}

                        <div className="flex justify-end gap-2 mt-6">
                            <button
                                type="button"
                                onClick={() => setSelectedStory(null)}
                                className="px-4 py-2.5 text-sm font-semibold text-km-text-secondary rounded-xl hover:bg-km-surface cursor-pointer"
                            >
                                Close
                            </button>
                            <Link
                                href={`/jobs?q=${encodeURIComponent(selectedStory.role)}`}
                                onClick={() => setSelectedStory(null)}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#071A4D] hover:bg-[#0B1F52] rounded-xl"
                            >
                                View matching jobs
                            </Link>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
