'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { CaretDownIcon, CheckCircleIcon, FileTextIcon, ImageIcon, StorefrontIcon, UsersThreeIcon } from '@phosphor-icons/react';
import { CompanyArt, VerifyArt, WelcomeArt } from '@/components/auth/AuthArt';
import {
    AuthShell,
    BackButton,
    FieldError,
    Notice,
    SecondaryButton,
    StepHeading,
    SubmitButton,
    actionLinkClass,
    inputClass,
    labelClass,
    linkClass,
} from '@/components/auth/AuthUI';
import OtpInput from '@/components/ui/OtpInput';
import api from '@/lib/axios';
import { isAuthenticated, saveSession, type StoredUser } from '@/lib/auth';
import { uploadFile } from '@/lib/upload';
import { errorText } from '@/lib/notify';

export type EmployerSetupStep = 'you' | 'company' | 'verify';
const STEPS: EmployerSetupStep[] = ['you', 'company', 'verify'];

// Stored values stay in English (they are what existing companies already have); the labels
// come from the messages
const INDUSTRIES: [key: string, value: string][] = [
    ['it', 'Information Technology & Services'],
    ['manufacturing', 'Manufacturing & Engineering'],
    ['healthcare', 'Healthcare & Pharmaceuticals'],
    ['logistics', 'Logistics, Supply Chain & Transport'],
    ['retail', 'Retail & E-Commerce'],
    ['hospitality', 'Hospitality & Food Services'],
    ['finance', 'Banking & Financial Services'],
    ['construction', 'Construction, Real Estate & Trades'],
    ['education', 'Education & EdTech'],
    ['staffing', 'Staffing & Executive Search'],
    ['other', 'Other Industry'],
];

// Document names are saved in English for the team that reviews them
const DOCUMENTS: [key: string, name: string][] = [
    ['gst', 'GST Certificate'],
    ['pan', 'Company PAN Card'],
    ['incorporation', 'Certificate of Incorporation'],
    ['msme', 'MSME / Udyam Certificate'],
    ['shop', 'Shop & Establishment License'],
];

const PERSONAL_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'rediffmail.com', 'icloud.com'];
const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_DOC_BYTES = 5 * 1024 * 1024;
const RESEND_SECONDS = 30;

type ProfileUser = StoredUser & {
    headline?: string;
    is_consultant?: boolean;
    company_name?: string;
    company_website?: string;
    company_logo?: string;
    industry?: string;
    gst?: string;
    email?: string;
    is_email_verified?: boolean;
};

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** "acme.in" -> "https://acme.in"; empty stays empty */
const normalizeWebsite = (value: string) => {
    const v = value.trim();
    if (!v) return '';
    return /^https?:\/\//i.test(v) ? v : `https://${v}`;
};

export default function EmployerSetupView({
    previewStep,
}: {
    /** Design preview (app/dev/auth): open on a step and skip loading the account */
    previewStep?: EmployerSetupStep;
}) {
    const router = useRouter();
    const t = useTranslations('auth.setup');
    const ta = useTranslations('auth');

    const [step, setStep] = useState<EmployerSetupStep>(previewStep || 'you');

    // About you
    const [fullName, setFullName] = useState('');
    const [designation, setDesignation] = useState('');
    const [isConsultant, setIsConsultant] = useState<boolean | null>(previewStep ? false : null);

    // Company
    const [companyName, setCompanyName] = useState('');
    const [website, setWebsite] = useState('');
    const [industry, setIndustry] = useState('');
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [savedLogo, setSavedLogo] = useState('');

    // Verification
    const [email, setEmail] = useState('');
    const [emailVerified, setEmailVerified] = useState(false);
    const [codeSent, setCodeSent] = useState(false);
    const [code, setCode] = useState<string[]>(['', '', '', '']);
    const [resendTimer, setResendTimer] = useState(0);
    const [docType, setDocType] = useState(DOCUMENTS[0][0]);
    const [docNumber, setDocNumber] = useState('');
    const [docFile, setDocFile] = useState<File | null>(null);

    const [loading, setLoading] = useState(false);
    const [emailBusy, setEmailBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailError, setEmailError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    // One code check at a time (auto-submit on the 4th digit and autofill can both fire)
    const verifyingRef = useRef(false);

    // Signed-in accounts only: prefill from the server, which knows what the other portal saved
    useEffect(() => {
        if (previewStep) return;
        if (!isAuthenticated()) {
            router.replace('/recruiter/login?redirect=/recruiter/register');
            return;
        }
        let cancelled = false;
        api.get('/user/profile')
            .then((u: ProfileUser) => {
                if (cancelled || !u) return;
                setFullName(u.name || '');
                setDesignation(u.headline || '');
                if (u.company_name) {
                    // Returning employer: keep their choices
                    setIsConsultant(Boolean(u.is_consultant));
                    setCompanyName(u.company_name);
                    // /recruiter/register?step=verify reopens verification for an existing company
                    if (new URLSearchParams(window.location.search).get('step') === 'verify') setStep('verify');
                }
                setWebsite((u.company_website || '').replace(/^https?:\/\//i, ''));
                setIndustry(INDUSTRIES.find(([, value]) => value === u.industry)?.[1] || '');
                setSavedLogo(u.company_logo || '');
                setDocNumber(u.gst || '');
                setEmail(u.email || '');
                setEmailVerified(Boolean(u.email && u.is_email_verified));
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [previewStep, router]);

    useEffect(() => {
        if (resendTimer <= 0) return;
        const timer = setTimeout(() => setResendTimer((s) => s - 1), 1000);
        return () => clearTimeout(timer);
    }, [resendTimer]);

    useEffect(() => {
        return () => {
            if (logoPreview) URL.revokeObjectURL(logoPreview);
        };
    }, [logoPreview]);

    const goTo = (next: EmployerSetupStep) => {
        setStep(next);
        setError(null);
        setNotice(null);
        window.scrollTo({ top: 0 });
    };

    const finish = () => router.push('/recruiter');

    // Step 1: about you
    const handleYou = (e: React.FormEvent) => {
        e.preventDefault();
        if (fullName.trim().length < 2) {
            setError(t('you.nameInvalid'));
            return;
        }
        if (isConsultant === null) {
            setError(t('you.hiringForRequired'));
            return;
        }
        goTo('company');
    };

    // Step 2: company. Saved now, so the employer account works even if they stop here.
    const handleCompany = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!companyName.trim()) {
            setError(t('company.nameInvalid'));
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const companyLogo = logoFile ? (await uploadFile(logoFile, 'company_logo')).url : undefined;
            const user = (await api.post('/user/register', {
                roles: ['recruiter'],
                name: fullName.trim(),
                headline: designation.trim() || undefined,
                is_consultant: Boolean(isConsultant),
                company_name: companyName.trim(),
                company_website: normalizeWebsite(website) || undefined,
                company_logo: companyLogo,
                industry: industry || undefined,
            })) as ProfileUser | null;

            if (user) {
                saveSession(user, 'recruiter');
                window.dispatchEvent(new Event('km:auth-changed'));
                window.dispatchEvent(new Event('km:profile-updated'));
            }
            if (companyLogo) {
                setSavedLogo(companyLogo);
                setLogoFile(null);
            }
            goTo('verify');
            setNotice(t('saved'));
        } catch (err: unknown) {
            setError(errorText(err, ta('genericError')));
        } finally {
            setLoading(false);
        }
    };

    const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > MAX_LOGO_BYTES) {
            setError(t('company.logoTooBig'));
            return;
        }
        setError(null);
        setLogoFile(file);
        setLogoPreview(URL.createObjectURL(file));
    };

    // Step 3: work email
    const sendEmailCode = async () => {
        const clean = email.trim().toLowerCase();
        if (!isValidEmail(clean)) {
            setEmailError(t('verify.emailInvalid'));
            return;
        }
        setEmailError(null);
        setEmailBusy(true);
        try {
            await api.post('/auth/otp/email/send', { email: clean });
            setCode(['', '', '', '']);
            setCodeSent(true);
            setResendTimer(RESEND_SECONDS);
        } catch (err: unknown) {
            setEmailError(errorText(err, ta('sendFailed')));
        } finally {
            setEmailBusy(false);
        }
    };

    const verifyEmailCode = async (value: string) => {
        if (verifyingRef.current) return;
        if (value.length !== 4) {
            setEmailError(t('verify.codeIncomplete'));
            return;
        }
        verifyingRef.current = true;
        setEmailError(null);
        setEmailBusy(true);
        try {
            await api.post('/auth/otp/email/verify', { email: email.trim().toLowerCase(), code: value });
            setEmailVerified(true);
            setCodeSent(false);
            window.dispatchEvent(new Event('km:profile-updated'));
        } catch (err: unknown) {
            setEmailError(errorText(err, ta('code.invalid')));
            setCode(['', '', '', '']);
        } finally {
            verifyingRef.current = false;
            setEmailBusy(false);
        }
    };

    const handleDocFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = '';
        if (!file) return;
        if (file.size > MAX_DOC_BYTES) {
            setError(t('verify.fileTooBig'));
            return;
        }
        setError(null);
        setDocFile(file);
    };

    // Step 3 finish: send the document (if any) for review, then open the dashboard
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!docFile && !docNumber.trim()) {
            finish();
            return;
        }
        setError(null);
        setLoading(true);
        try {
            const docName = DOCUMENTS.find(([key]) => key === docType)?.[1] || 'Company document';
            const documents = docFile
                ? [{ name: docNumber.trim() ? `${docName} (${docNumber.trim()})` : docName, url: (await uploadFile(docFile, 'company_document')).url }]
                : undefined;
            const user = (await api.post('/user/register', {
                roles: ['recruiter'],
                name: fullName.trim(),
                // Sent again: the backend sets it on every employer registration
                is_consultant: Boolean(isConsultant),
                company_name: companyName.trim(),
                gst: docNumber.trim() || undefined,
                company_documents: documents,
            })) as ProfileUser | null;
            if (user) saveSession(user, 'recruiter');
            finish();
        } catch (err: unknown) {
            setError(errorText(err, ta('genericError')));
            setLoading(false);
        }
    };

    const stepIndex = STEPS.indexOf(step);
    const emailDomain = email.includes('@') ? email.split('@')[1]?.trim().toLowerCase() : '';
    const personalEmail = PERSONAL_EMAIL_DOMAINS.includes(emailDomain);
    const shownLogo = logoPreview || savedLogo;

    const hiringOptions = [
        { value: false, title: t('you.own'), hint: t('you.ownHint'), Icon: StorefrontIcon },
        { value: true, title: t('you.clients'), hint: t('you.clientsHint'), Icon: UsersThreeIcon },
    ];

    return (
        <AuthShell brand="employer">
            {/* Progress: where they are and how much is left */}
            <div className="mb-6">
                <p className="text-sm font-medium text-km-text-secondary">
                    {t('stepOf', { current: stepIndex + 1, total: STEPS.length })}
                    <span aria-hidden="true"> · </span>
                    <span className="text-km-text-primary">{t(`steps.${step}`)}</span>
                    {step === 'verify' && <span className="text-km-text-secondary"> ({t('optional')})</span>}
                </p>
                <div
                    className="mt-2.5 grid grid-cols-3 gap-1.5"
                    role="progressbar"
                    aria-valuemin={1}
                    aria-valuemax={STEPS.length}
                    aria-valuenow={stepIndex + 1}
                    aria-label={t('stepOf', { current: stepIndex + 1, total: STEPS.length })}
                >
                    {STEPS.map((s, i) => (
                        <span key={s} className="h-1.5 rounded-full bg-km-border overflow-hidden">
                            <span
                                className="block h-full rounded-full bg-[#FF6B00] transition-[width] duration-500 ease-out"
                                style={{ width: i <= stepIndex ? '100%' : '0%' }}
                            />
                        </span>
                    ))}
                </div>
            </div>

            <Notice message={notice} />

            {step === 'you' && (
                <form onSubmit={handleYou} noValidate>
                    <StepHeading art={<WelcomeArt className="w-14 h-14 mb-4" />} title={t('you.title')} subtitle={t('you.subtitle')} />

                    <label htmlFor="setup-name" className={labelClass}>{t('you.name')}</label>
                    <input
                        id="setup-name"
                        type="text"
                        autoComplete="name"
                        enterKeyHint="next"
                        placeholder={t('you.namePlaceholder')}
                        value={fullName}
                        onChange={(e) => {
                            setFullName(e.target.value);
                            setError(null);
                        }}
                        className={inputClass(false)}
                    />

                    <label htmlFor="setup-designation" className={`${labelClass} mt-4`}>
                        {t('you.designation')} <span className="font-normal text-km-text-secondary">({t('optional')})</span>
                    </label>
                    <input
                        id="setup-designation"
                        type="text"
                        autoComplete="organization-title"
                        enterKeyHint="next"
                        placeholder={t('you.designationPlaceholder')}
                        value={designation}
                        onChange={(e) => setDesignation(e.target.value)}
                        className={inputClass(false)}
                    />

                    <fieldset className="mt-5">
                        <legend className={labelClass}>{t('you.hiringFor')}</legend>
                        <div className="grid gap-2.5 sm:grid-cols-2">
                            {hiringOptions.map(({ value, title, hint, Icon }) => {
                                const selected = isConsultant === value;
                                return (
                                    <label
                                        key={String(value)}
                                        className={`flex items-start gap-3 rounded-xl border-[1.5px] p-3.5 cursor-pointer transition-colors has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-[#DCE8FB] dark:has-[:focus-visible]:ring-[#16294F] ${
                                            selected ? 'border-km-link bg-[#F1F6FE] dark:bg-[#12224A]' : 'border-km-border hover:bg-km-surface'
                                        }`}
                                    >
                                        <input
                                            type="radio"
                                            name="hiring-for"
                                            className="sr-only"
                                            checked={selected}
                                            onChange={() => {
                                                setIsConsultant(value);
                                                setError(null);
                                            }}
                                        />
                                        <Icon size={22} weight={selected ? 'fill' : 'regular'} className={`shrink-0 mt-px ${selected ? 'text-km-link' : 'text-km-text-secondary'}`} aria-hidden="true" />
                                        <span className="min-w-0">
                                            <span className="block text-[15px] font-semibold text-km-text-primary">{title}</span>
                                            <span className="block mt-0.5 text-[13px] leading-snug text-km-text-secondary">{hint}</span>
                                        </span>
                                    </label>
                                );
                            })}
                        </div>
                    </fieldset>

                    <FieldError message={error} />
                    <div className="mt-6">
                        <SubmitButton disabled={false} busy={false} label={t('you.submit')} busyLabel={t('you.submit')} />
                    </div>
                    <p className="mt-6 text-[13px] leading-relaxed text-km-text-secondary">
                        {ta.rich('terms', {
                            terms: (chunks) => <Link href="/policies/terms" className={linkClass}>{chunks}</Link>,
                            privacy: (chunks) => <Link href="/policies/privacy" className={linkClass}>{chunks}</Link>,
                        })}
                    </p>
                </form>
            )}

            {step === 'company' && (
                <form onSubmit={handleCompany} noValidate>
                    <BackButton label={ta('back')} onClick={() => goTo('you')} />
                    <StepHeading
                        art={<CompanyArt className="w-14 h-14 mb-4" />}
                        title={isConsultant ? t('company.titleAgency') : t('company.title')}
                        subtitle={t('company.subtitle')}
                    />

                    <label htmlFor="setup-company" className={labelClass}>{t('company.name')}</label>
                    <input
                        id="setup-company"
                        type="text"
                        autoComplete="organization"
                        enterKeyHint="next"
                        placeholder={t('company.namePlaceholder')}
                        value={companyName}
                        onChange={(e) => {
                            setCompanyName(e.target.value);
                            setError(null);
                        }}
                        aria-invalid={(Boolean(error) && !companyName.trim()) || undefined}
                        className={inputClass(Boolean(error) && !companyName.trim())}
                        autoFocus
                    />

                    <label htmlFor="setup-industry" className={`${labelClass} mt-4`}>
                        {t('company.industry')} <span className="font-normal text-km-text-secondary">({t('optional')})</span>
                    </label>
                    <div className="relative">
                        <select
                            id="setup-industry"
                            value={industry}
                            onChange={(e) => setIndustry(e.target.value)}
                            className={`${inputClass(false)} appearance-none pr-10 cursor-pointer ${industry ? '' : 'text-km-text-muted'}`}
                        >
                            <option value="">{t('company.industryPlaceholder')}</option>
                            {INDUSTRIES.map(([key, value]) => (
                                <option key={key} value={value}>{t(`industries.${key}`)}</option>
                            ))}
                        </select>
                        <CaretDownIcon size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-km-text-secondary" aria-hidden="true" />
                    </div>

                    <label htmlFor="setup-website" className={`${labelClass} mt-4`}>
                        {t('company.website')} <span className="font-normal text-km-text-secondary">({t('optional')})</span>
                    </label>
                    <input
                        id="setup-website"
                        type="text"
                        inputMode="url"
                        autoComplete="url"
                        autoCapitalize="none"
                        spellCheck={false}
                        enterKeyHint="done"
                        placeholder={t('company.websitePlaceholder')}
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        className={inputClass(false)}
                    />

                    <span className={`${labelClass} mt-4`}>
                        {t('company.logo')} <span className="font-normal text-km-text-secondary">({t('optional')})</span>
                    </span>
                    <div className="flex items-center gap-3.5">
                        <span className="w-14 h-14 shrink-0 rounded-xl border-[1.5px] border-dashed border-km-border bg-km-surface flex items-center justify-center overflow-hidden">
                            {shownLogo ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={shownLogo} alt="" className="w-full h-full object-contain" />
                            ) : (
                                <ImageIcon size={22} className="text-km-text-muted" aria-hidden="true" />
                            )}
                        </span>
                        <div className="min-w-0">
                            <input id="setup-logo" type="file" accept="image/png,image/jpeg,image/svg+xml" onChange={handleLogo} className="sr-only peer" />
                            <label htmlFor="setup-logo" className={`${actionLinkClass} peer-focus-visible:underline`}>
                                {shownLogo ? t('company.logoChange') : t('company.logoUpload')}
                            </label>
                            <p className="text-[13px] text-km-text-secondary">{t('company.logoHint')}</p>
                        </div>
                    </div>

                    <FieldError message={error} />
                    <div className="mt-6">
                        <SubmitButton disabled={!companyName.trim()} busy={loading} label={t('company.submit')} busyLabel={t('company.saving')} />
                    </div>
                </form>
            )}

            {step === 'verify' && (
                <form onSubmit={handleVerify} noValidate>
                    <BackButton label={ta('back')} onClick={() => goTo('company')} />
                    <StepHeading art={<VerifyArt className="w-14 h-14 mb-4" />} title={t('verify.title')} subtitle={t('verify.subtitle')} />

                    {/* Work email */}
                    <label htmlFor="setup-email" className={labelClass}>{t('verify.email')}</label>
                    {emailVerified ? (
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 dark:border-emerald-900 dark:bg-[#0F2A22]">
                            <span className="flex items-center gap-2 min-w-0 text-sm font-medium text-emerald-800 dark:text-emerald-300">
                                <CheckCircleIcon size={18} weight="fill" className="shrink-0" aria-hidden="true" />
                                <span className="truncate">{t('verify.verified', { email: email.trim() })}</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setEmailVerified(false);
                                    setCodeSent(false);
                                }}
                                className={actionLinkClass}
                            >
                                {t('verify.changeEmail')}
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="flex gap-2">
                                <input
                                    id="setup-email"
                                    type="email"
                                    autoComplete="email"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    enterKeyHint="send"
                                    placeholder={t('verify.emailPlaceholder')}
                                    value={email}
                                    disabled={codeSent}
                                    onChange={(e) => {
                                        setEmail(e.target.value);
                                        setEmailError(null);
                                    }}
                                    onKeyDown={(e) => {
                                        // Enter sends the code instead of submitting the whole step
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            if (!codeSent) sendEmailCode();
                                        }
                                    }}
                                    aria-invalid={(Boolean(emailError) && !codeSent) || undefined}
                                    className={`${inputClass(Boolean(emailError) && !codeSent)} min-w-0`}
                                />
                                {!codeSent && (
                                    <button
                                        type="button"
                                        onClick={sendEmailCode}
                                        disabled={emailBusy || !isValidEmail(email)}
                                        className="h-12 shrink-0 px-4 rounded-xl text-[15px] font-semibold text-white bg-km-primary hover:bg-km-primary-dark transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {emailBusy ? t('verify.sending') : t('verify.sendCode')}
                                    </button>
                                )}
                            </div>
                            {personalEmail && !codeSent && (
                                <p className="mt-2 text-[13px] leading-relaxed text-km-text-secondary">{t('verify.personal')}</p>
                            )}
                            {codeSent && (
                                <div className="mt-4">
                                    <p className="mb-3 text-sm text-km-text-secondary">
                                        {t('verify.codeSent', { email: email.trim() })}{' '}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setCodeSent(false);
                                                setEmailError(null);
                                            }}
                                            className={linkClass}
                                        >
                                            {t('verify.changeEmail')}
                                        </button>
                                    </p>
                                    <OtpInput
                                        value={code}
                                        align="start"
                                        disabled={emailBusy}
                                        invalid={Boolean(emailError)}
                                        onChange={(next) => {
                                            setCode(next);
                                            setEmailError(null);
                                            if (next.join('').length === 4) verifyEmailCode(next.join(''));
                                        }}
                                    />
                                    <div className="mt-2 min-h-11 flex items-center text-sm">
                                        {resendTimer > 0 ? (
                                            <span className="text-km-text-secondary font-inter">{t('verify.resendIn', { seconds: resendTimer })}</span>
                                        ) : (
                                            <button type="button" onClick={sendEmailCode} disabled={emailBusy} className={actionLinkClass}>
                                                {t('verify.resend')}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                            <FieldError message={emailError} />
                        </>
                    )}

                    {/* Business document */}
                    <div className="mt-6 pt-5 border-t border-km-border">
                        <p className="text-sm font-semibold text-km-text-primary">{t('verify.document')}</p>
                        <p className="mt-1 text-[13px] leading-relaxed text-km-text-secondary">{t('verify.documentHint')}</p>

                        <label htmlFor="setup-doc-type" className={`${labelClass} mt-4`}>{t('verify.docType')}</label>
                        <div className="relative">
                            <select
                                id="setup-doc-type"
                                value={docType}
                                onChange={(e) => setDocType(e.target.value)}
                                className={`${inputClass(false)} appearance-none pr-10 cursor-pointer`}
                            >
                                {DOCUMENTS.map(([key]) => (
                                    <option key={key} value={key}>{t(`docs.${key}`)}</option>
                                ))}
                            </select>
                            <CaretDownIcon size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-km-text-secondary" aria-hidden="true" />
                        </div>

                        <label htmlFor="setup-doc-number" className={`${labelClass} mt-4`}>{t('verify.docNumber')}</label>
                        <input
                            id="setup-doc-number"
                            type="text"
                            autoCapitalize="characters"
                            spellCheck={false}
                            placeholder={t('verify.docNumberPlaceholder')}
                            value={docNumber}
                            onChange={(e) => setDocNumber(e.target.value.toUpperCase())}
                            className={`${inputClass(false)} tracking-wide`}
                        />

                        <div className="mt-3 flex items-center gap-3 rounded-xl border-[1.5px] border-dashed border-km-border px-3.5 py-2">
                            <FileTextIcon size={22} className="shrink-0 text-km-text-secondary" aria-hidden="true" />
                            <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-km-text-primary">{docFile ? docFile.name : t('verify.fileHint')}</p>
                            </div>
                            <input id="setup-doc-file" type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleDocFile} className="sr-only peer" />
                            <label htmlFor="setup-doc-file" className={`${actionLinkClass} shrink-0 peer-focus-visible:underline`}>
                                {docFile ? t('verify.replace') : t('verify.attach')}
                            </label>
                        </div>
                    </div>

                    <FieldError message={error} />
                    <div className="mt-6 space-y-2.5">
                        <SubmitButton disabled={false} busy={loading} label={t('verify.finish')} busyLabel={t('verify.finishing')} />
                        <SecondaryButton label={t('verify.later')} onClick={finish} disabled={loading} />
                    </div>
                </form>
            )}
        </AuthShell>
    );
}
