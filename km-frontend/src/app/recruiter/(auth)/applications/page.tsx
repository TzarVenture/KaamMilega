"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowsDownUpIcon, BriefcaseIcon, CaretLeftIcon, CaretRightIcon, UsersThreeIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { btn, cx, EmptyState, SearchInput, SkeletonRows } from "@/components/admin/ui";
import { notify } from "@/lib/notify";
import { STAGES, jobStatus, recruiterApi, type Applicant, type ApplicantsPage, type MyJob, type Stage } from "@/lib/api/recruiter";
import ApplicantList from "@/components/recruiter/ApplicantList";
import ApplicantPanel from "@/components/recruiter/ApplicantPanel";
import StageMoveDialog from "@/components/recruiter/StageMoveDialog";
import ScheduleInterviewModal from "@/components/recruiter/ScheduleInterviewModal";

const LIMIT = 25;
const SORTS = ["newest", "oldest", "rating"] as const;
const JOB_STATUS_CHIP: Record<string, string> = {
    Open: "bg-emerald-50 text-emerald-700 dark:bg-[#0B2E22] dark:text-emerald-300",
    Paused: "bg-amber-50 text-amber-700 dark:bg-[#3A2A0B] dark:text-amber-300",
    Closed: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};

type Loaded = { key: string; data: ApplicantsPage };
type PendingMove = { ids: string[]; stage: Stage; name?: string };

function ApplicationsContent() {
    const t = useTranslations("recruiterApplicants");
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const jobId = params.get("job_id") || params.get("jobId") || "";
    const rawStatus = params.get("status") || "";
    const status = (STAGES as readonly string[]).includes(rawStatus) ? (rawStatus as Stage) : "";
    const search = params.get("search") || "";
    const rawSort = params.get("sort") || "";
    const sort = (SORTS as readonly string[]).includes(rawSort) ? rawSort : "newest";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const openId = params.get("a");

    const key = JSON.stringify([jobId, status, search, sort, page]);

    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [error, setError] = useState<{ key: string } | null>(null);
    const [reload, setReload] = useState(0);
    const [now, setNow] = useState(0);
    const [jobs, setJobs] = useState<MyJob[]>([]);
    const [searchText, setSearchText] = useState(search);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [pending, setPending] = useState<PendingMove | null>(null);
    const [moving, setMoving] = useState(false);
    const [scheduleId, setScheduleId] = useState<string | null>(null);

    const setParams = useCallback((patch: Record<string, string | number | null>) => {
        const next = new URLSearchParams(params.toString());
        next.delete("jobId");
        for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === "" || (k === "page" && v === 1) || (k === "sort" && v === "newest")) next.delete(k);
            else next.set(k, String(v));
        }
        const qs = next.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [params, pathname, router]);

    // The employer's jobs for the filter, open ones first
    useEffect(() => {
        recruiterApi.jobs({ limit: 50 })
            .then((res) => {
                const order = { Open: 0, Paused: 1, Closed: 2 };
                setJobs([...(res.jobs || [])].sort((x, y) => order[jobStatus(x.status)] - order[jobStatus(y.status)]));
            })
            .catch(() => setJobs([]));
    }, []);

    // The current page of applicants
    useEffect(() => {
        let alive = true;
        const [j, s, q, so, p] = JSON.parse(key) as [string, string, string, string, number];
        recruiterApi.applicants({ job_id: j, status: s, search: q, sort: so, page: p, limit: LIMIT })
            .then((data) => {
                if (!alive) return;
                setLoaded({ key, data: { ...data, items: data.items || [] } });
                setError(null);
                setNow(Date.now());
            })
            .catch((err) => {
                if (!alive) return;
                setError({ key });
                notify.error(err, t("errors.load"));
            });
        return () => { alive = false; };
    }, [key, reload, t]);

    // Debounced search into the URL
    useEffect(() => {
        if (searchText.trim() === search) return;
        const id = setTimeout(() => setParams({ search: searchText.trim(), page: 1, a: null }), 350);
        return () => clearTimeout(id);
    }, [searchText, search, setParams]);

    const data = loaded?.key === key ? loaded.data : null;
    const failed = error?.key === key && !data;
    const items = useMemo(() => data?.items ?? [], [data]);
    const stages = data?.stages ?? loaded?.data.stages;
    const allCount = stages ? STAGES.reduce((n, s) => n + (stages[s] || 0), 0) : undefined;
    const total = data?.total ?? 0;
    const pages = Math.max(1, Math.ceil(total / LIMIT));
    const selectedIdx = openId ? items.findIndex((a) => a.id === openId) : -1;
    const selected = selectedIdx >= 0 ? items[selectedIdx] : null;
    const currentJob = jobs.find((j) => j.id === jobId);

    const patchItem = useCallback((id: string, patch: Partial<Applicant>) => {
        setLoaded((prev) => prev && ({ ...prev, data: { ...prev.data, items: prev.data.items.map((a) => (a.id === id ? { ...a, ...patch } : a)) } }));
    }, []);

    const refreshCounts = useCallback(() => {
        recruiterApi.applicants({ job_id: jobId, search, page: 1, limit: 1 })
            .then((res) => setLoaded((prev) => prev && ({ ...prev, data: { ...prev.data, stages: res.stages } })))
            .catch(() => undefined);
    }, [jobId, search]);

    const openApplicant = (id: string | null) => setParams({ a: id });

    const toggle = (id: string) => setChecked((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id); else next.add(id);
        return next;
    });
    const toggleAll = () => setChecked((prev) => {
        const all = items.length > 0 && items.every((a) => prev.has(a.id));
        const next = new Set(prev);
        items.forEach((a) => (all ? next.delete(a.id) : next.add(a.id)));
        return next;
    });

    const confirmMove = async () => {
        if (!pending) return;
        const { ids, stage } = pending;
        setMoving(true);
        if (ids.length === 1) {
            const before = items.find((a) => a.id === ids[0]);
            const at = new Date().toISOString();
            patchItem(ids[0], { status: stage, history: [...(before?.history || []), { status: stage, at }] });
            try {
                await recruiterApi.move(ids[0], stage);
                notify.success(t("move.doneOne", { name: pending.name || "", stage: t(`stage.${stage}`) }));
                refreshCounts();
            } catch (err) {
                if (before) patchItem(ids[0], { status: before.status, history: before.history });
                notify.error(err, t("errors.move"));
            }
        } else {
            try {
                const res = await recruiterApi.bulkMove(ids, stage);
                const moved = res.updated?.length ?? 0;
                const failedN = Object.keys(res.failed || {}).length;
                if (failedN) notify.warning(t("bulk.partial", { moved, failed: failedN }));
                else notify.success(t("bulk.done", { count: moved, stage: t(`stage.${stage}`) }));
                setChecked(new Set());
                setReload((n) => n + 1);
            } catch (err) {
                notify.error(err, t("errors.move"));
            }
        }
        setMoving(false);
        setPending(null);
    };

    const tabs: { value: Stage | ""; label: string; count?: number }[] = [
        { value: "", label: t("tabs.all"), count: allCount },
        ...STAGES.map((s) => ({ value: s, label: t(`stage.${s}`), count: stages?.[s] })),
    ];

    const checkedOnPage = items.filter((a) => checked.has(a.id)).map((a) => a.id);
    const noApplicantsAtAll = !!data && allCount === 0 && !search && !jobId;

    return (
        <div className="space-y-4 min-w-0">
            {/* Header */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-km-heading tracking-tight">{t("title")}</h1>
                    <p className="mt-1 text-sm text-km-text-secondary">{t("description")}</p>
                </div>
                <Link href="/recruiter/jobs/create" className={cx(btn.accent, "self-start sm:self-auto")}>
                    <BriefcaseIcon size={18} aria-hidden="true" />{t("postJob")}
                </Link>
            </div>

            {/* Filters */}
            <div className="flex flex-col lg:flex-row gap-2 lg:items-center">
                <div className="flex items-center gap-2 min-w-0">
                    <label htmlFor="applicants-job" className="sr-only">{t("filters.job")}</label>
                    <select
                        id="applicants-job"
                        value={jobId}
                        onChange={(e) => setParams({ job_id: e.target.value, page: 1, a: null })}
                        className="h-10 min-w-0 w-full lg:w-72 px-3 rounded-xl border border-km-border bg-km-surface-card text-sm text-km-text-primary cursor-pointer outline-none focus:border-km-blue"
                    >
                        <option value="">{t("filters.allJobs")}</option>
                        {jobs.map((j) => (
                            <option key={j.id} value={j.id}>
                                {j.title}{j.city_name ? ` · ${j.city_name}` : ""}{jobStatus(j.status) !== "Open" ? ` (${t(`jobStatus.${jobStatus(j.status)}`)})` : ""}
                            </option>
                        ))}
                        {jobId && !currentJob && <option value={jobId}>{t("filters.thisJob")}</option>}
                    </select>
                    {currentJob && (
                        <span className={cx("shrink-0 px-2 py-0.5 rounded-md text-xs font-medium", JOB_STATUS_CHIP[jobStatus(currentJob.status)])}>
                            {t(`jobStatus.${jobStatus(currentJob.status)}`)}
                        </span>
                    )}
                </div>
                <SearchInput value={searchText} onChange={setSearchText} placeholder={t("filters.search")} className="flex-1 min-w-0" />
                <label className="relative flex items-center">
                    <span className="sr-only">{t("filters.sort")}</span>
                    <ArrowsDownUpIcon size={16} className="absolute left-3 text-km-text-muted pointer-events-none" aria-hidden="true" />
                    <select
                        value={sort}
                        onChange={(e) => setParams({ sort: e.target.value, page: 1 })}
                        className="h-10 w-full lg:w-auto pl-9 pr-3 rounded-xl border border-km-border bg-km-surface-card text-sm text-km-text-primary cursor-pointer outline-none focus:border-km-blue"
                    >
                        {SORTS.map((s) => <option key={s} value={s}>{t(`sort.${s}`)}</option>)}
                    </select>
                </label>
            </div>

            {/* Stage tabs */}
            <div role="tablist" aria-label={t("tabs.label")} className="flex gap-1 overflow-x-auto overflow-y-hidden border-b border-km-border -mx-4 px-4 sm:mx-0 sm:px-0">
                {tabs.map((tab) => {
                    const active = tab.value === status;
                    return (
                        <button
                            key={tab.value || "all"}
                            type="button"
                            role="tab"
                            aria-selected={active}
                            onClick={() => setParams({ status: tab.value, page: 1, a: null })}
                            className={cx(
                                "shrink-0 px-3 h-10 text-sm font-medium border-b-2 -mb-px whitespace-nowrap cursor-pointer transition-colors",
                                active ? "border-km-accent text-km-heading" : "border-transparent text-km-text-secondary hover:text-km-heading",
                            )}
                        >
                            {tab.label}
                            {tab.count !== undefined && <span className="ml-1.5 text-xs text-km-text-muted font-inter tabular-nums">{tab.count}</span>}
                        </button>
                    );
                })}
            </div>

            {/* Bulk bar */}
            {checked.size > 0 && (
                <div className="sticky top-2 z-20 flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-[#071A4D] text-white">
                    <span className="text-sm font-semibold">{t("bulk.selected", { count: checked.size })}</span>
                    <label className="sr-only" htmlFor="bulk-move">{t("bulk.moveTo")}</label>
                    <select
                        id="bulk-move"
                        value=""
                        onChange={(e) => { if (e.target.value) setPending({ ids: [...checked], stage: e.target.value as Stage }); }}
                        className="h-9 px-3 rounded-lg bg-white text-[#071A4D] text-sm font-semibold cursor-pointer"
                    >
                        <option value="">{t("bulk.moveTo")}</option>
                        {STAGES.map((s) => <option key={s} value={s}>{t(`stage.${s}`)}</option>)}
                    </select>
                    <button type="button" onClick={() => setChecked(new Set())} className="ml-auto h-9 px-3 rounded-lg text-sm font-semibold hover:bg-[#0B1F52] cursor-pointer">
                        {t("bulk.clear")}
                    </button>
                </div>
            )}

            {/* Master / detail */}
            <div className="lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-4 lg:items-start">
                <div className="bg-km-surface-card border border-km-border rounded-2xl overflow-hidden min-w-0">
                    {failed ? (
                        <div className="flex flex-col items-center text-center py-12 px-6" role="alert">
                            <WarningCircleIcon size={36} weight="duotone" className="text-red-500 mb-3" aria-hidden="true" />
                            <p className="text-sm font-semibold text-km-heading">{t("errors.loadTitle")}</p>
                            <button type="button" onClick={() => { setError(null); setReload((n) => n + 1); }} className={cx(btn.secondary, "mt-4")}>
                                {t("errors.retry")}
                            </button>
                        </div>
                    ) : !data ? (
                        <SkeletonRows rows={8} />
                    ) : noApplicantsAtAll ? (
                        <EmptyState
                            icon={UsersThreeIcon}
                            title={t("empty.noneTitle")}
                            description={t("empty.noneBody")}
                            action={
                                <div className="flex flex-wrap justify-center gap-2">
                                    <Link href="/recruiter/jobs/create" className={btn.accent}>{t("postJob")}</Link>
                                    <Link href="/recruiter/ads" className={btn.secondary}>{t("empty.advertise")}</Link>
                                </div>
                            }
                        />
                    ) : items.length === 0 ? (
                        search ? (
                            <EmptyState
                                icon={UsersThreeIcon}
                                title={t("empty.searchTitle")}
                                description={t("empty.searchBody", { search })}
                                action={<button type="button" onClick={() => { setSearchText(""); setParams({ search: null, page: 1 }); }} className={btn.secondary}>{t("empty.clearSearch")}</button>}
                            />
                        ) : (
                            <EmptyState
                                icon={UsersThreeIcon}
                                title={status ? t("empty.stageTitle", { stage: t(`stage.${status}`) }) : t("empty.jobTitle")}
                                description={status ? t("empty.stageBody") : t("empty.jobBody")}
                            />
                        )
                    ) : (
                        <>
                            <ApplicantList
                                items={items}
                                selectedId={openId}
                                checked={checked}
                                now={now}
                                showJob={!jobId}
                                onOpen={openApplicant}
                                onToggle={toggle}
                                onToggleAll={toggleAll}
                            />
                            {pages > 1 && (
                                <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-km-border">
                                    <button type="button" disabled={page <= 1} onClick={() => setParams({ page: page - 1, a: null })} className={cx(btn.secondary, "h-9 px-3")}>
                                        <CaretLeftIcon size={16} aria-hidden="true" />{t("paging.prev")}
                                    </button>
                                    <span className="text-xs text-km-text-secondary">{t("paging.info", { page, pages, total })}</span>
                                    <button type="button" disabled={page >= pages} onClick={() => setParams({ page: page + 1, a: null })} className={cx(btn.secondary, "h-9 px-3")}>
                                        {t("paging.next")}<CaretRightIcon size={16} aria-hidden="true" />
                                    </button>
                                </div>
                            )}
                            {checkedOnPage.length === 0 && checked.size > 0 && (
                                <p className="px-4 py-2 text-xs text-km-text-secondary border-t border-km-border">{t("bulk.otherPages", { count: checked.size })}</p>
                            )}
                        </>
                    )}
                </div>

                {/* Detail: full screen on phones, sticky column on large screens */}
                <div
                    className={cx(
                        selected ? "fixed inset-0 z-40 overflow-y-auto bg-km-surface-card pb-20" : "hidden",
                        "lg:z-auto lg:block lg:bg-transparent lg:pb-0 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto lg:rounded-2xl",
                    )}
                >
                    {selected ? (
                        <ApplicantPanel
                            key={selected.id}
                            applicant={selected}
                            onBack={() => openApplicant(null)}
                            onPrev={selectedIdx > 0 ? () => openApplicant(items[selectedIdx - 1].id) : undefined}
                            onNext={selectedIdx < items.length - 1 ? () => openApplicant(items[selectedIdx + 1].id) : undefined}
                            onRequestMove={(stage) => setPending({ ids: [selected.id], stage, name: selected.candidate?.name })}
                            onSchedule={() => setScheduleId(selected.id)}
                            onPatch={patchItem}
                        />
                    ) : data && items.length > 0 ? (
                        <div className="hidden lg:block bg-km-surface-card border border-km-border rounded-2xl">
                            <EmptyState icon={UsersThreeIcon} title={t("panel.pickTitle")} description={t("panel.pickBody")} />
                        </div>
                    ) : null}
                </div>
            </div>

            <StageMoveDialog
                stage={pending?.stage ?? null}
                count={pending?.ids.length ?? 0}
                name={pending?.name}
                busy={moving}
                onCancel={() => setPending(null)}
                onConfirm={confirmMove}
            />

            {scheduleId && (
                <ScheduleInterviewModal
                    isOpen
                    applicationId={scheduleId}
                    onClose={() => setScheduleId(null)}
                    onSuccess={() => { setReload((n) => n + 1); }}
                />
            )}
        </div>
    );
}

export default function ApplicationsPage() {
    return (
        <Suspense fallback={<SkeletonRows rows={8} />}>
            <ApplicationsContent />
        </Suspense>
    );
}
