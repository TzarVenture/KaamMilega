'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    CheckCircle2,
    PhoneCall,
    ArrowRight,
    AlertCircle,
    Eye,
    EyeOff,
} from 'lucide-react';
import AuthNavbar from '@/components/auth/AuthNavbar';
import OtpInput from '@/components/ui/OtpInput';
import api from '@/lib/axios';
import { saveSession, isAuthenticated, getCurrentUser } from '@/lib/auth';

export interface UnifiedAuthViewProps {
    initialRole?: 'user' | 'recruiter';
}

export default function UnifiedAuthView({
    initialRole = 'user',
}: UnifiedAuthViewProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Lock role cleanly to portal route: /login = user, /recruiter/login = recruiter
    const queryRole = searchParams.get('role');
    const role: 'user' | 'recruiter' =
        queryRole === 'recruiter' || initialRole === 'recruiter' ? 'recruiter' : 'user';
    const isRecruiter = role === 'recruiter';

    // authMethod: 'otp' | 'password' | 'forgot'
    const [authMethod, setAuthMethod] = useState<'otp' | 'password' | 'forgot'>('otp');

    // OTP states: 'input' -> 'verify' -> 'name' (for new candidates)
    const [otpStep, setOtpStep] = useState<'input' | 'verify' | 'name'>('input');
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState<string[]>(['', '', '', '']);
    const [resendTimer, setResendTimer] = useState(30);

    // New candidate registration input
    const [fullName, setFullName] = useState('');
    const [city, setCity] = useState('');
    const [cityOptions, setCityOptions] = useState<string[]>([]);
    const [verifiedUser, setVerifiedUser] = useState<any>(null);

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

    // If user is already authenticated, redirect to appropriate portal
    useEffect(() => {
        if (isAuthenticated()) {
            const user = getCurrentUser();
            const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
            if (!isRecruiter && user && user.is_registered === false && !roles.includes('recruiter')) {
                // Signed in by OTP but never finished signup: resume at the name step
                setVerifiedUser(user);
                setFullName(user.name || '');
                setCity(user.city || '');
                setOtpStep('name');
                return;
            }
            if (roles.includes('recruiter') && isRecruiter) {
                if (user?.company_name && user.company_name.trim()) {
                    router.replace('/recruiter');
                } else {
                    router.replace('/recruiter/register');
                }
            } else if (!isRecruiter) {
                router.replace('/');
            }
        }
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
            .then((res: any) => {
                const list = Array.isArray(res) ? res : res?.data || [];
                setCityOptions(list.map((c: any) => c?.name).filter(Boolean));
            })
            .catch(() => {});
    }, [otpStep, cityOptions.length]);

    // Destination resolver for candidate: only same-site paths ("//host" and "/\host" are external)
    const getCandidateRedirect = () => {
        const redirectParam = searchParams.get('redirect');
        if (
            redirectParam &&
            redirectParam.startsWith('/') &&
            !redirectParam.startsWith('//') &&
            !redirectParam.startsWith('/\\') &&
            !redirectParam.startsWith('/login') &&
            !redirectParam.startsWith('/register') &&
            !redirectParam.startsWith('/signup')
        ) {
            return redirectParam;
        }
        return '/';
    };

    // 1. Send Mobile OTP
    const handleSendOtp = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        const cleanMobile = mobile.replace(/\D/g, '');
        if (cleanMobile.length !== 10) {
            setError('Please enter a valid 10-digit mobile number.');
            return;
        }

        setError(null);
        setSuccessMsg(null);
        setLoading(true);

        try {
            await api.post('/auth/otp/send', {
                mobile: cleanMobile,
                role,
            });
            setOtpStep('verify');
            setResendTimer(30);
        } catch (err: any) {
            const rawMsg = err.response?.data?.error || err.message || '';
            setError(rawMsg || 'Failed to send verification code. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // 2. Verify OTP
    const handleVerifyOtp = async (explicitCode?: string, e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const code = (typeof explicitCode === 'string' && explicitCode.trim().length === 4)
            ? explicitCode.trim()
            : otp.join('').trim();

        if (code.length !== 4) {
            setError('Please enter the complete 4-digit code.');
            return;
        }

        setError(null);
        setLoading(true);
        const cleanMobile = mobile.replace(/\D/g, '');

        try {
            const res: any = await api.post('/auth/otp/verify', {
                mobile: cleanMobile,
                code,
                role,
            });

            if (res && res.user) {
                saveSession(res.user, role);

                if (isRecruiter) {
                    const hasCompany = Boolean(res.user?.company_name && res.user.company_name.trim());
                    const existingRoles: string[] = Array.isArray(res.user?.roles) ? res.user.roles : (res.user?.role ? [res.user.role] : []);
                    const alreadyHadAccount = existingRoles.includes('user') || Boolean(res.user?.name?.trim());

                    if (hasCompany) {
                        router.push('/recruiter');
                    } else {
                        if (alreadyHadAccount) {
                            setSuccessMsg('Existing account found. Setting up your employer profile...');
                        }
                        // Brief pause so user can read the message, then redirect
                        setTimeout(() => router.push('/recruiter/register'), alreadyHadAccount ? 1400 : 0);
                    }
                } else {
                    // Candidate flow: only skip name step if fully registered
                    const hasName = Boolean(
                        res.user?.name &&
                        res.user.name.trim() &&
                        res.user.is_registered === true
                    );
                    if (hasName) {
                        router.push(getCandidateRedirect());
                    } else {
                        // New candidate: collect name on next step
                        setVerifiedUser(res.user);
                        setOtpStep('name');
                    }
                }
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Invalid verification code.');
        } finally {
            setLoading(false);
        }
    };

    // 3. Complete Name Step for New Candidate
    const handleCompleteName = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = fullName.trim();
        const cleanCity = city.trim();
        if (!cleanName || cleanName.length < 2) {
            setError('Please enter your full name (minimum 2 characters).');
            return;
        }
        if (!cleanCity) {
            setError('Please enter the city where you want to work.');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const res: any = await api.post('/user/register', {
                name: cleanName,
                city: cleanCity,
                roles: ['user'],
            });

            const updated = res || { ...(verifiedUser || {}), name: cleanName, city: cleanCity, is_registered: true };
            saveSession(updated, 'user');
            window.dispatchEvent(new Event('km:auth-changed'));
            window.dispatchEvent(new Event('km:profile-updated'));

            router.push(getCandidateRedirect());
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to save name. Please try again.');
            setLoading(false);
        }
    };

    // 4. Password Login (Candidate fallback)
    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!identifier.trim() || !password) {
            setError('Please enter your email or mobile and password.');
            return;
        }

        setError(null);
        setSuccessMsg(null);
        setLoading(true);

        try {
            const res: any = await api.post('/auth/login/password', {
                identifier: identifier.trim(),
                password,
                role,
            });

            if (res?.requires_password_setup) {
                setAuthMethod('otp');
                setOtpStep('input');
                const cleanDigits = identifier.replace(/\D/g, '');
                if (cleanDigits.length === 10) {
                    setMobile(cleanDigits);
                }
                setSuccessMsg(res.message || 'You registered via Mobile OTP. Please sign in with OTP.');
                return;
            }

            if (res && res.user) {
                saveSession(res.user, 'user');
                router.push(getCandidateRedirect());
            }
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Invalid email/mobile or password.');
        } finally {
            setLoading(false);
        }
    };

    // 5. Send Forgot Password Code
    const handleSendForgotCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!forgotEmail.trim() || !forgotEmail.includes('@')) {
            setError('Please enter a valid email address.');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            await api.post('/auth/password/forgot', {
                email: forgotEmail.trim(),
            });
            setForgotStep('reset');
            setSuccessMsg(`Reset code sent to ${forgotEmail}. Please check your inbox.`);
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to send reset code.');
        } finally {
            setLoading(false);
        }
    };

    // 6. Reset Password
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (forgotCode.trim().length !== 4) {
            setError('Please enter the 4-digit code.');
            return;
        }
        if (newPassword.length < 6) {
            setError('Password must be at least 6 characters.');
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
            setSuccessMsg('Password updated successfully! Please sign in with your new password.');
            setAuthMethod('password');
            setForgotStep('request');
            setForgotCode('');
            setNewPassword('');
        } catch (err: any) {
            setError(err.response?.data?.error || err.message || 'Failed to reset password.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F4F7FB] text-[#111827] flex flex-col font-sans">
            {/* Top Navigation Bar: Shared Unified Auth Navbar */}
            <AuthNavbar />

            {/* Split-Screen Main Container */}
            <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-12 py-8 lg:py-12 max-w-6xl mx-auto w-full">
                <div className="bg-white border border-[#D9E0EA] rounded-3xl p-7 sm:p-10 lg:p-14 shadow-xs flex flex-col lg:flex-row items-center lg:items-start justify-between gap-10 lg:gap-14">
                    {/* LEFT COLUMN: Value Proposition */}
                    <div className="flex-1 space-y-6 text-center lg:text-left w-full">
                        <div className="space-y-3">
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
                                {isRecruiter ? (
                                    <>
                                        <span className="text-[#071A4D]">Hire </span>
                                        <span className="text-[#FF6B00]">Verified</span>
                                        <span className="text-[#071A4D]"> Talent Directly.</span>
                                    </>
                                ) : (
                                    <>
                                        <span className="text-[#071A4D]">Talk to HR </span>
                                        <span className="text-[#FF6B00]">Directly</span>
                                        <span className="text-[#071A4D]"> and Get a Job in Your City.</span>
                                    </>
                                )}
                            </h1>
                            <p className="text-sm sm:text-base font-medium text-[#5B6472]">
                                {isRecruiter
                                    ? 'Post jobs and connect with candidates in your city.'
                                    : 'Find verified local jobs with direct recruiter access.'}
                            </p>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Interactive Form Card */}
                    <div className="w-full lg:w-[440px] shrink-0">
                        <div className="bg-[#F4F7FB] rounded-2xl border border-[#D9E0EA] p-6 sm:p-8 shadow-xs">
                            {/* Error Banner */}
                            {error && (
                                <div className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-700 font-medium">
                                    <AlertCircle size={16} className="shrink-0 mt-0.5 text-red-600" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {/* Success Banner */}
                            {successMsg && (
                                <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-2.5 text-xs text-emerald-800 font-medium">
                                    <CheckCircle2 size={16} className="shrink-0 mt-0.5 text-emerald-600" />
                                    <span>{successMsg}</span>
                                </div>
                            )}

                            {/* OTP AUTHENTICATION */}
                            {authMethod === 'otp' && (
                                <>
                                    {/* Step 1: Mobile Input */}
                                    {otpStep === 'input' && (
                                        <form onSubmit={handleSendOtp} className="space-y-4">
                                            <div>
                                                <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                                                    {isRecruiter ? 'Employer Sign In' : 'Candidate Sign In'}
                                                </h2>
                                                <p className="text-xs text-[#5B6472] mt-1">
                                                    {isRecruiter
                                                        ? 'Enter your mobile number to sign in or register your company.'
                                                        : 'Enter your mobile number to get a verification code.'}
                                                </p>
                                            </div>

                                            <div className="pt-2">
                                                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                                                    Mobile Number
                                                </label>
                                                <div className="relative flex items-center">
                                                    <span className="absolute left-3 text-xs font-bold text-[#111827] border-r border-[#D9E0EA] pr-2 pointer-events-none">
                                                        +91
                                                    </span>
                                                    <input
                                                        type="tel"
                                                        maxLength={10}
                                                        required
                                                        placeholder="Enter 10-digit number"
                                                        value={mobile}
                                                        onChange={(e) => {
                                                            const val = e.target.value.replace(/\D/g, '');
                                                            setMobile(val);
                                                            setError(null);
                                                        }}
                                                        className="w-full h-11 pl-14 pr-3.5 bg-white border border-[#D9E0EA] rounded-xl text-sm font-medium text-[#111827] placeholder:text-[#5B6472]/60 focus:border-[#071A4D] focus:ring-2 focus:ring-[#071A4D]/10 outline-none transition-all tracking-wide"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading || mobile.replace(/\D/g, '').length !== 10}
                                                className={`w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer mt-3 shadow-xs ${
                                                    mobile.replace(/\D/g, '').length === 10 && !loading
                                                        ? 'bg-[#071A4D] hover:bg-[#0B1F52] text-white active:scale-[0.99]'
                                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                                }`}
                                            >
                                                {loading ? (
                                                    <span className="inline-flex items-center gap-2">
                                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Sending code...
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span>Get Verification Code</span>
                                                        <ArrowRight size={16} />
                                                    </span>
                                                )}
                                            </button>

                                            {/* Candidate Password Option */}
                                            {!isRecruiter && (
                                                <div className="text-center pt-2">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setAuthMethod('password');
                                                            setError(null);
                                                            setSuccessMsg(null);
                                                        }}
                                                        className="text-xs font-semibold text-[#071A4D] hover:underline cursor-pointer"
                                                    >
                                                        Sign in with Password →
                                                    </button>
                                                </div>
                                            )}

                                            {/* Discrete Cross-Portal Navigation Link */}
                                            <div className="text-center pt-4 border-t border-[#D9E0EA]/70 mt-4">
                                                {isRecruiter ? (
                                                    <p className="text-xs text-[#5B6472]">
                                                        Looking for a job?{' '}
                                                        <Link
                                                            href="/login"
                                                            className="text-[#071A4D] font-bold hover:underline cursor-pointer"
                                                        >
                                                            Go to Candidate Portal →
                                                        </Link>
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-[#5B6472]">
                                                        Looking to hire staff?{' '}
                                                        <Link
                                                            href="/recruiter/login"
                                                            className="text-[#071A4D] font-bold hover:underline cursor-pointer"
                                                        >
                                                            Go to Employer Portal →
                                                        </Link>
                                                    </p>
                                                )}
                                            </div>
                                        </form>
                                    )}

                                    {/* Step 2: OTP Verification */}
                                    {otpStep === 'verify' && (
                                        <form
                                            onSubmit={(e) => handleVerifyOtp(otp.join(''), e)}
                                            className="space-y-4"
                                        >
                                            <div>
                                                <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                                                    Enter verification code
                                                </h2>
                                                <p className="text-xs text-[#5B6472] mt-1">
                                                    Code sent to +91 ••••••{mobile.slice(-4)}
                                                </p>
                                            </div>

                                            {/* 4-Digit OTP Input */}
                                            <div className="py-2">
                                                <OtpInput
                                                    value={otp}
                                                    onChange={(newOtp) => {
                                                        setOtp(newOtp);
                                                        setError(null);
                                                        if (newOtp.join('').trim().length === 4) {
                                                            handleVerifyOtp(newOtp.join('').trim());
                                                        }
                                                    }}
                                                />
                                            </div>

                                            {/* Resend & Change Number */}
                                            <div className="flex items-center justify-between text-xs pt-1">
                                                {resendTimer > 0 ? (
                                                    <span className="text-[#5B6472]">
                                                        Resend code in {resendTimer}s
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleSendOtp()}
                                                        className="text-[#071A4D] font-bold hover:underline cursor-pointer"
                                                    >
                                                        Resend code
                                                    </button>
                                                )}

                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setOtpStep('input');
                                                        setOtp(['', '', '', '']);
                                                        setError(null);
                                                    }}
                                                    className="text-[#5B6472] hover:text-[#071A4D] font-medium cursor-pointer"
                                                >
                                                    Change number
                                                </button>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading || otp.join('').length !== 4}
                                                className={`w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer mt-2 shadow-xs ${
                                                    otp.join('').length === 4 && !loading
                                                        ? 'bg-[#071A4D] hover:bg-[#0B1F52] text-white active:scale-[0.99]'
                                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                                }`}
                                            >
                                                {loading ? (
                                                    <span className="inline-flex items-center gap-2">
                                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Verifying...
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span>Verify &amp; Continue</span>
                                                        <ArrowRight size={16} />
                                                    </span>
                                                )}
                                            </button>
                                        </form>
                                    )}

                                    {/* Step 3: Candidate Name (For brand new candidates only) */}
                                    {otpStep === 'name' && (
                                        <form onSubmit={handleCompleteName} className="space-y-4">
                                            <div>
                                                <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                                                    Welcome to KaamMilega!
                                                </h2>
                                                <p className="text-xs text-[#5B6472] mt-1">
                                                    Tell us your name and the city you want to work in.
                                                </p>
                                            </div>

                                            <div className="pt-2">
                                                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                                                    Full Name
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        required
                                                        placeholder="e.g. Rahul Sharma"
                                                        value={fullName}
                                                        onChange={(e) => {
                                                            setFullName(e.target.value);
                                                            setError(null);
                                                        }}
                                                        className="w-full h-11 px-3.5 bg-white border border-[#D9E0EA] rounded-xl text-sm font-medium text-[#111827] placeholder:text-[#5B6472]/60 focus:border-[#071A4D] focus:ring-2 focus:ring-[#071A4D]/10 outline-none transition-all"
                                                        autoFocus
                                                    />
                                                </div>
                                            </div>

                                            <div>
                                                <label htmlFor="signup-city" className="block text-xs font-semibold text-[#111827] mb-1.5">
                                                    City
                                                </label>
                                                <input
                                                    id="signup-city"
                                                    type="text"
                                                    required
                                                    list="signup-city-options"
                                                    autoComplete="address-level2"
                                                    placeholder="e.g. Pune"
                                                    value={city}
                                                    onChange={(e) => {
                                                        setCity(e.target.value);
                                                        setError(null);
                                                    }}
                                                    className="w-full h-11 px-3.5 bg-white border border-[#D9E0EA] rounded-xl text-sm font-medium text-[#111827] placeholder:text-[#5B6472]/60 focus:border-[#071A4D] focus:ring-2 focus:ring-[#071A4D]/10 outline-none transition-all"
                                                />
                                                <datalist id="signup-city-options">
                                                    {cityOptions.map((name) => (
                                                        <option key={name} value={name} />
                                                    ))}
                                                </datalist>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading || fullName.trim().length < 2 || !city.trim()}
                                                className={`w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer mt-3 shadow-xs ${
                                                    fullName.trim().length >= 2 && city.trim() && !loading
                                                        ? 'bg-[#071A4D] hover:bg-[#0B1F52] text-white active:scale-[0.99]'
                                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                                }`}
                                            >
                                                {loading ? (
                                                    <span className="inline-flex items-center gap-2">
                                                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                        Saving...
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5">
                                                        <span>Get Started</span>
                                                        <ArrowRight size={16} />
                                                    </span>
                                                )}
                                            </button>
                                        </form>
                                    )}
                                </>
                            )}

                            {/* PASSWORD LOGIN (Candidate fallback) */}
                            {authMethod === 'password' && (
                                <form onSubmit={handlePasswordLogin} className="space-y-4">
                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                                            Sign In with Password
                                        </h2>
                                        <p className="text-xs text-[#5B6472] mt-1">
                                            Enter your registered email or mobile and password.
                                        </p>
                                    </div>

                                    <div className="pt-2">
                                        <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                                            Email address or Mobile
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            placeholder="name@example.com or mobile"
                                            value={identifier}
                                            onChange={(e) => {
                                                setIdentifier(e.target.value);
                                                setError(null);
                                            }}
                                            className="w-full h-11 px-3.5 bg-white border border-[#D9E0EA] rounded-xl text-sm font-medium text-[#111827] placeholder:text-[#5B6472]/60 focus:border-[#071A4D] focus:ring-2 focus:ring-[#071A4D]/10 outline-none transition-all"
                                            autoFocus
                                        />
                                    </div>

                                    <div>
                                        <div className="flex justify-between items-center mb-1.5">
                                            <label className="text-xs font-semibold text-[#111827]">
                                                Password
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAuthMethod('forgot');
                                                    setError(null);
                                                    setSuccessMsg(null);
                                                }}
                                                className="text-xs font-semibold text-[#071A4D] hover:underline cursor-pointer"
                                            >
                                                Forgot password?
                                            </button>
                                        </div>
                                        <div className="relative">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                required
                                                placeholder="Enter your password"
                                                value={password}
                                                onChange={(e) => {
                                                    setPassword(e.target.value);
                                                    setError(null);
                                                }}
                                                className="w-full h-11 pl-3.5 pr-10 bg-white border border-[#D9E0EA] rounded-xl text-sm font-medium text-[#111827] placeholder:text-[#5B6472]/60 focus:border-[#071A4D] focus:ring-2 focus:ring-[#071A4D]/10 outline-none transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword(!showPassword)}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6472] hover:text-[#111827] p-1 cursor-pointer"
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Switch back to OTP */}
                                    <div className="text-center pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setAuthMethod('otp');
                                                setOtpStep('input');
                                                setError(null);
                                            }}
                                            className="text-xs font-semibold text-[#071A4D] hover:underline inline-flex items-center gap-1.5 cursor-pointer py-1"
                                        >
                                            <PhoneCall size={14} className="text-[#071A4D]" />
                                            <span>Sign in with Mobile OTP instead</span>
                                        </button>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading || !identifier.trim() || !password}
                                        className={`w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer mt-2 shadow-xs ${
                                            identifier.trim() && password && !loading
                                                ? 'bg-[#071A4D] hover:bg-[#0B1F52] text-white active:scale-[0.99]'
                                                : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                        }`}
                                    >
                                        {loading ? (
                                            <span className="inline-flex items-center gap-2">
                                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Signing in...
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center gap-1.5">
                                                <span>Sign In</span>
                                                <ArrowRight size={16} />
                                            </span>
                                        )}
                                    </button>
                                </form>
                            )}

                            {/* FORGOT PASSWORD */}
                            {authMethod === 'forgot' && (
                                <>
                                    {forgotStep === 'request' ? (
                                        <form onSubmit={handleSendForgotCode} className="space-y-4">
                                            <div>
                                                <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                                                    Reset Password
                                                </h2>
                                                <p className="text-xs text-[#5B6472] mt-1">
                                                    Enter your registered email to receive a reset code.
                                                </p>
                                            </div>

                                            <div className="pt-2">
                                                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                                                    Email address
                                                </label>
                                                <input
                                                    type="email"
                                                    required
                                                    placeholder="name@example.com"
                                                    value={forgotEmail}
                                                    onChange={(e) => {
                                                        setForgotEmail(e.target.value);
                                                        setError(null);
                                                    }}
                                                    className="w-full h-11 px-3.5 bg-white border border-[#D9E0EA] rounded-xl text-sm font-medium text-[#111827] placeholder:text-[#5B6472]/60 focus:border-[#071A4D] focus:ring-2 focus:ring-[#071A4D]/10 outline-none transition-all"
                                                    autoFocus
                                                />
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading || !forgotEmail.trim()}
                                                className={`w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer mt-3 shadow-xs ${
                                                    forgotEmail.trim() && !loading
                                                        ? 'bg-[#071A4D] hover:bg-[#0B1F52] text-white active:scale-[0.99]'
                                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                                }`}
                                            >
                                                {loading ? 'Sending code...' : 'Send Reset Code'}
                                            </button>

                                            <div className="text-center pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setAuthMethod('password');
                                                        setError(null);
                                                    }}
                                                    className="text-xs font-semibold text-[#071A4D] hover:underline cursor-pointer"
                                                >
                                                    Back to sign in
                                                </button>
                                            </div>
                                        </form>
                                    ) : (
                                        <form onSubmit={handleResetPassword} className="space-y-4">
                                            <div>
                                                <h2 className="text-xl sm:text-2xl font-bold text-[#111827] tracking-tight">
                                                    Enter Reset Code
                                                </h2>
                                                <p className="text-xs text-[#5B6472] mt-1">
                                                    Code sent to {forgotEmail}
                                                </p>
                                            </div>

                                            <div className="pt-2">
                                                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                                                    4-digit reset code
                                                </label>
                                                <input
                                                    type="text"
                                                    maxLength={4}
                                                    required
                                                    placeholder="e.g. 1234"
                                                    value={forgotCode}
                                                    onChange={(e) => {
                                                        setForgotCode(e.target.value.replace(/\D/g, ''));
                                                        setError(null);
                                                    }}
                                                    className="w-full h-11 px-3.5 bg-white border border-[#D9E0EA] rounded-xl text-sm font-semibold tracking-widest text-[#111827] text-center focus:border-[#071A4D] focus:ring-2 focus:ring-[#071A4D]/10 outline-none transition-all"
                                                    autoFocus
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-semibold text-[#111827] mb-1.5">
                                                    New password (min. 6 characters)
                                                </label>
                                                <div className="relative">
                                                    <input
                                                        type={showNewPassword ? 'text' : 'password'}
                                                        required
                                                        minLength={6}
                                                        placeholder="Create a strong password"
                                                        value={newPassword}
                                                        onChange={(e) => {
                                                            setNewPassword(e.target.value);
                                                            setError(null);
                                                        }}
                                                        className="w-full h-11 pl-3.5 pr-10 bg-white border border-[#D9E0EA] rounded-xl text-sm font-medium text-[#111827] focus:border-[#071A4D] focus:ring-2 focus:ring-[#071A4D]/10 outline-none transition-all"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5B6472] hover:text-[#111827] p-1 cursor-pointer"
                                                    >
                                                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                                    </button>
                                                </div>
                                            </div>

                                            <button
                                                type="submit"
                                                disabled={loading || forgotCode.length !== 4 || newPassword.length < 6}
                                                className={`w-full h-11 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer mt-3 shadow-xs ${
                                                    forgotCode.length === 4 && newPassword.length >= 6 && !loading
                                                        ? 'bg-[#071A4D] hover:bg-[#0B1F52] text-white active:scale-[0.99]'
                                                        : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                                                }`}
                                            >
                                                {loading ? 'Resetting password...' : 'Set New Password'}
                                            </button>

                                            <div className="text-center pt-2">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setForgotStep('request');
                                                        setError(null);
                                                    }}
                                                    className="text-xs font-semibold text-[#5B6472] hover:underline cursor-pointer"
                                                >
                                                    Change email
                                                </button>
                                            </div>
                                        </form>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Bottom Legal Disclaimer */}
                <div className="text-center mt-6 text-xs text-[#5B6472]">
                    <p>
                        By continuing, you agree to KaamMilega&apos;s{' '}
                        <Link href="/policies/terms" className="text-[#071A4D] hover:underline font-semibold">
                            Terms of Service
                        </Link>{' '}
                        and{' '}
                        <Link href="/policies/privacy" className="text-[#071A4D] hover:underline font-semibold">
                            Privacy Policy
                        </Link>
                        .
                    </p>
                </div>
            </main>
        </div>
    );
}
