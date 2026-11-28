"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import {
    ArrowLeftIcon,
    ArrowRightIcon,
    BriefcaseIcon,
    ClockCountdownIcon,
    EyeSlashIcon,
    PencilSimpleIcon,
    ShareNetworkIcon,
    UsersThreeIcon,
    WarningCircleIcon,
} from "@phosphor-icons/react";
import { notify } from "@/lib/notify";
import { STAGES, STAGE_COLOR, jobStatus, recruiterApi, type Applicant, type MyJob } from "@/lib/api/recruiter";
import { AdminPanel, EmptyState, LogoTile, SkeletonRows, btn, cx } from "@/components/admin/ui";
import JobStatusChip from "@/components/recruiter/JobStatusChip";
import StageBar from "@/components/recruiter/StageBar";
import JobActionsMenu, { useJobActions } from "@/components/recruiter/JobActionsMenu";
import { salaryRange } from "@/components/recruiter/jobFormat";
import JobReach from "@/components/recruiter/JobReach";
import SuggestedCandidates from "@/components/recruiter/SuggestedCandidates";

type LoadState = "loading" | "ok" | "notfound" | "error";

export default function JobHubPage() {
    const t = useTranslations("recruiterJobs");
    const format = useFormatter();
    const router = useRouter();
    const { id } = useParams<{ id: string }>();

    const [job, setJob] = useState<MyJob | null>(null);
    const [state, setState] = useState<LoadState>("loading");
    const [latest, setLatest] = useState<Applicant[] | null>(null);
    const [latestError, setLatestError] = useState(false);
    const [reload, setReload] = useState(0);

    useEffect(() => {
        let alive = true;
        recruiterApi.job(id)
            .then((j) => { if (alive) { setJob(j); setState("ok"); } })
            .catch((err: { status?: number; code?: string }) => {
                if (!alive) return;
                const nf = err?.status === 404 || err?.status === 403 || err?.code === "JOB_NOT_FOUND" || err?.code === "JOB_FORBIDDEN";
                setState(nf ? "notfound" : "error");
            });
        recruiterApi.applicants({ job_id: id, limit: 5 })
            .then((res) => { if (alive) { setLatest(res.items || []); setLatestError(false); } })
            .catch(() => { if (alive) setLatestError(true); });
        return () => { alive = false; };
    }, [id, reload]);

    const retry = () => { setState("loading"); setLatest(null); setReload((n) => n + 1); };
    const onDeleted = useCallback(() => router.replace("/recruiter/jobs/list"), [router]);
    const { run, dialog, busy } = useJobActions(job, { onUpdated: setJob, onDeleted });

    const [keeping, setKeeping] = useState(false);
    const keepOpen = async () => {
        if (!job || keeping) return;
        setKeeping(true);
        try {
            await recruiterApi.keepOpen(job.id);
            setJob({ ...job, status: "Open", stale_reminded_at: undefined });
            notify.success(t("hub.keptOpen"));
        } catch (err) {
            notify.error(err, t("hub.keepOpenFailed"));
        } finally {
            setKeeping(false);
        }
    };

    const share = async () => {
        const url = `${window.location.origin}/jobs/${id}`;
        try {
            await navigator.clipboard.writeText(url);
            notify.success(t("hub.linkCopied"));
        } catch (err) {
            notify.error(err, t("hub.copyFailed"));
        }
    };

    if (state === "loading") {
        return <div className="max-w-7xl mx-auto"><div className="h-8 w-64 rounded bg-km-border-subtle animate-pulse mb-6" /><SkeletonRows rows={5} /></div>;
    }
    if (state === "notfound") {
        return (
            <div className="max-w-3xl mx-auto bg-km-surface-card border border-km-border rounded-2xl">
                <EmptyState
                    icon={BriefcaseIcon}
                    title={t("hub.notFoundTitle")}
                    description={t("hub.notFoundHint")}
                    action={<Link href="/recruiter/jobs/list" className={btn.secondary}><ArrowLeftIcon size={16} aria-hidden="true" />{t("hub.backToJobs")}</Link>}
                />
            </div>
        );
    }
    if (state === "error" || !job) {
        return (
            <div className="max-w-3xl mx-auto bg-km-surface-card border border-km-border rounded-2xl flex flex-col items-center text-center py-12 px-6" role="alert">
                <WarningCircleIcon size={32} weight="duotone" className="text-red-500 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-km-heading">{t("hub.loadFailed")}</p>
                <button type="button" onClick={retry} className={cx(btn.secondary, "mt-4")}>{t("retry")}</button>
            </div>
        );
    }

    const status = jobStatus(job.status);
    const salary = salaryRange(job.salary_min, job.salary_max);
    const date = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });
    const meta = [job.city_name || job.location, job.job_type, salary ? t("salaryMonth", { amount: salary }) : t("salaryNotSet"), t("posted", { date: date(job.created_at) })].filter(Boolean);
    const appsHref = `/recruiter/applications?job_id=${job.id}`;
    const stageTotal = STAGES.reduce((a, s) => a + (job.stage_counts?.[s] ?? 0), 0);

    const expMin = job.experience_min ?? 0;
    const expMax = job.experience_max ?? 0;
    const experience = !expMin && !expMax ? t("hub.anyExperience")
        : expMax > expMin ? t("hub.expRange", { min: expMin, max: expMax }) : t("hub.expMin", { min: expMin || expMax });
    const requirements = (job.requirements || []).filter((r) => r.trim());
    const offers = (job.we_offer || []).filter((r) => r.trim());

    return (
        <div className="max-w-7xl mx-auto">
            <Link href="/recruiter/jobs/list" className="inline-flex items-center gap-1.5 text-sm text-km-link hover:underline mb-3">
                <ArrowLeftIcon size={14} aria-hidden="true" />{t("hub.backToJobs")}
            </Link>

            {/* Header */}
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <h1 className="text-2xl font-bold text-km-heading tracking-tight break-words min-w-0">{job.title}</h1>
                        <JobStatusChip status={job.status} />
                    </div>
                    <p className="mt-1 text-sm text-km-text-secondary">{meta.join(" · ")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link href={appsHref} className={btn.accent}><UsersThreeIcon size={18} aria-hidden="true" />{t("actions.viewApplicants")}</Link>
                    <Link href={`/recruiter/jobs/${job.id}/edit`} className={btn.secondary}><PencilSimpleIcon size={18} aria-hidden="true" />{t("actions.edit")}</Link>
                    <button type="button" onClick={share} className={btn.secondary}><ShareNetworkIcon size={18} aria-hidden="true" />{t("hub.share")}</button>
                    <JobActionsMenu job={job} onUpdated={setJob} onDeleted={onDeleted} showView={false} showEdit={false} />
                </div>
            </div>

            {status !== "Open" && (
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200" role="status">
                    <EyeSlashIcon size={22} weight="duotone" className="shrink-0" aria-hidden="true" />
                    <p className="text-sm flex-1">{t(status === "Paused" ? (job.stale_paused_at ? "hub.stalePausedBanner" : "hub.pausedBanner") : "hub.closedBanner")}</p>
                    <button type="button" disabled={busy} onClick={() => run(status === "Paused" ? "resume" : "reopen")} className={cx(btn.secondary, "shrink-0")}>
                        {t(status === "Paused" ? "actions.resume" : "actions.reopen")}
                    </button>
                </div>
            )}

            {status === "Open" && job.stale_reminded_at && (
                <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 dark:border-blue-900 dark:bg-[#0F2552] dark:text-blue-100" role="status">
                    <ClockCountdownIcon size={22} weight="duotone" className="shrink-0" aria-hidden="true" />
                    <p className="text-sm flex-1">{t("hub.staleBanner")}</p>
                    <div className="flex gap-2 shrink-0">
                        <button type="button" disabled={busy || keeping} onClick={() => run("pause")} className={btn.secondary}>{t("hub.stalePause")}</button>
                        <button type="button" disabled={keeping} onClick={keepOpen} className={btn.primary}>{keeping ? t("hub.keeping") : t("hub.keepOpen")}</button>
                    </div>
                </div>
            )}

            {/* Stage cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-3">
                {STAGES.map((s) => (
                    <Link
                        key={s}
                        href={`${appsHref}&status=${s}`}
                        className="block bg-km-surface-card border border-km-border rounded-2xl p-4 transition-colors hover:border-km-blue/40"
                    >
                        <span className="flex items-center gap-2 text-sm font-medium text-km-text-secondary">
                            <span className={cx("w-2 h-2 rounded-full", STAGE_COLOR[s].dot)} aria-hidden="true" />
                            {t(`stages.${s}`)}
                        </span>
                        <span className="mt-2 block text-2xl font-bold text-km-heading font-inter tabular-nums">{job.stage_counts?.[s] ?? 0}</span>
                    </Link>
                ))}
            </div>
            <div className="bg-km-surface-card border border-km-border rounded-2xl px-5 py-4 mb-6">
                <div className="flex items-center justify-between gap-3 mb-2 text-sm">
                    <span className="font-semibold text-km-heading">{t("hub.funnel")}</span>
                    <Link href={appsHref} className="text-km-link hover:underline">{t("applicants", { count: job.applicant_count || stageTotal })}</Link>
                </div>
                <StageBar counts={job.stage_counts} stages={[...STAGES]} />
            </div>
            <JobReach views={job.views} applicants={job.applicant_count || stageTotal} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Details */}
                <AdminPanel title={t("hub.details")} className="lg:col-span-2 min-w-0" bodyClassName="p-5 space-y-5 text-sm">
                    <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div><dt className="text-xs text-km-text-secondary">{t("hub.experience")}</dt><dd className="mt-0.5 text-km-text-primary">{experience}</dd></div>
                        <div><dt className="text-xs text-km-text-secondary">{t("hub.education")}</dt><dd className="mt-0.5 text-km-text-primary">{job.education || t("hub.any")}</dd></div>
                        <div><dt className="text-xs text-km-text-secondary">{t("hub.gender")}</dt><dd className="mt-0.5 text-km-text-primary">{job.gender || t("hub.any")}</dd></div>
                    </dl>
                    <div>
                        <h3 className="font-semibold text-km-heading mb-1.5">{t("hub.description")}</h3>
                        <p className="whitespace-pre-line break-words text-km-text-primary">{job.description?.trim() || t("hub.noDescription")}</p>
                    </div>
                    {requirements.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-km-heading mb-1.5">{t("hub.requirements")}</h3>
                            <ul className="list-disc pl-5 space-y-1 text-km-text-primary break-words">{requirements.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </div>
                    )}
                    {offers.length > 0 && (
                        <div>
                            <h3 className="font-semibold text-km-heading mb-1.5">{t("hub.weOffer")}</h3>
                            <ul className="list-disc pl-5 space-y-1 text-km-text-primary break-words">{offers.map((r, i) => <li key={i}>{r}</li>)}</ul>
                        </div>
                    )}
                </AdminPanel>

                {/* Latest applicants */}
                <AdminPanel
                    title={t("hub.latest")}
                    className="min-w-0 self-start"
                    actions={<Link href={appsHref} className="inline-flex items-center gap-1 text-sm text-km-link hover:underline">{t("hub.viewAll")}<ArrowRightIcon size={14} aria-hidden="true" /></Link>}
                >
                    {latestError ? (
                        <div className="p-5 text-center" role="alert">
                            <p className="text-sm text-km-text-secondary">{t("hub.latestFailed")}</p>
                            <button type="button" onClick={retry} className={cx(btn.secondary, "mt-3")}>{t("retry")}</button>
                        </div>
                    ) : latest === null ? (
                        <SkeletonRows rows={3} />
                    ) : latest.length === 0 ? (
                        <EmptyState icon={UsersThreeIcon} title={t("hub.noApplicants")} description={t(status === "Open" ? "hub.noApplicantsHint" : "hub.noApplicantsHidden")} />
                    ) : (
                        <ul className="divide-y divide-km-border-subtle">
                            {latest.map((a) => {
                                const name = a.candidate?.name || t("hub.candidate");
                                return (
                                    <li key={a.id}>
                                        <Link href={`${appsHref}&status=${a.status}`} className="flex items-center gap-3 px-5 py-3 hover:bg-km-surface transition-colors">
                                            <LogoTile src={a.candidate?.profile_image} name={name} rounded="rounded-full" />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm font-medium text-km-heading truncate">{name}</span>
                                                <span className="block text-xs text-km-text-secondary truncate">
                                                    {[a.candidate?.headline || a.candidate?.city, date(a.created_at)].filter(Boolean).join(" · ")}
                                                </span>
                                            </span>
                                            <span className={cx("px-2 py-0.5 rounded-md text-xs font-medium whitespace-nowrap", STAGE_COLOR[a.status]?.chip)}>
                                                {(STAGES as readonly string[]).includes(a.status) ? t(`stages.${a.status}`) : a.status === "Withdrawn" ? t("stages.Withdrawn") : a.status}
                                            </span>
                                        </Link>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </AdminPanel>
            </div>

            {status === "Open" && <SuggestedCandidates jobId={job.id} />}

            {dialog}
        </div>
    );
}
