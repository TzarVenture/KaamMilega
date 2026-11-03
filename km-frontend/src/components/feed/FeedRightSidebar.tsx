'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, MedalIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import AdSlot, { type AdPlacement } from '@/components/ads/AdSlot';
import { feedApi } from '@/lib/api/feed';
import type { TrendingTag } from './feedTypes';
import { compactNumber } from './feedUtils';

/**
 * Wide-screen column: what people are posting about, the expert programme, and an ad. The ad
 * stays in view while the column scrolls past.
 */
export default function FeedRightSidebar({ placement = 'feed_sidebar' }: { placement?: AdPlacement }) {
  return (
    <div className="flex h-full flex-col gap-4">
      <TrendingTopics />
      <ExpertCard />
      <div className="sticky top-20">
        <AdSlot placement={placement} />
      </div>
    </div>
  );
}

function TrendingTopics() {
  const t = useTranslations('feed');
  const locale = useLocale();
  const [tags, setTags] = useState<TrendingTag[] | null>(null);

  useEffect(() => {
    let live = true;
    feedApi
      .trending()
      .then((res) => live && setTags(res.tags))
      .catch(() => live && setTags([]));
    return () => {
      live = false;
    };
  }, []);

  if (tags === null) {
    return <div className="h-64 rounded-2xl border border-km-border bg-km-surface-card animate-shimmer" aria-hidden="true" />;
  }
  // Nothing to show until people start using hashtags
  if (tags.length === 0) return null;

  return (
    <section aria-labelledby="trending-title" className="rounded-2xl border border-km-border bg-km-surface-card py-4 shadow-xs">
      <h2 id="trending-title" className="px-5 text-[15px] font-semibold text-km-heading">{t('trendingTitle')}</h2>
      <p className="px-5 text-[13px] text-km-text-secondary">{t('trendingSubtitle')}</p>
      <ol className="mt-2">
        {tags.map(({ tag, posts }) => (
          <li key={tag}>
            <Link href={`/feed?tag=${encodeURIComponent(tag)}`} className="block px-5 py-2 hover:bg-km-surface focus-visible:bg-km-surface">
              <span className="block truncate text-sm font-semibold text-km-heading">#{tag}</span>
              <span className="block text-[13px] text-km-text-secondary">{t('trendingPosts', { count: posts, formatted: compactNumber(posts, locale) })}</span>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}

function ExpertCard() {
  const t = useTranslations('feed');
  return (
    <section className="rounded-2xl bg-[#071A4D] p-5 text-white dark:bg-km-primary">
      <p className="flex items-center gap-2 text-[13px] font-semibold text-[#C4B5FD]">
        <MedalIcon size={16} aria-hidden="true" />
        {t('expertEyebrow')}
      </p>
      <h2 className="mt-2 text-base font-semibold leading-snug">{t('expertTitle')}</h2>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-300">{t('expertBody')}</p>
      <Link href="/expert/apply" className="btn-accent mt-4 inline-flex h-10 items-center gap-1.5 px-4 text-sm">
        {t('expertCta')}
        <ArrowRightIcon size={14} weight="bold" aria-hidden="true" />
      </Link>
    </section>
  );
}
