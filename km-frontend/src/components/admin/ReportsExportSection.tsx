'use client';

import React, { useState } from 'react';
import { ArrowsClockwiseIcon, BriefcaseIcon, CheckCircleIcon, CurrencyInrIcon, DownloadSimpleIcon, FileXlsIcon, FunnelSimpleIcon, UsersIcon, WarningCircleIcon } from '@phosphor-icons/react';

interface ReportsExportSectionProps {
  userCount?: number;
  jobCount?: number;
  revenueTotal?: number;
  onRefreshStats?: () => void;
}

export default function ReportsExportSection({
  userCount,
  jobCount,
  revenueTotal,
  onRefreshStats
}: ReportsExportSectionProps) {
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');
  const [jobStatusFilter, setJobStatusFilter] = useState<string>('all');
  const [revenueStatusFilter, setRevenueStatusFilter] = useState<string>('all');

  const [downloadingType, setDownloadingType] = useState<string | null>(null);
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExport = async (type: 'users' | 'jobs' | 'revenue', filterParam?: string) => {
    setDownloadingType(type);
    setExportError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const url = new URL(`${apiUrl}/api/admin/reports/export/${type}`);

      if (filterParam && filterParam !== 'all') {
        if (type === 'users') {
          url.searchParams.set('role', filterParam);
        } else {
          url.searchParams.set('status', filterParam);
        }
      }

      // Read token from localStorage if available
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      const headers: Record<string, string> = {};
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers,
        credentials: 'include'
      });

      if (!response.ok) {
        let errMessage = `Export failed (${response.status})`;
        try {
          const errData = await response.json();
          if (errData?.error) errMessage = errData.error;
        } catch {
          // not json
        }
        throw new Error(errMessage);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = downloadUrl;

      // Extract filename from response headers or compute fallback
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `km_${type}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename=["']?([^"';]+)["']?/);
        if (match && match[1]) {
          filename = match[1].trim();
        }
      }

      anchor.setAttribute('download', filename);
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(downloadUrl);

      setLastDownloaded(filename);
    } catch (err: any) {
      console.error('Export CSV error:', err);
      setExportError(err?.message || 'Failed to download report.');
    } finally {
      setDownloadingType(null);
    }
  };

  const handleExportAll = async () => {
    setDownloadingType('all');
    setExportError(null);
    try {
      await handleExport('users', userRoleFilter);
      await new Promise((r) => setTimeout(r, 600));
      await handleExport('jobs', jobStatusFilter);
      await new Promise((r) => setTimeout(r, 600));
      await handleExport('revenue', revenueStatusFilter);
    } catch (err: any) {
      setExportError(err?.message || 'Failed during bulk download.');
    } finally {
      setDownloadingType(null);
    }
  };

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* SECTION HEADER - Compact & Clean */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-km-surface-card p-3 sm:p-4 rounded-2xl border border-purple-100/80 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-lg bg-purple-50 text-purple-600 dark:text-purple-400">
              <FileXlsIcon weight="bold" size={15} />
            </div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Reports &amp; Analytics Export
            </h2>
          </div>
          <p className="text-slate-500 text-[11px] sm:text-xs mt-0.5">
            Export live platform logs, job metrics, and financial records directly to CSV.
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {onRefreshStats && (
            <button
              type="button"
              onClick={onRefreshStats}
              className="px-2.5 py-1.5 bg-km-surface-card border border-purple-100 hover:border-purple-200 text-purple-700 rounded-xl text-xs font-semibold shadow-xs hover:shadow-sm transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowsClockwiseIcon weight="bold" size={11} />
              <span>Refresh</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleExportAll}
            disabled={downloadingType !== null}
            className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {downloadingType === 'all' ? (
              <>
                <ArrowsClockwiseIcon weight="bold" size={11} className="animate-spin" />
                <span>Exporting...</span>
              </>
            ) : (
              <>
                <DownloadSimpleIcon weight="bold" size={12} />
                <span>Download All 3</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* FEEDBACK STATUS BANNER */}
      {lastDownloaded && (
        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircleIcon weight="bold" size={13} className="text-emerald-600 shrink-0 dark:text-emerald-400" />
            <span>
              Downloaded <strong>{lastDownloaded}</strong> successfully.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLastDownloaded(null)}
            className="text-emerald-600 hover:text-emerald-800 text-xs font-medium cursor-pointer dark:text-emerald-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {exportError && (
        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-800 text-xs flex items-center justify-between gap-2 shadow-xs">
          <div className="flex items-center gap-2">
            <WarningCircleIcon weight="bold" size={13} className="text-rose-600 shrink-0 dark:text-rose-400" />
            <span>{exportError}</span>
          </div>
          <button
            type="button"
            onClick={() => setExportError(null)}
            className="text-rose-600 hover:text-rose-800 text-xs font-medium cursor-pointer dark:text-rose-400"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* THREE CARDS IN SAME ROW ON MD SCREENS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 sm:gap-3">
        {/* 1. USER LOGS */}
        <div className="bg-km-surface-card rounded-2xl border border-purple-100/80 p-3.5 sm:p-4 shadow-md hover:shadow-lg hover:border-purple-200 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-lg bg-purple-50 text-purple-600 dark:text-purple-400">
                  <UsersIcon weight="bold" size={14} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">User Logs</h3>
              </div>
              <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                {userCount !== undefined ? `${userCount.toLocaleString()} Users` : 'Live'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              User accounts, mobile, email, roles &amp; registration logs.
            </p>

            {/* Filter by role */}
            <div className="space-y-0.5 pt-0.5">
              <label className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                <FunnelSimpleIcon weight="bold" size={9} className="text-purple-600 dark:text-purple-400" />
                Filter Role:
              </label>
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-purple-300 transition-all cursor-pointer"
              >
                <option value="all">All Registered Users</option>
                <option value="user">Candidates / Job Seekers</option>
                <option value="recruiter">Employers / Recruiters</option>
                <option value="expert">Mentors / Experts</option>
              </select>
            </div>

            {/* Included Fields */}
            <div className="pt-0.5">
              <div className="flex flex-wrap gap-1">
                {['ID', 'Name', 'Phone', 'Email', 'Role', 'City', 'Joined'].map((f) => (
                  <span
                    key={f}
                    className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-purple-50">
            <button
              type="button"
              onClick={() => handleExport('users', userRoleFilter)}
              disabled={downloadingType !== null}
              className="w-full py-1.5 px-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {downloadingType === 'users' ? (
                <>
                  <ArrowsClockwiseIcon weight="bold" size={11} className="animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <DownloadSimpleIcon weight="bold" size={12} />
                  <span>Download Logs (.csv)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2. JOB STATISTICS */}
        <div className="bg-km-surface-card rounded-2xl border border-purple-100/80 p-3.5 sm:p-4 shadow-md hover:shadow-lg hover:border-purple-200 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-lg bg-blue-50 text-blue-600 dark:text-blue-400">
                  <BriefcaseIcon weight="bold" size={14} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">Job Statistics</h3>
              </div>
              <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                {jobCount !== undefined ? `${jobCount.toLocaleString()} Jobs` : 'Live'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              Job postings, locations, salaries &amp; applications per job.
            </p>

            {/* Filter by status */}
            <div className="space-y-0.5 pt-0.5">
              <label className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                <FunnelSimpleIcon weight="bold" size={9} className="text-blue-600 dark:text-blue-400" />
                Filter Status:
              </label>
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-purple-300 transition-all cursor-pointer"
              >
                <option value="all">All Jobs</option>
                <option value="active">Active Openings</option>
                <option value="closed">Closed Positions</option>
                <option value="draft">Drafts</option>
              </select>
            </div>

            {/* Included Fields */}
            <div className="pt-0.5">
              <div className="flex flex-wrap gap-1">
                {['ID', 'Title', 'Company', 'City', 'Salary', 'Applications', 'Date'].map((f) => (
                  <span
                    key={f}
                    className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-purple-50">
            <button
              type="button"
              onClick={() => handleExport('jobs', jobStatusFilter)}
              disabled={downloadingType !== null}
              className="w-full py-1.5 px-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {downloadingType === 'jobs' ? (
                <>
                  <ArrowsClockwiseIcon weight="bold" size={11} className="animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <DownloadSimpleIcon weight="bold" size={12} />
                  <span>Download Stats (.csv)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 3. REVENUE & FINANCIAL REPORTS */}
        <div className="bg-km-surface-card rounded-2xl border border-purple-100/80 p-3.5 sm:p-4 shadow-md hover:shadow-lg hover:border-purple-200 transition-all flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="p-1 rounded-lg bg-emerald-50 text-emerald-600 dark:text-emerald-400">
                  <CurrencyInrIcon weight="bold" size={14} />
                </div>
                <h3 className="text-xs sm:text-sm font-bold text-slate-900">Revenue Reports</h3>
              </div>
              <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                {revenueTotal !== undefined ? `₹${revenueTotal.toLocaleString()}` : 'Live'}
              </span>
            </div>

            <p className="text-[11px] text-slate-500 leading-snug">
              Ledger transactions, credits/debits, payments &amp; balances.
            </p>

            {/* Filter by transaction status */}
            <div className="space-y-0.5 pt-0.5">
              <label className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
                <FunnelSimpleIcon weight="bold" size={9} className="text-emerald-600 dark:text-emerald-400" />
                Filter Status:
              </label>
              <select
                value={revenueStatusFilter}
                onChange={(e) => setRevenueStatusFilter(e.target.value)}
                className="w-full text-xs px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-purple-300 transition-all cursor-pointer"
              >
                <option value="all">All Transactions</option>
                <option value="completed">Completed / Settled</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed / Refunded</option>
              </select>
            </div>

            {/* Included Fields */}
            <div className="pt-0.5">
              <div className="flex flex-wrap gap-1">
                {['Tx ID', 'User ID', 'Type', 'Amount', 'Category', 'Balance', 'Date'].map((f) => (
                  <span
                    key={f}
                    className="text-[9px] px-1 py-0.5 rounded bg-slate-100 text-slate-600 font-medium"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-purple-50">
            <button
              type="button"
              onClick={() => handleExport('revenue', revenueStatusFilter)}
              disabled={downloadingType !== null}
              className="w-full py-1.5 px-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {downloadingType === 'revenue' ? (
                <>
                  <ArrowsClockwiseIcon weight="bold" size={11} className="animate-spin" />
                  <span>Generating...</span>
                </>
              ) : (
                <>
                  <DownloadSimpleIcon weight="bold" size={12} />
                  <span>Download Revenue (.csv)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
