'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { adsApi, type Ad, type AdPlacement } from '@/lib/api/ads';

export type { AdPlacement } from '@/lib/api/ads';

/**
 * A space for an ad run from the admin panel. It asks the ad server for an ad for its slot and
 * collapses when there is none. Side-column slots ("…_sidebar") show a boxed ad; slots in a list
 * ("…_inline") show a card shaped like the items around it. Every ad is labelled as sponsored.
 *
 * An impression is counted once half the ad has been on screen for a second (the industry's
 * viewable impression); the click goes through the ad server, which counts it and redirects.
 */
export default function AdSlot({ placement, className = '' }: { placement: AdPlacement; className?: string }) {
  const [ad, setAd] = useState<Ad | null>(null);

  useEffect(() => {
    let live = true;
    adsApi
      .serve(placement)
      .then((res) => live && setAd(res.ads?.[0] ?? null))
      .catch(() => live && setAd(null));
    return () => {
      live = false;
    };
  }, [placement]);

  if (!ad) return null;
  const inline = placement.endsWith('_inline');
  return <AdCard ad={ad} inline={inline} className={className} />;
}

const VIEWABLE_RATIO = 0.5;
const VIEWABLE_MS = 1000;

/** Reports the impression once half the element has been visible for a second */
function useViewableImpression(ref: React.RefObject<HTMLElement | null>, adId: string) {
  useEffect(() => {
    const el = ref.current;
    if (!adId || !el || typeof IntersectionObserver === 'undefined') return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (done) return;
        if (entry.intersectionRatio >= VIEWABLE_RATIO) {
          if (timer) return;
          timer = setTimeout(() => {
            if (document.visibilityState !== 'visible') {
              timer = null;
              return;
            }
            done = true;
            observer.disconnect();
            adsApi.impression(adId).catch(() => {});
          }, VIEWABLE_MS);
        } else if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      { threshold: [0, VIEWABLE_RATIO, 1] },
    );
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (timer) clearTimeout(timer);
    };
  }, [ref, adId]);
}

function Creative({ ad, className }: { ad: Ad; className: string }) {
  // Only rendered after the ad has loaded in the browser, so window is there
  const [reduceMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);

  if (ad.creative_type === 'video') {
    return (
      <video
        src={ad.creative_url}
        className={className}
        muted
        loop
        playsInline
        autoPlay={!reduceMotion}
        preload="metadata"
        aria-hidden="true"
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element -- ad creatives come from the CDN at their final size
  return <img src={ad.creative_url} alt="" className={className} loading="lazy" />;
}

/** How an ad will look, for the admin panel: nothing is counted and the card doesn't link anywhere */
export function AdPreview({ ad, inline, className = '' }: { ad: Ad; inline: boolean; className?: string }) {
  return <AdCard ad={ad} inline={inline} className={className} preview />;
}

function AdCard({ ad, inline, className, preview = false }: { ad: Ad; inline: boolean; className: string; preview?: boolean }) {
  const t = useTranslations('ads');
  const ref = useRef<HTMLElement>(null);
  useViewableImpression(ref, preview ? '' : ad.id);
  const cta = ad.cta_label || t('learnMore');
  const Wrapper = preview ? 'div' : 'a';
  const wrapperProps = preview ? {} : { href: adsApi.clickUrl(ad.id), target: '_blank', rel: 'sponsored noopener' };

  const label = (
    <p className="flex items-center gap-1.5 text-xs text-km-text-muted">
      <span>{t('sponsored')}</span>
      <span aria-hidden="true">·</span>
      <span className="truncate font-medium text-km-text-secondary">{ad.advertiser}</span>
    </p>
  );

  return (
    <aside ref={ref} aria-label={t('label')} data-ad-id={preview ? undefined : ad.id} className={className}>
      <Wrapper
        {...wrapperProps}
        className={`group block overflow-hidden rounded-2xl border border-km-border bg-km-surface-card shadow-xs transition-colors hover:border-km-blue/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-km-blue ${
          inline ? 'sm:flex sm:items-stretch' : ''
        }`}
      >
        {inline ? (
          <>
            <Creative ad={ad} className="aspect-[1.91/1] w-full bg-km-surface object-cover sm:w-56 sm:shrink-0" />
            <div className="flex min-w-0 flex-1 flex-col p-4">
              {label}
              <p className="mt-1 text-[15px] font-semibold leading-snug text-km-heading line-clamp-2">{ad.headline}</p>
              {ad.body && <p className="mt-1 text-sm text-km-text-secondary line-clamp-2">{ad.body}</p>}
              <div className="mt-auto flex items-center justify-between gap-3 pt-3">
                <span className="truncate text-xs text-km-text-muted">{ad.domain}</span>
                <span className="inline-flex h-9 shrink-0 items-center rounded-xl border border-km-border px-3.5 text-sm font-semibold text-km-link group-hover:bg-km-surface">
                  {cta}
                </span>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="px-4 pt-3 pb-2">{label}</div>
            <Creative ad={ad} className="aspect-[1.91/1] w-full bg-km-surface object-cover" />
            <div className="p-4">
              <p className="text-[15px] font-semibold leading-snug text-km-heading line-clamp-2">{ad.headline}</p>
              {ad.body && <p className="mt-1 text-sm text-km-text-secondary line-clamp-2">{ad.body}</p>}
              <span className="mt-3 flex h-9 w-full items-center justify-center rounded-xl border border-km-border text-sm font-semibold text-km-link group-hover:bg-km-surface">
                {cta}
              </span>
              <span className="mt-2 block truncate text-center text-xs text-km-text-muted">{ad.domain}</span>
            </div>
          </>
        )}
      </Wrapper>
    </aside>
  );
}
