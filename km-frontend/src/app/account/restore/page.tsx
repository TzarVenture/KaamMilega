'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowCounterClockwiseIcon, DownloadSimpleIcon, SignOutIcon } from '@phosphor-icons/react';
import BrandLogo from '@/components/km/BrandLogo';
import api from '@/lib/axios';
import { clearSession, isAuthenticated, saveSession } from '@/lib/auth';
import {
    cancelAccountDeletion,
    downloadAccountData,
    errorMessage,
    formatAccountDate,
    getAccountOverview,
    reactivateAccount,
    type AccountOverview,
} from '@/lib/account';

/**
 * Shown after signing in to a deactivated or pending-deletion account (and whenever such an
 * account reaches any other page). Restoring is one tap; nothing else in the app is reachable.
 */
export default function AccountRestorePage() {
    const router = useRouter();
    const [overview, setOverview] = useState<AccountOverview | null>(null);
    const [busy, setBusy] = useState<'' | 'restore' | 'export' | 'signout'>('');
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isAuthenticated()) {
            router.replace('/login');
            return;
        }
        getAccountOverview()
            .then((o) => {
                if (o.account_status === 'active') router.replace('/');
                else setOverview(o);
            })
            .catch(() => router.replace('/login'));
    }, [router]);

    const pending = overview?.account_status === 'pending_deletion';

    const restore = async () => {
        setBusy('restore');
        setError('');
        try {
            if (pending) await cancelAccountDeletion();
            else await reactivateAccount();
            const profile = (await api.get('/user/profile')) as Parameters<typeof saveSession>[0];
            saveSession(profile);
            router.replace('/');
        } catch (e) {
            setError(errorMessage(e, 'Something went wrong. Please try again.'));
            setBusy('');
        }
    };

    const exportData = async () => {
        setBusy('export');
        setError('');
        try {
            await downloadAccountData();
        } catch (e) {
            setError(errorMessage(e, 'Could not prepare your data. Please try again.'));
        } finally {
            setBusy('');
        }
    };

    const signOut = async () => {
        setBusy('signout');
        await clearSession();
        router.replace('/login');
    };

    return (
        <main className="min-h-screen bg-km-surface flex flex-col">
            <header className="px-4 sm:px-6 h-16 flex items-center border-b border-km-border bg-km-surface-card">
                <BrandLogo size="sm" />
            </header>

            <div className="flex-1 flex items-center justify-center px-4 py-10">
                {!overview ? (
                    <div className="w-full max-w-md h-64 rounded-2xl bg-km-surface-card border border-km-border animate-pulse" aria-label="Loading" />
                ) : (
                    <section className="w-full max-w-md bg-km-surface-card border border-km-border rounded-2xl p-6 sm:p-8 shadow-xs">
                        <h1 className="text-xl sm:text-2xl font-bold text-km-heading">
                            {pending ? 'Your account is scheduled for deletion' : 'Your account is deactivated'}
                        </h1>
                        <p className="mt-3 text-sm text-km-text-secondary leading-relaxed">
                            {pending ? (
                                <>
                                    It will be permanently deleted on{' '}
                                    <strong className="text-km-text-primary">{formatAccountDate(overview.deletion_scheduled_for)}</strong>.
                                    Until then you can keep your account, and everything comes back exactly as it was.
                                </>
                            ) : (
                                'Your profile is hidden and your job posts are paused. Reactivate to pick up where you left off: nothing was deleted.'
                            )}
                        </p>

                        {error && (
                            <p role="alert" className="mt-4 text-sm text-red-600 dark:text-red-400 bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                {error}
                            </p>
                        )}

                        <button
                            type="button"
                            onClick={restore}
                            disabled={busy !== ''}
                            className="mt-6 w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl bg-[#071A4D] hover:bg-[#0B1F52] dark:bg-km-primary dark:hover:bg-km-primary-dark text-white text-sm font-semibold transition-colors disabled:opacity-60"
                        >
                            <ArrowCounterClockwiseIcon size={18} weight="bold" aria-hidden="true" />
                            {busy === 'restore' ? 'Restoring…' : pending ? 'Keep my account' : 'Reactivate my account'}
                        </button>

                        <div className="mt-3 grid grid-cols-2 gap-3">
                            {pending && (
                                <button
                                    type="button"
                                    onClick={exportData}
                                    disabled={busy !== ''}
                                    className="h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-km-border text-sm font-medium text-km-text-primary hover:bg-km-surface transition-colors disabled:opacity-60"
                                >
                                    <DownloadSimpleIcon size={16} weight="bold" aria-hidden="true" />
                                    {busy === 'export' ? 'Preparing…' : 'My data'}
                                </button>
                            )}
                            <button
                                type="button"
                                onClick={signOut}
                                disabled={busy !== ''}
                                className={`h-11 inline-flex items-center justify-center gap-2 rounded-xl border border-km-border text-sm font-medium text-km-text-secondary hover:bg-km-surface transition-colors disabled:opacity-60 ${pending ? '' : 'col-span-2'}`}
                            >
                                <SignOutIcon size={16} weight="bold" aria-hidden="true" />
                                Sign out
                            </button>
                        </div>

                        {pending && (
                            <p className="mt-5 text-xs text-km-text-muted leading-relaxed">
                                After the deletion date your profile, photos and personal details are erased and can&apos;t be
                                recovered. Payment records are kept in anonymised form as required by law.
                            </p>
                        )}
                    </section>
                )}
            </div>
        </main>
    );
}
