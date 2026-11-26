'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowCounterClockwiseIcon, CircleNotchIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { inr } from '@/lib/money';
import { AdminModal, btn, cx, field } from '@/components/admin/ui';

interface TopupRefund {
    id: string;
    amount: number;
    refunded: number;
    status: 'requested' | 'refunded' | 'rejected';
    reject_reason?: string;
    created_at: string;
    decided_at?: string;
}

interface Info {
    main_balance: number;
    refundable: number;
    not_refundable: number;
    window_days: number;
    latest?: TopupRefund;
}

// A decided request is shown for this long so the member sees what happened
const SHOW_DECIDED_DAYS = 30;

interface Props {
    refreshKey: number;
    onRequested: () => void;
}

/** Lets a member ask for all of their unspent top-up money back to the original payment. */
export default function TopupRefundCard({ refreshKey, onRequested }: Props) {
    const t = useTranslations('topupRefund');
    const locale = useLocale();
    const [info, setInfo] = useState<Info | null>(null);
    const [open, setOpen] = useState(false);
    const [reason, setReason] = useState('');
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        api.get<unknown, Info>('/wallet/topup-refund').then(setInfo).catch(() => setInfo(null));
    }, []);

    useEffect(() => { load(); }, [load, refreshKey]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        try {
            await api.post('/wallet/topup-refund', { reason: reason.trim() });
            notify.success(t('requested'));
            setOpen(false);
            setReason('');
            load();
            onRequested();
        } catch (err) {
            notify.error(err, t('failed'));
        } finally {
            setBusy(false);
        }
    };

    if (!info) return null;
    const latest = info.latest;
    const waiting = latest?.status === 'requested';
    const recentDecision = latest && latest.status !== 'requested' && latest.decided_at
        && Date.now() - new Date(latest.decided_at).getTime() < SHOW_DECIDED_DAYS * 86_400_000;
    if (!waiting && !recentDecision && info.main_balance <= 0) return null;

    const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });

    let status: React.ReactNode = null;
    if (waiting) status = t('waiting', { amount: inr(latest.amount), date: date(latest.created_at) });
    else if (recentDecision && latest.status === 'refunded') status = t('refunded', { amount: inr(latest.refunded), date: date(latest.decided_at!) });
    else if (recentDecision && latest.status === 'rejected') status = t('rejected', { reason: latest.reject_reason || '' });

    return (
        <section className="bg-km-surface-card border border-km-border rounded-2xl px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3 min-w-0">
                <ArrowCounterClockwiseIcon size={22} className="shrink-0 mt-0.5 text-km-link" aria-hidden="true" />
                <div className="min-w-0">
                    <p className="text-sm font-semibold text-km-heading">{t('title')}</p>
                    {status && <p className="text-sm text-km-text-primary mt-0.5">{status}</p>}
                    {!waiting && info.refundable > 0 && (
                        <p className="text-xs text-km-text-secondary mt-0.5">{t('canRefund', { amount: inr(info.refundable) })}</p>
                    )}
                    {!waiting && info.not_refundable > 0 && (
                        <p className="text-xs text-km-text-secondary mt-0.5">{t('tooOld', { amount: inr(info.not_refundable) })}</p>
                    )}
                </div>
            </div>
            {!waiting && info.refundable > 0 && (
                <button type="button" onClick={() => setOpen(true)} className={cx(btn.secondary, 'shrink-0')}>{t('button')}</button>
            )}

            <AdminModal isOpen={open} onClose={() => { if (!busy) setOpen(false); }} title={t('confirmTitle', { amount: inr(info.refundable) })}>
                <form onSubmit={submit} className="space-y-4">
                    <ul className="list-disc pl-5 space-y-1.5 text-sm text-km-text-primary">
                        <li>{t('pointAll', { amount: inr(info.refundable) })}</li>
                        <li>{t('pointSource')}</li>
                        <li>{t('pointNoFee')}</li>
                        <li>{t('pointHeld')}</li>
                        {info.not_refundable > 0 && <li>{t('tooOld', { amount: inr(info.not_refundable) })}</li>}
                    </ul>
                    <label className="block">
                        <span className={field.label}>{t('reasonLabel')}</span>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} rows={2} className={field.input} />
                    </label>
                    <div className="flex gap-2 justify-end">
                        <button type="button" onClick={() => setOpen(false)} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                        <button type="submit" disabled={busy} className={btn.primary}>
                            {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            {t('submit')}
                        </button>
                    </div>
                </form>
            </AdminModal>
        </section>
    );
}
