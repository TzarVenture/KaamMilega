"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import {
    Briefcase, MapPin, DollarSign, List, Edit2,
    CheckCircle, ArrowLeft, ArrowRight, Building2,
    Clock, Info, ShieldCheck, Search, Save
} from "lucide-react";
import Link from "next/link";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";

type Step = 1 | 2 | 3;

export default function EditJobPage() {
    const router = useRouter();
    const params = useParams();
    const jobId = params.id;

    const [step, setStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [cities, setCities] = useState<any[]>([]);
    const [searchCity, setSearchCity] = useState("");
    const [isCityOpen, setIsCityOpen] = useState(false);
    const cityRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState({
        title: "",
        company: "",
        city_id: "",
        city_name: "",
        location: "",
        salary_min: "",
        salary_max: "",
        job_type: "Full-time",
        description: "",
        requirements: "",
        we_offer: "",
        experience_min: "",
        experience_max: "",
        gender: "",
        education: "",
        status: "Open"
    });

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch cities first
                const citiesData: any = await api.get("/cities") as any;
                setCities(citiesData?.data);

                // Fetch job details
                const jobData = await api.get(`/jobs/${jobId}`) as any;

                setFormData({
                    title: jobData.title || "",
                    company: jobData.company || "",
                    city_id: jobData.city_id || "",
                    city_name: jobData.city_name || "",
                    location: jobData.location || "",
                    salary_min: jobData.salary_min?.toString() || "",
                    salary_max: jobData.salary_max?.toString() || "",
                    job_type: jobData.job_type || "Full-time",
                    description: jobData.description || "",
                    requirements: Array.isArray(jobData.requirements) ? jobData.requirements.join("\n") : "",
                    we_offer: Array.isArray(jobData.we_offer) ? jobData.we_offer.join("\n") : "",
                    experience_min: jobData.experience_min?.toString() || "",
                    experience_max: jobData.experience_max?.toString() || "",
                    gender: jobData.gender || "",
                    education: jobData.education || "",
                    status: jobData.status || "Open"
                });
            } catch (error: any) {
                console.error("Failed to fetch job data", error);
                toast.error("Failed to load job details");
                router.push("/recruiter/jobs/list");
            } finally {
                setFetching(false);
            }
        };

        if (jobId) {
            fetchData();
        }

        const handleClickOutside = (event: MouseEvent) => {
            if (cityRef.current && !cityRef.current.contains(event.target as Node)) {
                setIsCityOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [jobId, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const nextStep = () => setStep((prev) => (prev + 1) as Step);
    const prevStep = () => setStep((prev) => (prev - 1) as Step);

    const filteredCities = cities?.filter(city =>
        city.name.toLowerCase().includes(searchCity.toLowerCase())
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (step < 3) {
            nextStep();
            return;
        }

        setLoading(true);

        try {
            const jobData = {
                title: formData.title,
                company: formData.company,
                city_id: formData.city_id,
                location: formData.location,
                salary_min: formData.salary_min ? parseInt(formData.salary_min) : 0,
                salary_max: formData.salary_max ? parseInt(formData.salary_max) : 0,
                job_type: formData.job_type,
                description: formData.description,
                requirements: formData.requirements.split("\n").filter(line => line.trim() !== ""),
                we_offer: formData.we_offer.split("\n").filter(line => line.trim() !== ""),
                experience_min: formData.experience_min ? parseInt(formData.experience_min) : 0,
                experience_max: formData.experience_max ? parseInt(formData.experience_max) : 0,
                gender: formData.gender,
                education: formData.education,
                status: formData.status
            };

            await api.patch(`/jobs/${jobId}`, jobData);
            toast.success("Job updated successfully!");
            router.push("/recruiter/jobs/list");
        } catch (err: any) {
            toast.error(err.message || "Failed to update job");
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <div className="w-12 h-12 border-4 border-blue-600/20 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-gray-500 font-medium">Loading job details...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-20 px-4">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/recruiter/jobs/list" className="p-2 bg-white rounded-full shadow-sm border border-gray-100 text-gray-400 hover:text-gray-600 transition-all">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">Edit Job Posting</h1>
                        <p className="text-sm text-gray-500">Update the details for "{formData.title}"</p>
                    </div>
                </div>

                {/* Stepper */}
                <div className="hidden md:flex items-center gap-3">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm transition-all ${step === s ? "bg-blue-600 text-white shadow-md scale-110" :
                                step > s ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500"
                                }`}>
                                {step > s ? <CheckCircle className="w-5 h-5" /> : s}
                            </div>
                            {s < 3 && <div className={`w-12 h-1 ${step > s ? "bg-green-500" : "bg-gray-200"} transition-all`} />}
                        </div>
                    ))}
                </div>
            </div>

            <form onSubmit={handleSubmit} className="relative">
                <AnimatePresence mode="wait">
                    {/* STEP 1: Basic Information */}
                    {step === 1 && (
                        <motion.div
                            key="step1"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-blue-50"
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2 text-blue-600 font-bold text-lg">
                                    <Info className="w-5 h-5" />
                                    <span>Basic Information</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-semibold text-gray-700">Status:</label>
                                    <select
                                        name="status"
                                        value={formData.status}
                                        onChange={handleChange}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${formData.status === 'Open' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-700 border-gray-200'
                                            }`}
                                    >
                                        <option value="Open">Open</option>
                                        <option value="Closed">Closed</option>
                                        <option value="On Hold">On Hold</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Job Title</label>
                                    <div className="relative">
                                        <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            name="title"
                                            placeholder="e.g. Senior Product Designer"
                                            required
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={formData.title}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Company Name</label>
                                    <div className="relative">
                                        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            type="text"
                                            name="company"
                                            placeholder="Your Company Name"
                                            required
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                            value={formData.company}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2" ref={cityRef}>
                                    <label className="text-sm font-semibold text-gray-700">City / Location</label>
                                    <div className="relative">
                                        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <button
                                            type="button"
                                            onClick={() => setIsCityOpen(!isCityOpen)}
                                            className="w-full text-left pl-10 pr-10 py-3 rounded-xl border border-gray-200 hover:border-blue-400 transition-all font-medium"
                                        >
                                            {formData.city_name || "Select City"}
                                        </button>

                                        {isCityOpen && (
                                            <div className="absolute top-full left-0 w-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 overflow-hidden">
                                                <div className="p-2 border-b">
                                                    <div className="relative">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search city..."
                                                            className="w-full pl-9 pr-4 py-2 text-sm bg-gray-50 border-none rounded-lg focus:ring-0"
                                                            value={searchCity}
                                                            onChange={(e) => setSearchCity(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-60 overflow-y-auto">
                                                    {filteredCities.map(city => (
                                                        <div
                                                            key={city.id}
                                                            onClick={() => {
                                                                setFormData({ ...formData, city_id: city.id, city_name: city.name });
                                                                setIsCityOpen(false);
                                                            }}
                                                            className="px-4 py-3 hover:bg-blue-50 cursor-pointer flex items-center justify-between text-sm transition-colors"
                                                        >
                                                            <span className="font-medium text-gray-700">{city.name}</span>
                                                            <span className="text-xs text-gray-400">{city.state}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Employment Type</label>
                                    <div className="relative">
                                        <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" />
                                        <select
                                            name="job_type"
                                            className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all appearance-none bg-white font-medium"
                                            value={formData.job_type}
                                            onChange={handleChange}
                                        >
                                            <option value="Full-time">Full-time</option>
                                            <option value="Part-time">Part-time</option>
                                            <option value="Contract">Contract</option>
                                            <option value="Freelance">Freelance</option>
                                            <option value="Internship">Internship</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Specific Address / Landmark <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input
                                    type="text"
                                    name="location"
                                    placeholder="e.g. Opposite Central Mall, Okhla Stage III"
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                    value={formData.location}
                                    onChange={handleChange}
                                />
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: Compensation & Experience */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-8 bg-white p-8 rounded-2xl shadow-xl border border-blue-50"
                        >
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-lg mb-4">
                                <DollarSign className="w-5 h-5" />
                                <span>Compensation & Experience</span>
                            </div>

                            <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex gap-4">
                                <ShieldCheck className="w-8 h-8 text-blue-600 shrink-0" />
                                <div>
                                    <h4 className="font-bold text-blue-900">Payment Strategy</h4>
                                    <p className="text-sm text-blue-700 mt-1">Updating salary info can help attract the latest qualified candidates browsing the platform.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Gender Preference</label>
                                    <select
                                        name="gender"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                                        value={formData.gender}
                                        onChange={handleChange}
                                    >
                                        <option value="">Any</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">Education Qualification</label>
                                    <select
                                        name="education"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all bg-white"
                                        value={formData.education}
                                        onChange={handleChange}
                                    >
                                        <option value="">Any / Not Specified</option>
                                        <option value="10th Pass">10th Pass</option>
                                        <option value="12th Pass">12th Pass</option>
                                        <option value="Diploma">Diploma</option>
                                        <option value="Graduation">Graduation</option>
                                        <option value="Post Graduation">Post Graduation</option>
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                                <div className="space-y-4">
                                    <label className="text-sm font-semibold text-gray-700">Salary Range (Monthly)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                name="salary_min"
                                                placeholder="Min"
                                                className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                value={formData.salary_min}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="text-gray-400 font-bold">—</div>
                                        <div className="relative flex-1">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">₹</span>
                                            <input
                                                type="number"
                                                name="salary_max"
                                                placeholder="Max"
                                                className="w-full pl-8 pr-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                                                value={formData.salary_max}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <label className="text-sm font-semibold text-gray-700">Required Experience (Years)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                name="experience_min"
                                                placeholder="Min"
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center"
                                                value={formData.experience_min}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <div className="text-gray-400 font-bold">—</div>
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                name="experience_max"
                                                placeholder="Max"
                                                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all text-center"
                                                value={formData.experience_max}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: Description & Finalize */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="space-y-6 bg-white p-8 rounded-2xl shadow-xl border border-blue-50"
                        >
                            <div className="flex items-center gap-2 text-blue-600 font-bold text-lg mb-4">
                                <Edit2 className="w-5 h-5" />
                                <span>Core Details</span>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-gray-700">Job Description</label>
                                <textarea
                                    name="description"
                                    rows={5}
                                    placeholder="Explain the role and responsibilities..."
                                    required
                                    className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                    value={formData.description}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                        Requirements
                                        <span className="text-[10px] uppercase tracking-wider text-gray-400 px-2 py-0.5 rounded border">One per line</span>
                                    </label>
                                    <textarea
                                        name="requirements"
                                        rows={4}
                                        placeholder="• Requirement 1&#10;• Requirement 2"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                        value={formData.requirements}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700 flex justify-between">
                                        Perks & Benefits
                                        <span className="text-[10px] uppercase tracking-wider text-gray-400 px-2 py-0.5 rounded border">One per line</span>
                                    </label>
                                    <textarea
                                        name="we_offer"
                                        rows={4}
                                        placeholder="• Benefit 1&#10;• Benefit 2"
                                        className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition-all resize-none"
                                        value={formData.we_offer}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="mt-10 flex items-center justify-between">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={prevStep}
                            className="flex items-center gap-2 px-6 py-3 text-gray-500 font-bold hover:text-gray-900 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Back
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex gap-4">
                        <Link
                            href="/recruiter/jobs/list"
                            className="px-6 py-3 rounded-xl border border-gray-200 text-gray-500 font-bold hover:bg-gray-50 transition-all"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="min-w-[180px] bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-200 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : step === 3 ? (
                                <>
                                    <Save className="w-5 h-5" />
                                    Save Changes
                                </>
                            ) : (
                                <>
                                    Continue
                                    <ArrowRight className="w-5 h-5" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
