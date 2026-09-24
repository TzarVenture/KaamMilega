'use client';

import {
    Camera, Pencil, Eye, BarChart2, Search,
    MessageCircle, Diamond, ChevronRight, Plus, Briefcase,
    GraduationCap, CheckCircle2, FolderGit2, ExternalLink,
    Trash2, Globe, Copy, Check, X, UserPlus, Share2,
    ChevronDown, Wrench
} from 'lucide-react';
import InterestsSection from './InterestSection';
import { useEffect, useState, useRef } from 'react';
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
import EmailVerificationModal from './modals/EmailVerificationModal';
import ProjectModal from './modals/ProjectModal';
import PortfolioLinkModal from './modals/PortfolioLinkModal';
import RefillWalletModal from './modals/RefillWalletModal';
import { EditPublicUrlModal } from './modals/EditPublicUrlModal';
import { OpenToWorkModal } from './modals/OpenToWorkModal';
import { ProvidingServicesModal } from './modals/ProvidingServicesModal';
import CustomImage from '@/components/ui/CustomImage';
import Link from 'next/link';
import ProfileStrengthCard from './ProfileStrengthCard';
import TopEmployersWidget from '@/components/profile/TopEmployersWidget';
import UserAvatar from '@/components/ui/UserAvatar';

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
        contact: false,
        emailVerify: false,
        project: false,
        portfolioLink: false,
    });

    // Wallet states
    const [walletBalance, setWalletBalance] = useState<number>(0);
    const [isRefillModalOpen, setIsRefillModalOpen] = useState(false);
    const [isEditUrlModalOpen, setIsEditUrlModalOpen] = useState(false);

    // Edit states
    const [editingProject, setEditingProject] = useState<any | null>(null);
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
    const [editingExperience, setEditingExperience] = useState<any | null>(null);
    const [deletingExpId, setDeletingExpId] = useState<string | null>(null);
    const [editingEducation, setEditingEducation] = useState<any | null>(null);
    const [deletingEduId, setDeletingEduId] = useState<string | null>(null);
    const [deletingSkill, setDeletingSkill] = useState<string | null>(null);

    // Dropdowns & copy link
    const [showAddSectionMenu, setShowAddSectionMenu] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);
    const [showOpenToMenu, setShowOpenToMenu] = useState(false);
    const [isOpenToWorkModalOpen, setIsOpenToWorkModalOpen] = useState(false);
    const [isProvidingServicesModalOpen, setIsProvidingServicesModalOpen] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);

    // Sidebar Live Data
    const [sidebarUsers, setSidebarUsers] = useState<any[]>([]);
    const [sidebarExperts, setSidebarExperts] = useState<any[]>([]);
    const [sidebarJobs, setSidebarJobs] = useState<any[]>([]);
    const [connectedUserIds, setConnectedUserIds] = useState<string[]>([]);
    const [connectingUserId, setConnectingUserId] = useState<string | null>(null);

    const router = useRouter();
    const openToRef = useRef<HTMLDivElement>(null);
    const addSectionRef = useRef<HTMLDivElement>(null);
    const moreMenuRef = useRef<HTMLDivElement>(null);

    // Close menus on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (openToRef.current && !openToRef.current.contains(event.target as Node)) {
                setShowOpenToMenu(false);
            }
            if (addSectionRef.current && !addSectionRef.current.contains(event.target as Node)) {
                setShowAddSectionMenu(false);
            }
            if (moreMenuRef.current && !moreMenuRef.current.contains(event.target as Node)) {
                setShowMoreMenu(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

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

    // Experience CRUD handlers
    const handleAddExperience = () => {
        setEditingExperience(null);
        setModals((prev) => ({ ...prev, experience: true }));
    };

    const handleEditExperience = (exp: any) => {
        setEditingExperience(exp);
        setModals((prev) => ({ ...prev, experience: true }));
    };

    const handleDeleteExperience = async (expId: string) => {
        if (!confirm('Are you sure you want to remove this experience?')) return;
        try {
            setDeletingExpId(expId);
            const response = await api.delete(`/user/experience/${expId}`);
            setUser(response);
        } catch (error) {
            console.error('Failed to delete experience:', error);
            alert('Failed to delete experience. Please try again.');
        } finally {
            setDeletingExpId(null);
        }
    };

    // Education CRUD handlers
    const handleAddEducation = () => {
        setEditingEducation(null);
        setModals((prev) => ({ ...prev, education: true }));
    };

    const handleEditEducation = (edu: any) => {
        setEditingEducation(edu);
        setModals((prev) => ({ ...prev, education: true }));
    };

    const handleDeleteEducation = async (eduId: string) => {
        if (!confirm('Are you sure you want to remove this education record?')) return;
        try {
            setDeletingEduId(eduId);
            const response = await api.delete(`/user/education/${eduId}`);
            setUser(response);
        } catch (error) {
            console.error('Failed to delete education:', error);
            alert('Failed to delete education. Please try again.');
        } finally {
            setDeletingEduId(null);
        }
    };

    // Skill CRUD handlers
    const handleDeleteSkill = async (skillName: string) => {
        try {
            setDeletingSkill(skillName);
            const response = await api.delete(`/user/skill/${encodeURIComponent(skillName)}`);
            setUser(response);
        } catch (error) {
            console.error('Failed to remove skill:', error);
            alert('Failed to remove skill. Please try again.');
        } finally {
            setDeletingSkill(null);
        }
    };

    // Project CRUD handlers
    const handleAddProject = () => {
        setEditingProject(null);
        setModals((prev) => ({ ...prev, project: true }));
    };

    const handleEditProject = (proj: any) => {
        setEditingProject(proj);
        setModals((prev) => ({ ...prev, project: true }));
    };

    const handleDeleteProject = async (projectId: string) => {
        if (!confirm('Are you sure you want to delete this project?')) return;
        try {
            setDeletingProjectId(projectId);
            const response = await api.delete(`/user/project/${projectId}`);
            setUser(response);
        } catch (error) {
            console.error('Failed to delete project:', error);
            alert('Failed to delete project. Please try again.');
        } finally {
            setDeletingProjectId(null);
        }
    };

    // Copy public profile link
    const handleCopyProfileLink = () => {
        if (typeof window === 'undefined') return;
        const handle = user?.username || user?.id || user?._id || '';
        const publicUrl = `${window.location.origin}/profile/${handle}`;
        navigator.clipboard.writeText(publicUrl).then(() => {
            setCopiedLink(true);
            setTimeout(() => setCopiedLink(false), 2500);
        });
    };

    // Connect with user
    const handleConnectUser = async (targetId: string) => {
        try {
            setConnectingUserId(targetId);
            await api.post('/network/connect', { receiver_id: targetId });
            setConnectedUserIds((prev) => [...prev, targetId]);
        } catch (err: any) {
            console.error('Failed to send connection request:', err);
            alert(err.message || 'Could not send invitation.');
        } finally {
            setConnectingUserId(null);
        }
    };

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await api.get('/user/profile');
                setUser(response);
            } catch (error) {
                console.error('Failed to fetch profile:', error);
            } finally {
                setLoading(false);
            }
        };

        const fetchSidebarData = async () => {
            try {
                const [viewersRes, usersRes, expertsRes, jobsRes, walletRes] = await Promise.allSettled([
                    api.get('/user/viewers').catch(() => []),
                    api.get('/community/users').catch(() => []),
                    api.get('/experts').catch(() => []),
                    api.get('/jobs?limit=3').catch(() => ({ jobs: [] })),
                    api.get('/wallet/balance').catch(() => null)
                ]);

                if (walletRes.status === 'fulfilled' && walletRes.value) {
                    const wData = walletRes.value as any;
                    const bal = typeof wData.total_balance === 'number' ? wData.total_balance : (typeof wData.main_balance === 'number' ? wData.main_balance : 0);
                    setWalletBalance(bal);
                }

                const currentUserId = user?.id || user?._id;
                const currentUsername = user?.username;

                const rawViewers = (viewersRes.status === 'fulfilled' && Array.isArray(viewersRes.value)) ? viewersRes.value : [];
                const cleanViewers = rawViewers.filter((v: any) => {
                    const vid = v.id || v._id;
                    return vid && vid !== currentUserId && (!currentUsername || v.username !== currentUsername);
                });

                if (cleanViewers.length > 0) {
                    setSidebarUsers(cleanViewers.slice(0, 4));
                } else if (usersRes.status === 'fulfilled') {
                    const uData = usersRes.value as any;
                    const uList = Array.isArray(uData) ? uData : uData.data || [];
                    const filteredCommunity = uList.filter((u: any) => {
                        const uid = u.id || u._id;
                        return uid && uid !== currentUserId && (!currentUsername || u.username !== currentUsername);
                    });
                    setSidebarUsers(filteredCommunity.slice(0, 4));
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
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-100">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-km-primary"></div>
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
                        className="mt-4 px-6 py-2.5 bg-km-primary text-white font-bold rounded-xl hover:bg-km-primary-dark shadow-sm transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const locationString = [user.city, user.state, user.country].filter(Boolean).join(', ');
    const profileHandle = user.username || user.id || user._id || '';
    const publicProfileUrl = typeof window !== 'undefined' ? `${window.location.origin}/profile/${profileHandle}` : `/profile/${profileHandle}`;

    return (
        <div className="min-h-screen bg-gray-100 py-4">
            <div className="max-w-6xl mx-auto px-3 sm:px-4 grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-6">

                {/* LEFT COLUMN (8 Units) */}
                <div className="lg:col-span-8 space-y-6">

                    {/* Header Card */}
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 relative z-20">
                        {/* Banner */}
                        <div className="h-32 sm:h-48 rounded-t-xl overflow-hidden bg-linear-to-r from-km-primary-dark via-km-primary to-blue-700 relative group">
                            {user.cover_image ? (
                                <CustomImage src={user.cover_image} alt="Cover" className="w-full h-full object-cover" />
                            ) : (
                                <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                    <div className="w-24 h-24 bg-white/20 rotate-45"></div>
                                </div>
                            )}
                            <button
                                onClick={() => setModals((m) => ({ ...m, background: true }))}
                                className="absolute top-4 right-4 bg-white p-2 rounded-full shadow-md hover:bg-gray-50 transition-colors cursor-pointer"
                                title="Change background"
                            >
                                <Camera size={20} className="text-km-primary" />
                            </button>
                        </div>

                        {/* Profile Info */}
                        <div className="px-4 sm:px-8 pb-6 sm:pb-8">
                            <div className="relative flex justify-between items-end -mt-12 sm:-mt-16 mb-4">
                                <div
                                    onClick={() => setModals((m) => ({ ...m, photo: true }))}
                                    className="w-24 h-24 sm:w-32 sm:h-32 bg-gray-900 rounded-full border-4 border-white flex items-center justify-center overflow-hidden cursor-pointer group shadow-md"
                                    title="Update profile picture"
                                >
                                    {user?.profile_image ? (
                                        <CustomImage src={user?.profile_image} alt={user?.name} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                                    ) : (
                                        <div className="w-12 h-12 bg-gray-500 rotate-45"></div>
                                    )}
                                </div>
                                <button
                                    onClick={() => setModals((m) => ({ ...m, intro: true }))}
                                    className="p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                                    title="Edit Intro"
                                >
                                    <Pencil size={20} className="text-gray-500" />
                                </button>
                            </div>

                            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                                {user?.first_name ? `${user?.first_name} ${user?.last_name || ''}` : user?.name || "User Name"}
                            </h1>
                            <p className="text-gray-600 text-sm sm:text-base mt-0.5">
                                {user?.headline || user?.designation || "Add a headline to your profile"}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-400 mt-1 flex flex-wrap gap-x-2 items-center">
                                <span>{locationString || "Location not set"}</span>
                                <span>•</span>
                                <button onClick={() => setModals((m) => ({ ...m, contact: true }))} className="text-km-primary font-semibold hover:underline cursor-pointer">
                                    Contact Info
                                </button>
                                <span>•</span>
                                <span className="text-km-primary font-semibold">{user?.connections_count || 0} Connections</span>
                            </p>

                            {/* Portfolio / Website Link */}
                            <div className="mt-2 flex items-center gap-1.5 text-xs sm:text-sm">
                                {user?.portfolio_url ? (
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
                                        <button
                                            type="button"
                                            onClick={() => setModals((m) => ({ ...m, portfolioLink: true }))}
                                            title="Edit portfolio link"
                                            className="text-gray-400 hover:text-km-primary p-0.5 rounded transition cursor-pointer"
                                        >
                                            <Pencil size={11} />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setModals((m) => ({ ...m, portfolioLink: true }))}
                                        className="text-km-primary hover:text-km-primary-dark font-semibold hover:underline inline-flex items-center gap-1 text-xs cursor-pointer py-0.5"
                                    >
                                        <Globe size={13} />
                                        <span>+ Add Portfolio / Website Link</span>
                                    </button>
                                )}
                            </div>

                            {/* Email Verification Status Badge */}
                            <div className="mt-3 inline-flex items-center gap-2">
                                {user?.is_email_verified ? (
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-full text-xs font-bold">
                                        <CheckCircle2 size={14} className="text-emerald-600" /> Email Verified: {user?.email}
                                    </span>
                                ) : (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 border border-amber-200 text-amber-800 rounded-full text-xs font-semibold">
                                        <span>Email Unverified ({user?.email || "No email added"})</span>
                                        <button
                                            onClick={() => setModals((m) => ({ ...m, emailVerify: true }))}
                                            className="px-2.5 py-0.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-full text-[11px] transition-all cursor-pointer"
                                        >
                                            Verify Email Now
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons with Dropdowns */}
                            <div className="mt-4 sm:mt-6 flex flex-wrap gap-2 sm:gap-3 items-center">
                                {/* Open To Dropdown */}
                                <div className="relative" ref={openToRef}>
                                    <button
                                        onClick={() => setShowOpenToMenu(!showOpenToMenu)}
                                        className="bg-km-primary text-white px-5 sm:px-6 py-2 rounded-xl font-bold text-sm hover:bg-km-primary-dark shadow-sm transition-colors cursor-pointer inline-flex items-center gap-1.5"
                                    >
                                        <span>Open To</span>
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${showOpenToMenu ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showOpenToMenu && (
                                        <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-2 divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-150">
                                            <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                Career & Service Status
                                            </div>
                                            <div className="py-1">
                                                <button
                                                    onClick={() => {
                                                        setIsOpenToWorkModalOpen(true);
                                                        setShowOpenToMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-km-primary flex items-start gap-3 transition-colors cursor-pointer group"
                                                >
                                                    <div className="w-8 h-8 rounded-xl bg-blue-50 text-km-primary flex items-center justify-center shrink-0 mt-0.5">
                                                        <Briefcase size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <p className="font-bold text-gray-900 group-hover:text-km-primary">Finding a new job</p>
                                                            {user?.open_to_work?.is_open && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">Active</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 font-normal mt-0.5">Show recruiters you are open to work</p>
                                                    </div>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setIsProvidingServicesModalOpen(true);
                                                        setShowOpenToMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-3 text-xs font-semibold text-gray-700 hover:bg-orange-50 hover:text-orange-900 flex items-start gap-3 transition-colors cursor-pointer group"
                                                >
                                                    <div className="w-8 h-8 rounded-xl bg-orange-50 text-km-accent flex items-center justify-center shrink-0 mt-0.5">
                                                        <Wrench size={16} />
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between">
                                                            <p className="font-bold text-gray-900 group-hover:text-orange-900">Providing services</p>
                                                            {user?.providing_services?.is_providing && (
                                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800">Active</span>
                                                            )}
                                                        </div>
                                                        <p className="text-[11px] text-gray-500 font-normal mt-0.5">Showcase direct trades and services you offer</p>
                                                    </div>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Add Profile Section Dropdown */}
                                <div className="relative" ref={addSectionRef}>
                                    <button
                                        onClick={() => setShowAddSectionMenu(!showAddSectionMenu)}
                                        className="border border-km-primary text-km-primary px-5 sm:px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-50 transition-colors cursor-pointer inline-flex items-center gap-1"
                                    >
                                        <span>Add Profile Section</span>
                                        <Plus size={15} />
                                    </button>

                                    {showAddSectionMenu && (
                                        <div className="absolute left-0 mt-2 w-72 sm:w-80 bg-white border border-gray-200 rounded-2xl shadow-2xl z-50 py-2 divide-y divide-gray-100 animate-in fade-in slide-in-from-top-2 duration-150">
                                            <div className="px-4 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                                Add / Update Profile Details
                                            </div>
                                            <div className="py-1">
                                                <button
                                                    onClick={() => {
                                                        handleAddExperience();
                                                        setShowAddSectionMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-km-primary flex items-center justify-between transition-colors cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-km-primary flex items-center justify-center shrink-0">
                                                            <Briefcase size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 group-hover:text-km-primary">Work Experience</p>
                                                            <p className="text-[11px] text-gray-400 font-normal">Add new position or role</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-km-primary">
                                                        {user?.experience?.length || 0} added
                                                    </span>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        handleAddEducation();
                                                        setShowAddSectionMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-km-primary flex items-center justify-between transition-colors cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-km-primary flex items-center justify-center shrink-0">
                                                            <GraduationCap size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 group-hover:text-km-primary">Education</p>
                                                            <p className="text-[11px] text-gray-400 font-normal">Add school, degree or field</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-km-primary">
                                                        {user?.education?.length || 0} added
                                                    </span>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setModals((m) => ({ ...m, skill: true }));
                                                        setShowAddSectionMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-km-primary flex items-center justify-between transition-colors cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-km-primary flex items-center justify-center shrink-0">
                                                            <CheckCircle2 size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 group-hover:text-km-primary">Skills</p>
                                                            <p className="text-[11px] text-gray-400 font-normal">Highlight your capabilities</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-km-primary">
                                                        {user?.skills?.length || 0} added
                                                    </span>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        handleAddProject();
                                                        setShowAddSectionMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-km-primary flex items-center justify-between transition-colors cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-km-primary flex items-center justify-center shrink-0">
                                                            <FolderGit2 size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 group-hover:text-km-primary">Projects</p>
                                                            <p className="text-[11px] text-gray-400 font-normal">Showcase practical assignments</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-km-primary">
                                                        {user?.projects?.length || 0} added
                                                    </span>
                                                </button>
                                            </div>

                                            <div className="py-1">
                                                <button
                                                    onClick={() => {
                                                        setModals((m) => ({ ...m, about: true }));
                                                        setShowAddSectionMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-km-primary flex items-center justify-between transition-colors cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-km-primary flex items-center justify-center shrink-0">
                                                            <Pencil size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 group-hover:text-km-primary">About Summary</p>
                                                            <p className="text-[11px] text-gray-400 font-normal">Brief summary for recruiters</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-km-primary">
                                                        {user?.about ? 'Configured' : 'Add'}
                                                    </span>
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setModals((m) => ({ ...m, portfolioLink: true }));
                                                        setShowAddSectionMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-blue-50 hover:text-km-primary flex items-center justify-between transition-colors cursor-pointer group"
                                                >
                                                    <div className="flex items-center gap-2.5">
                                                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-km-primary flex items-center justify-center shrink-0">
                                                            <Globe size={14} />
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-gray-900 group-hover:text-km-primary">Portfolio Link</p>
                                                            <p className="text-[11px] text-gray-400 font-normal">Add GitHub, site or Behance</p>
                                                        </div>
                                                    </div>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 group-hover:bg-blue-100 group-hover:text-km-primary">
                                                        {user?.portfolio_url ? 'Linked' : 'Add'}
                                                    </span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* More Dropdown */}
                                <div className="relative" ref={moreMenuRef}>
                                    <button
                                        onClick={() => setShowMoreMenu(!showMoreMenu)}
                                        className="border border-gray-300 text-gray-700 px-5 sm:px-6 py-2 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors cursor-pointer"
                                    >
                                        More
                                    </button>

                                    {showMoreMenu && (
                                        <div className="absolute left-0 mt-2 w-52 bg-white border border-gray-200 rounded-xl shadow-lg z-30 py-2 divide-y divide-gray-100 animate-in fade-in slide-in-from-top-1 duration-150">
                                            <div className="py-1">
                                                <button
                                                    onClick={() => {
                                                        handleCopyProfileLink();
                                                        setShowMoreMenu(false);
                                                    }}
                                                    className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-km-primary flex items-center gap-2 transition-colors cursor-pointer"
                                                >
                                                    <Copy size={14} /> Copy Profile Link
                                                </button>
                                                <Link
                                                    href={`/profile/${user.username || user.id || user._id}`}
                                                    onClick={() => setShowMoreMenu(false)}
                                                    className="w-full text-left px-4 py-2 text-xs font-bold text-gray-700 hover:bg-blue-50 hover:text-km-primary flex items-center gap-2 transition-colors"
                                                >
                                                    <ExternalLink size={14} /> View Public Profile
                                                </Link>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {copiedLink && (
                                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-full flex items-center gap-1 animate-in fade-in">
                                        <Check size={14} /> Link Copied!
                                    </span>
                                )}
                            </div>

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
                                                        {user.open_to_work.visibility === 'recruiters' ? 'Recruiters only' : 'All members'}
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
                                                <button
                                                    onClick={() => setIsOpenToWorkModalOpen(true)}
                                                    className="text-xs text-km-primary font-bold hover:underline cursor-pointer flex items-center gap-1"
                                                >
                                                    <Pencil size={12} />
                                                    <span>Update Preferences</span>
                                                </button>
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
                                                <button
                                                    onClick={() => setIsProvidingServicesModalOpen(true)}
                                                    className="text-xs text-km-accent font-bold hover:underline cursor-pointer flex items-center gap-1"
                                                >
                                                    <Pencil size={12} />
                                                    <span>Update Details</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Profile Completeness Strength Card */}
                    <ProfileStrengthCard
                        user={user}
                        onOpenModal={(modalKey) => setModals((prev) => ({ ...prev, [modalKey]: true }))}
                    />

                    {/* Analytics Section */}
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200">
                        <h2 className="text-xl font-bold mb-1 text-gray-900">Analytics</h2>
                        <p className="text-xs text-gray-400 flex items-center gap-1 mb-6">
                            <Eye size={12} /> Private To You
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                            <div className="flex gap-3">
                                <BarChart2 className="text-km-primary" />
                                <div>
                                    <p className="font-bold text-gray-900">{(user?.profile_views ?? 0)} Profile Views</p>
                                    <p className="text-xs text-gray-500">Discover who viewed your profile.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <BarChart2 className="text-km-primary" />
                                <div>
                                    <p className="font-bold text-gray-900">{(user?.post_impressions ?? 0)} Post Impressions</p>
                                    <p className="text-xs text-gray-500">Check engagement on your discussions.</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Search className="text-km-primary" />
                                <div>
                                    <p className="font-bold text-gray-900">{(user?.search_appearances ?? 0)} Search Appearances</p>
                                    <p className="text-xs text-gray-500">How often you appear in recruiter search.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* About Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <button
                            onClick={() => setModals((m) => ({ ...m, about: true }))}
                            className="absolute top-6 right-6 p-2 hover:bg-gray-100 rounded-full transition-colors cursor-pointer"
                            title="Edit summary"
                        >
                            <Pencil size={18} className="text-gray-500" />
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-gray-900">About</h2>
                        <p className="text-gray-600 text-sm leading-relaxed mb-4 whitespace-pre-line">
                            {user.about || "Add a summary to highlight your personality and work history."}
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

                    {/* Jobs Based On Profile */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Jobs Based On Your Profile</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Recommended roles matching your skills and domain</p>
                            </div>
                            <Link href="/jobs" className="text-xs font-bold text-km-primary hover:underline">
                                View All
                            </Link>
                        </div>

                        {sidebarJobs.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {sidebarJobs.map((job: any) => (
                                    <Link
                                        key={job.id || job._id}
                                        href={`/jobs/${job.id || job._id}`}
                                        className="p-4 border border-gray-100 rounded-xl bg-gray-50/50 group cursor-pointer hover:border-km-primary hover:bg-white transition-all flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex justify-between items-start mb-2">
                                                <h3 className="font-bold text-sm text-gray-900 line-clamp-1 group-hover:text-km-primary transition-colors">
                                                    {job.title}
                                                </h3>
                                                <ChevronRight size={16} className="text-gray-400 group-hover:text-km-primary shrink-0" />
                                            </div>
                                            <p className="text-xs font-medium text-gray-700 mb-1">{job.company || job.company_name || 'Verified Recruiter'}</p>
                                            <p className="text-[11px] text-gray-400 mb-3">{job.city_name || job.location || 'Pan India'}</p>
                                        </div>
                                        <span className="text-[11px] font-bold text-km-primary">
                                            {job.salary_range || 'Competitive'}
                                        </span>
                                    </Link>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-gray-400 text-sm">
                                Check back soon for tailored job recommendations.
                            </div>
                        )}
                    </section>

                    {/* Experience Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Experience</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Your career trajectory and roles</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddExperience}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-km-primary bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200 transition-colors cursor-pointer"
                                title="Add Experience"
                            >
                                <Plus size={15} className="text-km-primary shrink-0" />
                                <span>Add Experience</span>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {user.experience && user.experience.length > 0 ? (
                                user.experience.map((exp: any, index: number) => (
                                    <div
                                        key={exp.id || index}
                                        className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 hover:border-gray-200 transition-all flex flex-col gap-2.5 group relative"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex gap-3">
                                                <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0 text-km-primary">
                                                    <Briefcase size={22} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-base leading-tight">
                                                        {exp.title}
                                                    </h3>
                                                    <p className="text-xs text-gray-700 font-semibold mt-0.5">
                                                        {exp.company_name} {exp.employment_type ? `• ${exp.employment_type}` : ''}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {formatDisplayDate(exp.start_date)} – {formatDisplayDate(exp.end_date) || "Present"}
                                                        {exp.location ? ` • ${exp.location}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditExperience(exp)}
                                                    title="Edit experience"
                                                    className="p-1.5 text-gray-400 hover:text-km-primary hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteExperience(exp.id)}
                                                    disabled={deletingExpId === exp.id}
                                                    title="Delete experience"
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>

                                        {exp.description && (
                                            <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed pl-15">
                                                {exp.description}
                                            </p>
                                        )}

                                        {exp.skills && (
                                            <div className="flex flex-wrap gap-1.5 pl-15">
                                                {(Array.isArray(exp.skills) ? exp.skills : [exp.skills]).map((s: string, sIdx: number) => (
                                                    <span
                                                        key={sIdx}
                                                        className="px-2.5 py-0.5 bg-blue-50 text-km-primary border border-blue-200/80 rounded-full text-xs font-medium"
                                                    >
                                                        {s}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 px-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                    <h4 className="text-sm font-bold text-gray-800 mb-1">Add your career experience</h4>
                                    <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                                        Members who detail their work history receive more profile views and interview invites.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleAddExperience}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-full text-xs font-bold transition-colors shadow-sm cursor-pointer"
                                    >
                                        <Plus size={15} /> Add Experience
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Education Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Education</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Degrees, schools, and credentials</p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddEducation}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-km-primary bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200 transition-colors cursor-pointer"
                                title="Add Education"
                            >
                                <Plus size={15} className="text-km-primary shrink-0" />
                                <span>Add Education</span>
                            </button>
                        </div>

                        <div className="space-y-6">
                            {user.education && user.education.length > 0 ? (
                                user.education.map((edu: any, index: number) => (
                                    <div
                                        key={edu.id || index}
                                        className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 hover:border-gray-200 transition-all flex flex-col gap-2 group relative"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex gap-3">
                                                <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center shrink-0 text-km-primary">
                                                    <GraduationCap size={22} />
                                                </div>
                                                <div>
                                                    <h3 className="font-bold text-gray-900 text-base leading-tight">
                                                        {edu.school_name}
                                                    </h3>
                                                    <p className="text-xs text-gray-700 font-semibold mt-0.5">
                                                        {edu.degree} {edu.field_of_study ? `– ${edu.field_of_study}` : ''}
                                                    </p>
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {formatDisplayDate(edu.start_date)} – {formatDisplayDate(edu.end_date) || "Present"}
                                                        {edu.grade ? ` • Grade: ${edu.grade}` : ''}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Action buttons */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditEducation(edu)}
                                                    title="Edit education"
                                                    className="p-1.5 text-gray-400 hover:text-km-primary hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteEducation(edu.id)}
                                                    disabled={deletingEduId === edu.id}
                                                    title="Delete education"
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>

                                        {edu.description && (
                                            <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed pl-15">
                                                {edu.description}
                                            </p>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 px-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                    <h4 className="text-sm font-bold text-gray-800 mb-1">Add your education history</h4>
                                    <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                                        Highlight your degrees, institutions, and academic achievements.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleAddEducation}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-full text-xs font-bold transition-colors shadow-sm cursor-pointer"
                                    >
                                        <Plus size={15} /> Add Education
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Projects Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <div className="flex justify-between items-center gap-3 mb-6">
                            <div className="min-w-0 flex-1">
                                <h2 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight">Projects</h2>
                                <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 sm:line-clamp-none">
                                    Showcase your practical work, assignments, or client projects
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={handleAddProject}
                                className="shrink-0 whitespace-nowrap inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-km-primary bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200 transition-colors cursor-pointer"
                                title="Add Project"
                            >
                                <Plus size={15} className="text-km-primary shrink-0" />
                                <span>Add Project</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {user.projects && user.projects.length > 0 ? (
                                user.projects.map((proj: any) => (
                                    <div
                                        key={proj.id}
                                        className="p-4 rounded-xl border border-gray-100 bg-gray-50/40 hover:bg-gray-50 hover:border-gray-200 transition-all flex flex-col gap-2.5 group relative"
                                    >
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                <h3 className="font-bold text-gray-900 text-base leading-tight">
                                                    {proj.title}
                                                </h3>
                                                {proj.associated_with && (
                                                    <p className="text-xs text-gray-600 mt-0.5 font-medium">
                                                        Associated with <span className="text-gray-800 font-semibold">{proj.associated_with}</span>
                                                    </p>
                                                )}
                                                {(proj.start_date || proj.end_date || proj.is_current) && (
                                                    <p className="text-xs text-gray-400 mt-0.5">
                                                        {formatDisplayDate(proj.start_date)}
                                                        {proj.start_date && (proj.end_date || proj.is_current) ? ' – ' : ''}
                                                        {proj.is_current ? 'Present' : (formatDisplayDate(proj.end_date) || 'Present')}
                                                    </p>
                                                )}
                                            </div>

                                            {/* Edit & Delete Actions */}
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button
                                                    type="button"
                                                    onClick={() => handleEditProject(proj)}
                                                    title="Edit project"
                                                    className="p-1.5 text-gray-400 hover:text-km-primary hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                                >
                                                    <Pencil size={15} />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeleteProject(proj.id)}
                                                    disabled={deletingProjectId === proj.id}
                                                    title="Delete project"
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            </div>
                                        </div>

                                        {proj.description && (
                                            <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">
                                                {proj.description}
                                            </p>
                                        )}

                                        {/* Project Skills */}
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

                                        {/* External Link */}
                                        {proj.project_url && (
                                            <div className="pt-0.5">
                                                <a
                                                    href={proj.project_url.startsWith('http') ? proj.project_url : `https://${proj.project_url}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-km-primary hover:text-km-primary-dark hover:underline border border-blue-200 bg-white px-3 py-1.5 rounded-full shadow-2xs hover:shadow-xs transition-all"
                                                >
                                                    <span>Show Project</span>
                                                    <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        )}
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-8 px-4 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                                    <h4 className="text-sm font-bold text-gray-800 mb-1">Showcase your projects and assignments</h4>
                                    <p className="text-xs text-gray-500 max-w-sm mx-auto mb-4">
                                        Candidates who add projects, practical tasks, or work samples are more likely to be contacted by recruiters.
                                    </p>
                                    <button
                                        type="button"
                                        onClick={handleAddProject}
                                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-km-primary hover:bg-km-primary-dark text-white rounded-full text-xs font-bold transition-colors shadow-sm cursor-pointer"
                                    >
                                        <Plus size={15} /> Add Your First Project
                                    </button>
                                </div>
                            )}
                        </div>
                    </section>

                    {/* Skills Section */}
                    <section className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm relative">
                        <div className="flex justify-between items-center mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">Skills</h2>
                                <p className="text-xs text-gray-400 mt-0.5">Highlight your technical and soft competencies</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setModals((m) => ({ ...m, skill: true }))}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-km-primary bg-blue-50 hover:bg-blue-100 rounded-full border border-blue-200 transition-colors cursor-pointer"
                                >
                                    <Plus size={15} /> Add Skill
                                </button>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-2.5">
                            {user.skills && user.skills.length > 0 ? (
                                user.skills.map((skill: string) => (
                                    <div
                                        key={skill}
                                        className="group inline-flex items-center gap-2 px-3.5 py-1.5 bg-blue-50/60 border border-blue-200 rounded-xl text-xs font-bold text-km-primary shadow-xs hover:border-blue-300 transition-colors"
                                    >
                                        <CheckCircle2 size={13} className="text-km-primary shrink-0" />
                                        <span>{skill}</span>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSkill(skill)}
                                            disabled={deletingSkill === skill}
                                            title={`Remove ${skill}`}
                                            className="text-gray-400 hover:text-red-600 transition-colors p-0.5 rounded cursor-pointer disabled:opacity-50"
                                        >
                                            <X size={13} />
                                        </button>
                                    </div>
                                ))
                            ) : (
                                <p className="text-gray-500 italic text-sm">No skills added yet.</p>
                            )}
                        </div>
                    </section>

                    {/* Interests Section */}
                    <InterestsSection />
                </div>

                {/* RIGHT COLUMN - SIDEBAR (4 Units) */}
                <div className="lg:col-span-4 space-y-6">

                    {/* Wallet Card */}
                    <div className="bg-linear-to-br from-km-primary-dark via-[#0D1B5E] to-slate-900 rounded-xl p-5 sm:p-6 text-white flex justify-between items-center shadow-lg border border-blue-900/40">
                        <div>
                            <p className="text-xs font-medium text-blue-200">Wallet Balance</p>
                            <p className="text-2xl sm:text-3xl font-black mt-1">₹{walletBalance.toFixed(2)}</p>
                            <Link href="/wallet" className="text-xs text-blue-300 hover:text-white underline mt-1 inline-block">
                                View transactions ↗
                            </Link>
                        </div>
                        <button
                            type="button"
                            onClick={() => setIsRefillModalOpen(true)}
                            className="bg-km-accent hover:bg-orange-600 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-all cursor-pointer active:scale-95"
                        >
                            Refill
                        </button>
                    </div>

                    {/* Settings / Public Profile Card */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 space-y-4">
                        <div className="flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-sm text-gray-900">Profile Language</p>
                                <p className="text-xs text-gray-500">English (India)</p>
                            </div>
                        </div>
                        <hr className="border-gray-100" />
                        <div className="flex justify-between items-center gap-3">
                            <div className="min-w-0 flex-1">
                                <p className="font-semibold text-sm text-gray-900">Public Profile & URL</p>
                                <p className="text-xs text-gray-500 truncate mt-0.5" title={publicProfileUrl}>
                                    {publicProfileUrl}
                                </p>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                    onClick={handleCopyProfileLink}
                                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-km-primary transition-colors cursor-pointer"
                                    title="Copy public profile link"
                                    aria-label="Copy public profile link"
                                >
                                    {copiedLink ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} />}
                                </button>
                                <button
                                    onClick={() => setIsEditUrlModalOpen(true)}
                                    className="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-km-primary transition-colors cursor-pointer"
                                    title="Edit custom URL"
                                    aria-label="Edit custom URL"
                                >
                                    <Pencil size={16} />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* People Who Viewed Section (Live Community Users) */}
                    <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
                        <h3 className="font-bold text-gray-900 mb-4 flex justify-between items-center text-base">
                            <span>People Who <span className="text-km-primary">Viewed</span></span>
                            <Link href="/network" className="text-xs font-semibold text-km-primary hover:underline">
                                See all
                            </Link>
                        </h3>

                        <div className="space-y-5">
                            {sidebarUsers.length > 0 ? (
                                sidebarUsers.map((person: any, i: number) => {
                                    const pName = person.name || (person.first_name ? `${person.first_name} ${person.last_name || ''}` : 'Platform Member');
                                    const pHeadline = person.headline || person.designation || 'Active Professional';
                                    const pId = person.id || person._id;
                                    const isConnected = connectedUserIds.includes(pId);
                                    const isConnecting = connectingUserId === pId;

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
                                                <button
                                                    onClick={() => handleConnectUser(pId)}
                                                    disabled={isConnected || isConnecting}
                                                    className="flex-1 bg-km-primary text-white rounded-xl py-1 text-xs font-bold hover:bg-km-primary-dark transition-colors shadow-xs disabled:bg-emerald-600 disabled:opacity-80 cursor-pointer"
                                                >
                                                    {isConnected ? 'Connected' : (isConnecting ? 'Connecting...' : 'Connect')}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                                <p className="text-xs text-gray-400 italic">No recent profile viewers.</p>
                            )}
                        </div>
                    </div>

                    {/* Our Experts Widget */}
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

            {/* Modals */}
            <EducationModal
                isOpen={modals.education}
                educationToEdit={editingEducation}
                onClose={() => {
                    setModals((m) => ({ ...m, education: false }));
                    setEditingEducation(null);
                }}
                onSuccess={(updatedUser) => {
                    setUser(updatedUser);
                    setEditingEducation(null);
                }}
            />
            <ExperienceModal
                isOpen={modals.experience}
                experienceToEdit={editingExperience}
                onClose={() => {
                    setModals((m) => ({ ...m, experience: false }));
                    setEditingExperience(null);
                }}
                onSuccess={(updatedUser) => {
                    setUser(updatedUser);
                    setEditingExperience(null);
                }}
            />
            <SkillModal
                isOpen={modals.skill}
                onClose={() => setModals((m) => ({ ...m, skill: false }))}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <EditIntroModal
                isOpen={modals.intro}
                user={user}
                onClose={() => setModals((m) => ({ ...m, intro: false }))}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <EditAboutModal
                isOpen={modals.about}
                user={user}
                onClose={() => setModals((m) => ({ ...m, about: false }))}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <ProfilePhotoModal
                isOpen={modals.photo}
                imageUrl={user.profile_image}
                onClose={() => setModals((m) => ({ ...m, photo: false }))}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <AddBackgroundModal
                isOpen={modals.background}
                onClose={() => setModals((m) => ({ ...m, background: false }))}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <EditContactInfoModal
                isOpen={modals.contact}
                user={user}
                onClose={() => setModals((m) => ({ ...m, contact: false }))}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <EmailVerificationModal
                isOpen={modals.emailVerify}
                currentEmail={user.email}
                onClose={() => setModals((m) => ({ ...m, emailVerify: false }))}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <ProjectModal
                isOpen={modals.project}
                projectToEdit={editingProject}
                onClose={() => {
                    setModals((m) => ({ ...m, project: false }));
                    setEditingProject(null);
                }}
                onSuccess={(updatedUser) => {
                    setUser(updatedUser);
                    setEditingProject(null);
                }}
            />
            <PortfolioLinkModal
                isOpen={modals.portfolioLink}
                user={user}
                onClose={() => setModals((m) => ({ ...m, portfolioLink: false }))}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <RefillWalletModal
                isOpen={isRefillModalOpen}
                currentBalance={walletBalance}
                onClose={() => setIsRefillModalOpen(false)}
                onSuccess={(newBal) => {
                    setWalletBalance(newBal);
                    setUser((prev: any) => ({ ...prev, wallet_balance: newBal }));
                }}
            />
            <EditPublicUrlModal
                isOpen={isEditUrlModalOpen}
                onClose={() => setIsEditUrlModalOpen(false)}
                currentUsername={user.username || ''}
                onUpdated={(newUsername) => {
                    setUser((prev: any) => ({ ...prev, username: newUsername }));
                    try {
                        const stored = localStorage.getItem('user');
                        if (stored) {
                            const parsed = JSON.parse(stored);
                            parsed.username = newUsername;
                            localStorage.setItem('user', JSON.stringify(parsed));
                        }
                    } catch {}
                }}
            />
            <OpenToWorkModal
                isOpen={isOpenToWorkModalOpen}
                onClose={() => setIsOpenToWorkModalOpen(false)}
                currentPrefs={user?.open_to_work}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
            <ProvidingServicesModal
                isOpen={isProvidingServicesModalOpen}
                onClose={() => setIsProvidingServicesModalOpen(false)}
                currentPrefs={user?.providing_services}
                onSuccess={(updatedUser) => setUser(updatedUser)}
            />
        </div>
    );
};

export default ProfilePage;