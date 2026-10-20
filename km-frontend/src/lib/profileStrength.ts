'use client';

import api from './axios';

export const PROFILE_UPDATED_EVENT = 'km:profile-updated';

export type ProfileModalKey =
    | 'education'
    | 'experience'
    | 'skill'
    | 'intro'
    | 'about'
    | 'photo'
    | 'background'
    | 'contact'
    | 'emailVerify'
    | 'project'
    | 'portfolioLink';

/** One scored checklist item, as returned by GET /user/profile-completion */
export interface ProfileCriterion {
    id: string;
    weight: number;
    earned: number;
    completed: boolean;
}

/** Response of GET /user/profile-completion. The backend is the only place the score is calculated. */
export interface ProfileCompletion {
    score: number;
    tier: number; // 0 below 30%, 1 Basic (30%), 2 Professional (70%), 3 Complete (100%)
    tier_name: string;
    missing_fields: string[];
    unlocked_services: string[];
    criteria: ProfileCriterion[];
    experience_years: number;
    expert_eligible: boolean;
}

/** Display text and the profile modal that completes each criterion */
export const CRITERION_META: Record<string, { title: string; hint: string; modalKey?: ProfileModalKey }> = {
    name: { title: 'Full name', hint: 'Add your full name', modalKey: 'intro' },
    mobile: { title: 'Mobile number', hint: 'Add your mobile number', modalKey: 'contact' },
    city: { title: 'City', hint: 'Add the city where you want to work', modalKey: 'intro' },
    headline: { title: 'Headline', hint: 'Add your job role, e.g. Electrician', modalKey: 'intro' },
    skills: { title: 'Skills (2+)', hint: 'Add at least 2 skills', modalKey: 'skill' },
    work_experience: { title: 'Work experience', hint: 'Add your past jobs or years of experience', modalKey: 'experience' },
    email: { title: 'Verified email', hint: 'Add and verify your email', modalKey: 'emailVerify' },
    education: { title: 'Education', hint: 'Add your highest qualification', modalKey: 'education' },
    profile_image: { title: 'Profile photo', hint: 'Upload a clear photo', modalKey: 'photo' },
    about: { title: 'About', hint: 'Write a short summary', modalKey: 'about' },
    portfolio: { title: 'Projects or portfolio', hint: 'Add a project or work link', modalKey: 'project' },
};

export function fetchProfileCompletion(): Promise<ProfileCompletion> {
    return api.get('/user/profile-completion') as Promise<ProfileCompletion>;
}

/**
 * Notifies listening components that profile data changed so they refetch the score.
 * Optionally merges the updated user into the cached session user.
 */
export function notifyProfileUpdated(updatedUser?: Record<string, unknown>) {
    if (typeof window === 'undefined') return;
    try {
        if (updatedUser) {
            const existing = localStorage.getItem('user');
            const merged = existing ? { ...JSON.parse(existing), ...updatedUser } : updatedUser;
            localStorage.setItem('user', JSON.stringify(merged));
        }
    } catch (e) {
        console.warn('Failed to persist user in localStorage:', e);
    }
    window.dispatchEvent(new CustomEvent(PROFILE_UPDATED_EVENT, { detail: updatedUser }));
}
