"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, WarningCircleIcon } from "@phosphor-icons/react";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";
import JobForm, { EMPTY_JOB, fieldOfCode, toPayload, type JobFormValues } from "@/components/recruiter/JobForm";

/** An unfinished new job is kept on this device until it is posted or cleared */
const DRAFT_KEY = "km:recruiter-job-draft";

function readDraft(): JobFormValues | null {
    try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (!raw) return null;
        const d = JSON.parse(raw) as Partial<JobFormValues>;
        return { ...EMPTY_JOB, ...d, requirements: Array.isArray(d.requirements) ? d.requirements : [], we_offer: Array.isArray(d.we_offer) ? d.we_offer : [] };
    } catch {
        return null;
    }
}
const writeDraft = (v: JobFormValues | null) => {
    try {
        if (v) window.localStorage.setItem(DRAFT_KEY, JSON.stringify(v));
        else window.localStorage.removeItem(DRAFT_KEY);
    } catch {
        /* storage blocked: no draft */
    }
};
const isBlank = (v: JobFormValues) =>
    !v.title.trim() && !v.description.trim() && !v.city_id && !v.salary_min && !v.salary_max && v.requirements.length === 0 && v.we_offer.length === 0;

export default function CreateJobPage() {
    const t = useTranslations("recruiterJobForm");
    const router = useRouter();
    // The recruiter layout only shows this page in the browser, so the draft can be read at once
    const [restored] = useState(() => (typeof window === "undefined" ? null : readDraft()));
    const [formKey, setFormKey] = useState(0);
    const [initial, setInitial] = useState<JobFormValues>(restored ?? EMPTY_JOB);
    const [draftShown, setDraftShown] = useState(Boolean(restored));
    const [planUsedUp, setPlanUsedUp] = useState(false);
    const [serverField, setServerField] = useState<string | null>(null);

    const submit = async (v: JobFormValues) => {
        setServerField(null);
        try {
            const created = await api.post<unknown, { id?: string; _id?: string }>("/jobs", toPayload(v));
            writeDraft(null);
            notify.success(t("posted"));
            const id = created?.id || created?._id;
            router.push(id ? `/recruiter/jobs/${id}` : "/recruiter/jobs/list");
        } catch (err) {
            const code = (err as { code?: string })?.code;
            if (code === "PLAN_JOB_POSTS_USED_UP") setPlanUsedUp(true);
            setServerField(fieldOfCode(code));
            notify.error(err, t("postFailed"));
        }
    };

    const clearDraft = () => {
        writeDraft(null);
        setInitial(EMPTY_JOB);
        setDraftShown(false);
        setFormKey((k) => k + 1);
    };

    return (
        <div className="mx-auto max-w-6xl pb-12">
            <Link href="/recruiter/jobs/list" className="inline-flex items-center gap-1.5 text-sm font-medium text-km-link hover:underline">
                <ArrowLeftIcon size={14} weight="bold" aria-hidden="true" />
                {t("backToJobs")}
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-km-heading">{t("createTitle")}</h1>
            <p className="mt-1 text-sm text-km-text-secondary">{t("createText")}</p>

            {planUsedUp && (
                <div role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-[#33240A] dark:text-amber-200">
                    <WarningCircleIcon size={18} className="mt-0.5 shrink-0" aria-hidden="true" />
                    <span>
                        {t("planUsedUp")}{" "}
                        <Link href="/recruiter/plan" className="font-semibold underline">{t("upgrade")}</Link>
                    </span>
                </div>
            )}
            {draftShown && (
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-km-border bg-km-surface-card px-4 py-2.5 text-sm text-km-text-primary">
                    {t("draftRestored")}
                    <button type="button" onClick={clearDraft} className="font-semibold text-km-link hover:underline">{t("startOver")}</button>
                </div>
            )}

            <div className="mt-6">
                <JobForm
                    key={formKey}
                    initial={initial}
                    submitLabel={t("publish")}
                    serverField={serverField}
                    onSubmit={submit}
                    onCancel={() => router.push("/recruiter/jobs/list")}
                    onChange={(v) => writeDraft(isBlank(v) ? null : v)}
                />
            </div>
        </div>
    );
}
