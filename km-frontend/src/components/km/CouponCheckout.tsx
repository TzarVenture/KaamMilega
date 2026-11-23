'use client';

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { CircleNotchIcon, TicketIcon, XIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import { errorText } from '@/lib/notify';
import { inr } from '@/lib/money';
import { btn, cx, field } from '@/components/admin/ui';
import { couponsApi, type CouponPurpose, type CouponQuote } from '@/lib/api/coupons';
import type { PaymentMethod } from '@/components/km/PaymentMethodPicker';

export interface CouponState {
    /** The price to show: with the applied code, or the plain price. null until it loads. */
    quote: CouponQuote | null;
    /** The code the server accepted, to send with the purchase ('' for none) */
    code: string;
    applying: boolean;
    error: string;
    apply: (code: string) => Promise<void>;
    remove: () => void;
}

/**
 * Prices a purchase for its checkout and keeps an applied coupon code. The price is worked out
 * again by the server when the customer pays, so a code that stops working in between is caught.
 */
export function useCouponQuote(purpose: CouponPurpose, open: boolean, targetId?: string): CouponState {
    const t = useTranslations('coupon');
    const [base, setBase] = useState<CouponQuote | null>(null);
    const [applied, setApplied] = useState<CouponQuote | null>(null);
    const [applying, setApplying] = useState(false);
    const [error, setError] = useState('');
    // Answers for an older checkout (closed, or another plan) are dropped
    const run = useRef(0);

    useEffect(() => {
        const mine = ++run.current;
        setBase(null);
        setApplied(null);
        setError('');
        setApplying(false);
        if (!open) return;
        couponsApi.quote(purpose, '', targetId)
            .then((q) => mine === run.current && setBase(q))
            .catch(() => undefined); // The screen falls back to the listed price
    }, [purpose, targetId, open]);

    const apply = useCallback(async (code: string) => {
        const trimmed = code.trim();
        if (!trimmed) return;
        const mine = run.current;
        setApplying(true);
        setError('');
        try {
            const q = await couponsApi.quote(purpose, trimmed, targetId);
            if (mine === run.current) setApplied(q);
        } catch (err) {
            if (mine === run.current) setError(errorText(err, t('failed')));
        } finally {
            if (mine === run.current) setApplying(false);
        }
    }, [purpose, targetId, t]);

    const remove = useCallback(() => {
        setApplied(null);
        setError('');
    }, []);

    return { quote: applied ?? base, code: applied?.code ?? '', applying, error, apply, remove };
}

/** The price, with the list price struck through when a discount applies */
export function CouponPrice({ quote, fallback, className }: { quote: CouponQuote | null; fallback: number; className?: string }) {
    const t = useTranslations('coupon');
    const price = quote?.price ?? fallback;
    const discounted = !!quote && quote.discount > 0;
    return (
        <p className={cx('flex flex-wrap items-baseline gap-x-2', className)}>
            <span className="text-3xl font-bold text-km-heading font-inter tabular-nums">{inr(price)}</span>
            {discounted && (
                <span className="text-base text-km-text-secondary font-inter tabular-nums">
                    <span className="sr-only">{t('listPrice', { amount: inr(quote.list_price) })}</span>
                    <s aria-hidden="true">{inr(quote.list_price)}</s>
                </span>
            )}
        </p>
    );
}

/** "Have a coupon code?" that opens into a field, and the applied code with a way to remove it */
export function CouponField({ state, disabled }: { state: CouponState; disabled?: boolean }) {
    const t = useTranslations('coupon');
    const inputId = useId();
    const errorId = useId();
    const [open, setOpen] = useState(false);
    const [value, setValue] = useState('');
    const { quote, code, applying, error, apply, remove } = state;

    if (code && quote) {
        const saved = quote.kind === 'discount' ? t('appliedDiscount', { code, amount: inr(quote.discount) }) : t('appliedCashback', { code });
        return (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-km-border bg-km-surface p-3">
                <p className="flex items-start gap-2 text-sm text-km-text-primary">
                    <TicketIcon size={18} className="mt-0.5 shrink-0 text-km-link" aria-hidden="true" />
                    <span>
                        <span className="font-semibold">{saved}</span>
                        {quote.description && <span className="block text-km-text-secondary">{quote.description}</span>}
                    </span>
                </p>
                <button
                    type="button"
                    onClick={() => { remove(); setValue(''); }}
                    disabled={disabled}
                    className="inline-flex shrink-0 items-center gap-1 text-sm font-medium text-km-link hover:underline disabled:opacity-60 cursor-pointer"
                >
                    <XIcon size={14} aria-hidden="true" />
                    {t('remove')}
                </button>
            </div>
        );
    }

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-km-link hover:underline disabled:opacity-60 cursor-pointer"
            >
                <TicketIcon size={16} aria-hidden="true" />
                {t('have')}
            </button>
        );
    }

    return (
        <form
            onSubmit={(e) => { e.preventDefault(); void apply(value); }}
            noValidate
        >
            <label htmlFor={inputId} className={field.label}>{t('label')}</label>
            <div className="flex gap-2">
                <input
                    id={inputId}
                    value={value}
                    onChange={(e) => setValue(e.target.value.toUpperCase())}
                    placeholder={t('placeholder')}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={24}
                    autoFocus
                    disabled={disabled || applying}
                    aria-invalid={!!error}
                    aria-describedby={error ? errorId : undefined}
                    className={cx(field.input, 'flex-1 min-w-0 font-inter tracking-wide')}
                />
                <button type="submit" disabled={disabled || applying || !value.trim()} className={btn.secondary}>
                    {applying && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                    {applying ? t('applying') : t('apply')}
                </button>
            </div>
            {error && <p id={errorId} role="alert" className="mt-1.5 text-sm text-red-700 dark:text-red-400">{error}</p>}
        </form>
    );
}

/** What the customer gets back, for the payment method they picked */
export function CashbackNote({ quote, method }: { quote: CouponQuote | null; method: PaymentMethod }) {
    const t = useTranslations('coupon');
    if (!quote || quote.kind !== 'cashback' || quote.free) return null;
    const amount = method === 'wallet' ? quote.wallet.cashback : quote.online_cashback;
    return (
        <p className="text-sm text-km-text-secondary">
            {amount > 0 ? t('cashbackNote', { amount: inr(amount) }) : t('noCashbackOnBonus')}
            {amount > 0 && method === 'wallet' && quote.wallet.from_bonus > 0 && <> {t('cashbackRealMoney')}</>}
        </p>
    );
}
