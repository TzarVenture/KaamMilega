import api from '@/lib/axios';

/** What a coupon can be used on (backend payment purposes) */
export type CouponPurpose = 'instant_pass' | 'recruiter_plan' | 'recruiter_ad';
export type CouponKind = 'discount' | 'cashback';
export type CouponValueType = 'flat' | 'percent';

/** A price for the checkout screen. Holds nothing; the server prices again at payment. */
export interface CouponQuote {
    code?: string;
    kind?: CouponKind;
    description?: string;
    list_price: number;
    discount: number;
    price: number;
    price_paise: number;
    free: boolean;
    /** Cashback if the whole price is paid online */
    online_cashback: number;
    /** Paying from the wallet: bonus credit first, then the spending balance */
    wallet: { from_bonus: number; from_main: number; cashback: number; enough: boolean };
}

/** How a wallet purchase was paid */
export interface CouponReceipt {
    code?: string;
    list_price: number;
    discount: number;
    paid: number;
    from_bonus: number;
    from_main: number;
    cashback: number;
}

export interface Coupon {
    id: string;
    code: string;
    description: string;
    kind: CouponKind;
    value_type: CouponValueType;
    amount: number | null;
    percent: number | null;
    max_benefit: number | null;
    min_order: number;
    applies_to: CouponPurpose[];
    starts_at: string | null;
    ends_at: string | null;
    total_limit: number | null;
    per_user_limit: number | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface CouponStats extends Coupon {
    used: number;
    held: number;
    discounted: number;
    cashback_given: number;
}

export type CouponInput = Omit<Coupon, 'id' | 'created_at' | 'updated_at'>;

export interface CouponRedemption {
    id: string;
    coupon_id: string;
    code: string;
    user_id: string;
    user_name?: string;
    purpose: CouponPurpose;
    channel: 'wallet' | 'online';
    status: 'reserved' | 'redeemed' | 'released' | 'reversed';
    list_price: number;
    discount: number;
    cashback: number;
    razorpay_order_id?: string;
    purchase_ref?: string;
    reserved_until?: string;
    redeemed_at?: string;
    reversed_at?: string;
    created_at: string;
}

export const couponsApi = {
    quote: (purpose: CouponPurpose, code: string, targetId?: string) =>
        api.post<unknown, CouponQuote>('/coupons/quote', { purpose, code, target_id: targetId ?? '' }),

    adminList: () => api.get<unknown, { coupons: CouponStats[] }>('/admin/coupons'),
    create: (input: CouponInput) => api.post<unknown, Coupon>('/admin/coupons', input),
    update: (id: string, input: CouponInput) => api.put<unknown, Coupon>(`/admin/coupons/${id}`, input),
    redemptions: (page: number, couponId?: string) =>
        api.get<unknown, { items: CouponRedemption[]; total: number; page: number; limit: number }>('/admin/coupons/redemptions', {
            params: { page, limit: 20, ...(couponId ? { coupon_id: couponId } : {}) },
        }),
};
