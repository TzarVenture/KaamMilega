"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
    ArrowUpRight, 
    ArrowDownLeft, 
    Lock, 
    Briefcase, 
    Clock, 
    ChevronLeft, 
    ChevronRight, 
    ReceiptText, 
    RefreshCw,
    CreditCard,
    Zap,
    Users,
    Gift,
    ShieldCheck
} from 'lucide-react';
import api from '@/lib/axios';

export interface TransactionItem {
    id: string;
    wallet_id: string;
    type: 'credit' | 'debit';
    target_balance: 'main' | 'earnings' | 'locked' | 'bonus';
    category: string;
    amount: number;
    balance_after: number;
    status: string;
    reference_id?: string;
    description: string;
    metadata?: Record<string, any>;
    created_at: string;
}

interface TransactionsResponse {
    transactions: TransactionItem[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

interface Props {
    refreshKey?: number;
}

export default function WalletTransactionsList({ refreshKey = 0 }: Props) {
    const [transactions, setTransactions] = useState<TransactionItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'all' | 'credit' | 'debit' | 'earnings'>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const fetchTransactions = useCallback(async (targetPage = 1, filter = activeTab) => {
        setLoading(true);
        try {
            const params: Record<string, any> = {
                page: targetPage,
                limit: 10,
            };

            if (filter === 'credit') {
                params.type = 'credit';
            } else if (filter === 'debit') {
                params.type = 'debit';
            } else if (filter === 'earnings') {
                params.target_balance = 'earnings';
            }

            const res: any = await api.get('/wallet/transactions', { params });
            if (res && res.transactions) {
                setTransactions(res.transactions);
                setTotalPages(res.total_pages || 1);
                setTotalCount(res.total || 0);
            } else {
                setTransactions([]);
                setTotalPages(1);
                setTotalCount(0);
            }
        } catch (error) {
            console.error("Failed to load transactions", error);
            setTransactions([]);
            setTotalPages(1);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    useEffect(() => {
        fetchTransactions(page, activeTab);
    }, [fetchTransactions, page, activeTab, refreshKey]);

    const handleTabChange = (tab: 'all' | 'credit' | 'debit' | 'earnings') => {
        setActiveTab(tab);
        setPage(1);
    };

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(amount);
    };

    const formatDate = (isoString: string) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getCategoryBadge = (category: string, targetBalance: string) => {
        switch (category) {
            case 'topup':
                return { label: 'Recharge', bg: 'bg-blue-50 text-blue-700 border-blue-100', icon: CreditCard };
            case 'pass_purchase':
                return { label: 'Platform Pass', bg: 'bg-amber-50 text-amber-700 border-amber-100', icon: Zap };
            case 'session_booking':
                return { label: 'Mentorship', bg: 'bg-purple-50 text-purple-700 border-purple-100', icon: Users };
            case 'session_payout':
            case 'gig_payout':
                return { label: 'Gig Earning', bg: 'bg-emerald-50 text-emerald-800 border-emerald-100', icon: Briefcase };
            case 'bonus_reward':
                return { label: 'Bonus Reward', bg: 'bg-indigo-50 text-indigo-700 border-indigo-100', icon: Gift };
            case 'withdrawal':
                return { label: 'Bank Payout', bg: 'bg-slate-100 text-slate-800 border-slate-200', icon: ArrowUpRight };
            default:
                if (targetBalance === 'earnings') {
                    return { label: 'Earnings', bg: 'bg-emerald-50 text-emerald-700 border-emerald-100', icon: Briefcase };
                }
                return { label: 'Activity', bg: 'bg-slate-50 text-slate-700 border-slate-200', icon: ReceiptText };
        }
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Header & Filter Tabs */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-blue-50 text-blue-900 flex items-center justify-center">
                        <ReceiptText className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                            Ledger & Transaction History
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                            Immutable audit trail of all credits, deductions, and payouts.
                        </p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto max-w-full">
                    {[
                        { key: 'all', label: 'All Activity' },
                        { key: 'credit', label: 'Inflow (+)' },
                        { key: 'debit', label: 'Outflow (-)' },
                        { key: 'earnings', label: 'Earnings' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => handleTabChange(tab.key as any)}
                            className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                activeTab === tab.key 
                                    ? 'bg-white text-slate-900 shadow-xs' 
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="p-4 sm:p-6">
                {loading ? (
                    // Shimmer Skeletons
                    <div className="space-y-3">
                        {[1, 2, 3, 4].map((i) => (
                            <div key={i} className="flex items-center justify-between p-4 rounded-2xl border border-slate-100 bg-slate-50/50 animate-pulse">
                                <div className="flex items-center gap-3.5">
                                    <div className="w-10 h-10 rounded-2xl bg-slate-200" />
                                    <div className="space-y-2">
                                        <div className="w-32 h-3.5 rounded-md bg-slate-200" />
                                        <div className="w-24 h-2.5 rounded-md bg-slate-200" />
                                    </div>
                                </div>
                                <div className="space-y-2 text-right">
                                    <div className="w-20 h-4 rounded-md bg-slate-200 ml-auto" />
                                    <div className="w-16 h-2.5 rounded-md bg-slate-200 ml-auto" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : transactions.length === 0 ? (
                    // Empty State
                    <div className="py-12 sm:py-16 text-center space-y-3">
                        <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 text-slate-400 mx-auto flex items-center justify-center shadow-inner">
                            <ReceiptText className="w-7 h-7" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800">
                            No Transactions Found
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                            {activeTab === 'all' 
                                ? "When you add money, unlock platform passes, or earn from gigs and mentorships, your transactions will be logged here."
                                : `No transactions found under the "${activeTab}" filter.`}
                        </p>
                    </div>
                ) : (
                    // Transactions List
                    <div className="divide-y divide-slate-100">
                        {transactions.map((tx) => {
                            const isCredit = tx.type === 'credit';
                            const badge = getCategoryBadge(tx.category, tx.target_balance);
                            const BadgeIcon = badge.icon;

                            return (
                                <div 
                                    key={tx.id} 
                                    className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 p-3 rounded-2xl transition -mx-3"
                                >
                                    {/* Left: Direction Icon + Info */}
                                    <div className="flex items-center gap-3.5">
                                        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 shadow-xs border ${
                                            isCredit 
                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                                                : 'bg-slate-100 text-slate-700 border-slate-200'
                                        }`}>
                                            {isCredit ? (
                                                <ArrowDownLeft className="w-5 h-5" />
                                            ) : (
                                                <ArrowUpRight className="w-5 h-5" />
                                            )}
                                        </div>

                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-[11px] font-bold border ${badge.bg}`}>
                                                    <BadgeIcon size={12} />
                                                    <span>{badge.label}</span>
                                                </span>

                                                <span className="text-xs sm:text-sm font-bold text-slate-900">
                                                    {tx.description || (isCredit ? 'Account Recharge' : 'Payment')}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 text-[11px] text-slate-500 font-medium flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={11} className="text-slate-400" />
                                                    <span>{formatDate(tx.created_at)}</span>
                                                </span>

                                                <span className="text-slate-300">•</span>

                                                <span className="capitalize px-1.5 py-0.2 rounded bg-slate-100 text-slate-600 font-semibold">
                                                    {tx.target_balance} Balance
                                                </span>

                                                {tx.reference_id && (
                                                    <>
                                                        <span className="text-slate-300">•</span>
                                                        <span className="font-mono text-slate-400">
                                                            #{tx.reference_id.slice(-8)}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Right: Amount & Status */}
                                    <div className="flex items-center justify-between sm:flex-col sm:items-end sm:justify-center pl-14 sm:pl-0">
                                        <div className={`text-sm sm:text-base font-black font-mono tracking-tight ${
                                            isCredit ? 'text-emerald-700' : 'text-slate-900'
                                        }`}>
                                            {isCredit ? '+' : '-'}{formatCurrency(tx.amount)}
                                        </div>

                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-[11px] text-slate-400 font-medium">
                                                After: <strong className="font-mono text-slate-600">{formatCurrency(tx.balance_after)}</strong>
                                            </span>

                                            <span className="inline-block w-1 h-1 rounded-full bg-slate-300" />

                                            <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                                                tx.status === 'completed' 
                                                    ? 'bg-emerald-100 text-emerald-800' 
                                                    : tx.status === 'pending'
                                                    ? 'bg-amber-100 text-amber-800'
                                                    : 'bg-rose-100 text-rose-800'
                                            }`}>
                                                {tx.status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>
                            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total entries)
                        </span>

                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                                disabled={page <= 1 || loading}
                                className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                                aria-label="Previous page"
                            >
                                <ChevronLeft size={14} />
                            </button>

                            <button
                                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={page >= totalPages || loading}
                                className="p-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                                aria-label="Next page"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
