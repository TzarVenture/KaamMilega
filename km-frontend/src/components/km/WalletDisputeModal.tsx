"use client";

import React, { useState } from 'react';
import { 
    AlertCircle, 
    X, 
    ShieldAlert, 
    CheckCircle2, 
    FileText, 
    HelpCircle,
    ReceiptText,
    RefreshCw
} from 'lucide-react';
import api from '@/lib/axios';
import { toast } from 'react-toastify';
import { TransactionItem } from './WalletTransactionsList';

interface WalletDisputeModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: TransactionItem | null;
    onDisputeCreated: () => void;
}

const REASONS = [
    { value: 'service_not_provided', label: 'Service / Mentorship Not Delivered', desc: 'The session did not take place or mentor was absent' },
    { value: 'session_cancelled', label: 'Session Cancelled', desc: 'The scheduled session or booking was cancelled' },
    { value: 'duplicate_charge', label: 'Duplicate Deduction', desc: 'The transaction was deducted multiple times' },
    { value: 'technical_failure', label: 'Technical Failure', desc: 'Technical issues or platform disconnection prevented delivery' },
    { value: 'dissatisfied', label: 'Quality / Dissatisfied', desc: 'Quality did not meet standards or requirements agreed upon' },
    { value: 'other', label: 'Other Reason', desc: 'Any other issue requiring refund or review' },
];

export default function WalletDisputeModal({
    isOpen,
    onClose,
    transaction,
    onDisputeCreated,
}: WalletDisputeModalProps) {
    const [reason, setReason] = useState('service_not_provided');
    const [description, setDescription] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen || !transaction) return null;

    const formatCurrency = (amt: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2,
        }).format(amt);
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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!description.trim() || description.trim().length < 10) {
            toast.error("Please provide at least 10 characters explaining your dispute");
            return;
        }

        setIsSubmitting(true);
        try {
            await api.post('/wallet/disputes', {
                transaction_id: transaction.id,
                reason,
                description: description.trim(),
            });

            toast.success("Dispute submitted successfully! Our compliance team will review it.");
            setDescription('');
            setReason('service_not_provided');
            onDisputeCreated();
            onClose();
        } catch (error: any) {
            console.error("Dispute filing error", error);
            toast.error(error?.response?.data?.error || "Failed to submit dispute. Please check your transaction details.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-700 border border-amber-100">
                            <ShieldAlert className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-900">
                                Request Refund / Raise Dispute
                            </h3>
                            <p className="text-xs text-slate-500 font-medium mt-0.5">
                                Reference #{transaction.id.slice(-8)}
                            </p>
                        </div>
                    </div>
                    <button 
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 transition cursor-pointer disabled:opacity-50"
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Transaction Summary Card */}
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2.5">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-500">Transaction</span>
                        <span className="text-sm font-black font-mono text-slate-900">
                            {formatCurrency(transaction.amount)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Description</span>
                        <span className="font-medium text-slate-800 text-right max-w-[200px] truncate">
                            {transaction.description || transaction.category}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Date & Time</span>
                        <span className="font-mono text-slate-500">{formatDate(transaction.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-600">
                        <span>Balance Debited</span>
                        <span className="capitalize font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                            {transaction.target_balance} Balance
                        </span>
                    </div>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <HelpCircle size={13} className="text-slate-400" />
                            <span>Reason for Dispute</span>
                        </label>
                        <select
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 cursor-pointer"
                        >
                            {REASONS.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                        <p className="text-[11px] text-slate-400 mt-1 pl-1">
                            {REASONS.find(r => r.value === reason)?.desc}
                        </p>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
                            <FileText size={13} className="text-slate-400" />
                            <span>Detailed Explanation</span>
                        </label>
                        <textarea
                            rows={4}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Please describe what happened, dates, mentor name, or evidence supporting your refund request..."
                            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-600 resize-none"
                            minLength={10}
                            maxLength={1000}
                        />
                        <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1 px-1">
                            <span>Minimum 10 characters required</span>
                            <span>{description.length}/1000</span>
                        </div>
                    </div>

                    {/* Policy Disclaimer */}
                    <div className="p-3 bg-amber-50/70 border border-amber-200/70 rounded-2xl flex items-start gap-2.5">
                        <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-[11px] text-amber-800 leading-relaxed font-medium">
                            Disputes are thoroughly investigated by platform admins within <strong>24 to 48 hours</strong>. Upon approval, funds are immediately credited back to your <strong>Main Balance</strong>.
                        </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 py-3 rounded-2xl border border-slate-200 font-bold text-xs text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || description.trim().length < 10}
                            className="flex-1 py-3 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/20 cursor-pointer active:scale-95 disabled:opacity-60 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <RefreshCw size={14} className="animate-spin" />
                                    <span>Submitting...</span>
                                </>
                            ) : (
                                <span>Submit Dispute</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
