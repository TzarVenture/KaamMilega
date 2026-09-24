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

export const ENTERPRISE_COMPANIES: HiringCompany[] = [
    {
        name: "Zomato",
        logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/zomato/default.svg",
        openings: "Active Hiring",
        jobCount: 1,
        category: "Food & Delivery",
        location: "Pan India",
        rating: "4.8",
        reviews: "3.7k Reviews",
        verified: true,
        bgClass: "bg-rose-50/80 border-rose-200/70",
        imgClass: "h-5 w-auto max-w-[85%]",
    },
    {
        name: "Swiggy",
        logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/swiggy/default.svg",
        openings: "Active Hiring",
        jobCount: 1,
        category: "Quick Commerce",
        location: "Metro & Tier-1 Hubs",
        rating: "4.7",
        reviews: "5.1k Reviews",
        verified: true,
        bgClass: "bg-orange-50/80 border-orange-200/70",
        imgClass: "h-7 w-auto",
    },
    {
        name: "Amazon",
        logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/amazon/default.svg",
        openings: "Active Hiring",
        jobCount: 1,
        category: "E-Commerce & Tech",
        location: "Bhiwandi • Bengaluru • NCR",
        rating: "4.8",
        reviews: "8.5k Reviews",
        verified: true,
        bgClass: "bg-amber-50/60 border-amber-200/70",
        imgClass: "h-5 w-auto max-w-[85%]",
    },
    {
        name: "Uber",
        logo: "https://cdn.simpleicons.org/uber/000000",
        openings: "Active Hiring",
        jobCount: 1,
        category: "Mobility & Logistics",
        location: "Pan India",
        rating: "4.7",
        reviews: "6.2k Reviews",
        verified: true,
        bgClass: "bg-slate-50 border-slate-200",
        imgClass: "h-4 w-auto max-w-[85%]",
    },
    {
        name: "Airtel",
        logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/airtel/default.svg",
        openings: "Active Hiring",
        jobCount: 1,
        category: "Telecommunications",
        location: "All Telecom Circles",
        rating: "4.7",
        reviews: "4.3k Reviews",
        verified: true,
        bgClass: "bg-red-50/80 border-red-200/70",
        imgClass: "h-6 w-auto",
    },
    {
        name: "Domino's",
        logo: "https://cdn.jsdelivr.net/gh/glincker/thesvg@main/public/icons/dominos/default.svg",
        openings: "Active Hiring",
        jobCount: 1,
        category: "Food & Restaurants",
        location: "50+ Cities",
        rating: "4.6",
        reviews: "3.9k Reviews",
        verified: true,
        bgClass: "bg-blue-50/80 border-blue-200/70",
        imgClass: "h-7 w-auto",
    },
];

export interface RawCompanyInput {
    id?: string;
    _id?: string;
    name?: string;
    company?: string;
    company_name?: string;
    logo?: string;
    company_logo?: string;
    openings?: string;
    jobCount?: number;
    active_jobs?: number;
    category?: string;
    industry?: string;
    location?: string;
    city?: string;
    rating?: string;
    reviews?: string;
}

/**
 * Merges real database employers with verified enterprise partners.
 * Avoids duplicates by normalized company name.
 */
export function mergeHiringCompanies(dbCompanies?: Array<RawCompanyInput | HiringCompany>): HiringCompany[] {
    const map = new Map<string, HiringCompany>();

    // Add any dynamic DB companies that have valid names
    if (Array.isArray(dbCompanies)) {
        dbCompanies.forEach((c) => {
            const rawName = c.name || ('company' in c ? c.company : undefined) || ('company_name' in c ? c.company_name : undefined);
            if (rawName && typeof rawName === 'string' && rawName.trim().length > 0 && rawName.toLowerCase() !== 'kaammilega partner') {
                const clean = rawName.trim();
                const key = clean.toLowerCase();
                const logo = c.logo || ('company_logo' in c ? (c as RawCompanyInput).company_logo : '') || '';
                const rawJobs = c.jobCount || ('active_jobs' in c ? (c as RawCompanyInput).active_jobs : 1) || 1;
                const jobCount = typeof rawJobs === 'number' ? rawJobs : 1;
                const category = c.category || ('industry' in c ? (c as RawCompanyInput).industry : 'Logistics & Trade Services') || 'Logistics & Trade Services';
                const location = c.location || ('city' in c ? (c as RawCompanyInput).city : 'India') || 'India';

                map.set(key, {
                    id: c.id || ('_id' in c ? (c as RawCompanyInput)._id : undefined),
                    name: clean,
                    logo: String(logo),
                    openings: c.openings || `${jobCount} Openings`,
                    jobCount,
                    category: String(category),
                    location: String(location),
                    rating: c.rating || '4.6',
                    reviews: c.reviews || 'Verified Employer',
                    verified: true,
                });
            }
        });
    }

    // Append enterprise partners if not already present
    ENTERPRISE_COMPANIES.forEach((p) => {
        const key = p.name.toLowerCase();
        if (!map.has(key)) {
            map.set(key, p);
        }
    });

    return Array.from(map.values());
}
