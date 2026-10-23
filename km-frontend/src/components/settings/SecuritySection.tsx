'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { notify } from "@/lib/notify";
import { CheckCircleIcon, DevicesIcon, EyeIcon, EyeSlashIcon, WarningCircleIcon } from '@phosphor-icons/react';
import api from '@/lib/axios';
import { errorMessage, revokeOtherSessions } from '@/lib/account';
import { Badge, SettingRow, SettingsCard, buttonPrimary, buttonSecondary, inputClass } from './SettingsPrimitives';

const MIN_PASSWORD = 8;

interface SecurityProfile {
    mobile?: string;
    otp_verified_at?: string | null;
    email?: string;
    is_email_verified?: boolean;
    has_password?: boolean;
}

function maskMobile(m?: string) {
    if (!m) return '';
    const d = m.replace(/\D/g, '');
    return d.length > 4 ? `•••••• ${d.slice(-4)}` : m;
}

export default function SecuritySection({ profile, onPasswordSet }: { profile: SecurityProfile; onPasswordSet: () => void }) {
    const hasPassword = Boolean(profile.has_password);
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [show, setShow] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [confirmSignOut, setConfirmSignOut] = useState(false);
    const [signingOut, setSigningOut] = useState(false);

    const submitPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (next.length < MIN_PASSWORD) return setError(`Use at least ${MIN_PASSWORD} characters.`);
        if (next !== confirm) return setError('The new passwords don’t match.');
        if (hasPassword && !current) return setError('Enter your current password.');
        setSaving(true);
        try {
            const res = (await api.put('/user/password', { current_password: hasPassword ? current : '', new_password: next })) as { message?: string };
            notify.success(errorMessage(res, 'Password updated'));
            setCurrent('');
            setNext('');
            setConfirm('');
            onPasswordSet();
        } catch (err) {
            setError(errorMessage(err, 'Could not update your password.'));
        } finally {
            setSaving(false);
        }
    };

    const signOutOthers = async () => {
        setSigningOut(true);
        try {
            const res = await revokeOtherSessions();
            notify.success(res.message);
            setConfirmSignOut(false);
        } catch (err) {
            notify.error(errorMessage(err, 'Could not sign out other devices.'));
        } finally {
            setSigningOut(false);
        }
    };

    const mobileVerified = Boolean(profile.mobile && profile.otp_verified_at);

    return (
        <div className="space-y-5">
            <SettingsCard title="Sign-in details" description="How you sign in and receive security codes.">
                <SettingRow
                    title="Mobile number"
                    description={profile.mobile ? maskMobile(profile.mobile) : 'No mobile number added'}
                    badge={
                        mobileVerified ? (
                            <Badge tone="ok"><CheckCircleIcon size={12} weight="bold" aria-hidden="true" /> Verified</Badge>
                        ) : profile.mobile ? (
                            <Badge tone="warn"><WarningCircleIcon size={12} weight="bold" aria-hidden="true" /> Not verified</Badge>
                        ) : undefined
                    }
                />
                <SettingRow
                    title="Email"
                    description={profile.email || 'No email added. Add one to receive job alerts and security codes.'}
                    badge={
                        profile.email ? (
                            profile.is_email_verified ? (
                                <Badge tone="ok"><CheckCircleIcon size={12} weight="bold" aria-hidden="true" /> Verified</Badge>
                            ) : (
                                <Badge tone="warn"><WarningCircleIcon size={12} weight="bold" aria-hidden="true" /> Not verified</Badge>
                            )
                        ) : undefined
                    }
                    control={
                        !profile.is_email_verified ? (
                            <Link href="/profile" className="text-sm font-semibold text-km-link hover:underline">
                                {profile.email ? 'Verify' : 'Add email'}
                            </Link>
                        ) : undefined
                    }
                />
            </SettingsCard>

            <SettingsCard
                title={hasPassword ? 'Change password' : 'Set a password'}
                description={
                    hasPassword
                        ? 'Changing your password signs you out on every other device.'
                        : 'You sign in with a one-time code today. Add a password to also sign in with your email or mobile and password.'
                }
            >
                <form onSubmit={submitPassword} className="pt-4 space-y-3 max-w-md" noValidate>
                    {hasPassword && (
                        <div>
                            <label htmlFor="pw-current" className="block text-sm font-medium text-km-text-primary mb-1.5">Current password</label>
                            <input id="pw-current" type={show ? 'text' : 'password'} autoComplete="current-password" className={inputClass}
                                value={current} onChange={(e) => setCurrent(e.target.value)} />
                        </div>
                    )}
                    <div>
                        <label htmlFor="pw-new" className="block text-sm font-medium text-km-text-primary mb-1.5">New password</label>
                        <div className="relative">
                            <input id="pw-new" type={show ? 'text' : 'password'} autoComplete="new-password" className={`${inputClass} pr-11`}
                                value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="pw-rule" />
                            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide passwords' : 'Show passwords'}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-km-text-secondary hover:text-km-text-primary cursor-pointer">
                                {show ? <EyeSlashIcon size={18} weight="bold" /> : <EyeIcon size={18} weight="bold" />}
                            </button>
                        </div>
                        <p id="pw-rule" className="mt-1 text-xs text-km-text-muted">At least {MIN_PASSWORD} characters.</p>
                    </div>
                    <div>
                        <label htmlFor="pw-confirm" className="block text-sm font-medium text-km-text-primary mb-1.5">Confirm new password</label>
                        <input id="pw-confirm" type={show ? 'text' : 'password'} autoComplete="new-password" className={inputClass}
                            value={confirm} onChange={(e) => setConfirm(e.target.value)} />
                    </div>
                    {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                    <button type="submit" disabled={saving} className={buttonPrimary}>
                        {saving ? 'Saving…' : hasPassword ? 'Update password' : 'Set password'}
                    </button>
                </form>
            </SettingsCard>

            <SettingsCard title="Devices" description="Signed in on a phone or computer you no longer use?">
                <SettingRow
                    title="Sign out of all other devices"
                    description="You stay signed in here. Everywhere else you’ll need to sign in again."
                    control={
                        confirmSignOut ? (
                            <div className="flex gap-2">
                                <button type="button" onClick={() => setConfirmSignOut(false)} className={buttonSecondary}>Cancel</button>
                                <button type="button" onClick={signOutOthers} disabled={signingOut} className={buttonPrimary}>
                                    {signingOut ? 'Signing out…' : 'Sign out'}
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setConfirmSignOut(true)} className={buttonSecondary}>
                                <DevicesIcon size={16} weight="bold" aria-hidden="true" /> Sign out others
                            </button>
                        )
                    }
                />
            </SettingsCard>
        </div>
    );
}
