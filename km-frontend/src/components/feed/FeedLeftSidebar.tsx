'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookmarkSimpleIcon, NotePencilIcon, RowsIcon, SealCheckIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import UserAvatar from '@/components/ui/UserAvatar';
import { getAnalytics, type Analytics } from '@/lib/api/analytics';
import api from '@/lib/axios';
import type { FeedView } from './feedTypes';
import { compactNumber, displayName, useFeedUser } from './feedUtils';

// The same window as the people-who-viewed list on /profile
const SIDEBAR_RANGE = 90;

/** The profile column: who you are, your numbers, and the Feed / Saved / My posts switch */
export default function FeedLeftSidebar({ view, onView }: { view: FeedView; onView: (v: FeedView) => void }) {
  const t = useTranslations('feed');
  const locale = useLocale();
  const { user, ready } = useFeedUser();
  const userId: string | undefined = user?.id || user?._id;
  const [stats, setStats] = useState<Analytics | null>(null);
  const [verified, setVerified] = useState(false);
  const [brokenCover, setBrokenCover] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    getAnalytics(userId, SIDEBAR_RANGE)
      .then((a) => live && setStats(a))
      .catch(() => {});
    // Verification isn't part of the saved session, so it comes from the profile
    (api.get('/user/profile') as unknown as Promise<{ verification_status?: string }>)
      .then((p) => live && setVerified(p.verification_status === 'verified'))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [userId]);

  if (!ready) return <div className="h-96 rounded-2xl border border-km-border bg-km-surface-card animate-shimmer" aria-hidden="true" />;

  // Guests get the sign-in prompt above the feed instead
  if (!user) return null;

  const name = displayName(user);
  const cover: string | undefined = user.cover_image || undefined;
  const nav: { v: FeedView; label: string; Icon: typeof RowsIcon }[] = [
    { v: 'all', label: t('view.all'), Icon: RowsIcon },
    { v: 'saved', label: t('view.saved'), Icon: BookmarkSimpleIcon },
    { v: 'mine', label: t('view.mine'), Icon: NotePencilIcon },
  ];

  return (
    <aside className="overflow-hidden rounded-2xl border border-km-border bg-km-surface-card shadow-xs">
      <div className="h-16 bg-[#071A4D] dark:bg-km-primary" aria-hidden="true">
        {cover && cover !== brokenCover && (
          // The banner from /profile; the plain band stays if it can't load
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt="" className="h-full w-full object-cover" onError={() => setBrokenCover(cover)} />
        )}
      </div>
      <div className="px-4 pb-4 text-center">
        <Link href="/profile" className="relative -mt-9 mb-2 inline-block h-[72px] w-[72px] overflow-hidden rounded-full border-[3px] border-km-surface-card bg-km-surface">
          <UserAvatar src={user.profile_image || user.avatar} name={name} />
        </Link>
        <p className="flex items-center justify-center gap-1">
          <Link href="/profile" className="min-w-0 truncate text-base font-semibold text-km-heading hover:text-km-link hover:underline">{name}</Link>
          {verified && <SealCheckIcon size={16} weight="fill" className="shrink-0 text-km-link" aria-label={t('verified')} />}
        </p>
        {user.headline && <p className="mt-0.5 line-clamp-2 text-[13px] text-km-text-secondary">{user.headline}</p>}
      </div>

      <div className="border-t border-km-border py-2">
        <p className="px-4 pt-1 text-[12px] text-km-text-muted">{t('statsPeriod')}</p>
        <dl className="text-[13px]">
          <StatRow label={t('profileViewers')} value={stats ? compactNumber(stats.profile_viewers.total, locale) : null} />
          <StatRow label={t('postImpressions')} value={stats ? compactNumber(stats.post_impressions.total, locale) : null} />
        </dl>
      </div>

      <nav aria-label={t('views')} className="border-t border-km-border p-2">
        {nav.map(({ v, label, Icon }) => (
          <button
            key={v}
            type="button"
            aria-current={view === v ? 'page' : undefined}
            onClick={() => onView(v)}
            className={`flex h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors cursor-pointer ${
              view === v ? 'bg-km-surface text-km-heading' : 'text-km-text-secondary hover:bg-km-surface hover:text-km-heading'
            }`}
          >
            <Icon size={18} weight={view === v ? 'fill' : 'regular'} aria-hidden="true" />
            {label}
          </button>
        ))}
      </nav>
    </aside>
  );
}

/** One number; the whole row opens the full analytics on /profile */
function StatRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="relative flex items-center justify-between gap-3 px-4 py-1.5 hover:bg-km-surface">
      <dt>
        <Link href="/profile#analytics" className="text-km-text-secondary after:absolute after:inset-0">{label}</Link>
      </dt>
      <dd className="font-semibold tabular-nums text-km-link">
        {value ?? <span className="inline-block h-3.5 w-6 rounded align-middle animate-shimmer" aria-hidden="true" />}
      </dd>
    </div>
  );
}
