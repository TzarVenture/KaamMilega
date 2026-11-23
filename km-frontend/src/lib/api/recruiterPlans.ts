import api from '@/lib/axios';
import type { CheckoutOrder, SignedPayment } from '@/lib/razorpay';
import type { CouponReceipt } from '@/lib/api/coupons';

/** A limit on one thing for a plan period. null means unlimited. */
export type Limit = number | null;

export interface PlanLimits {
    job_posts: Limit;
    new_chats: Limit;
    resume_downloads: Limit;
}

export interface RecruiterPlan extends PlanLimits {
    id: string;
    name: string;
    description: string;
    price: number;
    price_paise: number;
    period_days: number;
    ai_job_writer: boolean;
    sort_order: number;
    is_active: boolean;
}

export interface PlanSubscription extends PlanLimits {
    id: string;
    user_id: string;
    plan_id: string;
    plan_name: string;
    price: number;
    ai_job_writer: boolean;
    channel: 'wallet' | 'online';
    status: 'active' | 'refunded';
    starts_at: string;
    expires_at: string;
    created_at: string;
}

export interface Allowance {
    used: number;
    limit: Limit;
}

export interface PlanOverview {
    plans: RecruiterPlan[];
    current: PlanSubscription | null;
    queued: PlanSubscription[];
    usage: { job_posts: Allowance; new_chats: Allowance; resume_downloads: Allowance };
    period_ends_at: string;
    enforced: boolean;
    ai_job_writer: boolean;
}

export interface PlanSettings {
    enforce: boolean;
    free: PlanLimits;
}

export interface PlanInput extends PlanLimits {
    name: string;
    description: string;
    price: number;
    period_days: number;
    ai_job_writer: boolean;
    sort_order: number;
    is_active: boolean;
}

export interface AdminPlanSubscription extends PlanSubscription {
    recruiter_name: string;
    company_name?: string;
}

export const recruiterPlansApi = {
    overview: () => api.get<unknown, PlanOverview>('/recruiter-plans'),
    buyWithWallet: (planId: string, couponCode = '') =>
        api.post<unknown, { subscription: PlanSubscription; receipt?: CouponReceipt }>(`/recruiter-plans/${planId}/buy-with-wallet`, { coupon_code: couponCode }),
    createOrder: (planId: string, couponCode = '') =>
        api.post<unknown, CheckoutOrder>(`/recruiter-plans/${planId}/create-order`, { coupon_code: couponCode }),
    verify: (signed: SignedPayment) =>
        api.post<unknown, { subscription: PlanSubscription }>('/recruiter-plans/verify-payment', signed),

    adminPlans: () => api.get<unknown, { plans: RecruiterPlan[] }>('/admin/recruiter-plans'),
    createPlan: (input: PlanInput) => api.post<unknown, RecruiterPlan>('/admin/recruiter-plans', input),
    updatePlan: (id: string, input: PlanInput) => api.put<unknown, RecruiterPlan>(`/admin/recruiter-plans/${id}`, input),
    settings: () => api.get<unknown, PlanSettings>('/admin/recruiter-plans/settings'),
    saveSettings: (s: PlanSettings) => api.put<unknown, PlanSettings>('/admin/recruiter-plans/settings', s),
    subscriptions: (page: number) =>
        api.get<unknown, { items: AdminPlanSubscription[]; total: number; page: number; limit: number }>(
            '/admin/recruiter-plans/subscriptions',
            { params: { page, limit: 20 } },
        ),
};
