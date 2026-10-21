'use client';

import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, DeviceMobileIcon, XIcon } from '@phosphor-icons/react';

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
        setTimeout(() => {
            setIsSubmitting(false);
            setIsSent(true);
        }, 500);
    };

    return (
        <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans antialiased"
            onClick={onClose}
        >
            <div
                className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#D9E0EA] overflow-hidden animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-6 pb-2">
                    <div className="flex items-center gap-3">
                        <DeviceMobileIcon size={24} weight="duotone" className="text-[#FF6B00] shrink-0" aria-hidden="true" />
                        <div>
                            <h3 className="text-base sm:text-lg font-semibold text-[#111827] tracking-tight">
                                Get the KaamMilega App
                            </h3>
                            <p className="text-xs text-[#5B6472]">
                                Available for Android and iOS
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-[#F4F7FB] transition-colors cursor-pointer"
                        aria-label="Close dialog"
                    >
                        <XIcon weight="bold" size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 pt-4">
                    {/* Official Store Badges */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3 p-4 bg-[#F4F7FB] rounded-2xl border border-[#D9E0EA]">
                        <a
                            href="https://play.google.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:opacity-90 transition-opacity inline-block"
                            aria-label="Get it on Google Play"
                        >
                            <img
                                src="/asset/google-play-badge-logo.svg"
                                alt="Google Play"
                                className="h-10 sm:h-11 w-auto object-contain"
                            />
                        </a>
                        <a
                            href="https://apple.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:opacity-90 transition-opacity inline-block"
                            aria-label="Download on the App Store"
                        >
                            <img
                                src="/asset/download-on-the-app-store-apple-logo.svg"
                                alt="App Store"
                                className="h-10 sm:h-11 w-auto object-contain"
                            />
                        </a>
                    </div>

                    {/* Direct SMS Install Link */}
                    <div className="mt-5">
                        <label className="block text-xs font-medium text-[#5B6472] mb-2 text-center">
                            Or get direct download link via SMS
                        </label>
                        {isSent ? (
                            <div className="flex items-center justify-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium">
                                <CheckCircleIcon weight="bold" size={16} className="text-emerald-600 shrink-0" />
                                <span>Download link sent to +91 {phone}</span>
                            </div>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex gap-2">
                                <div className="flex items-center flex-1 bg-white border border-[#D9E0EA] rounded-xl px-3.5 focus-within:border-[#FF6B00] focus-within:ring-2 focus-within:ring-[#FF6B00]/15 transition-all">
                                    <span className="text-xs text-[#5B6472] font-semibold mr-1.5">+91</span>
                                    <input
                                        type="tel"
                                        maxLength={10}
                                        value={phone}
                                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                                        placeholder="Enter 10-digit mobile number"
                                        className="w-full py-2.5 bg-transparent text-sm text-[#111827] placeholder:text-[#8F9AA8] focus:outline-none"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={phone.length < 10 || isSubmitting}
                                    className="px-5 py-2.5 bg-[#FF6B00] hover:bg-[#FF8A00] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer shadow-xs active:scale-98 shrink-0"
                                >
                                    {isSubmitting ? 'Sending...' : 'Send Link'}
                                </button>
                            </form>
                        )}
                    </div>

                    <p className="mt-4 text-center text-xs text-[#8F9AA8]">
                        Free download • 0% platform commission
                    </p>
                </div>
            </div>
        </div>
    );
}
