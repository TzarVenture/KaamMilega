"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import api from "@/lib/axios";
import { 
    ArrowLeftIcon, 
    ArrowRightIcon, 
    BriefcaseIcon, 
    BuildingOfficeIcon, 
    CaretDownIcon,
    CheckCircleIcon, 
    ClockIcon, 
    CurrencyInrIcon, 
    FloppyDiskIcon, 
    InfoIcon, 
    MagnifyingGlassIcon, 
    MapPinIcon, 
    PencilSimpleIcon, 
    ShieldCheckIcon 
} from '@phosphor-icons/react';
import Link from "next/link";
import { notify } from "@/lib/notify";
import { motion, AnimatePresence } from "framer-motion";

type Step = 1 | 2 | 3;

export default function EditJobPage() {
    const router = useRouter();
    const params = useParams();
    const jobId = params?.id;

    const [step, setStep] = useState<Step>(1);
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);
    const [cities, setCities] = useState<any[]>([]);
    const [searchCity, setSearchCity] = useState("");
    const [isCityOpen, setIsCityOpen] = useState(false);
    const cityRef = useRef<HTMLDivElement>(null);
    const [isStatusOpen, setIsStatusOpen] = useState(false);
    const statusRef = useRef<HTMLDivElement>(null);

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
                const citiesData: any = await api.get("/cities");
                setCities(citiesData?.data || []);

                // Fetch job details
                const jobData: any = await api.get(`/jobs/${jobId}`);

                const normalizeStatus = (status?: string) => {
                    const s = (status || "").toLowerCase();
                    if (s === "closed") return "Closed";
                    if (s === "on hold" || s === "onhold") return "On Hold";
                    return "Open";
                };

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
                    status: normalizeStatus(jobData.status)
                });
            } catch (error: any) {
                console.error("Failed to fetch job data", error);
                notify.error("Failed to load job details");
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
            if (statusRef.current && !statusRef.current.contains(event.target as Node)) {
                setIsStatusOpen(false);
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
        city.name?.toLowerCase().includes(searchCity.toLowerCase())
    ) || [];

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
            notify.success("Job updated successfully!");
            router.push("/recruiter/jobs/list");
        } catch (err: any) {
            notify.error(err.message || "Failed to update job");
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] gap-3">
                <div className="w-8 h-8 border-2 border-km-border border-t-km-primary rounded-full animate-spin" />
                <p className="text-xs text-km-text-secondary">Loading job specifications...</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto pb-16 px-4 font-sans text-km-text-primary">
            {/* Header */}
            <div className="mb-8 flex items-center justify-between">
                <div className="flex items-center gap-3.5">
                    <Link 
                        href="/recruiter/jobs/list" 
                        className="p-2.5 bg-km-surface-card rounded-xl border border-km-border text-km-text-secondary hover:text-km-text-primary hover:bg-km-surface transition-colors shadow-xs"
                        aria-label="Back to Jobs List"
                    >
                        <ArrowLeftIcon size={18} weight="bold" aria-hidden="true" />
                    </Link>
                    <div>
                        <h1 className="text-xl sm:text-2xl font-bold text-km-text-primary font-poppins">Edit Job Posting</h1>
                        <p className="text-xs sm:text-sm text-km-text-secondary mt-0.5">
                            Update details for <span className="font-semibold text-km-text-primary">{formData.title || "Job Posting"}</span>
                        </p>
                    </div>
                </div>

                {/* Stepper */}
                <div className="hidden sm:flex items-center gap-2.5">
                    {[1, 2, 3].map((s) => (
                        <div key={s} className="flex items-center">
                            <div 
                                className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-xs transition-colors ${
                                    step === s 
                                        ? "bg-km-primary text-white shadow-xs" 
                                        : step > s 
                                        ? "bg-emerald-600 text-white" 
                                        : "bg-km-surface border border-km-border text-km-text-secondary"
                                }`}
                            >
                                {step > s ? <CheckCircleIcon size={18} weight="fill" aria-hidden="true" /> : s}
                            </div>
                            {s < 3 && (
                                <div 
                                    className={`w-10 sm:w-12 h-0.5 mx-1.5 transition-colors ${
                                        step > s ? "bg-emerald-600" : "bg-km-border"
                                    }`} 
                                />
                            )}
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
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-7 bg-km-surface-card p-6 sm:p-9 rounded-2xl border border-km-border shadow-xs"
                        >
                            <div className="flex items-center justify-between border-b border-km-border/70 pb-4">
                                <div className="flex items-center gap-2.5 text-km-primary dark:text-km-link font-semibold text-base">
                                    <InfoIcon size={20} weight="regular" aria-hidden="true" />
                                    <span className="font-poppins">Basic Information</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <label className="text-sm font-semibold text-km-text-secondary">Status:</label>
                                    <div className="relative" ref={statusRef}>
                                        <button
                                            type="button"
                                            onClick={() => setIsStatusOpen(!isStatusOpen)}
                                            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer select-none ${
                                                formData.status === 'Closed' 
                                                    ? 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100/70 dark:bg-[#291229] dark:text-rose-400 dark:border-rose-800/60' 
                                                    : formData.status === 'On Hold'
                                                    ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/70 dark:bg-[#261A20] dark:text-amber-400 dark:border-amber-800/60'
                                                    : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70 dark:bg-[#0B212C] dark:text-emerald-400 dark:border-emerald-800/60'
                                            }`}
                                            aria-haspopup="listbox"
                                            aria-expanded={isStatusOpen}
                                        >
                                            <span>{formData.status || "Open"}</span>
                                            <CaretDownIcon size={12} weight="bold" className={`transition-transform ${isStatusOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                                        </button>

                                        {isStatusOpen && (
                                            <div className="absolute right-0 top-full mt-1.5 w-36 bg-km-surface-card rounded-xl border border-km-border shadow-lg py-1 z-50 overflow-hidden divide-y divide-km-border/40">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, status: "Open" }));
                                                        setIsStatusOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                                        formData.status === "Open"
                                                            ? "bg-emerald-50 text-emerald-700"
                                                            : "text-emerald-700 hover:bg-emerald-50/60"
                                                    }`}
                                                >
                                                    <span>Open</span>
                                                    {formData.status === "Open" && <CheckCircleIcon size={14} weight="fill" className="text-emerald-600" aria-hidden="true" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, status: "Closed" }));
                                                        setIsStatusOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                                        formData.status === "Closed"
                                                            ? "bg-rose-50 text-rose-700"
                                                            : "text-rose-700 hover:bg-rose-50/60"
                                                    }`}
                                                >
                                                    <span>Closed</span>
                                                    {formData.status === "Closed" && <CheckCircleIcon size={14} weight="fill" className="text-rose-600" aria-hidden="true" />}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData(prev => ({ ...prev, status: "On Hold" }));
                                                        setIsStatusOpen(false);
                                                    }}
                                                    className={`w-full px-3 py-2 text-left text-xs font-semibold flex items-center justify-between transition-colors cursor-pointer ${
                                                        formData.status === "On Hold"
                                                            ? "bg-amber-50 text-amber-700"
                                                            : "text-amber-700 hover:bg-amber-50/60"
                                                    }`}
                                                >
                                                    <span>On Hold</span>
                                                    {formData.status === "On Hold" && <CheckCircleIcon size={14} weight="fill" className="text-amber-600" aria-hidden="true" />}
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-km-text-primary block">Job Title</label>
                                    <div className="relative">
                                        <BriefcaseIcon size={18} weight="regular" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary" aria-hidden="true" />
                                        <input
                                            type="text"
                                            name="title"
                                            placeholder="e.g. Senior Frontend Engineer"
                                            required
                                            className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors"
                                            value={formData.title}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-km-text-primary block">Company Name</label>
                                    <div className="relative">
                                        <BuildingOfficeIcon size={18} weight="regular" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary" aria-hidden="true" />
                                        <input
                                            type="text"
                                            name="company"
                                            placeholder="Company Name"
                                            required
                                            className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors"
                                            value={formData.company}
                                            onChange={handleChange}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
                                <div className="space-y-2" ref={cityRef}>
                                    <label className="text-sm font-semibold text-km-text-primary block">Target City / Location</label>
                                    <div className="relative">
                                        <MapPinIcon size={18} weight="regular" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary" aria-hidden="true" />
                                        <button
                                            type="button"
                                            onClick={() => setIsCityOpen(!isCityOpen)}
                                            className="w-full text-left pl-11 pr-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary font-normal focus:border-km-primary transition-colors flex items-center justify-between"
                                        >
                                            <span className="truncate">{formData.city_name || "Select City"}</span>
                                            <CaretDownIcon size={14} className="text-km-text-secondary shrink-0" aria-hidden="true" />
                                        </button>

                                        {isCityOpen && (
                                            <div className="absolute top-full left-0 w-full mt-2 bg-km-surface-card rounded-xl shadow-lg border border-km-border z-50 overflow-hidden">
                                                <div className="p-3 border-b border-km-border/70">
                                                    <div className="relative">
                                                        <MagnifyingGlassIcon size={16} weight="regular" className="absolute left-3 top-1/2 -translate-y-1/2 text-km-text-secondary" aria-hidden="true" />
                                                        <input
                                                            type="text"
                                                            placeholder="Search city..."
                                                            className="w-full pl-9 pr-3 py-2 text-sm bg-km-surface border border-km-border rounded-lg text-km-text-primary outline-none"
                                                            value={searchCity}
                                                            onChange={(e) => setSearchCity(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="max-h-56 overflow-y-auto divide-y divide-km-border/50">
                                                    {filteredCities.map((city) => (
                                                        <div
                                                            key={city.id}
                                                            onClick={() => {
                                                                setFormData({ ...formData, city_id: city.id, city_name: city.name });
                                                                setIsCityOpen(false);
                                                            }}
                                                            className="px-4 py-2.5 hover:bg-km-surface cursor-pointer flex items-center justify-between text-sm transition-colors"
                                                        >
                                                            <span className="font-medium text-km-text-primary">{city.name}</span>
                                                            <span className="text-xs text-km-text-secondary">{city.state}</span>
                                                        </div>
                                                    ))}
                                                    {filteredCities.length === 0 && (
                                                        <div className="px-4 py-3 text-center text-xs text-km-text-secondary">
                                                            No matching cities found
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-km-text-primary block">Employment Type</label>
                                    <div className="relative">
                                        <ClockIcon size={18} weight="regular" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary pointer-events-none" aria-hidden="true" />
                                        <select
                                            name="job_type"
                                            className="w-full pl-11 pr-8 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary focus:border-km-primary outline-none transition-colors appearance-none cursor-pointer"
                                            value={formData.job_type}
                                            onChange={handleChange}
                                        >
                                            <option value="Full-time">Full-time</option>
                                            <option value="Part-time">Part-time</option>
                                            <option value="Contract">Contract</option>
                                            <option value="Freelance">Freelance</option>
                                            <option value="Internship">Internship</option>
                                        </select>
                                        <CaretDownIcon size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary pointer-events-none" aria-hidden="true" />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-km-text-primary block">
                                    Specific Address / Area <span className="text-xs text-km-text-secondary font-normal">(Optional)</span>
                                </label>
                                <div className="relative">
                                    <MapPinIcon size={18} weight="regular" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary" aria-hidden="true" />
                                    <input
                                        type="text"
                                        name="location"
                                        placeholder="e.g. Sector 62, Near Metro Station, Noida"
                                        className="w-full pl-11 pr-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors"
                                        value={formData.location}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 2: Compensation & Experience */}
                    {step === 2 && (
                        <motion.div
                            key="step2"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-7 bg-km-surface-card p-6 sm:p-9 rounded-2xl border border-km-border shadow-xs"
                        >
                            <div className="flex items-center gap-2.5 text-km-primary dark:text-km-link font-semibold text-base border-b border-km-border/70 pb-4">
                                <CurrencyInrIcon size={20} weight="regular" aria-hidden="true" />
                                <span className="font-poppins">Compensation & Eligibility</span>
                            </div>

                            <div className="bg-km-surface p-4 rounded-xl border border-km-border flex gap-3 items-start">
                                <ShieldCheckIcon size={20} weight="regular" className="text-km-primary dark:text-km-link shrink-0 mt-0.5" aria-hidden="true" />
                                <div>
                                    <h4 className="text-xs font-semibold text-km-text-primary">Accurate Compensation Policy</h4>
                                    <p className="text-xs text-km-text-secondary mt-0.5 leading-relaxed">
                                        Jobs with clear, competitive salary ranges attract 3x more qualified candidate applications.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-km-text-primary block">Gender Preference</label>
                                    <select
                                        name="gender"
                                        className="w-full px-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary focus:border-km-primary outline-none transition-colors cursor-pointer"
                                        value={formData.gender}
                                        onChange={handleChange}
                                    >
                                        <option value="">Any Gender</option>
                                        <option value="Male">Male</option>
                                        <option value="Female">Female</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-km-text-primary block">Minimum Education Required</label>
                                    <select
                                        name="education"
                                        className="w-full px-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary focus:border-km-primary outline-none transition-colors cursor-pointer"
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

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-km-text-primary block">Salary Range (Monthly ₹)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary text-sm font-medium">₹</span>
                                            <input
                                                type="number"
                                                name="salary_min"
                                                placeholder="Min"
                                                className="w-full pl-9 pr-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors"
                                                value={formData.salary_min}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <span className="text-km-text-secondary text-sm">—</span>
                                        <div className="relative flex-1">
                                            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-km-text-secondary text-sm font-medium">₹</span>
                                            <input
                                                type="number"
                                                name="salary_max"
                                                placeholder="Max"
                                                className="w-full pl-9 pr-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors"
                                                value={formData.salary_max}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-km-text-secondary mt-1">Leave blank if salary is negotiable or undisclosed.</p>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm font-semibold text-km-text-primary block">Experience Required (Years)</label>
                                    <div className="flex items-center gap-3">
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                name="experience_min"
                                                placeholder="Min Yrs"
                                                className="w-full px-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors text-center"
                                                value={formData.experience_min}
                                                onChange={handleChange}
                                            />
                                        </div>
                                        <span className="text-km-text-secondary text-sm">—</span>
                                        <div className="relative flex-1">
                                            <input
                                                type="number"
                                                name="experience_max"
                                                placeholder="Max Yrs"
                                                className="w-full px-4 py-3 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors text-center"
                                                value={formData.experience_max}
                                                onChange={handleChange}
                                            />
                                        </div>
                                    </div>
                                    <p className="text-xs text-km-text-secondary mt-1">Use 0 for freshers or entry-level positions.</p>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* STEP 3: Description & Finalize */}
                    {step === 3 && (
                        <motion.div
                            key="step3"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            transition={{ duration: 0.15 }}
                            className="space-y-7 bg-km-surface-card p-6 sm:p-9 rounded-2xl border border-km-border shadow-xs"
                        >
                            <div className="flex items-center gap-2.5 text-km-primary dark:text-km-link font-semibold text-base border-b border-km-border/70 pb-4">
                                <PencilSimpleIcon size={20} weight="regular" aria-hidden="true" />
                                <span className="font-poppins">Role Specifications & Benefits</span>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-semibold text-km-text-primary block">Job Description</label>
                                <textarea
                                    name="description"
                                    rows={5}
                                    placeholder="Explain core responsibilities and team context..."
                                    required
                                    className="w-full p-4 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors resize-none leading-relaxed"
                                    value={formData.description}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-7">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-km-text-primary">Key Requirements</label>
                                        <span className="text-xs text-km-text-secondary">One item per line</span>
                                    </div>
                                    <textarea
                                        name="requirements"
                                        rows={5}
                                        placeholder="• 3+ years in React / Next.js&#10;• Experience with REST APIs&#10;• Strong communication skills"
                                        className="w-full p-4 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors resize-none leading-relaxed"
                                        value={formData.requirements}
                                        onChange={handleChange}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <label className="text-sm font-semibold text-km-text-primary">Perks & Benefits</label>
                                        <span className="text-xs text-km-text-secondary">One item per line</span>
                                    </div>
                                    <textarea
                                        name="we_offer"
                                        rows={5}
                                        placeholder="• Health Insurance&#10;• Annual Performance Bonus&#10;• Flexible Hours"
                                        className="w-full p-4 text-sm rounded-xl border border-km-border bg-km-surface-card text-km-text-primary placeholder:text-km-text-secondary/70 focus:border-km-primary outline-none transition-colors resize-none leading-relaxed"
                                        value={formData.we_offer}
                                        onChange={handleChange}
                                    />
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Navigation Buttons */}
                <div className="mt-8 flex items-center justify-between">
                    {step > 1 ? (
                        <button
                            type="button"
                            onClick={prevStep}
                            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-km-text-secondary hover:text-km-text-primary transition-colors"
                        >
                            <ArrowLeftIcon size={16} weight="bold" aria-hidden="true" />
                            <span>Previous Step</span>
                        </button>
                    ) : (
                        <div />
                    )}

                    <div className="flex items-center gap-3.5">
                        <Link
                            href="/recruiter/jobs/list"
                            className="px-5 py-2.5 rounded-xl border border-km-border text-km-text-secondary hover:bg-km-surface text-sm font-medium transition-colors"
                        >
                            Cancel
                        </Link>
                        <button
                            type="submit"
                            disabled={loading}
                            className="min-w-[160px] bg-km-primary hover:bg-km-primary-dark text-white px-6 py-2.5 rounded-xl text-sm font-semibold transition-colors shadow-xs flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {loading ? (
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : step === 3 ? (
                                <>
                                    <FloppyDiskIcon size={18} weight="bold" aria-hidden="true" />
                                    <span>Save Changes</span>
                                </>
                            ) : (
                                <>
                                    <span>Continue</span>
                                    <ArrowRightIcon size={16} weight="bold" aria-hidden="true" />
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
}
