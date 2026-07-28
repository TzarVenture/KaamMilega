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

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [jobData, userData] = await Promise.all([
                    api.get(`/jobs/${jobId}`) as Promise<Job>,
                    api.get('/user/profile').catch(() => null) as Promise<any>
                ]);
                setJob(jobData);
                setUser(userData);
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
            setIsApplyModalOpen(false);
        } catch (error: any) {
            toast.error(error.response?.data?.error || "Failed to apply");
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
        <div className="bg-[#F8F9FC] min-h-screen pb-20 font-sans">
            {/* Dark Purple Header Section */}
            <div className="bg-[#2D1B4E] pt-6 sm:pt-12 pb-10 sm:pb-16 px-4 sm:px-6 relative rounded-b-[2.5rem] sm:rounded-b-[40px] md:mx-4 md:mt-4 shadow-2xl overflow-hidden">
                {/* Decorative Pattern */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -mr-32 -mt-32" />
                
                <div className="max-w-7xl mx-auto relative z-10 flex flex-col lg:flex-row justify-between items-start gap-10">
                    {/* Left: Job Info */}
                    <div className="flex-1 space-y-4 sm:space-y-6">
                        <Link href="/jobs" className="inline-flex items-center gap-2 text-purple-300 hover:text-white transition-colors text-[10px] font-black uppercase tracking-[0.2em] mb-2 sm:mb-4">
                            <ArrowLeft className="w-4 h-4" />
                            Back to Search
                        </Link>

                        <div className="space-y-2">
                            <h1 className="text-2xl sm:text-3xl md:text-5xl font-black text-white leading-[1.1] tracking-tighter">
                                {job.title}
                            </h1>
                            <p className="text-purple-300 font-black text-xs sm:text-sm uppercase tracking-widest flex items-center gap-2 italic">
                                <span>{job.company}</span>
                                <span className="w-1.5 h-1.5 rounded-full bg-purple-500/30" />
                                <span className="text-white/50 lowercase font-bold tracking-normal">Direct Hiring</span>
                            </p>
                        </div>

                        <div className="flex flex-col sm:flex-row flex-wrap gap-4 sm:gap-8 mt-8">
                            <div className="flex items-center gap-3 text-white/90">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                    <span className="text-purple-400 text-lg font-black">₹</span>
                                </div>
                                <div>
                                    <p className="text-[10px] text-purple-300/50 font-black uppercase tracking-tighter">Budget / Month</p>
                                    <p className="text-sm sm:text-base font-black tracking-tight italic">₹{job.salary_min.toLocaleString()} - ₹{job.salary_max.toLocaleString()}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-white/90">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                    <MapPin size={18} className="text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-purple-300/50 font-black uppercase tracking-tighter">Location</p>
                                    <p className="text-sm sm:text-base font-black tracking-tight italic">{job.location || 'N/A'}, {job.city_name}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 text-white/90">
                                <div className="w-10 h-10 sm:w-11 sm:h-11 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                    <Clock size={18} className="text-purple-400" />
                                </div>
                                <div>
                                    <p className="text-[10px] text-purple-300/50 font-black uppercase tracking-tighter">Experience</p>
                                    <p className="text-sm sm:text-base font-black tracking-tight italic">{job.experience_min}-{job.experience_max} Yrs</p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 mt-8">
                            <Badge text="New" className="bg-rose-500 text-white border-0" />
                            <Badge text={job.job_type} className="bg-white/10 text-white/90 border border-white/10" />
                            <Badge text={`${job.vacancies || 0} Openings`} className="bg-white/10 text-white/90 border border-white/10" />
                            <Badge text="KM Verified" className="bg-blue-500 text-white border-0 font-black flex items-center gap-1.5 pr-4 shadow-lg shadow-blue-500/20">
                                <CheckCircle2 size={12} fill="currentColor" /> KM Verified
                            </Badge>
                        </div>
                    </div>

                    {/* Right: Actions & Social Proof */}
                    <div className="lg:text-right space-y-8 flex flex-col items-stretch sm:items-start lg:items-end w-full lg:w-auto pt-8 lg:pt-0 border-t lg:border-0 border-white/10">
                        <div className="flex flex-col sm:flex-row items-stretch gap-3">
                            <div className="flex gap-3">
                                <button className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 text-white flex items-center justify-center hover:bg-white/10 transition-all shrink-0 active:scale-95">
                                    <Phone size={24} />
                                </button>
                                <button className="flex-1 sm:px-8 py-4 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-xs sm:text-sm font-black uppercase tracking-widest border border-white/10 transition-all flex items-center justify-center gap-3 active:scale-95">
                                    <MessageCircle size={20} /> Chat With HR
                                </button>
                            </div>
                            <button
                                onClick={handleApplyClick}
                                className="px-10 py-4 bg-[#A855F7] hover:bg-[#9333EA] text-white rounded-2xl text-xs sm:text-sm font-black uppercase tracking-[0.2em] shadow-2xl shadow-purple-900/50 transition-all active:scale-95 italic"
                            >
                                Apply Now
                            </button>
                        </div>

                        <div className="flex items-center gap-4 bg-white/5 p-3 pr-5 rounded-2xl border border-white/5 self-start lg:self-end">
                            <div className="flex -space-x-3">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="w-9 h-9 rounded-full border-2 border-[#2D1B4E] bg-gray-300 overflow-hidden ring-2 ring-purple-500/20">
                                        <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="avatar" className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col">
                                <span className="text-[10px] text-purple-300 font-black uppercase tracking-tighter">Candidates Applied</span>
                                <span className="text-xs text-white font-black italic">90+ People Interested</span>
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
                        <SectionCard title="Skill Required">
                            <div className="flex flex-wrap gap-2">
                                {job.requirements.map(skill => (
                                    <span key={skill} className="px-4 py-1.5 bg-purple-50 text-purple-600 rounded-full text-xs font-bold border border-purple-100 flex items-center gap-2">
                                        <CheckCircle2 size={12} className="text-purple-500" /> {skill}
                                    </span>
                                ))}
                            </div>
                        </SectionCard>
                    ) : null}

                    {/* Job Description */}
                    <SectionCard title="Job Description">
                        <div className="space-y-6 text-sm text-gray-700 leading-relaxed font-medium">
                            <div className="whitespace-pre-wrap">{job.description}</div>

                            <p className="mt-8 font-bold text-gray-500 italic">Candidates Can Call HR For More Info.</p>
                        </div>
                    </SectionCard>

                    {/* Contact Person */}
                    <SectionCard title="Contact Person">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                                <User className="text-gray-400" />
                            </div>
                            <div>
                                <h4 className="font-black text-gray-900">{job.company} HR</h4>
                                <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Hiring Manager</p>
                            </div>
                        </div>
                    </SectionCard>
                </div>

                {/* Right Column (Sidebar) */}
                <aside className="w-full lg:w-96 space-y-8">
                    {/* Steps Card */}
                    <div className="bg-[#FFFDF2] border border-[#FDE68A] rounded-[2.5rem] p-8 sm:p-10 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-400/5 rounded-full blur-2xl -mr-16 -mt-16" />
                        
                        <h3 className="text-xl font-black text-gray-900 mb-10 leading-tight relative z-10">
                            Just <span className="text-[#A855F7]">3 Step</span><br/>To Get Your Dream Job
                        </h3>
                        <div className="space-y-0 relative z-10">
                            {/* Vertical Line */}
                            <div className="absolute left-6 top-8 bottom-8 w-px border-l-2 border-dashed border-purple-200" />

                            <StepItem number="01" title="Create Profile" desc="Complete Your KM Profile" />
                            <StepItem number="02" title="Fix Interview" desc="Connect with HR Directly" />
                            <StepItem number="03" title="Get Hired" desc="Start Your New Career" last />
                        </div>
                    </div>

                    {/* Just Like You Card */}
                    <div className="bg-white border border-gray-100 rounded-[2.5rem] p-8 sm:p-10 shadow-sm">
                        <h3 className="text-xl font-black text-gray-900 mb-10 leading-tight">
                            Just <span className="text-[#A855F7]">Like You</span>
                        </h3>
                        <div className="space-y-10">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="space-y-5 group/item">
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 bg-purple-900 rounded-2xl flex items-center justify-center text-white overflow-hidden shadow-lg shadow-purple-200 group-hover/item:scale-110 transition-transform">
                                            <img src={`https://i.pravatar.cc/100?img=${i + 20}`} alt="Person" className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-gray-900 text-sm">Professional Name</h4>
                                            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest">UI/UX Designer</p>
                                            <div className="flex items-center gap-1 text-[10px] text-[#A855F7] font-black mt-2 italic">
                                                <MapPin size={10} /> Bangalore, India
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button className="flex-1 py-3 border-2 border-purple-50 text-purple-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-50 hover:border-purple-100 transition-all flex items-center justify-center gap-2">
                                            <MessageCircle size={14} /> Chat
                                        </button>
                                        <button className="flex-1 py-3 bg-purple-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-purple-700 transition-all shadow-xl shadow-purple-100 flex items-center justify-center">
                                            Follow
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full mt-10 text-[#A855F7] font-black text-xs uppercase tracking-[0.2em] hover:underline underline-offset-8">Show All Members</button>
                    </div>

                    {/* Ad Banner Placeholder */}
                    <div className="bg-gray-50 border border-dashed border-gray-200 rounded-[32px] h-48 flex items-center justify-center">
                        <span className="text-gray-400 font-black uppercase tracking-widest text-sm">Ad Banner</span>
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
                            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm"
                        />
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white w-full max-w-xl rounded-[2rem] sm:rounded-[2.5rem] p-6 sm:p-10 relative z-10 shadow-2xl"
                        >
                            <button
                                onClick={() => setIsApplyModalOpen(false)}
                                className="absolute top-8 right-8 p-2 text-gray-400 hover:text-gray-900 transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            <div className="mb-10">
                                <span className="bg-purple-50 text-purple-600 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-4 inline-block italic">Send Application</span>
                                <h2 className="text-3xl font-black text-gray-900 leading-tight uppercase tracking-tighter italic">Roll Into Your New Job</h2>
                                <p className="text-gray-500 font-bold text-sm mt-2">Applying to <span className="text-purple-600">{job.title}</span> at {job.company}</p>
                            </div>

                            <div className="space-y-8">
                                <div className="space-y-3">
                                    <label className="text-[11px] font-black text-gray-400 uppercase tracking-widest">Cover Letter (Optional)</label>
                                    <textarea
                                        className="w-full bg-gray-50 border border-gray-100 rounded-3xl p-6 min-h-[160px] outline-none focus:ring-4 focus:ring-purple-100 transition-all font-bold text-gray-700 placeholder:text-gray-300"
                                        placeholder="Pitch yourself in a few sentences..."
                                        value={coverLetter}
                                        onChange={(e) => setCoverLetter(e.target.value)}
                                    />
                                </div>

                                <button
                                    onClick={submitApplication}
                                    disabled={isApplying}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-purple-200 transition-all flex items-center justify-center gap-2"
                                >
                                    {isApplying ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        "Confirm & Submit Application"
                                    )}
                                </button>

                                <p className="text-center text-[10px] text-gray-400 font-bold uppercase tracking-widest">By clicking submit, your profile details will be shared with the Hiring team.</p>
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
    <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${className}`}>
        {children || text}
    </span>
);

const HighlightItem = ({ text }: { text: string }) => (
    <div className="flex items-center gap-3 text-gray-600 font-bold text-sm">
        <CheckCircle2 size={16} className="text-gray-300 shrink-0" />
        {text}
    </div>
);

const FAQItem = ({ q, a }: { q: string, a: string }) => (
    <div className="space-y-2">
        <h5 className="font-black text-gray-900 text-sm leading-snug">{q}</h5>
        <p className="text-gray-500 text-sm italic">{a}</p>
    </div>
);

const StepItem = ({ number, title, desc, last }: { number: string, title: string, desc: string, last?: boolean }) => (
    <div className="flex gap-6 items-start pb-10 relative last:pb-0">
        <div className={`w-12 h-12 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center text-purple-600 text-xs font-black relative z-10 italic`}>
            {number}
        </div>
        <div>
            <h4 className="text-sm font-black text-[#A855F7] uppercase tracking-widest mb-1">{title}</h4>
            <p className="text-xs text-gray-400 font-bold">{desc}</p>
        </div>
    </div>
);

const SectionCard = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <div className="bg-white rounded-[2.5rem] p-6 sm:p-10 shadow-sm border border-gray-100 overflow-hidden group">
        <h3 className="text-base sm:text-lg font-black text-gray-900 mb-8 pb-4 border-b border-gray-50 uppercase tracking-widest flex items-center gap-3">
            <span className="w-1.5 h-6 bg-[#A855F7] rounded-full" />
            {title}
        </h3>
        {children}
    </div>
);

export default JobDetailPage;