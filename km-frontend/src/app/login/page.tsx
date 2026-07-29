"use client";

import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import OtpInput from "@/components/ui/OtpInput";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download } from "lucide-react";

// --- Types ---
interface FormCardProps {
    step: "login" | "otp";
    mobile: string;
    otp: string[];
    loading: boolean;
    error: string | null;
    onMobileChange: (val: string) => void;
    onOtpChange: (val: string[]) => void;
    onSendOtp: (e: React.FormEvent) => void;
    onVerifyOtp: () => void;
    onChangeNumber: () => void;
    onGoRecruiter: () => void;
}

// ─── FormCard is a TOP-LEVEL component (not nested inside LoginPage) ───────────
// Defining it inside LoginPage would cause remount on every keystroke (losing focus).
const FormCard = ({
    step, mobile, otp, loading, error,
    onMobileChange, onOtpChange,
    onSendOtp, onVerifyOtp, onChangeNumber, onGoRecruiter,
}: FormCardProps) => (
    <div className="w-full md:w-[450px] bg-white rounded-[28px] md:rounded-[32px] p-6 sm:p-8 md:p-10 shadow-xl shadow-purple-100/50 z-10">
        <AnimatePresence mode="wait">
            {step === "login" ? (
                <motion.div
                    key="phone-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                >
                    {error && (
                        <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">{error}</div>
                    )}
                    <h2 className="text-xl sm:text-2xl font-black text-gray-800">Enter Your Number To Continue</h2>
                    <form onSubmit={onSendOtp} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Mobile Number
                            </label>
                            <input
                                type="tel"
                                inputMode="numeric"
                                placeholder="Enter Mobile Number To Get OTP"
                                value={mobile}
                                onChange={(e) => onMobileChange(e.target.value.replace(/\D/g, ""))}
                                className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-purple-200 transition-all text-sm"
                                maxLength={10}
                                required
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={mobile.length < 10 || loading}
                            className={`w-full py-4 rounded-full font-bold transition-all shadow-lg text-sm ${mobile.length >= 10 && !loading
                                    ? "bg-purple-500 text-white hover:bg-purple-600 shadow-purple-200"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                                }`}
                        >
                            {loading ? "Sending OTP…" : "Get OTP"}
                        </button>
                        <div className="text-center pt-1">
                            <p className="text-sm font-bold text-gray-400 mb-2">Are You Hiring?</p>
                            <button
                                type="button"
                                onClick={onGoRecruiter}
                                className="w-full py-3 border-2 border-purple-500 text-purple-500 rounded-full font-bold hover:bg-purple-50 transition-all text-sm"
                            >
                                Hire Staff
                            </button>
                        </div>
                    </form>
                </motion.div>
            ) : (
                <motion.div
                    key="otp-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                >
                    {error && (
                        <div className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl">{error}</div>
                    )}
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-gray-800">Please Enter OTP</h2>
                        <p className="text-xs font-bold text-gray-400 mt-1">
                            OTP sent to {mobile.replace(/(\d{5})(\d{5})/, "$1*****")}
                        </p>
                    </div>

                    {/* type="tel" + inputMode="numeric" → number keyboard on mobile */}
                    <OtpInput value={otp} onChange={onOtpChange} />

                    <div className="flex items-center justify-between">
                        <button type="button" className="text-xs font-bold text-purple-600 hover:underline">
                            Resend OTP
                        </button>
                        <button
                            type="button"
                            onClick={onChangeNumber}
                            className="text-xs font-bold text-gray-400 hover:text-purple-600 transition-colors"
                        >
                            Change Number
                        </button>
                    </div>

                    <button
                        onClick={onVerifyOtp}
                        disabled={otp.join("").length < 4 || loading}
                        className={`w-full py-4 rounded-full font-bold transition-all shadow-lg text-sm ${otp.join("").length === 4 && !loading
                                ? "bg-purple-500 text-white hover:bg-purple-600 shadow-purple-200"
                                : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                            }`}
                    >
                        {loading ? "Verifying…" : "Verify OTP"}
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    </div>
);

// ─── Main page ─────────────────────────────────────────────────────────────────
export default function LoginPage() {
    const router = useRouter();
    const [step, setStep] = useState<"login" | "otp">("login");
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleOtpChange = (newOtp: string[]) => {
        setError(null);
        setOtp(newOtp);
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (mobile.length !== 10) { setError("Please enter a valid 10-digit mobile number"); return; }
        setError(null);
        setLoading(true);
        try {
            await api.post("/auth/otp/send", { mobile, role: "user" });
            setStep("otp");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        const otpString = otp.join("");
        if (otpString.length !== 4) { setError("Please enter the complete 4-digit OTP"); return; }
        setError(null);
        setLoading(true);
        try {
            const data: any = await api.post("/auth/otp/verify", { mobile, code: otpString, role: "user" });
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            router.push(data.is_registered ? "/" : "/register");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleChangeNumber = () => {
        setStep("login");
        setOtp(["", "", "", ""]);
        setError(null);
    };

    const sharedProps: FormCardProps = {
        step, mobile, otp, loading, error,
        onMobileChange: setMobile,
        onOtpChange: handleOtpChange,
        onSendOtp: handleSendOtp,
        onVerifyOtp: handleVerifyOtp,
        onChangeNumber: handleChangeNumber,
        onGoRecruiter: () => router.push("/recruiter/login"),
    };

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col">

            {/* Header */}
            <header className="flex justify-between items-center px-4 sm:px-6 md:px-12 py-3 md:py-4 border-b border-gray-100 md:border-none shrink-0">
                <div className="flex items-center gap-2">
                    <Image
                        src="/asset/icons/header_logo.png"
                        alt="Kaam Milega"
                        width={110}
                        height={45}
                        priority
                        className="object-contain"
                    />
                </div>
                <div className="flex items-center gap-3 sm:gap-6 text-sm font-semibold text-gray-600">
                    <button className="hidden sm:flex items-center gap-1 hover:text-purple-800 transition-colors">
                        <Download size={16} /> Download App
                    </button>
                    <button className="flex items-center gap-1 hover:text-purple-800 transition-colors text-xs sm:text-sm">
                        English <ChevronDown size={14} />
                    </button>
                </div>
            </header>

            {/* ── Mobile layout: form fills screen ── */}
            <div className="flex md:hidden flex-1 flex-col bg-[#fdf4ff] px-4 pt-8 pb-10">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-black leading-tight text-gray-800">
                        <span className="text-purple-500">Call</span> Or{" "}
                        <span className="text-purple-500">Talk</span> To HR &amp; Get A Job!
                    </h1>
                    <p className="text-sm font-bold text-gray-500 mt-1">Get Local Jobs In Your City! 👉</p>
                </div>
                <FormCard {...sharedProps} />
                <p className="text-center mt-8 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                    I Agree To{" "}
                    <span className="text-gray-600 underline cursor-pointer">Terms &amp; Conditions</span>{" "}
                    &amp;{" "}
                    <span className="text-gray-600 underline cursor-pointer">Privacy Policy</span>{" "}
                    Of Kaam Milega
                </p>
            </div>

            {/* ── Desktop layout: split card ── */}
            <main className="hidden md:flex flex-1 flex-col">
                <div className="max-w-6xl mx-auto w-full mt-10 px-6 pb-12">
                    <div className="bg-[#fdf4ff] rounded-[40px] p-10 lg:p-16 flex flex-row items-center justify-between gap-12 min-h-[500px] relative overflow-hidden">
                        <div className="flex-1 space-y-6 z-10">
                            <h1 className="text-4xl lg:text-5xl font-black leading-tight text-gray-800">
                                <span className="text-purple-500">Call</span> Or{" "}
                                <span className="text-purple-500">Talk</span> To HR Directly &amp; Get A Job With Better Salary!
                            </h1>
                            <p className="text-lg font-bold text-gray-500">Get Local Jobs In Your City! 👉</p>
                        </div>
                        <FormCard {...sharedProps} />
                    </div>
                    <p className="text-center mt-10 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                        I Agree To{" "}
                        <span className="text-gray-600 underline cursor-pointer">Terms &amp; Conditions</span>{" "}
                        &amp;{" "}
                        <span className="text-gray-600 underline cursor-pointer">Privacy Policy</span>{" "}
                        Of Kaam Milega
                    </p>
                </div>
            </main>
        </div>
    );
}