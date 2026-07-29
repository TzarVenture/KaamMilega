"use client";

import { useEffect, useRef } from "react";

interface OtpInputProps {
    length?: number;
    value: string[];
    onChange: (otp: string[]) => void;
    autoFocus?: boolean;
}

export default function OtpInput({ length = 4, value, onChange, autoFocus = true }: OtpInputProps) {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

    useEffect(() => {
        if (autoFocus && inputRefs.current[0]) {
            const timer = setTimeout(() => {
                inputRefs.current[0]?.focus();
                inputRefs.current[0]?.select();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [autoFocus]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const raw = e.target.value;
        const digits = raw.replace(/\D/g, "");
        if (!digits) {
            const newOtp = [...value];
            newOtp[index] = "";
            onChange(newOtp);
            return;
        }

        const lastDigit = digits.slice(-1);
        const newOtp = [...value];
        newOtp[index] = lastDigit;
        onChange(newOtp);

        // Auto advance to next box
        if (index < length - 1) {
            requestAnimationFrame(() => {
                inputRefs.current[index + 1]?.focus();
                inputRefs.current[index + 1]?.select();
            });
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace") {
            if (!value[index] && index > 0) {
                inputRefs.current[index - 1]?.focus();
                inputRefs.current[index - 1]?.select();
            }
        } else if (e.key === "ArrowLeft" && index > 0) {
            inputRefs.current[index - 1]?.focus();
            inputRefs.current[index - 1]?.select();
        } else if (e.key === "ArrowRight" && index < length - 1) {
            inputRefs.current[index + 1]?.focus();
            inputRefs.current[index + 1]?.select();
        }
    };

    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
        if (!pastedData) return;

        const newOtp = Array(length).fill("");
        pastedData.split("").forEach((char, i) => {
            if (i < length) newOtp[i] = char;
        });
        onChange(newOtp);

        const targetIndex = Math.min(pastedData.length, length - 1);
        requestAnimationFrame(() => {
            inputRefs.current[targetIndex]?.focus();
            inputRefs.current[targetIndex]?.select();
        });
    };

    return (
        <div className="flex justify-center gap-3 sm:gap-4 my-4">
            {Array.from({ length }).map((_, index) => (
                <input
                    key={index}
                    ref={(el) => { inputRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={value[index] || ""}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={handlePaste}
                    onClick={() => inputRefs.current[index]?.select()}
                    className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-black border-2 border-slate-300 rounded-2xl bg-white text-slate-900 focus:border-[#5b2168] focus:ring-4 focus:ring-purple-100 outline-none transition-all shadow-sm"
                />
            ))}
        </div>
    );
}
