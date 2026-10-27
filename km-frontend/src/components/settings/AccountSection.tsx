'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { notify } from "@/lib/notify";
import { ArrowRightIcon, DownloadSimpleIcon, LockIcon, PauseCircleIcon, TrashIcon, WarningIcon } from '@phosphor-icons/react';
import ModalWrapper from '@/components/ui/ModalWrapper';
import OtpInput from '@/components/ui/OtpInput';
import { clearSession } from '@/lib/auth';
import {
    deactivateAccount,
    downloadAccountData,
    errorMessage,
    formatAccountDate,
    getAccountOverview,
    requestAccountDeletion,
    sendVerificationCode,
    type AccountOverview,
} from '@/lib/account';
import { SettingRow, SettingsCard, buttonDanger, buttonPrimary, buttonSecondary, inputClass } from './SettingsPrimitives';

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

const REASONS = [
    { value: '', label: 'Choose a reason (optional)' },
    { value: 'found_job', label: 'I found a job' },
    { value: 'taking_break', label: 'I’m taking a break' },
    { value: 'too_many_notifications', label: 'Too many notifications' },
    { value: 'privacy', label: 'Privacy concerns' },
    { value: 'not_useful', label: 'Not useful for me' },
    { value: 'other', label: 'Something else' },
];

type Kind = 'deactivate' | 'delete';

function AccountActionDialog({ kind, overview, onClose }: { kind: Kind; overview: AccountOverview; onClose: () => void }) {
    const router = useRouter();
    const isDelete = kind === 'delete';
    const [step, setStep] = useState<'details' | 'verify' | 'done'>('details');
    const [reason, setReason] = useState('');
    const [feedback, setFeedback] = useState('');
    const [acknowledged, setAcknowledged] = useState(false);
    const [method, setMethod] = useState<'code' | 'password'>(overview.code_channel.channel ? 'code' : 'password');
    const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''));
    const [codeSentTo, setCodeSentTo] = useState('');
    const [cooldown, setCooldown] = useState(0);
    const [password, setPassword] = useState('');
    const [confirmText, setConfirmText] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [scheduledFor, setScheduledFor] = useState('');

    useEffect(() => {
        if (cooldown <= 0) return;
        const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
        return () => clearTimeout(t);
    }, [cooldown]);

    const deletionDate = new Date(Date.now() + overview.grace_period_days * 86400000).toISOString();
    const blocked = isDelete && overview.blockers.length > 0;
    const needsAck = isDelete && overview.warnings.length > 0;

    const sendCode = async () => {
        setError('');
        setBusy(true);
        try {
            const res = await sendVerificationCode();
            setCodeSentTo(res.destination);
            setCooldown(RESEND_SECONDS);
            setCode(Array(CODE_LENGTH).fill(''));
        } catch (e) {
            setError(errorMessage(e, 'Could not send the code.'));
        } finally {
            setBusy(false);
        }
    };

    const proof = method === 'password' ? { password } : { code: code.join('') };
    const proofReady = method === 'password' ? password.length > 0 : code.join('').length === CODE_LENGTH;
    const canSubmit = proofReady && (!isDelete || confirmText.trim() === 'DELETE') && !busy;

    const submit = async () => {
        setError('');
        setBusy(true);
        try {
            if (isDelete) {
                const res = await requestAccountDeletion({ ...proof, reason, feedback, confirm: confirmText.trim(), acknowledge_warnings: acknowledged });
                setScheduledFor(res.deletion_scheduled_for);
            } else {
                await deactivateAccount({ ...proof, reason, feedback });
            }
            setStep('done');
        } catch (e) {
            setError(errorMessage(e, 'Something went wrong. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const finish = async () => {
        // The server already ended every session; clear this browser's copy too
        await clearSession();
        router.replace('/');
    };

    const title = step === 'done'
        ? isDelete ? 'Deletion scheduled' : 'Account deactivated'
        : isDelete ? 'Delete your account' : 'Deactivate your account';

    return (
        <ModalWrapper isOpen onClose={step === 'done' ? finish : onClose} title={title}>
            {step === 'details' && (
                <div className="space-y-5">
                    {isDelete && overview.blockers.length > 0 && (
                        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                            <p className="text-sm font-semibold text-red-700 dark:text-red-400 flex items-center gap-2">
                                <LockIcon size={16} weight="bold" aria-hidden="true" /> Resolve these first
                            </p>
                            <ul className="mt-3 space-y-3">
                                {overview.blockers.map((b) => (
                                    <li key={b.code} className="text-sm">
                                        <p className="font-medium text-km-text-primary">{b.title}</p>
                                        <p className="text-km-text-secondary">{b.detail}</p>
                                        {b.action_url && (
                                            <Link href={b.action_url} className="mt-1 inline-flex items-center gap-1 font-semibold text-km-link hover:underline">
                                                {b.action_label} <ArrowRightIcon size={14} weight="bold" aria-hidden="true" />
                                            </Link>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div>
                        <p className="text-sm font-semibold text-km-text-primary">What happens</p>
                        <ul className="mt-2 space-y-1.5 text-sm text-km-text-secondary list-disc pl-5">
                            {isDelete ? (
                                <>
                                    <li>Your account is deactivated now and you’re signed out everywhere.</li>
                                    <li>It’s permanently deleted on <strong className="text-km-text-primary">{formatAccountDate(deletionDate)}</strong>. Sign in before then to keep it.</li>
                                    <li>Your profile, photos, resume and personal details are then erased. This can’t be undone.</li>
                                    <li>Payment records are kept in anonymised form, as the law requires.</li>
                                </>
                            ) : (
                                <>
                                    <li>Your profile is hidden from employers, search and your network.</li>
                                    <li>Your job posts are paused and you’re signed out on every device.</li>
                                    <li>Nothing is deleted. Sign in any time to reactivate.</li>
                                </>
                            )}
                        </ul>
                        {isDelete && (
                            <button type="button" onClick={() => downloadAccountData().catch(() => notify.error('Could not prepare your data.'))}
                                className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-km-link hover:underline cursor-pointer">
                                <DownloadSimpleIcon size={16} weight="bold" aria-hidden="true" /> Download a copy of your data first
                            </button>
                        )}
                    </div>

                    {needsAck && !blocked && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                            {overview.warnings.map((w) => (
                                <div key={w.code} className="text-sm">
                                    <p className="font-medium text-km-text-primary flex items-center gap-1.5">
                                        <WarningIcon size={14} weight="bold" className="text-amber-600 dark:text-amber-400" aria-hidden="true" /> {w.title}
                                    </p>
                                    <p className="text-km-text-secondary">{w.detail}</p>
                                </div>
                            ))}
                            <label className="flex items-start gap-2 pt-1 text-sm text-km-text-primary cursor-pointer">
                                <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#0B5ED7]" />
                                I understand
                            </label>
                        </div>
                    )}

                    {!blocked && (
                        <div className="space-y-3">
                            <div>
                                <label htmlFor="exit-reason" className="block text-sm font-medium text-km-text-primary mb-1.5">Why are you leaving?</label>
                                <select id="exit-reason" value={reason} onChange={(e) => setReason(e.target.value)} className={inputClass}>
                                    {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                                </select>
                            </div>
                            <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} rows={2} maxLength={500}
                                placeholder="Anything we could do better? (optional, stored without your name)"
                                className={`${inputClass} h-auto py-2.5 resize-none`} />
                        </div>
                    )}

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
                        <button type="button" onClick={onClose} className={buttonSecondary}>{blocked ? 'Close' : 'Cancel'}</button>
                        {!blocked && (
                            <button type="button" disabled={needsAck && !acknowledged} onClick={() => setStep('verify')} className={isDelete ? buttonDanger : buttonPrimary}>
                                Continue
                            </button>
                        )}
                    </div>
                </div>
            )}

            {step === 'verify' && (
                <div className="space-y-5">
                    <p className="text-sm text-km-text-secondary">To protect your account, confirm it’s really you.</p>

                    {overview.has_password && overview.code_channel.channel && (
                        <div role="tablist" className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-km-surface border border-km-border">
                            {(['code', 'password'] as const).map((m) => (
                                <button key={m} type="button" role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setError(''); }}
                                    className={`h-9 rounded-lg text-sm font-semibold transition-colors cursor-pointer ${method === m ? 'bg-km-surface-card text-km-heading shadow-xs' : 'text-km-text-secondary'}`}>
                                    {m === 'code' ? 'Verification code' : 'Password'}
                                </button>
                            ))}
                        </div>
                    )}

                    {method === 'code' ? (
                        <div className="space-y-3">
                            {codeSentTo ? (
                                <>
                                    <p className="text-sm text-km-text-primary">Enter the 6-digit code sent to <strong>{codeSentTo}</strong></p>
                                    <OtpInput length={CODE_LENGTH} value={code} onChange={setCode} />
                                    <button type="button" onClick={sendCode} disabled={cooldown > 0 || busy}
                                        className="text-sm font-semibold text-km-link disabled:text-km-text-muted cursor-pointer disabled:cursor-default">
                                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                                    </button>
                                </>
                            ) : (
                                <button type="button" onClick={sendCode} disabled={busy} className={buttonSecondary}>
                                    {busy ? 'Sending…' : `Send code to ${overview.code_channel.destination}`}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div>
                            <label htmlFor="reauth-pw" className="block text-sm font-medium text-km-text-primary mb-1.5">Password</label>
                            <input id="reauth-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} />
                        </div>
                    )}

                    {isDelete && (
                        <div>
                            <label htmlFor="confirm-delete" className="block text-sm font-medium text-km-text-primary mb-1.5">
                                Type <span className="font-mono font-bold">DELETE</span> to confirm
                            </label>
                            <input id="confirm-delete" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" className={inputClass} />
                        </div>
                    )}

                    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
                        <button type="button" onClick={() => setStep('details')} className={buttonSecondary}>Back</button>
                        <button type="button" onClick={submit} disabled={!canSubmit} className={isDelete ? buttonDanger : buttonPrimary}>
                            {busy ? 'Please wait…' : isDelete ? 'Delete my account' : 'Deactivate account'}
                        </button>
                    </div>
                </div>
            )}

            {step === 'done' && (
                <div className="space-y-4">
                    <p className="text-sm text-km-text-secondary leading-relaxed">
                        {isDelete
                            ? `Your account will be permanently deleted on ${formatAccountDate(scheduledFor)}. Changed your mind? Just sign in before then.`
                            : 'Your account is deactivated and you’ve been signed out everywhere. Sign in any time to reactivate it.'}
                    </p>
                    <button type="button" onClick={finish} className={buttonPrimary}>Done</button>
                </div>
            )}
        </ModalWrapper>
    );
}

export default function AccountSection() {
    const [overview, setOverview] = useState<AccountOverview | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [dialog, setDialog] = useState<Kind | null>(null);
    const [exporting, setExporting] = useState(false);

    const load = () => {
        setLoadError(false);
        getAccountOverview().then(setOverview).catch(() => setLoadError(true));
    };
    useEffect(load, []);

    const exportData = async () => {
        setExporting(true);
        try {
            await downloadAccountData();
        } catch {
            notify.error('Could not prepare your data. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    if (loadError) {
        return (
            <SettingsCard title="Account">
                <div className="py-4 text-sm text-km-text-secondary">
                    Couldn’t load your account details. <button type="button" onClick={load} className="font-semibold text-km-link cursor-pointer">Try again</button>
                </div>
            </SettingsCard>
        );
    }
    if (!overview) return <div className="h-64 rounded-2xl bg-km-surface-card border border-km-border animate-pulse" />;

    return (
        <div className="space-y-5">
            <SettingsCard title="Your data">
                <SettingRow
                    title="Download your data"
                    description="A copy of your profile, applications, connections, payments and bookings as a JSON file."
                    control={
                        <button type="button" onClick={exportData} disabled={exporting} className={buttonSecondary}>
                            <DownloadSimpleIcon size={16} weight="bold" aria-hidden="true" /> {exporting ? 'Preparing…' : 'Download'}
                        </button>
                    }
                />
            </SettingsCard>

            <SettingsCard title="Leave KaamMilega" tone="danger">
                <SettingRow
                    title="Deactivate account"
                    description="Hide your profile and pause job posts. Nothing is deleted: sign in any time to come back."
                    control={
                        <button type="button" onClick={() => setDialog('deactivate')} className={buttonSecondary}>
                            <PauseCircleIcon size={16} weight="bold" aria-hidden="true" /> Deactivate
                        </button>
                    }
                />
                <SettingRow
                    title="Delete account"
                    description={`Permanently delete your account and personal data after a ${overview.grace_period_days}-day grace period.`}
                    control={
                        <button type="button" onClick={() => { load(); setDialog('delete'); }} className={buttonDanger}>
                            <TrashIcon size={16} weight="bold" aria-hidden="true" /> Delete
                        </button>
                    }
                />
            </SettingsCard>

            {dialog && <AccountActionDialog kind={dialog} overview={overview} onClose={() => setDialog(null)} />}
        </div>
    );
}
