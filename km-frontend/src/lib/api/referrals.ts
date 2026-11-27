import api from '@/lib/axios';

export type ReferralStatus = 'pending' | 'paid' | 'released' | 'cancelled';

export interface ReferralCounts {
    joined: number;
    waiting: number;
    released: number;
    cancelled: number;
}

export interface InvitedPerson {
    first_name: string;
    status: ReferralStatus;
    joined_at: string;
    release_at?: string;
    reward: number;
}

export interface GroupProgress {
    group_size: number;
    credit: number;
    cash: number;
    towards_next: number;
    groups: number;
    cash_owed: number;
    cash_received: number;
}

export interface ReferralOverview {
    enabled: boolean;
    code: string;
    is_aggregator: boolean;
    member_reward: number;
    wait_days: number;
    counts: ReferralCounts;
    earned: number;
    aggregator?: GroupProgress;
    people: InvitedPerson[];
}

export interface ReferralSettings {
    enabled: boolean;
    member_reward: number;
    aggregator_group: number;
    aggregator_credit: number;
    aggregator_cash: number;
    wait_days: number;
}

export interface ReferralAggregator {
    user_id: string;
    active: boolean;
    note: string;
    approved_by: string;
    approved_at: string;
    name?: string;
    mobile?: string;
    released: number;
    waiting: number;
    credit_earned: number;
    cash_owed: number;
}

export interface ReferralPayout {
    id: string;
    user_id: string;
    batch_no: number;
    referrals: number;
    credit: number;
    cash: number;
    cash_paid_at?: string;
    cash_paid_by?: string;
    cash_note?: string;
    created_at: string;
    user_name?: string;
    user_mobile?: string;
}

export interface AdminReferral {
    id: string;
    referrer_id: string;
    referred_id: string;
    status: ReferralStatus;
    first_payment?: string;
    paid_at?: string;
    release_at?: string;
    released_at?: string;
    reward_kind?: 'member' | 'aggregator' | 'none';
    reward: number;
    payout_id?: string;
    cancel_reason?: string;
    created_at: string;
    referrer_name: string;
    referrer_mobile: string;
    referred_name: string;
    referred_mobile: string;
}

export const referralsApi = {
    overview: () => api.get<unknown, ReferralOverview>('/referrals'),
    claim: (code: string) => api.post('/referrals/claim', { code }),

    settings: () => api.get<unknown, ReferralSettings>('/admin/referrals/settings'),
    saveSettings: (s: ReferralSettings) => api.put<unknown, ReferralSettings>('/admin/referrals/settings', s),
    aggregators: () => api.get<unknown, { items: ReferralAggregator[] }>('/admin/referrals/aggregators'),
    setAggregator: (user: string, active: boolean, note = '') =>
        api.post<unknown, ReferralAggregator>('/admin/referrals/aggregators', { user, active, note }),
    payouts: (owed: boolean, page = 1) =>
        api.get<unknown, { items: ReferralPayout[]; total: number }>('/admin/referrals/payouts', { params: { owed: owed ? 1 : undefined, page } }),
    markCashPaid: (id: string, note: string) => api.post<unknown, ReferralPayout>(`/admin/referrals/payouts/${id}/cash-paid`, { note }),
    list: (status: string, page = 1) =>
        api.get<unknown, { items: AdminReferral[]; total: number }>('/admin/referrals', { params: { status: status || undefined, page } }),
};

/** The share link for an invite code */
export function inviteLink(code: string): string {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://kaammilega.com';
    return `${origin}/?ref=${encodeURIComponent(code)}`;
}
