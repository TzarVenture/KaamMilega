"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import OtpInput from "@/components/ui/OtpInput";
import { CheckCircle2, Mail, AlertCircle, ArrowRight, ShieldCheck } from "lucide-react";

type Step = 1 | 2 | 3 | 4 | 5;

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);

    // Form States
    const role = "user";
    const [fullName, setFullName] = useState("");
    const [gender, setGender] = useState("");
    const [education, setEducation] = useState("");
    const [workExperienceType, setWorkExperienceType] = useState("");
    const [city, setCity] = useState("");
    
    // Email & Email Verification State
    const [email, setEmail] = useState("");
    const [emailOtp, setEmailOtp] = useState(["", "", "", ""]);
    const [isEmailVerified, setIsEmailVerified] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [verifyingOtp, setVerifyingOtp] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [resendTimer, setResendTimer] = useState(30);

    const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
    const [experience, setExperience] = useState<string>("");

    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState<string | null>(null);
    const [validationError, setValidationError] = useState<string | null>(null);

    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        if (!storedToken) {
            router.push("/login");
        }
        setToken(storedToken);
    }, [router]);

    // Resend OTP countdown timer
    useEffect(() => {
        let timer: any;
        if (otpSent && resendTimer > 0) {
            timer = setInterval(() => {
                setResendTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(timer);
    }, [otpSent, resendTimer]);

    const validateStep1 = () => {
        if (!fullName.trim() || fullName.trim().length < 2) {
            setValidationError("Please enter your full name (minimum 2 characters).");
            return false;
        }
        if (!gender) {
            setValidationError("Please select your gender.");
            return false;
        }
        if (!education) {
            setValidationError("Please select your education level.");
            return false;
        }
        if (!workExperienceType) {
            setValidationError("Please select your work experience type.");
            return false;
        }
        if (!city) {
            setValidationError("Please select the city you want to work in.");
            return false;
        }
        setValidationError(null);
        return true;
    };

    const validateEmail = (emailStr: string) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(emailStr);
    };

    const handleSendEmailOtp = async () => {
        if (!email.trim() || !validateEmail(email.trim())) {
            setValidationError("Please enter a valid email address.");
            return;
        }
        setValidationError(null);
        setSendingOtp(true);
        try {
            await api.post("/auth/otp/email/send", { email: email.trim() });
            setOtpSent(true);
            setResendTimer(30);
        } catch (err: any) {
            setValidationError(err.message || "Failed to send verification email");
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyEmailOtp = async () => {
        const code = emailOtp.join("");
        if (code.length !== 4) {
            setValidationError("Please enter the complete 4-digit code sent to your email.");
            return;
        }
        setValidationError(null);
        setVerifyingOtp(true);
        try {
            await api.post("/auth/otp/email/verify", { email: email.trim(), code });
            setIsEmailVerified(true);
            setValidationError(null);
        } catch (err: any) {
            setValidationError(err.message || "Invalid or expired verification code.");
        } finally {
            setVerifyingOtp(false);
        }
    };

    const toggleJob = (job: string) => {
        if (selectedJobs.includes(job)) {
            setSelectedJobs(selectedJobs.filter((j) => j !== job));
        } else {
            setSelectedJobs([...selectedJobs, job]);
        }
    };

    const handleRegister = async () => {
        if (!token) return;
        setLoading(true);
        setValidationError(null);

        const payload = {
            roles: [role],
            name: fullName.trim(),
            gender: gender,
            education_level: education,
            work_experience: workExperienceType,
            city: city,
            job_categories: selectedJobs,
            experience_detail: experience,
            email: email.trim(),
            is_email_verified: isEmailVerified
        };

        try {
            const data: any = await api.post("/user/register", payload);
            localStorage.setItem("user", JSON.stringify(data));
            setStep(5);
        } catch (error: any) {
            console.error("Registration error:", error);
            setValidationError(error.message || "Registration failed, please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex flex-col text-slate-800 font-sans">
            {/* HEADER */}
            <header className="flex justify-between items-center px-6 sm:px-12 py-4 bg-white border-b border-slate-200">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#5b2168] rounded-xl flex items-center justify-center text-white font-black text-base shadow-md">
                        KM
                    </div>
                    <span className="font-extrabold text-lg tracking-tight text-slate-900">
                        KaamMilega
                    </span>
                </div>
                <div className="flex items-center gap-6 text-xs sm:text-sm font-semibold text-slate-600">
                    <span>📱 App Available</span>
                    <span className="cursor-pointer hover:text-[#5b2168]">English ▾</span>
                </div>
            </header>

            {/* STEPPER */}
            <div className="flex flex-col items-center my-6 px-4">
                <div className="hidden sm:flex items-center gap-8 md:gap-12 text-sm font-bold">
                    <StepLabel active={step >= 1} done={step > 1}>1. Personal Info</StepLabel>
                    <StepLabel active={step >= 2} done={step > 2}>2. Email Verification</StepLabel>
                    <StepLabel active={step >= 3} done={step > 3}>3. Job Category</StepLabel>
                    <StepLabel active={step >= 4} done={step > 4}>4. Experience</StepLabel>
                    <StepLabel active={step >= 5} done={step >= 5}>5. Complete</StepLabel>
                </div>

                <div className="sm:hidden text-xs font-bold text-[#5b2168] mb-2 uppercase tracking-wider">
                    Step {step} of 5
                </div>

                <div className="flex items-center mt-3 w-full max-w-md sm:max-w-2xl">
                    {[1, 2, 3, 4, 5].map((num) => (
                        <div key={num} className="flex-1 flex items-center">
                            <div
                                className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                    step >= num
                                        ? "bg-[#5b2168] text-white ring-4 ring-purple-100"
                                        : "bg-slate-200 text-slate-500"
                                }`}
                            >
                                {num}
                            </div>
                            {num !== 5 && (
                                <div
                                    className={`flex-1 h-1 transition-all ${
                                        step > num ? "bg-[#5b2168]" : "bg-slate-200"
                                    }`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* ERROR ALERT BANNER */}
            {validationError && (
                <div className="max-w-3xl mx-auto w-full px-4 mb-4">
                    <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-semibold">
                        <AlertCircle className="w-5 h-5 shrink-0" />
                        <span>{validationError}</span>
                    </div>
                </div>
            )}

            {/* CARD CONTAINER */}
            <div className="flex justify-center flex-1 px-4 sm:px-6 pb-12">
                <div className="bg-white w-full max-w-3xl rounded-3xl p-6 sm:p-10 shadow-xl shadow-purple-900/5 border border-slate-100">
                    
                    {/* STEP 1: Personal Info */}
                    {step === 1 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                                    Create Candidate Profile
                                </h2>
                                <p className="text-sm font-medium text-slate-500 mt-1">
                                    Enter your basic details so employers can easily discover your application.
                                </p>
                            </div>

                            <Input
                                label="Full Name *"
                                placeholder="Enter your full name"
                                value={fullName}
                                onChange={(e: any) => setFullName(e.target.value)}
                            />

                            <div>
                                <p className="font-bold text-slate-700 text-sm mb-3">Gender *</p>
                                <div className="flex gap-4">
                                    {["Male", "Female", "Other"].map((g) => (
                                        <Pill key={g} active={gender === g} onClick={() => setGender(g)}>
                                            {g}
                                        </Pill>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="font-bold text-slate-700 text-sm mb-3">Education Level *</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm font-medium text-slate-700">
                                    {[
                                        "Below 10th Pass",
                                        "10th Pass",
                                        "12th Pass",
                                        "Diploma",
                                        "Graduate",
                                        "Post Graduate",
                                    ].map((item) => (
                                        <label key={item} className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                                            education === item ? "border-[#5b2168] bg-purple-50/50 text-[#5b2168] font-bold" : "border-slate-200 hover:border-slate-300"
                                        }`}>
                                            <input
                                                type="radio"
                                                name="education"
                                                checked={education === item}
                                                onChange={() => setEducation(item)}
                                                className="accent-[#5b2168]"
                                            />
                                            {item}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="font-bold text-slate-700 text-sm mb-3">Work Experience Status *</p>
                                <div className="flex gap-4">
                                    {[
                                        "I am a Fresher",
                                        "I am Experienced"
                                    ].map((item) => (
                                        <label key={item} className={`flex-1 flex items-center gap-3 p-3.5 rounded-xl border transition-all cursor-pointer text-sm ${
                                            workExperienceType === item ? "border-[#5b2168] bg-purple-50/50 text-[#5b2168] font-bold" : "border-slate-200 hover:border-slate-300"
                                        }`}>
                                            <input
                                                type="radio"
                                                name="work_experience"
                                                checked={workExperienceType === item}
                                                onChange={() => setWorkExperienceType(item)}
                                                className="accent-[#5b2168]"
                                            />
                                            {item}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <p className="font-bold text-slate-700 text-sm mb-2">Target Work City *</p>
                                <select
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#5b2168] text-slate-900"
                                >
                                    <option value="">Select City</option>
                                    <option>Mumbai</option>
                                    <option>Delhi</option>
                                    <option>Bangalore</option>
                                    <option>Hyderabad</option>
                                    <option>Pune</option>
                                    <option>Ahmedabad</option>
                                </select>
                            </div>

                            <div className="pt-4 flex justify-end">
                                <button
                                    onClick={() => {
                                        if (validateStep1()) setStep(2);
                                    }}
                                    className="bg-[#5b2168] hover:bg-[#4a1b55] text-white px-8 py-3.5 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all cursor-pointer"
                                >
                                    Continue to Email <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: Email Verification */}
                    {step === 2 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 flex items-center gap-3">
                                    <Mail className="w-8 h-8 text-[#5b2168]" /> Verify Your Email Address
                                </h2>
                                <p className="text-sm font-medium text-slate-500 mt-1">
                                    Add your email to receive direct interview invites and job alerts from top recruiters.
                                </p>
                            </div>

                            {isEmailVerified ? (
                                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 text-center space-y-3">
                                    <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                                    <h3 className="text-lg font-bold text-emerald-900">Email Address Verified!</h3>
                                    <p className="text-sm text-emerald-700 font-medium">{email}</p>
                                </div>
                            ) : (
                                <div className="space-y-5">
                                    <div>
                                        <label className="block text-sm font-bold text-slate-700 mb-2">Email Address</label>
                                        <div className="flex gap-3">
                                            <input
                                                type="email"
                                                placeholder="e.g. candidate@gmail.com"
                                                value={email}
                                                disabled={otpSent}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="flex-1 px-4 py-3.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#5b2168] disabled:bg-slate-100"
                                            />
                                            {!otpSent && (
                                                <button
                                                    onClick={handleSendEmailOtp}
                                                    disabled={sendingOtp || !email.trim()}
                                                    className="bg-[#5b2168] hover:bg-[#4a1b55] disabled:bg-slate-300 text-white font-bold px-6 py-3.5 rounded-xl text-sm transition-all"
                                                >
                                                    {sendingOtp ? "Sending..." : "Send Verification Code"}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {otpSent && (
                                        <div className="bg-purple-50/60 border border-purple-100 rounded-2xl p-6 space-y-4">
                                            <div className="flex justify-between items-center">
                                                <p className="text-xs font-bold text-slate-600">
                                                    Enter 4-digit code sent to <span className="text-[#5b2168] font-extrabold">{email}</span>:
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => { setOtpSent(false); setEmailOtp(["", "", "", ""]); }}
                                                    className="text-xs font-bold text-[#5b2168] underline"
                                                >
                                                    Change Email
                                                </button>
                                            </div>

                                            <OtpInput value={emailOtp} onChange={(val) => setEmailOtp(val)} />

                                            <div className="flex justify-between items-center pt-2">
                                                <button
                                                    type="button"
                                                    disabled={resendTimer > 0 || sendingOtp}
                                                    onClick={handleSendEmailOtp}
                                                    className="text-xs font-bold text-[#5b2168] disabled:text-slate-400 hover:underline"
                                                >
                                                    {resendTimer > 0 ? `Resend code in 00:${resendTimer.toString().padStart(2, '0')}` : "Resend Code"}
                                                </button>
                                                <button
                                                    onClick={handleVerifyEmailOtp}
                                                    disabled={verifyingOtp || emailOtp.join("").length < 4}
                                                    className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-all"
                                                >
                                                    {verifyingOtp ? "Verifying..." : "Verify Code"}
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="pt-6 flex justify-between items-center border-t border-slate-100">
                                <button
                                    onClick={() => setStep(1)}
                                    className="text-sm font-bold text-slate-500 hover:text-slate-800"
                                >
                                    ← Back
                                </button>
                                <div className="flex gap-3">
                                    {!isEmailVerified && (
                                        <button
                                            onClick={() => setStep(3)}
                                            className="px-5 py-3 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-50"
                                        >
                                            Verify Later
                                        </button>
                                    )}
                                    <button
                                        onClick={() => setStep(3)}
                                        className="bg-[#5b2168] hover:bg-[#4a1b55] text-white px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all"
                                    >
                                        Next <ArrowRight size={16} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: Job Category */}
                    {step === 3 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                                    What Roles Are You Interested In?
                                </h2>
                                <p className="text-sm font-medium text-slate-500 mt-1">
                                    Select one or more job roles to personalize your job feed.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2">
                                {[
                                    "Delivery Boy / Executive",
                                    "Driver / Chauffeur",
                                    "Warehouse / Logistics Helper",
                                    "Manufacturing / Factory Staff",
                                    "Housekeeping / Office Peon",
                                    "Security Guard",
                                    "Painter / Artisan",
                                    "Construction Labour / Helper",
                                    "Retail Sales Executive",
                                    "Telecaller / BPO"
                                ].map((job) => {
                                    const isSelected = selectedJobs.includes(job);
                                    return (
                                        <div
                                            key={job}
                                            onClick={() => toggleJob(job)}
                                            className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                                                isSelected
                                                    ? "border-[#5b2168] bg-purple-50/50 text-[#5b2168] font-bold shadow-sm"
                                                    : "border-slate-200 hover:border-slate-300 text-slate-700"
                                            }`}
                                        >
                                            <span className="text-sm">{job}</span>
                                            <input
                                                type="checkbox"
                                                checked={isSelected}
                                                readOnly
                                                className="accent-[#5b2168] w-4 h-4"
                                            />
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-6 flex justify-between items-center border-t border-slate-100">
                                <button onClick={() => setStep(2)} className="text-sm font-bold text-slate-500 hover:text-slate-800">
                                    ← Back
                                </button>
                                <button
                                    onClick={() => {
                                        if (selectedJobs.length === 0) {
                                            setValidationError("Please select at least one job role category.");
                                            return;
                                        }
                                        setValidationError(null);
                                        setStep(4);
                                    }}
                                    className="bg-[#5b2168] hover:bg-[#4a1b55] text-white px-8 py-3 rounded-xl text-sm font-bold flex items-center gap-2 shadow-lg shadow-purple-900/20"
                                >
                                    Next <ArrowRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: Experience Detail */}
                    {step === 4 && (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900">
                                    Years of Experience
                                </h2>
                                <p className="text-sm font-medium text-slate-500 mt-1">
                                    Select your total work experience duration.
                                </p>
                            </div>

                            <div className="flex gap-3 flex-wrap">
                                {["Fresher", "1-6 Months", "1 Year", "2 Years", "3+ Years"].map((exp) => (
                                    <Pill
                                        key={exp}
                                        active={experience === exp}
                                        onClick={() => setExperience(exp)}
                                    >
                                        {exp}
                                    </Pill>
                                ))}
                            </div>

                            <div className="pt-8 flex justify-between items-center border-t border-slate-100">
                                <button onClick={() => setStep(3)} className="text-sm font-bold text-slate-500 hover:text-slate-800">
                                    ← Back
                                </button>
                                <button
                                    onClick={handleRegister}
                                    disabled={loading || !experience}
                                    className="bg-[#5b2168] hover:bg-[#4a1b55] disabled:bg-slate-300 text-white px-10 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-purple-900/20 transition-all cursor-pointer"
                                >
                                    {loading ? "Completing Setup..." : "Complete Registration →"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: Congratulations */}
                    {step === 5 && (
                        <div className="text-center py-12 space-y-6">
                            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                                <ShieldCheck className="w-10 h-10" />
                            </div>
                            <div>
                                <h2 className="text-3xl sm:text-4xl font-black text-slate-900">
                                    Setup Completed! 🎉
                                </h2>
                                <p className="text-slate-500 font-medium mt-2">
                                    Your candidate profile has been created successfully.
                                </p>
                            </div>
                            <button
                                onClick={() => router.push("/")}
                                className="bg-[#5b2168] hover:bg-[#4a1b55] text-white px-10 py-4 rounded-xl font-bold text-base shadow-xl shadow-purple-900/20 transition-all"
                            >
                                Explore Matching Jobs
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* UI COMPONENTS WITH CRISP CONTRAST */

function StepLabel({ children, active, done }: any) {
    return (
        <span className={done ? "text-emerald-700 font-extrabold" : active ? "text-[#5b2168] font-black" : "text-slate-400 font-semibold"}>
            {children}
        </span>
    );
}

function Input({ label, placeholder, value, onChange }: any) {
    return (
        <div>
            <label className="block font-bold text-slate-700 text-sm mb-2">{label}</label>
            <input
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full border border-slate-300 rounded-xl px-4 py-3 text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-[#5b2168]"
            />
        </div>
    );
}

function Pill({ children, active, onClick }: any) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={`px-6 py-3 rounded-xl border text-sm font-bold transition-all cursor-pointer ${
                active
                    ? "bg-[#5b2168] text-white border-[#5b2168] shadow-md shadow-purple-900/10"
                    : "border-slate-300 text-slate-700 bg-white hover:border-slate-400 hover:bg-slate-50"
            }`}
        >
            {children}
        </button>
    );
}
