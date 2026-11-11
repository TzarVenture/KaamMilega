// Wording shared by the job card and the job details page

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;

/** "₹10,000 – ₹20,000 a month", or a clear line when the employer left it out */
export function salaryText(min?: number, max?: number) {
    if (!min && !max) return 'Salary not disclosed';
    if (!max || min === max) return `${rupees((min || max) as number)} a month`;
    if (!min) return `Up to ${rupees(max)} a month`;
    return `${rupees(min)} – ${rupees(max)} a month`;
}

/** "Fresher", "2+ years" or "2 – 4 years" */
export function experienceText(min?: number, max?: number) {
    if (!min && !max) return 'Fresher';
    if (!min) return `Up to ${max} years`;
    if (!max || max <= min) return `${min}+ ${min === 1 ? 'year' : 'years'}`;
    return `${min} – ${max} years`;
}

/** "Be the first to apply", "1 applicant", "12 applicants" */
export function applicantText(count?: number) {
    if (count === undefined) return '';
    if (count === 0) return 'Be the first to apply';
    return count === 1 ? '1 applicant' : `${count} applicants`;
}
