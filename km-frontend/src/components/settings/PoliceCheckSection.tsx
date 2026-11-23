'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useFormatter, useTranslations } from 'next-intl';
import { FileArrowUpIcon, ShieldCheckIcon, SpinnerGapIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { uploadFile, UPLOAD_LIMITS } from '@/lib/upload';
import { Badge, buttonPrimary, buttonSecondary, inputClass } from '@/components/settings/SettingsPrimitives';

interface PoliceVerification {
    status: 'pending' | 'approved' | 'rejected';
    file_id: string;
    issued_on: string;
    expires_at: string;
    submitted_at: string;
    reviewed_at?: string;
    rejection_reason?: string;
}

interface MyStatus {
    verification: PoliceVerification | null;
    badge: boolean;
    valid_months: number;
    can_submit: boolean;
}

const DAY = 24 * 60 * 60 * 1000;

/** YYYY-MM-DD in India, for the date picker's limits */
function istDate(d: Date): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
}

/**
 * The member's police verification certificate (Settings, Verification tab). An approved
 * certificate gives the Police checked badge until 12 months after its issue date.
 */
export default function PoliceCheckSection() {
    const t = useTranslations('policeCheck');
    const format = useFormatter();
    const fileInput = useRef<HTMLInputElement>(null);

    const [status, setStatus] = useState<MyStatus | null>(null);
    const [loadFailed, setLoadFailed] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [issuedOn, setIssuedOn] = useState('');
    const [sending, setSending] = useState(false);

    useEffect(() => {
        api.get('/police-verification')
            .then((res) => setStatus(res as unknown as MyStatus))
            .catch(() => setLoadFailed(true));
    }, []);

    const date = (iso: string) =>
        format.dateTime(new Date(iso), { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' });

    const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
        const picked = e.target.files?.[0];
        e.target.value = '';
        if (!picked) return;
        if (picked.size > UPLOAD_LIMITS.police_certificate) {
            notify.error(t('fileTooBig'));
            return;
        }
        setFile(picked);
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!file || !issuedOn) return;
        setSending(true);
        try {
            const uploaded = await uploadFile(file, 'police_certificate', { moduleName: 'police_verification' });
            const res = (await api.post('/police-verification', { file_id: uploaded.id, issued_on: issuedOn })) as unknown as MyStatus;
            setStatus(res);
            setFile(null);
            setIssuedOn('');
            notify.success(t('sent'));
        } catch (err) {
            notify.error(err, t('sendFailed'));
        } finally {
            setSending(false);
        }
    };

    const v = status?.verification ?? null;
    const now = Date.now();
    const expired = v?.status === 'approved' && !status?.badge && new Date(v.expires_at).getTime() <= now;

    let summary: React.ReactNode = null;
    if (v?.status === 'pending') {
        summary = (
            <StatusRow badge={<Badge tone="warn">{t('pending')}</Badge>}>
                {t('pendingNote', { date: date(v.submitted_at) })}
            </StatusRow>
        );
    } else if (v?.status === 'approved' && status?.badge) {
        summary = (
            <StatusRow badge={<Badge tone="ok"><ShieldCheckIcon size={12} weight="fill" aria-hidden="true" />{t('approved')}</Badge>}>
                {t('approvedNote', { date: date(v.expires_at) })}
                {status.can_submit && <span className="block mt-1">{t('renewNow')}</span>}
            </StatusRow>
        );
    } else if (expired && v) {
        summary = (
            <StatusRow badge={<Badge tone="neutral">{t('expired')}</Badge>}>
                {t('expiredNote', { date: date(v.expires_at) })}
            </StatusRow>
        );
    } else if (v?.status === 'rejected') {
        summary = (
            <StatusRow badge={<Badge tone="warn">{t('rejected')}</Badge>}>
                {v.rejection_reason ? t('rejectedNote', { reason: v.rejection_reason }) : t('rejectedNoReason')}
            </StatusRow>
        );
    }

    const today = new Date();
    const oldest = new Date(today.getTime() - 365 * DAY + DAY);

    return (
        <section className="bg-km-surface-card rounded-2xl border border-km-border p-5 sm:p-6">
            <h2 className="text-base font-semibold text-km-heading">{t('title')}</h2>
            <p className="mt-1 text-sm text-km-text-secondary leading-relaxed">
                {t('description', { months: status?.valid_months ?? 12 })}
            </p>

            {!status && !loadFailed && (
                <p className="mt-4 inline-flex items-center gap-2 text-sm text-km-text-secondary">
                    <SpinnerGapIcon size={16} className="animate-spin" aria-hidden="true" />
                    {t('loading')}
                </p>
            )}
            {loadFailed && <p className="mt-4 text-sm text-red-700 dark:text-red-400">{t('loadFailed')}</p>}

            {summary && <div className="mt-2 divide-y divide-km-border-subtle">{summary}</div>}

            {status?.can_submit && (
                <form onSubmit={submit} className="mt-4 space-y-4 border-t border-km-border-subtle pt-4">
                    {v && <p className="text-sm font-semibold text-km-text-primary">{v.status === 'pending' ? t('replaceTitle') : t('newTitle')}</p>}

                    <div>
                        <span className="block text-sm font-medium text-km-text-primary">{t('fileLabel')}</span>
                        <span className="block mt-0.5 text-xs text-km-text-secondary">{t('fileHint')}</span>
                        <input ref={fileInput} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={pick} className="hidden" />
                        <button type="button" onClick={() => fileInput.current?.click()} className={`${buttonSecondary} mt-2 max-w-full`}>
                            <FileArrowUpIcon size={18} aria-hidden="true" />
                            <span className="truncate">{file ? file.name : t('chooseFile')}</span>
                        </button>
                    </div>

                    <label className="block">
                        <span className="block text-sm font-medium text-km-text-primary">{t('issuedLabel')}</span>
                        <span className="block mt-0.5 text-xs text-km-text-secondary">{t('issuedHint')}</span>
                        <input
                            type="date"
                            required
                            value={issuedOn}
                            min={istDate(oldest)}
                            max={istDate(today)}
                            onChange={(e) => setIssuedOn(e.target.value)}
                            className={`${inputClass} mt-2 sm:w-56`}
                        />
                    </label>

                    <button type="submit" disabled={!file || !issuedOn || sending} className={buttonPrimary}>
                        {sending && <SpinnerGapIcon size={16} className="animate-spin" aria-hidden="true" />}
                        {sending ? t('sending') : t('submit')}
                    </button>
                </form>
            )}
        </section>
    );
}

function StatusRow({ badge, children }: { badge: React.ReactNode; children: React.ReactNode }) {
    return (
        <div className="py-4">
            {badge}
            <p className="mt-2 text-sm text-km-text-secondary leading-relaxed">{children}</p>
        </div>
    );
}
