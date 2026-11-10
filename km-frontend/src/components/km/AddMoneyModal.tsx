'use client';

import React, { useState } from 'react';
import { CircleNotchIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { inr, isWholePaise } from '@/lib/money';
import { CheckoutOrder, useCheckout } from '@/lib/razorpay';
import { AdminModal, btn, cx, field } from '@/components/admin/ui';
import type { WalletSummary } from '@/app/(common)/wallet/page';

const MIN_TOPUP = 100;
const MAX_TOPUP = 50000;
const PRESETS = [500, 1000, 2000, 5000];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onAdded: (wallet?: WalletSummary) => void;
}

export default function AddMoneyModal({ isOpen, onClose, onAdded }: Props) {
    const t = useTranslations('walletPage');
    const pay = useCheckout();
    const [amount, setAmount] = useState('500');
    const [busy, setBusy] = useState(false);

    const value = Number(amount);
    const error = !amount || !Number.isFinite(value) || !isWholePaise(value)
        ? t('amountInvalid')
        : value < MIN_TOPUP || value > MAX_TOPUP ? t('topupLimits') : '';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (error || busy) return;
        setBusy(true);
        try {
            const order = await api.post<unknown, CheckoutOrder>('/wallet/topup/create-order', { amount: value });
            const outcome = await pay({
                order,
                description: t('addMoney'),
                verify: (signed) => api.post<unknown, { wallet: WalletSummary }>('/wallet/topup/verify', signed),
            });
            if (outcome.status === 'paid') {
                notify.success(t('added', { amount: inr(value) }));
                onAdded(outcome.result?.wallet);
            }
            if (outcome.status !== 'cancelled') onClose();
        } catch (err) {
            notify.error(err, t('addFailed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AdminModal isOpen={isOpen} onClose={() => !busy && onClose()} title={t('addMoney')}>
            <form onSubmit={submit} className="space-y-4">
                <label className="block">
                    <span className={field.label}>{t('amount')}</span>
                    <input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={field.input} />
                    <span className={error && amount ? field.error : field.hint}>{error && amount ? error : t('topupLimits')}</span>
                </label>

                <div className="flex flex-wrap gap-2">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset}
                            type="button"
                            onClick={() => setAmount(String(preset))}
                            className={cx(btn.secondary, 'h-9 px-3', Number(amount) === preset && 'border-km-blue text-km-link')}
                        >
                            {inr(preset)}
                        </button>
                    ))}
                </div>

                <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={onClose} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                    <button type="submit" disabled={busy || !!error} className={btn.primary}>
                        {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                        {t('pay', { amount: inr(error ? 0 : value) })}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}
