"use client";

import { useEffect, useRef } from "react";

interface OtpInputProps {
    length?: number;
    value: string[];
    onChange: (otp: string[]) => void;
    autoFocus?: boolean;
    /** Locks the boxes, e.g. while the code is being checked */
    disabled?: boolean;
    /** Red boxes after a wrong code */
    invalid?: boolean;
    /** Box alignment: centred (default) or from the left edge, for left-aligned forms */
    align?: "center" | "start";
}

export default function OtpInput({ length = 4, value, onChange, autoFocus = true, disabled = false, invalid = false, align = "center" }: OtpInputProps) {
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

    // After a wrong code the boxes unlock empty: put the cursor back in the first one
    useEffect(() => {
        if (!disabled && autoFocus && value.every((v) => !v)) {
            inputRefs.current[0]?.focus();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [disabled]);

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
        <div className={`flex ${length > 4 ? "gap-2 sm:gap-3" : "gap-3"} ${align === "start" ? "justify-start" : "justify-center my-4"}`}>
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
                    aria-invalid={invalid || undefined}
                    value={value[index] || ""}
                    disabled={disabled}
                    onChange={(e) => handleChange(e, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={handlePaste}
                    onClick={() => inputRefs.current[index]?.select()}
                    className={`${length > 4 ? "w-11 h-12 sm:w-12 sm:h-14 text-xl" : "w-14 h-14 text-2xl"} text-center font-semibold font-inter rounded-xl border-[1.5px] bg-km-surface-card text-km-text-primary outline-none transition-colors focus:ring-4 disabled:opacity-60 disabled:cursor-not-allowed ${
                        invalid
                            ? "border-red-500 focus:border-red-500 focus:ring-red-100 dark:focus:ring-red-950"
                            : "border-km-border focus:border-km-link focus:ring-[#DCE8FB] dark:focus:ring-[#16294F]"
                    }`}
                />
            ))}
        </div>
    );
}
