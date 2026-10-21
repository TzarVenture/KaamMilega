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

    const focusBox = (index: number) => {
        const box = inputRefs.current[Math.max(0, Math.min(index, length - 1))];
        box?.focus();
        box?.select();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>, index: number) => {
        const digits = e.target.value.replace(/\D/g, "");
        const newOtp = Array.from({ length }, (_, i) => value[i] || "");
        if (!digits) {
            newOtp[index] = "";
            onChange(newOtp);
            return;
        }

        if (digits.length > 1) {
            // SMS autofill ("one-time-code") or fast typing delivers several digits at once:
            // the box keeps its old digit plus the new ones, so spread them from this box on
            const incoming = value[index] && digits.startsWith(value[index]) ? digits.slice(value[index].length) || digits : digits;
            const chars = (incoming.length >= length ? incoming.slice(0, length) : incoming).split("");
            const start = incoming.length >= length ? 0 : index;
            chars.forEach((char, i) => {
                if (start + i < length) newOtp[start + i] = char;
            });
            onChange(newOtp);
            focusBox(start + chars.length);
            return;
        }

        newOtp[index] = digits;
        onChange(newOtp);
        // Move on right away: deferring focus lets quick keystrokes land in the same box
        if (index < length - 1) focusBox(index + 1);
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
                    // Lets iOS/Android offer the code from the SMS; no maxLength, or autofill is cut to 1 digit
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    aria-label={`Digit ${index + 1} of ${length}`}
                    value={value[index] || ""}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={handlePaste}
                    onClick={() => inputRefs.current[index]?.select()}
                    className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-black border-2 border-slate-300 rounded-2xl bg-km-surface-card text-slate-900 focus:border-km-primary focus:ring-4 focus:ring-km-primary/10 outline-none transition-all shadow-sm"
                />
            ))}
        </div>
    );
}
