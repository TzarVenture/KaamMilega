"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { CaretLeftIcon, CaretRightIcon, CheckCircleIcon, FileTextIcon, MagnifyingGlassIcon, MapPinIcon, UsersThreeIcon, WarningCircleIcon, WrenchIcon } from "@phosphor-icons/react";
import RecruiterBanner, { HeroAccent } from "@/components/km/RecruiterBanner";
import { btn, cx, EmptyState, field } from "@/components/admin/ui";
import TalentCardItem from "@/components/recruiter/TalentCardItem";
import { recruiterApi, type TalentCard, type TalentPage } from "@/lib/api/recruiter";
import { notify } from "@/lib/notify";

const LIMIT = 20;

function CardSkeleton() {
    return (
        <li className="animate-pulse rounded-2xl border border-km-border bg-km-surface-card p-5" aria-hidden="true">
            <div className="flex gap-3">
                <div className="h-12 w-12 rounded-full bg-km-border-subtle" />
                <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/2 rounded bg-km-border-subtle" />
                    <div className="h-3 w-1/3 rounded bg-km-border-subtle" />
                </div>
            </div>
            <div className="mt-4 flex gap-2">
                <div className="h-5 w-16 rounded bg-km-border-subtle" />
                <div className="h-5 w-12 rounded bg-km-border-subtle" />
                <div className="h-5 w-20 rounded bg-km-border-subtle" />
            </div>
        </li>
    );
}

function TalentView() {
    const t = useTranslations("recruiterTalent");
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();

    const q = params.get("q") || "";
    const city = params.get("city") || "";
    const skill = params.get("skill") || "";
    const openToWork = params.get("otw") === "1";
    const hasResume = params.get("resume") === "1";
    const page = Math.max(1, Number(params.get("page")) || 1);
    const savedView = params.get("view") === "saved";
    const key = JSON.stringify([savedView, q, city, skill, openToWork, hasResume, page]);
    const anyFilter = !!(q || city || skill || openToWork || hasResume);

    const [draft, setDraft] = useState({ q, city, skill });
    // When the URL changes from outside (back/forward), the boxes follow it
    const urlText = JSON.stringify([q, city, skill]);
    const [seenUrlText, setSeenUrlText] = useState(urlText);
    if (seenUrlText !== urlText) {
        setSeenUrlText(urlText);
        if (draft.q.trim() !== q || draft.city.trim() !== city || draft.skill.trim() !== skill) setDraft({ q, city, skill });
    }
    const [result, setResult] = useState<{ key: string; data?: TalentPage; failed?: boolean } | null>(null);
    const [attempt, setAttempt] = useState(0);

    const setUrl = useCallback((next: Record<string, string | boolean | number | undefined>) => {
        const sp = new URLSearchParams(params.toString());
        for (const [k, v] of Object.entries(next)) {
            if (v === undefined || v === "" || v === false || (k === "page" && v === 1)) sp.delete(k);
            else sp.set(k, v === true ? "1" : String(v));
        }
        const qs = sp.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [params, pathname, router]);

    // Debounced text filters into the URL (a change starts again from page 1)
    useEffect(() => {
        const next = { q: draft.q.trim(), city: draft.city.trim(), skill: draft.skill.trim() };
        if (next.q === q && next.city === city && next.skill === skill) return;
        const id = window.setTimeout(() => setUrl({ ...next, page: 1 }), 350);
        return () => window.clearTimeout(id);
    }, [draft, q, city, skill, setUrl]);

    useEffect(() => {
        let alive = true;
        const load = savedView
            ? recruiterApi.saved({ page, limit: LIMIT })
            : recruiterApi.talent({ search: q, city, skill, open_to_work: openToWork, has_resume: hasResume, page, limit: LIMIT });
        load
            .then((data) => { if (alive) setResult({ key, data }); })
            .catch(() => { if (alive) setResult({ key, failed: true }); });
        return () => { alive = false; };
    }, [key, savedView, q, city, skill, openToWork, hasResume, page, attempt]);

    // Who the employer saved, so every card shows it
    const [savedIds, setSavedIds] = useState<Set<string> | null>(null);
    useEffect(() => {
        let alive = true;
        recruiterApi.savedIds()
            .then((r) => { if (alive) setSavedIds(new Set(r?.ids ?? [])); })
            .catch(() => { if (alive) setSavedIds(new Set()); });
        return () => { alive = false; };
    }, []);

    const toggleSave = async (person: TalentCard) => {
        const was = savedIds?.has(person.id) ?? false;
        const flip = (on: boolean) => setSavedIds((prev) => {
            const next = new Set(prev ?? []);
            if (on) next.add(person.id); else next.delete(person.id);
            return next;
        });
        flip(!was);
        try {
            if (was) await recruiterApi.unsave(person.id);
            else await recruiterApi.save(person.id);
            notify.success(was ? t("unsaved", { name: person.name }) : t("saved", { name: person.name }));
            // On the Saved list, someone removed leaves it
            if (was && savedView) {
                setResult((r) => (r?.data ? { ...r, data: { ...r.data, items: r.data.items.filter((p) => p.id !== person.id), total: Math.max(0, r.data.total - 1) } } : r));
            }
        } catch (err) {
            flip(was);
            notify.error(err, t("saveFailed"));
        }
    };

    const current = result && result.key === key ? result : null;
    const loading = !current;
    const data = current?.data;
    const items = data?.items || [];
    const total = data?.total || 0;
    const pages = Math.max(1, Math.ceil(total / LIMIT));

    const clearAll = () => {
        setDraft({ q: "", city: "", skill: "" });
        router.replace(pathname, { scroll: false });
    };

    const toggle = (name: "otw" | "resume", on: boolean, label: string, Icon: typeof CheckCircleIcon) => (
        <button
            type="button"
            aria-pressed={on}
            onClick={() => setUrl({ [name]: !on, page: 1 })}
            className={cx(
                "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-medium transition-colors",
                on ? "border-km-blue bg-blue-50 text-blue-700 dark:bg-[#14357F] dark:text-[#93C5FD]" : "border-km-border bg-km-surface-card text-km-text-secondary hover:text-km-heading",
            )}
        >
            <Icon size={16} weight={on ? "fill" : "regular"} aria-hidden="true" />
            {label}
        </button>
    );

    return (
        <div className="space-y-5">
            <RecruiterBanner
                kicker={{ label: t("kicker"), Icon: MagnifyingGlassIcon, tone: "jobs" }}
                title={t.rich("bannerTitle", { accent: (c) => <HeroAccent>{c}</HeroAccent> })}
                description={t("bannerDescription")}
                art={{ src: "/recruiter-talent-art.svg", alt: t("artAlt") }}
            >
                <label className="relative block w-full max-w-xl">
                    <span className="sr-only">{t("searchLabel")}</span>
                    <MagnifyingGlassIcon size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    <input
                        type="search"
                        value={draft.q}
                        onChange={(e) => setDraft((d) => ({ ...d, q: e.target.value }))}
                        placeholder={t("searchPlaceholder")}
                        className="h-12 w-full rounded-xl border border-white/20 bg-white pl-11 pr-4 text-base text-slate-900 placeholder:text-slate-500 outline-none focus:ring-2 focus:ring-[#FF6B00]"
                    />
                </label>
            </RecruiterBanner>

            <div role="tablist" aria-label={t("viewLabel")} className="inline-flex rounded-xl border border-km-border bg-km-surface-card p-1">
                {([["all", t("viewAll")], ["saved", savedIds ? t("viewSavedCount", { count: savedIds.size }) : t("viewSaved")]] as const).map(([v, label]) => {
                    const on = (v === "saved") === savedView;
                    return (
                        <button
                            key={v}
                            type="button"
                            role="tab"
                            aria-selected={on}
                            onClick={() => { if (!on) router.replace(v === "saved" ? `${pathname}?view=saved` : pathname, { scroll: false }); }}
                            className={cx(
                                "h-9 rounded-lg px-4 text-sm font-semibold transition-colors",
                                on ? "bg-[#0B5ED7] text-white" : "text-km-text-secondary hover:text-km-heading",
                            )}
                        >
                            {label}
                        </button>
                    );
                })}
            </div>

            {!savedView && (
            <div className="flex flex-col gap-3 rounded-2xl border border-km-border bg-km-surface-card p-4 md:flex-row md:flex-wrap md:items-end">
                <label className="block md:w-56">
                    <span className={field.label}>{t("city")}</span>
                    <span className="relative block">
                        <MapPinIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted" aria-hidden="true" />
                        <input value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} placeholder={t("cityPlaceholder")} className={cx(field.input, "pl-9")} />
                    </span>
                </label>
                <label className="block md:w-56">
                    <span className={field.label}>{t("skill")}</span>
                    <span className="relative block">
                        <WrenchIcon size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-km-text-muted" aria-hidden="true" />
                        <input value={draft.skill} onChange={(e) => setDraft((d) => ({ ...d, skill: e.target.value }))} placeholder={t("skillPlaceholder")} className={cx(field.input, "pl-9")} />
                    </span>
                </label>
                <div className="flex flex-wrap gap-2">
                    {toggle("otw", openToWork, t("openToWorkOnly"), CheckCircleIcon)}
                    {toggle("resume", hasResume, t("resumeAvailable"), FileTextIcon)}
                </div>
                {anyFilter && (
                    <button type="button" onClick={clearAll} className={cx(btn.ghost, "md:ml-auto")}>{t("clearFilters")}</button>
                )}
            </div>
            )}

            {current?.failed ? (
                <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-[#2A1215] dark:text-red-300">
                    <span className="flex items-center gap-2">
                        <WarningCircleIcon size={18} weight="bold" aria-hidden="true" />
                        {t("loadFailed")}
                    </span>
                    <button type="button" onClick={() => { setResult(null); setAttempt((n) => n + 1); }} className={btn.secondary}>{t("retry")}</button>
                </div>
            ) : (
                <>
                    <p className="text-sm text-km-text-secondary" aria-live="polite">
                        {loading ? t("searching") : savedView ? t("savedCount", { count: total }) : anyFilter ? t("resultCount", { count: total }) : t("defaultCount", { count: total })}
                    </p>
                    {loading ? (
                        <ul className="grid gap-4 md:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}</ul>
                    ) : items.length === 0 ? (
                        <div className="rounded-2xl border border-km-border bg-km-surface-card">
                            {savedView ? (
                                <EmptyState icon={UsersThreeIcon} title={t("noSaved")} description={t("noSavedHint")}
                                    action={<button type="button" onClick={() => router.replace(pathname, { scroll: false })} className={btn.secondary}>{t("viewAll")}</button>} />
                            ) : anyFilter ? (
                                <EmptyState icon={MagnifyingGlassIcon} title={t("noResults")} description={t("noResultsHint")}
                                    action={<button type="button" onClick={clearAll} className={btn.secondary}>{t("clearFilters")}</button>} />
                            ) : (
                                <EmptyState icon={UsersThreeIcon} title={t("noPeople")} description={t("noPeopleHint")} />
                            )}
                        </div>
                    ) : (
                        <ul className="grid gap-4 md:grid-cols-2">{items.map((p) => <TalentCardItem key={p.id} person={p} saved={savedIds?.has(p.id)} onToggleSave={savedIds ? toggleSave : undefined} />)}</ul>
                    )}
                    {!loading && pages > 1 && (
                        <nav className="flex items-center justify-center gap-3" aria-label={t("pagination")}>
                            <button type="button" className={btn.secondary} disabled={page <= 1} onClick={() => { setUrl({ page: page - 1 }); window.scrollTo({ top: 0 }); }}>
                                <CaretLeftIcon size={16} aria-hidden="true" />
                                {t("previous")}
                            </button>
                            <span className="text-sm text-km-text-secondary font-inter tabular-nums">{t("pageOf", { page, pages })}</span>
                            <button type="button" className={btn.secondary} disabled={page >= pages} onClick={() => { setUrl({ page: page + 1 }); window.scrollTo({ top: 0 }); }}>
                                {t("next")}
                                <CaretRightIcon size={16} aria-hidden="true" />
                            </button>
                        </nav>
                    )}
                </>
            )}
        </div>
    );
}

export default function RecruiterPeoplePage() {
    return (
        <Suspense fallback={null}>
            <TalentView />
        </Suspense>
    );
}
