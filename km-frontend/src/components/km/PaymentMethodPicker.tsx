'use client';

import React from 'react';
import Link from 'next/link';
import type { Icon } from '@phosphor-icons/react';
import { CreditCardIcon, WalletIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { inr } from '@/lib/money';
import { cx } from '@/components/admin/ui';

export type PaymentMethod = 'wallet' | 'razorpay';

interface PaymentMethodPickerProps {
    value: PaymentMethod;
    onChange: (method: PaymentMethod) => void;
    /** Spending balance, or null while it loads */
    balance: number | null;
    price: number;
    disabled?: boolean;
    /** Off when the screen explains a low balance elsewhere */
    showShortfall?: boolean;
}

export default function PaymentMethodPicker({ value, onChange, balance, price, disabled, showShortfall = true }: PaymentMethodPickerProps) {
    const t = useTranslations('checkout');
    const shortBy = balance === null ? 0 : price - balance;

    const options: { method: PaymentMethod; icon: Icon; title: string; hint: string }[] = [
        { method: 'wallet', icon: WalletIcon, title: t('wallet'), hint: balance === null ? t('balanceLoading') : t('balance', { amount: inr(balance) }) },
        { method: 'razorpay', icon: CreditCardIcon, title: t('online'), hint: t('onlineHint') },
    ];

    return (
        <div>
            <p className="block text-sm font-medium text-km-heading mb-1.5">{t('method')}</p>
            <div role="radiogroup" aria-label={t('method')} className="space-y-2">
                {options.map(({ method, icon: IconCmp, title, hint }) => {
                    const selected = value === method;
                    return (
                        <button
                            key={method}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            disabled={disabled}
                            onClick={() => onChange(method)}
                            className={cx(
                                'flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer disabled:cursor-default',
                                selected ? 'border-km-primary ring-1 ring-km-primary bg-km-surface dark:border-km-link dark:ring-km-link' : 'border-km-border bg-km-surface-card hover:bg-km-surface',
                            )}
                        >
                            <IconCmp size={22} className="shrink-0 text-km-heading" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold text-km-heading">{title}</span>
                                <span className="block text-sm text-km-text-secondary font-inter">{hint}</span>
                            </span>
                            <span className={cx('flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border', selected ? 'border-km-primary bg-km-primary dark:border-km-link' : 'border-km-border')} aria-hidden="true">
                                {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                            </span>
                        </button>
                    );
                })}
            </div>

            {showShortfall && value === 'wallet' && shortBy > 0 && (
                <p className="mt-2 flex items-center justify-between gap-3 text-sm text-km-text-secondary">
                    <span>{t('short', { amount: inr(shortBy) })}</span>
                    <Link href="/wallet" target="_blank" className="font-medium text-km-link hover:underline">{t('addMoney')}</Link>
                </p>
            )}
        </div>
    );
}
