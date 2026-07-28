'use client';
import {
    Briefcase,
    GraduationCap, CheckCircle2,
    MessageCircle, ChevronRight, Diamond
} from 'lucide-react';
import InterestsSection from '../InterestSection'; // Verify path
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useParams } from 'next/navigation';
import CustomImage from '@/components/ui/CustomImage';
import Link from 'next/link';

const OtherUserProfilePage = () => {
    const params = useParams();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            if (!params.Id) return;
            try {
                // Fetching other user's profile by ID
                const response = await api.get(`/user/${params.Id}`);
                setUser(response);
            } catch (error) {
                console.error("Failed to fetch user profile:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, [params.Id]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-600"></div>
            </div>
        );
    }

    if (!user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <h2 className="text-xl font-bold text-gray-700">User not found</h2>
                    <p className="text-gray-500">The profile you are looking for does not exist or is private.</p>
                </div>
            </div>
        );
    }

    // Helper to format location
    const locationString = [user.city, user.state, user.country].filter(Boolean).join(', ');

    return (
        <div className="min-h-screen bg-gray-100 py-4">
            <div className="max-w-6xl mx-auto px-3 sm:px-4 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

                {/* LEFT COLUMN (8 Units) */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Header Card */}
                    <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">
                        {/* Banner */}
                        <div className="h-32 sm:h-48 bg-purple-200 relative group">
                            {user.cover_image ? (
                                <CustomImage src={user.cover_image} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                    <div className="w-24 h-24 bg-gray-400 rotate-45"></div>
                                </div>
                            )}
                        </div>

                        {/* Profile Info */}
                        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
                            <div className="relative flex justify-between items-end -mt-12 sm:-mt-16 mb-4">
                                <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-900 rounded-full border-4 border-white flex items-center justify-center overflow-hidden">
                                    {user?.profile_image ? (
                                        <CustomImage src={user?.profile_image} alt={user?.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-500 rotate-45"></div>
                                    )}
                                </div>
                                <div className="flex flex-wrap gap-2 mb-2">
                                    <button className="bg-purple-600 text-white px-4 sm:px-6 py-2 rounded-full font-medium text-sm hover:bg-purple-700 transition-colors">
                                        Connect
                                    </button>
                                    <button className="border border-gray-400 text-gray-600 px-4 sm:px-6 py-2 rounded-full font-medium text-sm hover:bg-gray-50 transition-colors">
                                        Message
                                    </button>
                                </div>
                            </div>

                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{user?.first_name ? `${user?.first_name} ${user?.last_name}` : user?.name || "User Name"}</h1>
                            <p className="text-gray-600 text-sm sm:text-base">{user?.headline || user?.designation || "No headline"}</p>
                            <p className="text-xs sm:text-sm text-gray-400 mt-1 flex flex-wrap gap-x-1 items-center">
                                <span>{locationString || "Location not set"}</span>
                                <span>•</span>
                                <span className="text-purple-600 font-medium">{user?.connections_count || 0} Connections</span>
                            </p>

                            {/* Status Cards (Optional for public view, keeping read-only state) */}
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 relative">
                                    <p className="font-semibold text-sm">Open To Work</p>
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">Computer Science roles, Software Engineering Internships...</p>
                                    <button className="text-xs text-purple-600 font-bold mt-2">Read More</button>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative">
                                    <p className="font-semibold text-sm">Providing Services</p>
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">Web Development, Technical Writing, and Go Microservices...</p>
                                    <button className="text-xs text-purple-600 font-bold mt-2">Read More</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* About Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <h2 className="text-xl font-bold mb-4">About</h2>
                        <p className="text-gray-600 text-sm leading-relaxed mb-4">
                            {user.about || "No summary provided."}
                        </p>
                        {user.top_skills && user.top_skills.length > 0 && (
                            <div className="bg-purple-50 p-4 rounded-lg border border-purple-100">
                                <div className="flex items-center gap-2 mb-2">
                                    <Diamond size={16} className="text-purple-600" />
                                    <span className="font-bold text-sm text-purple-900">Top Skills</span>
                                </div>
                                <div className="flex flex-wrap gap-2 text-xs text-purple-700">
                                    {user.top_skills.map((skill: string) => (
                                        <span key={skill} className="bg-white px-2 py-1 rounded border border-purple-200">• {skill}</span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Jobs Based On Profile (Generic or removed? Keeping generic as viewer might act on them) */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h2 className="text-xl font-bold mb-4">Similar Profiles</h2>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            {['Fintech', 'Internet', 'Fortune 500'].map((category) => (
                                <div key={category} className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 group cursor-pointer hover:border-purple-300 transition-colors">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="font-bold">{category}</h3>
                                        <ChevronRight size={18} className="text-gray-400 group-hover:text-purple-600" />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mb-3">1.4K+ Are Actively Hiring</p>
                                    <div className="flex -space-x-2">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className="w-8 h-8 rounded-full bg-white border border-gray-200 flex items-center justify-center">
                                                <div className="w-4 h-4 bg-gray-300 rotate-45" />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <button className="w-full text-center text-purple-600 font-bold text-sm mt-6 hover:underline">See All</button>
                    </section>

                    {/* Experience Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <h2 className="text-xl font-bold mb-6">Experience</h2>
                        <div className="space-y-8">
                            {user.experience && user.experience.length > 0 ? (
                                user.experience.map((exp: any, index: number) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="w-12 h-12 bg-gray-200 rounded flex items-center justify-center shrink-0">
                                            <Briefcase size={24} className="text-gray-400" />
                                        </div>
                                        <div className="space-y-2">
                                            <h3 className="font-bold text-gray-900">{exp.title}</h3>
                                            <p className="text-sm text-gray-600">{exp.company_name} • {exp.employment_type}</p>
                                            <p className="text-xs text-gray-400">{exp.start_date} - {exp.end_date || "Present"}</p>
                                            <p className="text-sm text-gray-500">
                                                {exp.description}
                                            </p>
                                            {exp.skills && (
                                                <div className="flex gap-2 text-xs font-semibold text-gray-600 mt-2">
                                                    <span>Skills:</span>
                                                    <span>{Array.isArray(exp.skills) ? exp.skills.join(" • ") : exp.skills}</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 italic">No experience added yet.</p>
                            )}
                        </div>
                    </section>

                    {/* Education Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <h2 className="text-xl font-bold mb-6">Education</h2>
                        <div className="space-y-6">
                            {user.education && user.education.length > 0 ? (
                                user.education.map((edu: any, index: number) => (
                                    <div key={index} className="flex gap-4">
                                        <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center shrink-0">
                                            <GraduationCap size={24} className="text-gray-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-gray-900 leading-tight">
                                                {edu.school_name}
                                            </h3>
                                            <p className="text-sm text-gray-600">{edu.degree} - {edu.field_of_study}</p>
                                            <p className="text-xs text-gray-400 mt-1 font-medium">{edu.start_date} - {edu.end_date || "Present"}</p>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 italic">No education details added yet.</p>
                            )}
                        </div>
                    </section>

                    {/* Skills Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Skills</h2>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            {user.skills && user.skills.length > 0 ? (
                                user.skills.map((skill: string) => (
                                    <div key={skill} className="flex items-center gap-2 px-4 py-1.5 bg-white border border-purple-200 rounded-full text-sm font-medium text-purple-700 shadow-sm">
                                        <CheckCircle2 size={14} className="text-purple-600" />
                                        {skill}
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 italic">No skills added yet.</p>
                            )}
                        </div>
                    </section>

                    {/* Interest Section (Read Only) */}
                    <InterestsSection />
                </div>

                {/* RIGHT COLUMN - SIDEBAR (4 Units) */}
                <div className="lg:col-span-4 space-y-6">

                    {/* People Also Viewed (Previously "People Who View") */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="font-bold text-gray-900 mb-4 flex justify-between items-center">
                            People Also <span className="text-purple-600">Viewed</span>
                        </h3>

                        <div className="space-y-6">
                            {[1, 2, 3].map((person) => (
                                <div key={person} className="flex flex-col gap-3">
                                    <div className="flex gap-3">
                                        <div className="w-12 h-12 bg-gray-900 rounded-full flex items-center justify-center shrink-0">
                                            <div className="w-4 h-4 bg-gray-500 rotate-45"></div>
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm">Arjun Sharma</p>
                                            <p className="text-xs text-gray-500">Software Engineer at TCS</p>
                                            <p className="text-[10px] text-gray-400">10 Mutual Connects</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Link href="/chat" className="flex-1">
                                            <button className="w-full border border-gray-300 rounded-full py-1 text-sm font-medium flex items-center justify-center gap-1 hover:bg-gray-50">
                                                <MessageCircle size={14} /> Chat
                                            </button>
                                        </Link>
                                        <button className="flex-1 bg-purple-600 text-white rounded-full py-1 text-sm font-medium hover:bg-purple-700">
                                            Follow
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Our Experts Widget */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-4">Our <span className="text-purple-600">Experts</span></h3>
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="flex flex-col gap-2">
                                    <div className="flex gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                                            <div className="w-3 h-3 bg-gray-500 rotate-45" />
                                        </div>
                                        <div>
                                            <p className="font-bold text-sm leading-none">Expert Name</p>
                                            <p className="text-[10px] text-gray-500 mt-1">GATE Preparation Mentor</p>
                                        </div>
                                    </div>
                                    <Link href="/chat">
                                        <button className="w-full py-1 border border-purple-600 text-purple-600 rounded-full text-xs font-bold hover:bg-purple-50 flex items-center justify-center gap-1">
                                            <MessageCircle size={12} /> Chat
                                        </button>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Companies Widget */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-4">Companies</h3>
                        <div className="space-y-4">
                            {[1, 2].map(i => (
                                <div key={i} className="flex gap-3 pb-4 border-b border-gray-100 last:border-0">
                                    <div className="w-10 h-10 bg-gray-800 rounded shrink-0 flex items-center justify-center text-white text-[8px]">
                                        LOGO
                                    </div>
                                    <div className="w-full">
                                        <p className="font-bold text-sm">Technova</p>
                                        <p className="text-[10px] text-gray-500">Software Solutions • IT Services</p>
                                        <button className="mt-2 w-full py-1 bg-purple-600 text-white rounded-full text-xs font-bold hover:bg-purple-700">
                                            Follow
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
};

export default OtherUserProfilePage;
