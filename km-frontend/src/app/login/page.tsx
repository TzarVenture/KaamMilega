"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import BrandLogo from "@/components/km/BrandLogo";
import DownloadAppModal from "@/components/km/DownloadAppModal";
import api from "@/lib/axios";
import OtpInput from "@/components/ui/OtpInput";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, Download, Phone, Lock, Eye, EyeOff, User, Mail } from "lucide-react";

// --- Types ---
interface FormCardProps {
    authMode: "otp" | "password";
    onAuthModeChange: (mode: "otp" | "password") => void;
    passwordMode: "signin" | "signup" | "forgot";
    onPasswordModeChange: (mode: "signin" | "signup" | "forgot") => void;
    forgotStep: "request" | "reset";
    step: "login" | "otp";
    mobile: string;
    otp: string[];
    identifier: string;
    password: string;
    showPassword: boolean;
    name: string;
    email: string;
    forgotCode: string;
    forgotNewPassword: string;
    loading: boolean;
    error: string | null;
    successMessage: string | null;
    onMobileChange: (val: string) => void;
    onOtpChange: (val: string[]) => void;
    onIdentifierChange: (val: string) => void;
    onPasswordChange: (val: string) => void;
    onToggleShowPassword: () => void;
    onNameChange: (val: string) => void;
    onEmailChange: (val: string) => void;
    onForgotCodeChange: (val: string) => void;
    onForgotNewPasswordChange: (val: string) => void;
    onSendOtp: (e: React.FormEvent) => void;
    onVerifyOtp: () => void;
    onPasswordLogin: (e: React.FormEvent) => void;
    onPasswordRegister: (e: React.FormEvent) => void;
    onSendForgotCode: (e: React.FormEvent) => void;
    onResetPassword: (e: React.FormEvent) => void;
    onChangeNumber: () => void;
    onGoRecruiter: () => void;
}

// ─── FormCard Top-Level Component ───────────────────────────────────────────
const FormCard = ({
    authMode, onAuthModeChange,
    passwordMode, onPasswordModeChange,
    forgotStep, step, mobile, otp,
    identifier, password, showPassword,
    name, email, forgotCode, forgotNewPassword,
    loading, error, successMessage,
    onMobileChange, onOtpChange,
    onIdentifierChange, onPasswordChange, onToggleShowPassword,
    onNameChange, onEmailChange,
    onForgotCodeChange, onForgotNewPasswordChange,
    onSendOtp, onVerifyOtp, onPasswordLogin, onPasswordRegister,
    onSendForgotCode, onResetPassword,
    onChangeNumber, onGoRecruiter,
}: FormCardProps) => (
    <div className="w-full md:w-112.5 bg-white rounded-[28px] md:rounded-4xl p-6 sm:p-8 md:p-10 shadow-xl shadow-slate-200/50 border border-slate-100 z-10">
        {/* Auth Mode Switcher Tab */}
        <div className="flex bg-gray-100 p-1 rounded-2xl mb-6">
            <button
                type="button"
                onClick={() => onAuthModeChange("otp")}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                    authMode === "otp"
                        ? "bg-white text-km-primary shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                <Phone size={16} /> Login with OTP
            </button>
            <button
                type="button"
                onClick={() => onAuthModeChange("password")}
                className={`flex-1 py-2.5 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all ${
                    authMode === "password"
                        ? "bg-white text-km-primary shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                }`}
            >
                <Lock size={16} /> Login with Password
            </button>
        </div>

        {error && (
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-500 text-sm font-medium bg-red-50 p-3 rounded-xl mb-4"
            >
                {error}
            </motion.div>
        )}

        {successMessage && (
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-emerald-700 text-sm font-medium bg-emerald-50 border border-emerald-200 p-3 rounded-xl mb-4"
            >
                {successMessage}
            </motion.div>
        )}

        <AnimatePresence mode="wait">
            {authMode === "otp" ? (
                step === "login" ? (
                    <motion.div
                        key="phone-step"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-5"
                    >
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
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all text-sm"
                                    maxLength={10}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={mobile.length < 10 || loading}
                                className={`w-full py-4 rounded-full font-bold transition-all shadow-lg text-sm ${
                                    mobile.length >= 10 && !loading
                                        ? "bg-km-primary text-white hover:bg-km-primary-dark shadow-blue-900/20"
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
                                    className="w-full py-3 border-2 border-km-primary text-km-primary rounded-full font-bold hover:bg-blue-50 transition-all text-sm"
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
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-800">Please Enter OTP</h2>
                            <p className="text-xs font-bold text-gray-400 mt-1">
                                OTP sent to {mobile.replace(/(\d{5})(\d{5})/, "$1*****")}
                            </p>
                        </div>

                        <OtpInput value={otp} onChange={onOtpChange} />

                        <div className="flex items-center justify-between">
                            <button type="button" onClick={onSendOtp} className="text-xs font-bold text-km-primary hover:underline">
                                Resend OTP
                            </button>
                            <button
                                type="button"
                                onClick={onChangeNumber}
                                className="text-xs font-bold text-gray-400 hover:text-km-primary transition-colors"
                            >
                                Change Number
                            </button>
                        </div>

                        <button
                            onClick={onVerifyOtp}
                            disabled={otp.join("").length < 4 || loading}
                            className={`w-full py-4 rounded-full font-bold transition-all shadow-lg text-sm ${
                                otp.join("").length === 4 && !loading
                                    ? "bg-km-primary text-white hover:bg-km-primary-dark shadow-blue-900/20"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                            }`}
                        >
                            {loading ? "Verifying…" : "Verify OTP"}
                        </button>
                    </motion.div>
                )
            ) : passwordMode === "signin" ? (
                <motion.div
                    key="password-signin-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-5"
                >
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-gray-800">Sign In With Password</h2>
                        <p className="text-xs text-gray-400 mt-1">Welcome back! Sign in to access your jobs</p>
                    </div>

                    <form onSubmit={onPasswordLogin} className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Email Address
                            </label>
                            <div className="relative">
                                <input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={identifier}
                                    onChange={(e) => onIdentifierChange(e.target.value)}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all text-sm"
                                    required
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Password
                                </label>
                                <button
                                    type="button"
                                    onClick={() => onPasswordModeChange("forgot")}
                                    className="text-xs font-bold text-km-primary hover:underline"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => onPasswordChange(e.target.value)}
                                    className="w-full px-5 py-4 pr-12 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all text-sm"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShowPassword}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!identifier || !password || loading}
                            className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg text-sm ${
                                identifier && password && !loading
                                    ? "bg-km-primary text-white hover:bg-km-primary-dark shadow-blue-900/20"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                            }`}
                        >
                            {loading ? "Signing In…" : "Sign In"}
                        </button>

                        <div className="text-center pt-2 space-y-1.5">
                            <p className="text-xs text-gray-500">
                                Don't have an account yet?{" "}
                                <button
                                    type="button"
                                    onClick={() => onPasswordModeChange("signup")}
                                    className="text-km-primary font-black hover:underline"
                                >
                                    Create Account
                                </button>
                            </p>
                            <p className="text-xs text-gray-400">
                                Or{" "}
                                <button
                                    type="button"
                                    onClick={() => onAuthModeChange("otp")}
                                    className="text-km-primary font-bold hover:underline"
                                >
                                    Login with OTP
                                </button>
                            </p>
                            <div className="pt-2">
                                <p className="text-xs font-bold text-gray-400 mb-1.5">Are You Hiring?</p>
                                <button
                                    type="button"
                                    onClick={onGoRecruiter}
                                    className="w-full py-3 border-2 border-km-primary text-km-primary rounded-xl font-bold hover:bg-blue-50 transition-all text-xs"
                                >
                                    Hire Staff
                                </button>
                            </div>
                        </div>
                    </form>
                </motion.div>
            ) : passwordMode === "signup" ? (
                <motion.div
                    key="password-signup-step"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                >
                    <div>
                        <h2 className="text-xl sm:text-2xl font-black text-gray-800">Create New Account</h2>
                        <p className="text-xs text-gray-400 mt-1">Quick 10-second registration to start getting jobs</p>
                    </div>

                    <form onSubmit={onPasswordRegister} className="space-y-3.5">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Full Name *
                            </label>
                            <input
                                type="text"
                                placeholder="Enter your full name"
                                value={name}
                                onChange={(e) => onNameChange(e.target.value)}
                                className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all text-sm"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Email Address *
                            </label>
                            <input
                                type="email"
                                placeholder="name@example.com"
                                value={email}
                                onChange={(e) => onEmailChange(e.target.value)}
                                className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all text-sm"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                Set Password * (Min. 6 characters)
                            </label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Create a strong password"
                                    value={password}
                                    onChange={(e) => onPasswordChange(e.target.value)}
                                    className="w-full px-5 py-3.5 pr-12 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all text-sm"
                                    minLength={6}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={onToggleShowPassword}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={!name.trim() || !email.trim() || password.length < 6 || loading}
                            className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg text-sm mt-2 ${
                                name.trim() && email.trim() && password.length >= 6 && !loading
                                    ? "bg-km-primary text-white hover:bg-km-primary-dark shadow-blue-900/20"
                                    : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                            }`}
                        >
                            {loading ? "Creating Account…" : "Create Account & Continue"}
                        </button>

                        <div className="text-center pt-2">
                            <p className="text-xs text-gray-500">
                                Already have an account?{" "}
                                <button
                                    type="button"
                                    onClick={() => onPasswordModeChange("signin")}
                                    className="text-km-primary font-black hover:underline"
                                >
                                    Sign In
                                </button>
                            </p>
                        </div>
                    </form>
                </motion.div>
            ) : (
                forgotStep === "request" ? (
                    <motion.div
                        key="password-forgot-request-step"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-5"
                    >
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-800">Reset Password</h2>
                            <p className="text-xs text-gray-400 mt-1">Enter your registered email to receive a 4-digit reset code</p>
                        </div>

                        <form onSubmit={onSendForgotCode} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    placeholder="name@example.com"
                                    value={identifier}
                                    onChange={(e) => onIdentifierChange(e.target.value)}
                                    className="w-full px-5 py-4 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all text-sm"
                                    required
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={!identifier || loading}
                                className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg text-sm ${
                                    identifier && !loading
                                        ? "bg-km-primary text-white hover:bg-km-primary-dark shadow-blue-900/20"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                                }`}
                            >
                                {loading ? "Sending Reset Code…" : "Send Reset Code"}
                            </button>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => onPasswordModeChange("signin")}
                                    className="text-xs font-bold text-gray-400 hover:text-km-primary transition-colors"
                                >
                                    ← Back to Sign In
                                </button>
                            </div>
                        </form>
                    </motion.div>
                ) : (
                    <motion.div
                        key="password-forgot-reset-step"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-5"
                    >
                        <div>
                            <h2 className="text-xl sm:text-2xl font-black text-gray-800">Set New Password</h2>
                            <p className="text-xs text-gray-400 mt-1">
                                Enter the 4-digit code sent to <span className="font-bold text-gray-700">{identifier}</span>
                            </p>
                        </div>

                        <form onSubmit={onResetPassword} className="space-y-4">
                            <div className="space-y-1.5">
                                <div className="flex justify-between items-center">
                                    <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        4-Digit Code
                                    </label>
                                    <button
                                        type="button"
                                        onClick={onSendForgotCode}
                                        className="text-xs font-bold text-km-primary hover:underline"
                                    >
                                        Resend Code
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={4}
                                    placeholder="Enter 4-digit code"
                                    value={forgotCode}
                                    onChange={(e) => onForgotCodeChange(e.target.value.replace(/\D/g, "").slice(0, 4))}
                                    className="w-full px-5 py-3.5 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all tracking-widest text-center font-black text-lg"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                    New Password * (Min. 6 characters)
                                </label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter your new password"
                                        value={forgotNewPassword}
                                        onChange={(e) => onForgotNewPasswordChange(e.target.value)}
                                        className="w-full px-5 py-3.5 pr-12 bg-white border border-gray-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all text-sm"
                                        minLength={6}
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={onToggleShowPassword}
                                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1"
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={forgotCode.length !== 4 || forgotNewPassword.length < 6 || loading}
                                className={`w-full py-4 rounded-xl font-bold transition-all shadow-lg text-sm mt-2 ${
                                    forgotCode.length === 4 && forgotNewPassword.length >= 6 && !loading
                                        ? "bg-km-primary text-white hover:bg-km-primary-dark shadow-blue-900/20"
                                        : "bg-gray-200 text-gray-400 cursor-not-allowed shadow-none"
                                }`}
                            >
                                {loading ? "Resetting Password…" : "Reset Password"}
                            </button>

                            <div className="text-center pt-2">
                                <button
                                    type="button"
                                    onClick={() => onPasswordModeChange("signin")}
                                    className="text-xs font-bold text-gray-400 hover:text-km-primary transition-colors"
                                >
                                    ← Back to Sign In
                                </button>
                            </div>
                        </form>
                    </motion.div>
                )
            )}
        </AnimatePresence>
    </div>
);

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function LoginPage() {
    const router = useRouter();
    const [authMode, setAuthMode] = useState<"otp" | "password">("otp");
    const [passwordMode, setPasswordMode] = useState<"signin" | "signup" | "forgot">("signin");
    const [forgotStep, setForgotStep] = useState<"request" | "reset">("request");
    const [step, setStep] = useState<"login" | "otp">("login");
    const [mobile, setMobile] = useState("");
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [identifier, setIdentifier] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [forgotCode, setForgotCode] = useState("");
    const [forgotNewPassword, setForgotNewPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    // Header modal & language switcher states
    const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [selectedLang, setSelectedLang] = useState("English");
    const langRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (langRef.current && !langRef.current.contains(event.target as Node)) {
                setIsLangOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleOtpChange = (newOtp: string[]) => {
        setError(null);
        setSuccessMessage(null);
        setOtp(newOtp);
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        if (mobile.length !== 10) {
            setError("Please enter a valid 10-digit mobile number");
            return;
        }
        setError(null);
        setSuccessMessage(null);
        setLoading(true);
        try {
            await api.post("/auth/otp/send", { mobile, role: "user" });
            setStep("otp");
        } catch (err: any) {
            setError(err.message || "Failed to send OTP");
        } finally {
            setLoading(false);
        }
    };

    const getRedirectUrl = (isRegistered: boolean) => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            const redirectParam = params.get("redirect");
            if (redirectParam && redirectParam.startsWith("/")) {
                return redirectParam;
            }
        }
        return isRegistered ? "/" : "/register";
    };

    const handleVerifyOtp = async () => {
        const otpString = otp.join("");
        if (otpString.length !== 4) {
            setError("Please enter the complete 4-digit OTP");
            return;
        }
        setError(null);
        setSuccessMessage(null);
        setLoading(true);
        try {
            const data: any = await api.post("/auth/otp/verify", { mobile, code: otpString, role: "user" });
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            router.push(getRedirectUrl(data.is_registered));
        } catch (err: any) {
            setError(err.message || "Invalid OTP");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanEmail = identifier.trim().toLowerCase();
        const cleanPassword = password.trim();
        if (!cleanEmail || !cleanPassword) {
            setError("Please enter your email and password");
            return;
        }
        setError(null);
        setSuccessMessage(null);
        setLoading(true);
        try {
            const data: any = await api.post("/auth/login/password", {
                email: cleanEmail,
                password: cleanPassword,
                role: "user",
            });
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            router.push(getRedirectUrl(data.is_registered));
        } catch (err: any) {
            setError(err.message || "Invalid email or password");
        } finally {
            setLoading(false);
        }
    };

    const handlePasswordRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanName = name.trim();
        const cleanEmail = email.trim().toLowerCase();
        const cleanPassword = password.trim();

        if (!cleanName) {
            setError("Please enter your full name");
            return;
        }
        if (!cleanEmail) {
            setError("Please enter your email address");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setError("Please enter a valid email address");
            return;
        }
        if (cleanPassword.length < 6) {
            setError("Password must be at least 6 characters long");
            return;
        }
        setError(null);
        setSuccessMessage(null);
        setLoading(true);
        try {
            const data: any = await api.post("/auth/register/password", {
                name: cleanName,
                email: cleanEmail,
                password: cleanPassword,
                role: "user",
            });
            localStorage.setItem("token", data.token);
            localStorage.setItem("user", JSON.stringify(data.user));
            // Direct to profile completion wizard
            router.push("/register");
        } catch (err: any) {
            setError(err.message || "Failed to create account. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleSendForgotCode = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanEmail = identifier.trim().toLowerCase();
        if (!cleanEmail) {
            setError("Please enter your email address");
            return;
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
            setError("Please enter a valid email address");
            return;
        }
        setError(null);
        setSuccessMessage(null);
        setLoading(true);
        try {
            await api.post("/auth/password/forgot", {
                email: cleanEmail,
                role: "user",
            });
            setForgotStep("reset");
            setSuccessMessage("A 4-digit reset code has been sent to your email.");
        } catch (err: any) {
            setError(err.message || "Failed to send reset code. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanEmail = identifier.trim().toLowerCase();
        const cleanCode = forgotCode.trim();
        const cleanPassword = forgotNewPassword.trim();

        if (!cleanEmail) {
            setError("Email is missing. Please start over.");
            return;
        }
        if (cleanCode.length !== 4) {
            setError("Please enter the complete 4-digit verification code");
            return;
        }
        if (cleanPassword.length < 6) {
            setError("New password must be at least 6 characters long");
            return;
        }

        setError(null);
        setSuccessMessage(null);
        setLoading(true);
        try {
            await api.post("/auth/password/reset", {
                email: cleanEmail,
                code: cleanCode,
                new_password: cleanPassword,
                role: "user",
            });
            setPasswordMode("signin");
            setForgotStep("request");
            setForgotCode("");
            setForgotNewPassword("");
            setPassword("");
            setSuccessMessage("Password reset successfully! Please sign in with your new password.");
        } catch (err: any) {
            setError(err.message || "Failed to reset password. Please check the code and try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleChangeNumber = () => {
        setStep("login");
        setOtp(["", "", "", ""]);
        setError(null);
        setSuccessMessage(null);
    };

    const sharedProps: FormCardProps = {
        authMode,
        onAuthModeChange: (mode) => {
            setError(null);
            setSuccessMessage(null);
            setAuthMode(mode);
        },
        passwordMode,
        onPasswordModeChange: (mode) => {
            setError(null);
            setSuccessMessage(null);
            setPasswordMode(mode);
            if (mode === "signin") {
                setForgotStep("request");
                setForgotCode("");
                setForgotNewPassword("");
            }
        },
        forgotStep,
        step,
        mobile,
        otp,
        identifier,
        password,
        showPassword,
        name,
        email,
        forgotCode,
        forgotNewPassword,
        loading,
        error,
        successMessage,
        onMobileChange: (val) => {
            setError(null);
            setSuccessMessage(null);
            setMobile(val);
        },
        onOtpChange: handleOtpChange,
        onIdentifierChange: (val) => {
            setError(null);
            setSuccessMessage(null);
            setIdentifier(val);
        },
        onPasswordChange: (val) => {
            setError(null);
            setSuccessMessage(null);
            setPassword(val);
        },
        onToggleShowPassword: () => setShowPassword(!showPassword),
        onNameChange: (val) => {
            setError(null);
            setSuccessMessage(null);
            setName(val);
        },
        onEmailChange: (val) => {
            setError(null);
            setSuccessMessage(null);
            setEmail(val);
        },
        onForgotCodeChange: (val) => {
            setError(null);
            setSuccessMessage(null);
            setForgotCode(val);
        },
        onForgotNewPasswordChange: (val) => {
            setError(null);
            setSuccessMessage(null);
            setForgotNewPassword(val);
        },
        onSendOtp: handleSendOtp,
        onVerifyOtp: handleVerifyOtp,
        onPasswordLogin: handlePasswordLogin,
        onPasswordRegister: handlePasswordRegister,
        onSendForgotCode: handleSendForgotCode,
        onResetPassword: handleResetPassword,
        onChangeNumber: handleChangeNumber,
        onGoRecruiter: () => router.push("/recruiter/login"),
    };

    return (
        <div className="min-h-screen bg-white font-sans text-gray-900 flex flex-col">
            {/* Header */}
            <header className="flex justify-between items-center px-4 sm:px-6 md:px-12 py-3.5 bg-white border-b border-slate-200 shadow-2xs shrink-0">
                <div className="flex items-center">
                    <BrandLogo size="md" />
                </div>
                <div className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm font-semibold text-slate-700">
                    <button
                        type="button"
                        onClick={() => setIsDownloadModalOpen(true)}
                        className="flex items-center gap-1.5 hover:text-km-primary transition-colors cursor-pointer py-1.5 px-2.5 rounded-lg hover:bg-slate-50"
                    >
                        <Download size={16} className="text-slate-500" />
                        <span>Download App</span>
                    </button>
                    
                    {/* Language Switcher */}
                    <div className="relative" ref={langRef}>
                        <button
                            type="button"
                            onClick={() => setIsLangOpen(!isLangOpen)}
                            className="flex items-center gap-1 hover:text-km-primary transition-colors py-1.5 px-2.5 rounded-lg hover:bg-slate-50 cursor-pointer"
                        >
                            <span>{selectedLang}</span>
                            <ChevronDown size={14} className={`transition-transform duration-200 ${isLangOpen ? 'rotate-180' : ''}`} />
                        </button>
                        {isLangOpen && (
                            <div className="absolute right-0 mt-1 w-28 bg-white border border-slate-200 rounded-xl shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-150">
                                <button
                                    type="button"
                                    onClick={() => { setSelectedLang('English'); setIsLangOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${selectedLang === 'English' ? 'font-bold text-km-primary bg-blue-50' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    English
                                </button>
                                <button
                                    type="button"
                                    onClick={() => { setSelectedLang('हिन्दी'); setIsLangOpen(false); }}
                                    className={`w-full text-left px-3 py-1.5 text-xs transition-colors cursor-pointer ${selectedLang === 'हिन्दी' ? 'font-bold text-km-primary bg-blue-50' : 'text-slate-700 hover:bg-slate-50'}`}
                                >
                                    हिन्दी
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Mobile Layout */}
            <div className="flex md:hidden flex-1 flex-col bg-linear-to-b from-blue-50/40 to-slate-50 px-4 pt-8 pb-10">
                <div className="mb-6 text-center">
                    <h1 className="text-2xl font-black leading-tight text-gray-800">
                        <span className="text-km-primary">Call</span> Or{" "}
                        <span className="text-km-accent">Talk</span> To HR &amp; Get A Job!
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

            {/* Desktop Layout */}
            <main className="hidden md:flex flex-1 flex-col">
                <div className="max-w-6xl mx-auto w-full mt-10 px-6 pb-12">
                    <div className="bg-linear-to-br from-blue-50/50 via-slate-50 to-orange-50/30 border border-slate-200/80 rounded-[40px] p-10 lg:p-16 flex flex-row items-center justify-between gap-12 min-h-125 relative overflow-hidden shadow-sm">
                        <div className="flex-1 space-y-6 z-10">
                            <h1 className="text-4xl lg:text-5xl font-black leading-tight text-gray-800">
                                <span className="text-km-primary">Call</span> Or{" "}
                                <span className="text-km-accent">Talk</span> To HR Directly &amp; Get A Job With Better Salary!
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
            <DownloadAppModal isOpen={isDownloadModalOpen} onClose={() => setIsDownloadModalOpen(false)} />
        </div>
    );
}