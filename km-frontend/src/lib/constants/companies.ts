export interface HiringCompany {
    id?: string;
    name: string;
    logo: string;
    openings: string;
    jobCount: number;
    category: string;
    location: string;
    rating?: string;
    reviews?: string;
    verified: boolean;
    bgClass?: string;
    imgClass?: string;
    website?: string;
}

/** Shape of GET /api/companies/top items (recruiter company profiles) */
export interface ApiCompany {
    id?: string;
    name?: string;
    logo?: string;
    website?: string;
    category?: string;
    location?: string;
    verified?: boolean;
    /** Live listings (status Open), counted by the backend */
    job_count?: number;
}

/**
 * Real companies only: maps /companies/top items without inventing ratings, openings or
 * verification.
 */
export function companiesFromApi(list: unknown): HiringCompany[] {
    const items: ApiCompany[] = Array.isArray(list) ? list : ((list as { data?: ApiCompany[] } | null)?.data ?? []);
    const seen = new Set<string>();
    const out: HiringCompany[] = [];
    for (const c of items) {
        const name = typeof c?.name === 'string' ? c.name.trim() : '';
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        const jobs = typeof c.job_count === 'number' && c.job_count > 0 ? c.job_count : 0;
        out.push({
            id: c.id,
            name,
            logo: c.logo || '',
            // The API fills an empty category with this placeholder; show nothing instead
            category: c.category && c.category !== 'Enterprise Employer' ? c.category : '',
            location: c.location || '',
            openings: jobs > 0 ? `${jobs} open ${jobs === 1 ? 'job' : 'jobs'}` : '',
            jobCount: jobs,
            verified: c.verified === true,
            website: c.website,
        });
    }
    return out;
}
