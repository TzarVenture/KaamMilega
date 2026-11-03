'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownIcon, ArrowUpIcon, EyeIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { ANALYTICS_RANGES, getAnalytics, type Analytics, type AnalyticsMetric, type AnalyticsMetricKey, type AnalyticsRange, type DayCount } from '@/lib/api/analytics';
import { useFormat } from '@/i18n/useFormat';

const METRICS: AnalyticsMetricKey[] = ['profile_viewers', 'post_impressions', 'search_appearances'];

/** "2026-11-02" → a Date at midday, so formatting never slips into the day before */
function dayDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

/**
 * The member's own numbers on /profile: profile viewers, post impressions and search
 * appearances for the last 7, 28 or 90 days, compared with the period before, with a daily
 * chart of the one selected. Only the member sees this.
 */
export default function ProfileAnalytics({ userId }: { userId: string }) {
  const t = useTranslations('analytics');
  const [range, setRange] = useState<AnalyticsRange>(28);
  const [metric, setMetric] = useState<AnalyticsMetricKey>('profile_viewers');
  const [data, setData] = useState<Analytics | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  const fetchRange = useCallback(
    (days: AnalyticsRange) =>
      getAnalytics(userId, days).then(
        (a) => {
          setData(a);
          setStatus('ready');
        },
        () => setStatus('error'),
      ),
    [userId],
  );

  useEffect(() => {
    void fetchRange(range);
  }, [fetchRange, range]);

  // Links to /profile#analytics (from the feed) arrive before this card exists, so scroll to it
  // once it has loaded
  const section = useRef<HTMLElement>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (status !== 'ready' || scrolled.current) return;
    scrolled.current = true;
    if (window.location.hash === '#analytics') section.current?.scrollIntoView({ block: 'start' });
  }, [status]);

  const choose = (days: AnalyticsRange) => {
    if (days === range) return;
    setStatus('loading');
    setRange(days);
  };

  return (
    <section ref={section} id="analytics" aria-labelledby="analytics-title" className="scroll-mt-24 rounded-xl border border-km-border bg-km-surface-card p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="analytics-title" className="text-xl font-semibold text-km-heading">{t('title')}</h2>
          <p className="mt-0.5 flex items-center gap-1 text-[13px] text-km-text-secondary">
            <EyeIcon size={14} aria-hidden="true" />
            {t('private')}
          </p>
        </div>
        <div role="group" aria-label={t('rangeLabel')} className="inline-flex rounded-xl border border-km-border bg-km-surface p-1">
          {ANALYTICS_RANGES.map((days) => (
            <button
              key={days}
              type="button"
              aria-pressed={range === days}
              onClick={() => choose(days)}
              className={`h-8 rounded-lg px-3 text-[13px] font-semibold transition-colors cursor-pointer ${
                range === days ? 'bg-km-surface-card text-km-heading shadow-xs' : 'text-km-text-secondary hover:text-km-heading'
              }`}
            >
              {t('days', { count: days })}
            </button>
          ))}
        </div>
      </div>

      {status === 'error' ? (
        <p className="mt-6 text-sm text-km-text-secondary">
          {t('loadFailed')}{' '}
          <button
            type="button"
            onClick={() => {
              setStatus('loading');
              void fetchRange(range);
            }}
            className="font-semibold text-km-link hover:underline cursor-pointer"
          >
            {t('retry')}
          </button>
        </p>
      ) : status === 'loading' || !data ? (
        <div className="mt-5 space-y-4" role="status" aria-label={t('loading')}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {METRICS.map((m) => (
              <div key={m} className="h-24 rounded-xl animate-shimmer" />
            ))}
          </div>
          <div className="h-44 rounded-xl animate-shimmer" />
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {METRICS.map((m) => (
              <MetricTile key={m} metricKey={m} metric={data[m]} days={range} selected={metric === m} onSelect={() => setMetric(m)} />
            ))}
          </div>
          <DailyChart metricKey={metric} series={data[metric].series} />
          {metric === 'post_impressions' && data.post_impressions.total === 0 && (
            <p className="mt-3 text-[13px] text-km-text-secondary">
              {t('impressionsHint')}{' '}
              <Link href="/feed" className="font-semibold text-km-link hover:underline">{t('goToFeed')}</Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}

function MetricTile({ metricKey, metric, days, selected, onSelect }: { metricKey: AnalyticsMetricKey; metric: AnalyticsMetric; days: AnalyticsRange; selected: boolean; onSelect: () => void }) {
  const t = useTranslations('analytics');
  const f = useFormat();
  const { total, previous } = metric;

  let change: React.ReactNode;
  if (previous === 0) {
    change = total === 0 ? t('change.none', { days }) : t('change.noPrevious', { days });
  } else if (total === previous) {
    change = t('change.same', { days });
  } else {
    const up = total > previous;
    const percent = Math.round((Math.abs(total - previous) / previous) * 100);
    const Icon = up ? ArrowUpIcon : ArrowDownIcon;
    change = (
      <>
        <Icon size={13} weight="bold" className={up ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'} aria-hidden="true" />
        {t(up ? 'change.up' : 'change.down', { percent: f.number(percent), days })}
      </>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      className={`rounded-xl border p-4 text-left transition-colors cursor-pointer ${
        selected ? 'border-km-link bg-km-surface ring-1 ring-km-link' : 'border-km-border hover:bg-km-surface'
      }`}
    >
      <span className="block text-2xl font-semibold tabular-nums text-km-heading">{f.number(total)}</span>
      <span className="mt-0.5 block text-sm font-semibold text-km-text-primary">{t(`metric.${metricKey}.label`)}</span>
      <span className="mt-1 flex items-center gap-1 text-[12px] text-km-text-secondary">{change}</span>
    </button>
  );
}

/** One bar per day for the selected number; hover or tap a day for its value */
function DailyChart({ metricKey, series }: { metricKey: AnalyticsMetricKey; series: DayCount[] }) {
  const t = useTranslations('analytics');
  const f = useFormat();
  const [active, setActive] = useState<number | null>(null);
  const peak = Math.max(0, ...series.map((d) => d.count));
  // A round top for the scale, so a single view isn't drawn as a full-height bar
  const top = Math.max(4, Math.ceil(peak / 4) * 4);
  const label = (d: DayCount) => f.date(dayDate(d.date), { day: 'numeric', month: 'short' });
  const shown = active !== null ? series[active] : null;
  const name = t(`metric.${metricKey}.label`);

  return (
    <figure className="mt-5">
      <figcaption className="flex min-h-5 items-baseline justify-between gap-3 text-[13px]">
        <span className="font-semibold text-km-heading">{t(`metric.${metricKey}.daily`)}</span>
        {shown && (
          <span className="tabular-nums text-km-text-secondary" aria-hidden="true">
            {label(shown)}: <span className="font-semibold text-km-heading">{f.number(shown.count)}</span>
          </span>
        )}
      </figcaption>

      <div className="relative mt-2 h-40" aria-hidden="true">
        {/* Recessive scale: top value, middle and the baseline */}
        <div className="absolute inset-x-0 top-0 border-t border-dashed border-km-border" />
        <div className="absolute inset-x-0 top-1/2 border-t border-dashed border-km-border" />
        <span className="absolute right-0 -top-2.5 bg-km-surface-card pl-1 text-[11px] tabular-nums text-km-text-muted">{f.number(top)}</span>
        <span className="absolute right-0 top-1/2 -translate-y-2.5 bg-km-surface-card pl-1 text-[11px] tabular-nums text-km-text-muted">{f.number(top / 2)}</span>
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-km-border pr-6" onPointerLeave={() => setActive(null)}>
          {series.map((d, i) => (
            <div
              key={d.date}
              className="flex h-full min-w-0 flex-1 items-end justify-center"
              onPointerEnter={() => setActive(i)}
              onPointerDown={() => setActive(i)}
            >
              <div
                className={`w-full max-w-10 rounded-t-[4px] transition-colors ${active === i ? 'bg-km-heading' : 'bg-km-link'}`}
                style={{ height: d.count > 0 ? `max(${(d.count / top) * 100}%, 3px)` : 0 }}
              />
            </div>
          ))}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pr-6 text-[11px] tabular-nums text-km-text-muted" aria-hidden="true">
        <span>{label(series[0])}</span>
        {series.length > 7 && <span>{label(series[Math.floor(series.length / 2)])}</span>}
        <span>{label(series[series.length - 1])}</span>
      </div>

      {/* The same numbers for screen readers */}
      <table className="sr-only">
        <caption>{t(`metric.${metricKey}.daily`)}</caption>
        <thead>
          <tr>
            <th scope="col">{t('date')}</th>
            <th scope="col">{name}</th>
          </tr>
        </thead>
        <tbody>
          {series.map((d) => (
            <tr key={d.date}>
              <th scope="row">{label(d)}</th>
              <td>{d.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
