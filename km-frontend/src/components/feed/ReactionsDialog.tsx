'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { SealCheckIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import UserAvatar from '@/components/ui/UserAvatar';
import { feedApi, type Reactor } from '@/lib/api/feed';
import FeedDialog from './FeedDialog';
import { REACTION_STYLE } from './PostReactions';
import { REACTIONS, type FeedPost, type ReactionType } from './feedTypes';
import { compactNumber } from './feedUtils';

type Tab = 'all' | ReactionType;

interface TabState {
  items: Reactor[];
  cursor?: string;
  status: 'idle' | 'loading' | 'ready' | 'error';
}

const EMPTY: TabState = { items: [], status: 'idle' };

/** Tabs with a page added: appended for "show more", or as the first page */
function withPage(s: Partial<Record<Tab, TabState>>, which: Tab, page: { reactions: Reactor[]; next_cursor?: string }, more: boolean) {
  const prev = more ? (s[which]?.items ?? []) : [];
  const seen = new Set(prev.map((r) => r.user.id));
  const items = [...prev, ...page.reactions.filter((r) => !seen.has(r.user.id))];
  return { ...s, [which]: { items, cursor: page.next_cursor, status: 'ready' as const } };
}

/**
 * Who reacted to a post: every reaction, or one kind, newest first. Render it only while open, so
 * each opening starts with fresh lists (reactions keep coming in).
 */
export default function ReactionsDialog({ post, onClose }: { post: FeedPost; onClose: () => void }) {
  const t = useTranslations('feed');
  const locale = useLocale();
  const [tab, setTab] = useState<Tab>('all');
  const [tabs, setTabs] = useState<Partial<Record<Tab, TabState>>>({});
  // A tab with nothing yet is loading its first page
  const current = tabs[tab] ?? { ...EMPTY, status: 'loading' };
  const requested = useRef(new Set<Tab>());

  const kinds = REACTIONS.filter((r) => (post.reaction_counts[r] ?? 0) > 0).sort(
    (a, b) => (post.reaction_counts[b] ?? 0) - (post.reaction_counts[a] ?? 0),
  );

  // Fetches a page into a tab (the state updates happen when the answer arrives)
  const fetchPage = useCallback(
    (which: Tab, before?: string) =>
      feedApi
        .reactions(post.id, which === 'all' ? undefined : which, before)
        .then((page) => setTabs((s) => withPage(s, which, page, Boolean(before))))
        .catch(() => setTabs((s) => ({ ...s, [which]: { ...(s[which] ?? EMPTY), status: 'error' } }))),
    [post.id],
  );

  // The "All" list on open; other tabs load when picked
  useEffect(() => {
    requested.current.add('all');
    void fetchPage('all');
  }, [fetchPage]);

  const load = (which: Tab, before?: string) => {
    setTabs((s) => ({ ...s, [which]: { ...(s[which] ?? EMPTY), status: 'loading' } }));
    void fetchPage(which, before);
  };

  const pick = (which: Tab) => {
    setTab(which);
    if (!requested.current.has(which)) {
      requested.current.add(which);
      load(which);
    }
  };

  const tabButton = (id: Tab, label: React.ReactNode, count: number, name: string) => {
    const selected = tab === id;
    return (
      <button
        key={id}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-label={`${name}, ${count}`}
        onClick={() => pick(id)}
        className={`relative inline-flex items-center gap-1.5 h-11 px-3 text-sm font-semibold whitespace-nowrap cursor-pointer ${
          selected ? 'text-km-link' : 'text-km-text-secondary hover:text-km-heading'
        }`}
      >
        {label}
        <span className="tabular-nums">{compactNumber(count, locale)}</span>
        {selected && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-km-link" aria-hidden="true" />}
      </button>
    );
  };

  return (
    <FeedDialog open onClose={onClose} title={t('reactions')}>
      <div role="tablist" aria-label={t('reactions')} className="sticky top-0 z-10 flex gap-1 overflow-x-auto px-3 sm:px-4 border-b border-km-border bg-km-surface-card">
        {tabButton('all', t('reactionsAll'), post.reactions_total, t('reactionsAll'))}
        {kinds.map((r) => {
          const { Icon, color } = REACTION_STYLE[r];
          return tabButton(r, <Icon size={18} weight="fill" className={color} aria-hidden="true" />, post.reaction_counts[r] ?? 0, t(`reaction.${r}`));
        })}
      </div>

      <div role="tabpanel" className="px-5 sm:px-6 py-2">
        {current.items.length > 0 && (
          <ul className="divide-y divide-km-border">
            {current.items.map((r) => {
              const { Icon, color } = REACTION_STYLE[r.type];
              return (
                <li key={r.user.id}>
                  <Link href={`/profile/${r.user.id}`} onClick={onClose} className="flex items-center gap-3 py-3 group">
                    <span className="relative shrink-0">
                      <span className="block w-11 h-11 rounded-full overflow-hidden bg-km-surface border border-km-border">
                        <UserAvatar src={r.user.avatar} name={r.user.name} />
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-5 h-5 rounded-full bg-km-surface-card border border-km-border">
                        <Icon size={12} weight="fill" className={color} aria-label={t(`reaction.${r.type}`)} />
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 min-w-0">
                        <span className="truncate text-[15px] font-semibold text-km-heading group-hover:text-km-link group-hover:underline">{r.user.name}</span>
                        {r.user.is_verified && <SealCheckIcon size={15} weight="fill" className="text-km-link shrink-0" aria-label={t('verified')} />}
                      </span>
                      {r.user.headline && <span className="block truncate text-[13px] text-km-text-secondary">{r.user.headline}</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {current.status === 'loading' && (
          <div className="flex justify-center py-4" role="status" aria-label={t('loading')}>
            <SpinnerGapIcon size={20} className="animate-spin text-km-text-secondary" />
          </div>
        )}
        {current.status === 'error' && (
          <p className="py-4 text-sm text-km-text-secondary">
            {t('reactionsFailed')}{' '}
            <button type="button" onClick={() => load(tab, current.items.length ? current.cursor : undefined)} className="font-semibold text-km-link hover:underline cursor-pointer">
              {t('retry')}
            </button>
          </p>
        )}
        {current.status === 'ready' && current.items.length === 0 && (
          <p className="py-6 text-center text-sm text-km-text-secondary">{t('reactionsEmpty')}</p>
        )}
        {current.status === 'ready' && current.cursor && (
          <button
            type="button"
            onClick={() => load(tab, current.cursor)}
            className="w-full h-11 my-1 text-sm font-semibold text-km-text-secondary hover:text-km-link cursor-pointer"
          >
            {t('moreReactions')}
          </button>
        )}
      </div>
    </FeedDialog>
  );
}
