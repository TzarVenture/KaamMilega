'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeftIcon, CircleNotchIcon, WarningCircleIcon } from '@phosphor-icons/react';
import Link from 'next/link';
import api from '@/lib/axios';
import { saveSession } from '@/lib/auth';
import { errorText } from "@/lib/notify";
import BrandLogo from '@/components/km/BrandLogo';
import OtpInput from '@/components/ui/OtpInput';
import { normalizeMobile } from '@/components/auth/AuthUI';
import { btn, field } from '@/components/admin/ui';

const EMPTY_OTP = ['', '', '', ''];

export default function AdminLoginPage() {
    const router = useRouter();
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState<string[]>(EMPTY_OTP);
    const [step, setStep] = useState<'SEND_OTP' | 'VERIFY_OTP'>('SEND_OTP');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await api.post('/auth/otp/send', { mobile, role: 'admin' });
            setOtp(EMPTY_OTP);
            setStep('VERIFY_OTP');
        } catch (err) {
            setError(errorText(err, "Couldn't send the code. Check the number and try again."));
        } finally {
            setIsLoading(false);
        }
    };

    const verify = async (code: string) => {
        setIsLoading(true);
        setError('');

        try {
            const response = await api.post<unknown, { user?: Parameters<typeof saveSession>[0] }>('/auth/otp/verify', { mobile, code, role: 'admin' });
            if (response.user) {
                saveSession(response.user, 'admin');
                router.push('/admin');
            } else {
                setError('Something went wrong. Try again.');
            }
        } catch (err) {
            setError(errorText(err, "That code didn't work. Try again."));
            setOtp(EMPTY_OTP);
        } finally {
            setIsLoading(false);
        }
    };

    const code = otp.join('');

    return (
        <div className="min-h-screen bg-km-surface flex flex-col">
            <div className="p-6">
                <Link href="/" className="inline-flex items-center gap-2 text-sm font-medium text-km-text-secondary hover:text-km-link transition-colors">
                    <ArrowLeftIcon size={16} aria-hidden="true" />
                    Back to Kaammilega
                </Link>
            </div>

            <main className="flex-1 flex items-center justify-center px-4 pb-16">
                <div className="w-full max-w-sm bg-km-surface-card rounded-2xl border border-km-border shadow-sm p-8">
                    <BrandLogo size="md" />
                    <h1 className="mt-6 text-xl font-bold text-km-heading">Admin sign in</h1>
                    <p className="mt-1 text-sm text-km-text-secondary">
                        {step === 'SEND_OTP' ? 'Use the mobile number on your admin account.' : `Enter the 4-digit code sent to ${mobile}.`}
                    </p>

                    {error && (
                        <p role="alert" className="mt-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                            <WarningCircleIcon size={18} className="shrink-0 mt-px" aria-hidden="true" />
                            {error}
                        </p>
                    )}

                    {step === 'SEND_OTP' ? (
                        <form onSubmit={handleSendOTP} className="mt-6 space-y-5">
                            <label className="block">
                                <span className={field.label}>Mobile number</span>
                                <input
                                    type="tel"
                                    inputMode="numeric"
                                    autoComplete="tel"
                                    required
                                    autoFocus
                                    placeholder="98765 43210"
                                    value={mobile}
                                    onChange={(e) => setMobile(normalizeMobile(e.target.value))}
                                    className={`${field.input} font-inter`}
                                />
                            </label>
                            <button type="submit" disabled={isLoading || mobile.length < 10} className={`${btn.primary} w-full`}>
                                {isLoading && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                Send code
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={(e) => { e.preventDefault(); if (code.length === 4) verify(code); }} className="mt-6 space-y-5">
                            <div>
                                <div className="flex items-center justify-between mb-1.5">
                                    <span className="text-sm font-medium text-km-heading">Code</span>
                                    <button
                                        type="button"
                                        onClick={() => { setStep('SEND_OTP'); setError(''); }}
                                        className="text-sm font-medium text-km-link hover:underline cursor-pointer"
                                    >
                                        Change number
                                    </button>
                                </div>
                                <OtpInput
                                    value={otp}
                                    align="start"
                                    disabled={isLoading}
                                    invalid={Boolean(error)}
                                    onChange={(next) => {
                                        setOtp(next);
                                        setError('');
                                        if (next.join('').length === 4) verify(next.join(''));
                                    }}
                                />
                            </div>
                            <button type="submit" disabled={isLoading || code.length < 4} className={`${btn.primary} w-full`}>
                                {isLoading && <CircleNotchIcon size={16} className="animate-spin" aria-hidden="true" />}
                                Sign in
                            </button>
                        </form>
                    )}
                </div>
            </main>
        </div>
    );
}
