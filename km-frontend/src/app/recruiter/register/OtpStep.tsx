"use client";

import { useState, useRef, useEffect } from "react";
import api from "@/lib/axios";
import OtpInput from "@/components/ui/OtpInput";
import { AlertCircle, CheckCircle2 } from "lucide-react";

interface Props {
    data: any;
    updateData: (val: any) => void;
    onBack: () => void;
    onNext: () => void;
}

export default function OtpStep({ data, updateData, onBack, onNext }: Props) {
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [timer, setTimer] = useState(30);
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleResend = async () => {
        if (timer > 0) return;
        setError(null);
        try {
            await api.post("/auth/otp/email/send", { email: data.email });
            setTimer(30);
            setOtp(["", "", "", ""]);
            alert("Verification code resent to your email.");
        } catch (err: any) {
            setError(err.message || "Failed to resend verification code.");
        }
    };

    const handleChange = (value: string, index: number) => {
        const digit = value.replace(/\D/g, "").slice(-1);
        const newOtp = [...otp];
        newOtp[index] = digit;
        setOtp(newOtp);
        setError(null);

        if (digit && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const onVerify = async () => {
        const code = otp.join("");
        if (code.length < 4) {
            setError("Please enter the full 4-digit code.");
            return;
        }
        setVerifying(true);
        setError(null);
        try {
            await api.post("/auth/otp/email/verify", {
                email: data.email,
                code: code
            });
            updateData({ ...data, otp: code, isEmailVerified: true });
            onNext();
        } catch (err: any) {
            console.error("OTP Verification Error:", err);
            setError(err.message || "Invalid or expired verification code. Please check and try again.");
        } finally {
            setVerifying(false);
        }
    };

    const isComplete = otp.every((digit) => digit !== "");

    return (
        <div className="space-y-6 text-center animate-in fade-in duration-300">
            <header className="space-y-2">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-6 h-6" />
                </div>
                <h2 className="text-2xl font-black text-slate-900">Enter Verification Code</h2>
                <p className="text-xs font-bold text-slate-500">
                    We sent a 4-digit code to <span className="text-indigo-600 font-extrabold">{data?.email}</span>
                </p>
            </header>

            {error && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-2 text-xs font-bold text-left">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* OTP Input Group */}
            <OtpInput value={otp} onChange={(val) => { setError(null); setOtp(val); }} />

            <div className="flex gap-4 pt-2">
                <button
                    onClick={onBack}
                    className="flex-1 py-3.5 border-2 border-slate-300 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition text-sm cursor-pointer"
                >
                    Back
                </button>
                <button
                    disabled={!isComplete || verifying}
                    onClick={onVerify}
                    className="flex-1 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-xl transition-all text-sm shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                    {verifying ? "Verifying..." : "Verify & Continue"}
                </button>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-2">
                <p className="text-xs font-semibold text-slate-500">
                    Didn't receive email? Check spam folder or{" "}
                    <button
                        type="button"
                        disabled={timer > 0}
                        onClick={handleResend}
                        className="text-indigo-600 font-extrabold disabled:text-slate-400 hover:underline cursor-pointer"
                    >
                        {timer > 0 ? `Resend Code in 00:${timer.toString().padStart(2, '0')}` : "Resend Code"}
                    </button>
                </p>
            </div>
        </div>
    );
}