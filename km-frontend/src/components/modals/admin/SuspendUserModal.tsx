'use client';

import { useRef, useState } from 'react';
import { AdminModal, btn, cx, field } from '@/components/admin/ui';
import api from '@/lib/axios';
import { notify } from '@/lib/notify';

const DURATIONS = [
    { days: 1, label: '1 day' },
    { days: 7, label: '7 days' },
    { days: 30, label: '30 days' },
    { days: 0, label: 'Permanent ban' },
];

const MIN_REASON = 10;

/** Suspends or bans a member. They are signed out and see the reason when they try to sign in. */
export default function SuspendUserModal({ user, onClose, onDone }: {
    user: { id: string; name: string } | null;
    onClose: () => void;
    onDone: (result: { suspended_until: string | null; reason: string }) => void;
}) {
    const [reason, setReason] = useState('');
    const [days, setDays] = useState(7);
    const [busy, setBusy] = useState(false);
    // Shown once they try to submit without enough reason, instead of a silently disabled button
    const [showReasonError, setShowReasonError] = useState(false);
    const reasonRef = useRef<HTMLTextAreaElement>(null);
    const reasonLength = reason.trim().length;
    const tooShort = reasonLength < MIN_REASON;

    const close = () => {
        if (busy) return;
        setShowReasonError(false);
        setReason('');
        setDays(7);
        onClose();
    };

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;
        if (tooShort) {
            setShowReasonError(true);
            reasonRef.current?.focus();
            return;
        }
        setBusy(true);
        try {
            const res = (await api.post(`/admin/users/${user.id}/suspend`, { reason: reason.trim(), days })) as { suspended_until: string | null };
            notify.success(days ? `${user.name} is suspended for ${DURATIONS.find(d => d.days === days)?.label}` : `${user.name} is banned`);
            onDone({ suspended_until: res?.suspended_until ?? null, reason: reason.trim() });
            setReason('');
            setDays(7);
        } catch (error) {
            notify.error(error, "Couldn't suspend this account");
        } finally {
            setBusy(false);
        }
    };

    return (
        <AdminModal isOpen={!!user} onClose={close} title={`Suspend ${user?.name ?? ''}`}>
            <form onSubmit={submit} className="space-y-5">
                <p className="text-sm text-km-text-secondary">
                    They are signed out at once. Their profile and job posts are hidden until the suspension ends.
                    They get an email with the reason.
                </p>

                <fieldset>
                    <legend className={field.label}>How long</legend>
                    <div className="grid grid-cols-2 gap-2">
                        {DURATIONS.map((d) => (
                            <label
                                key={d.days}
                                className={cx(
                                    'flex items-center gap-2 h-10 px-3 rounded-xl border text-sm cursor-pointer',
                                    days === d.days ? 'border-km-blue bg-km-blue/5 text-km-heading font-medium' : 'border-km-border text-km-text-primary hover:bg-km-surface',
                                )}
                            >
                                <input type="radio" name="days" checked={days === d.days} onChange={() => setDays(d.days)} className="accent-km-blue" />
                                {d.label}
                            </label>
                        ))}
                    </div>
                </fieldset>

                <div>
                    <label htmlFor="suspend-reason" className={field.label}>Reason they will see</label>
                    <textarea
                        id="suspend-reason"
                        rows={3}
                        maxLength={500}
                        ref={reasonRef}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="For example: posted fake job offers asking for money"
                        aria-invalid={showReasonError && tooShort}
                        aria-describedby="suspend-reason-hint"
                        className={cx(field.textarea, showReasonError && tooShort && 'border-red-500 focus:border-red-500')}
                    />
                    <p id="suspend-reason-hint" className={cx(field.hint, showReasonError && tooShort && 'text-red-600 dark:text-red-400')}>
                        {tooShort
                            ? `Write at least ${MIN_REASON} characters (${MIN_REASON - reasonLength} more). Keep it factual.`
                            : 'Keep it factual.'}
                    </p>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={close} disabled={busy} className={btn.secondary}>Cancel</button>
                    <button type="submit" disabled={busy} className={cx(btn.danger, 'disabled:opacity-50 disabled:cursor-not-allowed')}>
                        {busy ? 'Suspending…' : days ? 'Suspend account' : 'Ban account'}
                    </button>
                </div>
            </form>
        </AdminModal>
    );
}
