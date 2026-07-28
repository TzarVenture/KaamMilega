'use client';
import {
    Camera, Pencil, Eye, BarChart2, Search,
    MessageCircle, Diamond, ChevronRight, Plus, Briefcase,
    GraduationCap, CheckCircle2
} from 'lucide-react';
import InterestsSection from './InterestSection';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useRouter } from 'next/navigation';
import EducationModal from './modals/EducationModal';
import ExperienceModal from './modals/ExperienceModal';
import SkillModal from './modals/SkillModal';
import EditIntroModal from './modals/EditIntroModal';
import EditAboutModal from './modals/EditAboutModal';
import ProfilePhotoModal from './modals/ProfilePhotoModal';
import AddBackgroundModal from './modals/AddBackgroundModal';
import EditContactInfoModal from './modals/EditContactInfoModal';
import CustomImage from '@/components/ui/CustomImage';
import Link from 'next/link';

const ProfilePage = () => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [modals, setModals] = useState({
        education: false,
        experience: false,
        skill: false,
        intro: false,
        about: false,
        photo: false,
        background: false,
        contact: false
    });
    const router = useRouter();

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/user/profile');
                setUser(response);
            } catch (error) {
                console.error("Failed to fetch profile:", error);
                // Optionally redirect to login if unauthorized, though layout handles this too
            } finally {
                setLoading(false);
            }
        };

        fetchProfile();
    }, []);

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
                    <h2 className="text-xl font-bold text-gray-700">Failed to load profile</h2>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-full hover:bg-purple-700"
                    >
                        Retry
                    </button>
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
                            <button
                                onClick={() => setModals({ ...modals, background: true })}
                                className="absolute top-4 right-4 bg-white p-2 rounded-full shadow-md hover:bg-gray-50 transition-colors"
                            >
                                <Camera size={20} className="text-purple-600" />
                            </button>
                        </div>

                        {/* Profile Info */}
                        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
                            <div className="relative flex justify-between items-end -mt-12 sm:-mt-16 mb-4">
                                <div
                                    onClick={() => setModals({ ...modals, photo: true })}
                                    className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-900 rounded-full border-4 border-white flex items-center justify-center overflow-hidden cursor-pointer group"
                                >
                                    {user?.profile_image ? (
                                        <CustomImage src={user?.profile_image} alt={user?.name} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-500 rotate-45"></div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setModals({ ...modals, intro: true })}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                                >
                                    <Pencil size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{user?.first_name ? `${user?.first_name} ${user?.last_name}` : user?.name || "User Name"}</h1>
                            <p className="text-gray-600 text-sm sm:text-base">{user?.headline || user?.designation || "Add a headline to your profile"}</p>
                            <p className="text-xs sm:text-sm text-gray-400 mt-1 flex flex-wrap gap-x-1 items-center">
                                <span>{locationString || "Location not set"}</span>
                                <span>•</span>
                                <button onClick={() => setModals({ ...modals, contact: true })} className="text-purple-600 font-medium hover:underline">Contact Info</button>
                                <span>•</span>
                                <span className="text-purple-600 font-medium">{user?.connections_count || 0} Connections</span>
                            </p>

                            <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3">
                                <button className="bg-purple-600 text-white px-4 sm:px-6 py-2 rounded-full font-medium text-sm hover:bg-purple-700">Open To</button>
                                <button className="border border-purple-600 text-purple-600 px-4 sm:px-6 py-2 rounded-full font-medium text-sm hover:bg-purple-50">Add Profile Section</button>
                                <button className="border border-gray-400 text-gray-600 px-4 sm:px-6 py-2 rounded-full font-medium text-sm hover:bg-gray-50">More</button>
                            </div>

                            {/* Status Cards */}
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-purple-50 rounded-lg border border-purple-100 relative">
                                    <Pencil size={14} className="absolute top-3 right-3 text-gray-400" />
                                    <p className="font-semibold text-sm">Open To Work</p>
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">Computer Science roles, Software Engineering Internships...</p>
                                    <button className="text-xs text-purple-600 font-bold mt-2">Read More</button>
                                </div>
                                <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 relative">
                                    <Pencil size={14} className="absolute top-3 right-3 text-gray-400" />
                                    <p className="font-semibold text-sm">Providing Services</p>
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-1">Web Development, Technical Writing, and Go Microservices...</p>
                                    <button className="text-xs text-purple-600 font-bold mt-2">Read More</button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Analytics Section */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                        <h2 className="text-xl font-bold mb-1">Analytics</h2>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mb-6">
                            <Eye size={12} /> Private To You
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                            <div className="flex gap-3">
                                <BarChart2 className="text-gray-600" />
                                <div>
                                    <p className="font-bold">{user.profile_views || 0} Profile Views</p>
                                    <p className="text-xs text-gray-500">Discover who's viewed your profile.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <BarChart2 className="text-gray-600" />
                                <div>
                                    <p className="font-bold">{user.post_impressions || 0} Post Impressions</p>
                                    <p className="text-xs text-gray-500">Check out who's engaging with your posts.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Search className="text-gray-600" />
                                <div>
                                    <p className="font-bold">{user.search_appearances || 0} Search Appearances</p>
                                    <p className="text-xs text-gray-500">How often you appear in search results.</p>
                                </div>
                            </div>
                        </div>
                    </div>


                    {/* About Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <button
                            onClick={() => setModals({ ...modals, about: true })}
                            className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors"
                        >
                            <Pencil size={18} className="text-gray-500" />
                        </button>
                        <h2 className="text-xl font-bold mb-4">About</h2>
                        <p className="text-gray-600 text-sm leading-relaxed mb-4">
                            {user.about || "Add a summary to highlight your personality and work history."}
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

                    {/* Jobs Based On Profile */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h2 className="text-xl font-bold mb-4">Jobs Based On Your Profile</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        <button className="w-full text-center text-purple-600 font-bold text-sm mt-6 hover:underline">See All Jobs</button>
                    </section>

                    {/* Experience Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Experience</h2>
                            <div className="flex gap-4">
                                <Plus
                                    size={22}
                                    className="text-gray-500 cursor-pointer hover:text-purple-600 transition-colors"
                                    onClick={() => setModals({ ...modals, experience: true })}
                                />
                                <Pencil size={18} className="text-gray-500 cursor-pointer" />
                            </div>
                        </div>

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
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold">Education</h2>
                            <div className="flex gap-4">
                                <Plus
                                    size={22}
                                    className="text-gray-500 cursor-pointer hover:text-purple-600 transition-colors"
                                    onClick={() => setModals({ ...modals, education: true })}
                                />
                                <Pencil size={18} className="text-gray-500 cursor-pointer" />
                            </div>
                        </div>

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
                            <div className="flex items-center gap-4">
                                <button className="text-purple-600 border border-purple-600 px-4 py-1 rounded-full text-sm font-bold hover:bg-purple-50">
                                    Test Skill
                                </button>
                                <Plus
                                    size={22}
                                    className="text-gray-500 cursor-pointer hover:text-purple-600 transition-colors"
                                    onClick={() => setModals({ ...modals, skill: true })}
                                />
                                <Pencil size={18} className="text-gray-500 cursor-pointer" />
                            </div>
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

                    <InterestsSection />
                </div>

                {/* RIGHT COLUMN - SIDEBAR (4 Units) */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Wallet Card */}
                    <div className="bg-[#2d1b36] rounded-xl p-6 text-white flex justify-between items-center shadow-lg">
                        <div>
                            <p className="text-sm opacity-80">Wallet Credits</p>
                            <p className="text-2xl font-bold">₹{user.wallet_balance || "0"}</p>
                        </div>
                        <button className="bg-purple-500/30 border border-purple-400 px-4 py-2 rounded-full text-sm font-semibold hover:bg-purple-500/50 transition">
                            ₹ Refill Wallet
                        </button>
                    </div>

                    {/* Settings List */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold">Profile Language</p>
                                <p className="text-sm text-gray-500">English</p>
                            </div>
                            <Pencil size={16} className="text-gray-400 cursor-pointer" />
                        </div>
                        <hr />
                        <div className="flex justify-between items-center">
                            <div className="w-full">
                                <p className="font-semibold">Public Profile & URL</p>
                                <p className="text-sm text-gray-500 truncate">www.kaammilega.com/in/{user.username || user.id}</p>
                            </div>
                            <Pencil size={16} className="text-gray-400 cursor-pointer" />
                        </div>
                    </div>

                    {/* People Who View Section */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200">
                        <h3 className="font-bold text-gray-900 mb-4 flex justify-between items-center">
                            People Who <span className="text-purple-600">View</span>
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

            <EducationModal
                isOpen={modals.education}
                onClose={() => setModals({ ...modals, education: false })}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <ExperienceModal
                isOpen={modals.experience}
                onClose={() => setModals({ ...modals, experience: false })}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <SkillModal
                isOpen={modals.skill}
                onClose={() => setModals({ ...modals, skill: false })}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <EditIntroModal
                isOpen={modals.intro}
                user={user}
                onClose={() => setModals({ ...modals, intro: false })}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <EditAboutModal
                isOpen={modals.about}
                user={user}
                onClose={() => setModals({ ...modals, about: false })}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <ProfilePhotoModal
                isOpen={modals.photo}
                imageUrl={user.profile_image}
                onClose={() => setModals({ ...modals, photo: false })}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <AddBackgroundModal
                isOpen={modals.background}
                onClose={() => setModals({ ...modals, background: false })}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <EditContactInfoModal
                isOpen={modals.contact}
                user={user}
                onClose={() => setModals({ ...modals, contact: false })}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
        </div>
    );
};

export default ProfilePage;