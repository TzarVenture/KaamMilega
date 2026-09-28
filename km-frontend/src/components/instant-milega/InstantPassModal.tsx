'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    X,
    ShieldCheck,
    Check,
    Phone,
    CreditCard,
    ArrowRight,
    Wallet
} from 'lucide-react';
import { toast } from 'react-toastify';
import api from '@/lib/axios';
import { getCurrentUser } from '@/lib/auth';

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

    // Dynamically load Razorpay Checkout SDK
    const loadRazorpayScript = () => {
        return new Promise<boolean>((resolve) => {
            if ((window as any).Razorpay) return resolve(true);
            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    // 1. Pay via KaamMilega Wallet (Instant 1-Click Debit)
    const handlePayFromWallet = async () => {
        setWalletLoading(true);
        try {
            const res: any = await api.post('/instant-work/pass/pay-wallet');
            toast.success('InstantPass activated via KaamMilega Wallet. 10 dispatches added.');
            onSuccess(res?.pass?.quota_remaining || 10);
            onClose();
        } catch (err: any) {
            toast.error(err.message || 'Failed to pay with wallet. Please try online payment.');
            setSelectedMethod('razorpay');
        } finally {
            setWalletLoading(false);
        }
    };

    // 2. Pay via Razorpay Gateway (UPI, Cards, NetBanking)
    const handlePurchaseWithRazorpay = async () => {
        setLoading(true);
        try {
            const user = getCurrentUser();
            if (!user) {
                toast.info('Please log in to activate your InstantPass');
                window.location.href = `/login?redirect=${encodeURIComponent('/instant-milega')}`;
                return;
            }

            const orderRes: any = await api.post('/instant-work/pass/order');

            const sdkLoaded = await loadRazorpayScript();
            if (!sdkLoaded) {
                toast.error('Could not load payment gateway. Please check your connection.');
                setLoading(false);
                return;
            }

            // Local mock order handling for dev environment
            if (orderRes.order_id?.startsWith('order_mock_')) {
                const verifyRes: any = await api.post('/instant-work/pass/verify', {
                    razorpay_order_id: orderRes.order_id,
                    razorpay_payment_id: `pay_mock_${Date.now()}`,
                    razorpay_signature: 'mock_verified_signature',
                });
                toast.success('InstantPass activated. 10 guaranteed dispatches added.');
                onSuccess(verifyRes.quota_remaining || 10);
                onClose();
                setLoading(false);
                return;
            }

            const options = {
                key: orderRes.key_id,
                amount: orderRes.amount,
                currency: 'INR',
                name: 'KaamMilega InstantMilega™',
                description: '₹99 InstantPass — 10 Guaranteed Dispatches',
                image: '/kaammilega-logo-icon.png',
                order_id: orderRes.order_id,
                handler: async function (response: any) {
                    try {
                        const verifyRes: any = await api.post('/instant-work/pass/verify', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                        });
                        toast.success('InstantPass activated. 10 guaranteed dispatches added.');
                        onSuccess(verifyRes.quota_remaining || 10);
                        onClose();
                    } catch (err: any) {
                        toast.error(err.message || 'Payment verification failed');
                    } finally {
                        setLoading(false);
                    }
                },
                prefill: {
                    name: user.name || '',
                    contact: user.mobile || '',
                    email: user.email || '',
                },
                theme: {
                    color: '#FF6B00',
                },
                modal: {
                    ondismiss: () => {
                        setLoading(false);
                    },
                },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.open();
        } catch (err: any) {
            toast.error(err.message || 'Failed to initiate pass purchase');
            setLoading(false);
        }
    };

    const hasEnoughWalletBalance = walletBalance !== null && walletBalance >= 99;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
            <div className="relative w-full max-w-lg bg-white rounded-2xl border border-[#D9E0EA] shadow-xl overflow-hidden text-[#111827]">
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
                        className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors text-white cursor-pointer"
                        aria-label="Close"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-6 space-y-5">
                    {/* Price Tag Box */}
                    <div className="flex items-center justify-between p-4 rounded-xl bg-[#F4F7FB] border border-[#D9E0EA]">
                        <div>
                            <span className="text-xs font-semibold text-[#5B6472] uppercase tracking-wider block">Candidate Access Pass</span>
                            <div className="flex items-baseline gap-1 mt-0.5">
                                <span className="text-3xl font-bold text-[#071A4D]">₹99</span>
                                <span className="text-xs text-[#5B6472]">/ 10 Gigs Access</span>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className="inline-block bg-[#FF6B00] text-white font-bold text-xs px-2.5 py-1 rounded-md">
                                ₹9.90 / Gig
                            </span>
                            <span className="block text-xs text-[#5B6472] mt-1 font-medium">30 Days Validity</span>
                        </div>
                    </div>

                    {/* Payment Method Selector */}
                    <div>
                        <span className="text-xs font-bold text-[#111827] block mb-2">Select Payment Method:</span>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Option 1: KaamMilega Wallet */}
                            <button
                                type="button"
                                onClick={() => setSelectedMethod('wallet')}
                                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                                    selectedMethod === 'wallet'
                                        ? 'border-[#071A4D] bg-[#F4F7FB] ring-1 ring-[#071A4D]'
                                        : 'border-[#D9E0EA] hover:border-[#071A4D]/40 bg-white'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="w-7 h-7 rounded-lg bg-[#F4F7FB] border border-[#D9E0EA] flex items-center justify-center text-[#071A4D]">
                                        <Wallet size={15} />
                                    </div>
                                    {selectedMethod === 'wallet' && (
                                        <div className="w-4 h-4 rounded-full bg-[#071A4D] text-white flex items-center justify-center">
                                            <Check size={11} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-[#111827] block">KaamMilega Wallet</span>
                                <span className={`text-[11px] block mt-0.5 font-medium ${
                                    hasEnoughWalletBalance ? 'text-[#16A34A]' : 'text-[#5B6472]'
                                }`}>
                                    {walletBalance != null ? `Balance: ₹${walletBalance.toFixed(2)}` : 'Fetching...'}
                                </span>
                            </button>

                            {/* Option 2: Online Gateway */}
                            <button
                                type="button"
                                onClick={() => setSelectedMethod('razorpay')}
                                className={`p-3.5 rounded-xl border text-left transition-colors cursor-pointer ${
                                    selectedMethod === 'razorpay'
                                        ? 'border-[#071A4D] bg-[#F4F7FB] ring-1 ring-[#071A4D]'
                                        : 'border-[#D9E0EA] hover:border-[#071A4D]/40 bg-white'
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1.5">
                                    <div className="w-7 h-7 rounded-lg bg-[#F4F7FB] border border-[#D9E0EA] flex items-center justify-center text-[#071A4D]">
                                        <CreditCard size={15} />
                                    </div>
                                    {selectedMethod === 'razorpay' && (
                                        <div className="w-4 h-4 rounded-full bg-[#071A4D] text-white flex items-center justify-center">
                                            <Check size={11} strokeWidth={3} />
                                        </div>
                                    )}
                                </div>
                                <span className="text-xs font-bold text-[#111827] block">Online Gateway</span>
                                <span className="text-[11px] text-[#5B6472] block mt-0.5 font-medium">
                                    UPI, Cards &amp; NetBanking
                                </span>
                            </button>
                        </div>
                    </div>

                    {/* Features Checklist */}
                    <div className="space-y-2 pt-1">
                        <div className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-[#FFF7ED] text-[#FF6B00] flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={11} strokeWidth={3} />
                            </div>
                            <p className="text-xs text-[#5B6472]">
                                <strong className="text-[#111827]">10 Guaranteed Spot Dispatches</strong>: Quota decrements only when you claim an accepted gig.
                            </p>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-[#FFF7ED] text-[#FF6B00] flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={11} strokeWidth={3} />
                            </div>
                            <p className="text-xs text-[#5B6472]">
                                <strong className="text-[#111827]">Direct Employer Connect</strong>: Speak directly to nearby employers with 1-click calls.
                            </p>
                        </div>

                        <div className="flex items-start gap-2.5">
                            <div className="w-4 h-4 rounded-full bg-[#FFF7ED] text-[#FF6B00] flex items-center justify-center shrink-0 mt-0.5">
                                <Check size={11} strokeWidth={3} />
                            </div>
                            <p className="text-xs text-[#5B6472]">
                                <strong className="text-[#111827]">0% Platform Commission</strong>: Keep 100% of your earnings.
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
                                    className="w-full bg-[#071A4D] hover:bg-[#0B1F52] text-white font-semibold text-sm py-3 rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 shadow-xs"
                                >
                                    {walletLoading ? (
                                        <span>Processing Wallet Debit...</span>
                                    ) : (
                                        <>
                                            <Wallet size={16} />
                                            <span>Pay ₹99 from KaamMilega Wallet</span>
                                            <ArrowRight size={16} />
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
                                        <CreditCard size={16} />
                                        <span>Pay ₹99 via Online Gateway</span>
                                        <ArrowRight size={16} />
                                    </button>
                                    <p className="text-center text-xs text-[#5B6472]">
                                        Wallet balance (₹{(walletBalance || 0).toFixed(2)}) is insufficient.{' '}
                                        <Link href="/wallet" className="text-[#071A4D] font-bold hover:underline">
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
                                        <CreditCard size={16} />
                                        <span>Pay ₹99 via Online Gateway</span>
                                        <ArrowRight size={16} />
                                    </>
                                )}
                            </button>
                        )}

                        <p className="text-center text-xs text-[#5B6472] mt-2.5 flex items-center justify-center gap-1.5">
                            <ShieldCheck size={14} className="text-[#16A34A]" />
                            <span>100% Secure Payment · Instant 10 Gigs Quota</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
