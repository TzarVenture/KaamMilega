import type { BadgeTone } from '@/components/admin/ui';

/** Session categories an Expert picks from, and mentees filter by on /mentorship */
export const SESSION_CATEGORIES = [
    'Interview Prep',
    'Career Guidance',
    'Technical Skills',
    'Soft Skills',
    'Resume Review',
    'Entrepreneurship',
];

/** Session lengths offered in the form (the server accepts 15 to 240 minutes) */
export const SESSION_DURATIONS = [15, 30, 45, 60, 90, 120];

/** The same limits the server checks (km-backend mentorship/domain.go; the price range matches the Expert application) */
export const SESSION_LIMITS = {
    title: 100,
    description: 2000,
    minPrice: 99,
    maxPrice: 50000,
};

/** How a booking reads to the mentor: a label, a badge colour and what happens next */
export const BOOKING_STATUS: Record<string, { label: string; tone: BadgeTone; next?: string }> = {
    pending: { label: 'Not paid', tone: 'amber', next: 'The mentee hasn’t paid for this request.' },
    confirmed: { label: 'Confirmed', tone: 'blue', next: 'Paid. Add a meeting link before the call.' },
    awaiting_confirmation: { label: 'Waiting for mentee', tone: 'amber', next: 'You’re paid when the mentee confirms, or automatically after 24 hours.' },
    reported: { label: 'Under review', tone: 'red', next: 'The mentee reported a problem. Payment is on hold while we review it.' },
    completed: { label: 'Paid out', tone: 'green', next: 'The fee is in your earnings.' },
    cancelled: { label: 'Cancelled', tone: 'neutral', next: 'The mentee was refunded.' },
};

/** Bookings that need the mentor soonest come first */
const STATUS_ORDER = ['confirmed', 'pending', 'awaiting_confirmation', 'reported', 'completed', 'cancelled'];

export function sortBookings<T extends { status: string; scheduled_at: string }>(list: T[]): T[] {
    return [...list].sort((a, b) => {
        const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
        if (byStatus !== 0) return byStatus;
        const at = new Date(a.scheduled_at).getTime();
        const bt = new Date(b.scheduled_at).getTime();
        // Upcoming work soonest first; finished work newest first
        return a.status === 'confirmed' || a.status === 'pending' ? at - bt : bt - at;
    });
}

/** A session price: "₹499", with paise only when there are some ("₹499.50") */
export function price(amount: number | undefined): string {
    const n = amount || 0;
    return new Intl.NumberFormat('en-IN', {
        style: 'currency', currency: 'INR', minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2,
    }).format(n);
}

/** "Wed, 3 Dec, 6:30 pm" in Indian English */
export function sessionTime(iso: string): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}
