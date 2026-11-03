'use client';

import React, { useState, useEffect } from 'react';
import ReportsExportSection from '@/components/admin/ReportsExportSection';
import { AdminPageHeader } from '@/components/admin/ui';
import api from '@/lib/axios';

interface ReportStats {
  total_users?: number;
  jobs?: number;
  revenue?: number;
}

export default function AdminReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null);

  useEffect(() => {
    api.get<unknown, { stats?: ReportStats } & ReportStats>('/platform/stats')
      .then((res: { stats?: ReportStats } & ReportStats) => setStats(res?.stats || res || {}))
      .catch(() => setStats({}));
  }, []);

  return (
    <div>
      <AdminPageHeader title="Reports" description="Export users, jobs and revenue as CSV" />
      <ReportsExportSection userCount={stats?.total_users} jobCount={stats?.jobs} revenueTotal={stats?.revenue} />
    </div>
  );
}
