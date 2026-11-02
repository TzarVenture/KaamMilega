'use client';

// Applying for jobs unlocks at the Professional tier (70% profile, docs/client_queries_deep_analysis.md
// §1.1). Before the first application this asks for what is missing (role, skills, experience,
// education) in one short sheet; after that, applying is one click. The backend enforces the same
// rule (PROFILE_INCOMPLETE), so this is the friendly path, not the only check.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { CaretDownIcon, XIcon } from '@phosphor-icons/react';
import { FieldError, SubmitButton, inputClass, labelClass, linkClass } from '@/components/auth/AuthUI';
import api from '@/lib/axios';
import { fetchProfileCompletion, notifyProfileUpdated, type ProfileCompletion } from '@/lib/profileStrength';
import { errorText } from '@/lib/notify';

/** Matches ProfessionalTierScore in km-backend user/profile_completion.go */
export const APPLY_MIN_SCORE = 70;
const MIN_SKILLS = 2;

// Stored values stay in English. Experience values are ones the backend reads as years
// (declaredExperienceYears), which also decides Expert eligibility.
const EXPERIENCE: [key: string, value: string][] = [
    ['fresher', 'Fresher'],
    ['lt1', '6 Months'],
    ['y1', '1 Year'],
    ['y2', '2 Years'],
    ['y3', '3+ Years'],
    ['y5', '5+ Years'],
];
const EDUCATION: [key: string, value: string][] = [
    ['below10', 'Below 10th'],
    ['tenth', '10th Pass'],
    ['twelfth', '12th Pass'],
    ['diploma', 'ITI / Diploma'],
    ['graduate', 'Graduate'],
    ['postgraduate', 'Post Graduate'],
];

type GateField = 'city' | 'role' | 'skills' | 'experience' | 'education';
const FIELD_IDS: Record<GateField, string> = {
    city: 'gate-city',
    role: 'gate-role',
    skills: 'gate-skill',
    experience: 'gate-experience',
    education: 'gate-education',
};

interface GateProfile {
    city?: string;
    headline?: string;
    skills?: string[];
    work_experience?: string;
    education_level?: string;
}

/**
 * ensureCanApply() resolves true when the person may apply (asking for missing details first),
 * false when they close the sheet. Render `sheet` once in the page.
 */
export function useApplyGate() {
    const [open, setOpen] = useState<{ completion: ProfileCompletion; profile: GateProfile } | null>(null);
    const resolver = useRef<((ok: boolean) => void) | null>(null);

    const ensureCanApply = useCallback(async (): Promise<boolean> => {
        const completion = await fetchProfileCompletion().catch(() => null);
        // Unknown score: let the backend decide (it answers PROFILE_INCOMPLETE if needed)
        if (!completion || completion.score >= APPLY_MIN_SCORE) return true;
        const profile = ((await api.get('/user/profile').catch(() => null)) || {}) as GateProfile;
        return new Promise<boolean>((resolve) => {
            resolver.current = resolve;
            setOpen({ completion, profile });
        });
    }, []);

    const finish = (ok: boolean) => {
        setOpen(null);
        resolver.current?.(ok);
        resolver.current = null;
    };

    const sheet = open ? <ApplyProfileSheet completion={open.completion} profile={open.profile} onDone={finish} /> : null;
    return { ensureCanApply, sheet };
}

/** True when an apply request was refused because the profile is below the apply tier */
export function isProfileIncomplete(err: unknown): boolean {
    return (err as { code?: unknown } | null)?.code === 'PROFILE_INCOMPLETE';
}

export function ApplyProfileSheet({
    completion,
    profile,
    onDone,
}: {
    completion: ProfileCompletion;
    profile: GateProfile;
    onDone: (ok: boolean) => void;
}) {
    const t = useTranslations('applyGate');
    const missing = new Set(completion.criteria.filter((c) => !c.completed).map((c) => c.id));

    // Only what is missing; skills also show when there is one but fewer than two
    const ask = {
        city: missing.has('city'),
        role: missing.has('headline'),
        skills: missing.has('skills'),
        experience: missing.has('work_experience'),
        education: missing.has('education'),
    };

    const [city, setCity] = useState(profile.city || '');
    const [role, setRole] = useState(profile.headline || '');
    const [skills, setSkills] = useState<string[]>(profile.skills || []);
    const [skillDraft, setSkillDraft] = useState('');
    const [experience, setExperience] = useState(profile.work_experience || '');
    const [education, setEducation] = useState(profile.education_level || '');
    const [saving, setSaving] = useState(false);
    // A missing field shows its message under that field; a failed save shows above the buttons
    const [fieldError, setFieldError] = useState<{ field: GateField; message: string } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [stillShort, setStillShort] = useState<number | null>(null);

    const errorFor = (field: GateField) => (fieldError?.field === field ? fieldError.message : null);
    const flagField = (field: GateField, message: string) => {
        setFieldError({ field, message });
        // Bring the field into view (the form scrolls) and put the cursor there
        const el = document.getElementById(FIELD_IDS[field]);
        el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        (el?.matches('input, select') ? el : el?.querySelector('input'))?.focus({ preventScroll: true });
    };

    // Escape closes; the page behind doesn't scroll while the sheet is open
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onDone(false);
        };
        document.addEventListener('keydown', onKey);
        const previous = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = previous;
        };
    }, [onDone]);

    const addSkill = (text: string = skillDraft) => {
        const s = text.replace(/,/g, ' ').trim();
        if (s && !skills.some((x) => x.toLowerCase() === s.toLowerCase())) setSkills([...skills, s]);
        setSkillDraft('');
        setFieldError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // A skill still in the box counts, so nobody loses the last one they typed
        const allSkills = skillDraft.trim() && !skills.includes(skillDraft.trim()) ? [...skills, skillDraft.trim()] : skills;

        if (ask.city && !city.trim()) return flagField('city', t('cityRequired'));
        if (ask.role && !role.trim()) return flagField('role', t('roleRequired'));
        if (ask.skills && allSkills.length < MIN_SKILLS) return flagField('skills', t('skillsRequired'));
        if (ask.experience && !experience) return flagField('experience', t('experienceRequired'));
        if (ask.education && !education) return flagField('education', t('educationRequired'));
        setFieldError(null);

        const updates: Record<string, unknown> = {};
        if (ask.city) updates.city = city.trim();
        if (ask.role) updates.headline = role.trim();
        if (ask.skills) updates.skills = allSkills;
        if (ask.experience) updates.work_experience = experience;
        if (ask.education) updates.education_level = education;

        setError(null);
        setSaving(true);
        try {
            const updated = (await api.patch('/user/profile', updates)) as Record<string, unknown> | null;
            notifyProfileUpdated(updated || undefined);
            const after = await fetchProfileCompletion().catch(() => null);
            if (after && after.score < APPLY_MIN_SCORE) {
                setStillShort(after.score);
                setSaving(false);
                return;
            }
            onDone(true);
        } catch (err: unknown) {
            setError(errorText(err, t('saveFailed')));
            setSaving(false);
        }
    };

    const score = Math.max(0, Math.min(100, completion.score));

    return (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center bg-black/50" onClick={() => onDone(false)}>
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="apply-gate-title"
                onClick={(e) => e.stopPropagation()}
                className="w-full sm:max-w-[480px] max-h-[92dvh] flex flex-col bg-km-surface-card text-km-text-primary rounded-t-[24px] sm:rounded-2xl shadow-2xl km-sheet-in"
            >
                {/* Header: what this is and how close they are */}
                <div className="px-5 sm:px-6 pt-3 sm:pt-5 pb-4 border-b border-km-border">
                    <span className="mx-auto mb-3 block h-1 w-10 rounded-full bg-km-border sm:hidden" aria-hidden="true" />
                    <div className="flex items-start justify-between gap-3">
                        <h2 id="apply-gate-title" className="text-xl font-bold tracking-[-0.01em] text-km-heading leading-snug">
                            {t('title')}
                        </h2>
                        <button
                            type="button"
                            onClick={() => onDone(false)}
                            aria-label={t('close')}
                            className="-mr-2 -mt-1 p-2 rounded-lg text-km-text-secondary hover:text-km-heading hover:bg-km-surface cursor-pointer"
                        >
                            <XIcon size={20} />
                        </button>
                    </div>
                    <p className="mt-1 text-sm leading-relaxed text-km-text-secondary">{t('subtitle')}</p>
                    <div className="mt-3">
                        <div className="flex justify-between text-xs font-medium text-km-text-secondary">
                            <span>{t('progress', { score, min: APPLY_MIN_SCORE })}</span>
                        </div>
                        <div className="relative mt-1.5 h-2 rounded-full bg-km-border overflow-hidden">
                            <div className="h-full rounded-full bg-[#FF6B00] transition-[width] duration-500" style={{ width: `${Math.max(4, score)}%` }} />
                            <span className="absolute inset-y-0 w-0.5 bg-km-surface-card" style={{ left: `${APPLY_MIN_SCORE}%` }} aria-hidden="true" />
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} noValidate className="flex-1 min-h-0 flex flex-col">
                    <div className="flex-1 overflow-y-auto overscroll-contain px-5 sm:px-6 py-5 space-y-4">
                        {ask.city && (
                            <div>
                                <label htmlFor="gate-city" className={labelClass}>{t('city')}</label>
                                <input id="gate-city" type="text" autoComplete="address-level2" enterKeyHint="next" placeholder={t('cityPlaceholder')} value={city} onChange={(e) => { setCity(e.target.value); setFieldError(null); }} aria-invalid={!!errorFor('city')} className={inputClass(!!errorFor('city'))} />
                                <FieldError message={errorFor('city')} />
                            </div>
                        )}

                        {ask.role && (
                            <div>
                                <label htmlFor="gate-role" className={labelClass}>{t('role')}</label>
                                <input id="gate-role" type="text" autoComplete="organization-title" enterKeyHint="next" placeholder={t('rolePlaceholder')} value={role} onChange={(e) => { setRole(e.target.value); setFieldError(null); }} aria-invalid={!!errorFor('role')} className={inputClass(!!errorFor('role'))} />
                                <FieldError message={errorFor('role')} />
                            </div>
                        )}

                        {ask.skills && (
                            <div>
                                <label htmlFor="gate-skill" className={labelClass}>{t('skills')}</label>
                                {skills.length > 0 && (
                                    <ul className="mb-2 flex flex-wrap gap-2">
                                        {skills.map((s) => (
                                            <li key={s} className="inline-flex items-center gap-1 h-9 pl-3 pr-1 rounded-full border border-km-border bg-km-surface text-sm font-medium">
                                                {s}
                                                <button
                                                    type="button"
                                                    onClick={() => setSkills(skills.filter((x) => x !== s))}
                                                    aria-label={t('removeSkill', { skill: s })}
                                                    className="p-1.5 rounded-full text-km-text-secondary hover:text-km-heading hover:bg-km-border cursor-pointer"
                                                >
                                                    <XIcon size={12} weight="bold" />
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                <div className="flex gap-2">
                                    <input
                                        id="gate-skill"
                                        type="text"
                                        enterKeyHint="enter"
                                        placeholder={t('skillsPlaceholder')}
                                        value={skillDraft}
                                        onChange={(e) => {
                                            // A comma ends a skill, like Enter
                                            if (e.target.value.endsWith(',')) addSkill(e.target.value);
                                            else setSkillDraft(e.target.value);
                                        }}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                addSkill();
                                            }
                                        }}
                                        aria-describedby="gate-skill-hint"
                                        aria-invalid={!!errorFor('skills')}
                                        className={`${inputClass(!!errorFor('skills'))} min-w-0`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => addSkill()}
                                        disabled={!skillDraft.trim()}
                                        className="h-12 shrink-0 px-4 rounded-xl text-[15px] font-semibold text-km-text-primary border-[1.5px] border-km-border hover:bg-km-surface transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {t('addSkill')}
                                    </button>
                                </div>
                                <p id="gate-skill-hint" className="mt-1.5 text-[13px] text-km-text-secondary">{t('skillsHint')}</p>
                                <FieldError message={errorFor('skills')} />
                            </div>
                        )}

                        {ask.experience && (
                            <fieldset id="gate-experience">
                                <legend className={labelClass}>{t('experience')}</legend>
                                <div className="flex flex-wrap gap-2">
                                    {EXPERIENCE.map(([key, value]) => {
                                        const selected = experience === value;
                                        return (
                                            <label
                                                key={key}
                                                className={`inline-flex items-center h-10 px-3.5 rounded-full border-[1.5px] text-sm font-medium cursor-pointer transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#DCE8FB] dark:has-[:focus-visible]:ring-[#16294F] ${
                                                    selected ? 'border-km-link bg-[#F1F6FE] text-km-link dark:bg-[#12224A]' : 'border-km-border text-km-text-primary hover:bg-km-surface'
                                                }`}
                                            >
                                                <input type="radio" name="gate-experience" className="sr-only" checked={selected} onChange={() => { setExperience(value); setFieldError(null); }} />
                                                {t(`experienceOptions.${key}`)}
                                            </label>
                                        );
                                    })}
                                </div>
                                <FieldError message={errorFor('experience')} />
                            </fieldset>
                        )}

                        {ask.education && (
                            <div>
                                <label htmlFor="gate-education" className={labelClass}>{t('education')}</label>
                                <div className="relative">
                                    <select
                                        id="gate-education"
                                        value={education}
                                        onChange={(e) => { setEducation(e.target.value); setFieldError(null); }}
                                        aria-invalid={!!errorFor('education')}
                                        className={`${inputClass(!!errorFor('education'))} appearance-none pr-10 cursor-pointer ${education ? '' : 'text-km-text-muted'}`}
                                    >
                                        <option value="">{t('educationPlaceholder')}</option>
                                        {EDUCATION.map(([key, value]) => (
                                            <option key={key} value={value}>{t(`educationOptions.${key}`)}</option>
                                        ))}
                                    </select>
                                    <CaretDownIcon size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-km-text-secondary" aria-hidden="true" />
                                </div>
                                <FieldError message={errorFor('education')} />
                            </div>
                        )}

                        {stillShort !== null && (
                            <p role="status" className="text-sm leading-relaxed text-km-text-secondary">
                                {t('stillShort', { score: stillShort })}{' '}
                                <Link href="/profile" className={linkClass}>{t('openProfile')}</Link>
                            </p>
                        )}
                        <FieldError message={error} />
                    </div>

                    {/* Actions stay visible above the phone keyboard */}
                    <div className="px-5 sm:px-6 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-km-border space-y-2">
                        <SubmitButton disabled={false} busy={saving} label={t('submit')} busyLabel={t('saving')} />
                        <button type="button" onClick={() => onDone(false)} className="w-full h-11 rounded-xl text-[15px] font-semibold text-km-text-secondary hover:text-km-heading hover:bg-km-surface cursor-pointer">
                            {t('cancel')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
