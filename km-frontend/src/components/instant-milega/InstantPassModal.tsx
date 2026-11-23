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
import { CashbackNote, CouponField, CouponPrice, useCouponQuote } from '@/components/km/CouponCheckout';
import { AdminModal, btn } from '@/components/admin/ui';
import type { CouponReceipt } from '@/lib/api/coupons';

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
    const [bonus, setBonus] = useState(0);
    const [status, setStatus] = useState<PassStatus | null>(null);
    const [checking, setChecking] = useState(true);
    const [method, setMethod] = useState<PaymentMethod>('razorpay');

    useEffect(() => {
        if (!isOpen) return;
        let cancelled = false;
        setStatus(null);
        setBalance(null);
        setBonus(0);
        setChecking(true);
        fetchPassStatus()
            .then((s) => !cancelled && setStatus(s))
            .catch(() => undefined)
            .finally(() => !cancelled && setChecking(false));
        api.get<unknown, { main_balance?: number; bonus_balance?: number }>('/wallet/balance')
            .then((w) => {
                if (cancelled) return;
                const main = w?.main_balance ?? 0;
                const credit = w?.bonus_balance ?? 0;
                setBalance(main);
                setBonus(credit);
                setMethod(main + credit >= PASS_PRICE ? 'wallet' : 'razorpay');
            })
            .catch(() => !cancelled && setMethod('razorpay'));
        return () => { cancelled = true; };
    }, [isOpen]);

    const coupon = useCouponQuote('instant_pass', isOpen);
    const price = coupon.quote?.price ?? PASS_PRICE;
    const free = !!coupon.quote?.free;
    // A free pass (a 100% coupon) goes through the wallet with nothing charged
    const payWith: PaymentMethod = free ? 'wallet' : method;

    const hasCredits = !!status?.has_active_pass && status.quota_remaining > 0;
    const walletShort = payWith === 'wallet' && !free && (balance ?? 0) + bonus < price;

    const done = (quota: number | undefined, receipt?: CouponReceipt) => {
        notify.success(t('activated'), receipt && receipt.cashback > 0 ? t('cashbackAdded', { amount: inr(receipt.cashback) }) : undefined);
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
            const body = { coupon_code: coupon.code };
            if (payWith === 'wallet') {
                const res = await api.post<unknown, { pass?: { quota_remaining?: number }; receipt?: CouponReceipt }>('/instant-work/pass/pay-wallet', body);
                done(res?.pass?.quota_remaining, res?.receipt);
                return;
            }
            const order = await api.post<unknown, CheckoutOrder>('/instant-work/pass/order', body);
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
                        <CouponPrice quote={coupon.quote} fallback={PASS_PRICE} />
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

                    <CouponField state={coupon} disabled={busy} />

                    {free ? (
                        <p className="text-sm font-medium text-km-text-primary">{t('freeWithCode')}</p>
                    ) : (
                        <PaymentMethodPicker value={method} onChange={setMethod} balance={balance} bonus={bonus} price={price} disabled={busy} />
                    )}
                    <CashbackNote quote={coupon.quote} method={payWith} />

                    <div className="flex justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                        <button type="button" onClick={buy} disabled={busy || checking || walletShort || coupon.applying || (payWith === 'wallet' && balance === null)} className={btn.primary}>
                            {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            {free ? t('getFree') : t('pay', { amount: inr(price) })}
                        </button>
                    </div>
                </div>
            )}
        </AdminModal>
    );
}
