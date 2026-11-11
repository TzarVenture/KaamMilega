'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CircleNotchIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { inr, isWholePaise } from '@/lib/money';
import { AdminModal, btn, field } from '@/components/admin/ui';
import type { WalletSummary } from '@/app/(common)/wallet/page';

const MIN_WITHDRAWAL = 100;
const MAX_DAILY_WITHDRAWAL = 25000;

interface PayoutAccount {
    eligible: boolean;
    method?: 'bank' | 'upi';
    account_holder?: string;
    account_last4?: string;
    ifsc?: string;
    upi_id?: string;
}

interface Props {
    isOpen: boolean;
    available: number;
    onClose: () => void;
    onRequested: (wallet: WalletSummary) => void;
}

export default function WithdrawModal({ isOpen, available, onClose, onRequested }: Props) {
    const t = useTranslations('walletPage');
    const [account, setAccount] = useState<PayoutAccount | null>(null);
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        setAccount(null);
        setAmount('');
        api.get<unknown, PayoutAccount>('/wallet/payout-account')
            .then(setAccount)
            .catch((err) => { notify.error(err, t('loadFailed')); onClose(); });
    }, [isOpen, onClose, t]);

    const value = Number(amount);
    const error = !amount || !Number.isFinite(value) || !isWholePaise(value)
        ? t('amountInvalid')
        : value < MIN_WITHDRAWAL || value > MAX_DAILY_WITHDRAWAL ? t('withdrawLimits')
        : value > available ? t('withdrawTooMuch', { amount: inr(available) }) : '';

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (error || busy) return;
        setBusy(true);
        try {
            const res = await api.post<unknown, { wallet: WalletSummary }>('/wallet/withdraw', { amount: value });
            notify.success(t('withdrawRequested'));
            onRequested(res.wallet);
            onClose();
        } catch (err) {
            notify.error(err, t('withdrawFailed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AdminModal isOpen={isOpen} onClose={() => !busy && onClose()} title={t('withdrawTitle')}>
            {!account ? (
                <div className="flex justify-center py-8">
                    <CircleNotchIcon size={24} className="animate-spin text-km-text-muted" aria-label={t('loading')} />
                </div>
            ) : !account.eligible ? (
                <div className="space-y-4">
                    <div>
                        <p className="text-sm font-semibold text-km-heading">{t('kycTitle')}</p>
                        <p className="mt-1 text-sm text-km-text-secondary">{t('kycHint')}</p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <button type="button" onClick={onClose} className={btn.secondary}>{t('cancel')}</button>
                        <Link href="/expert/apply" className={btn.primary}>{t('kycAction')}</Link>
                    </div>
                </div>
            ) : (
                <form onSubmit={submit} className="space-y-4">
                    <dl className="rounded-xl border border-km-border-subtle divide-y divide-km-border-subtle text-sm">
                        <div className="flex justify-between gap-4 px-4 py-2.5">
                            <dt className="text-km-text-secondary">{t('available')}</dt>
                            <dd className="font-semibold text-km-heading font-inter tabular-nums">{inr(available)}</dd>
                        </div>
                        <div className="flex justify-between gap-4 px-4 py-2.5">
                            <dt className="text-km-text-secondary shrink-0">{t('sendTo')}</dt>
                            <dd className="text-right text-km-text-primary">
                                {account.method === 'upi' ? account.upi_id : t('bankEnding', { last4: account.account_last4 ?? '' })}
                                <span className="block text-xs text-km-text-secondary">{account.account_holder}</span>
                            </dd>
                        </div>
                    </dl>

                    <label className="block">
                        <span className={field.label}>{t('amount')}</span>
                        <input type="number" inputMode="decimal" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={field.input} />
                        <span className={error && amount ? field.error : field.hint}>{error && amount ? error : t('withdrawLimits')}</span>
                    </label>

                    <p className="text-sm text-km-text-secondary">{t('withdrawNote')}</p>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                        <button type="submit" disabled={busy || !!error} className={btn.primary}>
                            {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            {t('withdraw')}
                        </button>
                    </div>
                </form>
            )}
        </AdminModal>
    );
}
