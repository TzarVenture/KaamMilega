'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { FileTextIcon, TrashIcon, UploadSimpleIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { uploadFile } from '@/lib/upload';
import FileLink from '@/components/ui/FileLink';
import { Toggle, buttonSecondary } from '@/components/settings/SettingsPrimitives';

interface ResumeStatus {
    resume: { url: string; name: string; uploaded_at: string } | null;
    shared: boolean;
}

const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * The member's own resume on their profile. It stays private unless they let recruiters
 * download it; each download is counted against that recruiter's plan.
 */
export default function ProfileResume() {
    const t = useTranslations('profileResume');
    const locale = useLocale();
    const [status, setStatus] = useState<ResumeStatus | null>(null);
    const [busy, setBusy] = useState(false);
    const input = useRef<HTMLInputElement>(null);

    useEffect(() => {
        api.get<unknown, ResumeStatus>('/user/resume')
            .then(setStatus)
            .catch(() => setStatus({ resume: null, shared: false }));
    }, []);

    const upload = async (file: File | undefined) => {
        if (!file) return;
        if (file.size > MAX_BYTES) {
            notify.error(t('tooBig'));
            return;
        }
        setBusy(true);
        try {
            const { url } = await uploadFile(file, 'resume');
            setStatus(await api.put<unknown, ResumeStatus>('/user/resume', { url }));
            notify.success(t('saved'));
        } catch (err) {
            notify.error(err, t('failed'));
        } finally {
            setBusy(false);
            if (input.current) input.current.value = '';
        }
    };

    const remove = async () => {
        setBusy(true);
        try {
            setStatus(await api.delete<unknown, ResumeStatus>('/user/resume'));
            notify.success(t('removed'));
        } catch (err) {
            notify.error(err, t('failed'));
        } finally {
            setBusy(false);
        }
    };

    const share = async (shared: boolean) => {
        setBusy(true);
        try {
            setStatus(await api.put<unknown, ResumeStatus>('/user/resume/sharing', { shared }));
            notify.success(shared ? t('sharedOn') : t('sharedOff'));
        } catch (err) {
            notify.error(err, t('failed'));
        } finally {
            setBusy(false);
        }
    };

    const resume = status?.resume;

    return (
        <section className="bg-km-surface-card rounded-xl p-6 border border-gray-200 shadow-sm">
            <h2 className="text-xl font-bold text-km-heading">{t('title')}</h2>
            <p className="text-xs text-km-text-secondary mt-0.5">{t('hint')}</p>

            <input ref={input} type="file" accept={ACCEPT} className="hidden" onChange={(e) => upload(e.target.files?.[0])} />

            {!status ? (
                <div className="mt-4 h-16 rounded-xl bg-km-surface animate-pulse" />
            ) : resume ? (
                <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-km-border p-3">
                        <FileTextIcon size={28} className="text-km-link shrink-0" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                            <FileLink href={resume.url} className="block truncate text-sm font-semibold text-km-heading hover:text-km-link">
                                {resume.name}
                            </FileLink>
                            <p className="text-xs text-km-text-secondary">
                                {t('uploaded', { date: new Date(resume.uploaded_at).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) })}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`${buttonSecondary} h-9 px-3 text-xs`}>
                                <UploadSimpleIcon size={14} aria-hidden="true" />{t('replace')}
                            </button>
                            <button type="button" onClick={remove} disabled={busy} className={`${buttonSecondary} h-9 px-3 text-xs`} aria-label={t('remove')}>
                                <TrashIcon size={14} aria-hidden="true" />{t('remove')}
                            </button>
                        </div>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="text-sm font-medium text-km-text-primary">{t('shareLabel')}</p>
                            <p className="text-xs text-km-text-secondary mt-0.5">{t('shareHint')}</p>
                        </div>
                        <Toggle checked={status.shared} onChange={share} label={t('shareLabel')} disabled={busy} />
                    </div>
                </div>
            ) : (
                <button type="button" onClick={() => input.current?.click()} disabled={busy} className={`${buttonSecondary} mt-4`}>
                    <UploadSimpleIcon size={16} aria-hidden="true" />{busy ? t('uploading') : t('upload')}
                </button>
            )}
        </section>
    );
}
