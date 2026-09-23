'use client';

import React, { useEffect, useRef } from 'react';
import api from './axios';

// In-memory set of unique items seen in this browser session
const seenEntities = new Set<string>();

// Buffer of author IDs waiting to be dispatched in the next batch
let impressionBuffer: string[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

function getCurrentUserId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        const stored = localStorage.getItem('user');
        if (!stored) return null;
        const parsed = JSON.parse(stored);
        return parsed?.id || parsed?._id || null;
    } catch {
        return null;
    }
}

function hasAuthToken(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        return Boolean(localStorage.getItem('token'));
    } catch {
        return false;
    }
}

/**
 * Flushes pending buffered impressions to the backend.
 * Protected by authentication check to prevent unwanted 401s.
 */
export async function flushImpressions(): Promise<void> {
    if (impressionBuffer.length === 0 || !hasAuthToken()) {
        impressionBuffer = [];
        return;
    }

    const batch = [...impressionBuffer];
    impressionBuffer = [];

    if (flushTimeout) {
        clearTimeout(flushTimeout);
        flushTimeout = null;
    }

    try {
        // Deduplicate within the batch payload
        const uniqueAuthorIds = Array.from(new Set(batch));
        if (uniqueAuthorIds.length === 0) return;

        await api.post('/user/impressions', {
            author_ids: uniqueAuthorIds
        });
    } catch {
        // Telemetry errors must always fail silently without disrupting the UI
    }
}

/**
 * Records an impression for a given author and entity.
 * Deduplicates per session and excludes self-impressions.
 */
export function recordImpression(authorId?: string, entityId?: string): void {
    if (!authorId || typeof window === 'undefined' || !hasAuthToken()) {
        return;
    }

    const currentUserId = getCurrentUserId();
    if (currentUserId && currentUserId === authorId) {
        // Exclude author's self-impressions
        return;
    }

    const dedupeKey = entityId ? `${authorId}:${entityId}` : authorId;
    if (seenEntities.has(dedupeKey)) {
        return;
    }

    seenEntities.add(dedupeKey);
    impressionBuffer.push(authorId);

    // If buffer reaches threshold (15), flush immediately
    if (impressionBuffer.length >= 15) {
        void flushImpressions();
        return;
    }

    // Otherwise, schedule debounced batch flush in 5 seconds
    if (!flushTimeout) {
        flushTimeout = setTimeout(() => {
            void flushImpressions();
        }, 5000);
    }
}

// Safely flush when the user leaves or switches tabs
if (typeof window !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && impressionBuffer.length > 0) {
            void flushImpressions();
        }
    });

    window.addEventListener('beforeunload', () => {
        if (impressionBuffer.length > 0) {
            void flushImpressions();
        }
    });
}

/**
 * Reusable hook that observes an element in the viewport.
 * Triggers an impression when the element is at least 50% visible for >= 800ms.
 */
export function useImpressionBeacon<T extends HTMLElement = HTMLDivElement>(
    authorId?: string,
    entityId?: string
) {
    const elementRef = useRef<T | null>(null);

    useEffect(() => {
        if (!authorId || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
            return;
        }

        const el = elementRef.current;
        if (!el) return;

        let dwellTimer: NodeJS.Timeout | null = null;

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0];
                if (entry && entry.isIntersecting && entry.intersectionRatio >= 0.5) {
                    dwellTimer = setTimeout(() => {
                        recordImpression(authorId, entityId);
                    }, 800);
                } else {
                    if (dwellTimer) {
                        clearTimeout(dwellTimer);
                        dwellTimer = null;
                    }
                }
            },
            {
                threshold: 0.5
            }
        );

        observer.observe(el);

        return () => {
            if (dwellTimer) {
                clearTimeout(dwellTimer);
            }
            observer.disconnect();
        };
    }, [authorId, entityId]);

    return elementRef;
}

/**
 * Declarative component wrapper for tracking feed and card impressions.
 */
export const ImpressionWrapper: React.FC<{
    authorId?: string;
    entityId?: string;
    className?: string;
    children: React.ReactNode;
}> = ({ authorId, entityId, className, children }) => {
    const ref = useImpressionBeacon<HTMLDivElement>(authorId, entityId);

    return (
        <div ref={ref} className={className}>
            {children}
        </div>
    );
};
