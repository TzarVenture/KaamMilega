'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/axios';
import { uploadFile } from '@/lib/upload';
import { isAuthenticated, saveSession } from '@/lib/auth';
import AuthNavbar from '@/components/auth/AuthNavbar';
import { ArrowLeftIcon, ArrowRightIcon, BriefcaseIcon, BuildingOfficeIcon, CheckCircleIcon, CheckIcon, CloudArrowUpIcon, CreditCardIcon, EnvelopeSimpleIcon, FileTextIcon, GlobeIcon, MedalIcon, ShieldCheckIcon, StorefrontIcon, UserIcon, WarningCircleIcon } from '@phosphor-icons/react';
import { errorText } from "@/lib/notify";

interface DocumentTypeOption {
    id: string;
    name: string;
    description: string;
    icon: typeof FileTextIcon;
}

const DOCUMENT_TYPES: DocumentTypeOption[] = [
    {
        id: 'gst',
        name: 'GST Certificate',
        description: '15-digit Goods & Services Tax identification',
        icon: FileTextIcon,
    },
    {
        id: 'pan',
        name: 'Company PAN Card',
        description: '10-digit PAN for corporate entities',
        icon: CreditCardIcon,
    },
    {
        id: 'incorporation',
        name: 'Certificate of Incorporation',
        description: 'Ministry of Corporate Affairs CIN registration',
        icon: BuildingOfficeIcon,
    },
    {
        id: 'msme',
        name: 'MSME / Udyam Certificate',
        description: 'Udyam registration for MSMEs',
        icon: MedalIcon,
    },
    {
        id: 'shop',
        name: 'Shop & Establishment License',
        description: 'Municipal state commercial license',
        icon: StorefrontIcon,
    },
];

const INDUSTRY_OPTIONS = [
    'Information Technology & Services',
    'Manufacturing & Engineering',
    'Healthcare & Pharmaceuticals',
    'Logistics, Supply Chain & Transport',
    'Retail & E-Commerce',
    'Hospitality & Food Services',
    'Banking & Financial Services',
    'Construction, Real Estate & Trades',
    'Education & EdTech',
    'Staffing & Executive Search',
    'Other Industry',
];

const PERSONAL_EMAIL_DOMAINS = [
    'gmail.com',
    'yahoo.com',
    'outlook.com',
    'hotmail.com',
    'rediffmail.com',
    'icloud.com',
];

export default function RecruiterRegisterPage() {
    const router = useRouter();

    // Step state: 1 = Recruiter Profile, 2 = Work Email OTP, 3 = Company & Documents
    const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

    // Form Fields
    const [fullName, setFullName] = useState('');
    const [designation, setDesignation] = useState('');
    const [isConsultant, setIsConsultant] = useState<boolean | null>(null);

    // Email & OTP
    const [email, setEmail] = useState('');
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [emailOtp, setEmailOtp] = useState(['', '', '', '']);
    const [otpSent, setOtpSent] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);

    // Company Details
    const [companyName, setCompanyName] = useState('');
    const [companyWebsite, setCompanyWebsite] = useState('');
    const [industry, setIndustry] = useState('');
    const [selectedDocType, setSelectedDocType] = useState<string>('gst');
    const [docNumber, setDocNumber] = useState('');

    // Staged Files & Preview
    const [logoFile, setLogoFile] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);
    const [docFile, setDocFile] = useState<File | null>(null);

    // UI state
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    const otpInputsRef = useRef<(HTMLInputElement | null)[]>([]);

    // Require mobile OTP authentication before accessing company onboarding
    useEffect(() => {
        if (!isAuthenticated()) {
            router.replace('/recruiter/login?redirect=/recruiter/register');
            return;
        }

        try {
            const stored = localStorage.getItem('user');
            if (stored) {
                const u = JSON.parse(stored);
                if (u.name) setFullName(u.name);
                if (u.email) {
                    setEmail(u.email);
                    if (u.is_email_verified) setIsEmailVerified(true);
                }
                if (u.headline) setDesignation(u.headline);
                if (typeof u.is_consultant === 'boolean') setIsConsultant(u.is_consultant);
                if (u.company_name) setCompanyName(u.company_name);
                if (u.company_website) setCompanyWebsite(u.company_website);
                if (u.gst) setDocNumber(u.gst);
            }
        } catch {
            // Ignore cache parse error
        }
    }, [router]);

    // Timer countdown for OTP resend
    useEffect(() => {
        if (!otpSent || resendTimer <= 0) return;
        const interval = setInterval(() => {
            setResendTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, [otpSent, resendTimer]);

    // Clean file preview URL on unmount
    useEffect(() => {
        return () => {
            if (logoPreview) URL.revokeObjectURL(logoPreview);
        };
    }, [logoPreview]);

    // -------------------------------------------------------------
    // STEP 1 HANDLERS: Recruiter Identity
    // -------------------------------------------------------------
    const handleStep1Submit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!fullName.trim()) {
            setError('Please enter your full name.');
            return;
        }
        if (isConsultant === null) {
            setError('Please select whether you are a direct employer or hiring consultant.');
            return;
        }
        setError(null);
        setCurrentStep(2);
    };

    // -------------------------------------------------------------
    // STEP 2 HANDLERS: Work Email & OTP
    // -------------------------------------------------------------
    const isValidEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());

    const handleSendEmailOtp = async () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !isValidEmail(trimmed)) {
            setError('Please enter a valid work email address.');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            await api.post('/auth/otp/email/send', { email: trimmed });
            setOtpSent(true);
            setResendTimer(30);
            setEmailOtp(['', '', '', '']);
            setSuccessMsg(`Verification code sent to ${trimmed}`);
            setTimeout(() => otpInputsRef.current[0]?.focus(), 150);
        } catch (err: any) {
            setError(errorText(err, 'Failed to send verification code.'));
        } finally {
            setLoading(false);
        }
    };

    const handleOtpDigitChange = (val: string, index: number) => {
        const digit = val.replace(/\D/g, '').slice(-1);
        const updated = [...emailOtp];
        updated[index] = digit;
        setEmailOtp(updated);
        setError(null);

        if (digit && index < 3) {
            otpInputsRef.current[index + 1]?.focus();
        }

        if (digit && index === 3 && updated.every((d) => d !== '')) {
            executeEmailVerify(updated.join(''));
        }
    };

    const handleOtpKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === 'Backspace' && !emailOtp[index] && index > 0) {
            otpInputsRef.current[index - 1]?.focus();
        }
    };

    const executeEmailVerify = async (codeToVerify?: string) => {
        const code = codeToVerify || emailOtp.join('');
        if (code.length < 4) {
            setError('Please enter the complete 4-digit code.');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            await api.post('/auth/otp/email/verify', {
                email: email.trim().toLowerCase(),
                code,
            });
            setIsEmailVerified(true);
            setSuccessMsg('Work email verified successfully.');
            setTimeout(() => {
                setSuccessMsg(null);
                setCurrentStep(3);
            }, 700);
        } catch (err: any) {
            setError(errorText(err, 'Invalid or expired code.'));
        } finally {
            setLoading(false);
        }
    };

    // -------------------------------------------------------------
    // STEP 3 HANDLERS: Company Details & Document Uploads
    // -------------------------------------------------------------
    const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 2 * 1024 * 1024) {
                setError('Company logo size must be under 2MB.');
                return;
            }
            setLogoFile(file);
            setError(null);
            if (logoPreview) URL.revokeObjectURL(logoPreview);
            setLogoPreview(URL.createObjectURL(file));
        }
    };

    const handleDocFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                setError('Document attachment size must be under 5MB.');
                return;
            }
            setDocFile(file);
            setError(null);
        }
    };

    // skipDocuments: save the company now and add verification documents later
    const handleFinalSubmit = async (skipDocuments: boolean = false) => {
        // The recruiter portal needs a company name, so it is required even when skipping documents
        if (!companyName.trim()) {
            setError('Please enter your company or organization name.');
            return;
        }

        setError(null);
        setLoading(true);

        try {
            const companyLogo = logoFile ? (await uploadFile(logoFile, 'company_logo')).url : undefined;

            let companyDocuments: { name: string; url: string }[] | undefined;
            if (!skipDocuments && docFile) {
                const docUrl = (await uploadFile(docFile, 'company_document')).url;
                const docType = DOCUMENT_TYPES.find((d) => d.id === selectedDocType)?.name || 'Company document';
                companyDocuments = [{ name: docNumber.trim() ? `${docType} (${docNumber.trim()})` : docType, url: docUrl }];
            }

            // Email verification is recorded server-side by the email OTP step
            const payload: Record<string, any> = {
                roles: ['recruiter'],
                name: fullName.trim(),
                headline: designation.trim() || undefined,
                email: email.trim().toLowerCase(),
                is_consultant: Boolean(isConsultant),
                company_name: companyName.trim(),
                company_website: companyWebsite.trim() || undefined,
                company_logo: companyLogo,
                industry: industry || undefined,
                gst: docNumber.trim() || undefined,
                company_documents: companyDocuments,
            };

            const updatedUser: any = await api.post('/user/register', payload);

            if (updatedUser) {
                saveSession(updatedUser, 'recruiter');
                window.dispatchEvent(new Event('km:auth-changed'));
                window.dispatchEvent(new Event('km:profile-updated'));
            }

            router.push('/recruiter');
        } catch (err: any) {
            setError(err.message || 'Failed to save company profile.');
            setLoading(false);
        }
    };

    const emailDomain = email.includes('@') ? email.split('@')[1]?.toLowerCase() : '';
    const isPersonalDomain = PERSONAL_EMAIL_DOMAINS.includes(emailDomain);

    return (
        <div className="min-h-screen bg-km-surface text-km-text-primary flex flex-col font-sans">
            {/* Top Navigation Bar: Shared Unified Auth Navbar */}
            <AuthNavbar />

            {/* Split-Screen Main Container: Matches /login design standard */}
            <main className="flex-1 flex flex-col justify-center px-4 sm:px-6 md:px-10 lg:px-12 py-8 lg:py-12 max-w-6xl mx-auto w-full">
                <div className="bg-km-surface-card border border-km-border rounded-3xl p-7 sm:p-10 lg:p-14 shadow-xs flex flex-col lg:flex-row items-start justify-between gap-10 lg:gap-14">
                    {/* LEFT COLUMN: Recruiter Value Proposition */}
                    <div className="flex-1 space-y-6 text-center lg:text-left w-full">
                        <div className="space-y-3">
                            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight tracking-tight">
                                <span className="text-km-heading">Hire </span>
                                <span className="text-[#FF6B00]">Verified</span>
                                <span className="text-km-heading"> Talent Directly &amp; Build Your Dream Team!</span>
                            </h1>
                            <p className="text-sm sm:text-base font-medium text-km-text-secondary">
                                Post Jobs &amp; Connect With Candidates In Your City!
                            </p>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Onboarding Stepper Form Card */}
                    <div className="w-full lg:w-[480px] shrink-0">

                        {/* Stepper Header */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between mb-2.5">
                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                            currentStep > 1
                                                ? 'bg-[#071A4D] text-white dark:bg-km-primary'
                                                : currentStep === 1
                                                ? 'bg-[#071A4D] text-white dark:bg-km-primary'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}
                                    >
                                        {currentStep > 1 ? <CheckIcon weight="bold" size={12} /> : '1'}
                                    </span>
                                    <span
                                        className={`text-xs font-medium ${
                                            currentStep === 1 ? 'text-km-heading font-semibold' : 'text-km-text-secondary'
                                        }`}
                                    >
                                        Identity
                                    </span>
                                </div>

                                <div className="h-[1px] flex-1 mx-2 bg-[#D9E0EA] dark:bg-[#293147]" />

                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                            currentStep > 2
                                                ? 'bg-[#071A4D] text-white dark:bg-km-primary'
                                                : currentStep === 2
                                                ? 'bg-[#071A4D] text-white dark:bg-km-primary'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}
                                    >
                                        {currentStep > 2 ? <CheckIcon weight="bold" size={12} /> : '2'}
                                    </span>
                                    <span
                                        className={`text-xs font-medium ${
                                            currentStep === 2 ? 'text-km-heading font-semibold' : 'text-km-text-secondary'
                                        }`}
                                    >
                                        Email OTP
                                    </span>
                                </div>

                                <div className="h-[1px] flex-1 mx-2 bg-[#D9E0EA] dark:bg-[#293147]" />

                                <div className="flex items-center gap-1.5">
                                    <span
                                        className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                            currentStep === 3
                                                ? 'bg-[#071A4D] text-white dark:bg-km-primary'
                                                : 'bg-slate-100 text-slate-500'
                                        }`}
                                    >
                                        3
                                    </span>
                                    <span
                                        className={`text-xs font-medium ${
                                            currentStep === 3 ? 'text-km-heading font-semibold' : 'text-km-text-secondary'
                                        }`}
                                    >
                                        Company
                                    </span>
                                </div>
                            </div>

                            {/* Progress bar line */}
                            <div className="h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-[#071A4D] transition-all duration-300 dark:bg-km-primary"
                                    style={{
                                        width: currentStep === 1 ? '33%' : currentStep === 2 ? '66%' : '100%',
                                    }}
                                />
                            </div>
                        </div>

                        {/* Alerts */}
                        {error && (
                            <div className="mb-5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2 text-xs text-red-800">
                                <WarningCircleIcon weight="bold" size={15} className="text-red-600 shrink-0 mt-0.5 dark:text-red-400" />
                                <div className="flex-1 font-medium">{error}</div>
                            </div>
                        )}

                        {successMsg && (
                            <div className="mb-5 p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-start gap-2 text-xs text-emerald-800">
                                <CheckCircleIcon weight="bold" size={15} className="text-emerald-600 shrink-0 mt-0.5 dark:text-emerald-400" />
                                <div className="flex-1 font-medium">{successMsg}</div>
                            </div>
                        )}

                        {/* ---------------------------------------------------- */}
                        {/* STEP 1: Recruiter Identity                           */}
                        {/* ---------------------------------------------------- */}
                        {currentStep === 1 && (
                            <form onSubmit={handleStep1Submit} className="space-y-4">
                                <div>
                                    <h2 className="text-xl font-bold text-km-heading tracking-tight">
                                        Recruiter Identity
                                    </h2>
                                    <p className="text-xs text-km-text-secondary mt-0.5">
                                        Tell us who is managing recruitment on behalf of your company.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-km-text-primary mb-1.5">
                                        Full Name <span className="text-red-500 dark:text-red-400">*</span>
                                    </label>
                                    <div className="relative">
                                        <UserIcon weight="bold" size={16} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            required
                                            value={fullName}
                                            onChange={(e) => {
                                                setFullName(e.target.value);
                                                setError(null);
                                            }}
                                            placeholder="Enter your full name"
                                            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-km-border focus:outline-none focus:border-[#0B5ED7] focus:ring-1 focus:ring-[#0B5ED7] text-km-text-primary placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-km-text-primary mb-1.5">
                                        Designation / Role in Company
                                    </label>
                                    <div className="relative">
                                        <BriefcaseIcon weight="bold" size={16} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                        <input
                                            type="text"
                                            value={designation}
                                            onChange={(e) => setDesignation(e.target.value)}
                                            placeholder="e.g. HR Lead, Founder, Talent Acquisition"
                                            className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border border-km-border focus:outline-none focus:border-[#0B5ED7] focus:ring-1 focus:ring-[#0B5ED7] text-km-text-primary placeholder:text-slate-400"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-km-text-primary mb-1.5">
                                        Hiring Model <span className="text-red-500 dark:text-red-400">*</span>
                                    </label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsConsultant(false);
                                                setError(null);
                                            }}
                                            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                                isConsultant === false
                                                    ? 'border-[#0B5ED7] bg-blue-50/50 ring-1 ring-[#0B5ED7]'
                                                    : 'border-km-border hover:border-slate-300 bg-km-surface-card'
                                            }`}
                                        >
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <BuildingOfficeIcon weight="bold"
                                                    size={15}
                                                    className={isConsultant === false ? 'text-km-link' : 'text-slate-500'}
                                                />
                                                <span className="text-xs font-semibold text-km-text-primary">
                                                    Direct Employer
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-km-text-secondary leading-tight">
                                                Hiring for own organization
                                            </p>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsConsultant(true);
                                                setError(null);
                                            }}
                                            className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                                isConsultant === true
                                                    ? 'border-[#0B5ED7] bg-blue-50/50 ring-1 ring-[#0B5ED7]'
                                                    : 'border-km-border hover:border-slate-300 bg-km-surface-card'
                                            }`}
                                        >
                                            <div className="flex items-center gap-1.5 mb-1">
                                                <BriefcaseIcon weight="bold"
                                                    size={15}
                                                    className={isConsultant === true ? 'text-km-link' : 'text-slate-500'}
                                                />
                                                <span className="text-xs font-semibold text-km-text-primary">
                                                    Staffing / Consultant
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-km-text-secondary leading-tight">
                                                Hiring for multiple clients
                                            </p>
                                        </button>
                                    </div>
                                </div>

                                <div className="pt-2">
                                    <button
                                        type="submit"
                                        className="w-full flex items-center justify-center gap-2 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl py-3 px-4 font-semibold text-sm transition shadow-sm cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                    >
                                        <span>Continue to Email Verification</span>
                                        <ArrowRightIcon weight="bold" size={16} />
                                    </button>
                                </div>
                            </form>
                        )}

                        {/* ---------------------------------------------------- */}
                        {/* STEP 2: Work Email Verification (OTP)                */}
                        {/* ---------------------------------------------------- */}
                        {currentStep === 2 && (
                            <div className="space-y-4">
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(1)}
                                        className="inline-flex items-center gap-1 text-xs text-km-text-secondary hover:text-km-heading font-medium mb-1 cursor-pointer"
                                    >
                                        <ArrowLeftIcon weight="bold" size={13} />
                                        <span>Back to details</span>
                                    </button>
                                    <h2 className="text-xl font-bold text-km-heading tracking-tight">
                                        Verify Work Email
                                    </h2>
                                    <p className="text-xs text-km-text-secondary mt-0.5">
                                        Verify your work email address to post jobs and connect with candidates.
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-xs font-medium text-km-text-primary mb-1.5">
                                        Official Work Email <span className="text-red-500 dark:text-red-400">*</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <EnvelopeSimpleIcon weight="bold" size={16} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="email"
                                                disabled={isEmailVerified || (otpSent && resendTimer > 0)}
                                                value={email}
                                                onChange={(e) => {
                                                    setEmail(e.target.value);
                                                    setError(null);
                                                    setOtpSent(false);
                                                }}
                                                placeholder="e.g. hr@company.com"
                                                className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl border border-km-border focus:outline-none focus:border-[#0B5ED7] focus:ring-1 focus:ring-[#0B5ED7] text-km-text-primary placeholder:text-slate-400 disabled:bg-slate-50 disabled:text-slate-500"
                                            />
                                        </div>

                                        {!isEmailVerified && (
                                            <button
                                                type="button"
                                                disabled={loading || !isValidEmail(email)}
                                                onClick={handleSendEmailOtp}
                                                className="bg-[#071A4D] hover:bg-[#0B1F52] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold px-4 py-2.5 rounded-xl transition shrink-0 cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                            >
                                                {loading && !otpSent
                                                    ? 'Sending...'
                                                    : otpSent
                                                    ? 'Resend'
                                                    : 'Send Code'}
                                            </button>
                                        )}
                                    </div>

                                    {isPersonalDomain && (
                                        <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2.5 mt-2 leading-tight">
                                            Note: A company email speeds up verification. Personal email accounts may require document review before job postings go live.
                                        </p>
                                    )}
                                </div>

                                {isEmailVerified && (
                                    <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <CheckCircleIcon weight="bold" size={16} className="text-emerald-600 dark:text-emerald-400" />
                                            <span className="text-xs font-semibold text-emerald-800 truncate">
                                                Verified: {email}
                                            </span>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(3)}
                                            className="text-xs font-semibold text-km-link hover:underline cursor-pointer"
                                        >
                                            Proceed →
                                        </button>
                                    </div>
                                )}

                                {otpSent && !isEmailVerified && (
                                    <div className="border border-km-border rounded-xl p-4 bg-slate-50/50 space-y-3.5">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-medium text-km-text-primary">
                                                Enter 4-digit code sent to <strong className="text-km-heading">{email}</strong>
                                            </span>
                                            {resendTimer > 0 ? (
                                                <span className="text-[11px] text-slate-500">Resend in {resendTimer}s</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={handleSendEmailOtp}
                                                    className="text-[11px] font-semibold text-km-link hover:underline cursor-pointer"
                                                >
                                                    Resend Code
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex justify-center gap-2.5">
                                            {emailOtp.map((digit, index) => (
                                                <input
                                                    key={index}
                                                    ref={(el) => {
                                                        otpInputsRef.current[index] = el;
                                                    }}
                                                    type="text"
                                                    inputMode="numeric"
                                                    maxLength={1}
                                                    value={digit}
                                                    onChange={(e) => handleOtpDigitChange(e.target.value, index)}
                                                    onKeyDown={(e) => handleOtpKeyDown(e, index)}
                                                    className="w-11 h-11 text-center text-lg font-bold rounded-xl border border-km-border bg-km-surface-card text-km-text-primary focus:outline-none focus:border-[#0B5ED7] focus:ring-1 focus:ring-[#0B5ED7] shadow-xs"
                                                />
                                            ))}
                                        </div>

                                        <button
                                            type="button"
                                            disabled={loading || emailOtp.some((d) => d === '')}
                                            onClick={() => executeEmailVerify()}
                                            className="w-full bg-[#071A4D] hover:bg-[#0B1F52] disabled:bg-slate-200 disabled:text-slate-400 text-white rounded-xl py-2.5 text-xs font-semibold transition cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                        >
                                            {loading ? 'Verifying...' : 'Verify Code & Proceed'}
                                        </button>
                                    </div>
                                )}

                                <div className="pt-2 flex items-center justify-between">
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(3)}
                                        className="text-xs font-medium text-km-text-secondary hover:text-km-heading underline cursor-pointer"
                                    >
                                        Skip email verification for now
                                    </button>

                                    {isEmailVerified && (
                                        <button
                                            type="button"
                                            onClick={() => setCurrentStep(3)}
                                            className="flex items-center gap-1.5 bg-[#071A4D] hover:bg-[#0B1F52] text-white rounded-xl py-2 px-4 text-xs font-semibold transition shadow-sm cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                        >
                                            <span>Next: Company</span>
                                            <ArrowRightIcon weight="bold" size={14} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ---------------------------------------------------- */}
                        {/* STEP 3: Company Setup                                */}
                        {/* ---------------------------------------------------- */}
                        {currentStep === 3 && (
                            <div className="space-y-4">
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => setCurrentStep(2)}
                                        className="inline-flex items-center gap-1 text-xs text-km-text-secondary hover:text-km-heading font-medium mb-1 cursor-pointer"
                                    >
                                        <ArrowLeftIcon weight="bold" size={13} />
                                        <span>Back to email</span>
                                    </button>
                                    <h2 className="text-xl font-bold text-km-heading tracking-tight">
                                        Company Setup
                                    </h2>
                                    <p className="text-xs text-km-text-secondary mt-0.5">
                                        Enter your company details to complete registration.
                                    </p>
                                </div>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-medium text-km-text-primary mb-1.5">
                                            Company Legal Name <span className="text-red-500 dark:text-red-400">*</span>
                                        </label>
                                        <div className="relative">
                                            <BuildingOfficeIcon weight="bold" size={16} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                required
                                                value={companyName}
                                                onChange={(e) => {
                                                    setCompanyName(e.target.value);
                                                    setError(null);
                                                }}
                                                placeholder="e.g. Acme Technologies Pvt Ltd"
                                                className="w-full pl-10 pr-3.5 py-2 text-sm rounded-xl border border-km-border focus:outline-none focus:border-[#0B5ED7] focus:ring-1 focus:ring-[#0B5ED7] text-km-text-primary placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-km-text-primary mb-1.5">
                                            Company Website
                                        </label>
                                        <div className="relative">
                                            <GlobeIcon weight="bold" size={16} className="text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="url"
                                                value={companyWebsite}
                                                onChange={(e) => setCompanyWebsite(e.target.value)}
                                                placeholder="https://company.com"
                                                className="w-full pl-10 pr-3.5 py-2 text-sm rounded-xl border border-km-border focus:outline-none focus:border-[#0B5ED7] focus:ring-1 focus:ring-[#0B5ED7] text-km-text-primary placeholder:text-slate-400"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-km-text-primary mb-1.5">
                                            Industry / Sector
                                        </label>
                                        <select
                                            value={industry}
                                            onChange={(e) => setIndustry(e.target.value)}
                                            className="w-full px-3 py-2 text-sm rounded-xl border border-km-border focus:outline-none focus:border-[#0B5ED7] focus:ring-1 focus:ring-[#0B5ED7] text-km-text-primary bg-km-surface-card"
                                        >
                                            <option value="">Select industry category</option>
                                            {INDUSTRY_OPTIONS.map((ind) => (
                                                <option key={ind} value={ind}>
                                                    {ind}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Company Brand Logo */}
                                    <div>
                                        <label className="block text-xs font-medium text-km-text-primary mb-1.5">
                                            Company Logo
                                        </label>
                                        <div className="flex items-center gap-3 p-3 border border-dashed border-km-border rounded-xl bg-slate-50/50">
                                            <div className="w-12 h-12 rounded-xl bg-white border border-km-border flex items-center justify-center overflow-hidden shrink-0">
                                                {logoPreview ? (
                                                    <img
                                                        src={logoPreview}
                                                        alt="Logo Preview"
                                                        className="w-full h-full object-contain"
                                                    />
                                                ) : (
                                                    <BuildingOfficeIcon size={20} className="text-slate-300" />
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <input
                                                    type="file"
                                                    id="company-logo-input"
                                                    accept="image/png,image/jpeg,image/svg+xml"
                                                    onChange={handleLogoSelect}
                                                    className="hidden"
                                                />
                                                <label
                                                    htmlFor="company-logo-input"
                                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-km-heading hover:text-km-link cursor-pointer py-1 px-2.5 rounded-lg border border-km-border bg-km-surface-card shadow-xs"
                                                >
                                                    <CloudArrowUpIcon weight="bold" size={13} />
                                                    <span>{logoFile ? 'Change Logo' : 'Upload Logo'}</span>
                                                </label>
                                                <p className="text-[10px] text-km-text-secondary mt-0.5 truncate">
                                                    PNG, JPG, or SVG up to 2MB
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Verification Document Selector */}
                                    <div className="pt-2 border-t border-km-border">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-semibold text-km-text-primary">
                                                Company Verification Document
                                            </span>
                                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                                Optional
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-2 mb-2.5">
                                            {DOCUMENT_TYPES.slice(0, 4).map((doc) => {
                                                const IconComponent = doc.icon;
                                                const isSelected = selectedDocType === doc.id;
                                                return (
                                                    <button
                                                        key={doc.id}
                                                        type="button"
                                                        onClick={() => setSelectedDocType(doc.id)}
                                                        className={`p-2 rounded-xl border text-left flex items-start gap-2 transition cursor-pointer ${
                                                            isSelected
                                                                ? 'border-[#0B5ED7] bg-blue-50/50 ring-1 ring-[#0B5ED7]'
                                                                : 'border-km-border hover:border-slate-300 bg-km-surface-card'
                                                        }`}
                                                    >
                                                        <IconComponent
                                                            size={15}
                                                            className={`mt-0.5 shrink-0 ${
                                                                isSelected ? 'text-km-link' : 'text-slate-400'
                                                            }`}
                                                        />
                                                        <div className="min-w-0">
                                                            <p className="text-[11px] font-semibold text-km-text-primary truncate">
                                                                {doc.name}
                                                            </p>
                                                        </div>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <div className="mb-2.5">
                                            <input
                                                type="text"
                                                value={docNumber}
                                                onChange={(e) => setDocNumber(e.target.value)}
                                                placeholder="Registration Number (e.g. 27AAAAA0000A1Z5 GSTIN)"
                                                className="w-full px-3 py-2 text-xs rounded-xl border border-km-border focus:outline-none focus:border-[#0B5ED7] focus:ring-1 focus:ring-[#0B5ED7] text-km-text-primary placeholder:text-slate-400"
                                            />
                                        </div>

                                        {/* Document File Attachment */}
                                        <div className="p-2.5 border border-dashed border-km-border rounded-xl bg-slate-50/50 flex items-center justify-between">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <FileTextIcon weight="bold" size={16} className="text-slate-400 shrink-0" />
                                                <div className="truncate">
                                                    <p className="text-[11px] font-medium text-km-text-primary truncate">
                                                        {docFile ? docFile.name : 'Attach Document (.pdf, .jpg)'}
                                                    </p>
                                                    <p className="text-[10px] text-km-text-secondary">
                                                        Max 5MB (PDF, JPG, or PNG)
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="shrink-0">
                                                <input
                                                    type="file"
                                                    id="company-doc-input"
                                                    accept=".pdf,.jpeg,.jpg,.png"
                                                    onChange={handleDocFileSelect}
                                                    className="hidden"
                                                />
                                                <label
                                                    htmlFor="company-doc-input"
                                                    className="inline-flex items-center gap-1 text-xs font-semibold text-km-heading hover:text-km-link cursor-pointer py-1 px-2.5 rounded-lg border border-km-border bg-km-surface-card shadow-xs"
                                                >
                                                    <CloudArrowUpIcon weight="bold" size={13} />
                                                    <span>{docFile ? 'Replace' : 'Upload'}</span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-3 space-y-2">
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleFinalSubmit(false)}
                                        className="w-full flex items-center justify-center gap-2 bg-[#071A4D] hover:bg-[#0B1F52] disabled:bg-slate-300 text-white rounded-xl py-3 px-4 font-semibold text-sm transition shadow-sm cursor-pointer dark:bg-km-primary dark:hover:bg-km-primary-dark"
                                    >
                                        <ShieldCheckIcon weight="bold" size={16} />
                                        <span>{loading ? 'Saving Profile...' : 'Complete Company Setup'}</span>
                                    </button>

                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleFinalSubmit(true)}
                                        className="w-full text-center text-xs font-medium text-km-text-secondary hover:text-km-heading py-1 cursor-pointer"
                                    >
                                        Add documents later &amp; go to dashboard
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Bottom Legal Disclaimer */}
            <footer className="py-6 text-center text-xs text-km-text-secondary">
                <p>
                    By continuing, you agree to KaamMilega&apos;s{' '}
                    <Link href="/policies/terms" className="text-km-heading hover:underline font-semibold">
                        Terms of Service
                    </Link>{' '}
                    and{' '}
                    <Link href="/policies/privacy" className="text-km-heading hover:underline font-semibold">
                        Privacy Policy
                    </Link>
                    .
                </p>
            </footer>
        </div>
    );
}