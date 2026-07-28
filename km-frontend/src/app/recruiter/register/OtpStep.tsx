// components/registration/OtpStep.tsx
"use client";

import { useState, useRef, useEffect } from "react";
import api from "@/lib/axios";

interface Props {
    data: any;
    updateData: (val: any) => void;
    onBack: () => void;
    onNext: () => void;
}

export default function OtpStep({ data, updateData, onBack, onNext }: Props) {
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [timer, setTimer] = useState(24);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    // Countdown logic for resending email
    useEffect(() => {
        const interval = setInterval(() => {
            setTimer((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(interval);
    }, []);

    const handleChange = (value: string, index: number) => {
        if (isNaN(Number(value))) return;
        const newOtp = [...otp];
        newOtp[index] = value.substring(value.length - 1);
        setOtp(newOtp);

        // Move focus to next input
        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const onVerify = async () => {
        try {
            await api.post("/auth/otp/email/verify", {
                email: data.email,
                code: otp.join("")
            });
            updateData({ ...data, otp: otp.join("") });
            onNext();
        } catch (error: any) {
            console.error("OTP Verification Error:", error);
            alert(error.message || "Invalid OTP");
        }
    };

    const isComplete = otp.every((digit) => digit !== "");

    return (
        <div className="space-y-8 text-center animate-in fade-in duration-500">
            <header className="space-y-2">
                <h2 className="text-2xl font-bold text-gray-900">Verify Your Official Email ID</h2>
                <div className="text-gray-500 text-sm">
                    <p>Please Enter The OTP Sent On</p>
                    <p className="font-semibold text-gray-700">{data?.email}</p>
                </div>
            </header>

            {/* OTP Input Group */}
            <div className="flex justify-center gap-3">
                {otp.map((digit, index) => (
                    <input
                        key={index}
                        type="text"
                        inputMode="numeric"
                        autoFocus={index === 0}
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleChange(e.target.value, index)}
                        onKeyDown={(e) => handleKeyDown(e, index)}
                        ref={(el) => { inputRefs.current[index] = el }}
                        className="w-14 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                    />
                ))}
            </div>

            <div className="flex gap-4">
                <button
                    onClick={onBack}
                    className="flex-1 py-3 border-2 border-indigo-400 text-indigo-500 font-bold rounded-full hover:bg-indigo-50 transition"
                >
                    Back
                </button>
                <button
                    disabled={!isComplete}
                    onClick={onVerify}
                    className="flex-1 py-3 bg-gray-300 disabled:bg-gray-200 text-gray-500 disabled:text-gray-400 data-[complete=true]:bg-indigo-500 data-[complete=true]:text-white font-bold rounded-full transition-all"
                    data-complete={isComplete}
                >
                    Verify
                </button>
            </div>

            <div className="pt-4 border-t border-gray-100 space-y-3">
                <p className="text-xs text-gray-400 leading-relaxed px-4">
                    Can't Find In Inbox? Check Your Spam/Junk Folder Or <br />
                    Resend Email In <span className="font-bold text-gray-600">00:{timer.toString().padStart(2, '0')}</span>
                </p>
                <p className="text-xs font-medium">
                    Or <button className="text-indigo-500 hover:underline">Verify Later</button>
                    <span className="text-gray-400"> (Your Job Won't Go Live Until You Verify)</span>
                </p>
            </div>
        </div>
    );
}