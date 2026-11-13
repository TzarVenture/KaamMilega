'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    ArrowsClockwiseIcon,
    BriefcaseIcon,
    CaretLeftIcon,
    CircleNotchIcon,
    PauseCircleIcon,
    PlayCircleIcon,
    TrashIcon,
    UsersIcon,
} from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import api from '@/lib/axios';
import Pagination from '@/components/ui/Pagination';
import {
    AdminPageHeader, AdminPanel, ConfirmDialog, EmptyState, FilterTabs, LogoTile, MenuItem, RowMenu,
    SearchInput, SkeletonRows, StatCard, StatusBadge, btn, table,
} from '@/components/admin/ui';

interface AdminJob {
    id: string;
    title: string;
    company: string;
    salary: string;
    location: string;
    type: string;
    status: 'Active' | 'Closed';
    candidatesCount: number;
    postedAt: string;
}

interface Applicant {
    id: string;
    userId?: string;
    name: string;
    role: string;
    location: string;
    status: string;
    photo?: string;
}

type ApiRecord = Record<string, any>;

function JobsContent() {
    const searchParams = useSearchParams();
    const [jobs, setJobs] = useState<AdminJob[]>([]);
    const [isLoadingJobs, setIsLoadingJobs] = useState(true);
    const [candidates, setCandidates] = useState<Applicant[]>([]);
    const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');

    useEffect(() => {
        const q = searchParams.get('search');
        if (q !== null) setSearchQuery(q);
    }, [searchParams]);

    const [view, setView] = useState<'jobs' | 'candidates'>('jobs');
    const [selectedJob, setSelectedJob] = useState<AdminJob | null>(null);
    const [processingJobId, setProcessingJobId] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<AdminJob | null>(null);

    const fetchJobs = async () => {
        setIsLoadingJobs(true);
        try {
            const response = await api.get<unknown, ApiRecord>('/jobs');
            const data = response?.jobs || response;
            const jobsData: ApiRecord[] = Array.isArray(data) ? data : (data?.jobs || []);
            setJobs(jobsData.map((job) => ({
                id: job.id,
                title: job.title || 'Untitled role',
                company: job.company_name || job.company || 'Direct employer',
                salary: job.salary_min && job.salary_max
                    ? `₹${Number(job.salary_min).toLocaleString('en-IN')} – ₹${Number(job.salary_max).toLocaleString('en-IN')}`
                    : (job.salary_range || 'Not disclosed'),
                location: job.location || job.city_name || 'Flexible',
                type: job.job_type || 'Full time',
                status: (job.status || 'active').toLowerCase() === 'closed' ? 'Closed' : 'Active',
                candidatesCount: Number(job.applications_count || job.candidates_count || 0),
                postedAt: job.created_at ? new Date(job.created_at).toLocaleDateString('en-IN') : '–',
            })));
        } catch (err) {
            console.error('Failed to fetch jobs:', err);
            notify.error("Couldn't load jobs");
        } finally {
            setIsLoadingJobs(false);
        }
    };

    useEffect(() => {
        fetchJobs();
    }, []);

    const handleToggleStatus = async (job: AdminJob) => {
        const nextStatus = job.status === 'Active' ? 'Closed' : 'Active';
        setProcessingJobId(job.id);
        try {
            await api.patch(`/admin/jobs/${job.id}/status`, { status: nextStatus.toLowerCase() });
            setJobs((prev) => prev.map((item) => (item.id === job.id ? { ...item, status: nextStatus } : item)));
            notify.success(nextStatus === 'Closed' ? `"${job.title}" is closed` : `"${job.title}" is open again`);
        } catch (error) {
            console.error('Failed to update job status:', error);
            notify.error(error, "Couldn't update the job");
        } finally {
            setProcessingJobId(null);
        }
    };

    const handleDeleteJob = async (job: AdminJob) => {
        setProcessingJobId(job.id);
        try {
            await api.delete(`/admin/jobs/${job.id}`);
            setJobs((prev) => prev.filter((item) => item.id !== job.id));
            notify.success(`"${job.title}" deleted`);
            setDeleteTarget(null);
        } catch (error) {
            console.error('Failed to delete job:', error);
            notify.error(error, "Couldn't delete the job");
        } finally {
            setProcessingJobId(null);
        }
    };

    const handleViewCandidates = async (job: AdminJob) => {
        setSelectedJob(job);
        setView('candidates');
        setIsLoadingCandidates(true);
        try {
            const applications = (await api.get<unknown, ApiRecord[]>(`/applications/job/${job.id}`)) || [];
            const enriched = await Promise.all(applications.map(async (app): Promise<Applicant> => {
                const base = { id: app.id, userId: app.candidate_id, status: app.status || 'Applied' };
                try {
                    const user = await api.get<unknown, ApiRecord>(`/user/${app.candidate_id}`);
                    return {
                        ...base,
                        name: user.name || 'Candidate',
                        role: user.headline || '',
                        location: user.city || '',
                        photo: user.profile_image || undefined,
                    };
                } catch {
                    return { ...base, name: 'Candidate', role: '', location: '' };
                }
            }));
            setCandidates(enriched);
        } catch (err) {
            console.error('Failed to load applications:', err);
            notify.error(err, "Applications couldn’t be loaded.");
            setCandidates([]);
        } finally {
            setIsLoadingCandidates(false);
        }
    };

    const filteredJobs = jobs.filter((job) => {
        if (statusFilter === 'active' && job.status !== 'Active') return false;
        if (statusFilter === 'closed' && job.status !== 'Closed') return false;
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return [job.title, job.company, job.location, job.type, job.salary].some((v) => v.toLowerCase().includes(q));
    });

    const ITEMS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        setCurrentPage(1);
    }, [statusFilter, searchQuery]);

    const totalJobsCount = jobs.length;
    const activeJobsCount = jobs.filter((j) => j.status === 'Active').length;
    const closedJobsCount = jobs.filter((j) => j.status === 'Closed').length;
    const totalApplicationsCount = jobs.reduce((acc, j) => acc + j.candidatesCount, 0);

    const totalPages = Math.max(1, Math.ceil(filteredJobs.length / ITEMS_PER_PAGE));
    const paginatedJobs = filteredJobs.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
    const startIndex = filteredJobs.length === 0 ? 0 : (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * ITEMS_PER_PAGE, filteredJobs.length);

    if (view === 'candidates' && selectedJob) {
        return (
            <div>
                <button type="button" onClick={() => setView('jobs')} className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-km-link hover:underline cursor-pointer">
                    <CaretLeftIcon size={14} weight="bold" aria-hidden="true" />
                    All jobs
                </button>
                <AdminPageHeader
                    title={selectedJob.title}
                    description={[selectedJob.company, selectedJob.location, selectedJob.salary].filter(Boolean).join(' · ')}
                />
                <AdminPanel title="Applicants" actions={<span className="text-sm text-km-text-secondary font-inter">{candidates.length}</span>}>
                    {isLoadingCandidates ? (
                        <SkeletonRows rows={4} />
                    ) : candidates.length === 0 ? (
                        <EmptyState icon={UsersIcon} title="No applicants yet" description="Applications for this job will appear here." />
                    ) : (
                        <ul className="divide-y divide-km-border-subtle">
                            {candidates.map((c) => (
                                <li key={c.id} className="flex items-center gap-3 px-5 py-3.5">
                                    <LogoTile src={c.photo} name={c.name} rounded="rounded-full" />
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-km-heading truncate">{c.name}</p>
                                        <p className="text-xs text-km-text-secondary truncate">{[c.role, c.location].filter(Boolean).join(' · ')}</p>
                                    </div>
                                    <StatusBadge tone="blue">{c.status}</StatusBadge>
                                    {c.userId && (
                                        <a href={`/profile/${c.userId}`} target="_blank" rel="noopener noreferrer" className={`${btn.secondary} h-9 px-3`}>
                                            View profile
                                        </a>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </AdminPanel>
            </div>
        );
    }

    return (
        <div>
            <AdminPageHeader
                title="Jobs"
                description="Moderate job posts across all employers"
                actions={
                    <button type="button" onClick={fetchJobs} disabled={isLoadingJobs} className={btn.secondary}>
                        <ArrowsClockwiseIcon size={16} className={isLoadingJobs ? 'animate-spin' : ''} aria-hidden="true" />
                        Refresh
                    </button>
                }
            />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard label="All jobs" value={isLoadingJobs ? '–' : totalJobsCount} icon={BriefcaseIcon} iconClassName="text-km-jobs-text" />
                <StatCard label="Active" value={isLoadingJobs ? '–' : activeJobsCount} icon={PlayCircleIcon} iconClassName="text-emerald-600" />
                <StatCard label="Closed" value={isLoadingJobs ? '–' : closedJobsCount} icon={PauseCircleIcon} iconClassName="text-km-text-secondary" />
                <StatCard label="Applications" value={isLoadingJobs ? '–' : totalApplicationsCount} icon={UsersIcon} />
            </div>

            <AdminPanel>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-km-border-subtle">
                    <FilterTabs
                        value={statusFilter}
                        onChange={setStatusFilter}
                        options={[
                            { value: 'all', label: 'All', count: totalJobsCount },
                            { value: 'active', label: 'Active', count: activeJobsCount },
                            { value: 'closed', label: 'Closed', count: closedJobsCount },
                        ]}
                    />
                    <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search title, company or city" className="w-full lg:w-80" />
                </div>

                {isLoadingJobs ? (
                    <SkeletonRows rows={6} />
                ) : paginatedJobs.length === 0 ? (
                    <EmptyState icon={BriefcaseIcon} title="No jobs found" description="Try a different search or filter." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Job</th>
                                    <th className={table.th}>Location</th>
                                    <th className={table.th}>Salary</th>
                                    <th className={`${table.th} text-right`}>Applicants</th>
                                    <th className={table.th}>Posted</th>
                                    <th className={table.th}>Status</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedJobs.map((job) => (
                                    <tr key={job.id} className={table.row}>
                                        <td className={table.td}>
                                            <div className="min-w-[220px]">
                                                <button type="button" onClick={() => handleViewCandidates(job)} className="font-medium text-km-heading hover:text-km-link text-left cursor-pointer">
                                                    {job.title}
                                                </button>
                                                <p className="text-xs text-km-text-secondary">{job.company} · {job.type}</p>
                                            </div>
                                        </td>
                                        <td className={`${table.td} text-km-text-secondary max-w-[200px] truncate`} title={job.location}>{job.location}</td>
                                        <td className={`${table.td} whitespace-nowrap font-inter`}>{job.salary}</td>
                                        <td className={`${table.td} text-right font-inter tabular-nums`}>{job.candidatesCount}</td>
                                        <td className={`${table.td} whitespace-nowrap text-km-text-secondary font-inter`}>{job.postedAt}</td>
                                        <td className={table.td}>
                                            <StatusBadge tone={job.status === 'Active' ? 'green' : 'neutral'}>{job.status}</StatusBadge>
                                        </td>
                                        <td className={`${table.td} text-right`}>
                                            {processingJobId === job.id ? (
                                                <CircleNotchIcon size={18} className="inline animate-spin text-km-text-muted mx-2.5" aria-label="Updating" />
                                            ) : (
                                                <RowMenu label={`Actions for ${job.title}`}>
                                                    {() => (
                                                        <>
                                                            <MenuItem icon={UsersIcon} onClick={() => handleViewCandidates(job)}>View applicants</MenuItem>
                                                            <MenuItem icon={job.status === 'Active' ? PauseCircleIcon : PlayCircleIcon} onClick={() => handleToggleStatus(job)}>
                                                                {job.status === 'Active' ? 'Close job' : 'Reopen job'}
                                                            </MenuItem>
                                                            <div className="my-1 border-t border-km-border-subtle" />
                                                            <MenuItem icon={TrashIcon} danger onClick={() => setDeleteTarget(job)}>Delete job</MenuItem>
                                                        </>
                                                    )}
                                                </RowMenu>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4">
                        <p className="text-sm text-km-text-secondary">{startIndex}–{endIndex} of {filteredJobs.length}</p>
                        <Pagination current={currentPage} total={totalPages} onPageChange={setCurrentPage} />
                    </div>
                )}
            </AdminPanel>

            {deleteTarget && (
                <ConfirmDialog
                    title="Delete this job?"
                    description={`"${deleteTarget.title}" and its listing will be removed. This can't be undone.`}
                    confirmLabel="Delete job"
                    busy={processingJobId === deleteTarget.id}
                    onCancel={() => setDeleteTarget(null)}
                    onConfirm={() => handleDeleteJob(deleteTarget)}
                />
            )}
        </div>
    );
}

export default function JobsPage() {
    return (
        <Suspense fallback={<SkeletonRows rows={6} />}>
            <JobsContent />
        </Suspense>
    );
}
