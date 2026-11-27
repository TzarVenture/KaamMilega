"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useFormatter, useTranslations } from "next-intl";
import { CalendarBlankIcon, CalendarCheckIcon, CalendarXIcon, ClockCounterClockwiseIcon, UsersThreeIcon, WarningCircleIcon } from "@phosphor-icons/react";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";
import { recruiterApi, type Interview } from "@/lib/api/recruiter";
import { AdminModal, btn, EmptyState, FilterTabs, SearchInput, SkeletonRows } from "@/components/admin/ui";
import InterviewAgendaItem from "@/components/recruiter/InterviewAgendaItem";
import EditInterviewModal from "@/components/recruiter/EditInterviewModal";

type Tab = "upcoming" | "overdue" | "completed" | "cancelled";
const TABS: Tab[] = ["upcoming", "overdue", "completed", "cancelled"];
const PAGE = 20;
const HOUR = 60 * 60 * 1000;
const IST_OFFSET = 330 * 60 * 1000;

/** The calendar day in India for a time, as YYYY-MM-DD */
const istDay = (ms: number) => new Date(ms + IST_OFFSET).toISOString().slice(0, 10);

function tabOf(i: Interview, now: number): Tab {
    if (i.status === "Completed") return "completed";
    if (i.status === "Cancelled") return "cancelled";
    return new Date(i.scheduled_at).getTime() >= now - HOUR ? "upcoming" : "overdue";
}

function InterviewsView() {
    const t = useTranslations("recruiterInterviews");
    const format = useFormatter();
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const tabParam = params.get("tab") as Tab | null;
    const tab: Tab = tabParam && TABS.includes(tabParam) ? tabParam : "upcoming";
    const urlQuery = params.get("q") || "";

    const [items, setItems] = useState<Interview[]>([]);
    const [now, setNow] = useState(0);
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [query, setQuery] = useState(urlQuery);
    const [seenQuery, setSeenQuery] = useState(urlQuery);
    if (seenQuery !== urlQuery) {
        // The URL changed from outside (back/forward): the box follows it
        setSeenQuery(urlQuery);
        if (query.trim() !== urlQuery) setQuery(urlQuery);
    }
    const [shown, setShown] = useState(PAGE);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [editing, setEditing] = useState<Interview | null>(null);
    const [confirm, setConfirm] = useState<{ kind: "cancel" | "delete"; item: Interview } | null>(null);

    const setUrl = useCallback((next: { tab?: Tab; q?: string }) => {
        const sp = new URLSearchParams(params.toString());
        if (next.tab !== undefined) { if (next.tab === "upcoming") sp.delete("tab"); else sp.set("tab", next.tab); }
        if (next.q !== undefined) { if (next.q) sp.set("q", next.q); else sp.delete("q"); }
        const qs = sp.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [params, pathname, router]);

    const load = useCallback(() => {
        return recruiterApi.interviews()
            .then((data) => {
                setItems(Array.isArray(data) ? data : []);
                setFailed(false);
                setNow(Date.now());
            })
            .catch(() => setFailed(true))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { void load(); }, [load]);

    // Keep "now" fresh so items move to "Needs update" while the page stays open
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), 60 * 1000);
        return () => window.clearInterval(id);
    }, []);

    // Debounced search into the URL
    useEffect(() => {
        if (query.trim() === urlQuery) return;
        const id = window.setTimeout(() => setUrl({ q: query.trim() }), 350);
        return () => window.clearTimeout(id);
    }, [query, urlQuery, setUrl]);

    const filtered = useMemo(() => {
        const q = urlQuery.trim().toLowerCase();
        if (!q) return items;
        return items.filter((i) => (i.candidate?.name || "").toLowerCase().includes(q) || (i.job?.title || "").toLowerCase().includes(q));
    }, [items, urlQuery]);

    const byTab = useMemo(() => {
        const out: Record<Tab, Interview[]> = { upcoming: [], overdue: [], completed: [], cancelled: [] };
        if (!now) return out;
        for (const i of filtered) out[tabOf(i, now)].push(i);
        const at = (i: Interview) => new Date(i.scheduled_at).getTime();
        out.upcoming.sort((a, b) => at(a) - at(b));
        out.overdue.sort((a, b) => at(a) - at(b));
        out.completed.sort((a, b) => at(b) - at(a));
        out.cancelled.sort((a, b) => at(b) - at(a));
        return out;
    }, [filtered, now]);

    const list = byTab[tab];
    const visible = list.slice(0, shown);

    const dayLabel = (key: string) => {
        const today = istDay(now);
        const tomorrow = istDay(now + 24 * HOUR);
        if (key === today) return t("today");
        if (key === tomorrow) return t("tomorrow");
        return format.dateTime(new Date(`${key}T12:00:00+05:30`), { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
    };

    const groups = useMemo(() => {
        if (tab !== "upcoming") return null;
        const out: { key: string; items: Interview[] }[] = [];
        for (const i of visible) {
            const key = istDay(new Date(i.scheduled_at).getTime());
            const last = out[out.length - 1];
            if (last && last.key === key) last.items.push(i);
            else out.push({ key, items: [i] });
        }
        return out;
    }, [tab, visible]);

    const patchLocal = (id: string, patch: Partial<Interview>) =>
        setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

    const setStatus = async (item: Interview, status: "Completed" | "Cancelled") => {
        const before = items;
        setBusyId(item.id);
        patchLocal(item.id, { status });
        try {
            await recruiterApi.setInterviewStatus(item.id, status);
            notify.success(status === "Completed" ? t("doneCompleted") : t("doneCancelled"));
        } catch (err) {
            setItems(before);
            notify.error(err, t("updateFailed"));
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (item: Interview) => {
        const before = items;
        setBusyId(item.id);
        setItems((prev) => prev.filter((i) => i.id !== item.id));
        try {
            await api.delete(`/interviews/${item.id}`);
            notify.success(t("doneDeleted"));
        } catch (err) {
            setItems(before);
            notify.error(err, t("deleteFailed"));
        } finally {
            setBusyId(null);
        }
    };

    const onConfirm = () => {
        if (!confirm) return;
        const { kind, item } = confirm;
        setConfirm(null);
        if (kind === "cancel") void setStatus(item, "Cancelled");
        else void remove(item);
    };

    const empty = {
        upcoming: { icon: CalendarBlankIcon, title: t("emptyUpcoming"), description: t("emptyUpcomingHint") },
        overdue: { icon: CalendarCheckIcon, title: t("emptyOverdue"), description: t("emptyOverdueHint") },
        completed: { icon: CalendarCheckIcon, title: t("emptyCompleted"), description: t("emptyCompletedHint") },
        cancelled: { icon: CalendarXIcon, title: t("emptyCancelled"), description: t("emptyCancelledHint") },
    }[tab];

    const renderItem = (i: Interview) => (
        <InterviewAgendaItem
            key={i.id}
            item={i}
            overdue={tab === "overdue"}
            busy={busyId === i.id}
            onEdit={() => setEditing(i)}
            onComplete={() => void setStatus(i, "Completed")}
            onCancel={() => setConfirm({ kind: "cancel", item: i })}
            onDelete={() => setConfirm({ kind: "delete", item: i })}
        />
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold tracking-tight text-km-heading">{t("title")}</h1>
                    <p className="mt-1 text-sm text-km-text-secondary">{t("description")}</p>
                </div>
                <Link href="/recruiter/applications?status=Interviewing" className={btn.accent}>
                    <UsersThreeIcon size={16} weight="bold" aria-hidden="true" />
                    {t("scheduleFromApplicants")}
                </Link>
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="max-w-full overflow-x-auto">
                    <FilterTabs<Tab>
                        value={tab}
                        onChange={(v) => { setShown(PAGE); setUrl({ tab: v }); }}
                        options={TABS.map((v) => ({ value: v, label: t(`tab_${v}`), count: loading || failed ? undefined : byTab[v].length }))}
                    />
                </div>
                <SearchInput value={query} onChange={(v) => { setShown(PAGE); setQuery(v); }} placeholder={t("searchPlaceholder")} className="w-full lg:w-72" />
            </div>

            {tab === "overdue" && !loading && !failed && list.length > 0 && (
                <p className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-[#33240A] dark:text-amber-200">
                    <ClockCounterClockwiseIcon size={18} weight="bold" className="mt-0.5 shrink-0" aria-hidden="true" />
                    {t("overdueHint")}
                </p>
            )}

            {failed ? (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-[#2A1215] dark:text-red-300">
                    <span className="flex items-center gap-2">
                        <WarningCircleIcon size={18} weight="bold" aria-hidden="true" />
                        {t("loadFailed")}
                    </span>
                    <button type="button" onClick={() => { setLoading(true); void load(); }} className={btn.secondary}>{t("retry")}</button>
                </div>
            ) : loading ? (
                <div className="rounded-2xl border border-km-border bg-km-surface-card"><SkeletonRows rows={5} /></div>
            ) : list.length === 0 ? (
                <div className="rounded-2xl border border-km-border bg-km-surface-card">
                    {urlQuery ? (
                        <EmptyState icon={CalendarBlankIcon} title={t("noMatches")} description={t("noMatchesHint")}
                            action={<button type="button" className={btn.secondary} onClick={() => { setQuery(""); setUrl({ q: "" }); }}>{t("clearSearch")}</button>} />
                    ) : (
                        <EmptyState icon={empty.icon} title={empty.title} description={empty.description}
                            action={tab === "upcoming" ? <Link href="/recruiter/applications?status=Interviewing" className={btn.secondary}>{t("scheduleFromApplicants")}</Link> : undefined} />
                    )}
                </div>
            ) : groups ? (
                <div className="space-y-5">
                    {groups.map((g) => (
                        <section key={g.key} aria-label={dayLabel(g.key)}>
                            <h2 className="mb-2 text-sm font-semibold text-km-heading">{dayLabel(g.key)}
                                <span className="ml-2 font-normal text-km-text-secondary">{t("countInterviews", { count: g.items.length })}</span>
                            </h2>
                            <ul className="divide-y divide-km-border-subtle rounded-2xl border border-km-border bg-km-surface-card">{g.items.map(renderItem)}</ul>
                        </section>
                    ))}
                </div>
            ) : (
                <ul className="divide-y divide-km-border-subtle rounded-2xl border border-km-border bg-km-surface-card">{visible.map(renderItem)}</ul>
            )}

            {!loading && !failed && list.length > shown && (
                <div className="flex justify-center">
                    <button type="button" className={btn.secondary} onClick={() => setShown((n) => n + PAGE)}>
                        {t("showMore", { count: Math.min(PAGE, list.length - shown) })}
                    </button>
                </div>
            )}

            <EditInterviewModal
                isOpen={!!editing}
                interview={editing}
                onClose={() => setEditing(null)}
                onSuccess={(updated: Partial<Interview> | undefined) => {
                    if (editing) {
                        const patch: Partial<Interview> = {};
                        if (updated && typeof updated === "object") {
                            for (const k of ["scheduled_at", "type", "location", "notes", "status"] as const) {
                                if (updated[k] !== undefined) (patch as Record<string, unknown>)[k] = updated[k];
                            }
                        }
                        patchLocal(editing.id, patch);
                    }
                    void load();
                }}
            />

            <AdminModal isOpen={!!confirm} onClose={() => setConfirm(null)} title={confirm?.kind === "delete" ? t("deleteTitle") : t("cancelTitle")}>
                <p className="text-sm text-km-text-secondary">
                    {confirm?.kind === "delete"
                        ? t("deleteBody")
                        : t("cancelBody", { name: confirm?.item.candidate?.name || t("candidate") })}
                </p>
                <div className="mt-6 flex flex-wrap justify-end gap-2">
                    <button type="button" className={btn.secondary} onClick={() => setConfirm(null)}>{t("keep")}</button>
                    <button type="button" className={btn.danger} onClick={onConfirm}>
                        {confirm?.kind === "delete" ? t("deleteConfirm") : t("cancelConfirm")}
                    </button>
                </div>
            </AdminModal>
        </div>
    );
}

export default function RecruiterInterviewsPage() {
    return (
        <Suspense fallback={<div className="rounded-2xl border border-km-border bg-km-surface-card"><SkeletonRows rows={5} /></div>}>
            <InterviewsView />
        </Suspense>
    );
}
