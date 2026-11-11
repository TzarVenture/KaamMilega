'use client';

import React, { useEffect, useState } from 'react';
import { CheckIcon, CircleNotchIcon } from '@phosphor-icons/react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { inr } from '@/lib/money';
import { getCurrentUser } from '@/lib/auth';
import { CheckoutOrder, useCheckout } from '@/lib/razorpay';
import PaymentMethodPicker, { PaymentMethod } from '@/components/km/PaymentMethodPicker';
import { AdminModal, btn } from '@/components/admin/ui';

export const PASS_PRICE = 99;

export interface PassStatus {
    has_active_pass: boolean;
    quota_remaining: number;
    quota_total: number;
    pass_expires_at?: string;
}

/** Loads the signed-in user's InstantPass status */
export const fetchPassStatus = () => api.get<unknown, PassStatus>('/instant-work/candidate/status');

export const passDate = (iso: string | undefined, locale: string) =>
    iso ? new Date(iso).toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

interface InstantPassModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newQuota: number) => void;
}

export default function InstantPassModal({ isOpen, onClose, onSuccess }: InstantPassModalProps) {
    const t = useTranslations('instantPass');
    const locale = useLocale();
    const pay = useCheckout();
    const [busy, setBusy] = useState(false);
    const [balance, setBalance] = useState<number | null>(null);
    const [status, setStatus] = useState<PassStatus | null>(null);
    const [checking, setChecking] = useState(true);
    const [method, setMethod] = useState<PaymentMethod>('razorpay');

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setStatus(null);
        setBalance(null);
        setChecking(true);
        fetchPassStatus()
            .then((s) => !cancelled && setStatus(s))
            .catch(() => undefined)
            .finally(() => !cancelled && setChecking(false));
        api.get<unknown, { main_balance?: number }>('/wallet/balance')
            .then((w) => {
                if (cancelled) return;
                const main = w?.main_balance ?? 0;
                setBalance(main);
                setMethod(main >= PASS_PRICE ? 'wallet' : 'razorpay');
            })
            .catch(() => !cancelled && setMethod('razorpay'));
        return () => { cancelled = true; };
    }, [isOpen]);

    const hasCredits = !!status?.has_active_pass && status.quota_remaining > 0;
    const walletShort = method === 'wallet' && (balance ?? 0) < PASS_PRICE;

    const done = (quota: number | undefined) => {
        notify.success(t('activated'));
        onSuccess(quota ?? 10);
        onClose();
    };

    const buy = async () => {
        const user = getCurrentUser();
        if (!user) {
            notify.info(t('loginRequired'));
            window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
            return;
        }
        setBusy(true);
        try {
            if (method === 'wallet') {
                const res = await api.post<unknown, { pass?: { quota_remaining?: number } }>('/instant-work/pass/pay-wallet');
                done(res?.pass?.quota_remaining);
                return;
            }
            const order = await api.post<unknown, CheckoutOrder>('/instant-work/pass/order');
            const outcome = await pay({
                order,
                description: t('title'),
                prefill: { name: user.name || '', contact: user.mobile || '', email: user.email || '' },
                verify: (signed) => api.post<unknown, { quota_remaining?: number }>('/instant-work/pass/verify', signed),
            });
            if (outcome.status === 'paid') done(outcome.result?.quota_remaining);
            else if (outcome.status !== 'cancelled') onClose();
        } catch (err) {
            notify.error(err, t('failed'));
        } finally {
            setBusy(false);
        }
    };

    const benefits = [t('benefitGigs'), t('benefitChats'), t('benefitExpert')];

    return (
        <AdminModal isOpen={isOpen} onClose={() => !busy && onClose()} title={t('title')}>
            {hasCredits ? (
                <div className="space-y-4">
                    <p className="text-base font-semibold text-km-heading">{t('haveOne')}</p>
                    <p className="text-sm text-km-text-secondary">
                        {t('creditsLeft', { count: status!.quota_remaining, total: status!.quota_total })}
                        {' · '}
                        {t('validUntil', { date: passDate(status!.pass_expires_at, locale) })}
                    </p>
                    <div className="flex justify-end pt-2">
                        <button type="button" onClick={onClose} className={btn.secondary}>{t('close')}</button>
                    </div>
                </div>
            ) : (
                <div className="space-y-5">
                    <div>
                        <p className="text-3xl font-bold text-km-heading">{inr(PASS_PRICE)}</p>
                        <p className="mt-1 text-sm text-km-text-secondary">{t('summary')}</p>
                    </div>

                    <ul className="space-y-2">
                        {benefits.map((text) => (
                            <li key={text} className="flex items-start gap-2 text-sm text-km-text-primary">
                                <CheckIcon weight="bold" size={16} className="mt-0.5 shrink-0 text-km-instant" aria-hidden="true" />
                                {text}
                            </li>
                        ))}
                    </ul>
                    <p className="text-sm text-km-text-secondary">{t('validity')}</p>

                    <PaymentMethodPicker value={method} onChange={setMethod} balance={balance} price={PASS_PRICE} disabled={busy} />

                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                        <button type="button" onClick={buy} disabled={busy || checking || walletShort} className={btn.primary}>
                            {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            {t('pay', { amount: inr(PASS_PRICE) })}
                        </button>
                    </div>
                </div>
            )}
        </AdminModal>
    );
}
