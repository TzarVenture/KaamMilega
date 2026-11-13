'use client';

import React, { useState } from 'react';
import { AdminModal, btn } from '@/components/admin/ui';
import { BuildingOfficeIcon, CaretRightIcon, CheckCircleIcon, CircleNotchIcon, FileTextIcon, ShieldCheckIcon, XCircleIcon } from '@phosphor-icons/react';
import { notify } from "@/lib/notify";

interface DocumentsListModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId?: string;
    companyName: string;
    companyGst?: string;
    status?: string;
    documents: { id: string; name: string; url: string }[];
    onViewDocument: (doc: { name: string; url: string }) => void;
    onUpdateStatus?: (companyId: string, status: 'verified' | 'rejected' | 'pending' | 'no_appeal') => Promise<void>;
}

const DocumentsListModal = ({
    isOpen,
    onClose,
    companyId,
    companyName,
    companyGst,
    status = 'pending',
    documents,
    onViewDocument,
    onUpdateStatus,
}: DocumentsListModalProps) => {
    const [isUpdating, setIsUpdating] = useState(false);

    const handleAction = async (newStatus: 'verified' | 'rejected' | 'pending' | 'no_appeal') => {
        if (!companyId || !onUpdateStatus) return;
        setIsUpdating(true);
        try {
            await onUpdateStatus(companyId, newStatus);
            onClose();
        } catch (error) {
            console.error('Failed to update company verification status:', error);
            notify.error(error, "The verification status couldn’t be updated.");
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <AdminModal
            isOpen={isOpen}
            onClose={onClose}
            title={`Verification documents, ${companyName}`}
        >
            {/* Company Metadata Header */}
            <div className="bg-km-surface border border-km-border rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-km-primary text-white rounded-xl flex items-center justify-center font-bold shrink-0">
                        <BuildingOfficeIcon size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-km-heading text-sm">{companyName || 'Unnamed company'}</h4>
                        {companyGst && (
                            <p className="text-xs text-km-text-secondary font-medium mt-0.5">
                                GST: <span className="font-inter font-bold text-km-text-secondary">{companyGst}</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="self-end sm:self-center">
                    {status === 'verified' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full whitespace-nowrap shrink-0">
                            <CheckCircleIcon weight="bold" size={13} /> Verified
                        </span>
                    )}
                    {status === 'pending' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full whitespace-nowrap shrink-0">
                            <ShieldCheckIcon weight="bold" size={13} /> Pending Review
                        </span>
                    )}
                    {status === 'rejected' && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-red-700 bg-red-100 border border-red-200 rounded-full whitespace-nowrap shrink-0">
                            <XCircleIcon weight="bold" size={13} /> Rejected
                        </span>
                    )}
                    {(status === 'no_appeal' || !status) && (
                        <span className="inline-flex items-center gap-1 px-3 py-1 text-xs font-bold text-km-text-secondary bg-km-surface border border-km-border rounded-full whitespace-nowrap shrink-0">
                            No appeal
                        </span>
                    )}
                </div>
            </div>

            {/* Documents Section */}
            <div className="space-y-3">
                <p className="text-xs font-bold text-km-text-muted">Submitted verification documents</p>
                {documents.length === 0 ? (
                    <div className="text-center py-8 bg-km-surface rounded-2xl border border-dashed border-km-border">
                        <FileTextIcon size={28} className="mx-auto text-km-text-muted mb-2" />
                        <p className="text-sm font-medium text-km-text-secondary">No documents uploaded by recruiter.</p>
                        <p className="text-xs text-km-text-muted mt-1">This recruiter registered without submitting business verification files.</p>
                    </div>
                ) : (
                    documents.map((doc) => (
                        <button
                            key={doc.id}
                            type="button"
                            onClick={() => onViewDocument(doc)}
                            className="w-full flex items-center justify-between p-4 bg-km-surface hover:bg-km-surface rounded-2xl transition-all group border border-km-border-subtle hover:border-km-border"
                        >
                            <div className="flex items-center gap-3">
                                <FileTextIcon size={24} weight="duotone" className="text-km-link" aria-hidden="true" />
                                <div className="text-left">
                                    <span className="font-bold text-km-heading text-sm block">{doc.name || 'Document'}</span>
                                    <span className="text-xs text-km-link font-semibold group-hover:underline">Click to view document &rarr;</span>
                                </div>
                            </div>
                            <CaretRightIcon weight="bold" size={18} className="text-km-text-muted group-hover:text-km-link transition-all" />
                        </button>
                    ))
                )}
            </div>

            {/* Verification Actions Footer */}
            {onUpdateStatus && companyId && (
                <div className="mt-8 pt-6 border-t border-km-border-subtle flex flex-wrap items-center justify-end gap-3">
                    {(status === 'verified' || status === 'rejected') && (
                        <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleAction(documents.length > 0 ? 'pending' : 'no_appeal')}
                            className="w-full sm:w-auto px-5 py-2.5 border border-km-border text-km-link hover:bg-km-surface rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                        >
                            Undo to {documents.length > 0 ? 'Pending' : 'No appeal'}
                        </button>
                    )}
                    {status !== 'rejected' && (
                        <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleAction('rejected')}
                            className="w-full sm:w-auto px-6 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <XCircleIcon weight="bold" size={16} />
                            <span>Reject application</span>
                        </button>
                    )}
                    {status !== 'verified' && (
                        <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleAction('verified')}
                            className={btn.primary}
                        >
                            {isUpdating ? (
                                <>
                                    <CircleNotchIcon weight="bold" size={16} className="animate-spin" />
                                    <span>Saving</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircleIcon weight="bold" size={16} />
                                    <span>Approve & verify company</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}
        </AdminModal>
    );
};

export default DocumentsListModal;
