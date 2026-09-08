"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, ArrowLeft, Phone, Lock, Eye, EyeOff } from "lucide-react";
import api from "@/lib/axios";

export default function KaamMilegaAuth() {
    const router = useRouter();
    const [authMode, setAuthMode] = useState<"otp" | "password">("otp");
    const [passwordMode, setPasswordMode] = useState<"signin" | "signup">("signin");
    const [step, setStep] = useState<"login" | "otp">("login");
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [signupMobile, setSignupMobile] = useState("");
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

        const nextIndex = Math.min(pastedData.length, 3);
        const nextInput = document.getElementById(`otp-${nextIndex}`);
        nextInput?.focus();

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

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            if (!data.is_registered) {
                router.push("/recruiter/register");
            } else {
                router.push("/recruiter");
            }
        } catch (err: any) {
            setError(err.message || "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanIdentifier = identifier.trim();
        const cleanPassword = password.trim();
        if (!cleanIdentifier || !cleanPassword) {
            setError("Please enter your company email/mobile and password");
            return;
        }
        setError(null);
        setLoading(true);

        try {
            const data: any = await api.post("/auth/login/password", {
                identifier: cleanIdentifier,
                password: cleanPassword,
                role: "recruiter",
            });

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            if (!data.is_registered) {
                router.push("/recruiter/register");
            } else {
                router.push("/recruiter");
            }
        } catch (err: any) {
            setError(err.message || "Invalid credentials");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPassword = password.trim();
        const cleanMobile = signupMobile.replace(/\D/g, "").slice(0, 10);

        if (!cleanName) {
            setError("Please enter the contact person's name");
            return;
        }
        if (!cleanEmail) {
            setError("Please enter company email address");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setError("Please enter a valid company email address");
            return;
        }
        if (cleanMobile && cleanMobile.length !== 10) {
            setError("Mobile number must be exactly 10 digits");
            return;
        }
        if (cleanPassword.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }
        setError(null);
        setLoading(true);

        try {
            const data: any = await api.post("/auth/register/password", {
                name: cleanName,
                email: cleanEmail,
                mobile: cleanMobile,
                password: cleanPassword,
                role: "recruiter",
            });

            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));

            router.push("/recruiter/register");
        } catch (err: any) {
            setError(err.message || "Failed to register recruiter account");
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
            <main className="max-w-7xl mx-auto px-4 md:px-6 mt-4 md:mt-12 pb-12">
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
                        {/* Auth Mode Switcher Tab */}
                        <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
                            <button
                                type="button"
                                onClick={() => { setError(null); setAuthMode("otp"); }}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                                    authMode === "otp"
                                        ? "bg-white text-purple-600 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                <Phone size={16} /> Login with OTP
                            </button>
                            <button
                                type="button"
                                onClick={() => { setError(null); setAuthMode("password"); }}
                                className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                                    authMode === "password"
                                        ? "bg-white text-purple-600 shadow-sm"
                                        : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                <Lock size={16} /> Login with Password
                            </button>
                        </div>

                        <AnimatePresence mode="wait">
                            {authMode === 'otp' ? (
                                step === 'login' ? (
                                    <motion.div
                                        key="login"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="space-y-6"
                                    >
                                        <h2 className="text-2xl font-black text-gray-900">Enter Your Number To Continue</h2>
                                        {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-2.5 rounded-xl">{error}</p>}

                                        <form onSubmit={handleSendOtp} className="space-y-5">
                                            <div className="space-y-2">
                                                <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Mobile Number *</label>
                                                <input
                                                    type="tel"
                                                    placeholder="Enter Mobile Number"
                                                    value={mobile}
                                                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                                                    autoFocus
                                                    inputMode="numeric"
                                                    ref={mobileInputRef}
                                                    className="w-full px-5 py-4 bg-white border border-slate-300 text-slate-900 font-extrabold rounded-2xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all placeholder:text-slate-400 text-sm"
                                                    required
                                                />
                                            </div>
                                            <div className="flex flex-col sm:flex-row gap-3">
                                                <button
                                                    type="submit"
                                                    disabled={loading || mobile.length < 10}
                                                    className={`flex-1 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
                                                        mobile.length === 10 && !loading
                                                            ? "bg-[#8B7DFF] hover:bg-[#7a6ceb] shadow-purple-100"
                                                            : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                                                    }`}
                                                >
                                                    {loading ? "Sending..." : "Get OTP"}
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
                                        className="space-y-6"
                                    >
                                        <div className="space-y-1">
                                            <h2 className="text-2xl font-black text-gray-900">Please Enter OTP</h2>
                                            <p className="text-xs font-bold text-gray-500">Sent to {mobile.replace(/(\d{5})(\d{5})/, '$1*****')}</p>
                                            {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-2 rounded-lg mt-2">{error}</p>}
                                        </div>

                                        <div className="space-y-5">
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
                                                        className="w-full h-14 md:h-16 bg-white border border-slate-300 text-slate-900 text-center font-black text-xl md:text-2xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all shadow-sm rounded-xl"
                                                    />
                                                ))}
                                            </div>
                                            <button onClick={handleSendOtp} type="button" className="text-[10px] font-black text-[#8B7DFF] uppercase hover:underline">Resend OTP</button>
                                            <div className="flex justify-between items-center pt-2">
                                                <button onClick={() => setStep('login')} className="flex items-center gap-1 text-xs font-bold text-gray-400 hover:text-gray-600">
                                                    <ArrowLeft size={14} /> Back
                                                </button>
                                                <button
                                                    onClick={handleVerifyOtp}
                                                    disabled={otp.join("").length < 4 || loading}
                                                    className={`px-8 py-3.5 rounded-full font-black text-xs uppercase transition-all ${otp.join("").length === 4 && !loading ? 'bg-[#8B7DFF] text-white shadow-xl hover:bg-[#7a6ceb]' : 'bg-gray-200 text-gray-400 cursor-not-allowed'}`}
                                                >
                                                    {loading ? "Verifying..." : "Sign In"}
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )
                            ) : passwordMode === "signin" ? (
                                <motion.div
                                    key="recruiter-password-signin"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-5"
                                >
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900">Sign In With Password</h2>
                                        <p className="text-xs font-medium text-gray-400 mt-1">Sign in to manage job posts and candidates</p>
                                    </div>
                                    {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-2.5 rounded-xl">{error}</p>}

                                    <form onSubmit={handlePasswordLogin} className="space-y-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Company Email or Mobile *</label>
                                            <input
                                                type="text"
                                                placeholder="company@example.com or mobile"
                                                value={identifier}
                                                onChange={(e) => { setError(null); setIdentifier(e.target.value); }}
                                                className="w-full px-5 py-4 bg-white border border-slate-300 text-slate-900 font-medium rounded-2xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all text-sm"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Password *</label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Enter your password"
                                                    value={password}
                                                    onChange={(e) => { setError(null); setPassword(e.target.value); }}
                                                    className="w-full px-5 py-4 pr-12 bg-white border border-slate-300 text-slate-900 font-medium rounded-2xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all text-sm"
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={!identifier || !password || loading}
                                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg ${
                                                identifier && password && !loading
                                                    ? "bg-[#8B7DFF] text-white hover:bg-[#7a6ceb] shadow-purple-100"
                                                    : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                                            }`}
                                        >
                                            {loading ? "Signing In..." : "Sign In As Recruiter"}
                                        </button>

                                        <div className="text-center pt-2 space-y-2">
                                            <p className="text-xs text-gray-500">
                                                New to KaamMilega?{" "}
                                                <button
                                                    type="button"
                                                    onClick={() => { setError(null); setPasswordMode("signup"); }}
                                                    className="text-purple-600 font-black hover:underline"
                                                >
                                                    Register Company / Hire Staff
                                                </button>
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                Looking for a job?{" "}
                                                <button
                                                    type="button"
                                                    onClick={() => router.push("/login")}
                                                    className="text-purple-600 font-bold hover:underline"
                                                >
                                                    Candidate Login
                                                </button>
                                            </p>
                                        </div>
                                    </form>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="recruiter-password-signup"
                                    initial={{ opacity: 0, x: 20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className="space-y-4"
                                >
                                    <div>
                                        <h2 className="text-2xl font-black text-gray-900">Register Company Account</h2>
                                        <p className="text-xs font-medium text-gray-400 mt-1">Hire verified staff for your business</p>
                                    </div>
                                    {error && <p className="text-red-500 text-xs font-bold bg-red-50 p-2.5 rounded-xl">{error}</p>}

                                    <form onSubmit={handlePasswordRegister} className="space-y-3.5">
                                        <div className="space-y-1">
                                            <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Contact Person Name *</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. John Doe / HR Manager"
                                                value={name}
                                                onChange={(e) => { setError(null); setName(e.target.value); }}
                                                className="w-full px-5 py-3.5 bg-white border border-slate-300 text-slate-900 font-medium rounded-2xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all text-sm"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Company Email Address *</label>
                                            <input
                                                type="email"
                                                placeholder="hr@company.com"
                                                value={email}
                                                onChange={(e) => { setError(null); setEmail(e.target.value); }}
                                                className="w-full px-5 py-3.5 bg-white border border-slate-300 text-slate-900 font-medium rounded-2xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all text-sm"
                                                required
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Mobile Number (10 Digits)</label>
                                            <input
                                                type="tel"
                                                inputMode="numeric"
                                                placeholder="e.g. 9876543210"
                                                value={signupMobile}
                                                onChange={(e) => { setError(null); setSignupMobile(e.target.value.replace(/\D/g, "").slice(0, 10)); }}
                                                className="w-full px-5 py-3.5 bg-white border border-slate-300 text-slate-900 font-medium rounded-2xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all text-sm"
                                            />
                                        </div>

                                        <div className="space-y-1">
                                            <label className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">Set Password * (Min. 6 chars)</label>
                                            <div className="relative">
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    placeholder="Create strong password"
                                                    value={password}
                                                    onChange={(e) => { setError(null); setPassword(e.target.value); }}
                                                    className="w-full px-5 py-3.5 pr-12 bg-white border border-slate-300 text-slate-900 font-medium rounded-2xl focus:ring-2 focus:ring-purple-200 focus:border-purple-600 transition-all text-sm"
                                                    minLength={6}
                                                    required
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => setShowPassword(!showPassword)}
                                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                                >
                                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                                </button>
                                            </div>
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={!name.trim() || !email.trim() || password.length < 6 || loading}
                                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg mt-2 ${
                                                name.trim() && email.trim() && password.length >= 6 && !loading
                                                    ? "bg-[#8B7DFF] text-white hover:bg-[#7a6ceb] shadow-purple-100"
                                                    : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                                            }`}
                                        >
                                            {loading ? "Creating Account..." : "Create Account & Continue"}
                                        </button>

                                        <div className="text-center pt-2">
                                            <p className="text-xs text-gray-500">
                                                Already have a recruiter account?{" "}
                                                <button
                                                    type="button"
                                                    onClick={() => { setError(null); setPasswordMode("signin"); }}
                                                    className="text-purple-600 font-black hover:underline"
                                                >
                                                    Sign In
                                                </button>
                                            </p>
                                        </div>
                                    </form>
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