'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

/** Where on the site an ad shows, so ads run from the admin panel can target a slot */
export type AdPlacement = 'feed_sidebar' | 'post_sidebar';

/**
 * A space for an ad run from the admin panel. Until ads are served it holds a labelled
 * placeholder at the standard 300 × 250 shape, so pages don't shift once ads arrive.
 */
export default function AdSlot({ placement, className = '' }: { placement: AdPlacement; className?: string }) {
  const t = useTranslations('ads');
  return (
    <aside
      aria-label={t('label')}
      data-ad-placement={placement}
      className={`flex aspect-[6/5] w-full items-center justify-center rounded-2xl border border-dashed border-km-border bg-km-surface-card text-sm font-medium text-km-text-muted ${className}`}
    >
      {t('placeholder')}
    </aside>
  );
}
