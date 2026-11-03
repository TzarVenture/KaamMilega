'use client';

import React, { useState } from 'react';
import type { Icon } from '@phosphor-icons/react';
import { BriefcaseIcon, CheckCircleIcon, CircleNotchIcon, CurrencyInrIcon, DownloadSimpleIcon, UsersIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { btn, field } from '@/components/admin/ui';

type ReportType = 'users' | 'jobs' | 'revenue';

interface ReportsExportSectionProps {
  userCount?: number;
  jobCount?: number;
  revenueTotal?: number;
}

const REPORTS: {
  type: ReportType;
  title: string;
  description: string;
  icon: Icon;
  iconClassName: string;
  filterLabel: string;
  options: { value: string; label: string }[];
  fields: string[];
}[] = [
  {
    type: 'users',
    title: 'Users',
    description: 'Accounts with contact details, roles and sign-up date.',
    icon: UsersIcon,
    iconClassName: 'text-km-link',
    filterLabel: 'Role',
    options: [
      { value: 'all', label: 'All users' },
      { value: 'user', label: 'Jobseekers' },
      { value: 'recruiter', label: 'Employers' },
      { value: 'expert', label: 'Experts' },
    ],
    fields: ['ID', 'Name', 'Phone', 'Email', 'Role', 'City', 'Joined'],
  },
  {
    type: 'jobs',
    title: 'Jobs',
    description: 'Job posts with location, salary and applications.',
    icon: BriefcaseIcon,
    iconClassName: 'text-km-jobs-text',
    filterLabel: 'Status',
    options: [
      { value: 'all', label: 'All jobs' },
      { value: 'active', label: 'Active' },
      { value: 'closed', label: 'Closed' },
      { value: 'draft', label: 'Drafts' },
    ],
    fields: ['ID', 'Title', 'Company', 'City', 'Salary', 'Applications', 'Date'],
  },
  {
    type: 'revenue',
    title: 'Revenue',
    description: 'Wallet transactions with amounts and balances.',
    icon: CurrencyInrIcon,
    iconClassName: 'text-km-skills-text',
    filterLabel: 'Status',
    options: [
      { value: 'all', label: 'All transactions' },
      { value: 'completed', label: 'Completed' },
      { value: 'pending', label: 'Pending' },
      { value: 'failed', label: 'Failed or refunded' },
    ],
    fields: ['Transaction ID', 'User ID', 'Type', 'Amount', 'Category', 'Balance', 'Date'],
  },
];

export default function ReportsExportSection({ userCount, jobCount, revenueTotal }: ReportsExportSectionProps) {
  const [filters, setFilters] = useState<Record<ReportType, string>>({ users: 'all', jobs: 'all', revenue: 'all' });
  const [downloading, setDownloading] = useState<ReportType | 'all' | null>(null);
  const [lastDownloaded, setLastDownloaded] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const totals: Record<ReportType, string | undefined> = {
    users: userCount !== undefined ? `${userCount.toLocaleString('en-IN')} users` : undefined,
    jobs: jobCount !== undefined ? `${jobCount.toLocaleString('en-IN')} jobs` : undefined,
    revenue: revenueTotal !== undefined ? `₹${revenueTotal.toLocaleString('en-IN')}` : undefined,
  };

  // Returns false when the download failed (the error is shown)
  const exportReport = async (type: ReportType): Promise<boolean> => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const url = new URL(`${apiUrl}/api/admin/reports/export/${type}`);
      const filter = filters[type];
      if (filter !== 'all') url.searchParams.set(type === 'users' ? 'role' : 'status', filter);

      const token = localStorage.getItem('token');
      const response = await fetch(url.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
      if (!response.ok) {
        let message = `Export failed (${response.status})`;
        try {
          const data = await response.json();
          if (data?.error) message = data.error;
        } catch { /* not JSON */ }
        throw new Error(message);
      }

      const blob = await response.blob();
      let filename = `km_${type}_report_${new Date().toISOString().slice(0, 10)}.csv`;
      const match = response.headers.get('content-disposition')?.match(/filename=["']?([^"';]+)["']?/);
      if (match?.[1]) filename = match[1].trim();

      const href = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = href;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);
      setLastDownloaded(filename);
      return true;
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Couldn't download the report.");
      return false;
    }
  };

  const run = async (type: ReportType | 'all') => {
    setDownloading(type);
    setExportError(null);
    setLastDownloaded(null);
    if (type === 'all') {
      for (const r of REPORTS) {
        if (!(await exportReport(r.type))) break;
        // Browsers block several downloads fired at once
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    } else {
      await exportReport(type);
    }
    setDownloading(null);
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-km-heading">CSV exports</h2>
          <p className="text-sm text-km-text-secondary mt-0.5">Download platform data for reporting and audits.</p>
        </div>
        <button type="button" onClick={() => run('all')} disabled={downloading !== null} className={btn.secondary}>
          {downloading === 'all'
            ? <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />
            : <DownloadSimpleIcon size={16} aria-hidden="true" />}
          Download all three
        </button>
      </div>

      {lastDownloaded && (
        <div role="status" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          <CheckCircleIcon size={18} className="text-emerald-600 shrink-0" aria-hidden="true" />
          Downloaded {lastDownloaded}
        </div>
      )}
      {exportError && (
        <div role="alert" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-800">
          <WarningCircleIcon size={18} className="text-red-600 shrink-0" aria-hidden="true" />
          {exportError}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {REPORTS.map((r) => (
          <div key={r.type} className="flex flex-col bg-km-surface-card border border-km-border rounded-2xl p-5">
            <div className="flex items-center gap-2.5">
              <r.icon size={22} weight="duotone" className={r.iconClassName} aria-hidden="true" />
              <h3 className="text-base font-semibold text-km-heading">{r.title}</h3>
              {totals[r.type] && <span className="ml-auto text-xs text-km-text-secondary font-inter">{totals[r.type]}</span>}
            </div>
            <p className="mt-2 text-sm text-km-text-secondary">{r.description}</p>

            <label className="mt-4">
              <span className={field.label}>{r.filterLabel}</span>
              <select
                value={filters[r.type]}
                onChange={(e) => setFilters((f) => ({ ...f, [r.type]: e.target.value }))}
                className={`${field.input} cursor-pointer`}
              >
                {r.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </label>

            <p className="mt-3 text-xs text-km-text-secondary">Columns: {r.fields.join(', ')}</p>

            <button type="button" onClick={() => run(r.type)} disabled={downloading !== null} className={`${btn.primary} mt-5 w-full`}>
              {downloading === r.type
                ? <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />
                : <DownloadSimpleIcon size={16} aria-hidden="true" />}
              Download CSV
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
