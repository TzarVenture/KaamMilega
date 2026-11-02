'use client';

import React from 'react';
import { XIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { POST_CATEGORIES, type FeedView, type PostCategory } from './feedTypes';

interface FeedHeaderFiltersProps {
  view: FeedView;
  category?: PostCategory;
  tag?: string;
  signedIn: boolean;
  onView: (v: FeedView) => void;
  onCategory: (c?: PostCategory) => void;
  onClearTag: () => void;
}

const chip = (active: boolean) =>
  `shrink-0 h-9 px-4 rounded-full border text-sm font-semibold transition-colors cursor-pointer ${
    active
      ? 'bg-[#071A4D] border-[#071A4D] text-white dark:bg-km-primary dark:border-km-primary'
      : 'bg-km-surface-card border-km-border text-km-text-secondary hover:text-km-heading hover:bg-km-surface'
  }`;

/** Phones get the Feed / Saved / My posts switch here (wider screens have it in the profile column); everyone gets the topic chips */
export default function FeedHeaderFilters({ view, category, tag, signedIn, onView, onCategory, onClearTag }: FeedHeaderFiltersProps) {
  const t = useTranslations('feed');
  return (
    <div className="space-y-3">
      {signedIn && (
        <div role="tablist" aria-label={t('views')} className="md:hidden grid grid-cols-3 rounded-xl border border-km-border bg-km-surface-card p-1">
          {(['all', 'saved', 'mine'] as FeedView[]).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => onView(v)}
              className={`h-9 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${
                view === v ? 'bg-km-surface text-km-heading' : 'text-km-text-secondary hover:text-km-heading'
              }`}
            >
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
      )}

      {view === 'all' && (
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t('topics')}>
          <button type="button" aria-pressed={!category} onClick={() => onCategory(undefined)} className={chip(!category)}>
            {t('category.all')}
          </button>
          {POST_CATEGORIES.map((c) => (
            <button key={c} type="button" aria-pressed={category === c} onClick={() => onCategory(c)} className={chip(category === c)}>
              {t(`category.${c}`)}
            </button>
          ))}
        </div>
      )}

      {tag && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-km-border bg-km-surface-card px-4 py-2.5">
          <p className="text-sm text-km-text-secondary">
            {t('showingTag')} <span className="font-semibold text-km-heading">#{tag}</span>
          </p>
          <button type="button" onClick={onClearTag} className="inline-flex items-center gap-1 text-sm font-semibold text-km-link hover:underline cursor-pointer">
            <XIcon size={14} weight="bold" aria-hidden="true" />
            {t('clear')}
          </button>
        </div>
      )}
    </div>
  );
}
