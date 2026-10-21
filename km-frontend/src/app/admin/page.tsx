'use client';

import React, { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { ArrowUpRightIcon, ArrowsClockwiseIcon, BriefcaseIcon, BuildingOfficeIcon, CaretRightIcon, CurrencyInrIcon, FileTextIcon, FileXlsIcon, GraduationCapIcon, LightningIcon, MapPinIcon, PhoneCallIcon, ShieldWarningIcon, UserCheckIcon, UsersIcon, WarningCircleIcon } from '@phosphor-icons/react';
import ReportsExportSection from '@/components/admin/ReportsExportSection';

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

function AdminAnalyticsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentSection = searchParams.get('section') || 'all';

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fetchStats = async () => {
    setIsRefreshing(true);
    setErrorMessage(null);
    try {
      const [statsRes, activityRes] = await Promise.allSettled([
        api.get('/platform/stats'),
        api.get('/platform/live-activity')
      ]);

      if (statsRes.status === 'fulfilled') {
        const data = statsRes.value?.data || statsRes.value;
        setStats(data?.stats || data || {});
      } else {
        setErrorMessage('Unable to load latest stats from database.');
      }

      if (activityRes.status === 'fulfilled') {
        const data = activityRes.value?.data || activityRes.value;
        const events = data?.events || (Array.isArray(data) ? data : []);
        setLiveEvents(events);
      }
    } catch (error: any) {
      console.error('Failed to load admin stats:', error);
      setErrorMessage(error?.message || 'Error communicating with backend.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSectionTab = (sectionKey: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sectionKey === 'all') {
      params.delete('section');
    } else {
      params.set('section', sectionKey);
    }
    const queryString = params.toString();
    router.push(queryString ? `/admin?${queryString}` : '/admin');
  };

  const totalUsers = stats?.total_users;
  const jobseekers = stats?.jobseekers;
  const recruiters = stats?.recruiters;
  const experts = stats?.experts;
  const activeGigs = stats?.active_gigs;
  const jobsPosted = stats?.jobs;
  const applications = stats?.applications;
  const interviews = stats?.interviews;
  const cities = stats?.cities;
  const skills = stats?.skills;
  const disputes = stats?.disputes;
  const revenue = stats?.revenue;

  const candidatePercent = totalUsers && totalUsers > 0 && jobseekers !== undefined
    ? Math.round((jobseekers / totalUsers) * 100)
    : null;

  const recruiterPercent = totalUsers && totalUsers > 0 && recruiters !== undefined
    ? Math.round((recruiters / totalUsers) * 100)
    : null;

  const expertPercent = totalUsers && totalUsers > 0 && experts !== undefined
    ? Math.round((experts / totalUsers) * 100)
    : null;

  return (
    <div className="space-y-4 sm:space-y-5 pb-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Analytics &amp; Overview
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm">
            Platform statistics, user distribution, and live activity
          </p>
        </div>

        <button
          type="button"
          onClick={fetchStats}
          disabled={isRefreshing}
          className="self-start sm:self-auto px-3.5 py-1.5 bg-white border border-purple-100 hover:border-purple-200 text-purple-700 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <ArrowsClockwiseIcon weight="bold" size={13} className={isRefreshing ? 'animate-spin' : ''} />
          <span>{isRefreshing ? 'Refreshing...' : 'Refresh'}</span>
        </button>
      </div>

      {/* QUICK LINKS AT TOP - Lean & Tough */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        <Link
          href="/admin/companies"
          className="p-3 rounded-2xl bg-white border border-purple-50 hover:border-purple-200 hover:bg-purple-50/30 shadow-xs transition-all text-xs font-semibold text-slate-700 hover:text-purple-700 flex items-center justify-between group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-purple-50 text-purple-600 group-hover:scale-105 transition-transform">
              <BuildingOfficeIcon weight="bold" size={14} />
            </div>
            <span className="truncate">Companies</span>
          </div>
          <ArrowUpRightIcon weight="bold" size={13} className="text-slate-400 group-hover:text-purple-600 transition-colors shrink-0" />
        </Link>

        <Link
          href="/admin/jobs"
          className="p-3 rounded-2xl bg-white border border-purple-50 hover:border-purple-200 hover:bg-purple-50/30 shadow-xs transition-all text-xs font-semibold text-slate-700 hover:text-purple-700 flex items-center justify-between group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 group-hover:scale-105 transition-transform">
              <BriefcaseIcon weight="bold" size={14} />
            </div>
            <span className="truncate">Jobs</span>
          </div>
          <ArrowUpRightIcon weight="bold" size={13} className="text-slate-400 group-hover:text-blue-600 transition-colors shrink-0" />
        </Link>

        <Link
          href="/admin/disputes"
          className="p-3 rounded-2xl bg-white border border-purple-50 hover:border-purple-200 hover:bg-purple-50/30 shadow-xs transition-all text-xs font-semibold text-slate-700 hover:text-purple-700 flex items-center justify-between group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 group-hover:scale-105 transition-transform">
              <ShieldWarningIcon weight="bold" size={14} />
            </div>
            <span className="truncate">Disputes</span>
          </div>
          <ArrowUpRightIcon weight="bold" size={13} className="text-slate-400 group-hover:text-rose-600 transition-colors shrink-0" />
        </Link>

        <Link
          href="/admin/users"
          className="p-3 rounded-2xl bg-white border border-purple-50 hover:border-purple-200 hover:bg-purple-50/30 shadow-xs transition-all text-xs font-semibold text-slate-700 hover:text-purple-700 flex items-center justify-between group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 group-hover:scale-105 transition-transform">
              <UsersIcon weight="bold" size={14} />
            </div>
            <span className="truncate">Users</span>
          </div>
          <ArrowUpRightIcon weight="bold" size={13} className="text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0" />
        </Link>

        <Link
          href="/admin/reports"
          className="p-3 rounded-2xl bg-white border border-purple-50 hover:border-purple-200 hover:bg-purple-50/30 shadow-xs transition-all text-xs font-semibold text-slate-700 hover:text-purple-700 flex items-center justify-between group col-span-2 sm:col-span-1"
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 group-hover:scale-105 transition-transform">
              <FileXlsIcon weight="bold" size={14} />
            </div>
            <span className="truncate">Reports &amp; CSV</span>
          </div>
          <ArrowUpRightIcon weight="bold" size={13} className="text-slate-400 group-hover:text-indigo-600 transition-colors shrink-0" />
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        {[
          { key: 'all', label: 'All' },
          { key: 'reports', label: 'Export Reports' },
          { key: 'metrics', label: 'Key Metrics' },
          { key: 'users', label: 'Users' },
          { key: 'operations', label: 'Operations' },
          { key: 'activity', label: 'Recent Activity' }
        ].map((tab) => {
          const isActive = currentSection === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleSectionTab(tab.key)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isActive
                  ? 'bg-purple-600 text-white'
                  : 'bg-white hover:bg-purple-50 text-slate-600 hover:text-purple-700 border border-purple-50'
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {errorMessage && (
        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <WarningCircleIcon weight="bold" size={14} className="text-amber-600 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Section: Platform Reports & Analytics Export */}
      {(currentSection === 'all' || currentSection === 'reports') && (
        <section>
          <ReportsExportSection
            userCount={totalUsers}
            jobCount={jobsPosted}
            revenueTotal={revenue}
            onRefreshStats={fetchStats}
          />
        </section>
      )}

      {/* Section: Key Metrics - Leaner, Meaner, Tougher */}
      {(currentSection === 'all' || currentSection === 'metrics') && (
        <section className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {/* Total Users */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-purple-50 shadow-xs hover:border-purple-200 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                    Total Users
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : totalUsers !== undefined ? totalUsers.toLocaleString() : '0'}
                  </h3>
                </div>
                <div className="bg-purple-50 text-purple-600 p-2.5 rounded-xl">
                  <UsersIcon weight="bold" size={18} />
                </div>
              </div>
              <p className="pt-2 border-t border-purple-50 text-[11px] text-slate-500 font-medium">
                {isLoading ? (
                  'Loading...'
                ) : jobseekers !== undefined || recruiters !== undefined ? (
                  <span>
                    Candidates: <strong className="text-slate-800">{jobseekers ?? 0}</strong> • Employers: <strong className="text-slate-800">{recruiters ?? 0}</strong>
                  </span>
                ) : (
                  'No users yet'
                )}
              </p>
            </div>

            {/* Active Gigs */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-purple-50 shadow-xs hover:border-purple-200 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                    Active Gigs
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : activeGigs !== undefined ? activeGigs.toLocaleString() : '0'}
                  </h3>
                </div>
                <div className="bg-amber-50 text-amber-600 p-2.5 rounded-xl">
                  <LightningIcon weight="bold" size={18} />
                </div>
              </div>
              <p className="pt-2 border-t border-purple-50 text-[11px] text-slate-500 font-medium">
                {activeGigs !== undefined && activeGigs > 0 ? (
                  `${activeGigs} active tasks`
                ) : (
                  'No active gigs'
                )}
              </p>
            </div>

            {/* Jobs Posted */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-purple-50 shadow-xs hover:border-purple-200 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                    Jobs Posted
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : jobsPosted !== undefined ? jobsPosted.toLocaleString() : '0'}
                  </h3>
                </div>
                <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                  <BriefcaseIcon weight="bold" size={18} />
                </div>
              </div>
              <p className="pt-2 border-t border-purple-50 text-[11px] text-slate-500 font-medium">
                {applications !== undefined ? (
                  <span>
                    <strong className="text-slate-800">{applications}</strong> applications submitted
                  </span>
                ) : (
                  'No applications yet'
                )}
              </p>
            </div>

            {/* Platform Revenue */}
            <div className="p-4 sm:p-5 bg-white rounded-2xl border border-purple-50 shadow-xs hover:border-purple-200 transition-all">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                    Platform Revenue
                  </p>
                  <h3 className="text-2xl font-bold text-slate-900">
                    {isLoading ? '...' : revenue !== undefined && revenue > 0 ? `₹${revenue.toLocaleString('en-IN')}` : '₹0'}
                  </h3>
                </div>
                <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-xl">
                  <CurrencyInrIcon weight="bold" size={18} />
                </div>
              </div>
              <p className="pt-2 border-t border-purple-50 text-[11px] text-slate-500 font-medium">
                {revenue !== undefined && revenue > 0 ? (
                  'Completed transactions'
                ) : (
                  'No transactions recorded'
                )}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Section: Users */}
      {(currentSection === 'all' || currentSection === 'users') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">User Breakdown</h2>
            <Link
              href="/admin/users"
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowUpRightIcon weight="bold" size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
            {/* Candidates */}
            <div className="bg-white rounded-2xl border border-purple-50 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-xs">
                    JS
                  </div>
                  {candidatePercent !== null && (
                    <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                      {candidatePercent}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                  Jobseekers
                </p>
                <h4 className="text-xl font-bold text-slate-900 mb-1">
                  {isLoading ? '...' : (jobseekers !== undefined ? jobseekers.toLocaleString() : '0')}
                </h4>
                <p className="text-xs text-slate-500 leading-snug">
                  Registered candidates &amp; jobseekers
                </p>
              </div>

              <div className="mt-4 pt-2.5 border-t border-purple-50">
                <Link
                  href="/admin/users?role=user"
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center justify-between"
                >
                  <span>Manage candidates</span>
                  <CaretRightIcon weight="bold" size={13} />
                </Link>
              </div>
            </div>

            {/* Employers */}
            <div className="bg-white rounded-2xl border border-purple-50 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    EM
                  </div>
                  {recruiterPercent !== null && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      {recruiterPercent}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                  Employers
                </p>
                <h4 className="text-xl font-bold text-slate-900 mb-1">
                  {isLoading ? '...' : (recruiters !== undefined ? recruiters.toLocaleString() : '0')}
                </h4>
                <p className="text-xs text-slate-500 leading-snug">
                  Recruiters &amp; verified hiring companies
                </p>
              </div>

              <div className="mt-4 pt-2.5 border-t border-purple-50">
                <Link
                  href="/admin/companies"
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center justify-between"
                >
                  <span>Manage companies</span>
                  <CaretRightIcon weight="bold" size={13} />
                </Link>
              </div>
            </div>

            {/* Experts */}
            <div className="bg-white rounded-2xl border border-purple-50 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center font-bold text-xs">
                    EX
                  </div>
                  {expertPercent !== null && (
                    <span className="text-[11px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                      {expertPercent}%
                    </span>
                  )}
                </div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">
                  Experts &amp; Mentors
                </p>
                <h4 className="text-xl font-bold text-slate-900 mb-1">
                  {isLoading ? '...' : (experts !== undefined ? experts.toLocaleString() : '0')}
                </h4>
                <p className="text-xs text-slate-500 leading-snug">
                  Industry mentors &amp; advisors
                </p>
              </div>

              <div className="mt-4 pt-2.5 border-t border-purple-50">
                <Link
                  href="/admin/expert-requests"
                  className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center justify-between"
                >
                  <span>Manage experts</span>
                  <CaretRightIcon weight="bold" size={13} />
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Section: Operations */}
      {(currentSection === 'all' || currentSection === 'operations') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Operations</h2>
            <Link
              href="/admin/jobs"
              className="text-xs font-semibold text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <span>View jobs</span>
              <ArrowUpRightIcon weight="bold" size={13} />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-purple-50 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700">
                  <MapPinIcon weight="bold" size={15} />
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Cities</span>
              </div>
              <p className="text-xl font-bold text-slate-900">
                {isLoading ? '...' : (cities !== undefined ? cities : '0')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Active locations</p>
            </div>

            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-purple-50 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-purple-50 text-purple-700">
                  <PhoneCallIcon weight="bold" size={15} />
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Interviews</span>
              </div>
              <p className="text-xl font-bold text-slate-900">
                {isLoading ? '...' : (interviews !== undefined ? interviews : '0')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Scheduled</p>
            </div>

            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-purple-50 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <GraduationCapIcon weight="bold" size={15} />
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Skills</span>
              </div>
              <p className="text-xl font-bold text-slate-900">
                {isLoading ? '...' : (skills !== undefined ? skills : '0')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Categories</p>
            </div>

            <div className="p-3.5 sm:p-4 bg-white rounded-2xl border border-purple-50 shadow-xs">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="p-1.5 rounded-lg bg-rose-50 text-rose-700">
                  <ShieldWarningIcon weight="bold" size={15} />
                </div>
                <span className="text-[11px] font-semibold text-slate-500">Disputes</span>
              </div>
              <p className="text-xl font-bold text-slate-900">
                {isLoading ? '...' : (disputes !== undefined ? disputes : '0')}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {disputes && disputes > 0 ? 'Needs review' : 'No open disputes'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Section: Recent Activity */}
      {(currentSection === 'all' || currentSection === 'activity') && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">Recent Activity</h2>
            <span className="text-xs text-slate-400">
              {liveEvents.length} events
            </span>
          </div>

          <div className="bg-white rounded-2xl border border-purple-50 p-4 sm:p-5 shadow-xs">
            {isLoading ? (
              <p className="text-center text-slate-400 text-xs py-4">Loading activity...</p>
            ) : liveEvents.length === 0 ? (
              <p className="text-center text-slate-400 text-xs py-4">No recent activity records found.</p>
            ) : (
              <div className="space-y-2">
                {liveEvents.map((evt, idx) => (
                  <div
                    key={evt.id || idx}
                    className="p-3 rounded-xl bg-slate-50/70 border border-slate-100 flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                          evt.type === 'interview'
                            ? 'bg-purple-100 text-purple-700'
                            : evt.type === 'application'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {evt.type === 'interview' ? (
                          <PhoneCallIcon weight="bold" size={13} />
                        ) : evt.type === 'application' ? (
                          <FileTextIcon weight="bold" size={13} />
                        ) : (
                          <UserCheckIcon weight="bold" size={13} />
                        )}
                      </div>

                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{evt.title}</p>
                        <p className="text-slate-500 text-[11px] truncate">
                          {evt.description}
                        </p>
                      </div>
                    </div>

                    <span className="text-slate-400 text-[11px] shrink-0 font-medium">
                      {evt.time || 'Recent'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default function AdminAnalyticsPage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-center text-slate-400 text-xs">
          Loading analytics...
        </div>
      }
    >
      <AdminAnalyticsContent />
    </Suspense>
  );
}
