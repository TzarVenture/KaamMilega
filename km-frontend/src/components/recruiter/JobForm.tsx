"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
    BriefcaseIcon,
    CaretDownIcon,
    ClockIcon,
    CurrencyInrIcon,
    GraduationCapIcon,
    MagnifyingGlassIcon,
    MapPinIcon,
    PlusIcon,
    XIcon,
} from "@phosphor-icons/react";
import api from "@/lib/axios";
import CompanyLogo from "@/components/ui/CompanyLogo";
import { btn, cx } from "@/components/admin/ui";
import { inrNumber } from "@/components/recruiter/jobFormat";

/** Same limits as the server (km-backend/internal/features/job/validate.go) */
export const LIMITS = { titleMin: 3, titleMax: 100, descMin: 30, descMax: 5000, items: 20, itemMax: 200, salaryMax: 10_000_000, expMax: 50, locationMax: 200 };

export const JOB_TYPES = ["Full-time", "Part-time", "Contract", "Freelance", "Internship"] as const;
const EDUCATION = ["", "10th Pass", "12th Pass", "Diploma", "Graduation", "Post Graduation"] as const;
const GENDER = ["", "Male", "Female"] as const;
const BENEFIT_KEYS = ["pf", "esic", "health", "bonus", "food", "stay", "travel", "overtime", "weeklyOff"] as const;

export interface JobFormValues {
    title: string;
    city_id: string;
    city_name: string;
    location: string;
    job_type: string;
    salary_min: string;
    salary_max: string;
    experience_min: string;
    experience_max: string;
    education: string;
    gender: string;
    description: string;
    requirements: string[];
    we_offer: string[];
}

export const EMPTY_JOB: JobFormValues = {
    title: "", city_id: "", city_name: "", location: "", job_type: "Full-time",
    salary_min: "", salary_max: "", experience_min: "", experience_max: "",
    education: "", gender: "", description: "", requirements: [], we_offer: [],
};

/** What the API takes */
export function toPayload(v: JobFormValues) {
    const n = (s: string) => (s.trim() === "" ? 0 : Math.max(0, Math.floor(Number(s))));
    return {
        title: v.title.trim(),
        city_id: v.city_id,
        location: v.location.trim(),
        job_type: v.job_type,
        salary_min: n(v.salary_min),
        salary_max: n(v.salary_max),
        experience_min: n(v.experience_min),
        experience_max: n(v.experience_max),
        education: v.education,
        gender: v.gender,
        description: v.description.trim(),
        requirements: v.requirements,
        we_offer: v.we_offer,
    };
}

type Field = "title" | "city" | "location" | "salary" | "experience" | "description" | "lists";

function validate(v: JobFormValues): Partial<Record<Field, string>> {
    const e: Partial<Record<Field, string>> = {};
    const len = (s: string) => s.trim().length;
    if (len(v.title) < LIMITS.titleMin || len(v.title) > LIMITS.titleMax) e.title = "title";
    if (!v.city_id) e.city = "city";
    if (len(v.location) > LIMITS.locationMax) e.location = "location";
    const num = (s: string) => (s.trim() === "" ? 0 : Number(s));
    const range = (lo: number, hi: number, max: number) =>
        Number.isInteger(lo) && Number.isInteger(hi) && lo >= 0 && hi >= 0 && lo <= max && hi <= max && (hi === 0 || lo === 0 || hi >= lo);
    if (!range(num(v.salary_min), num(v.salary_max), LIMITS.salaryMax)) e.salary = "salary";
    if (!range(num(v.experience_min), num(v.experience_max), LIMITS.expMax)) e.experience = "experience";
    if (len(v.description) < LIMITS.descMin || len(v.description) > LIMITS.descMax) e.description = "description";
    return e;
}

/** Which field the server's error code points at */
export function fieldOfCode(code?: string): Field | null {
    switch (code) {
        case "JOB_TITLE_INVALID": return "title";
        case "JOB_CITY_REQUIRED": case "JOB_CITY_INVALID": return "city";
        case "JOB_LOCATION_INVALID": return "location";
        case "JOB_SALARY_INVALID": return "salary";
        case "JOB_EXPERIENCE_INVALID": return "experience";
        case "JOB_DESCRIPTION_INVALID": return "description";
        case "JOB_LIST_INVALID": return "lists";
    }
    return null;
}

const input = "w-full h-11 rounded-xl border bg-km-surface-card px-3.5 text-sm text-km-text-primary placeholder:text-km-text-secondary/70 outline-none transition-colors focus:border-[#0B5ED7]";
const border = (bad?: boolean) => (bad ? "border-red-500" : "border-km-border");

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="rounded-2xl border border-km-border bg-km-surface-card p-5 sm:p-6">
            <h2 className="text-base font-semibold text-km-heading">{title}</h2>
            <div className="mt-4 space-y-5">{children}</div>
        </section>
    );
}

function Label({ htmlFor, children, optional }: { htmlFor?: string; children: React.ReactNode; optional?: string }) {
    return (
        <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-km-text-primary">
            {children}
            {optional && <span className="ml-1 font-normal text-km-text-secondary">{optional}</span>}
        </label>
    );
}

const FieldError = ({ id, text }: { id: string; text?: string }) =>
    text ? <p id={id} className="mt-1.5 text-xs text-red-600 dark:text-red-400">{text}</p> : null;

type City = { id: string; name: string; state?: string };

function CityPicker({ value, name, onPick, invalid, placeholder, searchLabel, emptyLabel }: {
    value: string; name: string; onPick: (c: City) => void; invalid?: boolean; placeholder: string; searchLabel: string; emptyLabel: string;
}) {
    const [cities, setCities] = useState<City[]>([]);
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        api.get("/cities")
            .then((r: unknown) => {
                const list = (r as { data?: City[] })?.data ?? (Array.isArray(r) ? (r as City[]) : []);
                setCities(list);
            })
            .catch(() => {});
    }, []);
    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    const shown = useMemo(() => {
        const s = q.trim().toLowerCase();
        return (s ? cities.filter((c) => c.name.toLowerCase().includes(s) || c.state?.toLowerCase().includes(s)) : cities).slice(0, 80);
    }, [cities, q]);

    return (
        <div ref={ref} className="relative">
            <button
                id="job-city"
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-describedby="job-city-err"
                className={cx(input, border(invalid), "flex items-center gap-2 text-left")}
            >
                <MapPinIcon size={18} className="shrink-0 text-km-text-secondary" aria-hidden="true" />
                <span className={cx("flex-1 truncate", !value && "text-km-text-secondary/70")}>{value ? name : placeholder}</span>
                <CaretDownIcon size={14} className="shrink-0 text-km-text-secondary" aria-hidden="true" />
            </button>
            {open && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-xl border border-km-border bg-km-surface-card shadow-lg">
                    <div className="border-b border-km-border/70 p-2">
                        <div className="relative">
                            <MagnifyingGlassIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-secondary" aria-hidden="true" />
                            <input
                                autoFocus
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder={searchLabel}
                                aria-label={searchLabel}
                                className="h-9 w-full rounded-lg border border-km-border bg-km-surface pl-9 pr-3 text-sm text-km-text-primary outline-none focus:border-[#0B5ED7]"
                            />
                        </div>
                    </div>
                    <ul role="listbox" className="max-h-60 overflow-y-auto py-1">
                        {shown.map((c) => (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={c.id === value}
                                    onClick={() => { onPick(c); setOpen(false); setQ(""); }}
                                    className={cx("flex w-full items-center justify-between px-3.5 py-2 text-left text-sm hover:bg-km-surface", c.id === value ? "font-semibold text-[#0B5ED7] dark:text-km-link" : "text-km-text-primary")}
                                >
                                    {c.name}
                                    {c.state && <span className="text-xs text-km-text-secondary">{c.state}</span>}
                                </button>
                            </li>
                        ))}
                        {shown.length === 0 && <li className="px-3.5 py-3 text-sm text-km-text-secondary">{emptyLabel}</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}

/** A list built one line at a time (requirements, benefits) */
function ListEditor({ id, items, onChange, placeholder, addLabel, removeLabel, suggestions }: {
    id: string; items: string[]; onChange: (next: string[]) => void; placeholder: string; addLabel: string; removeLabel: (item: string) => string;
    suggestions?: string[];
}) {
    const [draft, setDraft] = useState("");
    const full = items.length >= LIMITS.items;
    const add = (text: string) => {
        const v = text.trim().slice(0, LIMITS.itemMax);
        if (!v || full || items.some((i) => i.toLowerCase() === v.toLowerCase())) return;
        onChange([...items, v]);
    };
    const left = (suggestions ?? []).filter((s) => !items.some((i) => i.toLowerCase() === s.toLowerCase()));
    return (
        <div>
            {items.length > 0 && (
                <ul className="mb-2.5 space-y-1.5">
                    {items.map((item, i) => (
                        <li key={`${item}-${i}`} className="flex items-start gap-2 rounded-lg border border-km-border bg-km-surface px-3 py-2 text-sm text-km-text-primary">
                            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#0B5ED7]" aria-hidden="true" />
                            <span className="min-w-0 flex-1 break-words">{item}</span>
                            <button type="button" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label={removeLabel(item)} className="-m-1 rounded p-1 text-km-text-secondary hover:text-red-600">
                                <XIcon size={14} aria-hidden="true" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="flex gap-2">
                <input
                    id={id}
                    value={draft}
                    maxLength={LIMITS.itemMax}
                    disabled={full}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.preventDefault();
                            add(draft);
                            setDraft("");
                        }
                    }}
                    placeholder={placeholder}
                    className={cx(input, "border-km-border")}
                />
                <button type="button" disabled={!draft.trim() || full} onClick={() => { add(draft); setDraft(""); }} className={cx(btn.secondary, "shrink-0")}>
                    <PlusIcon size={16} weight="bold" aria-hidden="true" />
                    {addLabel}
                </button>
            </div>
            {left.length > 0 && !full && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {left.map((s) => (
                        <button key={s} type="button" onClick={() => add(s)} className="inline-flex h-8 items-center gap-1 rounded-full border border-km-border px-3 text-xs font-medium text-km-text-primary hover:border-[#0B5ED7] hover:text-[#0B5ED7]">
                            <PlusIcon size={12} weight="bold" aria-hidden="true" />
                            {s}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}

/** How the job will look to a candidate, updated while typing */
function Preview({ v, company, logo }: { v: JobFormValues; company: string; logo?: string }) {
    const t = useTranslations("recruiterJobForm");
    const n = (s: string) => (s.trim() === "" ? 0 : Number(s));
    const smin = n(v.salary_min), smax = n(v.salary_max), emin = n(v.experience_min), emax = n(v.experience_max);
    const salary = smin && smax && smin !== smax ? `₹${inrNumber(Math.min(smin, smax))} – ₹${inrNumber(Math.max(smin, smax))}` : smin || smax ? `₹${inrNumber(smin || smax)}` : "";
    const exp = !emin && !emax ? t("preview.fresher") : emin && emax ? t("preview.years", { range: `${emin}–${emax}` }) : emin ? t("preview.yearsPlus", { n: emin }) : t("preview.upTo", { n: emax });
    return (
        <div className="rounded-2xl border border-km-border bg-km-surface-card p-5">
            <p className="text-xs font-medium text-km-text-secondary">{t("preview.label")}</p>
            <div className="mt-3 flex items-start gap-3">
                <CompanyLogo src={logo} name={company} className="w-11 h-11" textClass="text-sm" />
                <div className="min-w-0">
                    <p className="font-semibold text-km-heading break-words">{v.title.trim() || t("preview.titlePlaceholder")}</p>
                    <p className="text-sm text-km-text-secondary truncate">{company}</p>
                </div>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-km-text-primary">
                <li className="flex items-center gap-2"><MapPinIcon size={16} className="shrink-0 text-km-text-secondary" aria-hidden="true" />{v.city_name || t("preview.cityPlaceholder")}</li>
                <li className="flex items-center gap-2"><ClockIcon size={16} className="shrink-0 text-km-text-secondary" aria-hidden="true" />{t(`type.${v.job_type}`)}</li>
                <li className="flex items-center gap-2"><CurrencyInrIcon size={16} className="shrink-0 text-km-text-secondary" aria-hidden="true" />{salary ? t("preview.perMonth", { amount: salary }) : t("preview.salaryHidden")}</li>
                <li className="flex items-center gap-2"><BriefcaseIcon size={16} className="shrink-0 text-km-text-secondary" aria-hidden="true" />{exp}</li>
                {v.education && <li className="flex items-center gap-2"><GraduationCapIcon size={16} className="shrink-0 text-km-text-secondary" aria-hidden="true" />{t(`education.${v.education}`)}</li>}
            </ul>
            {v.we_offer.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                    {v.we_offer.slice(0, 6).map((b) => (
                        <span key={b} className="rounded-md bg-km-surface px-2 py-1 text-xs text-km-text-primary">{b}</span>
                    ))}
                </div>
            )}
            {v.description.trim() && <p className="mt-4 line-clamp-4 whitespace-pre-line text-sm text-km-text-secondary">{v.description.trim()}</p>}
        </div>
    );
}

export default function JobForm({ initial, onSubmit, submitLabel, onCancel, onChange, serverField }: {
    initial: JobFormValues;
    onSubmit: (v: JobFormValues) => Promise<void>;
    submitLabel: string;
    onCancel: () => void;
    /** Every change, e.g. to keep a draft */
    onChange?: (v: JobFormValues) => void;
    /** The field a server error pointed at */
    serverField?: string | null;
}) {
    const t = useTranslations("recruiterJobForm");
    const [v, setV] = useState<JobFormValues>(initial);
    const [tried, setTried] = useState(false);
    const [busy, setBusy] = useState(false);
    const [company, setCompany] = useState<{ name: string; logo?: string }>({ name: "" });

    useEffect(() => {
        api.get("/user/profile")
            .then((u: unknown) => {
                const p = u as { company_name?: string; name?: string; company_logo?: string };
                setCompany({ name: p?.company_name || p?.name || "", logo: p?.company_logo });
            })
            .catch(() => {});
    }, []);

    const set = <K extends keyof JobFormValues>(k: K, val: JobFormValues[K]) => setV((prev) => ({ ...prev, [k]: val }));
    // Report every change (the create page keeps a draft from it)
    const onChangeRef = useRef(onChange);
    useEffect(() => {
        onChangeRef.current = onChange;
    });
    useEffect(() => {
        onChangeRef.current?.(v);
    }, [v]);

    const errors = validate(v);
    // Number ranges are checked as they are typed; the rest once Post is pressed
    const live = (f: Field) => f === "salary" || f === "experience";
    const show = (f: Field) => (tried || live(f) || serverField === f) && (errors[f] || serverField === f) ? t(`error.${f}`) : undefined;
    const digits = (s: string) => s.replace(/[^\d]/g, "").slice(0, 9);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        setTried(true);
        const bad = Object.keys(validate(v))[0];
        if (bad) {
            document.getElementById(`job-${bad}`)?.focus();
            return;
        }
        setBusy(true);
        try {
            await onSubmit(v);
        } finally {
            setBusy(false);
        }
    };

    const salaryHint = (() => {
        const lo = Number(v.salary_min || 0), hi = Number(v.salary_max || 0);
        if (!lo && !hi) return t("hint.salaryEmpty");
        return t("hint.salaryShown", { amount: lo && hi ? `₹${inrNumber(lo)} – ₹${inrNumber(hi)}` : `₹${inrNumber(lo || hi)}` });
    })();

    return (
        <form onSubmit={submit} noValidate className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-6 min-w-0">
                <Section title={t("section.basics")}>
                    <div>
                        <Label htmlFor="job-title">{t("field.title")}</Label>
                        <input id="job-title" value={v.title} maxLength={LIMITS.titleMax} onChange={(e) => set("title", e.target.value)} placeholder={t("placeholder.title")} aria-invalid={!!show("title") || undefined} aria-describedby="job-title-err" className={cx(input, border(!!show("title")))} />
                        <FieldError id="job-title-err" text={show("title")} />
                    </div>
                    <div>
                        <Label>{t("field.type")}</Label>
                        <div role="radiogroup" aria-label={t("field.type")} className="flex flex-wrap gap-2">
                            {JOB_TYPES.map((jt) => (
                                <button
                                    key={jt}
                                    type="button"
                                    role="radio"
                                    aria-checked={v.job_type === jt}
                                    onClick={() => set("job_type", jt)}
                                    className={cx("h-9 rounded-full border px-4 text-sm font-medium transition-colors", v.job_type === jt ? "border-[#0B5ED7] bg-[#0B5ED7] text-white" : "border-km-border text-km-text-primary hover:border-[#0B5ED7]")}
                                >
                                    {t(`type.${jt}`)}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="job-city">{t("field.city")}</Label>
                            <CityPicker value={v.city_id} name={v.city_name} invalid={!!show("city")} placeholder={t("placeholder.city")} searchLabel={t("placeholder.searchCity")} emptyLabel={t("noCity")}
                                onPick={(c) => setV((prev) => ({ ...prev, city_id: c.id, city_name: c.name }))} />
                            <FieldError id="job-city-err" text={show("city")} />
                        </div>
                        <div>
                            <Label htmlFor="job-location" optional={t("optional")}>{t("field.location")}</Label>
                            <input id="job-location" value={v.location} maxLength={LIMITS.locationMax} onChange={(e) => set("location", e.target.value)} placeholder={t("placeholder.location")} className={cx(input, border(!!show("location")))} />
                            <FieldError id="job-location-err" text={show("location")} />
                        </div>
                    </div>
                </Section>

                <Section title={t("section.pay")}>
                    <div>
                        <Label htmlFor="job-salary">{t("field.salary")}</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {(["salary_min", "salary_max"] as const).map((k, i) => (
                                <div key={k} className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-km-text-secondary" aria-hidden="true">₹</span>
                                    <input id={i === 0 ? "job-salary" : undefined} inputMode="numeric" value={v[k]} onChange={(e) => set(k, digits(e.target.value))} placeholder={i === 0 ? t("placeholder.min") : t("placeholder.max")} aria-label={i === 0 ? t("aria.salaryMin") : t("aria.salaryMax")} aria-invalid={!!show("salary") || undefined} className={cx(input, border(!!show("salary")), "pl-8 font-inter tabular-nums")} />
                                </div>
                            ))}
                        </div>
                        {show("salary") ? <FieldError id="job-salary-err" text={show("salary")} /> : <p className="mt-1.5 text-xs text-km-text-secondary">{salaryHint}</p>}
                    </div>
                    <div>
                        <Label htmlFor="job-experience">{t("field.experience")}</Label>
                        <div className="grid grid-cols-2 gap-3">
                            {(["experience_min", "experience_max"] as const).map((k, i) => (
                                <input key={k} id={i === 0 ? "job-experience" : undefined} inputMode="numeric" value={v[k]} onChange={(e) => set(k, digits(e.target.value).slice(0, 2))} placeholder={i === 0 ? t("placeholder.minYears") : t("placeholder.maxYears")} aria-label={i === 0 ? t("aria.expMin") : t("aria.expMax")} aria-invalid={!!show("experience") || undefined} className={cx(input, border(!!show("experience")), "font-inter tabular-nums")} />
                            ))}
                        </div>
                        {show("experience") ? <FieldError id="job-experience-err" text={show("experience")} /> : <p className="mt-1.5 text-xs text-km-text-secondary">{t("hint.experience")}</p>}
                    </div>
                    <div className="grid gap-5 sm:grid-cols-2">
                        <div>
                            <Label htmlFor="job-education">{t("field.education")}</Label>
                            <select id="job-education" value={v.education} onChange={(e) => set("education", e.target.value)} className={cx(input, "border-km-border cursor-pointer")}>
                                {EDUCATION.map((o) => <option key={o} value={o}>{t(`education.${o || "any"}`)}</option>)}
                            </select>
                        </div>
                        <div>
                            <Label htmlFor="job-gender">{t("field.gender")}</Label>
                            <select id="job-gender" value={v.gender} onChange={(e) => set("gender", e.target.value)} className={cx(input, "border-km-border cursor-pointer")}>
                                {GENDER.map((o) => <option key={o} value={o}>{t(`gender.${o || "any"}`)}</option>)}
                            </select>
                        </div>
                    </div>
                </Section>

                <Section title={t("section.details")}>
                    <div>
                        <div className="flex items-baseline justify-between">
                            <Label htmlFor="job-description">{t("field.description")}</Label>
                            <span className="text-xs text-km-text-secondary font-inter tabular-nums">{v.description.trim().length} / {LIMITS.descMax}</span>
                        </div>
                        <textarea id="job-description" rows={7} value={v.description} maxLength={LIMITS.descMax} onChange={(e) => set("description", e.target.value)} placeholder={t("placeholder.description")} aria-invalid={!!show("description") || undefined} className={cx(input, border(!!show("description")), "h-auto py-3 leading-relaxed resize-y")} />
                        <FieldError id="job-description-err" text={show("description")} />
                    </div>
                    <div>
                        <Label htmlFor="job-requirements" optional={t("optional")}>{t("field.requirements")}</Label>
                        <ListEditor id="job-requirements" items={v.requirements} onChange={(x) => set("requirements", x)} placeholder={t("placeholder.requirement")} addLabel={t("add")} removeLabel={(i) => t("remove", { item: i })} />
                    </div>
                    <div>
                        <Label htmlFor="job-benefits" optional={t("optional")}>{t("field.benefits")}</Label>
                        <ListEditor id="job-benefits" items={v.we_offer} onChange={(x) => set("we_offer", x)} placeholder={t("placeholder.benefit")} addLabel={t("add")} removeLabel={(i) => t("remove", { item: i })} suggestions={BENEFIT_KEYS.map((k) => t(`benefit.${k}`))} />
                        <FieldError id="job-lists-err" text={show("lists")} />
                    </div>
                </Section>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
                <Preview v={v} company={company.name} logo={company.logo} />
                <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end xl:flex-col">
                    <button type="submit" disabled={busy} className={cx(btn.accent, "sm:min-w-40 xl:w-full")}>
                        {busy ? t("saving") : submitLabel}
                    </button>
                    <button type="button" onClick={onCancel} className={cx(btn.secondary, "sm:min-w-28 xl:w-full")}>{t("cancel")}</button>
                </div>
            </aside>
        </form>
    );
}
