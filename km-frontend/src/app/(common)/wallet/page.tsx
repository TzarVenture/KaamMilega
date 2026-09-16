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
    ShieldCheck
} from 'lucide-react';
import api from '@/lib/axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import Link from 'next/link';

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

    const fetchWallet = useCallback(async () => {
        setLoading(true);
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
                                onClick={() => setIsTopupModalOpen(false)}
                                className="flex-1 py-3 rounded-2xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => {
                                    toast.info("Payment gateway checkout will open here.");
                                    setIsTopupModalOpen(false);
                                }}
                                className="flex-1 py-3 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/20 cursor-pointer active:scale-95"
                            >
                                Pay ₹{topupAmount}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Withdraw Modal */}
            {isWithdrawModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl space-y-6">
                        <div className="flex justify-between items-center">
                            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                                <ArrowUpRight size={18} className="text-emerald-600" />
                                <span>Withdraw Earnings</span>
                            </h3>
                            <button 
                                onClick={() => setIsWithdrawModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="space-y-3.5 text-sm">
                            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-emerald-900">
                                <p className="text-xs text-emerald-700 font-semibold">Available for Withdrawal</p>
                                <p className="text-3xl font-black mt-1 font-mono">{formatCurrency(wallet?.withdrawable_balance)}</p>
                            </div>

                            <p className="text-xs text-slate-500 leading-relaxed">
                                Earnings from completed mentorship sessions can be transferred directly to your bank account or UPI ID.
                            </p>
                        </div>

                        <button
                            onClick={() => {
                                toast.info("Bank payout setup will be prompted upon withdrawal request.");
                                setIsWithdrawModalOpen(false);
                            }}
                            className="w-full py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs cursor-pointer active:scale-95"
                        >
                            Understood
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
