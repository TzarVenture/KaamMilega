"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import {
    ArrowRightIcon,
    BriefcaseIcon,
    BuildingsIcon,
    EyeIcon,
    CalendarCheckIcon,
    ChatsCircleIcon,
    CheckCircleIcon,
    ClockIcon,
    FileTextIcon,
    MapPinIcon,
    PlusIcon,
    SealCheckIcon,
    ShieldCheckIcon,
    UserCheckIcon,
    UserPlusIcon,
    UsersThreeIcon,
    VideoCameraIcon,
    WarningCircleIcon,
    type Icon,
} from "@phosphor-icons/react";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";
import { StatCard, btn, cx } from "@/components/admin/ui";
import RecruiterBanner, { HeroAccent } from "@/components/km/RecruiterBanner";
import { recruiterPlansApi, type Allowance, type PlanOverview } from "@/lib/api/recruiterPlans";
import { recruiterApi, type ApplicantsPage, type MyJobsPage } from "@/lib/api/recruiter";

type Person = { id?: string; name?: string; profile_image?: string; headline?: string; city?: string };

interface Job {
    id?: string;
    _id?: string;
    title?: string;
    status?: string;
    city_name?: string;
    applicant_count?: number;
    created_at?: string;
    views?: { total: number };
}

interface Application {
    id: string;
    status?: string;
    created_at?: string;
    candidate?: Person;
    job?: { id?: string; title?: string };
}

interface Interview {
    id: string;
    status?: string;
    type?: string;
    scheduled_at: string;
    candidate?: Person;
    job?: { title?: string };
}

interface Profile {
    name?: string;
    first_name?: string;
    company_name?: string;
    company_logo?: string;
    company_about?: string;
    company_cover?: string;
    verification_status?: string;
    company_documents?: unknown[];
}

/** Pipeline stages, in order, with the colour each one wears across the portal */
const STAGES = [
    { key: "Applied", bar: "bg-[#0B5ED7]", dot: "bg-[#0B5ED7]" },
    { key: "Shortlisted", bar: "bg-[#7C3AED]", dot: "bg-[#7C3AED]" },
    { key: "Interviewing", bar: "bg-[#FF6B00]", dot: "bg-[#FF6B00]" },
    { key: "Hired", bar: "bg-[#16A34A]", dot: "bg-[#16A34A]" },
] as const;

const lower = (s?: string) => String(s || "").trim().toLowerCase();
const jobId = (j: Job) => j.id || j._id || "";

function Avatar({ person, size = "w-10 h-10" }: { person?: Person; size?: string }) {
    const name = person?.name?.trim() || "?";
    if (person?.profile_image) {
        // eslint-disable-next-line @next/next/no-img-element
        return <img src={person.profile_image} alt="" className={cx(size, "rounded-full object-cover shrink-0 border border-km-border")} />;
    }
    return (
        <span className={cx(size, "rounded-full shrink-0 bg-[#F4F7FB] dark:bg-[#0B1F52] text-[#071A4D] dark:text-white font-semibold text-sm flex items-center justify-center")}>
            {name.charAt(0).toUpperCase()}
        </span>
    );
}

/** A card with a heading row and a "see all" link */
function Panel({ title, href, linkLabel, children, className }: {
    title: string;
    href?: string;
    linkLabel?: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <section className={cx("bg-km-surface-card rounded-2xl border border-km-border overflow-hidden", className)}>
            <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-km-border/70">
                <h2 className="text-base font-semibold text-km-heading">{title}</h2>
                {href && linkLabel && (
                    <Link href={href} className="flex items-center gap-1 text-sm font-semibold text-km-link hover:underline shrink-0">
                        {linkLabel}
                        <ArrowRightIcon size={14} weight="bold" aria-hidden="true" />
                    </Link>
                )}
            </div>
            {children}
        </section>
    );
}

function Meter({ label, Icon, allowance, text }: { label: string; Icon: Icon; allowance: Allowance; text: string }) {
    const { used, limit } = allowance;
    const share = limit === null ? 0 : limit === 0 ? 1 : Math.min(1, used / limit);
    const full = limit !== null && used >= limit;
    return (
        <div>
            <div className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-2 text-km-text-primary font-medium">
                    <Icon size={18} weight="duotone" className="text-km-link shrink-0" aria-hidden="true" />
                    {label}
                </span>
                <span className={cx("tabular-nums text-xs", full ? "text-red-600 dark:text-red-400 font-semibold" : "text-km-text-secondary")}>{text}</span>
            </div>
            {limit !== null && (
                <div className="mt-2 h-2 rounded-full bg-km-surface overflow-hidden">
                    <div
                        className={cx("h-full rounded-full", full ? "bg-red-500" : share >= 0.8 ? "bg-amber-500" : "bg-[#0B5ED7]")}
                        style={{ width: `${Math.max(share * 100, used > 0 ? 4 : 0)}%` }}
                    />
                </div>
            )}
        </div>
    );
}

const Skeleton = () => (
    <div className="space-y-6" aria-busy="true">
        <div className="h-56 rounded-3xl bg-km-surface-card border border-km-border animate-shimmer" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => <div key={n} className="h-28 rounded-2xl bg-km-surface-card border border-km-border animate-shimmer" />)}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-72 rounded-2xl bg-km-surface-card border border-km-border animate-shimmer" />
            <div className="h-72 rounded-2xl bg-km-surface-card border border-km-border animate-shimmer" />
        </div>
    </div>
);

const list = <T,>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);

/** Everything the dashboard shows, fetched together; a failed part leaves the rest */
const fetchAll = () =>
    Promise.allSettled([
        api.get<unknown, Profile>("/user/profile"),
        // Only what is shown: the newest open jobs and applicants, plus counts from the server
        // 50 open jobs so "jobs with no applicants" is counted properly; the list shows 5
        recruiterApi.jobs({ status: "open", limit: 50 }),
        recruiterApi.applicants({ limit: 5 }),
        api.get("/interviews/my"),
        recruiterPlansApi.overview(),
    ] as const);

/** The employer's home: what needs doing today, how hiring is going, and where to go next */
export default function RecruiterDashboard() {
    const t = useTranslations("recruiterHome");
    const tPlan = useTranslations("recruiterPlan");
    const format = useFormatter();

    const [profile, setProfile] = useState<Profile | null>(null);
    const [jobsPage, setJobsPage] = useState<MyJobsPage | null>(null);
    const [appsPage, setAppsPage] = useState<ApplicantsPage | null>(null);
    const [interviews, setInterviews] = useState<Interview[]>([]);
    const [plan, setPlan] = useState<PlanOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [now, setNow] = useState(0);

    const apply = useCallback((results: Awaited<ReturnType<typeof fetchAll>>) => {
        const [p, j, a, i, pl] = results;
        if (p.status === "fulfilled") setProfile(p.value);
        if (j.status === "fulfilled") setJobsPage(j.value);
        if (a.status === "fulfilled") setAppsPage(a.value);
        if (i.status === "fulfilled") setInterviews(list<Interview>(i.value));
        if (pl.status === "fulfilled") setPlan(pl.value);
        const core = [j, a, i].find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
        setFailed(Boolean(core));
        if (core) notify.error(core.reason, t("loadFailed"));
        setNow(Date.now());
        setLoading(false);
    }, [t]);

    const load = useCallback(() => fetchAll().then(apply), [apply]);

    useEffect(() => {
        let alive = true;
        fetchAll().then((r) => alive && apply(r));
        return () => {
            alive = false;
        };
    }, [apply]);

    const view = useMemo(() => {
        const endOfToday = new Date(now);
        endOfToday.setHours(23, 59, 59, 999);
        const upcoming = interviews
            .filter((iv) => lower(iv.status) === "scheduled" && new Date(iv.scheduled_at).getTime() >= now - 60 * 60 * 1000)
            .sort((x, y) => new Date(x.scheduled_at).getTime() - new Date(y.scheduled_at).getTime());
        const stages = appsPage?.stages;
        const byStage = Object.fromEntries(STAGES.map((s) => [s.key, stages?.[s.key] ?? 0])) as Record<string, number>;
        const openJobs = (jobsPage?.jobs ?? []) as Job[];
        return {
            openJobs,
            openCount: jobsPage?.counts.open ?? 0,
            jobsTotal: jobsPage?.counts.all ?? 0,
            upcoming,
            today: upcoming.filter((iv) => new Date(iv.scheduled_at).getTime() <= endOfToday.getTime()),
            byStage,
            rejected: stages?.Rejected ?? 0,
            // Everyone still in the running: withdrawn applicants left out
            appsTotal: STAGES.reduce((n, s) => n + (stages?.[s.key] ?? 0), 0),
            jobViews: openJobs.reduce((n, j) => n + (j.views?.total ?? 0), 0),
            jobApplicants: openJobs.reduce((n, j) => n + (j.applicant_count ?? 0), 0),
            toReview: byStage.Applied,
            newest: (appsPage?.items ?? []) as unknown as Application[],
            quietJobs: openJobs.filter((j) => !j.applicant_count),
        };
    }, [appsPage, interviews, jobsPage, now]);

    if (loading) return <Skeleton />;

    const verified = lower(profile?.verification_status) === "verified";
    // Documents sent and waiting for the KaamMilega team: nothing for the employer to do yet
    const underReview = !verified && (profile?.company_documents?.length ?? 0) > 0;
    const company = profile?.company_name?.trim() || t("yourCompany");
    const firstName = (profile?.first_name || profile?.name || "").trim().split(/\s+/)[0];
    const hour = new Date(now).getHours();
    const greeting = hour < 12 ? t("morning") : hour < 17 ? t("afternoon") : t("evening");
    const profileGaps = [!profile?.company_logo, !profile?.company_about?.trim(), !profile?.company_cover].filter(Boolean).length;
    const jobsLeft = plan && plan.usage.job_posts.limit !== null ? Math.max(0, plan.usage.job_posts.limit - plan.usage.job_posts.used) : null;
    const time = (iso: string) => format.dateTime(new Date(iso), { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
    const day = (iso: string) => format.dateTime(new Date(iso), { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
    const weekday = (iso: string) => format.dateTime(new Date(iso), { weekday: "short", timeZone: "Asia/Kolkata" });
    const ago = (iso?: string) => (iso ? format.relativeTime(new Date(iso), new Date(now)) : "");
    const stageLabel = (s?: string) => {
        const k = STAGES.find((x) => lower(x.key) === lower(s))?.key || (lower(s) === "rejected" ? "Rejected" : "Applied");
        return t(`stage.${k}`);
    };

    // What needs the employer's attention, most urgent first
    const todos: { key: string; Icon: Icon; tone: string; title: string; text: string; href: string; cta: string }[] = [];
    if (view.toReview > 0) todos.push({ key: "review", Icon: UserPlusIcon, tone: "text-[#0B5ED7] dark:text-[#93C5FD]", title: t("todo.reviewTitle", { count: view.toReview }), text: t("todo.reviewText"), href: "/recruiter/applications", cta: t("todo.reviewCta") });
    if (view.today.length > 0) todos.push({ key: "today", Icon: CalendarCheckIcon, tone: "text-[#FF6B00]", title: t("todo.todayTitle", { count: view.today.length }), text: t("todo.todayText", { time: time(view.today[0].scheduled_at) }), href: "/recruiter/interviews", cta: t("todo.todayCta") });
    if (jobsLeft === 0) todos.push({ key: "plan", Icon: WarningCircleIcon, tone: "text-[#EF4444]", title: t("todo.planTitle"), text: t("todo.planText"), href: "/recruiter/plan", cta: t("todo.planCta") });
    if (view.quietJobs.length > 0) todos.push({ key: "quiet", Icon: BriefcaseIcon, tone: "text-[#F59E0B]", title: t("todo.quietTitle", { count: view.quietJobs.length }), text: t("todo.quietText"), href: "/recruiter/ads", cta: t("todo.quietCta") });
    if (profileGaps > 0) todos.push({ key: "profile", Icon: BuildingsIcon, tone: "text-[#7C3AED] dark:text-[#C4B5FD]", title: t("todo.profileTitle"), text: t("todo.profileText", { count: profileGaps }), href: "/recruiter/company", cta: t("todo.profileCta") });
    if (!verified) todos.push({ key: "verify", Icon: ShieldCheckIcon, tone: "text-[#16A34A] dark:text-emerald-300", title: underReview ? t("todo.reviewingTitle") : t("todo.verifyTitle"), text: underReview ? t("todo.reviewingText") : t("todo.verifyText"), href: "/recruiter/register?step=verify", cta: underReview ? t("todo.reviewingCta") : t("todo.verifyCta") });

    const totalInFunnel = STAGES.reduce((n, s) => n + view.byStage[s.key], 0);
    const noJobsYet = view.jobsTotal === 0;

    return (
        <div className="space-y-6 pb-12">
            <RecruiterBanner
                kicker={{ label: company, Icon: verified ? SealCheckIcon : BuildingsIcon, tone: verified ? "skills" : "jobs" }}
                title={t.rich("heroTitle", { greeting, name: firstName || t("there"), accent: (c) => <HeroAccent>{c}</HeroAccent> })}
                description={
                    noJobsYet
                        ? t("heroFirst")
                        : view.toReview > 0
                          ? t("heroReview", { count: view.toReview })
                          : t("heroCalm")
                }
                art={{ src: "/recruiter-dashboard-art.svg", alt: t("artAlt") }}
            >
                <Link href="/recruiter/jobs/create" className={btn.accent}>
                    <PlusIcon size={16} weight="bold" aria-hidden="true" />
                    {t("postJob")}
                </Link>
                {!noJobsYet && (
                    <Link href="/recruiter/applications" className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-sm font-semibold border border-[#3B4F86] text-white hover:bg-[#0B1F52] transition-colors">
                        <UsersThreeIcon size={16} weight="bold" aria-hidden="true" />
                        {t("openPipeline")}
                    </Link>
                )}
            </RecruiterBanner>

            {failed && (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-[#2A1215] dark:text-red-300">
                    <span className="flex items-center gap-2">
                        <WarningCircleIcon size={18} weight="bold" aria-hidden="true" />
                        {t("loadFailed")}
                    </span>
                    <button type="button" onClick={() => { setLoading(true); void load(); }} className={btn.secondary}>{t("retry")}</button>
                </div>
            )}

            {noJobsYet && !failed ? (
                <section className="rounded-2xl border border-km-border bg-km-surface-card p-6 sm:p-8">
                    <h2 className="text-lg font-bold text-km-heading">{t("start.title")}</h2>
                    <p className="mt-1 text-sm text-km-text-secondary">{t("start.text")}</p>
                    <ol className="mt-6 grid gap-4 md:grid-cols-3">
                        {([
                            { Icon: BuildingsIcon, key: "1", href: "/recruiter/company", tone: "text-[#7C3AED]" },
                            { Icon: FileTextIcon, key: "2", href: "/recruiter/jobs/create", tone: "text-[#FF6B00]" },
                            { Icon: UserCheckIcon, key: "3", href: "/recruiter/applications", tone: "text-[#16A34A]" },
                        ] as const).map((s) => (
                            <li key={s.key}>
                                <Link href={s.href} className="group block h-full rounded-2xl border border-km-border bg-km-surface p-5 transition-colors hover:border-km-blue/40">
                                    <span className="flex items-center justify-between">
                                        <s.Icon size={30} weight="duotone" className={s.tone} aria-hidden="true" />
                                        <span className="text-xs font-semibold text-km-text-secondary">{t("start.step", { n: s.key })}</span>
                                    </span>
                                    <span className="mt-4 block font-semibold text-km-heading">{t(`start.s${s.key}Title`)}</span>
                                    <span className="mt-1 block text-sm text-km-text-secondary">{t(`start.s${s.key}Text`)}</span>
                                </Link>
                            </li>
                        ))}
                    </ol>
                </section>
            ) : (
                <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label={t("stat.open")} value={view.openCount} hint={t("stat.openHint", { total: view.jobsTotal })} icon={BriefcaseIcon} iconClassName="text-[#0B5ED7]" href="/recruiter/jobs/list" />
                        <StatCard label={t("stat.review")} value={view.toReview} hint={t("stat.reviewHint", { count: view.appsTotal })} icon={UserPlusIcon} iconClassName="text-[#7C3AED]" href="/recruiter/applications" />
                        <StatCard label={t("stat.interviews")} value={view.upcoming.length} hint={t("stat.interviewsHint", { count: view.today.length })} icon={CalendarCheckIcon} iconClassName="text-[#FF6B00]" href="/recruiter/interviews" />
                        <StatCard label={t("stat.hired")} value={view.byStage.Hired} hint={t("stat.hiredHint", { total: view.appsTotal })} icon={UserCheckIcon} iconClassName="text-[#16A34A]" />
                    </div>

                    <div className="grid gap-6 xl:grid-cols-3">
                        {/* To-do list */}
                        <Panel title={t("todo.heading")} className="xl:col-span-2">
                            {todos.length === 0 ? (
                                <div className="flex items-center gap-4 px-5 py-8">
                                    <CheckCircleIcon size={40} weight="duotone" className="text-[#16A34A] shrink-0" aria-hidden="true" />
                                    <div>
                                        <p className="font-semibold text-km-heading">{t("todo.clearTitle")}</p>
                                        <p className="text-sm text-km-text-secondary">{t("todo.clearText")}</p>
                                    </div>
                                </div>
                            ) : (
                                <ul className="divide-y divide-km-border/70">
                                    {todos.map(({ key, Icon: TIcon, tone, title, text, href, cta }) => (
                                        <li key={key}>
                                            <Link href={href} className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-km-surface">
                                                <span className={cx("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#F4F7FB] dark:bg-[#0B1F52]", tone)}>
                                                    <TIcon size={20} weight="duotone" aria-hidden="true" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block font-semibold text-km-heading">{title}</span>
                                                    <span className="block text-sm text-km-text-secondary">{text}</span>
                                                </span>
                                                <span className="hidden sm:flex items-center gap-1 text-sm font-semibold text-km-link shrink-0">
                                                    {cta}
                                                    <ArrowRightIcon size={14} weight="bold" aria-hidden="true" />
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>

                        {/* Hiring funnel */}
                        <Panel title={t("funnel.heading")} href="/recruiter/applications" linkLabel={t("funnel.link")}>
                            <div className="px-5 py-5 space-y-4">
                                {STAGES.map((s) => {
                                    const n = view.byStage[s.key];
                                    const share = totalInFunnel ? n / totalInFunnel : 0;
                                    return (
                                        <div key={s.key}>
                                            <div className="flex items-center justify-between text-sm">
                                                <span className="flex items-center gap-2 text-km-text-primary font-medium">
                                                    <span className={cx("w-2.5 h-2.5 rounded-full", s.dot)} aria-hidden="true" />
                                                    {t(`stage.${s.key}`)}
                                                </span>
                                                <span className="font-semibold tabular-nums text-km-heading">{n}</span>
                                            </div>
                                            <div className="mt-1.5 h-2 rounded-full bg-km-surface overflow-hidden">
                                                <div className={cx("h-full rounded-full", s.bar)} style={{ width: `${Math.max(share * 100, n > 0 ? 4 : 0)}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                                <p className="pt-1 text-xs text-km-text-secondary">{t("funnel.note", { rejected: view.rejected })}</p>
                            </div>
                        </Panel>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-2">
                        {/* Upcoming interviews */}
                        <Panel title={t("upcoming.heading")} href="/recruiter/interviews" linkLabel={t("seeAll")}>
                            {view.upcoming.length === 0 ? (
                                <p className="px-5 py-8 text-sm text-km-text-secondary">{t("upcoming.empty")}</p>
                            ) : (
                                <ul className="divide-y divide-km-border/70">
                                    {view.upcoming.slice(0, 4).map((iv) => (
                                        <li key={iv.id}>
                                          <Link href="/recruiter/interviews" className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-km-surface">
                                            <span className="w-16 shrink-0 rounded-xl border border-km-border bg-km-surface py-1.5 text-center">
                                                <span className="block text-xs font-semibold text-[#FF6B00]">{weekday(iv.scheduled_at)}</span>
                                                <span className="block whitespace-nowrap text-xs font-bold text-km-heading tabular-nums">{time(iv.scheduled_at)}</span>
                                            </span>
                                            <Avatar person={iv.candidate} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block truncate font-semibold text-km-heading">{iv.candidate?.name || t("candidate")}</span>
                                                <span className="block truncate text-sm text-km-text-secondary">{iv.job?.title} · {day(iv.scheduled_at)}</span>
                                            </span>
                                            <span className="hidden sm:flex items-center gap-1 text-xs text-km-text-secondary shrink-0">
                                                {lower(iv.type) === "video" ? <VideoCameraIcon size={16} aria-hidden="true" /> : lower(iv.type) === "phone" ? <ChatsCircleIcon size={16} aria-hidden="true" /> : <MapPinIcon size={16} aria-hidden="true" />}
                                                {iv.type}
                                            </span>
                                          </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>

                        {/* Newest applicants */}
                        <Panel title={t("newest.heading")} href="/recruiter/applications" linkLabel={t("seeAll")}>
                            {view.newest.length === 0 ? (
                                <p className="px-5 py-8 text-sm text-km-text-secondary">{t("newest.empty")}</p>
                            ) : (
                                <ul className="divide-y divide-km-border/70">
                                    {view.newest.map((a) => (
                                        <li key={a.id}>
                                            <Link href={`/recruiter/applications?${a.job?.id ? `job_id=${a.job.id}&` : ""}a=${a.id}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-km-surface">
                                                <Avatar person={a.candidate} />
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-semibold text-km-heading">{a.candidate?.name || t("candidate")}</span>
                                                    <span className="block truncate text-sm text-km-text-secondary">{a.job?.title}</span>
                                                </span>
                                                <span className="flex flex-col items-end gap-1 shrink-0">
                                                    <span className="rounded-full border border-km-border px-2 py-0.5 text-xs font-medium text-km-text-primary">{stageLabel(a.status)}</span>
                                                    <span className="flex items-center gap-1 text-[11px] text-km-text-secondary">
                                                        <ClockIcon size={12} aria-hidden="true" />
                                                        {ago(a.created_at)}
                                                    </span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </Panel>
                    </div>

                    <div className="grid gap-6 xl:grid-cols-3">
                        {/* Open jobs */}
                        <Panel title={t("jobs.heading")} href="/recruiter/jobs/list" linkLabel={t("seeAll")} className="xl:col-span-2">
                            {view.openCount === 0 ? (
                                <p className="px-5 py-8 text-sm text-km-text-secondary">{t("jobs.empty")}</p>
                            ) : (
                                <>
                                {/* Reach of the open jobs: how many people looked, and how many applied */}
                                <dl className="grid grid-cols-3 gap-3 px-5 pt-4">
                                    {[
                                        [t("jobs.viewsLabel"), format.number(view.jobViews)],
                                        [t("jobs.applicantsLabel"), format.number(view.jobApplicants)],
                                        [t("jobs.applyRate"), view.jobViews > 0 ? `${Math.min(100, Math.round((view.jobApplicants / view.jobViews) * 1000) / 10)}%` : "–"],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-xl bg-km-surface px-3 py-2.5">
                                            <dt className="text-xs text-km-text-secondary">{label}</dt>
                                            <dd className="mt-0.5 text-lg font-bold tabular-nums text-km-heading">{value}</dd>
                                        </div>
                                    ))}
                                </dl>
                                <p className="px-5 pt-2 text-xs text-km-text-secondary">{t("jobs.viewsHint")}</p>
                                <ul className="mt-2 divide-y divide-km-border/70">
                                    {view.openJobs.slice(0, 5).map((j) => (
                                        <li key={jobId(j)}>
                                            <Link href={`/recruiter/jobs/${jobId(j)}`} className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-km-surface">
                                                <span className="w-10 h-10 rounded-xl bg-[#F4F7FB] dark:bg-[#0B1F52] text-[#0B5ED7] dark:text-[#93C5FD] flex items-center justify-center shrink-0">
                                                    <BriefcaseIcon size={20} weight="duotone" aria-hidden="true" />
                                                </span>
                                                <span className="min-w-0 flex-1">
                                                    <span className="block truncate font-semibold text-km-heading">{j.title}</span>
                                                    <span className="block truncate text-sm text-km-text-secondary">
                                                        {[j.city_name, j.created_at ? t("jobs.posted", { when: ago(j.created_at) }) : ""].filter(Boolean).join(" · ")}
                                                    </span>
                                                </span>
                                                <span className="text-right shrink-0 w-14">
                                                    <span className="flex items-center justify-end gap-1 text-lg font-bold tabular-nums text-km-heading">
                                                        <EyeIcon size={14} className="text-km-text-secondary" aria-hidden="true" />{j.views?.total ?? 0}
                                                    </span>
                                                    <span className="block text-[11px] text-km-text-secondary">{t("jobs.views")}</span>
                                                </span>
                                                <span className="text-right shrink-0 w-16">
                                                    <span className="block text-lg font-bold tabular-nums text-km-heading">{j.applicant_count || 0}</span>
                                                    <span className="block text-[11px] text-km-text-secondary">{t("jobs.applicants")}</span>
                                                </span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                                </>
                            )}
                        </Panel>

                        {/* Plan usage */}
                        <Panel title={t("plan.heading")} href="/recruiter/plan" linkLabel={t("plan.link")}>
                            {plan ? (
                                <div className="px-5 py-5 space-y-4">
                                    <p className="text-sm text-km-text-secondary">
                                        {plan.current ? t("plan.current", { name: plan.current.plan_name }) : t("plan.free")}
                                        {plan.period_ends_at && <> · {t("plan.resets", { date: day(plan.period_ends_at) })}</>}
                                    </p>
                                    {(
                                        [
                                            ["job_posts", tPlan("jobPosts"), BriefcaseIcon],
                                            ["new_chats", tPlan("newChats"), ChatsCircleIcon],
                                            ["resume_downloads", tPlan("resumeDownloads"), FileTextIcon],
                                        ] as const
                                    ).map(([k, label, I]) => {
                                        const al = plan.usage[k];
                                        return <Meter key={k} label={label} Icon={I} allowance={al} text={al.limit === null ? tPlan("usedNoLimit", { used: al.used }) : tPlan("usedOf", { used: al.used, limit: al.limit })} />;
                                    })}
                                </div>
                            ) : (
                                <p className="px-5 py-8 text-sm text-km-text-secondary">{t("plan.unavailable")}</p>
                            )}
                        </Panel>
                    </div>
                </>
            )}
        </div>
    );
}
