"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowsClockwiseIcon, CircleNotchIcon, ShieldWarningIcon, XIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { notify } from "@/lib/notify";
import Pagination from '@/components/ui/Pagination';
import { AdminPageHeader, AdminPanel, BadgeTone, EmptyState, FilterTabs, SearchInput, SkeletonRows, StatusBadge, btn, cx, field, table } from '@/components/admin/ui';

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
            notify.error(error, "Couldn't load disputes");
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

    const getReasonLabel = (reason?: string) => {
        if (!reason || !reason.trim()) return 'Dispute';
        // Dynamically format snake_case or display backend string directly
        if (reason.includes('_')) {
            return reason
                .split('_')
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ');
        }
        return reason.charAt(0).toUpperCase() + reason.slice(1);
    };

    const STATUS_META: Record<AdminDisputeItem['status'], { label: string; tone: BadgeTone }> = {
        pending: { label: 'Pending', tone: 'amber' },
        under_review: { label: 'Under review', tone: 'blue' },
        approved: { label: 'Refunded', tone: 'green' },
        rejected: { label: 'Rejected', tone: 'red' },
    };

    const openResolveModal = (disp: AdminDisputeItem) => {
        setSelectedDispute(disp);
        setResolveStatus('approved');
        setAdminNotes(disp.admin_notes || '');
    };

    const closeResolveModal = () => {
        if (isResolving) return;
        setSelectedDispute(null);
        setAdminNotes('');
    };

    const handleResolveSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedDispute || !adminNotes.trim()) return;

        setIsResolving(true);
        try {
            const action = resolveStatus === 'approved' ? 'approve' : 'reject';
            const res = await api.put<unknown, { message?: string }>(`/admin/disputes/${selectedDispute.id}/resolve`, {
                action,
                status: resolveStatus,
                admin_notes: adminNotes.trim(),
            });
            notify.success(res?.message || `Dispute marked ${STATUS_META[resolveStatus].label.toLowerCase()}`);
            setSelectedDispute(null);
            setAdminNotes('');
            fetchDisputes(page, statusFilter);
        } catch (error) {
            notify.error(error, "Couldn't save the decision");
        } finally {
            setIsResolving(false);
        }
    };

    // Search runs over the loaded page only; the API filters by status.
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

    const DECISIONS: { key: 'approved' | 'under_review' | 'rejected'; label: string }[] = [
        { key: 'approved', label: 'Approve and refund' },
        { key: 'under_review', label: 'Keep under review' },
        { key: 'rejected', label: 'Reject' },
    ];

    return (
        <div>
            <AdminPageHeader
                title="Wallet disputes"
                description="Review wallet disputes and approve refunds"
                actions={
                    <button type="button" onClick={() => fetchDisputes(page, statusFilter)} disabled={loading} className={btn.secondary}>
                        <ArrowsClockwiseIcon size={16} className={loading ? 'animate-spin' : ''} aria-hidden="true" />
                        Refresh
                    </button>
                }
            />

            <AdminPanel>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-5 py-4 border-b border-km-border-subtle">
                    <div className="overflow-x-auto -mx-1 px-1">
                        <FilterTabs
                            value={statusFilter}
                            onChange={handleFilterChange}
                            options={[
                                { value: 'all', label: 'All' },
                                { value: 'pending', label: 'Pending' },
                                { value: 'under_review', label: 'Under review' },
                                { value: 'approved', label: 'Refunded' },
                                { value: 'rejected', label: 'Rejected' },
                            ]}
                        />
                    </div>
                    <div className="flex items-center gap-3">
                        <SearchInput value={searchQuery} onChange={setSearchQuery} placeholder="Search disputes" className="w-full lg:w-80" />
                        {!loading && <span className="hidden sm:inline shrink-0 text-sm text-km-text-secondary font-inter">{totalCount} total</span>}
                    </div>
                </div>

                {loading ? (
                    <SkeletonRows rows={6} />
                ) : filteredDisputes.length === 0 ? (
                    <EmptyState
                        icon={ShieldWarningIcon}
                        title={searchQuery.trim() ? 'No matching disputes' : 'No disputes'}
                        description={searchQuery.trim() ? 'Try a different search.' : 'Disputes people raise from their wallet appear here.'}
                    />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Dispute</th>
                                    <th className={table.th}>Customer</th>
                                    <th className={table.th}>Reason</th>
                                    <th className={`${table.th} text-right`}>Amount</th>
                                    <th className={table.th}>Status</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredDisputes.map((disp) => {
                                    const meta = STATUS_META[disp.status] || { label: disp.status, tone: 'neutral' as BadgeTone };
                                    const open = disp.status === 'pending' || disp.status === 'under_review';
                                    return (
                                        <tr key={disp.id} className={table.row}>
                                            <td className={`${table.td} whitespace-nowrap`}>
                                                <p className="font-medium text-km-heading font-inter">{disp.dispute_number || disp.reference_id || `#${disp.id.slice(-8)}`}</p>
                                                <p className="text-xs text-km-text-secondary font-inter">{formatDate(disp.created_at)}</p>
                                            </td>
                                            <td className={table.td}>
                                                <p className="font-medium text-km-heading truncate max-w-[200px]">{disp.user_name || 'Customer'}</p>
                                                {disp.user_email && <p className="text-xs text-km-text-secondary truncate max-w-[200px]">{disp.user_email}</p>}
                                            </td>
                                            <td className={`${table.td} max-w-xs`}>
                                                <p className="font-medium text-km-heading">{getReasonLabel(disp.reason)}</p>
                                                {disp.description && (
                                                    <p className="text-xs text-km-text-secondary truncate" title={disp.description}>{disp.description}</p>
                                                )}
                                            </td>
                                            <td className={`${table.td} text-right whitespace-nowrap font-medium text-km-heading font-inter tabular-nums`}>
                                                {formatCurrency(disp.amount)}
                                            </td>
                                            <td className={table.td}><StatusBadge tone={meta.tone}>{meta.label}</StatusBadge></td>
                                            <td className={`${table.td} text-right`}>
                                                <button type="button" onClick={() => openResolveModal(disp)} className={`${open ? btn.primary : btn.secondary} h-9 px-3`}>
                                                    {open ? 'Resolve' : 'View'}
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {totalPages > 1 && (
                    <div className="flex justify-center px-5 py-4 border-t border-km-border-subtle">
                        <Pagination current={page} total={totalPages} onPageChange={setPage} />
                    </div>
                )}
            </AdminPanel>

            {selectedDispute && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeResolveModal}>
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="dispute-title"
                        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-km-surface-raised rounded-2xl border border-km-border shadow-lg"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-start justify-between gap-4 px-6 pt-6">
                            <div>
                                <h2 id="dispute-title" className="text-base font-semibold text-km-heading">
                                    Dispute {selectedDispute.dispute_number || selectedDispute.reference_id || `#${selectedDispute.id.slice(-8)}`}
                                </h2>
                                <p className="text-xs text-km-text-secondary mt-0.5 font-inter">Raised {formatDate(selectedDispute.created_at)}</p>
                            </div>
                            <button type="button" onClick={closeResolveModal} className={btn.icon} aria-label="Close">
                                <XIcon size={18} aria-hidden="true" />
                            </button>
                        </div>

                        <dl className="mx-6 mt-4 rounded-xl border border-km-border-subtle divide-y divide-km-border-subtle text-sm">
                            {[
                                ['Amount', <span key="a" className="font-medium text-km-heading font-inter">{formatCurrency(selectedDispute.amount)}</span>],
                                ['Reason', getReasonLabel(selectedDispute.reason)],
                                ['Customer', [selectedDispute.user_name || 'Customer', selectedDispute.user_email].filter(Boolean).join(' · ')],
                                ['Transaction', <span key="t" className="font-inter break-all">{selectedDispute.transaction_id}</span>],
                            ].map(([label, value]) => (
                                <div key={label as string} className="flex justify-between gap-4 px-4 py-2.5">
                                    <dt className="text-km-text-secondary shrink-0">{label}</dt>
                                    <dd className="text-right text-km-text-primary">{value}</dd>
                                </div>
                            ))}
                        </dl>

                        <div className="mx-6 mt-4">
                            <p className={field.label}>What the customer said</p>
                            <p className="text-sm text-km-text-primary leading-relaxed whitespace-pre-line">{selectedDispute.description || 'No details given.'}</p>
                        </div>

                        {selectedDispute.status === 'approved' || selectedDispute.status === 'rejected' ? (
                            <div className="m-6 rounded-xl border border-km-border-subtle bg-km-surface p-4 text-sm space-y-1.5">
                                <div className="flex items-center gap-2">
                                    <StatusBadge tone={STATUS_META[selectedDispute.status].tone}>{STATUS_META[selectedDispute.status].label}</StatusBadge>
                                    {selectedDispute.resolved_at && <span className="text-xs text-km-text-secondary font-inter">{formatDate(selectedDispute.resolved_at)}</span>}
                                </div>
                                <p className="text-km-text-primary">{selectedDispute.admin_notes || 'No note was left.'}</p>
                                {(selectedDispute.refund_transaction_id || selectedDispute.refund_tx_id) && (
                                    <p className="text-xs text-km-text-secondary font-inter">Refund transaction {selectedDispute.refund_transaction_id || selectedDispute.refund_tx_id}</p>
                                )}
                            </div>
                        ) : (
                            <form onSubmit={handleResolveSubmit} className="p-6 space-y-4">
                                <fieldset>
                                    <legend className={field.label}>Decision</legend>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                        {DECISIONS.map((opt) => (
                                            <label
                                                key={opt.key}
                                                className={cx(
                                                    'flex items-center justify-center h-10 px-3 rounded-xl border text-sm font-medium cursor-pointer transition-colors',
                                                    resolveStatus === opt.key
                                                        ? 'border-km-blue bg-blue-50 text-km-link'
                                                        : 'border-km-border text-km-text-secondary hover:bg-km-surface',
                                                )}
                                            >
                                                <input
                                                    type="radio"
                                                    name="decision"
                                                    value={opt.key}
                                                    checked={resolveStatus === opt.key}
                                                    onChange={() => setResolveStatus(opt.key)}
                                                    className="sr-only"
                                                />
                                                {opt.label}
                                            </label>
                                        ))}
                                    </div>
                                    {resolveStatus === 'approved' && (
                                        <p className={field.hint}>
                                            {formatCurrency(selectedDispute.amount)} goes back to the customer&apos;s wallet straight away.
                                        </p>
                                    )}
                                </fieldset>

                                <label className="block">
                                    <span className={field.label}>Note to the customer</span>
                                    <textarea
                                        rows={3}
                                        value={adminNotes}
                                        onChange={(e) => setAdminNotes(e.target.value)}
                                        placeholder="For example: the session logs show the expert didn't join, so we've refunded you"
                                        className={field.textarea}
                                        required
                                    />
                                </label>

                                <div className="flex justify-end gap-2 pt-2">
                                    <button type="button" onClick={closeResolveModal} disabled={isResolving} className={btn.secondary}>
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={isResolving || !adminNotes.trim()}
                                        className={resolveStatus === 'rejected' ? btn.danger : btn.primary}
                                    >
                                        {isResolving && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                        {resolveStatus === 'approved' ? 'Refund' : resolveStatus === 'rejected' ? 'Reject dispute' : 'Save'}
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
