'use client';

import React, { useState } from 'react';
import { CircleNotchIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { dateTime } from '@/lib/money';
import { AdminModal, btn, field } from '@/components/admin/ui';

interface Props {
    bookingId: string;
    status: string;
    releaseAfter?: string;
    scheduledAt: string;
    onChanged: () => void;
}

/** The mentee's say on a finished session: confirm it, which pays the mentor, or report a problem */
export default function SessionConfirmation({ bookingId, status, releaseAfter, scheduledAt, onChanged }: Props) {
    const t = useTranslations('sessionActions');
    const locale = useLocale();
    const [reporting, setReporting] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const awaiting = status === 'awaiting_confirmation';
    const canReport = awaiting || (status === 'confirmed' && new Date(scheduledAt).getTime() <= Date.now());

    const confirm = async () => {
        setBusy(true);
        try {
            await api.post(`/mentorships/bookings/${bookingId}/confirm`);
            notify.success(t('confirmed'));
            onChanged();
        } catch (err) {
            notify.error(err, t('failed'));
        } finally {
            setBusy(false);
        }
    };

    const report = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) return;
        setBusy(true);
        try {
            await api.post(`/mentorships/bookings/${bookingId}/report`, { reason: reason.trim() });
            notify.success(t('reported'));
            setReporting(false);
            onChanged();
        } catch (err) {
            notify.error(err, t('failed'));
        } finally {
            setBusy(false);
        }
    };

    if (status === 'reported') return <p className="mb-4 text-sm text-km-text-secondary">{t('reportedNote')}</p>;
    if (!canReport) return null;

    return (
        <div className="mb-4">
            {awaiting && <p className="text-sm text-km-text-secondary">{t('awaitingNote', { time: dateTime(releaseAfter, locale) })}</p>}
            <div className="mt-2 flex flex-wrap gap-2">
                {awaiting && (
                    <button type="button" onClick={confirm} disabled={busy} className={btn.primary}>{t('confirm')}</button>
                )}
                <button type="button" onClick={() => setReporting(true)} disabled={busy} className={btn.secondary}>{t('report')}</button>
            </div>

            <AdminModal isOpen={reporting} onClose={() => !busy && setReporting(false)} title={t('report')}>
                <form onSubmit={report} className="space-y-4">
                    <label className="block">
                        <span className={field.label}>{t('reportLabel')}</span>
                        <textarea rows={4} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} className={field.textarea} required />
                        <span className={field.hint}>{t('reportHint')}</span>
                    </label>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={() => setReporting(false)} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                        <button type="submit" disabled={busy || !reason.trim()} className={btn.primary}>
                            {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            {t('reportSubmit')}
                        </button>
                    </div>
                </form>
            </AdminModal>
        </div>
    );
}
