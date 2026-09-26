"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
    ShieldAlert, 
    Clock, 
    CheckCircle2, 
    XCircle, 
    AlertCircle, 
    ChevronLeft, 
    ChevronRight, 
    ReceiptText,
    RefreshCw,
    Sparkles,
    Shield
} from 'lucide-react';
import api from '@/lib/axios';

export interface DisputeItem {
    id: string;
    dispute_number: string;
    wallet_id: string;
    user_id: string;
    transaction_id: string;
    amount: number;
    currency: string;
    reason: string;
    description: string;
    status: 'pending' | 'under_review' | 'approved' | 'rejected';
    admin_notes?: string;
    resolved_at?: string;
    refund_transaction_id?: string;
    refund_tx_id?: string;
    created_at: string;
    updated_at: string;
}

interface Props {
    refreshKey?: number;
}

export default function WalletDisputesList({ refreshKey = 0 }: Props) {
    const [disputes, setDisputes] = useState<DisputeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected'>('all');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    const fetchDisputes = useCallback(async (targetPage = 1, filter = statusFilter) => {
        setLoading(true);
        try {
            const params: Record<string, any> = {
                page: targetPage,
                limit: 10,
            };
            if (filter !== 'all') {
                params.status = filter;
            }

            const res: any = await api.get('/wallet/my/disputes', { params });
            if (res && res.disputes) {
                setDisputes(res.disputes);
                setTotalPages(res.total_pages || 1);
                setTotalCount(res.total || 0);
            } else {
                setDisputes([]);
                setTotalPages(1);
                setTotalCount(0);
            }
        } catch (error) {
            console.error("Failed to fetch my disputes", error);
            setDisputes([]);
            setTotalPages(1);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchDisputes(page, statusFilter);
    }, [fetchDisputes, page, statusFilter, refreshKey]);

    const handleFilterChange = (filter: 'all' | 'pending' | 'under_review' | 'approved' | 'rejected') => {
        setStatusFilter(filter);
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
        return new Date(isoString).toLocaleDateString('en-IN', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getReasonLabel = (reason: string) => {
        switch (reason) {
            case 'service_not_provided': return 'Service Not Delivered';
            case 'session_cancelled': return 'Session Cancelled';
            case 'duplicate_charge': return 'Duplicate Deduction';
            case 'technical_failure': return 'Technical Failure';
            case 'dissatisfied': return 'Quality / Dissatisfied';
            default: return 'Other Reason';
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'pending':
                return {
                    label: 'Pending Review',
                    bg: 'bg-amber-100 text-amber-800 border-amber-200',
                    icon: Clock,
                };
            case 'under_review':
                return {
                    label: 'Under Review',
                    bg: 'bg-blue-100 text-blue-800 border-blue-200',
                    icon: Shield,
                };
            case 'approved':
                return {
                    label: 'Approved & Refunded',
                    bg: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    icon: CheckCircle2,
                };
            case 'rejected':
                return {
                    label: 'Dispute Rejected',
                    bg: 'bg-rose-100 text-rose-800 border-rose-200',
                    icon: XCircle,
                };
            default:
                return {
                    label: status,
                    bg: 'bg-slate-100 text-slate-700 border-slate-200',
                    icon: Clock,
                };
        }
    };

    return (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden">
            {/* Header & Filter Tabs */}
            <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center">
                        <ShieldAlert className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight">
                            Disputes & Refund Requests
                        </h2>
                        <p className="text-xs text-slate-500 font-medium">
                            Track the investigation and refund status of your reported transactions.
                        </p>
                    </div>
                </div>

                {/* Filter Tabs */}
                <div className="flex items-center bg-slate-100/90 p-1 rounded-2xl self-start sm:self-auto overflow-x-auto max-w-full">
                    {[
                        { key: 'all', label: 'All' },
                        { key: 'pending', label: 'Pending' },
                        { key: 'under_review', label: 'Under Review' },
                        { key: 'approved', label: 'Approved' },
                        { key: 'rejected', label: 'Rejected' },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => handleFilterChange(tab.key as any)}
                            className={`px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
                                statusFilter === tab.key 
                                    ? 'bg-white text-slate-900 shadow-xs' 
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* List Body */}
            <div className="p-4 sm:p-6">
                {loading ? (
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 animate-pulse space-y-3">
                                <div className="flex justify-between">
                                    <div className="w-28 h-4 rounded bg-slate-200" />
                                    <div className="w-20 h-4 rounded bg-slate-200" />
                                </div>
                                <div className="w-48 h-3 rounded bg-slate-200" />
                            </div>
                        ))}
                    </div>
                ) : disputes.length === 0 ? (
                    <div className="py-12 sm:py-16 text-center space-y-3">
                        <div className="w-16 h-16 rounded-3xl bg-slate-50 border border-slate-200 text-slate-400 mx-auto flex items-center justify-center shadow-inner">
                            <ShieldAlert className="w-7 h-7 text-slate-300" />
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-800">
                            No Disputes Found
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                            {statusFilter === 'all'
                                ? "You haven't filed any refund or dispute requests yet. If you face any issues with a debit transaction, you can raise a dispute directly from your transaction history."
                                : `No disputes found under "${statusFilter}".`}
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 space-y-3 divide-y-0">
                        {disputes.map((dispute) => {
                            const badge = getStatusBadge(dispute.status);
                            const BadgeIcon = badge.icon;

                            return (
                                <div 
                                    key={dispute.id} 
                                    className="p-4 sm:p-5 rounded-2xl border border-slate-200/80 bg-white hover:border-slate-300 transition space-y-3.5 shadow-xs"
                                >
                                    {/* Top Row: Dispute Number, Status, Amount */}
                                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
                                        <div className="flex items-center gap-2.5 flex-wrap">
                                            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
                                                {dispute.dispute_number}
                                            </span>

                                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${badge.bg}`}>
                                                <BadgeIcon size={13} />
                                                <span>{badge.label}</span>
                                            </span>

                                            <span className="text-xs text-slate-400 font-medium">
                                                Filed on {formatDate(dispute.created_at)}
                                            </span>
                                        </div>

                                        <div className="text-base sm:text-lg font-black font-mono text-slate-900 self-start sm:self-auto">
                                            {formatCurrency(dispute.amount)}
                                        </div>
                                    </div>

                                    {/* Dispute Reason & User Description */}
                                    <div className="space-y-1.5 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-800">
                                                Reason: {getReasonLabel(dispute.reason)}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed font-normal">
                                            {dispute.description}
                                        </p>
                                    </div>

                                    {/* Admin Resolution Feedback if any */}
                                    {dispute.admin_notes && (
                                        <div className={`p-3.5 rounded-xl border text-xs space-y-1 ${
                                            dispute.status === 'approved' 
                                                ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
                                                : dispute.status === 'rejected'
                                                ? 'bg-rose-50/80 border-rose-200 text-rose-900'
                                                : 'bg-blue-50/80 border-blue-200 text-blue-900'
                                        }`}>
                                            <div className="flex items-center justify-between font-bold">
                                                <span>Admin Resolution Response:</span>
                                                {dispute.resolved_at && (
                                                    <span className="font-normal font-mono text-[11px] opacity-80">
                                                        {formatDate(dispute.resolved_at)}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="font-medium text-[11px] leading-relaxed">
                                                {dispute.admin_notes}
                                            </p>
                                            {dispute.status === 'approved' && (
                                                <p className="font-semibold text-emerald-800 text-[11px] flex items-center gap-1 pt-0.5">
                                                    <Sparkles size={12} />
                                                    <span>₹{dispute.amount} has been automatically credited back to your Main Balance.</span>
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    {/* Bottom Meta */}
                                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                                        <span>Original Tx: #{dispute.transaction_id.slice(-8)}</span>
                                        {(dispute.refund_transaction_id || dispute.refund_tx_id) && (
                                            <span className="text-emerald-700 font-semibold font-sans">
                                                Refund Ledger ID: #{(dispute.refund_transaction_id || dispute.refund_tx_id || '').slice(-8)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>
                            Showing page <strong>{page}</strong> of <strong>{totalPages}</strong> ({totalCount} total)
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
