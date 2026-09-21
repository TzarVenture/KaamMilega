'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';

interface InteractiveScrollbarProps {
    scrollRef: React.RefObject<HTMLDivElement | null>;
    className?: string;
    trackClassName?: string;
}

export const InteractiveScrollbar: React.FC<InteractiveScrollbarProps> = ({
    scrollRef,
    className = 'max-w-4xl mx-auto mt-3 px-4 sm:px-0',
    trackClassName = '',
}) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const [thumbWidthPct, setThumbWidthPct] = useState(25);
    const [thumbLeftPct, setThumbLeftPct] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [canScroll, setCanScroll] = useState(false);
    const dragStartXRef = useRef(0);
    const dragStartScrollLeftRef = useRef(0);

    const updateScrollMetrics = useCallback(() => {
        const el = scrollRef.current;
        if (!el) return;

        const { scrollLeft, scrollWidth, clientWidth } = el;
        const maxScroll = scrollWidth - clientWidth;

        if (maxScroll <= 5) {
            setCanScroll(false);
            return;
        }

        setCanScroll(true);

        // Proportional thumb width (clamped between 15% and 35%)
        const visibleRatio = clientWidth / (scrollWidth || 1);
        const widthPct = Math.max(15, Math.min(35, visibleRatio * 100));
        setThumbWidthPct(widthPct);

        const progress = Math.max(0, Math.min(1, scrollLeft / maxScroll));
        const maxTravelPct = 100 - widthPct;
        setThumbLeftPct(progress * maxTravelPct);
    }, [scrollRef]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;

        updateScrollMetrics();
        el.addEventListener('scroll', updateScrollMetrics, { passive: true });
        window.addEventListener('resize', updateScrollMetrics);

        let resizeObserver: ResizeObserver | null = null;
        if (typeof ResizeObserver !== 'undefined') {
            resizeObserver = new ResizeObserver(() => {
                updateScrollMetrics();
            });
            resizeObserver.observe(el);
            if (el.firstElementChild) {
                resizeObserver.observe(el.firstElementChild);
            }
        }

        return () => {
            el.removeEventListener('scroll', updateScrollMetrics);
            window.removeEventListener('resize', updateScrollMetrics);
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }, [scrollRef, updateScrollMetrics]);

    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
        const track = trackRef.current;
        const container = scrollRef.current;
        if (!track || !container) return;

        e.currentTarget.setPointerCapture(e.pointerId);
        setIsDragging(true);

        const trackRect = track.getBoundingClientRect();
        const clickX = e.clientX - trackRect.left;
        const trackWidth = trackRect.width;
        const thumbPx = (thumbWidthPct / 100) * trackWidth;

        const maxThumbTravelPx = trackWidth - thumbPx;
        const desiredThumbLeftPx = clickX - thumbPx / 2;
        const ratio = maxThumbTravelPx > 0 ? Math.max(0, Math.min(1, desiredThumbLeftPx / maxThumbTravelPx)) : 0;

        const maxScroll = container.scrollWidth - container.clientWidth;
        container.scrollLeft = ratio * maxScroll;

        dragStartXRef.current = e.clientX;
        dragStartScrollLeftRef.current = container.scrollLeft;
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
        if (!isDragging) return;
        const track = trackRef.current;
        const container = scrollRef.current;
        if (!track || !container) return;

        const trackRect = track.getBoundingClientRect();
        const deltaX = e.clientX - dragStartXRef.current;
        const trackWidth = trackRect.width;
        const thumbPx = (thumbWidthPct / 100) * trackWidth;
        const maxThumbTravelPx = trackWidth - thumbPx;

        if (maxThumbTravelPx <= 0) return;

        const maxScroll = container.scrollWidth - container.clientWidth;
        const scrollDelta = (deltaX / maxThumbTravelPx) * maxScroll;
        container.scrollLeft = Math.max(0, Math.min(maxScroll, dragStartScrollLeftRef.current + scrollDelta));
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
        if (isDragging) {
            try {
                e.currentTarget.releasePointerCapture(e.pointerId);
            } catch (err) {}
            setIsDragging(false);
        }
    };

    if (!canScroll) return null;

    return (
        <div className={`w-full ${className}`}>
            <div
                ref={trackRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
                className={`group relative py-2 -my-2 cursor-pointer touch-none select-none ${trackClassName}`}
                role="scrollbar"
                aria-valuenow={Math.round((thumbLeftPct / (100 - thumbWidthPct || 1)) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                tabIndex={0}
            >
                {/* Visual Track */}
                <div className="h-1.5 w-full bg-slate-200/90 group-hover:bg-slate-300/80 rounded-full overflow-hidden transition-colors relative">
                    {/* Visual Thumb */}
                    <div
                        className={`h-full bg-km-primary rounded-full absolute top-0 transition-colors duration-150 ${
                            isDragging ? 'bg-km-primary-dark cursor-grabbing' : 'hover:bg-km-primary-dark cursor-grab'
                        }`}
                        style={{
                            width: `${thumbWidthPct}%`,
                            left: `${thumbLeftPct}%`,
                            willChange: 'left',
                        }}
                    />
                </div>
            </div>
        </div>
    );
};

export default InteractiveScrollbar;
