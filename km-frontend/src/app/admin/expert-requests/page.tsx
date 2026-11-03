"use client";

import { useCallback, useEffect, useState } from "react";
import { notify } from "@/lib/notify";
import api from "@/lib/axios";
import { CheckIcon, IdentificationBadgeIcon, XIcon } from '@phosphor-icons/react';
import FileLink from '@/components/ui/FileLink';
import { AdminPageHeader, AdminPanel, EmptyState, SkeletonRows, btn, field, table } from '@/components/admin/ui';

interface ExpertRequest {
    id: string;
    name?: string;
    mobile?: string;
    email?: string;
    expert_category?: string;
    expert_pricing?: number;
    expert_documents?: { name: string; url: string }[];
    expert_kyc?: {
        aadhaar_last4?: string;
        pan_masked?: string;
        payout_method?: string;
        account_holder?: string;
        account_last4?: string;
        ifsc?: string;
        upi_id?: string;
    };
}

export default function ExpertRequestsPage() {
    const [requests, setRequests] = useState<ExpertRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [rejecting, setRejecting] = useState<ExpertRequest | null>(null);
    const [reason, setReason] = useState('');

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await api.get<unknown, ExpertRequest[]>("/admin/expert-requests");
            setRequests(res || []);
        } catch (error) {
            notify.error(error, "Couldn't load expert requests");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const decide = async (req: ExpertRequest, status: 'approved' | 'rejected', why = '') => {
        setBusyId(req.id);
        try {
            await api.put(`/admin/experts/${req.id}/approve`, { status, reason: why });
            notify.success(status === 'approved' ? `${req.name || 'Expert'} approved` : `${req.name || 'Request'} rejected`);
            setRejecting(null);
            setReason('');
            setRequests((prev) => prev.filter((r) => r.id !== req.id));
        } catch (error) {
            notify.error(error, "Couldn't save the decision");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <div>
            <AdminPageHeader title="Expert requests" description="Review mentor applications, documents and payout details" />

            <AdminPanel>
                {loading ? (
                    <SkeletonRows rows={4} />
                ) : requests.length === 0 ? (
                    <EmptyState icon={IdentificationBadgeIcon} title="No pending requests" description="New expert applications appear here for review." />
                ) : (
                    <div className={table.wrap}>
                        <table className={table.table}>
                            <thead>
                                <tr>
                                    <th className={table.th}>Applicant</th>
                                    <th className={table.th}>Category</th>
                                    <th className={table.th}>Price</th>
                                    <th className={table.th}>Documents and KYC</th>
                                    <th className={`${table.th} text-right`}><span className="sr-only">Decision</span></th>
                                </tr>
                            </thead>
                            <tbody>
                                {requests.map((req) => (
                                    <tr key={req.id} className={table.row}>
                                        <td className={table.td}>
                                            <p className="font-medium text-km-heading">{req.name || req.mobile}</p>
                                            {req.email && <p className="text-xs text-km-text-secondary">{req.email}</p>}
                                        </td>
                                        <td className={table.td}>{req.expert_category || '–'}</td>
                                        <td className={`${table.td} whitespace-nowrap font-inter`}>₹{req.expert_pricing ?? 0} per session</td>
                                        <td className={table.td}>
                                            <div className="flex flex-col gap-1">
                                                {req.expert_documents?.map((doc, i) => (
                                                    <FileLink key={i} href={doc.url} className="text-sm text-km-link hover:underline">{doc.name}</FileLink>
                                                ))}
                                                {req.expert_kyc && (
                                                    <span className="text-xs text-km-text-secondary">
                                                        Aadhaar …{req.expert_kyc.aadhaar_last4} · PAN {req.expert_kyc.pan_masked} ·{' '}
                                                        {req.expert_kyc.payout_method === 'bank'
                                                            ? `${req.expert_kyc.account_holder}, a/c …${req.expert_kyc.account_last4}, ${req.expert_kyc.ifsc}`
                                                            : `${req.expert_kyc.account_holder}, UPI ${req.expert_kyc.upi_id}`}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className={`${table.td} text-right whitespace-nowrap`}>
                                            <div className="inline-flex gap-2">
                                                <button type="button" onClick={() => { setRejecting(req); setReason(''); }} disabled={busyId === req.id} className={`${btn.secondary} h-9 px-3`}>
                                                    <XIcon size={16} aria-hidden="true" />
                                                    Reject
                                                </button>
                                                <button type="button" onClick={() => decide(req, 'approved')} disabled={busyId === req.id} className={`${btn.primary} h-9 px-3`}>
                                                    <CheckIcon size={16} aria-hidden="true" />
                                                    Approve
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </AdminPanel>

            {rejecting && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => busyId === null && setRejecting(null)}>
                    <form
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="reject-title"
                        className="w-full max-w-md bg-km-surface-raised rounded-2xl border border-km-border shadow-lg p-6"
                        onClick={(e) => e.stopPropagation()}
                        onSubmit={(e) => { e.preventDefault(); if (reason.trim()) decide(rejecting, 'rejected', reason.trim()); }}
                    >
                        <h2 id="reject-title" className="text-base font-semibold text-km-heading">Reject {rejecting.name || 'this request'}?</h2>
                        <label className="block mt-4">
                            <span className={field.label}>Reason</span>
                            <textarea
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                rows={3}
                                autoFocus
                                required
                                className={field.textarea}
                                placeholder="For example: the PAN card image is unreadable"
                            />
                            <span className={field.hint}>The applicant sees this and can fix their application.</span>
                        </label>
                        <div className="mt-6 flex justify-end gap-2">
                            <button type="button" onClick={() => setRejecting(null)} disabled={busyId !== null} className={btn.secondary}>Cancel</button>
                            <button type="submit" disabled={busyId !== null || !reason.trim()} className={btn.danger}>Reject request</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
