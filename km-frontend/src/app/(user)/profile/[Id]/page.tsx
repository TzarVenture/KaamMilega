'use client';

import {
    Briefcase,
    GraduationCap, CheckCircle2,
    MessageCircle, ChevronRight, Diamond, Lock,
    FolderGit2, ExternalLink, Globe, Building2
} from 'lucide-react';
import InterestsSection from '../InterestSection';
import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { useParams, useRouter } from 'next/navigation';
import CustomImage from '@/components/ui/CustomImage';
import Link from 'next/link';
import Head from 'next/head';
import { PageHeaderSkeleton, CardGridSkeleton } from '@/components/ui/LoadingSkeleton';
import TopEmployersWidget from '@/components/profile/TopEmployersWidget';
import UserAvatar from '@/components/ui/UserAvatar';

const OtherUserProfilePage = () => {
    const params = useParams();
    const router = useRouter();
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isPrivate, setIsPrivate] = useState(false);

    // Sidebar Live Data
    const [sidebarUsers, setSidebarUsers] = useState<any[]>([]);
    const [sidebarExperts, setSidebarExperts] = useState<any[]>([]);
    const [sidebarJobs, setSidebarJobs] = useState<any[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    const formatDisplayDate = (dateStr?: string) => {
        if (!dateStr) return '';
        if (dateStr.toLowerCase() === 'present') return 'Present';
        if (/^\d{4}-\d{2}/.test(dateStr)) {
            const [y, m] = dateStr.split('-');
            const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            const idx = parseInt(m, 10) - 1;
            return idx >= 0 && idx < 12 ? `${monthNames[idx]} ${y}` : dateStr;
        }
        return dateStr;
    };

    const handleConnect = async (targetId: string) => {
        try {
            setIsConnecting(true);
            await api.post('/network/connect', { receiver_id: targetId });
            setIsConnected(true);
        } catch (error: any) {
            console.error('Failed to send connection request:', error);
            alert(error.message || 'Could not send invitation.');
        } finally {
            setIsConnecting(false);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            if (!params.Id) return;
            try {
                const response = await api.get(`/user/${params.Id}`);
                setUser(response);
            } catch (error: any) {
                if (error?.response?.status === 403 || error?.status === 403) {
                    setIsPrivate(true);
                } else {
                    console.error("Failed to fetch user profile:", error);
                }
            } finally {
                setLoading(false);
            }
        };

        const fetchSidebarData = async () => {
            try {
                const [usersRes, expertsRes, jobsRes] = await Promise.allSettled([
                    api.get('/community/users').catch(() => []),
                    api.get('/experts').catch(() => []),
                    api.get('/jobs?limit=3').catch(() => ({ jobs: [] }))
                ]);

                if (usersRes.status === 'fulfilled') {
                    const uData = usersRes.value as any;
                    const uList = Array.isArray(uData) ? uData : uData.data || [];
                    const filtered = uList.filter((u: any) => (u.id || u._id) !== params.Id && u.username !== params.Id);
                    setSidebarUsers(filtered.slice(0, 4));
                }

                if (expertsRes.status === 'fulfilled') {
                    const eData = expertsRes.value as any;
                    const eList = Array.isArray(eData) ? eData : eData.data || [];
                    setSidebarExperts(eList.slice(0, 3));
                }

                if (jobsRes.status === 'fulfilled') {
                    const jData = (jobsRes.value as any)?.jobs || [];
                    setSidebarJobs(jData.slice(0, 3));
                }
            } catch (err) {
                console.error('Failed to fetch sidebar widgets:', err);
            }
        };

        fetchProfile();
        fetchSidebarData();
    }, [params.Id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-100 py-4">
                <div className="max-w-6xl mx-auto px-4 space-y-4">
                    <PageHeaderSkeleton />
                    <CardGridSkeleton count={3} />
                </div>
            </div>
        );
    }

    if (isPrivate) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="text-center max-w-sm mx-auto p-8 bg-white rounded-2xl shadow-sm border border-gray-200">
                    <div className="w-16 h-16 bg-blue-50 text-km-primary rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100">
                        <Lock size={28} className="text-km-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-gray-800 mb-2">This Profile is Private</h2>
                    <p className="text-gray-500 text-sm">This user has chosen to keep their profile private. Only they can view it.</p>
                </div>
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

    // SEO: respect search_engine_indexing preference
    const allowIndexing = user?.settings?.search_engine_indexing !== false;
    const locationString = [user.city, user.state, user.country].filter(Boolean).join(', ');
    const userId = user.id || user._id || params.Id;

    return (
        <>
            <Head>
                <meta
                    name="robots"
                    content={allowIndexing ? 'index,follow' : 'noindex,nofollow'}
                />
            </Head>
            <div className="min-h-screen bg-gray-100 py-4">
                <div className="max-w-6xl mx-auto px-3 sm:px-4 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

                    {/* LEFT COLUMN (8 Units) */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* Header Card */}
                        <div className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200">

                            {/* Banner */}
                            <div className="h-32 sm:h-48 bg-linear-to-r from-km-primary-dark via-km-primary to-blue-700 relative group">
                                {user.cover_image ? (
                                    <CustomImage src={user.cover_image} alt="Cover" className="w-full h-full object-cover" />
                                ) : (
                                    <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                        <div className="w-24 h-24 bg-white/20 rotate-45"></div>
                                    </div>
                                )}
                            </div>

                            {/* Profile Info */}
                            <div className="px-4 sm:px-8 pb-6 sm:pb-8">
                                <div className="relative flex justify-between items-end -mt-12 sm:-mt-16 mb-4">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-900 rounded-full border-4 border-white flex items-center justify-center overflow-hidden shadow-md">
                                        {user?.profile_image ? (
                                            <CustomImage src={user?.profile_image} alt={user?.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-12 h-12 bg-gray-500 rotate-45"></div>
                                        )}
                                    </div>
                                    <div className="flex flex-wrap gap-2 mb-2">
                                        <button
                                            onClick={() => handleConnect(userId)}
                                            disabled={isConnected || isConnecting}
                                            className="bg-km-primary text-white px-5 sm:px-6 py-2 rounded-xl font-bold text-sm hover:bg-km-primary-dark shadow-sm transition-colors cursor-pointer disabled:bg-emerald-600"
                                        >
                                            {isConnected ? 'Connected' : (isConnecting ? 'Connecting...' : 'Connect')}
                                        </button>
                                        <Link href={`/chat?userId=${userId}`}>
                                            <button className="border border-km-primary text-km-primary px-5 sm:px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors flex items-center gap-1.5 cursor-pointer">
                                                <MessageCircle size={15} /> Message
                                            </button>
                                        </Link>
                                    </div>
                                </div>

                                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                                    {user?.first_name ? `${user?.first_name} ${user?.last_name || ''}` : user?.name || "User Name"}
                                </h1>
                                <p className="text-gray-600 text-sm sm:text-base mt-0.5">
                                    {user?.headline || user?.designation || "No headline"}
                                </p>
                                <p className="text-xs sm:text-sm text-gray-400 mt-1 flex flex-wrap gap-x-2 items-center">
                                    <span>{locationString || "Location not set"}</span>
                                    <span>•</span>
                                    <span className="text-km-primary font-semibold">{user?.connections_count || 0} Connections</span>
                                </p>

                                {/* Portfolio / Website Link */}
                                {user?.portfolio_url && (
                                    <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm">
                                        <div className="inline-flex items-center gap-1.5 bg-blue-50/80 border border-blue-200/80 px-3 py-1 rounded-full">
                                            <Globe size={13} className="text-km-primary shrink-0" />
                                            <a
                                                href={user.portfolio_url.startsWith('http') ? user.portfolio_url : `https://${user.portfolio_url}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-km-primary hover:text-km-primary-dark font-bold hover:underline inline-flex items-center gap-1"
                                            >
                                                <span>{user?.portfolio_label || "Portfolio / Website"}</span>
                                                <ExternalLink size={12} />
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Dynamic Status Cards (LinkedIn Pattern) */}
                                {(user?.open_to_work?.is_open || user?.providing_services?.is_providing) && (
                                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {user?.open_to_work?.is_open && (
                                            <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-200/80 relative flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                            <p className="font-bold text-sm text-slate-900">Open to work</p>
                                                        </div>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-km-primary uppercase">
                                                            {user.open_to_work.visibility === 'recruiters' ? 'Recruiter verified' : 'All members'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-700 line-clamp-1 mt-1">
                                                        {user.open_to_work.job_titles?.length ? user.open_to_work.job_titles.join(', ') : 'Open to opportunities'}
                                                    </p>
                                                    <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                                                        {[
                                                            user.open_to_work.job_types?.join(', '),
                                                            user.open_to_work.locations?.join(', ')
                                                        ].filter(Boolean).join(' • ') || 'All work arrangements'}
                                                    </p>
                                                </div>
                                                <div className="mt-3 flex items-center justify-between pt-2 border-t border-blue-100">
                                                    <Link
                                                        href={`/chat?userId=${userId}`}
                                                        className="text-xs text-km-primary font-bold hover:underline inline-flex items-center gap-1"
                                                    >
                                                        <MessageCircle size={12} />
                                                        <span>Contact Candidate</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        )}

                                        {user?.providing_services?.is_providing && (
                                            <div className="p-4 bg-orange-50/60 rounded-2xl border border-orange-200/80 relative flex flex-col justify-between">
                                                <div>
                                                    <div className="flex items-center justify-between mb-1">
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="w-2 h-2 rounded-full bg-km-accent"></span>
                                                            <p className="font-bold text-sm text-slate-900">Providing services</p>
                                                        </div>
                                                        {user.providing_services.hourly_rate ? (
                                                            <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-orange-100 text-orange-900">
                                                                ₹{user.providing_services.hourly_rate} / hr
                                                            </span>
                                                        ) : null}
                                                    </div>
                                                    <p className="text-xs font-semibold text-slate-700 line-clamp-1 mt-1">
                                                        {user.providing_services.services?.length ? user.providing_services.services.join(', ') : 'Services offered'}
                                                    </p>
                                                    {user.providing_services.description ? (
                                                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-2">
                                                            {user.providing_services.description}
                                                        </p>
                                                    ) : null}
                                                </div>
                                                <div className="mt-3 flex items-center justify-between pt-2 border-t border-orange-100">
                                                    <Link
                                                        href={`/chat?userId=${userId}`}
                                                        className="text-xs text-km-accent font-bold hover:underline inline-flex items-center gap-1"
                                                    >
                                                        <MessageCircle size={12} />
                                                        <span>Request Service / Inquire</span>
                                                    </Link>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* About Section */}
                        <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                            <h2 className="text-xl font-bold mb-4 text-gray-900">About</h2>
                            <p className="text-gray-600 text-sm leading-relaxed mb-4 whitespace-pre-line">
                                {user.about || "No summary provided."}
                            </p>
                            {user.top_skills && user.top_skills.length > 0 && (
                                <div className="bg-blue-50/60 p-4 rounded-xl border border-blue-100">
                                    <div className="flex items-center gap-2 mb-2">
                                        <Diamond size={16} className="text-km-primary" />
                                        <span className="font-bold text-sm text-km-primary">Top Skills</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs text-slate-700">
                                        {user.top_skills.map((skill: string) => (
                                            <span key={skill} className="bg-white px-2.5 py-1 rounded-lg border border-blue-200 font-medium">
                                                • {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </section>

                        {/* Experience Section */}
                        <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                            <h2 className="text-xl font-bold mb-6 text-gray-900">Experience</h2>
                            <div className="space-y-6">
                                {user.experience && user.experience.length > 0 ? (
                                    user.experience.map((exp: any, index: number) => (
                                        <div key={exp.id || index} className="flex gap-4 p-3 rounded-xl hover:bg-gray-50/60 transition-colors">
                                            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0 text-km-primary">
                                                <Briefcase size={22} />
                                            </div>
                                            <div className="space-y-1">
                                                <h3 className="font-bold text-gray-900 text-base">{exp.title}</h3>
                                                <p className="text-xs text-gray-700 font-semibold">{exp.company_name} • {exp.employment_type}</p>
                                                <p className="text-xs text-gray-400">
                                                    {formatDisplayDate(exp.start_date)} – {formatDisplayDate(exp.end_date) || "Present"}
                                                    {exp.location ? ` • ${exp.location}` : ''}
                                                </p>
                                                {exp.description && (
                                                    <p className="text-sm text-gray-600 whitespace-pre-line mt-1">
                                                        {exp.description}
                                                    </p>
                                                )}
                                                {exp.skills && (
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {(Array.isArray(exp.skills) ? exp.skills : [exp.skills]).map((s: string, sIdx: number) => (
                                                            <span key={sIdx} className="px-2 py-0.5 bg-blue-50 text-km-primary border border-blue-200/80 rounded-full text-xs font-medium">
                                                                {s}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 italic text-sm">No experience details added yet.</p>
                                )}
                            </div>
                        </section>

                        {/* Education Section */}
                        <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                            <h2 className="text-xl font-bold mb-6 text-gray-900">Education</h2>
                            <div className="space-y-6">
                                {user.education && user.education.length > 0 ? (
                                    user.education.map((edu: any, index: number) => (
                                        <div key={edu.id || index} className="flex gap-4 p-3 rounded-xl hover:bg-gray-50/60 transition-colors">
                                            <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0 text-km-primary">
                                                <GraduationCap size={22} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-base leading-tight">
                                                    {edu.school_name}
                                                </h3>
                                                <p className="text-xs text-gray-700 font-semibold mt-0.5">{edu.degree} {edu.field_of_study ? `– ${edu.field_of_study}` : ''}</p>
                                                <p className="text-xs text-gray-400 mt-0.5">
                                                    {formatDisplayDate(edu.start_date)} – {formatDisplayDate(edu.end_date) || "Present"}
                                                    {edu.grade ? ` • Grade: ${edu.grade}` : ''}
                                                </p>
                                                {edu.description && (
                                                    <p className="text-sm text-gray-600 mt-1 whitespace-pre-line">{edu.description}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 italic text-sm">No education details added yet.</p>
                                )}
                            </div>
                        </section>

                        {/* Projects Section */}
                        {user.projects && user.projects.length > 0 && (
                            <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                                <h2 className="text-xl font-bold mb-6 text-gray-900">Projects</h2>
                                <div className="space-y-4">
                                    {user.projects.map((proj: any) => (
                                        <div
                                            key={proj.id}
                                            className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 transition-all flex flex-col gap-2 group"
                                        >
                                            <h3 className="font-bold text-gray-900 text-base leading-tight">
                                                {proj.title}
                                            </h3>
                                            {proj.associated_with && (
                                                <p className="text-xs text-gray-600 font-medium">
                                                    Associated with <span className="text-gray-800 font-semibold">{proj.associated_with}</span>
                                                </p>
                                            )}
                                            {(proj.start_date || proj.end_date || proj.is_current) && (
                                                <p className="text-xs text-gray-400">
                                                    {formatDisplayDate(proj.start_date)}
                                                    {proj.start_date && (proj.end_date || proj.is_current) ? ' – ' : ''}
                                                    {proj.is_current ? 'Present' : (formatDisplayDate(proj.end_date) || 'Present')}
                                                </p>
                                            )}
                                            {proj.description && (
                                                <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                                                    {proj.description}
                                                </p>
                                            )}
                                            {proj.skills && proj.skills.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {proj.skills.map((skill: string, sIdx: number) => (
                                                        <span
                                                            key={sIdx}
                                                            className="px-2.5 py-0.5 bg-blue-50 text-km-primary border border-blue-200/80 rounded-full text-xs font-medium"
                                                        >
                                                            {skill}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                            {proj.project_url && (
                                                <div className="pt-0.5">
                                                    <a
                                                        href={proj.project_url.startsWith('http') ? proj.project_url : `https://${proj.project_url}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1.5 text-xs font-bold text-km-primary hover:text-km-primary-dark hover:underline border border-blue-200 bg-white px-3 py-1.5 rounded-full shadow-2xs transition-all"
                                                    >
                                                        <span>Show Project</span>
                                                        <ExternalLink size={12} />
                                                    </a>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Skills Section */}
                        <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                            <h2 className="text-xl font-bold mb-6 text-gray-900">Skills</h2>
                            <div className="flex flex-wrap gap-2.5">
                                {user.skills && user.skills.length > 0 ? (
                                    user.skills.map((skill: string) => (
                                        <div
                                            key={skill}
                                            className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-bold text-km-primary shadow-xs"
                                        >
                                            <CheckCircle2 size={13} className="text-km-primary" />
                                            <span>{skill}</span>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 italic text-sm">No skills added yet.</p>
                                )}
                            </div>
                        </section>

                        {/* Interest Section */}
                        <InterestsSection />
                    </div>

                    {/* RIGHT COLUMN - SIDEBAR (4 Units) */}
                    <div className="lg:col-span-4 space-y-6">

                        {/* People Also Viewed (Live Community Users) */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <h3 className="font-bold text-gray-900 mb-4 flex justify-between items-center text-base">
                                <span>People Also <span className="text-km-primary">Viewed</span></span>
                                <Link href="/network" className="text-xs font-semibold text-km-primary hover:underline">
                                    See all
                                </Link>
                            </h3>

                            <div className="space-y-5">
                                {sidebarUsers.length > 0 ? (
                                    sidebarUsers.map((person: any, i: number) => {
                                        const pName = person.name || (person.first_name ? `${person.first_name} ${person.last_name || ''}` : 'Community Member');
                                        const pHeadline = person.headline || person.designation || 'Active Professional';
                                        const pId = person.id || person._id;

                                        return (
                                            <div key={pId || i} className="flex flex-col gap-2.5 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                                                <div className="flex gap-3 items-center">
                                                    <div className="w-11 h-11 bg-slate-100 rounded-full flex items-center justify-center overflow-hidden shrink-0 border border-slate-200">
                                                        <UserAvatar src={person.profile_image} name={pName} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-gray-900 truncate">{pName}</p>
                                                        <p className="text-xs text-gray-500 truncate">{pHeadline}</p>
                                                        <p className="text-[10px] text-gray-400 mt-0.5">Active recently</p>
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Link href={`/chat?userId=${pId}`} className="flex-1">
                                                        <button className="w-full border border-gray-300 rounded-xl py-1 text-xs font-semibold flex items-center justify-center gap-1 hover:bg-gray-50 transition-colors cursor-pointer">
                                                            <MessageCircle size={13} /> Chat
                                                        </button>
                                                    </Link>
                                                    <Link href={`/profile/${pId}`} className="flex-1">
                                                        <button className="w-full bg-km-primary text-white rounded-xl py-1 text-xs font-bold hover:bg-km-primary-dark transition-colors shadow-xs cursor-pointer">
                                                            View Profile
                                                        </button>
                                                    </Link>
                                                </div>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-xs text-gray-400 italic">No similar profiles found.</p>
                                )}
                            </div>
                        </div>

                        {/* Verified Experts */}
                        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-bold text-gray-900 text-base">
                                    Verified <span className="text-km-primary">Experts</span>
                                </h3>
                                <Link href="/network" className="text-xs font-semibold text-km-primary hover:underline">
                                    Explore
                                </Link>
                            </div>
                            <div className="space-y-4">
                                {sidebarExperts.length > 0 ? (
                                    sidebarExperts.map((exp: any, i: number) => {
                                        const eName = exp.name || (exp.first_name ? `${exp.first_name} ${exp.last_name || ''}` : 'Industry Expert');
                                        const eHeadline = exp.headline || exp.designation || exp.expertise || 'Career Specialist';
                                        const eId = exp.id || exp._id;

                                        return (
                                            <div key={eId || i} className="flex flex-col gap-2 pb-3 border-b border-gray-100 last:border-0 last:pb-0">
                                                <div className="flex gap-3 items-center">
                                                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                                                        <UserAvatar src={exp.profile_image} name={eName} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-bold text-sm text-gray-900 truncate leading-none">{eName}</p>
                                                        <p className="text-xs text-gray-500 truncate mt-1">{eHeadline}</p>
                                                    </div>
                                                </div>
                                                <Link href={`/chat?userId=${eId}`}>
                                                    <button className="w-full py-1.5 border border-km-primary text-km-primary rounded-xl text-xs font-bold hover:bg-blue-50 flex items-center justify-center gap-1 transition-colors cursor-pointer">
                                                        <MessageCircle size={13} /> Chat with Expert
                                                    </button>
                                                </Link>
                                            </div>
                                        );
                                    })
                                ) : (
                                    <p className="text-xs text-gray-400 italic">No experts currently available.</p>
                                )}
                            </div>
                        </div>

                        {/* Top Employers Widget */}
                        <TopEmployersWidget />

                    </div>
                </div>
            </div>
        </>
    );
};

export default OtherUserProfilePage;
