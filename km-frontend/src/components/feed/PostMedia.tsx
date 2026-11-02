'use client';

import React, { useEffect, useRef, useState } from 'react';
import { CaretLeftIcon, CaretRightIcon, XIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import type { FeedMedia } from './feedTypes';
import { useScrollLock } from './feedUtils';

/** A single photo keeps its shape between tall (4:5) and wide (1.91:1), like other feeds */
function singleRatio(m: FeedMedia): number {
  if (!m.width || !m.height) return 4 / 3;
  return Math.min(1.91, Math.max(0.8, m.width / m.height));
}

/** Photos on a post: one at its own shape, two side by side, three as one large and two small, four in a square grid */
export default function PostMedia({ media, authorName }: { media: FeedMedia[]; authorName: string }) {
  const t = useTranslations('feed');
  const [open, setOpen] = useState<number | null>(null);
  if (media.length === 0) return null;

  const tile = (m: FeedMedia, i: number, className: string, style?: React.CSSProperties) => (
    <button
      key={m.url}
      type="button"
      onClick={() => setOpen(i)}
      className={`relative block overflow-hidden bg-km-surface cursor-zoom-in focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-km-link ${className}`}
      style={style}
      aria-label={t('openPhoto', { index: i + 1, total: media.length })}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={m.url}
        alt={t('photoBy', { name: authorName })}
        loading="lazy"
        decoding="async"
        width={m.width}
        height={m.height}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </button>
  );

  let grid: React.ReactNode;
  if (media.length === 1) {
    grid = tile(media[0], 0, 'w-full', { aspectRatio: String(singleRatio(media[0])) });
  } else if (media.length === 2) {
    grid = <div className="grid grid-cols-2 gap-0.5">{media.map((m, i) => tile(m, i, 'aspect-square'))}</div>;
  } else if (media.length === 3) {
    grid = (
      <div className="grid grid-cols-3 grid-rows-2 gap-0.5 aspect-[3/2]">
        {tile(media[0], 0, 'col-span-2 row-span-2 h-full')}
        {tile(media[1], 1, 'h-full')}
        {tile(media[2], 2, 'h-full')}
      </div>
    );
  } else {
    grid = <div className="grid grid-cols-2 gap-0.5">{media.slice(0, 4).map((m, i) => tile(m, i, 'aspect-square'))}</div>;
  }

  return (
    <>
      <div className="border-y border-km-border">{grid}</div>
      {open !== null && <PhotoViewer media={media} start={open} authorName={authorName} onClose={() => setOpen(null)} />}
    </>
  );
}

function PhotoViewer({ media, start, authorName, onClose }: { media: FeedMedia[]; start: number; authorName: string; onClose: () => void }) {
  const t = useTranslations('feed');
  const [index, setIndex] = useState(start);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const many = media.length > 1;
  useScrollLock(true);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(media.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.({ preventScroll: true });
    };
  }, [media.length, onClose]);

  const nav = 'absolute top-1/2 -translate-y-1/2 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 disabled:opacity-0 cursor-pointer';
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('photoBy', { name: authorName })}
      className="fixed inset-0 z-[70] bg-black flex items-center justify-center"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        touchX.current = null;
        if (dx < -50) setIndex((i) => Math.min(media.length - 1, i + 1));
        if (dx > 50) setIndex((i) => Math.max(0, i - 1));
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={media[index].url} alt={t('photoBy', { name: authorName })} className="max-h-full max-w-full object-contain select-none" />
      <button ref={closeRef} type="button" onClick={onClose} aria-label={t('close')} className="absolute top-3 right-3 p-3 rounded-full bg-black/60 text-white hover:bg-black/80 cursor-pointer">
        <XIcon size={22} />
      </button>
      {many && (
        <>
          <button type="button" onClick={() => setIndex(index - 1)} disabled={index === 0} aria-label={t('previousPhoto')} className={`${nav} left-3`}>
            <CaretLeftIcon size={22} weight="bold" />
          </button>
          <button type="button" onClick={() => setIndex(index + 1)} disabled={index === media.length - 1} aria-label={t('nextPhoto')} className={`${nav} right-3`}>
            <CaretRightIcon size={22} weight="bold" />
          </button>
          <p className="absolute bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 -translate-x-1/2 text-sm text-white/80 tabular-nums">
            {index + 1} / {media.length}
          </p>
        </>
      )}
    </div>
  );
}
