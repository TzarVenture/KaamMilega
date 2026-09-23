'use client';

import { useState } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { Wallet, ShieldCheck, Zap, ArrowRight, ExternalLink } from 'lucide-react';
import api from '@/lib/axios';
import Link from 'next/link';

interface RefillWalletModalProps {
    isOpen: boolean;
    currentBalance: number;
    onClose: () => void;
    onSuccess: (newBalance: number) => void;
}

const PRESET_AMOUNTS = [100, 200, 500, 1000, 2000];

export default function RefillWalletModal({
    isOpen,
    currentBalance,
    onClose,
    onSuccess,
}: RefillWalletModalProps) {
    const [amount, setAmount] = useState<string>('500');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadRazorpayScript = () => {
        return new Promise<boolean>((resolve) => {
            if (typeof window === 'undefined') return resolve(false);
            if ((window as any).Razorpay) return resolve(true);

            const script = document.createElement('script');
            script.src = 'https://checkout.razorpay.com/v1/checkout.js';
            script.async = true;
            script.onload = () => resolve(true);
            script.onerror = () => resolve(false);
            document.body.appendChild(script);
        });
    };

    const handleProceedToPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        const amt = parseFloat(amount);
        if (isNaN(amt) || amt < 10) {
            setError('Please enter a valid amount (minimum ₹10)');
            return;
        }

        setLoading(true);

        try {
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                setError('Payment gateway failed to load. Please check your network connection.');
                setLoading(false);
                return;
            }

            // 1. Create order on backend
            const orderRes: any = await api.post('/wallet/topup/create-order', {
                amount: amt,
            });

            if (!orderRes || !orderRes.order_id) {
                setError(orderRes?.error || 'Failed to initiate recharge order');
                setLoading(false);
                return;
            }

            const rzpKey = orderRes.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

            // 2. Open Razorpay Checkout Modal
            const options = {
                key: rzpKey,
                amount: orderRes.amount_paise,
                currency: orderRes.currency || 'INR',
                name: 'KaamMilega™',
                description: `Refill Wallet Balance - ₹${amt}`,
                order_id: orderRes.order_id,
                handler: async function (response: any) {
                    try {
                        // 3. Verify payment signature with backend
                        await api.post('/wallet/topup/verify', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            amount: amt,
                        });

                        const newBal = currentBalance + amt;
                        onSuccess(newBal);
                        onClose();
                    } catch (verifyErr: any) {
                        console.error('Payment verification failed', verifyErr);
                        setError(verifyErr?.response?.data?.error || 'Payment verification failed. Please contact support.');
                    } finally {
                        setLoading(false);
                    }
                },
                theme: {
                    color: '#1a2b8c', // Official KaamMilega Brand Blue
                },
                modal: {
                    ondismiss: function () {
                        setLoading(false);
                    },
                },
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (resp: any) {
                setError(resp?.error?.description || 'Payment failed. Please try again.');
                setLoading(false);
            });
            rzp.open();
        } catch (err: any) {
            console.error('Failed to initiate recharge:', err);
            setError(err?.response?.data?.error || err.message || 'Failed to initiate recharge.');
            setLoading(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Refill Digital Wallet">
            <form onSubmit={handleProceedToPayment} className="space-y-4">
                {/* Current Balance Banner */}
                <div className="bg-linear-to-r from-km-primary to-blue-800 text-white rounded-xl p-4 flex items-center justify-between shadow-xs">
                    <div>
                        <p className="text-xs text-blue-200">Current Available Balance</p>
                        <p className="text-2xl font-black mt-0.5">₹{currentBalance.toFixed(2)}</p>
                    </div>
                    <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center">
                        <Wallet size={20} className="text-white" />
                    </div>
                </div>

                {error && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs font-semibold">
                        {error}
                    </div>
                )}

                {/* Amount Input */}
                <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                        Enter Refill Amount (INR)
                    </label>
                    <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base">₹</span>
                        <input
                            type="number"
                            min="10"
                            max="100000"
                            required
                            placeholder="500"
                            className="w-full pl-8 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary outline-none text-base font-bold text-gray-900"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />
                    </div>
                </div>

                {/* Preset Chips */}
                <div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">Quick Select:</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                        {PRESET_AMOUNTS.map((amt) => (
                            <button
                                key={amt}
                                type="button"
                                onClick={() => setAmount(amt.toString())}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                                    amount === amt.toString()
                                        ? 'bg-blue-50 border-km-primary text-km-primary shadow-xs'
                                        : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                }`}
                            >
                                + ₹{amt}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Trust Banner */}
                <div className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-100 rounded-xl text-[11px] text-gray-500">
                    <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                    <span>Instant wallet top-up secured with 256-bit bank-grade encryption via UPI, Cards & NetBanking.</span>
                </div>

                {/* Modal Footer Actions */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                    <Link
                        href="/wallet"
                        onClick={onClose}
                        className="text-xs text-km-primary font-bold hover:underline inline-flex items-center gap-1"
                    >
                        <span>Full Wallet & History</span>
                        <ExternalLink size={12} />
                    </Link>

                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-xs font-semibold hover:bg-gray-50 transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !amount}
                            className="px-5 py-2 bg-km-primary hover:bg-km-primary-dark disabled:bg-gray-300 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                        >
                            {loading ? (
                                'Processing...'
                            ) : (
                                <>
                                    <span>Proceed to Pay</span>
                                    <ArrowRight size={14} />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </ModalWrapper>
    );
}
