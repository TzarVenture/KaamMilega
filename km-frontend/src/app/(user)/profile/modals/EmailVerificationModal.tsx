"use client";

import { useState, useEffect } from "react";
import ModalWrapper from "@/components/ui/ModalWrapper";
import OtpInput from "@/components/ui/OtpInput";
import api from "@/lib/axios";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    currentEmail?: string;
    onSuccess: (updatedUser: any) => void;
}

export default function EmailVerificationModal({ isOpen, onClose, currentEmail = "", onSuccess }: Props) {
    const [email, setEmail] = useState(currentEmail);
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [step, setStep] = useState<"email" | "otp">("email");
    const [sending, setSending] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [resendTimer, setResendTimer] = useState(0);
    const [infoMsg, setInfoMsg] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            setEmail(currentEmail);
            setOtp(["", "", "", ""]);
            setStep("email");
            setError(null);
            setInfoMsg(null);
        }
    }, [isOpen, currentEmail]);

    useEffect(() => {
        let interval: any;
        if (resendTimer > 0) {
            interval = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [resendTimer]);

    const validateEmail = (str: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(str.trim());

    const handleSendOtp = async () => {
        if (!email.trim() || !validateEmail(email)) {
            setError("Please enter a valid email address.");
            return;
        }
        setError(null);
        setInfoMsg(null);
        setSending(true);
        try {
            await api.post("/auth/otp/email/send", { email: email.trim() });
            setStep("otp");
            setResendTimer(30);
        } catch (err: any) {
            setError(err.message || "Failed to send verification code.");
        } finally {
            setSending(false);
        }
    };

    const handleResendOtp = async () => {
        if (resendTimer > 0) return;
        setError(null);
        setSending(true);
        try {
            await api.post("/auth/otp/email/send", { email: email.trim() });
            setResendTimer(30);
            setOtp(["", "", "", ""]);
            setInfoMsg("Verification code resent to your email.");
        } catch (err: any) {
            setError(err.message || "Failed to resend verification code.");
        } finally {
            setSending(false);
        }
    };

    const handleVerifyOtp = async () => {
        const code = otp.join("");
        if (code.length < 4) {
            setError("Please enter the complete 4-digit code.");
            return;
        }
        setError(null);
        setVerifying(true);
        try {
            await api.post("/auth/otp/email/verify", { email: email.trim(), code });
            
            // Update email & is_email_verified on user profile
            await api.patch("/user/profile", {
                email: email.trim(),
                is_email_verified: true
            });

            // Fetch latest user profile from MongoDB to ensure clean sync
            const freshUser: any = await api.get("/user/profile");

            if (freshUser) {
                localStorage.setItem("user", JSON.stringify(freshUser));
                onSuccess(freshUser);
            }
            onClose();
        } catch (err: any) {
            setError(err.message || "Invalid or expired code.");
        } finally {
            setVerifying(false);
        }
    };

    return (
        <ModalWrapper isOpen={isOpen} onClose={onClose} title="Verify Email Address">
            <div className="space-y-5 py-2">
                {error && (
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {infoMsg && (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-3 rounded-xl flex items-center gap-2 text-xs font-bold">
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                        <span>{infoMsg}</span>
                    </div>
                )}

                {step === "email" ? (
                    <div className="space-y-4">
                        <p className="text-xs font-semibold text-slate-500">
                            Verify your email address to receive live job alerts and recruiter messages directly to your inbox.
                        </p>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                                Email Address *
                            </label>
                            <div className="relative">
                                <Mail className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
                                <input
                                    type="email"
                                    placeholder="yourname@gmail.com"
                                    value={email}
                                    onChange={(e) => { setError(null); setEmail(e.target.value); }}
                                    className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-600"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-xs font-bold hover:bg-slate-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={sending || !email.trim()}
                                onClick={handleSendOtp}
                                className="px-6 py-2.5 rounded-xl bg-[#5b2168] hover:bg-[#4a1b55] disabled:bg-slate-300 text-white text-xs font-bold transition-all shadow-md shadow-purple-900/10 cursor-pointer"
                            >
                                {sending ? "Sending Code..." : "Send Verification Code →"}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4 text-center">
                        <div className="w-10 h-10 bg-purple-50 text-purple-700 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <p className="text-xs font-bold text-slate-600">
                            Enter the 4-digit code sent to <span className="text-[#5b2168] font-extrabold">{email}</span>
                        </p>

                        <OtpInput value={otp} onChange={(val) => { setError(null); setOtp(val); }} />

                        <p className="text-xs font-semibold text-slate-500 pt-2">
                            Didn't receive email? Check spam or{" "}
                            <button
                                type="button"
                                disabled={resendTimer > 0 || sending}
                                onClick={handleResendOtp}
                                className="text-[#5b2168] font-extrabold disabled:text-slate-400 hover:underline cursor-pointer"
                            >
                                {resendTimer > 0 ? `Resend Code in 00:${resendTimer.toString().padStart(2, '0')}` : "Resend Code"}
                            </button>
                        </p>

                        <div className="flex justify-between items-center pt-4 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setStep("email")}
                                className="text-xs font-bold text-slate-500 hover:text-slate-800"
                            >
                                ← Change Email
                            </button>
                            <button
                                type="button"
                                disabled={verifying || otp.join("").length < 4}
                                onClick={handleVerifyOtp}
                                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-emerald-900/10 cursor-pointer"
                            >
                                {verifying ? "Verifying..." : "Verify & Save"}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </ModalWrapper>
    );
}
