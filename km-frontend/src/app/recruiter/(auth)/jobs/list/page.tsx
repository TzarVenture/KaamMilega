"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { BriefcaseIcon, CaretLeftIcon, CaretRightIcon, MagnifyingGlassIcon, PlusIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { recruiterApi, type MyJob, type MyJobsPage } from "@/lib/api/recruiter";
import { EmptyState, FilterTabs, SearchInput, SkeletonRows, btn, cx } from "@/components/admin/ui";
import JobStatusChip from "@/components/recruiter/JobStatusChip";
import StageBar from "@/components/recruiter/StageBar";
import JobActionsMenu from "@/components/recruiter/JobActionsMenu";
import { salaryRange } from "@/components/recruiter/jobFormat";

const LIMIT = 20;
type Tab = "all" | "open" | "paused" | "closed";
const TABS: Tab[] = ["all", "open", "paused", "closed"];

export default function JobsListPage() {
    return (
        <Suspense fallback={<div className="max-w-7xl mx-auto"><SkeletonRows rows={6} /></div>}>
            <JobsList />
        </Suspense>
    );
}

function JobsList() {
    const t = useTranslations("recruiterJobs");
    const format = useFormatter();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const tab = (TABS.includes(params.get("status") as Tab) ? params.get("status") : "all") as Tab;
    const search = params.get("q") || "";
    const page = Math.max(1, Number(params.get("page")) || 1);

    const [query, setQuery] = useState(search);
    const [data, setData] = useState<MyJobsPage | null>(null);
    const [error, setError] = useState(false);
    const [loading, setLoading] = useState(true);
    const [reload, setReload] = useState(0);

    const setParams = useCallback((next: Record<string, string | number | null>) => {
        const sp = new URLSearchParams(params.toString());
        for (const [k, v] of Object.entries(next)) {
            if (v === null || v === "" || (k === "page" && v === 1) || (k === "status" && v === "all")) sp.delete(k);
            else sp.set(k, String(v));
        }
        const qs = sp.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [params, pathname, router]);

    // Debounced search into the URL
    const firstRun = useRef(true);
    useEffect(() => {
        if (firstRun.current) { firstRun.current = false; return; }
        const id = setTimeout(() => { if (query.trim() !== search) setParams({ q: query.trim(), page: 1 }); }, 350);
        return () => clearTimeout(id);
    }, [query, search, setParams]);

    useEffect(() => {
        let alive = true;
        recruiterApi.jobs({ search, status: tab === "all" ? undefined : tab, page, limit: LIMIT })
            .then((res) => { if (alive) { setData(res); setError(false); } })
            .catch(() => { if (alive) setError(true); })
            .finally(() => { if (alive) setLoading(false); });
        return () => { alive = false; };
    }, [search, tab, page, reload]);

    const refetch = () => { setLoading(true); setReload((n) => n + 1); };

    const refreshCounts = () => {
        recruiterApi.jobs({ search, status: tab === "all" ? undefined : tab, page, limit: 1 })
            .then((res) => setData((d) => (d ? { ...d, counts: res.counts, total: res.total } : d)))
            .catch(() => {});
    };

    const onUpdated = (job: MyJob) => {
        setData((d) => d ? { ...d, jobs: d.jobs.map((j) => (j.id === job.id ? job : j)) } : d);
        refreshCounts();
    };
    const onDeleted = (id: string) => {
        setData((d) => d ? { ...d, jobs: d.jobs.filter((j) => j.id !== id) } : d);
        refreshCounts();
    };

    const counts = data?.counts;
    const totalPages = data ? Math.max(1, Math.ceil(data.total / LIMIT)) : 1;
    const filtered = !!search || tab !== "all";

    return (
        <div className="max-w-7xl mx-auto">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-6">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-km-heading tracking-tight">{t("list.title")}</h1>
                    <p className="mt-1 text-sm text-km-text-secondary">{t("list.description")}</p>
                </div>
                <Link href="/recruiter/jobs/create" className={cx(btn.accent, "self-start sm:self-auto")}>
                    <PlusIcon size={18} weight="bold" aria-hidden="true" />
                    {t("list.post")}
                </Link>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
                <div className="overflow-x-auto max-w-full">
                    <FilterTabs<Tab>
                        value={tab}
                        onChange={(v) => { setLoading(true); setParams({ status: v, page: 1 }); }}
                        options={TABS.map((v) => ({ value: v, label: t(`tabs.${v}`), count: counts?.[v] }))}
                    />
                </div>
                <SearchInput value={query} onChange={setQuery} placeholder={t("list.search")} className="w-full lg:max-w-xs lg:ml-auto" />
            </div>

            <section className="bg-km-surface-card border border-km-border rounded-2xl overflow-hidden">
                {/* Column heads (desktop) */}
                <div className="hidden md:grid grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto_2.5rem] gap-4 px-5 py-3 text-xs font-semibold text-km-text-secondary bg-km-surface border-b border-km-border">
                    <span>{t("list.colJob")}</span>
                    <span>{t("list.colStatus")}</span>
                    <span>{t("list.colPipeline")}</span>
                    <span className="text-right">{t("list.colApplicants")}</span>
                    <span className="sr-only">{t("list.colActions")}</span>
                </div>

                {loading && !data ? (
                    <SkeletonRows rows={6} />
                ) : error ? (
                    <div className="flex flex-col items-center text-center py-12 px-6" role="alert">
                        <WarningCircleIcon size={32} weight="duotone" className="text-red-500 mb-2" aria-hidden="true" />
                        <p className="text-sm font-semibold text-km-heading">{t("list.loadFailed")}</p>
                        <button type="button" onClick={refetch} className={cx(btn.secondary, "mt-4")}>{t("retry")}</button>
                    </div>
                ) : !data || data.jobs.length === 0 ? (
                    filtered ? (
                        <EmptyState
                            icon={MagnifyingGlassIcon}
                            title={t("list.noMatch")}
                            description={t("list.noMatchHint")}
                            action={<button type="button" className={btn.secondary} onClick={() => { setQuery(""); setParams({ q: null, status: null, page: 1 }); }}>{t("list.clearFilters")}</button>}
                        />
                    ) : (
                        <EmptyState
                            icon={BriefcaseIcon}
                            title={t("list.emptyTitle")}
                            description={t("list.emptyHint")}
                            action={<Link href="/recruiter/jobs/create" className={btn.accent}><PlusIcon size={18} weight="bold" aria-hidden="true" />{t("list.postFirst")}</Link>}
                        />
                    )
                ) : (
                    <ul className={cx("divide-y divide-km-border-subtle", loading && "opacity-60")} aria-busy={loading}>
                        {data.jobs.map((job) => {
                            const salary = salaryRange(job.salary_min, job.salary_max);
                            const meta = [
                                job.city_name || job.location,
                                job.job_type,
                                salary ? t("salaryMonth", { amount: salary }) : t("salaryNotSet"),
                            ].filter(Boolean).join(" · ");
                            return (
                                <li key={job.id} className="relative grid grid-cols-[minmax(0,1fr)_2.5rem] md:grid-cols-[minmax(0,2.2fr)_minmax(0,1fr)_minmax(0,1.6fr)_auto_2.5rem] gap-x-4 gap-y-3 px-4 md:px-5 py-4 hover:bg-km-surface transition-colors">
                                    <div className="min-w-0">
                                        <Link href={`/recruiter/jobs/${job.id}`} className="block font-semibold text-km-heading hover:text-km-link truncate">
                                            {job.title}
                                        </Link>
                                        <p className="mt-0.5 text-xs text-km-text-secondary truncate">{meta}</p>
                                        <p className="mt-0.5 text-xs text-km-text-muted">
                                            {t("posted", { date: format.dateTime(new Date(job.created_at), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) })}
                                        </p>
                                    </div>
                                    <div className="row-start-1 col-start-2 md:col-start-5 flex justify-end md:items-center">
                                        <JobActionsMenu job={job} onUpdated={onUpdated} onDeleted={onDeleted} />
                                    </div>
                                    <div className="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1 flex items-center gap-3 md:block">
                                        <JobStatusChip status={job.status} />
                                    </div>
                                    <div className="col-span-2 md:col-span-1 md:col-start-3 md:row-start-1 flex items-center">
                                        <StageBar counts={job.stage_counts} className="w-full" />
                                    </div>
                                    <div className="col-span-2 md:col-span-1 md:col-start-4 md:row-start-1 flex flex-wrap md:flex-col md:items-end md:justify-center items-center gap-x-3">
                                        <Link href={`/recruiter/applications?job_id=${job.id}`} className="text-sm font-medium text-km-link hover:underline whitespace-nowrap">
                                            {t("applicants", { count: job.applicant_count || 0 })}
                                        </Link>
                                        <span className="text-xs text-km-text-secondary whitespace-nowrap">{t("reach.viewCount", { count: job.views?.total ?? 0 })}</span>
                                    </div>
                                </li>
                            );
                        })}
                    </ul>
                )}

                {data && data.total > LIMIT && (
                    <div className="flex items-center justify-between gap-3 px-4 md:px-5 py-3 border-t border-km-border-subtle text-sm text-km-text-secondary">
                        <span>{t("list.pageOf", { page, pages: totalPages, total: data.total })}</span>
                        <div className="flex gap-1">
                            <button type="button" className={btn.icon} aria-label={t("list.prev")} disabled={page <= 1 || loading} onClick={() => { setLoading(true); setParams({ page: page - 1 }); }}>
                                <CaretLeftIcon size={18} aria-hidden="true" />
                            </button>
                            <button type="button" className={btn.icon} aria-label={t("list.next")} disabled={page >= totalPages || loading} onClick={() => { setLoading(true); setParams({ page: page + 1 }); }}>
                                <CaretRightIcon size={18} aria-hidden="true" />
                            </button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}
