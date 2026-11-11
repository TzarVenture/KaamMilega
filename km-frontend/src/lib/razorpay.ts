'use client';

import { useCallback } from 'react';
import { useTranslations } from 'next-intl';
import api from './axios';
import { notify } from './notify';

/** What the backend returns when it opens a payment. The amount is fixed on the server. */
export interface CheckoutOrder {
    order_id: string;
    key_id: string;
    currency?: string;
}

export interface SignedPayment {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
}

export type CheckoutOutcome<T> =
    | { status: 'paid'; result?: T } // result is missing when the confirmation came from the status check
    | { status: 'cancelled' }
    | { status: 'pending' }
    | { status: 'refunding' };

interface PayOptions<T> {
    order: CheckoutOrder;
    description: string;
    prefill?: { name?: string; email?: string; contact?: string };
    verify: (signed: SignedPayment) => Promise<T>;
}

type RazorpayInstance = { open: () => void; on: (event: string, handler: (response: { error?: { description?: string } }) => void) => void };
type RazorpayConstructor = new (options: Record<string, unknown>) => RazorpayInstance;

const SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
const STATUS_CHECKS = 6;
const STATUS_CHECK_GAP_MS = 2500;

function razorpayConstructor(): RazorpayConstructor | undefined {
    return (window as unknown as { Razorpay?: RazorpayConstructor }).Razorpay;
}

function loadScript(): Promise<boolean> {
    return new Promise((resolve) => {
        if (razorpayConstructor()) return resolve(true);
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        script.onload = () => resolve(true);
        script.onerror = () => resolve(false);
        document.body.appendChild(script);
    });
}

/**
 * Asks the server where a payment stands. Used when the confirmation call fails: the money may
 * have arrived anyway, through the Razorpay webhook.
 */
async function settledOutcome<T>(orderId: string): Promise<CheckoutOutcome<T>> {
    for (let attempt = 0; attempt < STATUS_CHECKS; attempt++) {
        try {
            const order = await api.get<unknown, { status: string }>(`/payments/orders/${orderId}`);
            if (order.status === 'paid') return { status: 'paid' };
            if (order.status === 'refund_due' || order.status === 'refunded') return { status: 'refunding' };
        } catch {
            // Keep checking: the connection may be what failed
        }
        await new Promise((resolve) => setTimeout(resolve, STATUS_CHECK_GAP_MS));
    }
    return { status: 'pending' };
}

function runCheckout<T>({ order, description, prefill, verify }: PayOptions<T>, onFailure: (message: string) => void): Promise<CheckoutOutcome<T>> {
    return new Promise((resolve, reject) => {
        let failure = '';
        const Razorpay = razorpayConstructor() as RazorpayConstructor;
        const checkout = new Razorpay({
            key: order.key_id,
            currency: order.currency || 'INR',
            order_id: order.order_id,
            name: 'KaamMilega',
            description,
            prefill,
            theme: { color: '#071A4D' },
            modal: {
                ondismiss: () => {
                    if (failure) onFailure(failure);
                    resolve({ status: 'cancelled' });
                },
            },
            handler: async (signed: SignedPayment) => {
                try {
                    resolve({ status: 'paid', result: await verify(signed) });
                } catch (err) {
                    const code = (err as { code?: string }).code;
                    if (code === 'PAYMENT_REFUNDING') return resolve({ status: 'refunding' });
                    if (code === 'PAYMENT_SIGNATURE_INVALID' || code === 'PAYMENT_ORDER_NOT_FOUND') return reject(err);
                    resolve(await settledOutcome<T>(order.order_id));
                }
            },
        });
        // Razorpay keeps its window open so the customer can try another method
        checkout.on('payment.failed', (response) => { failure = response.error?.description || ''; });
        checkout.open();
    });
}

/** The one way to take an online payment. Shows the message for every result except success. */
export function useCheckout() {
    const t = useTranslations('checkout');

    return useCallback(async <T,>(options: PayOptions<T>): Promise<CheckoutOutcome<T>> => {
        if (!(await loadScript())) {
            notify.error(t('unavailable'));
            return { status: 'cancelled' };
        }
        try {
            const outcome = await runCheckout(options, (message) => notify.error(message));
            if (outcome.status === 'refunding') notify.warning(t('refunding'));
            if (outcome.status === 'pending') notify.info(t('pending'));
            return outcome;
        } catch (err) {
            notify.error(err, t('failed'));
            return { status: 'cancelled' };
        }
    }, [t]);
}
