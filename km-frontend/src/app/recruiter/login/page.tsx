"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, ArrowLeft } from "lucide-react";
import api from "@/lib/axios";
// import api from "@/lib/axios"; // Your custom axios instance

export default function KaamMilegaAuth() {
    const router = useRouter();
    const [step, setStep] = useState<"login" | "otp">("login");
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
    const mobileInputRef = useRef<HTMLInputElement>(null);

    // Focus the first empty OTP input or the first one when step changes to otp
    useEffect(() => {
        if (step === 'otp') {
            const firstEmpty = otp.findIndex(val => val === "");
            const indexToFocus = firstEmpty === -1 ? 0 : firstEmpty;
            inputRefs.current[indexToFocus]?.focus();
        }
    }, [step]);


    // --- LOGIC HANDLERS (Based on your requirements) ---

    const handleOtpChange = (value: string, index: number) => {
        if (!/^\d*$/.test(value)) return;
        const newOtp = [...otp];
        newOtp[index] = value.slice(-1);
        setOtp(newOtp);

        if (value && index < 3) {
            inputRefs.current[index + 1]?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, index: number) => {
        if (e.key === "Backspace" && !otp[index] && index > 0) {
            inputRefs.current[index - 1]?.focus();
        }
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (mobile.length !== 10) {
            setError("Please enter a valid 10-digit mobile number");
            return;
        }
        setError(null);
        setLoading(true);

        try {
            await api.post("/auth/otp/send", { mobile, role: "recruiter" });
            setStep("otp");
        } catch (err: any) {
            setError(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    };


    const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pastedData = e.clipboardData.getData("text").slice(0, 4);

        if (!/^\d+$/.test(pastedData)) return;

        const newOtp = [...otp];
        pastedData.split("").forEach((char, i) => {
            if (i < 4) newOtp[i] = char;
        });
        setOtp(newOtp);

        // Focus the input after the last pasted character
        const nextIndex = Math.min(pastedData.length, 3);
        const nextInput = document.getElementById(`otp-${nextIndex}`);
        nextInput?.focus();

        // If filled completely, focus the verify button or just the last input
        if (pastedData.length === 4) {
            document.getElementById(`otp-3`)?.focus();
        }
    };

    const handleVerifyOtp = async () => {
        const otpString = otp.join("");
        if (otpString.length !== 4) {
            setError("Please enter the complete 4-digit OTP");
            return;
        }
        setError(null);
        setLoading(true);

        try {
            const data: any = await api.post("/auth/otp/verify", { mobile, code: otpString, role: "recruiter" });

            // Success
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            if (!data.is_registered) {
                router.push("/recruiter/register");
            } else {
                router.push("/recruiter"); // Redirect to Recruiter Dashboard
            }
        } catch (err: any) {
            setError(err.message || "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900">
            {/* Navbar */}
            <header className="flex justify-between items-center px-4 md:px-12 py-4 md:py-6 max-w-7xl mx-auto">
                <Image src="/asset/icons/header_logo.png" alt="Kaam Milega" width={120} height={35} priority className="md:w-[140px] md:h-[40px]" />
                <div className="flex items-center gap-3 md:gap-6 text-[10px] md:text-sm font-bold text-gray-600">
                    <button className="flex items-center gap-1.5 hover:text-purple-600 transition-colors">
                        <Download size={16} className="md:w-[18px]" /> <span className="hidden xs:inline">Download</span> App
                    </button>
                    <button className="flex items-center gap-1 hover:text-purple-600 transition-colors">
                        English <ChevronDown size={14} className="md:w-[16px]" />
                    </button>
                </div>
            </header>

            {/* Main Hero Container */}
            <main className="max-w-7xl mx-auto px-4 md:px-6 mt-4 md:mt-12">
                <div className="bg-[#F9F7FF] rounded-[24px] md:rounded-[40px] p-6 md:p-16 flex flex-col lg:flex-row items-center justify-between gap-8 md:gap-12 min-h-0 lg:min-h-[550px] border border-purple-50 shadow-sm">

                    {/* Left Hero Content */}
                    <div className="flex-1 space-y-4 md:space-y-6 text-center lg:text-left pt-4 lg:pt-0">
                        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black leading-tight text-gray-900">
                            <span className="text-[#8B7DFF]">Hire</span> Local Staff Now!
                        </h1>
                        <p className="text-lg md:text-xl font-bold text-gray-500 flex items-center justify-center lg:justify-start gap-2">
                            Get Started From Here 👉
                        </p>
                    </div>

                    {/* Right Side: Auth Card */}
                    <div className="w-full max-w-md bg-white rounded-[24px] md:rounded-[32px] p-6 md:p-10 shadow-2xl shadow-purple-200/40 relative overflow-hidden min-h-0 md:min-h-[400px]">
                        <AnimatePresence mode="wait">
                            {step === 'login' ? (
                                <motion.div
                                    key="login"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-8"
                                >
                                    <h2 className="text-2xl font-black text-gray-900">Enter Your Number To Continue</h2>
                                    {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded-lg">{error}</p>}

                                    <form onSubmit={handleSendOtp} className="space-y-6">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-gray-400 uppercase">Mobile Number</label>
                                            <input
                                                type="tel"
                                                placeholder="Enter Mobile Number"
                                                value={mobile}
                                                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                autoFocus
                                                inputMode="numeric"
                                                ref={mobileInputRef}
                                                className="w-full px-6 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-2 focus:ring-purple-200 transition-all font-bold"
                                                required
                                            />
                                        </div>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <button
                                                type="submit"
                                                disabled={loading}
                                                className="flex-1 bg-[#8B7DFF] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#7a6ceb] transition-all shadow-lg shadow-purple-100"
                                            >
                                                I Want Staff
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => router.push("/login")}
                                                className="flex-1 bg-[#A685B6] text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-[#9674a5] transition-all"
                                            >
                                                I Want A Job
                                            </button>
                                        </div>
                                    </form>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="otp"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-8"
                                >
                                    <div className="space-y-2">
                                        <h2 className="text-2xl font-black text-gray-900">Please Enter OTP</h2>
                                        <p className="text-xs font-bold text-gray-400">Sent to {mobile.replace(/(\d{5})(\d{5})/, '$1*****')}</p>
                                        {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded-lg">{error}</p>}
                                    </div>

                                    <div className="space-y-6">
                                        <div className="flex gap-3 md:gap-4">
                                            {[0, 1, 2, 3].map((i) => (
                                                <input
                                                    key={i}
                                                    value={otp[i]}
                                                    id={`otp-${i}`}
                                                    ref={(el) => { inputRefs.current[i] = el }}
                                                    type="tel"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    maxLength={1}
                                                    onChange={(e) => handleOtpChange(e.target.value, i)}
                                                    onKeyDown={(e) => handleKeyDown(e, i)}
                                                    onPaste={handlePaste}
                                                    className="w-full h-14 md:h-16 bg-gray-50 border border-gray-200 rounded-xl md:rounded-2xl text-center font-black text-xl md:text-2xl focus:ring-2 focus:ring-purple-200 transition-all"
                                                />
                                            ))}
                                        </div>
                                        <button className="text-[10px] font-black text-[#8B7DFF] uppercase hover:underline">Resend OTP</button>
                                        <div className="flex justify-between items-center pt-4">
                                            <button onClick={() => setStep('login')} className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600">
                                                <ArrowLeft size={14} /> Back
                                            </button>
                                            <button
                                                onClick={handleVerifyOtp}
                                                disabled={otp.join("").length < 4 || loading}
                                                className={`px-8 py-3 rounded-full font-black text-xs uppercase transition-all ${otp.join("").length === 4 ? 'bg-[#8B7DFF] text-white shadow-xl' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                            >
                                                {loading ? "Verifying..." : "Get Started Now"}
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Footer Links */}
                <p className="text-center mt-8 md:mt-16 text-[9px] md:text-[10px] font-bold text-gray-400 uppercase tracking-widest px-4">
                    I Agree To <span className="text-gray-600 underline cursor-pointer">Terms & Conditions</span> & <span className="text-gray-600 underline cursor-pointer">Privacy Policy</span> Of Kaam Milega
                </p>
            </main>
        </div>
    );
}