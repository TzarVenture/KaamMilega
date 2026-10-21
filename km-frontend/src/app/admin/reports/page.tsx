'use client';

import React, { useState, useEffect } from 'react';
import ReportsExportSection from '@/components/admin/ReportsExportSection';
import api from '@/lib/axios';
import { FileSpreadsheet, ArrowLeft, RefreshCw, Database, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

export default function AdminReportsPage() {
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res: any = await api.get('/platform/stats');
      const data = res?.stats || res || {};
      setStats(data);
    } catch (err) {
      console.error('Failed to load stats for reports page:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  return (
    <div className="space-y-6 pb-12">
      {/* Breadcrumb & Subheader */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
          <Link href="/admin" className="hover:text-purple-600 transition-colors flex items-center gap-1">
            <ArrowLeft size={13} />
            <span>Admin Overview</span>
          </Link>
          <span>/</span>
          <span className="text-purple-700 font-semibold">Reports &amp; Analytics Export</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
            <ShieldCheck size={13} className="text-emerald-500" />
            Admin Role Verified
          </span>
        </div>
      </div>

      {/* Main Reports & Export Panel */}
      <ReportsExportSection
        userCount={stats?.total_users}
        jobCount={stats?.jobs}
        revenueTotal={stats?.revenue}
        onRefreshStats={fetchStats}
      />
    </div>
  );
}
