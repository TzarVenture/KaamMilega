"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
    Wallet as WalletIcon, 
    ArrowUpRight, 
    ArrowDownLeft, 
    Lock, 
    Gift, 
    Sparkles, 
    RefreshCw, 
    CreditCard, 
    Zap, 
    CheckCircle2,
    Users,
    ShieldCheck,
    Building2,
    Phone,
    AlertCircle,
    X
} from 'lucide-react';
import api from '@/lib/axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Link from 'next/link';
import WalletTransactionsList from '@/components/km/WalletTransactionsList';

interface WalletSummary {
    wallet_id: string;
    user_id: string;
    total_balance: number;
    withdrawable_balance: number;
    main_balance: number;
    earnings_balance: number;
    locked_balance: number;
    bonus_balance: number;
    currency: string;
    status: string;
    updated_at: string;
}

export default function WalletPage() {
    const [wallet, setWallet] = useState<WalletSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [isTopupModalOpen, setIsTopupModalOpen] = useState(false);
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [topupAmount, setTopupAmount] = useState("500");
    const [refreshKey, setRefreshKey] = useState(0);
    const [isPaymentProcessing, setIsPaymentProcessing] = useState(false);

    // Withdrawal Form State (F71)
    const [withdrawAmount, setWithdrawAmount] = useState("500");
    const [payoutMethod, setPayoutMethod] = useState<'bank' | 'upi'>('bank');
    const [accountHolder, setAccountHolder] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [confirmAccountNumber, setConfirmAccountNumber] = useState("");
    const [ifscCode, setIfscCode] = useState("");
    const [bankName, setBankName] = useState("");
    const [upiId, setUpiId] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [isWithdrawing, setIsWithdrawing] = useState(false);

    const fetchWallet = useCallback(async () => {
        setLoading(true);
        setRefreshKey(prev => prev + 1);
        try {
            const res: any = await api.get('/wallet/balance');
            setWallet(res);
        } catch (error: any) {
            console.error("Failed to load wallet", error);
            // Default zero wallet if unauthorized/uninitialized
            setWallet({
                wallet_id: "new",
                user_id: "",
                total_balance: 0,
                withdrawable_balance: 0,
                main_balance: 0,
                earnings_balance: 0,
                locked_balance: 0,
                bonus_balance: 0,
                currency: "INR",
                status: "active",
                updated_at: new Date().toISOString()
            });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchWallet();
    }, [fetchWallet]);

    const formatCurrency = (val: number | undefined) => {
        const num = val || 0;
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(num);
    };

    // Dynamically load official Razorpay Checkout SDK
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

    // Initiate Razorpay checkout order and payment verification flow
    const handleInitiatePayment = async () => {
        const amt = parseFloat(topupAmount);
        if (isNaN(amt) || amt < 10) {
            toast.error("Please enter a valid amount of at least ₹10");
            return;
        }
        if (amt > 100000) {
            toast.error("Maximum single recharge amount is ₹1,00,000");
            return;
        }

        setIsPaymentProcessing(true);
        try {
            const scriptLoaded = await loadRazorpayScript();
            if (!scriptLoaded) {
                toast.error("Failed to load Razorpay checkout gateway. Please check your internet connection.");
                setIsPaymentProcessing(false);
                return;
            }

            // 1. Create order on backend
            const orderRes: any = await api.post('/wallet/topup/create-order', {
                amount: amt
            });

            if (!orderRes || !orderRes.order_id) {
                toast.error(orderRes?.error || "Failed to initiate recharge order");
                setIsPaymentProcessing(false);
                return;
            }

            const rzpKey = orderRes.key_id || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID;

            // 2. Open Razorpay Checkout Modal
            const options = {
                key: rzpKey,
                amount: orderRes.amount_paise,
                currency: orderRes.currency || 'INR',
                name: 'KaamMilega™',
                description: `Recharge Main Balance - ₹${amt}`,
                order_id: orderRes.order_id,
                handler: async function (response: any) {
                    try {
                        toast.info("Verifying payment with secure ledger...");
                        // 3. Verify payment signature with backend and record into immutable ledger
                        await api.post('/wallet/topup/verify', {
                            razorpay_order_id: response.razorpay_order_id,
                            razorpay_payment_id: response.razorpay_payment_id,
                            razorpay_signature: response.razorpay_signature,
                            amount: amt
                        });

                        toast.success(`₹${amt} successfully added to your Main Balance!`);
                        setIsTopupModalOpen(false);
                        fetchWallet(); // Refreshes balance cards and F72 transaction ledger
                    } catch (verifyErr: any) {
                        console.error("Payment verification failed", verifyErr);
                        toast.error(verifyErr?.response?.data?.error || "Payment verification failed. Please contact support.");
                    } finally {
                        setIsPaymentProcessing(false);
                    }
                },
                theme: {
                    color: '#1a2b8c', // Brand Blue from DESIGN_SYSTEM.md
                },
                modal: {
                    ondismiss: function () {
                        setIsPaymentProcessing(false);
                    }
                }
            };

            const rzp = new (window as any).Razorpay(options);
            rzp.on('payment.failed', function (resp: any) {
                toast.error(`Payment failed: ${resp.error?.description || 'Transaction cancelled'}`);
                setIsPaymentProcessing(false);
            });
            rzp.open();
        } catch (err: any) {
            console.error("Payment initiation error", err);
            toast.error(err?.response?.data?.error || "Failed to initiate payment. Please try again.");
            setIsPaymentProcessing(false);
        }
    };

    // Process Bank / UPI withdrawal request from earnings balance (F71)
    const handleRequestWithdrawal = async (e: React.FormEvent) => {
        e.preventDefault();
        const amt = parseFloat(withdrawAmount);
        if (isNaN(amt) || amt < 50) {
            toast.error("Minimum withdrawal amount is ₹50");
            return;
        }

        const available = wallet?.withdrawable_balance || 0;
        if (amt > available) {
            toast.error(`Insufficient earnings balance. Maximum withdrawable: ₹${available.toFixed(2)}`);
            return;
        }

        if (payoutMethod === 'bank') {
            if (!accountHolder.trim()) {
                toast.error("Please enter account holder name");
                return;
            }
            if (!accountNumber.trim()) {
                toast.error("Please enter bank account number");
                return;
            }
            if (accountNumber.trim() !== confirmAccountNumber.trim()) {
                toast.error("Account numbers do not match");
                return;
            }
            if (!ifscCode.trim() || ifscCode.trim().length < 8) {
                toast.error("Please enter a valid IFSC code (e.g. HDFC0001234)");
                return;
            }
        } else {
            if (!upiId.trim() || !upiId.includes('@')) {
                toast.error("Please enter a valid UPI ID (e.g. name@okhdfcbank)");
                return;
            }
        }

        if (!phoneNumber.trim() || phoneNumber.trim().length < 10) {
            toast.error("Please provide a valid 10-digit contact phone number");
            return;
        }

        setIsWithdrawing(true);
        try {
            const res: any = await api.post('/wallet/withdraw', {
                amount: amt,
                payout_method: payoutMethod,
                account_holder: accountHolder.trim(),
                account_number: accountNumber.trim(),
                ifsc_code: ifscCode.trim().toUpperCase(),
                bank_name: bankName.trim(),
                upi_id: upiId.trim(),
                phone_number: phoneNumber.trim()
            });

            toast.success(res?.message || "Withdrawal request submitted! Funds will be transferred shortly.");
            setIsWithdrawModalOpen(false);
            // Reset form
            setWithdrawAmount("500");
            setAccountHolder("");
            setAccountNumber("");
            setConfirmAccountNumber("");
            setIfscCode("");
            setBankName("");
            setUpiId("");
            setPhoneNumber("");
            // Refresh wallet balance and transaction ledger
            fetchWallet();
        } catch (err: any) {
            console.error("Withdrawal request error", err);
            toast.error(err?.response?.data?.error || "Failed to submit withdrawal request. Please try again.");
        } finally {
            setIsWithdrawing(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50/60 py-6 sm:py-8 lg:py-10 px-4 sm:px-6 lg:px-8">
            <ToastContainer position="top-right" autoClose={3000} />

            <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
                {/* Header Title */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                    <div>
                        <div className="flex items-center gap-2.5">
                            <span className="p-2 sm:p-2.5 rounded-2xl bg-purple-100 text-purple-700 shadow-xs flex items-center justify-center">
                                <WalletIcon className="w-5 h-5 sm:w-6 sm:h-6" />
                            </span>
                            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                                My Wallet
                            </h1>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 font-medium">
                            Add money, track earnings, and make fast 1-click payments.
                        </p>
                    </div>

                    <div className="flex items-center self-start sm:self-auto">
                        <button 
                            onClick={fetchWallet}
                            disabled={loading}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition shadow-xs cursor-pointer active:scale-95 disabled:opacity-60"
                        >
                            <RefreshCw size={14} className={loading ? "animate-spin text-purple-600" : "text-slate-500"} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Hero Total Balance Card */}
                <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-purple-950 to-indigo-950 p-6 sm:p-8 lg:p-10 text-white shadow-xl shadow-purple-950/20">
                    <div className="absolute top-0 right-0 -mt-10 -mr-10 w-72 h-72 bg-purple-500/20 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-72 h-72 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 sm:gap-8">
                        <div className="space-y-2 sm:space-y-3">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-xs font-semibold text-purple-200 border border-white/10">
                                <Sparkles size={13} className="text-amber-400" />
                                <span>Total Balance</span>
                            </div>
                            <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-black tracking-tight text-white font-mono">
                                {loading ? "₹..." : formatCurrency(wallet?.total_balance)}
                            </div>
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs sm:text-sm text-slate-300">
                                <p className="flex items-center gap-1.5">
                                    <span className="text-slate-400">Withdrawable:</span>
                                    <strong className="text-emerald-400 font-bold">{formatCurrency(wallet?.withdrawable_balance)}</strong>
                                </p>
                                <span className="hidden sm:inline text-slate-600">•</span>
                                <p className="flex items-center gap-1 text-slate-300">
                                    <ShieldCheck size={14} className="text-emerald-400" />
                                    <span>Safe & Protected</span>
                                </p>
                            </div>
                        </div>

                        {/* Quick Action Buttons */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <button
                                onClick={() => setIsTopupModalOpen(true)}
                                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-bold shadow-lg shadow-purple-600/30 transition active:scale-95 cursor-pointer"
                            >
                                <ArrowDownLeft size={18} />
                                <span>Add Money</span>
                            </button>

                            <button
                                onClick={() => setIsWithdrawModalOpen(true)}
                                className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-sm font-bold backdrop-blur-md border border-white/15 transition active:scale-95 cursor-pointer"
                            >
                                <ArrowUpRight size={18} />
                                <span>Withdraw</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Balance Breakdown Section */}
                <div className="space-y-3.5 sm:space-y-4">
                    <div className="flex items-center justify-between px-1">
                        <h2 className="text-base sm:text-lg font-bold text-slate-900">
                            Your Balances
                        </h2>
                        <span className="text-xs text-slate-400 font-medium">Auto-updated</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
                        {/* 1. Main Balance */}
                        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="p-2.5 rounded-xl bg-blue-50 text-blue-600">
                                        <CreditCard size={18} />
                                    </span>
                                    <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                                        Available
                                    </span>
                                </div>
                                <p className="text-xs font-semibold text-slate-500">Main Balance</p>
                                <p className="text-2xl sm:text-3xl font-bold text-slate-900 mt-1 font-mono">
                                    {formatCurrency(wallet?.main_balance)}
                                </p>
                            </div>
                            <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 leading-relaxed">
                                Use to buy Pro passes, book mentorships, or hire talent.
                            </p>
                        </div>

                        {/* 2. Earnings Balance */}
                        <div className="bg-white rounded-2xl p-5 border border-emerald-200/80 shadow-xs hover:border-emerald-400 hover:shadow-md transition-all bg-emerald-50/20 flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700">
                                        <ArrowUpRight size={18} />
                                    </span>
                                    <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                                        Withdrawable
                                    </span>
                                </div>
                                <p className="text-xs font-semibold text-slate-500">Earnings</p>
                                <p className="text-2xl sm:text-3xl font-bold text-emerald-700 mt-1 font-mono">
                                    {formatCurrency(wallet?.earnings_balance)}
                                </p>
                            </div>
                            <p className="text-xs text-slate-600 mt-3 pt-3 border-t border-emerald-100/60 leading-relaxed">
                                Income from completed mentorships and gigs. Ready to transfer to your bank.
                            </p>
                        </div>

                        {/* 3. Locked in Escrow */}
                        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-amber-300 hover:shadow-md transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="p-2.5 rounded-xl bg-amber-50 text-amber-600">
                                        <Lock size={18} />
                                    </span>
                                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                                        Protected
                                    </span>
                                </div>
                                <p className="text-xs font-semibold text-slate-500">In Escrow</p>
                                <p className="text-2xl sm:text-3xl font-bold text-amber-600 mt-1 font-mono">
                                    {formatCurrency(wallet?.locked_balance)}
                                </p>
                            </div>
                            <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 leading-relaxed">
                                Funds held safely during ongoing sessions until work is completed.
                            </p>
                        </div>

                        {/* 4. Bonus Balance */}
                        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between">
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <span className="p-2.5 rounded-xl bg-purple-50 text-purple-600">
                                        <Gift size={18} />
                                    </span>
                                    <span className="text-[11px] font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full">
                                        Discounts
                                    </span>
                                </div>
                                <p className="text-xs font-semibold text-slate-500">Bonus Credits</p>
                                <p className="text-2xl sm:text-3xl font-bold text-purple-700 mt-1 font-mono">
                                    {formatCurrency(wallet?.bonus_balance)}
                                </p>
                            </div>
                            <p className="text-xs text-slate-500 mt-3 pt-3 border-t border-slate-100 leading-relaxed">
                                Promotional credits automatically applied as discounts at checkout.
                            </p>
                        </div>
                    </div>
                </div>

                {/* Explore Features Row (Clean Consumer Cards) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                    {/* 1. Pro Access Banner */}
                    <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4 pointer-events-none">
                            <Zap size={140} />
                        </div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold tracking-wide uppercase mb-3 backdrop-blur-xs">
                                <Zap size={13} />
                                <span>Platform Pass</span>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-extrabold mb-1.5">KaamMilega Pro Pass</h3>
                            <p className="text-xs sm:text-sm text-amber-100 leading-relaxed max-w-md">
                                Get direct recruiter contacts, verified badge, and priority applications for top jobs.
                            </p>
                        </div>
                        <div className="mt-6 relative z-10">
                            <Link 
                                href="/jobs" 
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-orange-700 text-xs font-bold rounded-xl hover:bg-orange-50 transition shadow-xs active:scale-95"
                            >
                                <span>Explore Jobs & Passes</span>
                                <ArrowUpRight size={14} />
                            </Link>
                        </div>
                    </div>

                    {/* 2. Mentorship Booking Banner */}
                    <div className="p-6 sm:p-7 rounded-3xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-md flex flex-col justify-between relative overflow-hidden">
                        <div className="absolute right-0 bottom-0 opacity-10 translate-x-4 translate-y-4 pointer-events-none">
                            <Users size={140} />
                        </div>
                        <div className="relative z-10">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-xs font-bold tracking-wide uppercase mb-3 backdrop-blur-xs">
                                <Users size={13} />
                                <span>Career Growth</span>
                            </div>
                            <h3 className="text-xl sm:text-2xl font-extrabold mb-1.5">1-on-1 Expert Mentorship</h3>
                            <p className="text-xs sm:text-sm text-indigo-100 leading-relaxed max-w-md">
                                Book sessions with top mentors. Your payment is held safely until the session is completed.
                            </p>
                        </div>
                        <div className="mt-6 relative z-10">
                            <Link 
                                href="/mentorship" 
                                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-50 transition shadow-xs active:scale-95"
                            >
                                <span>Browse Mentors</span>
                                <ArrowUpRight size={14} />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Ledger & Transactions History Section (F72) */}
                <WalletTransactionsList refreshKey={refreshKey} />
            </div>

            {/* Add Money Modal */}
            {isTopupModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <CreditCard size={18} className="text-purple-600" />
                                <span>Add Money to Wallet</span>
                            </h3>
                            <button 
                                onClick={() => setIsTopupModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1.5">
                                    Enter Amount (₹ INR)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-base">₹</span>
                                    <input
                                        type="number"
                                        min="50"
                                        value={topupAmount}
                                        onChange={(e) => setTopupAmount(e.target.value)}
                                        className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-900 text-base focus:outline-none focus:ring-2 focus:ring-purple-600"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {["100", "500", "1000", "2000"].map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setTopupAmount(preset)}
                                        className={`py-2 rounded-xl text-xs font-bold border transition cursor-pointer active:scale-95 ${
                                            topupAmount === preset 
                                                ? "bg-purple-600 text-white border-purple-600 shadow-xs" 
                                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                        }`}
                                    >
                                        ₹{preset}
                                    </button>
                                ))}
                            </div>

                            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-xs text-slate-600 space-y-1">
                                <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="text-emerald-500" />
                                    <span>Instant recharge via UPI, Cards & NetBanking</span>
                                </p>
                                <p className="text-[11px] text-slate-400 pl-5">
                                    Funds are added to your Main Balance immediately upon payment.
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setIsTopupModalOpen(false)}
                                disabled={isPaymentProcessing}
                                className="flex-1 py-3 rounded-2xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleInitiatePayment}
                                disabled={isPaymentProcessing}
                                className="flex-1 py-3 rounded-2xl bg-blue-900 hover:bg-blue-800 text-white font-bold text-xs shadow-md shadow-blue-900/20 cursor-pointer active:scale-95 disabled:opacity-70 flex items-center justify-center gap-2"
                            >
                                {isPaymentProcessing ? (
                                    <>
                                        <RefreshCw size={14} className="animate-spin" />
                                        <span>Processing...</span>
                                    </>
                                ) : (
                                    <>
                                        <CreditCard size={14} />
                                        <span>Pay ₹{topupAmount}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Modal (F71 Bank / UPI Payout) */}
            {isWithdrawModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in overflow-y-auto">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 my-8">
                        {/* Modal Header */}
                        <div className="flex justify-between items-start">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-xs">
                                    <ArrowUpRight size={20} />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold text-slate-900">
                                        Withdraw Earnings
                                    </h3>
                                    <p className="text-xs text-slate-500 font-medium">
                                        Direct payout to your Bank Account or UPI
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={() => setIsWithdrawModalOpen(false)}
                                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                aria-label="Close modal"
                            >
                                <X size={18} />
                            </button>
                        </div>

                        {/* Available Balance Banner */}
                        <div className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-2xl border border-emerald-100/80 flex items-center justify-between">
                            <div>
                                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                                    Withdrawable Earnings
                                </span>
                                <span className="text-2xl font-black text-emerald-950 font-mono">
                                    {formatCurrency(wallet?.withdrawable_balance)}
                                </span>
                            </div>
                            <button
                                type="button"
                                onClick={() => setWithdrawAmount(String(wallet?.withdrawable_balance || 0))}
                                disabled={(wallet?.withdrawable_balance || 0) < 50}
                                className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-xs cursor-pointer active:scale-95 transition"
                            >
                                Withdraw All
                            </button>
                        </div>

                        <form onSubmit={handleRequestWithdrawal} className="space-y-4">
                            {/* Amount Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Amount to Withdraw (Min ₹50)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-base">
                                        ₹
                                    </span>
                                    <input
                                        type="number"
                                        min={50}
                                        max={wallet?.withdrawable_balance || 0}
                                        step="any"
                                        value={withdrawAmount}
                                        onChange={(e) => setWithdrawAmount(e.target.value)}
                                        className="w-full pl-8 pr-4 py-2.5 rounded-2xl border border-slate-200 text-slate-900 font-bold text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                        placeholder="Enter amount"
                                        required
                                    />
                                </div>
                                <div className="flex gap-2 mt-2">
                                    {["100", "500", "1000", "2000"].map((preset) => (
                                        <button
                                            key={preset}
                                            type="button"
                                            onClick={() => setWithdrawAmount(preset)}
                                            className={`px-2.5 py-1 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                                                withdrawAmount === preset
                                                    ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                                                    : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                            }`}
                                        >
                                            ₹{preset}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Payout Method Toggle */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Payout Destination
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPayoutMethod('bank')}
                                        className={`py-2 px-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                                            payoutMethod === 'bank'
                                                ? 'bg-blue-50 border-blue-600 text-blue-900 shadow-xs'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Building2 size={16} />
                                        <span>Bank Transfer</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPayoutMethod('upi')}
                                        className={`py-2 px-3 rounded-2xl border flex items-center justify-center gap-2 text-xs font-bold transition cursor-pointer ${
                                            payoutMethod === 'upi'
                                                ? 'bg-purple-50 border-purple-600 text-purple-900 shadow-xs'
                                                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Zap size={16} />
                                        <span>Instant UPI</span>
                                    </button>
                                </div>
                            </div>

                            {/* Bank Details Form */}
                            {payoutMethod === 'bank' && (
                                <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Account Holder Name
                                        </label>
                                        <input
                                            type="text"
                                            value={accountHolder}
                                            onChange={(e) => setAccountHolder(e.target.value)}
                                            placeholder="As per bank passbook"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                                            required={payoutMethod === 'bank'}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                Account Number
                                            </label>
                                            <input
                                                type="text"
                                                value={accountNumber}
                                                onChange={(e) => setAccountNumber(e.target.value)}
                                                placeholder="e.g. 5010023456789"
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-medium text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                                                required={payoutMethod === 'bank'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                Confirm A/C Number
                                            </label>
                                            <input
                                                type="text"
                                                value={confirmAccountNumber}
                                                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                                                placeholder="Re-enter A/C number"
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-medium text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                                                required={payoutMethod === 'bank'}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                IFSC Code
                                            </label>
                                            <input
                                                type="text"
                                                value={ifscCode}
                                                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                                                placeholder="e.g. HDFC0001234"
                                                maxLength={11}
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono uppercase font-medium text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                                                required={payoutMethod === 'bank'}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                                Bank Name (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={bankName}
                                                onChange={(e) => setBankName(e.target.value)}
                                                placeholder="e.g. HDFC Bank"
                                                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:border-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* UPI Details Form */}
                            {payoutMethod === 'upi' && (
                                <div className="space-y-3 p-3.5 bg-slate-50 rounded-2xl border border-slate-100">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            UPI ID / VPA
                                        </label>
                                        <input
                                            type="text"
                                            value={upiId}
                                            onChange={(e) => setUpiId(e.target.value)}
                                            placeholder="e.g. username@okhdfcbank or 9876543210@paytm"
                                            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-900 bg-white focus:outline-none focus:border-purple-500"
                                            required={payoutMethod === 'upi'}
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Contact Phone */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                    <Phone size={13} className="text-slate-400" />
                                    <span>Contact Phone (For verification & payout alert)</span>
                                </label>
                                <input
                                    type="tel"
                                    value={phoneNumber}
                                    onChange={(e) => setPhoneNumber(e.target.value)}
                                    placeholder="10-digit mobile number"
                                    maxLength={13}
                                    className="w-full px-3.5 py-2.5 rounded-2xl border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-emerald-500"
                                    required
                                />
                            </div>

                            {/* Info Callout */}
                            <div className="flex items-start gap-2 p-3 bg-amber-50/80 rounded-2xl border border-amber-200/60 text-amber-900 text-xs leading-relaxed">
                                <AlertCircle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                                <p>
                                    Requested amount is deducted immediately from your earnings to prevent double-spending, and recorded in your immutable ledger below. Payout is disbursed by admin via IMPS/UPI.
                                </p>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsWithdrawModalOpen(false)}
                                    disabled={isWithdrawing}
                                    className="flex-1 py-3 rounded-2xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isWithdrawing || (wallet?.withdrawable_balance || 0) < 50}
                                    className="flex-1 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs shadow-md shadow-emerald-600/20 cursor-pointer active:scale-95 flex items-center justify-center gap-2"
                                >
                                    {isWithdrawing ? (
                                        <>
                                            <RefreshCw size={14} className="animate-spin" />
                                            <span>Submitting...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ArrowUpRight size={15} />
                                            <span>Withdraw ₹{withdrawAmount || '0'}</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
