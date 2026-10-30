'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { EyeIcon, EyeSlashIcon } from '@phosphor-icons/react';
import { CodeSentArt, WelcomeArt } from '@/components/auth/AuthArt';
import {
    AuthShell,
    BackButton,
    FieldError,
    Notice,
    StepHeading,
    SubmitButton,
    actionLinkClass,
    inputClass,
    labelClass,
    linkClass,
    normalizeMobile,
} from '@/components/auth/AuthUI';
import OtpInput from '@/components/ui/OtpInput';
import api from '@/lib/axios';
import { saveSession, isAuthenticated, type StoredUser } from '@/lib/auth';
import { ACCOUNT_RESTORE_PATH, needsAccountRestore } from '@/lib/account';
import { isSignupComplete, safeRedirect } from '@/lib/authPaths';
import { errorText } from "@/lib/notify";

// Matches the backend (minPasswordLength in km-backend user/service.go)
const MIN_PASSWORD_LENGTH = 8;

// The user object the sign-in endpoints return
type AuthUser = StoredUser & { account_status?: string; company_name?: string; city?: string };

export type AuthPreviewStep = 'phone' | 'code' | 'details' | 'password' | 'forgot';

export interface UnifiedAuthViewProps {
    initialRole?: 'user' | 'recruiter';
    /** Design preview (app/dev/auth): open on a step and skip the signed-in redirect */
    previewStep?: AuthPreviewStep;
}

export default function UnifiedAuthView({
    initialRole = 'user',
    previewStep,
}: UnifiedAuthViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('auth');

    // Lock role cleanly to portal route: /login = user, /recruiter/login = recruiter
    const queryRole = searchParams.get('role');
    const role: 'user' | 'recruiter' =
        queryRole === 'recruiter' || initialRole === 'recruiter' ? 'recruiter' : 'user';
    const isRecruiter = role === 'recruiter';

    // authMethod: 'otp' | 'password' | 'forgot'
    const [authMethod, setAuthMethod] = useState<'otp' | 'password' | 'forgot'>(
        previewStep === 'password' || previewStep === 'forgot' ? previewStep : 'otp',
    );

    // OTP states: 'input' -> 'verify' -> 'name' (for new candidates)
    const [otpStep, setOtpStep] = useState<'input' | 'verify' | 'name'>(
        previewStep === 'code' ? 'verify' : previewStep === 'details' ? 'name' : 'input',
    );
    const [mobile, setMobile] = useState(previewStep === 'code' ? '9876543210' : '');
    const [otp, setOtp] = useState<string[]>(['', '', '', '']);
    const [resendTimer, setResendTimer] = useState(30);

    // New candidate registration input
    const [fullName, setFullName] = useState('');
    const [city, setCity] = useState('');
    const [cityOptions, setCityOptions] = useState<string[]>([]);
    const [verifiedUser, setVerifiedUser] = useState<StoredUser | null>(null);

    // Password credentials (available for candidates with existing passwords)
    const [identifier, setIdentifier] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    // Forgot password states
    const [forgotStep, setForgotStep] = useState<'request' | 'reset'>('request');
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotCode, setForgotCode] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    // Status & UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // One code check at a time. Auto-submit on the 4th digit, SMS autofill and the button can
    // all fire for the same code; once a code is accepted, later answers are ignored (they
    // used to show "invalid code" while the first one was already signing the person in).
    const verifyingRef = useRef(false);
    const verifiedRef = useRef(false);
    const sendingRef = useRef(false);

    // Same-site page to return to after sign-in
    const redirectTarget = safeRedirect(searchParams.get('redirect'));
    const candidateHome = redirectTarget || '/';
    const recruiterHome = redirectTarget?.startsWith('/recruiter') ? redirectTarget : '/recruiter';

    const cleanMobile = mobile.replace(/\D/g, '');

    // Already signed in: confirm the session with the server (saved browser data can outlive
    // it), then go on, or resume an unfinished sign-up
    useEffect(() => {
        if (previewStep || !isAuthenticated()) return;
        let cancelled = false;
        api.get('/user/profile')
            .then((user: AuthUser) => {
                if (cancelled || !user) return;
                const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
                if (isRecruiter) {
                    // Employer portal: straight in with a company, else the company form
                    router.replace(roles.includes('recruiter') && user.company_name?.trim() ? recruiterHome : '/recruiter/register');
                    return;
                }
                if (!isSignupComplete(user)) {
                    setVerifiedUser(user);
                    setFullName(user.name || '');
                    setCity(user.city || '');
                    setOtpStep('name');
                    return;
                }
                router.replace(candidateHome);
            })
            // A 401 clears the stale session (lib/axios); stay here and sign in
            .catch(() => {});
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router, isRecruiter]);

    // Resend countdown timer
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (otpStep === 'verify' && resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [otpStep, resendTimer]);

    // City suggestions for the signup name step
    useEffect(() => {
        if (otpStep !== 'name' || cityOptions.length > 0) return;
        api.get('/cities?active=true')
            .then((res: unknown) => {
                const list = (Array.isArray(res) ? res : (res as { data?: unknown[] })?.data || []) as { name?: string }[];
                // The city list can repeat a name (one per state or area): suggest each once
                const names = list.map((c) => c?.name?.trim()).filter((n): n is string => Boolean(n));
                setCityOptions([...new Set(names)]);
            })
            .catch(() => {});
    }, [otpStep, cityOptions.length]);

    const switchTo = (method: 'otp' | 'password' | 'forgot') => {
        setAuthMethod(method);
        setError(null);
        setSuccessMsg(null);
        if (method === 'otp') setOtpStep('input');
        if (method === 'forgot') setForgotStep('request');
    };

    // 1. Send Mobile OTP
    const handleSendOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (sendingRef.current) return;

        if (cleanMobile.length !== 10) {
            setError(t('phone.invalid'));
            return;
        }

        sendingRef.current = true;
        setError(null);
        setSuccessMsg(null);
        setLoading(true);

        try {
            await api.post('/auth/otp/send', {
                mobile: cleanMobile,
                role,
            });
            // A new code replaces the old one: start with empty boxes
            setOtp(['', '', '', '']);
            verifiedRef.current = false;
            setOtpStep('verify');
            setResendTimer(30);
        } catch (err: unknown) {
            setError(errorText(err, t('sendFailed')));
        } finally {
            sendingRef.current = false;
            setLoading(false);
        }
    };

    // 2. Verify OTP
    const handleVerifyOtp = async (explicitCode?: string, e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (verifyingRef.current || verifiedRef.current) return;
        const code = (typeof explicitCode === 'string' && explicitCode.trim().length === 4)
            ? explicitCode.trim()
            : otp.join('').trim();

        if (code.length !== 4) {
            setError(t('code.incomplete'));
            return;
        }

        verifyingRef.current = true;
        setError(null);
        setLoading(true);

        try {
            const res = (await api.post('/auth/otp/verify', {
                mobile: cleanMobile,
                code,
                role,
            })) as { user?: AuthUser };

            if (res && res.user) {
                const user = res.user;
                // Accepted: answers to any other check of this code no longer matter. The boxes
                // stay locked while the next page loads.
                verifiedRef.current = true;
                saveSession(user, role);
                // Deactivated or pending-deletion accounts restore themselves before anything else
                if (needsAccountRestore(user)) {
                    router.push(ACCOUNT_RESTORE_PATH);
                    return;
                }

                if (isRecruiter) {
                    const roles: string[] = Array.isArray(user.roles) ? user.roles : [];
                    const hasCompany = roles.includes('recruiter') && Boolean(user.company_name?.trim());

                    if (hasCompany) {
                        router.push(recruiterHome);
                    } else {
                        // An existing candidate adds an employer profile to the same account
                        const alreadyHadAccount = isSignupComplete(user);
                        if (alreadyHadAccount) {
                            setSuccessMsg(t('existingAccount'));
                        }
                        // Brief pause so user can read the message, then redirect
                        setTimeout(() => router.push('/recruiter/register'), alreadyHadAccount ? 1400 : 0);
                    }
                } else if (isSignupComplete(user)) {
                    router.push(candidateHome);
                } else {
                    // New here: create the account with name and city
                    setVerifiedUser(user);
                    setFullName(user.name || '');
                    setCity(user.city || '');
                    setOtpStep('name');
                    setLoading(false);
                }
            }
        } catch (err: unknown) {
            if (verifiedRef.current) return;
            setError(errorText(err, t('code.invalid')));
            // Clear the boxes for the next try
            setOtp(['', '', '', '']);
        } finally {
            verifyingRef.current = false;
            if (!verifiedRef.current) setLoading(false);
        }
    };

    // 3. Complete Name Step for New Candidate
    const handleCompleteName = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = fullName.trim();
        const cleanCity = city.trim();
        if (cleanName.length < 2) {
            setError(t('details.nameInvalid'));
            return;
        }
        if (!cleanCity) {
            setError(t('details.cityRequired'));
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const res = (await api.post('/user/register', {
                name: cleanName,
                city: cleanCity,
                roles: ['user'],
            })) as StoredUser | null;

            const updated = res || { ...(verifiedUser || {}), name: cleanName, city: cleanCity, is_registered: true };
            saveSession(updated, 'user');
            window.dispatchEvent(new Event('km:auth-changed'));
            window.dispatchEvent(new Event('km:profile-updated'));

            router.push(candidateHome);
        } catch (err: unknown) {
            setError(errorText(err, t('genericError')));
            setLoading(false);
        }
    };

    // 4. Password Login (Candidate fallback)
    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier.trim() || !password) {
            setError(t('password.required'));
            return;
        }

        setError(null);
        setSuccessMsg(null);
        setLoading(true);

        try {
            const res = (await api.post('/auth/login/password', {
                identifier: identifier.trim(),
                password,
                role,
            })) as { user?: AuthUser; requires_password_setup?: boolean; message?: string };

            if (res?.requires_password_setup) {
                setAuthMethod('otp');
                setOtpStep('input');
                const cleanDigits = identifier.replace(/\D/g, '');
                if (cleanDigits.length === 10) {
                    setMobile(cleanDigits);
                }
                setSuccessMsg(res.message || null);
                return;
            }

            if (res && res.user) {
                saveSession(res.user, 'user');
                if (needsAccountRestore(res.user)) {
                    router.push(ACCOUNT_RESTORE_PATH);
                    return;
                }
                if (!isSignupComplete(res.user)) {
                    // Has a password but never gave a name: finish creating the account
                    setVerifiedUser(res.user);
                    setCity(res.user.city || '');
                    setAuthMethod('otp');
                    setOtpStep('name');
                    return;
                }
                router.push(candidateHome);
            }
        } catch (err: unknown) {
            setError(errorText(err, t('password.failed')));
        } finally {
            setLoading(false);
        }
    };

    // 5. Send Forgot Password Code
    const handleSendForgotCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!/^\S+@\S+\.\S+$/.test(forgotEmail.trim())) {
            setError(t('forgot.emailInvalid'));
            return;
        }

        setError(null);
        setLoading(true);

        try {
            await api.post('/auth/password/forgot', {
                email: forgotEmail.trim(),
            });
            setForgotStep('reset');
            setSuccessMsg(null);
        } catch (err: unknown) {
            setError(errorText(err, t('genericError')));
        } finally {
            setLoading(false);
        }
    };

    // 6. Reset Password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (forgotCode.trim().length !== 4) {
            setError(t('forgot.codeInvalid'));
            return;
        }
        if (newPassword.length < MIN_PASSWORD_LENGTH) {
            setError(t('forgot.tooShort', { min: MIN_PASSWORD_LENGTH }));
            return;
        }

        setError(null);
        setLoading(true);

        try {
            await api.post('/auth/password/reset', {
                email: forgotEmail.trim(),
                code: forgotCode.trim(),
                password: newPassword,
            });
            setAuthMethod('password');
            setForgotStep('request');
            setForgotCode('');
            setNewPassword('');
            setSuccessMsg(t('forgot.done'));
        } catch (err: unknown) {
            setError(errorText(err, t('genericError')));
        } finally {
            setLoading(false);
        }
    };


    const terms = (
        <p className="mt-6 text-[13px] leading-relaxed text-km-text-secondary">
            {t.rich('terms', {
                terms: (chunks) => <Link href="/policies/terms" className={linkClass}>{chunks}</Link>,
                privacy: (chunks) => <Link href="/policies/privacy" className={linkClass}>{chunks}</Link>,
            })}
        </p>
    );

    return (
        <AuthShell brand={isRecruiter ? 'employer' : 'candidate'}>
                        <Notice message={successMsg} />

                        {authMethod === 'otp' && otpStep === 'input' && (
                            <form onSubmit={handleSendOtp} noValidate>
                                <StepHeading
                                    title={isRecruiter ? t('phone.titleEmployer') : t('phone.title')}
                                    subtitle={t('phone.subtitle')}
                                />
                                <label htmlFor="auth-mobile" className={labelClass}>{t('phone.label')}</label>
                                <div className="relative">
                                    <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 pr-3 my-3 border-r border-km-border text-base font-inter font-medium text-km-text-secondary pointer-events-none">
                                        +91
                                    </span>
                                    <input
                                        id="auth-mobile"
                                        type="tel"
                                        inputMode="numeric"
                                        autoComplete="tel-national"
                                        enterKeyHint="go"
                                        placeholder={t('phone.placeholder')}
                                        value={mobile}
                                        onChange={(e) => {
                                            setMobile(normalizeMobile(e.target.value));
                                            setError(null);
                                        }}
                                        aria-invalid={Boolean(error) || undefined}
                                        className={`${inputClass(Boolean(error))} pl-[4.25rem] tracking-wide`}
                                        autoFocus
                                    />
                                </div>
                                <FieldError message={error} />
                                <div className="mt-5">
                                    <SubmitButton disabled={cleanMobile.length !== 10} busy={loading} label={t('phone.submit')} busyLabel={t('phone.sending')} />
                                </div>

                                {!isRecruiter && (
                                    <button type="button" onClick={() => switchTo('password')} className={`mt-2 ${actionLinkClass}`}>
                                        {t('phone.usePassword')}
                                    </button>
                                )}

                                <div className="mt-5 pt-3 border-t border-km-border">
                                    <Link href={isRecruiter ? '/login' : '/recruiter/login'} className={actionLinkClass}>
                                        {isRecruiter ? t('phone.jobLink') : t('phone.hireLink')}
                                    </Link>
                                </div>
                                {terms}
                            </form>
                        )}

                        {authMethod === 'otp' && otpStep === 'verify' && (
                            <form onSubmit={(e) => handleVerifyOtp(otp.join(''), e)} noValidate>
                                <BackButton
                                    label={t('code.edit')}
                                    onClick={() => {
                                        setOtpStep('input');
                                        setOtp(['', '', '', '']);
                                        setError(null);
                                    }}
                                />
                                <StepHeading
                                    art={<CodeSentArt className="w-14 h-14 mb-4" />}
                                    title={t('code.title')}
                                    subtitle={t('code.sentTo', { mobile: `+91 ${cleanMobile.slice(0, 5)} ${cleanMobile.slice(5)}` })}
                                />
                                <OtpInput
                                    value={otp}
                                    align="start"
                                    disabled={loading}
                                    invalid={Boolean(error)}
                                    onChange={(newOtp) => {
                                        setOtp(newOtp);
                                        setError(null);
                                        if (newOtp.join('').trim().length === 4) {
                                            handleVerifyOtp(newOtp.join('').trim());
                                        }
                                    }}
                                />
                                <FieldError message={error} />
                                <div className="mt-3 min-h-11 flex items-center text-sm">
                                    {resendTimer > 0 ? (
                                        <span className="text-km-text-secondary font-inter">{t('code.resendIn', { seconds: resendTimer })}</span>
                                    ) : (
                                        <button type="button" onClick={() => handleSendOtp()} disabled={loading} className={actionLinkClass}>
                                            {t('code.resend')}
                                        </button>
                                    )}
                                </div>
                                <div className="mt-6">
                                    <SubmitButton disabled={otp.join('').length !== 4} busy={loading} label={t('code.submit')} busyLabel={t('code.verifying')} />
                                </div>
                            </form>
                        )}

                        {authMethod === 'otp' && otpStep === 'name' && (
                            <form onSubmit={handleCompleteName} noValidate>
                                <StepHeading
                                    art={<WelcomeArt className="w-14 h-14 mb-4" />}
                                    title={t('details.title')}
                                    subtitle={t('details.subtitle')}
                                />
                                <label htmlFor="auth-name" className={labelClass}>{t('details.name')}</label>
                                <input
                                    id="auth-name"
                                    type="text"
                                    enterKeyHint="next"
                                    autoComplete="name"
                                    placeholder={t('details.namePlaceholder')}
                                    value={fullName}
                                    onChange={(e) => {
                                        setFullName(e.target.value);
                                        setError(null);
                                    }}
                                    className={inputClass(false)}
                                    autoFocus
                                />
                                <label htmlFor="auth-city" className={`${labelClass} mt-4`}>{t('details.city')}</label>
                                <input
                                    id="auth-city"
                                    type="text"
                                    enterKeyHint="done"
                                    list="auth-city-options"
                                    autoComplete="address-level2"
                                    placeholder={t('details.cityPlaceholder')}
                                    value={city}
                                    onChange={(e) => {
                                        setCity(e.target.value);
                                        setError(null);
                                    }}
                                    className={inputClass(false)}
                                />
                                <datalist id="auth-city-options">
                                    {cityOptions.map((name) => (
                                        <option key={name} value={name} />
                                    ))}
                                </datalist>
                                <FieldError message={error} />
                                <div className="mt-6">
                                    <SubmitButton
                                        disabled={fullName.trim().length < 2 || !city.trim()}
                                        busy={loading}
                                        label={t('details.submit')}
                                        busyLabel={t('details.saving')}
                                    />
                                </div>
                                {terms}
                            </form>
                        )}

                        {authMethod === 'password' && (
                            <form onSubmit={handlePasswordLogin} noValidate>
                                <BackButton label={t('back')} onClick={() => switchTo('otp')} />
                                <StepHeading title={t('password.title')} subtitle={t('password.subtitle')} />
                                <label htmlFor="auth-identifier" className={labelClass}>{t('password.identifier')}</label>
                                <input
                                    id="auth-identifier"
                                    type="text"
                                    autoComplete="username"
                                    value={identifier}
                                    onChange={(e) => {
                                        setIdentifier(e.target.value);
                                        setError(null);
                                    }}
                                    className={inputClass(false)}
                                    autoFocus
                                />
                                <div className="mt-4 mb-1.5 flex items-center justify-between">
                                    <label htmlFor="auth-password" className="text-sm font-semibold text-km-text-primary">{t('password.password')}</label>
                                    <button type="button" onClick={() => switchTo('forgot')} className={actionLinkClass}>
                                        {t('password.forgot')}
                                    </button>
                                </div>
                                <div className="relative">
                                    <input
                                        id="auth-password"
                                        type={showPassword ? 'text' : 'password'}
                                        autoComplete="current-password"
                                        placeholder={t('password.passwordPlaceholder')}
                                        value={password}
                                        onChange={(e) => {
                                            setPassword(e.target.value);
                                            setError(null);
                                        }}
                                        className={`${inputClass(Boolean(error))} pr-12`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        aria-label={showPassword ? t('password.hide') : t('password.show')}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-km-text-secondary hover:text-km-heading hover:bg-km-surface cursor-pointer"
                                    >
                                        {showPassword ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}
                                    </button>
                                </div>
                                <FieldError message={error} />
                                <div className="mt-6">
                                    <SubmitButton
                                        disabled={!identifier.trim() || !password}
                                        busy={loading}
                                        label={t('password.submit')}
                                        busyLabel={t('password.signingIn')}
                                    />
                                </div>
                                <button type="button" onClick={() => switchTo('otp')} className={`mt-2 ${actionLinkClass}`}>
                                    {t('password.useOtp')}
                                </button>
                            </form>
                        )}

                        {authMethod === 'forgot' && forgotStep === 'request' && (
                            <form onSubmit={handleSendForgotCode} noValidate>
                                <BackButton label={t('forgot.back')} onClick={() => switchTo('password')} />
                                <StepHeading title={t('forgot.title')} subtitle={t('forgot.subtitle')} />
                                <label htmlFor="auth-forgot-email" className={labelClass}>{t('forgot.email')}</label>
                                <input
                                    id="auth-forgot-email"
                                    type="email"
                                    autoComplete="email"
                                    placeholder={t('forgot.emailPlaceholder')}
                                    value={forgotEmail}
                                    onChange={(e) => {
                                        setForgotEmail(e.target.value);
                                        setError(null);
                                    }}
                                    aria-invalid={Boolean(error) || undefined}
                                    className={inputClass(Boolean(error))}
                                    autoFocus
                                />
                                <FieldError message={error} />
                                <div className="mt-6">
                                    <SubmitButton disabled={!forgotEmail.trim()} busy={loading} label={t('forgot.submit')} busyLabel={t('forgot.sending')} />
                                </div>
                                <p className="mt-5 text-sm leading-relaxed text-km-text-secondary">
                                    {t('forgot.noEmail')}{' '}
                                    <button type="button" onClick={() => switchTo('otp')} className={linkClass}>
                                        {t('password.useOtp')}
                                    </button>
                                </p>
                            </form>
                        )}

                        {authMethod === 'forgot' && forgotStep === 'reset' && (
                            <form onSubmit={handleResetPassword} noValidate>
                                <BackButton
                                    label={t('forgot.changeEmail')}
                                    onClick={() => {
                                        setForgotStep('request');
                                        setError(null);
                                    }}
                                />
                                <StepHeading title={t('forgot.codeTitle')} subtitle={t('forgot.codeSent', { email: forgotEmail.trim() })} />
                                <label htmlFor="auth-reset-code" className={labelClass}>{t('forgot.code')}</label>
                                <input
                                    id="auth-reset-code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={4}
                                    value={forgotCode}
                                    onChange={(e) => {
                                        setForgotCode(e.target.value.replace(/\D/g, ''));
                                        setError(null);
                                    }}
                                    className={`${inputClass(false)} tracking-[0.5em]`}
                                    autoFocus
                                />
                                <label htmlFor="auth-new-password" className={`${labelClass} mt-4`}>{t('forgot.newPassword')}</label>
                                <div className="relative">
                                    <input
                                        id="auth-new-password"
                                        type={showNewPassword ? 'text' : 'password'}
                                        autoComplete="new-password"
                                        minLength={MIN_PASSWORD_LENGTH}
                                        aria-describedby="auth-new-password-hint"
                                        value={newPassword}
                                        onChange={(e) => {
                                            setNewPassword(e.target.value);
                                            setError(null);
                                        }}
                                        className={`${inputClass(false)} pr-12`}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        aria-label={showNewPassword ? t('password.hide') : t('password.show')}
                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-2 rounded-lg text-km-text-secondary hover:text-km-heading hover:bg-km-surface cursor-pointer"
                                    >
                                        {showNewPassword ? <EyeSlashIcon size={20} /> : <EyeIcon size={20} />}
                                    </button>
                                </div>
                                <p id="auth-new-password-hint" className="mt-1.5 text-[13px] text-km-text-secondary">
                                    {t('forgot.newPasswordHint', { min: MIN_PASSWORD_LENGTH })}
                                </p>
                                <FieldError message={error} />
                                <div className="mt-6">
                                    <SubmitButton
                                        disabled={forgotCode.length !== 4 || newPassword.length < MIN_PASSWORD_LENGTH}
                                        busy={loading}
                                        label={t('forgot.save')}
                                        busyLabel={t('forgot.saving')}
                                    />
                                </div>
                            </form>
                        )}
        </AuthShell>
    );
}
