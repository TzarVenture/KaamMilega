export function inr(amount: number | undefined): string {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount || 0);
}

export function dateTime(iso: string | undefined, locale = 'en'): string {
    if (!iso) return '';
    return new Date(iso).toLocaleString(`${locale}-IN`, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/** True when the amount has no more than two decimal places */
export function isWholePaise(amount: number): boolean {
    return Math.abs(amount * 100 - Math.round(amount * 100)) < 1e-6;
}
