/** Indian digit grouping (12,34,567) for a whole rupee amount */
export function inrNumber(n: number): string {
    return Math.round(n).toLocaleString('en-IN');
}

/**
 * A job's monthly salary range as text, or null when neither end is set.
 * Returns a kind + values so the page can wrap it in a translated "/month" string.
 */
export function salaryRange(min?: number, max?: number): string | null {
    const lo = min && min > 0 ? min : 0;
    const hi = max && max > 0 ? max : 0;
    if (!lo && !hi) return null;
    if (lo && hi && lo !== hi) return `₹${inrNumber(Math.min(lo, hi))} – ₹${inrNumber(Math.max(lo, hi))}`;
    return `₹${inrNumber(lo || hi)}`;
}
