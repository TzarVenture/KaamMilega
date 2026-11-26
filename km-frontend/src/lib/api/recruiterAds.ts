import api from '@/lib/axios';
import type { CheckoutOrder, SignedPayment } from '@/lib/razorpay';
import type { CouponReceipt } from '@/lib/api/coupons';
import type { AdAudience, AdPlacement, AdPlacementInfo } from '@/lib/api/ads';

/** Days of ads in the slots the admin picked, at a price */
export interface AdPackage {
    id: string;
    name: string;
    description: string;
    days: number;
    price: number;
    price_paise: number;
    placements: AdPlacement[];
    sort_order: number;
    is_active: boolean;
}

export type AdPackageInput = Omit<AdPackage, 'id' | 'price_paise'>;

/** What the recruiter writes */
export interface AdContent {
    advertiser: string;
    headline: string;
    body: string;
    cta_label: string;
    image_url: string;
    link_url: string;
    cities: string[];
    audiences: AdAudience[];
}

export type RecruiterAdState = 'unpaid' | 'pending' | 'running' | 'ended' | 'rejected' | 'refunded';

export interface RecruiterAd extends AdContent {
    id: string;
    user_id: string;
    package_id: string;
    package_name: string;
    days: number;
    placements: AdPlacement[];
    status: 'unpaid' | 'pending' | 'approved' | 'rejected' | 'refunded';
    state: RecruiterAdState;
    channel?: 'wallet' | 'online';
    price: number;
    refunded: number;
    starts_at?: string;
    ends_at?: string;
    revision?: AdContent;
    revision_at?: string;
    revision_note?: string;
    reject_reason?: string;
    paid_at?: string;
    decided_at?: string;
    created_at: string;
    impressions: number;
    clicks: number;
    user_name?: string;
    user_email?: string;
}

export interface RecruiterAdsOverview {
    packages: AdPackage[];
    ads: RecruiterAd[];
    placements: AdPlacementInfo[];
    audiences: AdAudience[];
}

export type AdminAdFilter = 'review' | 'running' | 'ended' | 'rejected' | 'refunded' | 'all';

export const recruiterAdsApi = {
    overview: () => api.get<unknown, RecruiterAdsOverview>('/recruiter-ads'),
    create: (packageId: string, content: AdContent) =>
        api.post<unknown, RecruiterAd>('/recruiter-ads', { package_id: packageId, ...content }),
    update: (id: string, packageId: string, content: AdContent) =>
        api.put<unknown, RecruiterAd>(`/recruiter-ads/${id}`, { package_id: packageId, ...content }),
    remove: (id: string) => api.delete(`/recruiter-ads/${id}`),
    payWithWallet: (id: string, couponCode = '') =>
        api.post<unknown, { ad: RecruiterAd; receipt?: CouponReceipt }>(`/recruiter-ads/${id}/pay-with-wallet`, { coupon_code: couponCode }),
    createOrder: (id: string, couponCode = '') =>
        api.post<unknown, CheckoutOrder>(`/recruiter-ads/${id}/create-order`, { coupon_code: couponCode }),
    verify: (signed: SignedPayment) => api.post<unknown, { ad: RecruiterAd }>('/recruiter-ads/verify-payment', signed),

    adminPackages: () => api.get<unknown, { packages: AdPackage[] }>('/admin/ad-packages'),
    createPackage: (input: AdPackageInput) => api.post<unknown, AdPackage>('/admin/ad-packages', input),
    updatePackage: (id: string, input: AdPackageInput) => api.put<unknown, AdPackage>(`/admin/ad-packages/${id}`, input),
    adminAds: (filter: AdminAdFilter, page: number) =>
        api.get<unknown, { ads: RecruiterAd[]; total: number; total_pages: number }>('/admin/recruiter-ads', {
            params: { page, limit: 20, ...(filter !== 'all' && { status: filter }) },
        }),
    approve: (id: string) => api.post<unknown, RecruiterAd>(`/admin/recruiter-ads/${id}/approve`),
    reject: (id: string, reason: string) => api.post<unknown, RecruiterAd>(`/admin/recruiter-ads/${id}/reject`, { reason }),
    approveChange: (id: string) => api.post<unknown, RecruiterAd>(`/admin/recruiter-ads/${id}/approve-change`),
    rejectChange: (id: string, reason: string) => api.post<unknown, RecruiterAd>(`/admin/recruiter-ads/${id}/reject-change`, { reason }),
};

/** The ad as the site shows it, for previews */
export function previewOf(c: AdContent, fallback: { advertiser: string; headline: string }) {
    let domain = 'example.com';
    try { domain = new URL(c.link_url).hostname.replace(/^www\./, ''); } catch { /* not a link yet */ }
    return {
        id: 'preview',
        advertiser: c.advertiser || fallback.advertiser,
        headline: c.headline || fallback.headline,
        body: c.body || undefined,
        cta_label: c.cta_label || undefined,
        creative_type: 'image' as const,
        creative_url: c.image_url,
        domain,
    };
}
