"use client";

import { useCallback, useEffect, useState } from "react";
import { DownloadSimpleIcon } from "@phosphor-icons/react";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";

/** One sign-up from the "Notify me when the app launches" form (GET /admin/app-waitlist) */
interface WaitlistEntry {
    id: string;
    mobile: string;
    interest: "hire" | "work";
    trade?: string;
    created_at: string;
    updated_at: string;
}

interface WaitlistPage {
    data: WaitlistEntry[];
    total: number;
    page: number;
    limit: number;
}

type Filter = "" | "hire" | "work";

const PAGE_SIZE = 50;
const EXPORT_PAGE_SIZE = 200; // the API's maximum

const FILTERS: { value: Filter; label: string }[] = [
    { value: "", label: "All" },
    { value: "hire", label: "Hire" },
    { value: "work", label: "Work" },
];

const formatDate = (iso: string) => {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
        ? "—"
        : d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const fetchPage = (interest: Filter, page: number, limit: number) => {
    const q = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (interest) q.set("interest", interest);
    return api.get(`/admin/app-waitlist?${q.toString()}`) as Promise<WaitlistPage>;
};

export default function AppWaitlistPage() {
    const [filter, setFilter] = useState<Filter>("");
    const [page, setPage] = useState(1);
    const [result, setResult] = useState<WaitlistPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const load = useCallback(async (interest: Filter, p: number) => {
        setLoading(true);
        try {
            setResult(await fetchPage(interest, p, PAGE_SIZE));
        } catch (err) {
            notify.error(err, "Could not load the waitlist");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void load(filter, page);
    }, [filter, page, load]);

    const pages = result ? Math.max(1, Math.ceil(result.total / PAGE_SIZE)) : 1;

    // Every sign-up in the current filter, for messaging people at launch
    const exportCsv = async () => {
        setExporting(true);
        try {
            const rows: WaitlistEntry[] = [];
            for (let p = 1; ; p++) {
                const res = await fetchPage(filter, p, EXPORT_PAGE_SIZE);
                rows.push(...res.data);
                if (res.data.length < EXPORT_PAGE_SIZE || rows.length >= res.total) break;
            }
            const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
            const csv = [
                ["Mobile", "Interest", "Trade", "Signed up", "Last updated"].join(","),
                ...rows.map((r) =>
                    [`+91${r.mobile}`, r.interest, r.trade || "", r.created_at, r.updated_at].map(escape).join(","),
                ),
            ].join("\n");
            const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
            const a = document.createElement("a");
            a.href = url;
            a.download = `app-waitlist${filter ? `-${filter}` : ""}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            notify.success(`Exported ${rows.length} sign-ups`);
        } catch (err) {
            notify.error(err, "Could not export the waitlist");
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-km-text-primary">App Waitlist</h1>
                    <p className="mt-1 text-sm text-km-text-secondary">
                        People who asked to be told when the KaamMilega app launches (InstantMilega page and the Get the app dialog).
                    </p>
                </div>
                <button
                    type="button"
                    onClick={exportCsv}
                    disabled={exporting || !result || result.total === 0}
                    className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-km-primary hover:bg-km-primary-dark text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                    <DownloadSimpleIcon size={16} weight="bold" aria-hidden="true" />
                    {exporting ? "Exporting…" : "Export CSV"}
                </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div role="radiogroup" aria-label="Interest" className="inline-flex p-1 rounded-xl bg-km-surface border border-km-border">
                    {FILTERS.map(({ value, label }) => (
                        <button
                            key={label}
                            type="button"
                            role="radio"
                            aria-checked={filter === value}
                            onClick={() => {
                                setFilter(value);
                                setPage(1);
                            }}
                            className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                                filter === value ? "bg-km-surface-card text-km-text-primary shadow-xs" : "text-km-text-secondary hover:text-km-text-primary"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
                {result && (
                    <p className="text-sm text-km-text-secondary">
                        {result.total.toLocaleString("en-IN")} {result.total === 1 ? "sign-up" : "sign-ups"}
                    </p>
                )}
            </div>

            <div className="bg-km-surface-card rounded-2xl border border-km-border overflow-x-auto">
                {loading ? (
                    <p className="p-8 text-center text-sm text-km-text-secondary">Loading…</p>
                ) : !result || result.data.length === 0 ? (
                    <p className="p-8 text-center text-sm text-km-text-secondary">No sign-ups yet.</p>
                ) : (
                    <table className="min-w-full text-sm">
                        <thead className="bg-km-surface text-left text-km-text-secondary">
                            <tr>
                                <th scope="col" className="px-5 py-3 font-semibold">Mobile</th>
                                <th scope="col" className="px-5 py-3 font-semibold">Interest</th>
                                <th scope="col" className="px-5 py-3 font-semibold">Trade</th>
                                <th scope="col" className="px-5 py-3 font-semibold">Signed up</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-km-border">
                            {result.data.map((entry) => (
                                <tr key={entry.id}>
                                    <td className="px-5 py-3 font-medium text-km-text-primary whitespace-nowrap">+91 {entry.mobile}</td>
                                    <td className="px-5 py-3">
                                        <span
                                            className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                                                entry.interest === "hire"
                                                    ? "bg-[#EBF3FE] text-km-link dark:bg-[#172A50]"
                                                    : "bg-[#FFF7ED] text-[#C2410C] dark:bg-[#34272F] dark:text-orange-300"
                                            }`}
                                        >
                                            {entry.interest === "hire" ? "Hire" : "Work"}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-km-text-secondary">{entry.trade || "—"}</td>
                                    <td className="px-5 py-3 text-km-text-secondary whitespace-nowrap">{formatDate(entry.created_at)}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {pages > 1 && (
                <div className="flex items-center justify-end gap-2 text-sm">
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1 || loading}
                        className="px-3 h-9 rounded-lg border border-km-border text-km-text-primary disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                        Previous
                    </button>
                    <span className="text-km-text-secondary">
                        Page {page} of {pages}
                    </span>
                    <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(pages, p + 1))}
                        disabled={page >= pages || loading}
                        className="px-3 h-9 rounded-lg border border-km-border text-km-text-primary disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
