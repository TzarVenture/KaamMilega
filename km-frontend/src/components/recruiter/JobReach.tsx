"use client";

import { useFormatter, useTranslations } from "next-intl";
import type { JobViews } from "@/lib/api/recruiter";

/** How many people saw a job and how many of them applied, with views per day for two weeks */
export default function JobReach({ views, applicants }: { views?: JobViews; applicants: number }) {
    const t = useTranslations("recruiterJobs.reach");
    const format = useFormatter();
    const total = views?.total ?? 0;
    const daily = views?.daily ?? [];
    const peak = Math.max(1, ...daily.map((d) => d.count));
    // Applies can come before views were counted, so the rate never goes above 100%
    const rate = total > 0 ? Math.min(100, Math.round((applicants / total) * 1000) / 10) : null;
    const day = (iso: string) => format.dateTime(new Date(`${iso}T00:00:00+05:30`), { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

    const stats = [
        { label: t("views"), value: format.number(total) },
        { label: t("lastWeek"), value: format.number(views?.last_7_days ?? 0) },
        { label: t("applicants"), value: format.number(applicants) },
        { label: t("applyRate"), value: rate === null ? "–" : `${rate}%` },
    ];

    return (
        <section className="bg-km-surface-card border border-km-border rounded-2xl px-5 py-4 mb-6" aria-labelledby="job-reach">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 id="job-reach" className="text-sm font-semibold text-km-heading">{t("title")}</h2>
                <p className="text-xs text-km-text-secondary">{t("hint")}</p>
            </div>
            <dl className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                {stats.map((s) => (
                    <div key={s.label} className="rounded-xl bg-km-surface px-3 py-2.5">
                        <dt className="text-xs text-km-text-secondary">{s.label}</dt>
                        <dd className="mt-0.5 text-xl font-bold text-km-heading font-inter tabular-nums">{s.value}</dd>
                    </div>
                ))}
            </dl>
            {daily.length > 0 && (
                <figure className="mt-4">
                    <figcaption className="sr-only">{t("chartLabel")}</figcaption>
                    <ol className="flex h-24 items-end gap-1" aria-label={t("chartLabel")}>
                        {daily.map((d) => (
                            <li key={d.date} className="flex h-full flex-1 flex-col justify-end" title={t("dayViews", { date: day(d.date), count: d.count })}>
                                <span className="sr-only">{t("dayViews", { date: day(d.date), count: d.count })}</span>
                                <span
                                    className={d.count > 0 ? "block rounded-t bg-[#0B5ED7] dark:bg-[#60A5FA]" : "block rounded-t bg-km-border-subtle"}
                                    style={{ height: d.count > 0 ? `${Math.max(6, (d.count / peak) * 100)}%` : "3px" }}
                                    aria-hidden="true"
                                />
                            </li>
                        ))}
                    </ol>
                    <div className="mt-1 flex justify-between text-xs text-km-text-secondary font-inter" aria-hidden="true">
                        <span>{day(daily[0].date)}</span>
                        <span>{t("today")}</span>
                    </div>
                </figure>
            )}
        </section>
    );
}
