'use client';

import React, { useState } from 'react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import { FileText, ChevronRight, CheckCircle2, XCircle, ShieldCheck, Building2, Loader2 } from 'lucide-react';

interface DocumentsListModalProps {
    isOpen: boolean;
    onClose: () => void;
    companyId?: string;
    companyName: string;
    companyGst?: string;
    status?: string;
    documents: { id: string; name: string; url: string }[];
    onViewDocument: (doc: { name: string; url: string }) => void;
    onUpdateStatus?: (companyId: string, status: 'verified' | 'rejected') => Promise<void>;
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

    const handleAction = async (newStatus: 'verified' | 'rejected') => {
        if (!companyId || !onUpdateStatus) return;
        setIsUpdating(true);
        try {
            await onUpdateStatus(companyId, newStatus);
            onClose();
        } catch (error) {
            console.error('Failed to update company verification status:', error);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <ModalWrapper
            isOpen={isOpen}
            onClose={onClose}
            title={`Company Verification — ${companyName}`}
        >
            {/* Company Metadata Header */}
            <div className="bg-purple-50/60 border border-purple-100/80 rounded-2xl p-4 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-600 text-white rounded-xl flex items-center justify-center font-bold shrink-0">
                        <Building2 size={20} />
                    </div>
                    <div>
                        <h4 className="font-bold text-slate-900 text-sm">{companyName || 'Unnamed Company'}</h4>
                        {companyGst && (
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                GST: <span className="font-mono font-bold text-slate-700">{companyGst}</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="self-end sm:self-center">
                    {status === 'verified' && (
                        <span className="px-3 py-1 text-xs font-bold text-emerald-700 bg-emerald-100 border border-emerald-200 rounded-full flex items-center gap-1">
                            <CheckCircle2 size={13} /> Verified
                        </span>
                    )}
                    {status === 'pending' && (
                        <span className="px-3 py-1 text-xs font-bold text-amber-700 bg-amber-100 border border-amber-200 rounded-full flex items-center gap-1">
                            <ShieldCheck size={13} /> Pending Review
                        </span>
                    )}
                    {status === 'rejected' && (
                        <span className="px-3 py-1 text-xs font-bold text-rose-700 bg-rose-100 border border-rose-200 rounded-full flex items-center gap-1">
                            <XCircle size={13} /> Rejected
                        </span>
                    )}
                </div>
            </div>

            {/* Documents Section */}
            <div className="space-y-3">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Submitted Verification Documents</p>
                {documents.length === 0 ? (
                    <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <FileText size={28} className="mx-auto text-slate-400 mb-2" />
                        <p className="text-sm font-medium text-slate-500">No documents uploaded by recruiter.</p>
                    </div>
                ) : (
                    documents.map((doc) => (
                        <button
                            key={doc.id}
                            type="button"
                            onClick={() => onViewDocument(doc)}
                            className="w-full flex items-center justify-between p-4 bg-slate-50/80 hover:bg-purple-50 rounded-2xl transition-all group border border-slate-100 hover:border-purple-200"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-purple-600 shadow-sm border border-slate-100 group-hover:scale-105 transition-transform">
                                    <FileText size={20} />
                                </div>
                                <div className="text-left">
                                    <span className="font-bold text-slate-800 text-sm block">{doc.name || 'Document'}</span>
                                    <span className="text-[11px] text-purple-600 font-semibold group-hover:underline">Click to view document &rarr;</span>
                                </div>
                            </div>
                            <ChevronRight size={18} className="text-slate-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
                        </button>
                    ))
                )}
            </div>

            {/* Verification Actions Footer */}
            {onUpdateStatus && companyId && (
                <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-end gap-3">
                    <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleAction('rejected')}
                        className="w-full sm:w-auto px-6 py-2.5 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        <XCircle size={16} />
                        <span>Reject Application</span>
                    </button>
                    <button
                        type="button"
                        disabled={isUpdating}
                        onClick={() => handleAction('verified')}
                        className="w-full sm:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isUpdating ? (
                            <>
                                <Loader2 size={16} className="animate-spin" />
                                <span>Updating...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 size={16} />
                                <span>Approve & Verify Company</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </ModalWrapper>
    );
};

export default DocumentsListModal;
