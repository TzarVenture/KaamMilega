'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowsClockwiseIcon, BriefcaseIcon, BuildingOfficeIcon, CaretLeftIcon, CaretRightIcon, CheckCircleIcon, CircleNotchIcon, MapPinIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { AdminPageHeader, AdminPanel, ConfirmDialog, EmptyState, FilterTabs, SearchInput, SkeletonRows, StatCard, btn, table } from '@/components/admin/ui';
import api from '@/lib/axios';
import { errorText } from "@/lib/notify";

interface City {
    id: string;
    name: string;
    state?: string;
    country?: string;
    active?: boolean;
    vacancies?: string;
    jobs_count?: number;
    total_vacancies?: number;
}

interface Job {
    id: string;
    title: string;
    company: string;
    salary_min?: number;
    salary_max?: number;
    salary_range?: string;
    location?: string;
    city_name?: string;
    job_type?: string;
    status?: string;
    requirements?: string[];
    applicant_count?: number;
    created_at?: string;
}

function JobCityWiseContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    // The active city is controlled directly by the URL query parameter ?city=...
    const activeCityName = searchParams.get('city') || '';
    const view: 'cities' | 'jobs' = activeCityName ? 'jobs' : 'cities';

    const [cities, setCities] = useState<City[]>([]);
    const [jobs, setJobs] = useState<Job[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [isJobsLoading, setIsJobsLoading] = useState<boolean>(false);
    const [searchTerm, setSearchTerm] = useState<string>('');
    const [filterCategory, setFilterCategory] = useState<'all' | 'with_vacancies'>('all');
    const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [processingJobId, setProcessingJobId] = useState<string | null>(null);
    const [closeTarget, setCloseTarget] = useState<Job | null>(null);

    // Fetch all cities with live vacancy aggregation
    const fetchCities = async () => {
        setIsLoading(true);
        try {
            const response: any = await api.get(`/cities?limit=100&search=${searchTerm}`);
            if (response && Array.isArray(response)) {
                setCities(response);
            } else if (response && response.data) {
                setCities(response.data);
            }
        } catch (error) {
            console.error('Failed to fetch cities:', error);
            setActionMessage({
                type: 'error',
                message: "Couldn't load cities."
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch live jobs for the active city from query param
    const fetchJobsByCity = async (cityName: string) => {
        setIsJobsLoading(true);
        try {
            const cleanName = cityName.trim();
            const response: any = await api.get(`/admin/jobs?city=${encodeURIComponent(cleanName)}&search=${encodeURIComponent(searchTerm)}`);
            const jobList = response?.jobs || response?.data || (Array.isArray(response) ? response : []);
            setJobs(jobList);
        } catch (error) {
            console.error('Failed to fetch jobs by city:', error);
            // Fallback to public endpoint query
            try {
                const fallbackRes: any = await api.get(`/jobs?city=${encodeURIComponent(cityName.trim())}`);
                const fallbackList = fallbackRes?.jobs || fallbackRes?.data || (Array.isArray(fallbackRes) ? fallbackRes : []);
                setJobs(fallbackList);
            } catch {
                setJobs([]);
            }
        } finally {
            setIsJobsLoading(false);
        }
    };

    // Reactively fetch based on URL query param changes
    useEffect(() => {
        if (activeCityName) {
            fetchJobsByCity(activeCityName);
        } else {
            fetchCities();
        }
    }, [activeCityName, searchTerm]);

    // Summary Analytics
    const totalVacanciesCount = useMemo(() => {
        return cities.reduce((acc, c) => acc + (c.jobs_count || 0), 0);
    }, [cities]);

    const topCity = useMemo(() => {
        if (!cities.length) return null;
        return [...cities].sort((a, b) => (b.jobs_count || 0) - (a.jobs_count || 0))[0];
    }, [cities]);

    const selectedCity = useMemo(() => {
        if (!activeCityName) return null;
        return cities.find((c) => c.name.toLowerCase() === activeCityName.toLowerCase()) || {
            id: '',
            name: activeCityName
        };
    }, [cities, activeCityName]);

    const filteredCities = useMemo(() => {
        return cities.filter((c) => {
            const matchesSearch =
                !searchTerm.trim() ||
                c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (c.state || '').toLowerCase().includes(searchTerm.toLowerCase());

            const matchesVacancyFilter =
                filterCategory === 'all' || (c.jobs_count || 0) > 0;

            return matchesSearch && matchesVacancyFilter;
        });
    }, [cities, searchTerm, filterCategory]);

    // Navigate to specific city (updates browser history stack)
    const handleCityClick = (city: City) => {
        setSearchTerm('');
        router.push(`/admin/job-city?city=${encodeURIComponent(city.name.trim())}`);
    };

    // Navigate back to All Cities (updates browser history stack)
    const handleBack = () => {
        setSearchTerm('');
        router.push('/admin/job-city');
    };

    // Close / Remove Job
    const handleCloseJob = async (jobId: string, jobTitle: string) => {

        setProcessingJobId(jobId);
        try {
            await api.patch(`/admin/jobs/${jobId}/status`, { status: 'Closed' });
            setJobs((prev) => prev.filter((j) => j.id !== jobId));
            setActionMessage({
                type: 'success',
                message: `${jobTitle} is closed.`
            });
            if (activeCityName) {
                setCities((prev) =>
                    prev.map((c) =>
                        c.name.toLowerCase() === activeCityName.toLowerCase()
                            ? {
                                  ...c,
                                  jobs_count: Math.max(0, (c.jobs_count || 1) - 1),
                                  vacancies: `${Math.max(0, (c.jobs_count || 1) - 1)} Active Vacancies`
                              }
                            : c
                    )
                );
            }
        } catch (error: any) {
            console.error('Job removal failed:', error);
            setActionMessage({
                type: 'error',
                message: errorText(error, 'Failed to update job status.')
            });
        } finally {
            setProcessingJobId(null);
        }
    };

    const banner = actionMessage && (
        <div
            role={actionMessage.type === 'error' ? 'alert' : 'status'}
            className={`mb-4 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border text-sm ${
                actionMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' : 'bg-red-50 border-red-200 text-red-800'
            }`}
        >
            <span className="flex items-center gap-2">
                {actionMessage.type === 'success'
                    ? <CheckCircleIcon size={18} className="text-emerald-600 shrink-0" aria-hidden="true" />
                    : <WarningCircleIcon size={18} className="text-red-600 shrink-0" aria-hidden="true" />}
                {actionMessage.message}
            </span>
            <button type="button" onClick={() => setActionMessage(null)} className="text-sm font-medium hover:underline cursor-pointer">Dismiss</button>
        </div>
    );

    if (view === 'jobs') {
        return (
            <div>
                <button type="button" onClick={handleBack} className="inline-flex items-center gap-1.5 mb-4 text-sm font-medium text-km-link hover:underline cursor-pointer">
                    <CaretLeftIcon size={14} weight="bold" aria-hidden="true" />
                    All cities
                </button>
                <AdminPageHeader
                    title={`Jobs in ${selectedCity?.name || activeCityName}`}
                    description={[selectedCity?.state, selectedCity?.country].filter(Boolean).join(', ') || undefined}
                />
                {banner}
                <AdminPanel>
                    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-km-border-subtle">
                        <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search job title or company" className="w-full sm:max-w-sm" />
                        {!isJobsLoading && <span className="hidden sm:inline text-sm text-km-text-secondary font-inter">{jobs.length} jobs</span>}
                    </div>
                    {isJobsLoading ? (
                        <SkeletonRows rows={5} />
                    ) : jobs.length === 0 ? (
                        <EmptyState icon={BriefcaseIcon} title="No open jobs in this city" />
                    ) : (
                        <div className={table.wrap}>
                            <table className={table.table}>
                                <thead>
                                    <tr>
                                        <th className={table.th}>Job</th>
                                        <th className={table.th}>Salary</th>
                                        <th className={`${table.th} text-right`}>Applicants</th>
                                        <th className={table.th}>Posted</th>
                                        <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {jobs.map((job) => (
                                        <tr key={job.id} className={table.row}>
                                            <td className={table.td}>
                                                <p className="font-medium text-km-heading">{job.title}</p>
                                                <p className="text-xs text-km-text-secondary">{[job.company, job.job_type].filter(Boolean).join(' · ')}</p>
                                            </td>
                                            <td className={`${table.td} whitespace-nowrap font-inter`}>
                                                {job.salary_min && job.salary_max
                                                    ? `₹${job.salary_min.toLocaleString('en-IN')} – ₹${job.salary_max.toLocaleString('en-IN')}`
                                                    : job.salary_range || 'Not disclosed'}
                                            </td>
                                            <td className={`${table.td} text-right font-inter tabular-nums`}>{job.applicant_count ?? 0}</td>
                                            <td className={`${table.td} whitespace-nowrap text-km-text-secondary font-inter`}>
                                                {job.created_at ? new Date(job.created_at).toLocaleDateString('en-IN') : '–'}
                                            </td>
                                            <td className={`${table.td} text-right`}>
                                                <button
                                                    type="button"
                                                    onClick={() => setCloseTarget(job)}
                                                    disabled={processingJobId === job.id}
                                                    className={`${btn.secondary} h-9 px-3`}
                                                >
                                                    {processingJobId === job.id ? <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" /> : null}
                                                    Close job
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </AdminPanel>

                {closeTarget && (
                    <ConfirmDialog
                        title={`Close "${closeTarget.title}"?`}
                        description="It stops taking applications and leaves the job listings."
                        confirmLabel="Close job"
                        busy={processingJobId === closeTarget.id}
                        onCancel={() => setCloseTarget(null)}
                        onConfirm={async () => {
                            await handleCloseJob(closeTarget.id, closeTarget.title);
                            setCloseTarget(null);
                        }}
                    />
                )}
            </div>
        );
    }

    return (
        <div>
            <AdminPageHeader
                title="Jobs by city"
                description="Open jobs in each city"
                actions={
                    <button type="button" onClick={fetchCities} disabled={isLoading} className={btn.secondary}>
                        <ArrowsClockwiseIcon size={16} className={isLoading ? 'animate-spin' : ''} aria-hidden="true" />
                        Refresh
                    </button>
                }
            />
            {banner}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                <StatCard label="Cities" value={isLoading ? '–' : cities.length} icon={MapPinIcon} />
                <StatCard label="Open jobs" value={isLoading ? '–' : totalVacanciesCount} icon={BriefcaseIcon} iconClassName="text-km-jobs-text" />
                <StatCard label="Most jobs" value={isLoading ? '–' : (topCity && (topCity.jobs_count || 0) > 0 ? topCity.name : '–')}
                    hint={topCity && (topCity.jobs_count || 0) > 0 ? `${topCity.jobs_count} open jobs` : undefined} icon={BuildingOfficeIcon} />
            </div>

            <AdminPanel>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between px-5 py-4 border-b border-km-border-subtle">
                    <FilterTabs
                        value={filterCategory}
                        onChange={setFilterCategory}
                        options={[
                            { value: 'all', label: 'All cities' },
                            { value: 'with_vacancies', label: 'With open jobs' },
                        ]}
                    />
                    <SearchInput value={searchTerm} onChange={setSearchTerm} placeholder="Search city or state" className="w-full sm:w-72" />
                </div>

                {isLoading ? (
                    <SkeletonRows rows={6} />
                ) : filteredCities.length === 0 ? (
                    <EmptyState icon={MapPinIcon} title="No cities found" description="Try a different search or filter." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>City</th>
                                    <th className={table.th}>State</th>
                                    <th className={`${table.th} text-right`}>Open jobs</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Open</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredCities.map((city) => (
                                    <tr key={city.id || city.name} className={`${table.row} cursor-pointer`} onClick={() => handleCityClick(city)}>
                                        <td className={`${table.td} font-medium text-km-heading`}>{city.name}</td>
                                        <td className={`${table.td} text-km-text-secondary`}>{city.state || '–'}</td>
                                        <td className={`${table.td} text-right font-inter tabular-nums`}>{city.jobs_count || 0}</td>
                                        <td className={`${table.td} text-right`}>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); handleCityClick(city); }} className="inline-flex items-center gap-1 text-sm font-medium text-km-link hover:underline cursor-pointer">
                                                View jobs
                                                <CaretRightIcon size={14} aria-hidden="true" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>
        </div>
    );
}

export default function JobCityWisePage() {
    return (
        <Suspense fallback={<SkeletonRows rows={6} />}>
            <JobCityWiseContent />
        </Suspense>
    );
}
