'use client';

import React, { useState, useEffect } from 'react';
import { X, Smartphone, CheckCircle, ArrowRight, QrCode } from 'lucide-react';
import Image from 'next/image';

interface DownloadAppModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function DownloadAppModal({ isOpen, onClose }: DownloadAppModalProps) {
    const [phone, setPhone] = useState('');
    const [isSent, setIsSent] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (phone.length < 10) return;
        setIsSubmitting(true);
        // Simulate immediate API response
        setTimeout(() => {
            setIsSubmitting(false);
            setIsSent(true);
        }, 600);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <div
                className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-km-primary">
                            <Smartphone size={18} />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900">Get the KaamMilega App</h3>
                            <p className="text-xs text-slate-500">Kaam Har Koi, Milega Yahi!</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
                        aria-label="Close dialog"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                        {/* QR Code Column */}
                        <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200/80 text-center">
                            <div className="w-36 h-36 bg-white p-2.5 rounded-lg border border-slate-200 shadow-xs flex items-center justify-center">
                                {/* Clean scalable SVG QR code presentation */}
                                <div className="relative w-full h-full flex flex-col items-center justify-center">
                                    <QrCode size={112} className="text-slate-900" />
                                </div>
                            </div>
                            <span className="mt-2.5 text-xs font-semibold text-slate-700">Scan to Install</span>
                            <span className="text-[11px] text-slate-500">Android &amp; iOS PWA</span>
                        </div>

                        {/* Direct Store / Features Column */}
                        <div className="flex flex-col gap-3">
                            <div className="space-y-2">
                                <div className="flex items-start gap-2 text-xs text-slate-600">
                                    <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <span>Direct calls with verified HR recruiters</span>
                                </div>
                                <div className="flex items-start gap-2 text-xs text-slate-600">
                                    <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <span>InstantMilega 15-minute gig alerts</span>
                                </div>
                                <div className="flex items-start gap-2 text-xs text-slate-600">
                                    <CheckCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                                    <span>Real-time interview updates via push</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2">
                                <a
                                    href="https://play.google.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium transition-colors"
                                >
                                    <span>Google Play Store</span>
                                    <ArrowRight size={14} />
                                </a>
                                <a
                                    href="https://apple.com"
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center justify-between px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium transition-colors"
                                >
                                    <span>Apple App Store</span>
                                    <ArrowRight size={14} />
                                </a>
                            </div>
                        </div>
                    </div>

                    {/* SMS Link Section */}
                    <div className="mt-6 pt-5 border-t border-slate-100">
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                            Or enter your mobile number to get the direct install link:
                        </label>
                        {isSent ? (
                            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs font-medium">
                                <CheckCircle size={16} className="text-emerald-600 shrink-0" />
                                <span>Install link sent successfully to +91 {phone}!</span>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <div className="flex items-center flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 focus-within:border-km-primary focus-within:bg-white focus-within:ring-1 focus-within:ring-km-primary transition-all">
                                    <span className="text-xs text-slate-500 font-semibold mr-1.5">+91</span>
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter 10-digit number"
                                        className="w-full py-2 bg-transparent text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={phone.length < 10 || isSubmitting}
                                    className="px-4 py-2 bg-km-primary hover:bg-km-primary-dark disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg transition-colors shadow-xs shrink-0"
                                >
                                    {isSubmitting ? 'Sending...' : 'Send Link'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
