'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronRight, Loader2, ShieldCheck, ArrowLeft, Phone, KeyRound } from 'lucide-react';
import Link from 'next/link';
import api from '@/lib/axios';

export default function AdminLoginPage() {
    const router = useRouter();
    const [mobile, setMobile] = useState('');
    const [otp, setOtp] = useState('');
    const [step, setStep] = useState<'SEND_OTP' | 'VERIFY_OTP'>('SEND_OTP');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            await api.post('/auth/otp/send', { mobile, role: 'admin' });
            setStep('VERIFY_OTP');
        } catch (err: any) {
            setError(err.response?.data?.error || 'Failed to send OTP. Please check your number.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const response: any = await api.post('/auth/otp/verify', { mobile, code: otp, role: 'admin' });
            if (response.token) {
                localStorage.setItem('token', response.token);
                localStorage.setItem('user', JSON.stringify(response.user));
                router.push('/admin');
            } else {
                setError('Invalid response from server.');
            }
        } catch (err: any) {
            setError(err.response?.data?.error || 'Invalid OTP. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#FDFCFE] flex items-center justify-center p-6 selection:bg-purple-200">
            <div className="absolute top-8 left-8">
                <Link href="/" className="flex items-center gap-2 text-slate-500 hover:text-purple-700 transition-colors font-semibold text-sm">
                    <ArrowLeft size={18} />
                    Back to Site
                </Link>
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full max-w-[480px]"
            >
                <div className="bg-white rounded-[40px] shadow-2xl shadow-purple-900/10 border border-purple-50 p-10 md:p-12">
                    {/* Logo & Header */}
                    <div className="text-center mb-10">
                        <div className="flex justify-center mb-6">
                            <div className="relative">
                                <div className="w-20 h-20 bg-gradient-to-tr from-purple-600 to-indigo-600 rounded-3xl flex items-center justify-center text-white shadow-xl shadow-purple-200 rotate-12">
                                    <ShieldCheck size={40} />
                                </div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 rounded-full border-4 border-white flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                                </div>
                            </div>
                        </div>
                        <h1 className="text-3xl font-black text-slate-900 mb-2">Admin Portal</h1>
                        <p className="text-slate-500 font-medium">Secure access to Kaam Milega Intelligence</p>
                    </div>

                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            className="mb-8 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-sm font-bold"
                        >
                            <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                            {error}
                        </motion.div>
                    )}

                    <form onSubmit={step === 'SEND_OTP' ? handleSendOTP : handleVerifyOTP} className="space-y-6">
                        {step === 'SEND_OTP' ? (
                            <div className="space-y-2">
                                <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest ml-1">Mobile Number</label>
                                <div className="relative group">
                                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={20} />
                                    <input
                                        type="tel"
                                        required
                                        placeholder="9876543210"
                                        value={mobile}
                                        onChange={(e) => setMobile(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-purple-50/50 border border-transparent rounded-2xl text-[15px] font-medium focus:outline-none focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-500/5 transition-all outline-none"
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex justify-between items-center px-1">
                                    <label className="text-[12px] font-black text-slate-400 uppercase tracking-widest">Verification Code</label>
                                    <button type="button" onClick={() => setStep('SEND_OTP')} className="text-[11px] font-bold text-purple-600 hover:underline">Change Number?</button>
                                </div>
                                <div className="relative group">
                                    <KeyRound className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-purple-600 transition-colors" size={20} />
                                    <input
                                        type="text"
                                        required
                                        placeholder="1234"
                                        maxLength={4}
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        className="w-full pl-12 pr-4 py-4 bg-purple-50/50 border border-transparent rounded-2xl text-[15px] font-medium focus:outline-none focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-500/5 transition-all outline-none tracking-widest"
                                    />
                                </div>
                            </div>
                        )}

                        <button
                            disabled={isLoading}
                            className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-2xl py-4 font-bold text-[16px] shadow-xl shadow-purple-200 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="animate-spin" size={20} />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <span>{step === 'SEND_OTP' ? 'Send OTP' : 'Verify Access'}</span>
                                    <ChevronRight size={20} />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-10 text-center">
                        <div className="flex items-center justify-center gap-2 text-slate-400 text-[11px] font-bold uppercase tracking-widest">
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            System Encrypted
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                            Kaam Milega V1.0
                            <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
                        </div>
                    </div>
                </div>
            </motion.div>

            {/* Background Decorative Elements */}
            <div className="fixed top-0 left-0 w-full h-full -z-10 pointer-events-none overflow-hidden">
                <div className="absolute top-[-10%] right-[-5%] w-[40%] h-[40%] bg-purple-100/50 blur-[120px] rounded-full"></div>
                <div className="absolute bottom-[-10%] left-[-5%] w-[40%] h-[40%] bg-indigo-100/50 blur-[120px] rounded-full"></div>
            </div>
        </div>
    );
}
