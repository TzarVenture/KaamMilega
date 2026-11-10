'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, CheckIcon, CreditCardIcon, ShieldCheckIcon, WalletIcon, XIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";
import api from '@/lib/axios';
import { getCurrentUser } from '@/lib/auth';
import { CheckoutOrder, useCheckout } from '@/lib/razorpay';
import PaymentMethodPicker from '@/components/km/PaymentMethodPicker';

interface InstantPassModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (newQuota: number) => void;
}

export default function InstantPassModal({
    isOpen,
    onClose,
    onSuccess,
}: InstantPassModalProps) {
    const pay = useCheckout();
    const [loading, setLoading] = useState(false);
    const [walletLoading, setWalletLoading] = useState(false);
    const [walletBalance, setWalletBalance] = useState<number | null>(null);
    const [selectedMethod, setSelectedMethod] = useState<'wallet' | 'razorpay'>('wallet');

    // Fetch user wallet balance when modal opens
    useEffect(() => {
        if (!isOpen) return;

        const fetchWallet = async () => {
            try {
                const res: any = await api.get('/wallet/balance');
                if (res) {
                    const bal = res.main_balance ?? res.total_balance ?? 0;
                    setWalletBalance(bal);
                    if (bal >= 99) {
                        setSelectedMethod('wallet');
                    } else {
                        setSelectedMethod('razorpay');
                    }
                }
            } catch (e) {
                console.warn('[InstantPassModal] Could not fetch wallet balance:', e);
                setSelectedMethod('razorpay');
            }
        };

        fetchWallet();
    }, [isOpen]);

    if (!isOpen) return null;

    // 1. Pay via KaamMilega Wallet (Instant 1-Click Debit)
    const handlePayFromWallet = async () => {
        setWalletLoading(true);
        try {
            const res: any = await api.post('/instant-work/pass/pay-wallet');
            notify.success('InstantPass activated via KaamMilega Wallet. 10 dispatches added.');
            onSuccess(res?.pass?.quota_remaining || 10);
            onClose();
        } catch (err: any) {
            notify.error(err, 'Failed to pay with wallet. Please try online payment.');
            setSelectedMethod('razorpay');
        } finally {
            setWalletLoading(false);
        }
    };

    // 2. Pay via Razorpay Gateway (UPI, Cards, NetBanking)
    const handlePurchaseWithRazorpay = async () => {
        const user = getCurrentUser();
        if (!user) {
            notify.info('Please log in to activate your InstantPass');
            window.location.href = `/login?redirect=${encodeURIComponent('/instant-milega')}`;
            return;
        }

        setLoading(true);
        try {
            const order = await api.post<unknown, CheckoutOrder>('/instant-work/pass/order');
            const outcome = await pay({
                order,
                description: 'InstantPass',
                prefill: { name: user.name || '', contact: user.mobile || '', email: user.email || '' },
                verify: (signed) => api.post<unknown, { quota_remaining?: number }>('/instant-work/pass/verify', signed),
            });
            if (outcome.status === 'paid') {
                notify.success('InstantPass activated. 10 dispatches added.');
                onSuccess(outcome.result?.quota_remaining || 10);
            }
            if (outcome.status !== 'cancelled') onClose();
        } catch (err) {
            notify.error(err, 'Failed to start the pass purchase');
        } finally {
            setLoading(false);
        }
    };

    const hasEnoughWalletBalance = walletBalance !== null && walletBalance >= 99;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
            <div className="relative w-full max-w-lg bg-km-surface-card rounded-2xl border border-km-border shadow-xl overflow-hidden text-km-text-primary">
                {/* Header Strip */}
                <div className="bg-[#071A4D] px-6 py-5 text-white flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold tracking-tight text-white">
                            InstantMilega™ Candidate Pass
                        </h2>
                        <p className="text-xs text-slate-300 mt-0.5">
                            Verified availability pass for on-demand spot dispatches
                        </p>
                    </div>

                    <button
                        onClick={onClose}
                        disabled={loading || walletLoading}
                        className="w-8 h-8 rounded-lg bg-[#0B1F52] hover:bg-[#13296B] flex items-center justify-center transition-colors text-white cursor-pointer"
                        aria-label="Close"
                    >
                        <XIcon weight="bold" size={16} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5">
                    {/* Price Tag Box */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-km-surface border border-km-border">
                        <div>
                            <span className="text-xs font-semibold text-km-text-secondary block">Universal Access Pass</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-3xl font-bold text-km-heading">₹99</span>
                                <span className="text-xs text-km-text-secondary">/ 10 Work Credits</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-block bg-[#FF6B00] text-white font-bold text-xs px-2.5 py-1 rounded-md">
                                ₹9.90 / Credit
                            </span>
                            <span className="block text-xs text-km-text-secondary mt-1 font-medium">90 Days Validity</span>
                        </div>
                    </div>

                    <PaymentMethodPicker
                        value={selectedMethod}
                        onChange={setSelectedMethod}
                        balance={walletBalance}
                        price={99}
                        disabled={loading || walletLoading}
                        showShortfall={false}
                    />

                    {/* Features Checklist */}
                    <div className="space-y-2 pt-1">
                        <div className="flex items-start gap-2.5">
                            <CheckIcon weight="bold" size={16} className="text-km-instant shrink-0 mt-px" aria-hidden="true" />
                            <p className="text-xs text-km-text-secondary">
                                <strong className="text-km-text-primary">10 Work Credits</strong>: One credit is used per accepted Instant Milega gig.
                            </p>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <CheckIcon weight="bold" size={16} className="text-km-instant shrink-0 mt-px" aria-hidden="true" />
                            <p className="text-xs text-km-text-secondary">
                                <strong className="text-km-text-primary">Unlimited Direct Chats</strong>: Unlocks direct messaging beyond the free 3-contact limit.
                            </p>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <CheckIcon weight="bold" size={16} className="text-km-instant shrink-0 mt-px" aria-hidden="true" />
                            <p className="text-xs text-km-text-secondary">
                                <strong className="text-km-text-primary">Expert application</strong>: Apply as an Expert if you have 2+ years of experience. 0% commission on your service earnings.
                            </p>
                        </div>
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                        {selectedMethod === 'wallet' ? (
                            hasEnoughWalletBalance ? (
                                <button
                                    type="button"
                                    onClick={handlePayFromWallet}
                                    disabled={walletLoading}
                                    className="w-full bg-[#071A4D] hover:bg-[#0B1F52] text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 shadow-xs dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                >
                                    {walletLoading ? (
                                        <span>Processing Wallet Debit...</span>
                                    ) : (
                                        <>
                                            <WalletIcon weight="bold" size={16} />
                                            <span>Pay ₹99 from KaamMilega Wallet</span>
                                            <ArrowRightIcon weight="bold" size={16} />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="space-y-2">
                                    <button
                                        type="button"
                                        onClick={handlePurchaseWithRazorpay}
                                        disabled={loading}
                                        className="w-full bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 shadow-xs"
                                    >
                                        <CreditCardIcon weight="bold" size={16} />
                                        <span>Pay ₹99 via Online Gateway</span>
                                        <ArrowRightIcon weight="bold" size={16} />
                                    </button>
                                    <p className="text-center text-xs text-km-text-secondary">
                                        Wallet balance (₹{(walletBalance || 0).toFixed(2)}) is insufficient.{' '}
                                        <Link href="/wallet" className="text-km-heading font-bold hover:underline">
                                            Top up wallet
                                        </Link>
                                    </p>
                                </div>
                            )
                        ) : (
                            <button
                                type="button"
                                onClick={handlePurchaseWithRazorpay}
                                disabled={loading}
                                className="w-full bg-[#FF6B00] hover:bg-[#FF8A00] text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 shadow-xs"
                            >
                                {loading ? (
                                    <span>Opening Payment Gateway...</span>
                                ) : (
                                    <>
                                        <CreditCardIcon weight="bold" size={16} />
                                        <span>Pay ₹99 via Online Gateway</span>
                                        <ArrowRightIcon weight="bold" size={16} />
                                    </>
                                )}
                            </button>
                        )}

                        <p className="text-center text-xs text-km-text-secondary mt-2.5 flex items-center justify-center gap-1.5">
                            <ShieldCheckIcon weight="bold" size={14} className="text-[#16A34A]" />
                            <span>100% Secure Payment · Instant 10 Gigs Quota</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
