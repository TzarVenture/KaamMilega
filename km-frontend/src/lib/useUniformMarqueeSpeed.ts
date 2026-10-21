'use client';

import { useEffect } from 'react';

const MARQUEE_SELECTOR = '.animate-km-marquee, .animate-km-marquee-reverse';

/**
 * Gives every auto-scrolling row on the page the same speed (pixels per second), whatever its length.
 * Rows duplicate their items and translate by 50%, so one loop covers half of the track's width.
 * Recomputes when rows are added (data loads) or resized (images, viewport).
 */
export function useUniformMarqueeSpeed(pxPerSecond = 40) {
    useEffect(() => {
        const sizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const el = entry.target as HTMLElement;
                const loopWidth = el.scrollWidth / 2;
                if (loopWidth > 0) el.style.animationDuration = `${Math.round(loopWidth / pxPerSecond)}s`;
            }
        });

        const observed = new Set<Element>();
        const attach = () => {
            document.querySelectorAll(MARQUEE_SELECTOR).forEach((el) => {
                if (!observed.has(el)) {
                    observed.add(el);
                    sizeObserver.observe(el);
                }
            });
        };

        attach();
        const domObserver = new MutationObserver(attach);
        domObserver.observe(document.body, { childList: true, subtree: true });

        return () => {
            domObserver.disconnect();
            sizeObserver.disconnect();
        };
    }, [pxPerSecond]);
}
