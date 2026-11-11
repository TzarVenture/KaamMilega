'use client';

import React, { useState } from 'react';
import { CircleNotchIcon } from '@phosphor-icons/react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';
import { inr } from '@/lib/money';
import { AdminModal, btn, field } from '@/components/admin/ui';
import { TransactionItem } from './WalletTransactionsList';

const REASONS = ['service_not_provided', 'session_cancelled', 'duplicate_charge', 'technical_failure', 'dissatisfied', 'other'];
const MIN_DETAILS = 10;

interface Props {
    transaction: TransactionItem | null;
    onClose: () => void;
    onCreated: () => void;
}

export default function WalletDisputeModal({ transaction, onClose, onCreated }: Props) {
    const t = useTranslations('walletPage');
    const [reason, setReason] = useState(REASONS[0]);
    const [description, setDescription] = useState('');
    const [busy, setBusy] = useState(false);

    const details = description.trim();

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!transaction || details.length < MIN_DETAILS || busy) return;
        setBusy(true);
        try {
            await api.post('/wallet/disputes', { transaction_id: transaction.id, reason, description: details });
            notify.success(t('disputeSubmitted'));
            setDescription('');
            setReason(REASONS[0]);
            onCreated();
            onClose();
        } catch (err) {
            notify.error(err, t('disputeFailed'));
        } finally {
            setBusy(false);
        }
    };

    return (
        <AdminModal isOpen={!!transaction} onClose={() => !busy && onClose()} title={t('requestRefund')}>
            {transaction && (
                <form onSubmit={submit} className="space-y-4">
                    <div className="flex items-start justify-between gap-4 text-sm">
                        <span className="text-km-text-primary min-w-0">{transaction.description}</span>
                        <span className="font-semibold text-km-heading font-inter tabular-nums shrink-0">{inr(transaction.amount)}</span>
                    </div>

                    <label className="block">
                        <span className={field.label}>{t('disputeReasonLabel')}</span>
                        <select value={reason} onChange={(e) => setReason(e.target.value)} className={field.input}>
                            {REASONS.map((value) => <option key={value} value={value}>{t(`disputeReason.${value}`)}</option>)}
                        </select>
                    </label>

                    <label className="block">
                        <span className={field.label}>{t('disputeDetails')}</span>
                        <textarea rows={4} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} className={field.textarea} />
                        <span className={field.hint}>{t('disputeDetailsHint')}</span>
                    </label>

                    <p className="text-sm text-km-text-secondary">{t('disputeNote')}</p>

                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} disabled={busy} className={btn.secondary}>{t('cancel')}</button>
                        <button type="submit" disabled={busy || details.length < MIN_DETAILS} className={btn.primary}>
                            {busy && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                            {t('disputeSubmit')}
                        </button>
                    </div>
                </form>
            )}
        </AdminModal>
    );
}
