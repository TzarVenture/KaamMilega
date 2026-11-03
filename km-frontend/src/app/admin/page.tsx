'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import {
  ArrowsClockwiseIcon,
  BriefcaseIcon,
  CaretRightIcon,
  ClockCounterClockwiseIcon,
  CurrencyInrIcon,
  FileTextIcon,
  PhoneCallIcon,
  UserCheckIcon,
  UsersIcon,
  WarningCircleIcon,
} from '@phosphor-icons/react';
import { AdminPageHeader, AdminPanel, EmptyState, SkeletonRows, StatCard, btn } from '@/components/admin/ui';

interface PlatformStats {
  total_users?: number;
  jobseekers?: number;
  recruiters?: number;
  experts?: number;
  cities?: number;
  skills?: number;
  jobs?: number;
  applications?: number;
  interviews?: number;
  active_gigs?: number;
  disputes?: number;
  revenue?: number;
}

interface LiveEvent {
  id?: string;
  type?: string;
  tag?: string;
  title?: string;
  description?: string;
  time?: string;
  badge?: string;
}

const fmt = (n?: number) => (n ?? 0).toLocaleString('en-IN');

function ActivityIcon({ type }: { type?: string }) {
  const cls = 'shrink-0 text-km-text-secondary';
  if (type === 'interview') return <PhoneCallIcon size={20} className={cls} aria-hidden="true" />;
  if (type === 'application') return <FileTextIcon size={20} className={cls} aria-hidden="true" />;
  return <UserCheckIcon size={20} className={cls} aria-hidden="true" />;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    const [statsRes, activityRes] = await Promise.allSettled([
      api.get('/platform/stats'),
      api.get('/platform/live-activity'),
    ]);
    if (statsRes.status === 'fulfilled') {
      const data = statsRes.value?.data || statsRes.value;
      setStats(data?.stats || data || {});
    } else {
      setErrorMessage("Couldn't load the latest numbers. Try refreshing.");
    }
    if (activityRes.status === 'fulfilled') {
      const data = activityRes.value?.data || activityRes.value;
      setLiveEvents(data?.events || (Array.isArray(data) ? data : []));
    }
    setIsLoading(false);
    setIsRefreshing(false);
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const value = (n?: number) => (isLoading ? '–' : fmt(n));
  const total = stats?.total_users ?? 0;
  const mix = [
    { label: 'Jobseekers', count: stats?.jobseekers ?? 0, color: 'bg-km-jobs', href: '/admin/users?role=user' },
    { label: 'Employers', count: stats?.recruiters ?? 0, color: 'bg-km-p2p', href: '/admin/companies' },
    { label: 'Experts', count: stats?.experts ?? 0, color: 'bg-km-mentors', href: '/admin/expert-requests' },
  ];
  const operations = [
    { label: 'Active gigs', count: stats?.active_gigs, href: '/admin/jobs' },
    { label: 'Cities', count: stats?.cities, href: '/admin/cities' },
    { label: 'Skill categories', count: stats?.skills, href: '/admin/professions' },
    { label: 'Open disputes', count: stats?.disputes, href: '/admin/disputes', alert: (stats?.disputes ?? 0) > 0 },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="Dashboard"
        description="Platform totals and the latest activity"
        actions={
          <button type="button" onClick={fetchStats} disabled={isRefreshing} className={btn.secondary}>
            <ArrowsClockwiseIcon size={16} className={isRefreshing ? 'animate-spin' : ''} aria-hidden="true" />
            {isRefreshing ? 'Refreshing' : 'Refresh'}
          </button>
        }
      />

      {errorMessage && (
        <div role="alert" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <WarningCircleIcon size={18} className="text-amber-600 shrink-0" aria-hidden="true" />
          {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard label="Total users" value={value(stats?.total_users)} icon={UsersIcon} href="/admin/users"
          hint={isLoading ? undefined : `${fmt(stats?.jobseekers)} jobseekers, ${fmt(stats?.recruiters)} employers`} />
        <StatCard label="Jobs posted" value={value(stats?.jobs)} icon={BriefcaseIcon} iconClassName="text-km-jobs-text" href="/admin/jobs"
          hint={isLoading ? undefined : `${fmt(stats?.applications)} applications`} />
        <StatCard label="Interviews" value={value(stats?.interviews)} icon={PhoneCallIcon} iconClassName="text-km-p2p-text"
          hint="Scheduled across all jobs" />
        <StatCard label="Revenue" value={isLoading ? '–' : `₹${fmt(stats?.revenue)}`} icon={CurrencyInrIcon} iconClassName="text-km-skills-text"
          hint="Completed transactions" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AdminPanel title="Users by type" actions={<Link href="/admin/users" className="text-sm font-medium text-km-link hover:underline">View users</Link>} bodyClassName="p-5 space-y-4">
          {/* Share of all users as one stacked bar, then a row per type */}
          <div className="flex h-2.5 rounded-full overflow-hidden bg-km-border-subtle gap-0.5" aria-hidden="true">
            {total > 0 && mix.map((m) => m.count > 0 && (
              <span key={m.label} className={m.color} style={{ width: `${(m.count / total) * 100}%` }} />
            ))}
          </div>
          <ul className="divide-y divide-km-border-subtle">
            {mix.map((m) => (
              <li key={m.label}>
                <Link href={m.href} className="group flex items-center gap-3 py-2.5">
                  <span className={`w-2.5 h-2.5 rounded-sm ${m.color}`} aria-hidden="true" />
                  <span className="text-sm text-km-text-primary group-hover:text-km-link">{m.label}</span>
                  <span className="ml-auto text-sm font-semibold text-km-heading font-inter tabular-nums">{value(m.count)}</span>
                  <span className="w-12 text-right text-xs text-km-text-secondary font-inter tabular-nums">
                    {total > 0 ? `${Math.round((m.count / total) * 100)}%` : '–'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </AdminPanel>

        <AdminPanel title="Operations" bodyClassName="px-5 py-2">
          <ul className="divide-y divide-km-border-subtle">
            {operations.map((o) => {
              const row = (
                <>
                  <span className="text-sm text-km-text-primary">{o.label}</span>
                  <span className={`ml-auto text-sm font-semibold font-inter tabular-nums ${o.alert ? 'text-red-600' : 'text-km-heading'}`}>{value(o.count)}</span>
                  {o.href && <CaretRightIcon size={14} className="text-km-text-muted group-hover:text-km-link" aria-hidden="true" />}
                </>
              );
              return (
                <li key={o.label}>
                  {o.href
                    ? <Link href={o.href} className="group flex items-center gap-3 py-2.5 hover:text-km-link">{row}</Link>
                    : <div className="flex items-center gap-3 py-2.5 pr-[26px]">{row}</div>}
                </li>
              );
            })}
          </ul>
        </AdminPanel>
      </div>

      <AdminPanel title="Recent activity" actions={<span className="text-xs text-km-text-secondary">{liveEvents.length} events</span>}>
        {isLoading ? (
          <SkeletonRows rows={4} />
        ) : liveEvents.length === 0 ? (
          <EmptyState icon={ClockCounterClockwiseIcon} title="No recent activity" description="New sign-ups, applications and interviews appear here." />
        ) : (
          <ul className="divide-y divide-km-border-subtle max-h-[480px] overflow-y-auto">
            {liveEvents.map((evt, idx) => (
              <li key={evt.id || idx} className="flex items-start gap-3 px-5 py-3">
                <span className="mt-0.5"><ActivityIcon type={evt.type} /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-km-text-primary truncate">{evt.title}</p>
                  {evt.description && <p className="text-xs text-km-text-secondary truncate mt-0.5">{evt.description}</p>}
                </div>
                <span className="text-xs text-km-text-secondary shrink-0 font-inter">{evt.time || 'Recent'}</span>
              </li>
            ))}
          </ul>
        )}
      </AdminPanel>

    </div>
  );
}
