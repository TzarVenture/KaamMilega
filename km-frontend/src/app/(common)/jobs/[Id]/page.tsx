'use client'
import React, { useState, useEffect } from 'react';
import {
    Phone, MessageCircle, MapPin, Briefcase, Wallet,
    CheckCircle2, Clock, Users, ShieldCheck, ChevronRight,
    ArrowLeft, Calendar, Info, X, Star, Share2, User
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/axios';
import { toast } from 'react-toastify';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

interface Job {
    id: string;
    title: string;
    company: string;
    city_name: string;
    location: string;
    salary_min: number;
    salary_max: number;
    job_type: string;
    experience_min: number;
    experience_max: number;
    description: string;
    requirements: string[];
    we_offer: string[];
    status: string;
    created_at: string;
    vacancies: number;
}

const JobDetailPage = () => {
    const params = useParams();
    const router = useRouter();
    const jobId = params.Id;

    const [job, setJob] = useState<Job | null>(null);
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const [isApplying, setIsApplying] = useState(false);
    const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
    const [coverLetter, setCoverLetter] = useState("");
    const [hasApplied, setHasApplied] = useState(false);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [jobData, userData] = await Promise.all([
                    api.get(`/jobs/${jobId}`) as Promise<Job>,
                    api.get('/user/profile').catch(() => null) as Promise<any>
                ]);
                setJob(jobData);
                setUser(userData);

                if (userData) {
                    try {
                        const checkRes = await api.get(`/applications/check/${jobId}`) as { applied?: boolean };
                        if (checkRes?.applied) {
                            setHasApplied(true);
                        }
                    } catch {
                        // Gracefully continue if check fails
                    }
                }
            } catch (error) {
                console.error("Failed to fetch job", error);
                toast.error("Job details not found");
                router.push('/jobs');
            } finally {
                setLoading(false);
            }
        };
        if (jobId) fetchData();
    }, [jobId, router]);

    const handleApplyClick = () => {
        if (!user) {
            toast.info("Please login to apply");
            return;
        }

        if (hasApplied) {
            toast.info("You have already applied for this job");
            return;
        }

        const roles = Array.isArray(user?.roles) ? user.roles : (user?.role ? [user.role] : []);
        const isOnlyUser = roles.includes('user') && !roles.includes('recruiter') && !roles.includes('expert');

        if (!isOnlyUser) {
            toast.warning("Only candidates are allowed to apply for jobs.");
            return;
        }

        setIsApplyModalOpen(true);
    };

    const submitApplication = async () => {
        setIsApplying(true);
        try {
            await api.post('/applications', {
                job_id: job?.id,
                cover_letter: coverLetter
            });
            toast.success("Applied successfully!");
            setHasApplied(true);
            setIsApplyModalOpen(false);
        } catch (error: any) {
            if (error.response?.status === 409) {
                setHasApplied(true);
                setIsApplyModalOpen(false);
                toast.info(error.response?.data?.error || "You have already applied for this job");
            } else {
                toast.error(error.response?.data?.error || "Failed to apply");
            }
        } finally {
            setIsApplying(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 gap-4">
                <div className="w-12 h-12 border-4 border-purple-600/20 border-t-purple-600 rounded-full animate-spin" />
                <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Loading Job Magic...</p>
            </div>
        );
    }

    if (!job) return null;

    return (
        <div className="bg-[#F8FAFC] min-h-screen pb-20 font-sans text-slate-900">
            {/* Brand Navy Header Section */}
            <div className="bg-linear-to-r from-slate-950 via-km-primary-dark to-slate-950 pt-6 sm:pt-12 pb-10 sm:pb-16 px-4 sm:px-6 relative rounded-b-[2.5rem] sm:rounded-b-[40px] md:mx-4 md:mt-4 shadow-2xl overflow-hidden border border-slate-800">
                {/* Decorative Pattern */}
                <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
                <div className="absolute left-1/3 bottom-0 w-64 h-64 bg-amber-500/10 rounded-full blur-2xl -ml-32 pointer-events-none" />
                
                <div className="max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row justify-between items-start gap-10">
                    {/* Left: Job Info */}
                    <div className="flex-1 space-y-4 sm:space-y-6">
                        <Link href="/jobs" className="inline-flex items-center gap-2 text-blue-200 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider mb-2 sm:mb-4 bg-white/10 px-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-md">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Search
                        </Link>

                        <div className="space-y-2">
                            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white leading-tight tracking-tight">
                                {job.title}
                            </h1>
                            <p className="text-blue-200 font-bold text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2">
                                <span>{job.company}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-km-primary animate-pulse" />
                                <span className="text-amber-400 font-bold">Direct Hiring</span>
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-8 mt-8">
                            <div className="flex items-center gap-3 text-white">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center backdrop-blur-md text-emerald-400 font-black text-lg">
                                    ₹
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wider">Monthly Salary</p>
                                    <p className="text-sm sm:text-base font-extrabold">₹{job.salary_min.toLocaleString()} - ₹{job.salary_max.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-white">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center backdrop-blur-md text-blue-400">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wider">Location</p>
                                    <p className="text-sm sm:text-base font-extrabold">{job.location || 'Flexible'}, {job.city_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-white">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/10 border border-white/15 rounded-xl flex items-center justify-center backdrop-blur-md text-amber-400">
                                    <Clock size={18} />
                                </div>
                                <div>
                                    <p className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wider">Experience</p>
                                    <p className="text-sm sm:text-base font-extrabold">{job.experience_min}-{job.experience_max} Yrs</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-8">
                            <Badge text="🔥 Hot Listing" className="bg-rose-500 text-white border-0 font-bold" />
                            <Badge text={job.job_type} className="bg-white/10 text-white border border-white/20 font-bold" />
                            <Badge text={`${job.vacancies || 1} Openings`} className="bg-white/10 text-white border border-white/20 font-bold" />
                            <Badge text="KM Verified" className="bg-blue-600 text-white border-0 font-bold flex items-center gap-1.5 pr-4 shadow-md">
                                <CheckCircle2 size={12} fill="currentColor" /> KM Verified
                            </Badge>
                        </div>
                    </div>

                    {/* Right: Actions & Social Proof */}
                    <div className="lg:text-right space-y-8 flex flex-col items-stretch sm:items-start lg:items-end w-full lg:w-auto pt-8 lg:pt-0 border-t lg:border-0 border-white/10">
                        <div className="flex flex-col sm:flex-row items-stretch gap-3">
                            <div className="flex gap-3">
                                <button className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all shrink-0 active:scale-95">
                                    <Phone size={20} />
                                </button>
                                <button className="flex-1 sm:px-6 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider border border-white/20 transition-all flex items-center justify-center gap-2 active:scale-95">
                                    <MessageCircle size={18} /> Chat With HR
                                </button>
                            </div>
                            <button
                                onClick={handleApplyClick}
                                disabled={hasApplied}
                                className={`px-8 py-3.5 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${
                                    hasApplied
                                        ? 'bg-emerald-600 cursor-not-allowed shadow-emerald-900/30'
                                        : 'bg-km-primary hover:bg-km-primary-dark shadow-blue-950/50'
                                }`}
                            >
                                {hasApplied ? (
                                    <>
                                        <CheckCircle2 size={16} /> Already Applied
                                    </>
                                ) : (
                                    "Apply Now"
                                )}
                            </button>
                        </div>

                        <div className="flex items-center gap-4 bg-white/10 p-3 pr-5 rounded-2xl border border-white/10 backdrop-blur-md self-start lg:self-end">
                            <div className="flex -space-x-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-9 h-9 rounded-full border-2 border-slate-900 bg-slate-700 overflow-hidden ring-2 ring-blue-500/20">
                                        <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="avatar" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-slate-300 font-extrabold uppercase tracking-wider">Candidates Applied</span>
                                <span className="text-xs text-white font-bold">90+ People Interested</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 flex flex-col lg:flex-row gap-8">
                {/* Left Column */}
                <div className="flex-1 space-y-8">
                    {/* Job Highlights */}
                    <SectionCard title="Job Highlights">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-y-4 gap-x-8">
                            <HighlightItem text={job.job_type} />
                            <HighlightItem text={job.city_name} />
                            <HighlightItem text="All Genders" />
                            <HighlightItem text="Day Shift" />
                            {job.we_offer?.slice(0, 1).map((offer, i) => (
                                <HighlightItem key={i} text={`Job Benefits: ${offer}`} />
                            ))}
                        </div>
                    </SectionCard>

                    {/* Skill Required */}
                    {job.requirements?.length > 0 ? (
                        <SectionCard title="Skills Required">
                            <div className="flex flex-wrap gap-2">
                                {job.requirements.map(skill => (
                                    <span key={skill} className="px-4 py-2 bg-blue-50 text-km-primary rounded-xl text-xs font-bold border border-blue-100 flex items-center gap-2">
                                        <CheckCircle2 size={14} className="text-km-primary fill-blue-100" /> {skill}
                                    </span>
                                ))}
                            </div>
                        </SectionCard>
                    ) : null}

                    {/* Job Description */}
                    <SectionCard title="Job Description">
                        <div className="space-y-6 text-sm text-slate-700 leading-relaxed font-medium">
                            <div className="whitespace-pre-wrap">{job.description}</div>

                            <p className="mt-8 font-bold text-slate-500 italic">Candidates Can Call HR For More Info.</p>
                        </div>
                    </SectionCard>

                    {/* Contact Person */}
                    <SectionCard title="Contact Person">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-linear-to-br from-slate-950 via-km-primary-dark to-slate-950 text-white rounded-2xl flex items-center justify-center border border-slate-700 shadow-xs">
                                <User className="text-white" />
                            </div>
                            <div>
                                <h4 className="font-bold text-slate-900">{job.company} HR</h4>
                                <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Hiring Manager</p>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Right Column (Sidebar) */}
                <aside className="w-full lg:w-96 space-y-8">
                    {/* Steps Card */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-16 -mt-16 pointer-events-none" />
                        
                        <h3 className="text-xl font-black text-slate-900 mb-10 leading-tight relative z-10">
                            Just <span className="text-km-primary">3 Steps</span><br/>To Get Your Dream Job
                        </h3>
                        <div className="space-y-0 relative z-10">
                            {/* Vertical Line */}
                            <div className="absolute left-6 top-8 bottom-8 w-px border-l-2 border-dashed border-blue-200" />

                            <StepItem number="01" title="Create Profile" desc="Complete Your KM Profile" />
                            <StepItem number="02" title="Fix Interview" desc="Connect with HR Directly" />
                            <StepItem number="03" title="Get Hired" desc="Start Your New Career" last />
                        </div>
                    </div>

                    {/* Just Like You Card */}
                    <div className="bg-white border border-slate-200/80 rounded-3xl p-8 sm:p-10 shadow-sm">
                        <h3 className="text-xl font-black text-slate-900 mb-10 leading-tight">
                            People <span className="text-km-primary">Like You</span>
                        </h3>
                        <div className="space-y-8">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="space-y-4 group/item">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-linear-to-br from-slate-950 via-km-primary-dark to-slate-950 rounded-2xl flex items-center justify-center text-white overflow-hidden shadow-xs border border-slate-700 group-hover/item:scale-105 transition-transform">
                                            <img src={`https://i.pravatar.cc/100?img=${i + 20}`} alt="Person" className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-slate-900 text-sm">Professional Candidate</h4>
                                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Software / Sales Specialist</p>
                                            <div className="flex items-center gap-1 text-[10px] text-km-primary font-bold mt-1">
                                                <MapPin size={10} /> Bangalore, India
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="flex-1 py-2.5 border border-km-primary text-km-primary rounded-xl text-xs font-bold hover:bg-blue-50 transition-all flex items-center justify-center gap-2">
                                            <MessageCircle size={14} /> Chat
                                        </button>
                                        <button className="flex-1 py-2.5 bg-km-primary hover:bg-km-primary-dark text-white rounded-xl text-xs font-bold transition-all shadow-xs flex items-center justify-center">
                                            Connect
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full mt-8 text-km-primary font-bold text-xs uppercase tracking-wider hover:underline">Show All Members</button>
                    </div>

                    {/* Ad Banner Placeholder */}
                    <div className="bg-slate-50 border border-dashed border-slate-200 rounded-3xl h-44 flex items-center justify-center">
                        <span className="text-slate-400 font-bold uppercase tracking-wider text-xs">Ad Banner</span>
                    </div>
                </aside>
            </div>

            {/* Application Modal */}
            <AnimatePresence>
                {isApplyModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={() => setIsApplyModalOpen(false)}
                            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="bg-white w-full max-w-xl rounded-3xl p-6 sm:p-10 relative z-10 shadow-2xl border border-slate-200/80"
                        >
                            <button
                                onClick={() => setIsApplyModalOpen(false)}
                                className="absolute top-6 right-6 p-2 text-slate-400 hover:text-slate-900 transition-colors rounded-full hover:bg-slate-100"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            <div className="mb-8">
                                <span className="bg-blue-50 text-km-primary px-3.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider mb-3 inline-block">Send Application</span>
                                <h2 className="text-2xl sm:text-3xl font-black text-slate-900 leading-tight tracking-tight">Apply for Position</h2>
                                <p className="text-slate-500 font-bold text-xs sm:text-sm mt-1">Applying to <span className="text-km-primary">{job.title}</span> at {job.company}</p>
                            </div>

                            <div className="space-y-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">Cover Letter (Optional)</label>
                                    <textarea
                                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 min-h-35 outline-none focus:ring-2 focus:ring-km-primary/20 focus:border-km-primary transition-all font-semibold text-xs text-slate-900 placeholder:text-slate-400"
                                        placeholder="Pitch yourself in a few sentences..."
                                        value={coverLetter}
                                        onChange={(e) => setCoverLetter(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={submitApplication}
                                    disabled={isApplying}
                                    className="w-full bg-km-primary hover:bg-km-primary-dark text-white py-4 rounded-xl font-bold text-xs uppercase tracking-wider shadow-lg shadow-blue-900/10 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    {isApplying ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        "Confirm & Submit Application"
                                    )}
                                </button>

                                <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">By clicking submit, your candidate profile will be shared directly with the Hiring team.</p>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Sub Components ---

const Badge = ({ text, className, children }: { text?: string, className?: string, children?: React.ReactNode }) => (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${className}`}>
        {children || text}
    </span>
);

const HighlightItem = ({ text }: { text: string }) => (
    <div className="flex items-center gap-3 text-slate-700 font-bold text-xs">
        <CheckCircle2 size={16} className="text-km-primary shrink-0" />
        {text}
    </div>
);

const FAQItem = ({ q, a }: { q: string, a: string }) => (
    <div className="space-y-1">
        <h5 className="font-bold text-slate-900 text-xs leading-snug">{q}</h5>
        <p className="text-slate-500 text-xs font-medium">{a}</p>
    </div>
);

const StepItem = ({ number, title, desc, last }: { number: string, title: string, desc: string, last?: boolean }) => (
    <div className="flex gap-5 items-start pb-8 relative last:pb-0">
        <div className={`w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 shadow-xs flex items-center justify-center text-km-primary text-xs font-black relative z-10`}>
            {number}
        </div>
        <div>
            <h4 className="text-xs font-bold text-km-primary uppercase tracking-wider mb-0.5">{title}</h4>
            <p className="text-xs text-slate-500 font-semibold">{desc}</p>
        </div>
    </div>
);

const SectionCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/80 overflow-hidden">
        <h3 className="text-sm sm:text-base font-black text-slate-900 mb-6 pb-3 border-b border-slate-100 uppercase tracking-wider flex items-center gap-3">
            <span className="w-1.5 h-5 bg-km-primary rounded-full" />
            {title}
        </h3>
        {children}
    </div>
);

export default JobDetailPage;