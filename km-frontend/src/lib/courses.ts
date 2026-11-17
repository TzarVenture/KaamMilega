import type { CourseData } from '@/components/km/CourseCard';

/** Trades an Expert files a course video under ("Others" lets them type their own) */
export const COURSE_CATEGORIES = [
    'Vocational Skills',
    'Technology',
    'Electrician & Electrical',
    'Plumbing & Sanitation',
    'Construction & Carpentry',
    'Hospitality & Culinary',
    'Automotive & Mechanics',
    'Business & Sales',
    'Others',
];

/** Limits on a course listing, counted in words */
export const COURSE_LIMITS = { titleWords: 10, descriptionWords: 50 };

/** One page of the Expert's own courses from GET /courses/my */
export interface MyCoursesPage {
    data?: CourseData[];
    total?: number;
    total_pages?: number;
}

export function countWords(text: string): number {
    return text.trim().split(/\s+/).filter(Boolean).length;
}

/** A course's id (older records come back with _id) */
export function courseId(c: CourseData): string {
    return c.id || (c as CourseData & { _id?: string })._id || '';
}
