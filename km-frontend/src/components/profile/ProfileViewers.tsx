'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SealCheckIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import UserAvatar from '@/components/ui/UserAvatar';
import DefaultAvatar from '@/components/ui/DefaultAvatar';
import { useRelativeTime } from '@/components/feed/feedUtils';
import { getAnalytics, type Analytics, type AnalyticsViewer } from '@/lib/api/analytics';

const COLLAPSED = 4;

/**
 * The latest people who viewed the member's profile in the past 90 days, shown the way each
 * viewer chose to browse: by name, by what they do and where, or as a private member. Hidden
 * while the member browses privately themselves, as on LinkedIn.
 */
export default function ProfileViewers({ userId }: { userId: string }) {
  const t = useTranslations('analytics');
  const [data, setData] = useState<Analytics | null>(null);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let live = true;
    getAnalytics(userId, 90).then(
      (a) => live && setData(a),
      () => live && setFailed(true),
    );
    return () => {
      live = false;
    };
  }, [userId]);

  const viewers = data?.recent_viewers ?? [];
  const shown = expanded ? viewers : viewers.slice(0, COLLAPSED);

  return (
    <section aria-labelledby="viewers-title" className="rounded-xl border border-km-border bg-km-surface-card p-5 shadow-sm sm:p-6">
      <h3 id="viewers-title" className="text-base font-semibold text-km-heading">{t('viewersTitle')}</h3>
      <p className="text-[13px] text-km-text-secondary">{t('viewersPeriod')}</p>

      {failed ? (
        <p className="mt-4 text-sm text-km-text-secondary">{t('loadFailed')}</p>
      ) : data === null ? (
        <div className="mt-4 space-y-4" role="status" aria-label={t('loading')}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-11 w-11 shrink-0 rounded-full animate-shimmer" />
              <div className="flex-1 space-y-2">
                <div className="h-3.5 w-32 rounded animate-shimmer" />
                <div className="h-3 w-44 rounded animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : data.viewers_hidden ? (
        <p className="mt-4 text-sm leading-relaxed text-km-text-secondary">
          {t('viewersHidden')}{' '}
          <Link href="/settings?tab=privacy" className="font-semibold text-km-link hover:underline">{t('changeViewing')}</Link>
        </p>
      ) : viewers.length === 0 ? (
        <p className="mt-4 text-sm leading-relaxed text-km-text-secondary">{t('viewersEmpty')}</p>
      ) : (
        <>
          <ul className="mt-4 space-y-4">
            {shown.map((v, i) => (
              <ViewerRow key={v.mode === 'name' ? v.id : `${v.mode}-${i}`} viewer={v} />
            ))}
          </ul>
          {viewers.length > COLLAPSED && (
            <button type="button" onClick={() => setExpanded((e) => !e)} className="mt-4 text-sm font-semibold text-km-link hover:underline cursor-pointer">
              {expanded ? t('showFewer') : t('showAll', { count: viewers.length })}
            </button>
          )}
        </>
      )}
    </section>
  );
}

function ViewerRow({ viewer }: { viewer: AnalyticsViewer }) {
  const t = useTranslations('analytics');
  const time = useRelativeTime(viewer.viewed_at);
  const viewed = (
    <p className="text-[12px] text-km-text-muted">
      <time dateTime={viewer.viewed_at} title={time.full}>{t('viewedAt', { time: time.label })}</time>
    </p>
  );

  if (viewer.mode !== 'name') {
    let title: string;
    if (viewer.mode === 'private') {
      title = t('anonymous.private');
    } else {
      const { role, title: job, city } = viewer.traits;
      const what = role === 'recruiter' ? t('anonymous.recruiter') : job;
      if (what && city) title = t('anonymous.whatWhere', { what, city });
      else if (what) title = what;
      else if (city) title = t('anonymous.someoneIn', { city });
      else title = t('anonymous.someone');
    }
    return (
      <li className="flex items-center gap-3">
        <div className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-km-border bg-km-surface" aria-hidden="true">
          <DefaultAvatar className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-km-heading">{title}</p>
          <p className="truncate text-[13px] text-km-text-secondary">
            {viewer.mode === 'private' ? t('anonymous.privateHint') : t('anonymous.characteristicsHint')}
          </p>
          {viewed}
        </div>
      </li>
    );
  }

  const href = `/profile/${viewer.id}`;
  return (
    <li className="flex items-center gap-3">
      <Link href={href} tabIndex={-1} aria-hidden="true" className="h-11 w-11 shrink-0 overflow-hidden rounded-full border border-km-border bg-km-surface">
        <UserAvatar src={viewer.avatar} name={viewer.name} />
      </Link>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 text-sm font-semibold text-km-heading">
          <Link href={href} className="truncate hover:text-km-link hover:underline">{viewer.name}</Link>
          {viewer.is_verified && <SealCheckIcon size={15} weight="fill" className="shrink-0 text-km-link" aria-label={t('verified')} />}
        </p>
        {viewer.headline && <p className="truncate text-[13px] text-km-text-secondary">{viewer.headline}</p>}
        {viewed}
      </div>
    </li>
  );
}
