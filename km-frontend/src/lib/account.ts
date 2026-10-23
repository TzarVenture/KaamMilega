import api from './axios';

/** Where a deactivated or pending-deletion account is sent after signing in */
export const ACCOUNT_RESTORE_PATH = '/account/restore';

export type AccountStatus = 'active' | 'deactivated' | 'pending_deletion';

/** True when the signed-in account must be restored before using the app */
export function needsAccountRestore(user: { account_status?: string } | null | undefined): boolean {
    return user?.account_status === 'deactivated' || user?.account_status === 'pending_deletion';
}

export interface AccountBlocker {
    code: string;
    title: string;
    detail: string;
    action_label?: string;
    action_url?: string;
}

export interface AccountWarning {
    code: string;
    title: string;
    detail: string;
}

export interface CodeChannel {
    channel: 'email' | 'sms' | '';
    destination: string;
}

export interface AccountOverview {
    account_status: AccountStatus;
    deactivated_at?: string;
    deletion_scheduled_for?: string;
    grace_period_days: number;
    has_password: boolean;
    code_channel: CodeChannel;
    blockers: AccountBlocker[];
    warnings: AccountWarning[];
    can_delete: boolean;
}

/** Proof that the account owner is acting: a code from sendVerificationCode, or the password */
export interface Reauth {
    code?: string;
    password?: string;
}

export const getAccountOverview = () => api.get('/user/account/overview') as Promise<AccountOverview>;

export const sendVerificationCode = () =>
    api.post('/user/account/verification-code') as Promise<CodeChannel & { expires_in_seconds: number }>;

export const deactivateAccount = (body: Reauth & { reason?: string; feedback?: string }) =>
    api.post('/user/account/deactivate', body) as Promise<{ message: string }>;

export const reactivateAccount = () => api.post('/user/account/reactivate') as Promise<{ message: string }>;

export const requestAccountDeletion = (
    body: Reauth & { reason?: string; feedback?: string; confirm: string; acknowledge_warnings: boolean }
) => api.post('/user/account/deletion', body) as Promise<{ message: string; deletion_scheduled_for: string }>;

export const cancelAccountDeletion = () => api.delete('/user/account/deletion') as Promise<{ message: string }>;

export const revokeOtherSessions = () => api.post('/user/sessions/revoke-others') as Promise<{ message: string }>;

/** Downloads the personal data export as a JSON file */
export async function downloadAccountData(): Promise<void> {
    const data = await api.get('/user/account/export');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kaammilega-data-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
}

export function formatAccountDate(iso?: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Message from an API error (axios interceptor rejects with Error), or a fallback */
export function errorMessage(e: unknown, fallback: string): string {
    return e instanceof Error && e.message ? e.message : fallback;
}
