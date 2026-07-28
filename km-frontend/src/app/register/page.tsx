"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";

type Step = 1 | 2 | 3 | 4;

export default function RegisterPage() {
    const router = useRouter();
    const [step, setStep] = useState<Step>(1);
    const [selectedJobs, setSelectedJobs] = useState<string[]>([]);
    const [experience, setExperience] = useState<string>("");

    // Form States
    const role = "user";
    const [fullName, setFullName] = useState("");
    const [gender, setGender] = useState("");
    const [education, setEducation] = useState("");
    const [workExperienceType, setWorkExperienceType] = useState("");
    const [city, setCity] = useState("");

    const [loading, setLoading] = useState(false);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const storedToken = localStorage.getItem("token");
        if (!storedToken) {
            router.push("/login");
        }
        setToken(storedToken);
    }, [router]);

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

        const payload = {
            roles: [role],
            name: fullName,
            gender: gender,
            education_level: education, // Must match backend JSON tag if snake_case or whatever
            // The backend struct uses snake_case json tags in `domain.go`
            // Let's verify domain: `json:"education_level"`
            work_experience: workExperienceType,
            city: city,
            job_categories: selectedJobs,
            experience_detail: experience
        };

        try {
            const data: any = await api.post("/user/register", payload);

            // Update user in local storage
            localStorage.setItem("user", JSON.stringify(data));

            setStep(4);
        } catch (error: any) {
            console.error("Registration error:", error);
            alert(error.message || "Registration failed, please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#f4f4f4] flex flex-col">

            {/* HEADER */}
            <header className="flex justify-between items-center px-4 sm:px-8 lg:px-16 py-4 sm:py-6">
                <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#6b2e6f] rounded-full flex items-center justify-center text-white text-sm sm:text-base font-bold">
                        KM
                    </div>
                    <span className="font-semibold text-base sm:text-lg">
                        Kaam Milega
                    </span>
                </div>

                <div className="flex items-center gap-4 sm:gap-8 text-xs sm:text-sm text-gray-700">
                    <span>📱 Download App</span>
                    <span>English ▾</span>
                </div>
            </header>

            {/* STEPPER */}
            <div className="flex flex-col items-center mb-6 sm:mb-10 px-4">
                <div className="hidden sm:flex items-center gap-6 md:gap-12 text-xs sm:text-sm font-medium">
                    <StepLabel active={step >= 1}>Personal Detail</StepLabel>
                    <StepLabel active={step >= 2}>Job Category</StepLabel>
                    <StepLabel active={step >= 3}>Experience</StepLabel>
                    <StepLabel active={step >= 4}>Done</StepLabel>
                </div>

                {/* Mobile Step Indicator */}
                <div className="sm:hidden text-sm font-medium text-[#b06bb5] mb-3">
                    Step {step} of 4
                </div>

                <div className="flex items-center mt-2 w-full max-w-md sm:max-w-2xl">
                    {[1, 2, 3, 4].map((num) => (
                        <div key={num} className="flex-1 flex items-center">
                            <div
                                className={`w-4 h-4 sm:w-5 sm:h-5 rounded-full border-4 ${step >= num
                                    ? "border-[#b06bb5]"
                                    : "border-gray-300"
                                    } bg-white`}
                            />
                            {num !== 4 && (
                                <div
                                    className={`flex-1 h-1 ${step > num ? "bg-[#b06bb5]" : "bg-gray-300"
                                        }`}
                                />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* CARD */}
            <div className="flex justify-center flex-1 px-4 sm:px-6 pb-10 sm:pb-16">
                <div className="bg-white w-full max-w-3xl rounded-2xl sm:rounded-3xl p-6 sm:p-10 lg:p-12 shadow-sm">

                    {/* STEP 1 */}
                    {step === 1 && (
                        <>
                            <h2 className="text-xl sm:text-3xl font-bold mb-6 sm:mb-8">
                                Make Your Profile
                            </h2>


                            <Input
                                label="Full Name"
                                placeholder="Enter Full Name"
                                value={fullName}
                                onChange={(e: any) => setFullName(e.target.value)}
                            />

                            <div className="mt-6">
                                <p className="font-medium mb-2 text-sm sm:text-base">
                                    Gender
                                </p>
                                <div className="flex gap-3 sm:gap-4">
                                    <Pill active={gender === "Male"} onClick={() => setGender("Male")}>Male</Pill>
                                    <Pill active={gender === "Female"} onClick={() => setGender("Female")}>Female</Pill>
                                </div>
                            </div>

                            <div className="mt-6">
                                <p className="font-medium mb-2">Education Level</p>
                                <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                                    {[
                                        "Below 10th Pass",
                                        "10th Pass",
                                        "12th Pass",
                                        "Diploma",
                                        "Graduate",
                                        "Post Graduate",
                                    ].map((item) => (
                                        <label key={item} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="education"
                                                checked={education === item}
                                                onChange={() => setEducation(item)}
                                            />
                                            {item}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-6">
                                <p className="font-medium mb-2">Work Experiance</p>
                                <div className="flex flex-wrap gap-6 text-sm text-gray-600">
                                    {[
                                        "I am a Fresher",
                                        "I am experianced"
                                    ].map((item) => (
                                        <label key={item} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="work_experiance"
                                                checked={workExperienceType === item}
                                                onChange={() => setWorkExperienceType(item)}
                                            />
                                            {item}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Select City */}
                            <div className="mt-6">
                                <p className="font-medium mb-2 text-sm sm:text-base">
                                    Which City Do You Want To Work In?
                                </p>

                                <select
                                    value={city}
                                    onChange={(e) => setCity(e.target.value)}
                                    className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm sm:text-base bg-white focus:outline-none focus:ring-2 focus:ring-[#b06bb5]"
                                >
                                    <option value="">Select City</option>
                                    <option>Mumbai</option>
                                    <option>Delhi</option>
                                    <option>Bangalore</option>
                                    <option>Hyderabad</option>
                                    <option>Pune</option>
                                </select>
                            </div>

                            <div className="mt-8 flex justify-end">
                                <NextButton onClick={() => setStep(2)} />
                            </div>
                        </>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && (
                        <>
                            <h2 className="text-xl sm:text-3xl font-bold mb-6">
                                What Kind Of Role Do You Want?
                            </h2>

                            <input
                                placeholder="🔍 Job Title/Category"
                                className="w-full border rounded-full px-5 py-3 mb-6 text-sm sm:text-base"
                            />

                            <div className="space-y-4 max-h-64 sm:max-h-72 overflow-y-auto pr-2">
                                {[
                                    "Delivery",
                                    "Driver",
                                    "Warehouse / Logistics",
                                    "Manufacturer",
                                    "Housekeeping / Peon",
                                    "Security Guard",
                                    "Painter",
                                    "Labour / Helper",
                                ].map((job) => (
                                    <div
                                        key={job}
                                        className="flex justify-between items-center border-b pb-3 text-sm sm:text-base cursor-pointer"
                                        onClick={() => toggleJob(job)}
                                    >
                                        <span>{job}</span>
                                        <input
                                            type="checkbox"
                                            checked={selectedJobs.includes(job)}
                                            readOnly
                                            className="w-4 h-4 pointer-events-none"
                                        />
                                    </div>
                                ))}
                            </div>

                            <div className="mt-8 flex justify-end">
                                <NextButton onClick={() => setStep(3)} />
                            </div>
                        </>
                    )}

                    {/* STEP 3 */}
                    {step === 3 && (
                        <>
                            <h2 className="text-xl sm:text-3xl font-bold mb-6">
                                Delivery
                            </h2>

                            <p className="mb-4 font-medium text-sm sm:text-base">
                                What Is Your Work Experience?
                            </p>

                            <div className="flex gap-3 sm:gap-4 flex-wrap">
                                {["Fresher", "1-6 Months", "1 Year", "2 Years", "3 Years"].map(
                                    (exp) => (
                                        <Pill
                                            key={exp}
                                            active={experience === exp}
                                            onClick={() => setExperience(exp)}
                                        >
                                            {exp}
                                        </Pill>
                                    )
                                )}
                            </div>

                            <div className="mt-10 flex justify-end">
                                <button
                                    onClick={handleRegister}
                                    disabled={loading}
                                    className="bg-[#b6aeb8] text-white px-6 sm:px-8 py-2 sm:py-3 rounded-full text-sm sm:text-base disabled:opacity-70"
                                >
                                    {loading ? "Submitting..." : "Next →"}
                                </button>
                            </div>
                        </>
                    )}

                    {/* STEP 4 */}
                    {step === 4 && (
                        <div className="text-center py-10 sm:py-16">
                            <h2 className="text-2xl sm:text-4xl font-bold mb-4">
                                Congratulations! 🎉
                            </h2>
                            <p className="text-gray-500 mb-6 sm:mb-8 text-sm sm:text-base">
                                You Complete Your Profile
                            </p>

                            <button
                                onClick={() => router.push("/")}
                                className="px-6 sm:px-8 py-3 border border-[#b06bb5] text-[#b06bb5] rounded-full font-medium text-sm sm:text-base"
                            >
                                Let Explore Jobs
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/* COMPONENTS */

function StepLabel({ children, active }: any) {
    return (
        <span className={active ? "text-[#b06bb5]" : "text-gray-400"}>
            {children}
        </span>
    );
}

function Input({ label, placeholder, value, onChange }: any) {
    return (
        <div>
            <p className="font-medium mb-2 text-sm sm:text-base">{label}</p>
            <input
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm sm:text-base"
            />
        </div>
    );
}

function Pill({ children, active, onClick }: any) {
    return (
        <button
            onClick={onClick}
            className={`px-4 sm:px-5 py-2 rounded-full border text-sm sm:text-base ${active
                ? "bg-[#b06bb5] text-white border-[#b06bb5]"
                : "border-gray-300 text-gray-600"
                }`}
        >
            {children}
        </button>
    );
}

function NextButton({ onClick }: any) {
    return (
        <button
            onClick={onClick}
            className="bg-[#b6aeb8] text-white px-6 sm:px-8 py-2 sm:py-3 rounded-full text-sm sm:text-base"
        >
            Next →
        </button>
    );
}

