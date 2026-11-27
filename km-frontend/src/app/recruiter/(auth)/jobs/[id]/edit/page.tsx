"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeftIcon, WarningCircleIcon } from "@phosphor-icons/react";
import api from "@/lib/axios";
import { notify } from "@/lib/notify";
import { btn } from "@/components/admin/ui";
import { SkeletonRows } from "@/components/admin/ui";
import { recruiterApi, type MyJob } from "@/lib/api/recruiter";
import JobForm, { EMPTY_JOB, JOB_TYPES, fieldOfCode, toPayload, type JobFormValues } from "@/components/recruiter/JobForm";

const str = (n?: number) => (n && n > 0 ? String(n) : "");

function fromJob(j: MyJob): JobFormValues {
    return {
        ...EMPTY_JOB,
        title: j.title || "",
        city_id: j.city_id || "",
        city_name: j.city_name || "",
        location: j.location || "",
        job_type: (JOB_TYPES as readonly string[]).includes(j.job_type || "") ? (j.job_type as string) : "Full-time",
        salary_min: str(j.salary_min),
        salary_max: str(j.salary_max),
        experience_min: str(j.experience_min),
        experience_max: str(j.experience_max),
        education: j.education || "",
        gender: j.gender || "",
        description: j.description || "",
        requirements: j.requirements ?? [],
        we_offer: j.we_offer ?? [],
    };
}

export default function EditJobPage() {
    const t = useTranslations("recruiterJobForm");
    const router = useRouter();
    const { id } = useParams<{ id: string }>();
    const [job, setJob] = useState<MyJob | null>(null);
    const [failed, setFailed] = useState(false);
    const [serverField, setServerField] = useState<string | null>(null);
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let alive = true;
        recruiterApi.job(id)
            .then((j) => alive && (setJob(j), setFailed(false)))
            .catch((err) => {
                if (!alive) return;
                setFailed(true);
                notify.error(err, t("loadFailed"));
            });
        return () => {
            alive = false;
        };
    }, [id, attempt, t]);

    const hub = `/recruiter/jobs/${id}`;

    const submit = async (v: JobFormValues) => {
        setServerField(null);
        try {
            await api.patch(`/jobs/${id}`, toPayload(v));
            notify.success(t("saved"));
            router.push(hub);
        } catch (err) {
            setServerField(fieldOfCode((err as { code?: string })?.code));
            notify.error(err, t("saveFailed"));
        }
    };

    return (
        <div className="mx-auto max-w-6xl pb-12">
            <Link href={hub} className="inline-flex items-center gap-1.5 text-sm font-medium text-km-link hover:underline">
                <ArrowLeftIcon size={14} weight="bold" aria-hidden="true" />
                {t("backToJob")}
            </Link>
            <h1 className="mt-2 text-2xl font-bold text-km-heading">{t("editTitle")}</h1>
            <p className="mt-1 text-sm text-km-text-secondary">{t("editText")}</p>

            <div className="mt-6">
                {failed ? (
                    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-[#2A1215] dark:text-red-300">
                        <span className="flex items-center gap-2"><WarningCircleIcon size={18} aria-hidden="true" />{t("loadFailed")}</span>
                        <button type="button" onClick={() => setAttempt((n) => n + 1)} className={btn.secondary}>{t("retry")}</button>
                    </div>
                ) : job ? (
                    <JobForm initial={fromJob(job)} submitLabel={t("saveChanges")} serverField={serverField} onSubmit={submit} onCancel={() => router.push(hub)} />
                ) : (
                    <SkeletonRows rows={6} />
                )}
            </div>
        </div>
    );
}
