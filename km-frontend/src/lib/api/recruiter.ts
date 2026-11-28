import api from '@/lib/axios';

/** Pipeline stages, in order. Rejected is shown as "Not selected". */
export const STAGES = ['Applied', 'Shortlisted', 'Interviewing', 'Hired', 'Rejected'] as const;
export type Stage = (typeof STAGES)[number];
/** A stage, or Withdrawn: set only by the candidate, never a move the employer can make */
export type AppStatus = Stage | 'Withdrawn';

/** Each stage's colour across the employer portal (service colours) */
export const STAGE_COLOR: Record<AppStatus, { dot: string; bar: string; chip: string }> = {
    Applied: { dot: 'bg-[#0B5ED7]', bar: 'bg-[#0B5ED7]', chip: 'bg-blue-50 text-blue-700 dark:bg-[#14357F] dark:text-[#93C5FD]' },
    Shortlisted: { dot: 'bg-[#7C3AED]', bar: 'bg-[#7C3AED]', chip: 'bg-violet-50 text-violet-700 dark:bg-[#24164A] dark:text-[#C4B5FD]' },
    Interviewing: { dot: 'bg-[#FF6B00]', bar: 'bg-[#FF6B00]', chip: 'bg-orange-50 text-orange-700 dark:bg-[#3A1F0B] dark:text-[#FDBA74]' },
    Hired: { dot: 'bg-[#16A34A]', bar: 'bg-[#16A34A]', chip: 'bg-emerald-50 text-emerald-700 dark:bg-[#0B2E22] dark:text-emerald-300' },
    Rejected: { dot: 'bg-slate-400', bar: 'bg-slate-400', chip: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300' },
    Withdrawn: { dot: 'bg-slate-300', bar: 'bg-slate-300', chip: 'bg-km-surface text-km-text-secondary border border-km-border' },
};

export type JobStatus = 'Open' | 'Paused' | 'Closed';

/** Any stored job status as Open, Paused or Closed (admin moderation may store lowercase values) */
export function jobStatus(s?: string): JobStatus {
    const v = String(s || '').toLowerCase().replace(/\s+/g, '');
    if (['paused', 'onhold', 'hold'].includes(v)) return 'Paused';
    if (['closed', 'expired', 'filled'].includes(v)) return 'Closed';
    return 'Open';
}

export interface MyJob {
    id: string;
    title: string;
    description?: string;
    company?: string;
    city_id?: string;
    city_name?: string;
    location?: string;
    salary_min?: number;
    salary_max?: number;
    job_type?: string;
    status?: string;
    experience_min?: number;
    experience_max?: number;
    requirements?: string[];
    we_offer?: string[];
    gender?: string;
    education?: string;
    created_at: string;
    updated_at?: string;
    applicant_count: number;
    stage_counts?: Partial<Record<Stage, number>>;
    /** Only on the employer's own jobs; the daily chart only for one job */
    views?: JobViews;
}

export interface JobViews {
    total: number;
    last_7_days: number;
    daily?: { date: string; count: number }[];
}

export interface MyJobsPage {
    jobs: MyJob[];
    total: number;
    page: number;
    limit: number;
    counts: { all: number; open: number; paused: number; closed: number };
}

export interface Candidate {
    id: string;
    name: string;
    username?: string;
    email?: string;
    mobile?: string;
    profile_image?: string;
    headline?: string;
    city?: string;
    skills?: string[];
}

export interface Applicant {
    id: string;
    job_id: string;
    candidate_id: string;
    status: AppStatus;
    cover_letter?: string;
    resume_url?: string;
    rating?: number;
    note?: string;
    history?: { status: AppStatus; at: string }[];
    created_at: string;
    updated_at?: string;
    candidate?: Candidate;
    job?: { id: string; title: string; city_name?: string; status?: string };
}

export interface ApplicantsPage {
    items: Applicant[];
    total: number;
    page: number;
    limit: number;
    stages: Record<Stage, number> & { Withdrawn?: number };
}

export interface TalentCard {
    id: string;
    name: string;
    username?: string;
    headline?: string;
    profile_image?: string;
    city?: string;
    skills?: string[];
    current_title?: string;
    current_company?: string;
    open_to_work: boolean;
    wanted_roles?: string[];
    resume_shared: boolean;
    verified: boolean;
}

export interface TalentPage {
    items: TalentCard[];
    total: number;
    page: number;
    limit: number;
}

export interface Interview {
    id: string;
    application_id: string;
    candidate_id: string;
    scheduled_at: string;
    type: string;
    location?: string;
    status: 'Scheduled' | 'Completed' | 'Cancelled' | string;
    notes?: string;
    created_at?: string;
    job?: { id?: string; title?: string; company?: string };
    candidate?: { id?: string; name?: string; email?: string; mobile?: string; headline?: string; profile_image?: string; username?: string };
}

const clean = (p: Record<string, unknown>) => Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v !== undefined && v !== null && v !== false));

export const recruiterApi = {
    jobs: (p: { search?: string; status?: string; page?: number; limit?: number }) =>
        api.get<unknown, MyJobsPage>('/jobs/mine', { params: clean(p) }),
    job: (id: string) => api.get<unknown, MyJob>(`/jobs/mine/${id}`),
    setJobStatus: (id: string, status: JobStatus) => api.patch<unknown, MyJob>(`/jobs/${id}/status`, { status }),
    duplicateJob: (id: string) => api.post<unknown, MyJob>(`/jobs/${id}/duplicate`),
    deleteJob: (id: string) => api.delete(`/jobs/${id}`),

    applicants: (p: { job_id?: string; status?: string; search?: string; sort?: string; page?: number; limit?: number }) =>
        api.get<unknown, ApplicantsPage>('/applications/recruiter/pipeline', { params: clean(p) }),
    move: (id: string, status: Stage) => api.patch(`/applications/${id}/status`, { status }),
    bulkMove: (ids: string[], status: Stage) =>
        api.post<unknown, { updated: string[]; failed: Record<string, string> }>('/applications/recruiter/bulk-status', { ids, status }),
    review: (id: string, body: { rating?: number; note?: string }) => api.patch(`/applications/${id}/review`, body),

    talent: (p: { search?: string; city?: string; skill?: string; open_to_work?: boolean; has_resume?: boolean; page?: number; limit?: number }) =>
        api.get<unknown, TalentPage>('/recruiter/talent', { params: clean(p) }),
    saved: (p: { page?: number; limit?: number }) => api.get<unknown, TalentPage>('/recruiter/saved', { params: clean(p) }),
    savedIds: () => api.get<unknown, { ids: string[] }>('/recruiter/saved/ids'),
    save: (id: string) => api.put(`/recruiter/saved/${id}`),
    unsave: (id: string) => api.delete(`/recruiter/saved/${id}`),

    interviews: () => api.get<unknown, Interview[]>('/interviews/my'),
    setInterviewStatus: (id: string, status: 'Scheduled' | 'Completed' | 'Cancelled') => api.patch(`/interviews/${id}/status`, { status }),
};
