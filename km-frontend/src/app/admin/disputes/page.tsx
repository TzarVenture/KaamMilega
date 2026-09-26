"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { 
    ShieldAlert, 
    CheckCircle2, 
    XCircle, 
    Clock, 
    Search, 
    RefreshCw, 
    ChevronLeft, 
    ChevronRight,
    ArrowUpRight,
    Sparkles,
    Shield,
    X,
    AlertCircle,
    User,
    CreditCard
} from 'lucide-react';
import api from '@/lib/axios';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface AdminDisputeItem {
    id: string;
    dispute_number?: string;
    reference_id?: string;
    wallet_id: string;
    user_id: string;
    user_name?: string;
    user_email?: string;
    transaction_id: string;
    amount: number;
    currency: string;
    reason: string;
    description: string;
    status: 'pending' | 'under_review' | 'approved' | 'rejected';
    admin_notes?: string;
    resolved_by?: string;
    resolved_at?: string;
    refund_transaction_id?: string;
    refund_tx_id?: string;
    created_at: string;
    updated_at: string;
}

export default function AdminDisputesPage() {
    const [disputes, setDisputes] = useState<AdminDisputeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'under_review' | 'approved' | 'rejected'>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // Selected dispute for modal resolution
    const [selectedDispute, setSelectedDispute] = useState<AdminDisputeItem | null>(null);
    const [resolveStatus, setResolveStatus] = useState<'approved' | 'rejected' | 'under_review'>('approved');
    const [adminNotes, setAdminNotes] = useState('');
    const [isResolving, setIsResolving] = useState(false);

    const fetchDisputes = useCallback(async (targetPage = 1, filter = statusFilter) => {
        setLoading(true);
        try {
            const params: Record<string, any> = {
                page: targetPage,
                limit: 15,
            };
            if (filter !== 'all') {
                params.status = filter;
            }

            const res: any = await api.get('/admin/disputes', { params });
            if (res && res.disputes) {
                setDisputes(res.disputes);
                setTotalPages(res.total_pages || 1);
                setTotalCount(res.total || 0);
            } else {
                setDisputes([]);
                setTotalPages(1);
                setTotalCount(0);
            }
        } catch (error: any) {
            console.error("Failed to load admin disputes", error);
            toast.error(error?.response?.data?.error || "Failed to load disputes ledger");
            setDisputes([]);
            setTotalPages(1);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
    }, [statusFilter]);

    useEffect(() => {
        fetchDisputes(page, statusFilter);
    }, [fetchDisputes, page, statusFilter]);

    const handleFilterChange = (filter: 'all' | 'pending' | 'under_review' | 'approved' | 'rejected') => {
        setStatusFilter(filter);
        setPage(1);
    };

    const formatCurrency = (amt: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(amt);
    };

    const formatDate = (isoString?: string) => {
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
                    label: 'Pending',
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
                    label: 'Rejected',
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

    const openResolveModal = (disp: AdminDisputeItem) => {
        setSelectedDispute(disp);
        setResolveStatus(disp.status === 'under_review' ? 'approved' : 'approved');
        setAdminNotes(disp.admin_notes || '');
    };

    const closeResolveModal = () => {
        setSelectedDispute(null);
        setAdminNotes('');
        setIsResolving(false);
    };

    const handleResolveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDispute) return;
        if (!adminNotes.trim()) {
            toast.error("Please provide resolution notes or reasoning");
            return;
        }

        setIsResolving(true);
        try {
            const action = resolveStatus === 'approved' ? 'approve' : 'reject';
            const res: any = await api.put(`/admin/disputes/${selectedDispute.id}/resolve`, {
                action,
                status: resolveStatus,
                admin_notes: adminNotes.trim(),
            });

            toast.success(res?.message || `Dispute marked as ${resolveStatus}`);
            closeResolveModal();
            fetchDisputes(page, statusFilter);
        } catch (error: any) {
            console.error("Dispute resolution error", error);
            toast.error(error?.response?.data?.error || "Failed to resolve dispute");
        } finally {
            setIsResolving(false);
        }
    };

    // Filter by search query (customer name, email, dispute_number, reference_id, user_id, or transaction_id)
    const filteredDisputes = disputes.filter(disp => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return (
            disp.user_name?.toLowerCase().includes(q) ||
            disp.user_email?.toLowerCase().includes(q) ||
            disp.dispute_number?.toLowerCase().includes(q) ||
            disp.reference_id?.toLowerCase().includes(q) ||
            disp.id?.toLowerCase().includes(q) ||
            disp.user_id?.toLowerCase().includes(q) ||
            disp.transaction_id?.toLowerCase().includes(q) ||
            disp.description?.toLowerCase().includes(q)
        );
    });

    // Counts from current list or filter
    const pendingCount = disputes.filter(d => d.status === 'pending').length;
    const underReviewCount = disputes.filter(d => d.status === 'under_review').length;
    const approvedCount = disputes.filter(d => d.status === 'approved').length;

    return (
        <div className="space-y-6">
            <ToastContainer position="top-right" autoClose={3000} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2.5">
                        <ShieldAlert className="w-6 h-6 text-purple-600" />
                        <span>Wallet Disputes & Refunds</span>
                    </h1>
                    <p className="text-xs sm:text-sm text-gray-500 mt-1">
                        Review customer disputes, conduct investigations, and authorize atomic balance refunds.
                    </p>
                </div>

                <button 
                    onClick={() => fetchDisputes(page, statusFilter)}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-gray-200 bg-white text-xs font-semibold text-gray-700 hover:bg-gray-50 transition shadow-xs self-start sm:self-auto cursor-pointer"
                >
                    <RefreshCw size={14} className={loading ? "animate-spin text-purple-600" : "text-gray-500"} />
                    <span>Refresh</span>
                </button>
            </div>

            {/* Quick Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-xs">
                    <p className="text-xs font-semibold text-gray-500">Total Filtered</p>
                    <p className="text-2xl font-bold text-gray-900 mt-1">{totalCount}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-amber-100 shadow-xs bg-amber-50/20">
                    <p className="text-xs font-semibold text-amber-700">Pending Review</p>
                    <p className="text-2xl font-bold text-amber-700 mt-1">{pendingCount}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-blue-100 shadow-xs bg-blue-50/20">
                    <p className="text-xs font-semibold text-blue-700">Under Investigation</p>
                    <p className="text-2xl font-bold text-blue-700 mt-1">{underReviewCount}</p>
                </div>
                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-xs bg-emerald-50/20">
                    <p className="text-xs font-semibold text-emerald-700">Refunds Approved</p>
                    <p className="text-2xl font-bold text-emerald-700 mt-1">{approvedCount}</p>
                </div>
            </div>

            {/* Filter Tabs and Search */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Status tabs */}
                <div className="flex items-center bg-gray-100 p-1 rounded-xl overflow-x-auto">
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
                            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                                statusFilter === tab.key 
                                    ? 'bg-white text-gray-900 shadow-xs' 
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Search Box */}
                <div className="relative max-w-sm w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Search by customer name, email, dispute #, tx ID..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                </div>
            </div>

            {/* Disputes Table */}
            <div className="bg-white rounded-2xl shadow-xs border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-gray-400">Loading dispute requests...</div>
                ) : filteredDisputes.length === 0 ? (
                    <div className="p-12 text-center text-gray-400 space-y-2">
                        <ShieldAlert className="w-10 h-10 mx-auto text-gray-300" />
                        <p className="text-sm font-semibold">No dispute requests found.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Dispute Ref</th>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer & Tx</th>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Reason & Explanation</th>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-100">
                                {filteredDisputes.map((disp) => {
                                    const badge = getStatusBadge(disp.status);
                                    const BadgeIcon = badge.icon;
                                    const refNumber = disp.dispute_number || disp.reference_id || `#${disp.id.slice(-8)}`;

                                    return (
                                        <tr key={disp.id} className="hover:bg-gray-50/70 transition">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="font-mono text-xs font-bold text-gray-900">{refNumber}</span>
                                                    <span className="text-[11px] text-gray-400">{formatDate(disp.created_at)}</span>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-gray-900 truncate max-w-[180px]">
                                                        {disp.user_name || 'Customer'}
                                                    </span>
                                                    {disp.user_email ? (
                                                        <span className="text-[11px] text-gray-500 truncate max-w-[180px]">
                                                            {disp.user_email}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[11px] text-gray-400 italic">No email</span>
                                                    )}
                                                    <div className="flex items-center gap-1.5 font-mono text-[10px] text-gray-400 mt-0.5">
                                                        <span>User: #{disp.user_id.slice(-6)}</span>
                                                        <span>•</span>
                                                        <span>Tx: #{disp.transaction_id.slice(-6)}</span>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 max-w-xs">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-gray-900">{getReasonLabel(disp.reason)}</span>
                                                    <p className="text-[11px] text-gray-500 truncate max-w-xs mt-0.5" title={disp.description}>
                                                        {disp.description}
                                                    </p>
                                                    {disp.admin_notes && (
                                                        <span className="text-[10px] text-purple-700 font-medium mt-1 truncate">
                                                            Note: {disp.admin_notes}
                                                        </span>
                                                    )}
                                                </div>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm font-black font-mono text-gray-900">
                                                    {formatCurrency(disp.amount)}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.bg}`}>
                                                    <BadgeIcon size={12} />
                                                    <span>{badge.label}</span>
                                                </span>
                                            </td>

                                            <td className="px-6 py-4 whitespace-nowrap text-right text-xs">
                                                <button
                                                    onClick={() => openResolveModal(disp)}
                                                    className="px-3 py-1.5 rounded-xl bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold border border-purple-200 transition cursor-pointer active:scale-95"
                                                >
                                                    {disp.status === 'pending' || disp.status === 'under_review' ? 'Resolve' : 'View Details'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                        <span>Showing page <strong>{page}</strong> of <strong>{totalPages}</strong></span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page <= 1 || loading}
                                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                disabled={page >= totalPages || loading}
                                className="p-2 border border-gray-200 rounded-xl hover:bg-gray-50 disabled:opacity-40 cursor-pointer"
                            >
                                <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Resolve Modal */}
            {selectedDispute && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-start">
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <ShieldAlert className="text-purple-600 w-5 h-5" />
                                    <span>Resolve Dispute {selectedDispute.dispute_number}</span>
                                </h3>
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Submitted {formatDate(selectedDispute.created_at)}
                                </p>
                            </div>
                            <button onClick={closeResolveModal} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                                <X size={18} />
                            </button>
                        </div>

                        {/* Summary Details */}
                        <div className="p-4 bg-gray-50 rounded-2xl border border-gray-100 space-y-2 text-xs">
                            <div className="flex justify-between">
                                <span className="text-gray-500">Claimed Amount:</span>
                                <span className="font-mono font-bold text-gray-900 text-sm">{formatCurrency(selectedDispute.amount)}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Reason:</span>
                                <span className="font-semibold text-gray-800">{getReasonLabel(selectedDispute.reason)}</span>
                            </div>
                            <div className="flex justify-between items-start">
                                <span className="text-gray-500">Customer:</span>
                                <div className="text-right">
                                    <span className="font-semibold text-gray-900 block">{selectedDispute.user_name || 'Customer'}</span>
                                    {selectedDispute.user_email && (
                                        <span className="text-gray-500 text-[11px] block">{selectedDispute.user_email}</span>
                                    )}
                                    <span className="font-mono text-gray-400 text-[10px]">User ID: #{selectedDispute.user_id.slice(-6)}</span>
                                </div>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">Transaction ID:</span>
                                <span className="font-mono text-gray-600">{selectedDispute.transaction_id}</span>
                            </div>
                            <div className="pt-2 border-t border-gray-200">
                                <span className="text-gray-500 block mb-1 font-semibold">User Statement:</span>
                                <p className="text-gray-700 bg-white p-2.5 rounded-xl border border-gray-200 leading-relaxed font-normal">
                                    {selectedDispute.description}
                                </p>
                            </div>
                        </div>

                        {/* Already resolved notice if not pending/under_review */}
                        {selectedDispute.status === 'approved' || selectedDispute.status === 'rejected' ? (
                            <div className={`p-4 rounded-2xl border text-xs space-y-1 ${
                                selectedDispute.status === 'approved'
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                                    : 'bg-rose-50 border-rose-200 text-rose-900'
                            }`}>
                                <p className="font-bold">
                                    This dispute has already been finalized as {selectedDispute.status.toUpperCase()}.
                                </p>
                                <p>Admin Note: {selectedDispute.admin_notes || 'None'}</p>
                                {(selectedDispute.refund_transaction_id || selectedDispute.refund_tx_id) && (
                                    <p className="font-mono text-[11px]">Refund Tx: #{selectedDispute.refund_transaction_id || selectedDispute.refund_tx_id}</p>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleResolveSubmit} className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        Select Resolution Decision
                                    </label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {[
                                            { key: 'approved', label: 'Approve & Refund', color: 'border-emerald-500 text-emerald-700 bg-emerald-50' },
                                            { key: 'under_review', label: 'Mark Under Review', color: 'border-blue-500 text-blue-700 bg-blue-50' },
                                            { key: 'rejected', label: 'Reject Dispute', color: 'border-rose-500 text-rose-700 bg-rose-50' },
                                        ].map((opt) => (
                                            <button
                                                key={opt.key}
                                                type="button"
                                                onClick={() => setResolveStatus(opt.key as any)}
                                                className={`p-2.5 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                                                    resolveStatus === opt.key 
                                                        ? opt.color + ' ring-2 ring-purple-600 shadow-xs' 
                                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {resolveStatus === 'approved' && (
                                    <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-[11px] text-emerald-900 flex items-start gap-2">
                                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                        <p>
                                            <strong>Automated Atomic Refund:</strong> Approving will immediately credit <strong>₹{selectedDispute.amount}</strong> to user&apos;s Main Balance and log a permanent ledger transaction.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-xs font-bold text-gray-700 mb-1.5">
                                        Admin Resolution Notes (Visible to Customer)
                                    </label>
                                    <textarea
                                        rows={3}
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        placeholder="Explain the rationale for this decision (e.g. Session logs confirmed absence. Full refund issued.)..."
                                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none"
                                        required
                                    />
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button
                                        type="button"
                                        onClick={closeResolveModal}
                                        disabled={isResolving}
                                        className="flex-1 py-3 rounded-2xl border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isResolving || !adminNotes.trim()}
                                        className={`flex-1 py-3 rounded-2xl text-white text-xs font-bold shadow-md cursor-pointer transition active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2 ${
                                            resolveStatus === 'approved' 
                                                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20' 
                                                : resolveStatus === 'rejected'
                                                ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/20'
                                                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                                        }`}
                                    >
                                        {isResolving ? (
                                            <>
                                                <RefreshCw size={14} className="animate-spin" />
                                                <span>Processing...</span>
                                            </>
                                        ) : (
                                            <span>Confirm Decision</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
